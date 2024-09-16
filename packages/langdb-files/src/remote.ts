import axios from 'axios';
import { IAuthResponse, IFileMetadata } from './drive';

export class RemoteNotebook {
  authResponse: IAuthResponse;
  fileMetadata: IFileMetadata;
  constructor(authResponse: IAuthResponse) {
    this.authResponse = authResponse;
  }
  async getFile(dirty: boolean = false): Promise<any> {
    const { appId, apiUrl, metadata } = this.authResponse;
    if (!appId && !metadata) {
      return;
    }
    try {
      if (!appId) {
        const fileUrl = metadata?.fileUrl;
        return await this.getSample(fileUrl!);
      }

      let notebookUrl = `${apiUrl}${this.authResponse.projectId ? `/projects/${this.authResponse.projectId}` : ''}/apps/${appId}/file`;
      if (dirty) {
        notebookUrl = `${apiUrl}${this.authResponse.projectId ? `/projects/${this.authResponse.projectId}` : ''}/apps/${appId}/changes`;
      }
      const response = await fetch(notebookUrl!, {
        method: 'GET',
        headers: await this.getHeaders()
      });
      if (!response.ok) {
        throw new Error('Error fetching file');
      }
      // get response data as json
      const data = response.json();
      return data;
    } catch (error) {
      console.error('Error fetching blob:', error);
      throw error;
    }
  }

  async saveFile(content: object): Promise<any> {
    try {
      const { apiUrl, token, appId } = this.authResponse;
      if (!token) {
        return;
      }
      const blob = new Blob([JSON.stringify(content)], {
        type: 'application/json'
      });
      const formData = new FormData();
      formData.append('file', blob, 'file.ipynb');

      const response = await fetch(
        `${apiUrl}${this.authResponse.projectId ? `/projects/${this.authResponse.projectId}` : ''}/apps/${appId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        }
      );

      if (!response.ok) {
        throw new Error('Error saving file');
      }

      // get response data as json
      return await response.json();
    } catch (error) {
      console.error('Error saving file:', error);
      throw error;
    }
  }

  async getSample(fileUrl: string): Promise<string> {
    const response = await axios.get(fileUrl);
    return response.data;
  }

  async getHeaders(): Promise<Record<string, any>> {
    const { isAuthenticated, appId, token } = this.authResponse;
    const headers: Record<string, any> = {
      'Content-Type': 'application/json'
    };
    if (!isAuthenticated && appId) {
      headers['X-PUBLIC-APPLICATION-ID'] = appId;
    } else if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['Accept'] = 'application/vnd.github.v3.raw';
    }
    return headers;
  }
}
