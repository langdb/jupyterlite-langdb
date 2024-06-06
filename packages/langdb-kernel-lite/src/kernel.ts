import { KernelMessage } from '@jupyterlab/services';
import axios from 'axios';
import { BaseKernel, IKernel, IKernelSpecs } from '@jupyterlite/kernel';
const LANGDB_API_URL = 'https://api.dev.langdb.ai';

export type AuthResponse = {
  token: string;
  apiUrl: string;
};
function requestSession(): Promise<AuthResponse> {
  return new Promise((resolve, reject) => {
    const messageHandler = (event: any) => {
      console.log('received event');
      if (event.data.type === 'AuthResponse') {
        window.removeEventListener('message', messageHandler);
        resolve(event.data.msg);
      }
    };
    window.addEventListener('message', messageHandler);
    window.parent.postMessage({ type: 'AuthRequest' }, '*');

    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      reject(new Error('Session request timed out'));
    }, 2000); // 5 seconds timeout
  });
}

/**
 * A kernel that exexutes request against langdb.
 */
export class LangdbKernel extends BaseKernel {
  private storedJson: object | undefined = undefined;
  private kernelOptions: any;
  private kernelspecs: IKernelSpecs;
  private pythonKernel: IKernel | undefined;

  constructor(options: any, kernelspecs: IKernelSpecs) {
    super(options);
    this.kernelOptions = options;
    this.kernelspecs = kernelspecs;
  }
  /**
   * Handle a kernel_info_request message
   */
  async kernelInfoRequest(): Promise<KernelMessage.IInfoReplyMsg['content']> {
    const content: KernelMessage.IInfoReply = {
      implementation: 'Text',
      implementation_version: '0.1.0',
      language_info: {
        codemirror_mode: {
          name: 'sql'
        },
        file_extension: '.sql',
        mimetype: 'text/sql',
        name: 'langdb',
        nbconvert_exporter: 'markdown',
        pygments_lexer: 'sql',
        version: 'es2017'
      },
      protocol_version: '5.3',
      status: 'ok',
      banner: 'A jupyter lite kernel for LangDB',
      help_links: [
        {
          text: 'langdb Kernel',
          url: 'https://github.com/langdb/langdb-kernel-lite'
        }
      ]
    };
    return content;
  }

  async executeRequest(
    content: KernelMessage.IExecuteRequestMsg['content']
  ): Promise<KernelMessage.IExecuteReplyMsg['content']> {
    let code = content.code.trim();

    if (code.startsWith('%python')) {
      await this.handleRunPython(code);
      return {
        status: 'ok',
        execution_count: this.executionCount,
        user_expressions: {}
      };
    } else {
      const storeJson = code.startsWith('%storejson');
      code = code.replace('%storejson', '').trim();
      // Handle SQL execution (add your SQL execution logic here)
      return this.executeLocalRequest({ code }, storeJson);
    }
  }
  private async getPythonKernel(): Promise<IKernel> {
    if (this.pythonKernel) {
      return this.pythonKernel;
    }
    const factory = this.kernelspecs.factories.get('python');
    if (!factory) {
      throw new Error('Kernel not found: python');
    }
    const kernel = await factory({
      ...this.kernelOptions,
      id: 'python',
      sendMessage: (msg: KernelMessage.IMessage) => {
        if (KernelMessage.isExecuteResultMsg(msg)) {
          this.publishExecuteResult(msg.content);
        } else if (KernelMessage.isErrorMsg(msg)) {
          this.publishExecuteError(msg.content);
        } else if (KernelMessage.isStreamMsg(msg)) {
          this.stream(msg.content);
        } else {
          console.debug('ignoring msg', msg);
        }

        this.kernelOptions.sendMessage(msg);
      },
      name: 'python',
      location: ''
    });
    this.pythonKernel = kernel;
    return kernel;
  }

  private async handleRunPython(code: string): Promise<void> {
    const pythonCode = code.replace('%python', '').trim();
    let completePythonCode = pythonCode;
    if (this.storedJson) {
      completePythonCode = `import json\nimport pandas as pd\njson_data = ${this.storedJson}\ndf = pd.DataFrame(json_data)\n${pythonCode}`;
    }
    try {
      const kernel = await this.getPythonKernel();
      await this.executeInPythonKernel(kernel, completePythonCode);
    } catch (e: any) {
      const error = {
        ename: e.name,
        evalue: e.value,
        traceback: []
      };
      this.publishExecuteError(error);
    }
  }
  private async executeInPythonKernel(
    kernel: IKernel,
    code: string
  ): Promise<void> {
    if (!this.parentHeader) {
      throw new Error('parent header is exepe');
    }
    const message =
      KernelMessage.createMessage<KernelMessage.IExecuteRequestMsg>({
        ...this.parentHeader,
        msgType: 'execute_request',
        channel: 'shell',
        session: this.parentHeader.session,
        content: { code },
        parentHeader: this.parentHeader
      });

    await kernel.handleMessage(message);
  }

  /**
   * Handle an `execute_request` message
   *
   * @param msg The parent message.
   */
  async executeLocalRequest(
    content: KernelMessage.IExecuteRequestMsg['content'],
    storeJson: boolean
  ): Promise<KernelMessage.IExecuteReplyMsg['content']> {
    const { code } = content;
    console.debug('Starting execution of code');
    console.debug(`Original code: ${code}`);

    try {
      const auth = await requestSession();
      const apiUrl = auth?.apiUrl || LANGDB_API_URL;
      const queryUrl = `${apiUrl}/query`;
      const response = await axios.post(
        queryUrl,
        { query: code },
        {
          headers: {
            Authorization: `Bearer ${auth?.token}`
          }
        }
      );
      let status = 'ok';

      if (response.status >= 200 && response.status < 300) {
        console.debug('POST request successful');
        status = 'ok';
      } else {
        console.debug('POST request failed with status:', response.status);
        status = 'error';
      }

      if (typeof response.data !== 'object') {
        console.warn('JSON parsing failed, returning raw response');
        const rawResponse = response.data;
        this.publishExecuteResult({
          execution_count: this.executionCount,
          data: {
            'text/plain': rawResponse
          },
          metadata: {}
        });
        return {
          status: 'ok',
          execution_count: this.executionCount,
          user_expressions: {}
        };
      }

      const jsonResponse = response.data;
      if (storeJson) {
        this.storedJson = jsonResponse;
      }

      if (code.toLowerCase().startsWith('chat')) {
        console.debug(JSON.stringify(jsonResponse));
        const params = jsonResponse.params || {};
        const endpoint = jsonResponse.endpoint_name || {};
        const server_url =
          jsonResponse.server_url || 'http://localhost:8080/stream';
        const initialParams = { server_url, endpoint };

        if (!endpoint) {
          throw new Error('Endpoint not specified.');
        }

        const combinedParams = { ...initialParams, ...params };
        const query = Object.entries(combinedParams)
          .map(([k, v]) => `${k}=${v}`)
          .join('&');
        const iframeSrc = `https://langdb.github.io/langdb-widget?${query}`;
        console.debug(`iframe url: ${iframeSrc}`);

        const iframeHtml = `<iframe src="${iframeSrc}" width="100%" height="600" frameborder="0"></iframe>`;
        this.publishExecuteResult({
          execution_count: this.executionCount,
          data: {
            'text/html': iframeHtml
          },
          metadata: {}
        });

        return {
          status: 'ok',
          execution_count: this.executionCount,
          payload: [],
          user_expressions: {}
        };
      }

      if (jsonResponse.exception) {
        throw new Error(jsonResponse.exception);
      }

      const data = jsonResponse.data || [];

      const html = toHtml(data);
      console.debug(`DataFrame created with ${data.length} rows`);
      this.publishExecuteResult({
        execution_count: this.executionCount,
        data: {
          'text/html': html
        },
        metadata: {}
      });

      return {
        status,
        execution_count: this.executionCount,
        user_expressions: {}
      } as KernelMessage.IExecuteReplyMsg['content'];
    } catch (error: any) {
      console.error('An error occurred', error);
      this.publishExecuteError({
        ename: error.name,
        evalue: error.message,
        traceback: []
      });
      return {
        status: 'error',
        execution_count: this.executionCount,
        ename: error.name,
        evalue: error.message,
        traceback: []
      };
    }
  }

  /**
   * Handle an complete_request message
   *
   * @param msg The parent message.
   */
  async completeRequest(
    content: KernelMessage.ICompleteRequestMsg['content']
  ): Promise<KernelMessage.ICompleteReplyMsg['content']> {
    throw new Error('Not implemented');
  }

  /**
   * Handle an `inspect_request` message.
   *
   * @param content - The content of the request.
   *
   * @returns A promise that resolves with the response message.
   */
  async inspectRequest(
    content: KernelMessage.IInspectRequestMsg['content']
  ): Promise<KernelMessage.IInspectReplyMsg['content']> {
    throw new Error('Not implemented');
  }

  /**
   * Handle an `is_complete_request` message.
   *
   * @param content - The content of the request.
   *
   * @returns A promise that resolves with the response message.
   */
  async isCompleteRequest(
    content: KernelMessage.IIsCompleteRequestMsg['content']
  ): Promise<KernelMessage.IIsCompleteReplyMsg['content']> {
    throw new Error('Not implemented');
  }

  /**
   * Handle a `comm_info_request` message.
   *
   * @param content - The content of the request.
   *
   * @returns A promise that resolves with the response message.
   */
  async commInfoRequest(
    content: KernelMessage.ICommInfoRequestMsg['content']
  ): Promise<KernelMessage.ICommInfoReplyMsg['content']> {
    throw new Error('Not implemented');
  }

  /**
   * Send an `input_reply` message.
   *
   * @param content - The content of the reply.
   */
  inputReply(content: KernelMessage.IInputReplyMsg['content']): void {
    throw new Error('Not implemented');
  }

  /**
   * Send an `comm_open` message.
   *
   * @param msg - The comm_open message.
   */
  async commOpen(msg: KernelMessage.ICommOpenMsg): Promise<void> {
    throw new Error('Not implemented');
  }

  /**
   * Send an `comm_msg` message.
   *
   * @param msg - The comm_msg message.
   */
  async commMsg(msg: KernelMessage.ICommMsgMsg): Promise<void> {
    throw new Error('Not implemented');
  }

  /**
   * Send an `comm_close` message.
   *
   * @param close - The comm_close message.
   */
  async commClose(msg: KernelMessage.ICommCloseMsg): Promise<void> {
    throw new Error('Not implemented');
  }
}

const toHtml = (jsonData: object[]): string => {
  // Check if the input data is an array and has elements
  if (!Array.isArray(jsonData) || jsonData.length === 0) {
    return '<p>No data available to display</p>';
  }

  // Create the table and the table header
  let table = '<table border="1"><thead><tr>';

  // Get the headers from the keys of the first object in the array
  Object.keys(jsonData[0]).forEach(key => {
    table += `<th>${key}</th>`;
  });

  table += '</tr></thead><tbody>';

  // Add rows
  jsonData.forEach(row => {
    table += '<tr>';
    Object.values(row).forEach(value => {
      table += `<td>${value}</td>`;
    });
    table += '</tr>';
  });

  table += '</tbody></table>';

  return table;
};
