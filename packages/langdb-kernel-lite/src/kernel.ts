import { KernelMessage } from '@jupyterlab/services';
import { BaseKernel, IKernel, IKernelSpecs } from '@jupyterlite/kernel';
import { EventSourceMessage } from '@microsoft/fetch-event-source';
import {
  getBytes,
  getLines,
  getMessages
} from '@microsoft/fetch-event-source/lib/cjs/parse';

const LANGDB_API_URL = 'https://api.dev.langdb.ai';

export interface IFileMetadata {
  fileUrl: string;
  created: string;
  last_modified: string;
  readonly: boolean;
}
export interface IAuthResponse {
  token?: string;
  appId: string;
  apiUrl: string;
  metadata?: IFileMetadata;
  isAuthenticated: boolean;
}
function requestSession(): Promise<IAuthResponse> {
  return new Promise((resolve, reject) => {
    const messageHandler = (event: any) => {
      if (event.data.type === 'AuthResponse') {
        window.removeEventListener('message', messageHandler);
        resolve(event.data.data);
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
export interface RenderEvent {
  render: boolean;
  type: string;
  value: string;
}

function requestRender(render: RenderEvent): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const messageHandler = (event: any) => {
      if (event.data.type === 'RenderResponse') {
        window.removeEventListener('message', messageHandler);
        resolve(event.data.data);
      }
    };
    window.addEventListener('message', messageHandler);
    window.parent.postMessage({ type: 'RenderRequest', data: render }, '*');

    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      reject(new Error('Render request timed out'));
    }, 5000); // 1 second timeout
  });
}

const getHeaders = (auth: IAuthResponse): Headers => {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');

  headers.set('Authorization', `Bearer ${auth?.token}`);
  return headers;
};
/**
 * A kernel that exexutes request against langdb.
 */
export class LangdbKernel extends BaseKernel {
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
      banner: 'Langdb Kernel',
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

    // Regular expression to detect magic commands between %
    const magicMatch = code.match(/^%([^%]+)%/);
    let storeJson: { variableName: string } | undefined = undefined;
    if (magicMatch) {
      const magicCommand = magicMatch[1].trim();
      code = code.replace(/^%([^%]+)%/, '').trim();
      if (magicCommand.startsWith('python')) {
        await this.handleRunPython(code);
        return {
          status: 'ok',
          execution_count: this.executionCount,
          user_expressions: {}
        };
      } else if (magicCommand.startsWith('export')) {
        // This is a special case schenario where these parameters will be used in LangDB execution.
        const exportMatch = magicCommand.match(/^export\s+(\w+)?/);
        if (exportMatch) {
          storeJson = { variableName: exportMatch[1] };
          code = code.replace(/^%export\s+\w*/, '').trim();
        } else {
          throw new Error(
            'variable name not found: export should follow by variable name'
          );
        }
      }
    }

    // Handle SQL execution (add your SQL execution logic here)
    return this.executeLocalRequest({ code }, storeJson);
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
    // Initialize preset libraries only once
    await this.initPythonLibraries(kernel);
    return kernel;
  }

  private async initPythonLibraries(kernel: IKernel): Promise<void> {
    const libraries = ['pandas as pd', 'json'];
    const importStatements = libraries.map(lib => `import ${lib}`).join('\n');
    try {
      await this.executeInPythonKernel(kernel, importStatements);
    } catch (e: any) {
      console.error('Failed to initialize Python libraries:', e);
    }
  }

  private async handleRunPython(code: string): Promise<void> {
    const pythonCode = code.replace('%python', '').trim();
    // let completePythonCode = pythonCode;
    // if (this.variables.size > 0) {
    //   completePythonCode = `import json\nimport pandas as pd\njson_data = ${this.storedJson}\ndf = pd.DataFrame(json_data)\n${pythonCode}`;
    // }
    try {
      const kernel = await this.getPythonKernel();
      await this.executeInPythonKernel(kernel, pythonCode);
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
    storeJson?: { variableName: string }
  ): Promise<KernelMessage.IExecuteReplyMsg['content']> {
    const { code } = content;
    try {
      const authResponse = await requestSession();
      if (!authResponse || authResponse.metadata?.readonly) {
        window.parent.postMessage({ type: 'OpenRequireCloneDialog' }, '*');
        return {
          status: 'abort',
          execution_count: this.executionCount,
          user_expressions: {}
        } as KernelMessage.IExecuteReplyMsg['content'];
      }

      const apiUrl = authResponse?.apiUrl || LANGDB_API_URL;
      const queryUrl = `${apiUrl}/query`;
      const response = await fetch(queryUrl, {
        method: 'POST',
        headers: getHeaders(authResponse),
        body: JSON.stringify({ query: code, trace: true })
      });
      let status = 'ok';
      if (response.status >= 200 && response.status < 300) {
        status = 'ok';
        if (
          code.toLowerCase().startsWith('create ') ||
          code.toLowerCase().startsWith('drop ')
        ) {
          window.parent.postMessage({ type: 'RefreshSidebar' }, '*');
        }
      } else {
        console.debug('POST request failed with status:', response.status);
        status = 'error';
      }
      const traceId = response.headers.get('x-trace-id');
      const modelName = response.headers.get('x-model-name');
      const metadata = { traceId, modelName };
      const contentType = response.headers.get('content-type') || '';
      const onmessage = (msg: EventSourceMessage) => {
        this.stream({ name: 'stdout', text: msg.data });
      };

      if (contentType.includes('text/event-stream')) {
        await getBytes(
          response.body!,
          getLines(
            getMessages(
              _id => {
                return;
              },
              _retry => {
                return;
              },
              onmessage
            )
          )
        );

        return this.createSuccessResponse();
      }
      let jsonResponse;
      const rawResponse = await response.text();
      try {
        jsonResponse = JSON.parse(rawResponse);
      } catch (e: any) {
        console.warn('JSON parsing failed, returning raw response');
        this.publishExecuteResult({
          execution_count: this.executionCount,
          data: {
            'text/plain': rawResponse
          },
          metadata: { trace: traceId }
        });
        return {
          status: 'ok',
          execution_count: this.executionCount,
          user_expressions: {}
        };
      }
      // Render will be hijacked
      if (jsonResponse.render) {
        const render = await requestRender(jsonResponse);
        if (render) {
          this.publishExecuteResult({
            execution_count: this.executionCount,
            data: {
              'text/html': render
            },
            metadata: {}
          });
        }
        return this.createSuccessResponse();
      }
      if (code.toLowerCase().startsWith('chat')) {
        const params = jsonResponse.params || null;
        const model_name = jsonResponse.model_name || null;
        const server_url =
          jsonResponse.server_url || `${authResponse.apiUrl}/stream`;
        const chatUrl = `${apiUrl}/apps/${authResponse.appId}/chat`;
        await fetch(chatUrl, {
          method: 'POST',
          headers: getHeaders(authResponse),
          body: JSON.stringify({
            model_name,
            server_url,
            params
          })
        });

        if (!model_name) {
          throw new Error('Model not specified.');
        }
        window.parent.postMessage({ type: 'RefreshChat' }, '*');

        return this.createSuccessResponse();
      }

      if (jsonResponse.exception) {
        throw new Error(jsonResponse.exception);
      }
      if (storeJson) {
        // this.variables.set(variableName, jsonResponse.data);
        await this.exportPythonVariables(
          storeJson.variableName,
          jsonResponse.data
        );

        this.publishExecuteResult({
          execution_count: this.executionCount,
          data: {
            'text/html': `Variable ${storeJson.variableName} exported`
          },
          metadata: {}
        });
      } else {
        const html = toHtml(jsonResponse, metadata as Metadata);
        this.publishExecuteResult({
          execution_count: this.executionCount,
          data: {
            'text/html': html
          },
          metadata: {}
        });
      }

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

  async exportPythonVariables(variableName: string, data: object) {
    const escapedData = JSON.stringify(data)
      .replace(/\\/g, '\\\\') // Escape backslashes
      .replace(/"/g, '\\"') // Escape double quotes
      .replace(/'/g, "\\'") // Escape single quotes
      .replace(/\n/g, '\\n') // Escape newlines
      .replace(/\t/g, '\\t') // Escape tabs
      .replace(/\r/g, '\\r'); // Escape carriage returns
    const code = `${variableName} = pd.DataFrame(json.loads("${escapedData}"))`;
    await this.handleRunPython(code);
  }
  // Helper method to create a success response
  private createSuccessResponse(): KernelMessage.IExecuteReplyMsg['content'] {
    return {
      status: 'ok',
      execution_count: this.executionCount,
      user_expressions: {}
    };
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
    return {
      comms: {},
      status: 'ok'
    };
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
    return;
  }

  /**
   * Send an `comm_msg` message.
   *
   * @param msg - The comm_msg message.
   */
  async commMsg(msg: KernelMessage.ICommMsgMsg): Promise<void> {
    return;
  }

  /**
   * Send an `comm_close` message.
   *
   * @param close - The comm_close message.
   */
  async commClose(msg: KernelMessage.ICommCloseMsg): Promise<void> {
    return;
  }
}

interface Column {
  name: string;
  type: string;
}
interface ClickhouseResponse {
  data: Record<string, any>[];
  meta: Column[];
}
const getTraceHtml = ({ traceId, modelName }: Metadata): [string, string] => {
  modelName = modelName || '';
  const onclick = `
    <script>
      document.querySelectorAll('[data-trace-id="${traceId}"]').forEach(element => {
        element.onclick = function() {
          console.log("clicked");
          window.parent.postMessage(
            { type: 'OpenTrace', traceId: '${traceId}', modelName: '${modelName}'},
            '*'
          );
          return false;
        };
      });
    </script>
  `;
  const html = `
    <style>
      .trace-id {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 10px;
      }
      .trace-id span.trace {
        margin-left: 5px;
        margin-right: 5px;

      }
      .trace-id span.open {
        cursor: pointer;
        text-decoration: underline;
        color: rgb(176 72 140);
      }
        
    </style>
    <div class="trace-id">
      Trace ID: <span class="trace"> ${traceId}</span> 
      <span class="open" data-trace-id="${traceId}">Open</span>
    </div>
  `;

  return [html, onclick];
};

type Metadata = {
  traceId?: string;
  modelName?: string;
};

const toHtml = (jsonData: ClickhouseResponse, metadata: Metadata): string => {
  const data = jsonData.data;
  // Check if the input data is an array and has elements
  if (!Array.isArray(data) || data.length === 0) {
    return '<p>No data available to display</p>';
  }

  let html = '';
  let script = 's';
  if (metadata.traceId) {
    const [h, s] = getTraceHtml(metadata);
    html = h;
    script = s;
  }

  // Create the table and the table header
  html += '<table border="1"><thead><tr>';

  // Get the headers from the keys of the first object in the array
  jsonData.meta.forEach(col => {
    html += `<th>${col.name}</th>`;
  });

  html += '</tr></thead><tbody>';

  // Add rows
  jsonData.data.forEach(row => {
    html += '<tr>';
    jsonData.meta.forEach(col => {
      let val = row[col.name];
      if (typeof val === 'object') {
        val = JSON.stringify(val);
      }
      html += `<td><pre>${val}</pre></td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  html += script;
  return html;
};
