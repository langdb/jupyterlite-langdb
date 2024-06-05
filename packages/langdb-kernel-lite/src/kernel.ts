import { KernelMessage } from '@jupyterlab/services';
import axios from 'axios';
import { BaseKernel } from '@jupyterlite/kernel';

const LANGDB_API_URL = 'https://api.dev.langdb.ai';

export type AuthResponse = {
  token: string;
  apiUrl: string;
};
/**
 * A kernel that exexutes request against langdb.
 */
export class LangdbKernel extends BaseKernel {
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

  /**
   * Handle an `execute_request` message
   *
   * @param msg The parent message.
   */
  async executeRequest(
    content: KernelMessage.IExecuteRequestMsg['content']
  ): Promise<KernelMessage.IExecuteReplyMsg['content']> {
    const { code } = content;
    console.debug('Starting execution of code');
    console.debug(`Original code: ${code}`);

    try {
      const authStr = window.localStorage.getItem('auth');
      let auth = undefined as AuthResponse | undefined;
      if (authStr) {
        auth = JSON.parse(authStr);
      }

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
