import { Contents, ServerConnection } from '@jupyterlab/services';
import { ISignal, Signal } from '@lumino/signaling';
import IDrive = Contents.IDrive;
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { RemoteNotebook } from './remote';
export interface IAuthResponse {
  token?: string;
  appId: string;
  apiUrl: string;
  socketUrl: string;
  metadata?: IFileMetadata;
  isAuthenticated: boolean;
  projectId?: string;
  user?: any;
}
export interface IFileMetadata {
  fileUrl: string;
  created: string;
  last_modified: string;
  readonly: boolean;
}

// Define the NotebookRequestType enum
export enum NotebookRequestType {
  AuthRequest = 'AuthRequest'
}

// Define the NotebookResponseType enum
export enum NotebookResponseType {
  AuthResponse = 'AuthResponse'
}

export interface IParentNotebookResponse {
  type: string;
  data: object;
  readonly: boolean;
}

const getResponseType = (type: NotebookRequestType): NotebookResponseType => {
  switch (type) {
    case NotebookRequestType.AuthRequest:
      return NotebookResponseType.AuthResponse;
  }
};

export interface ICallbackOptions {
  type: NotebookRequestType;
  msg: object;
}
export function requestParent({
  type,
  msg
}: ICallbackOptions): Promise<IParentNotebookResponse> {
  return new Promise((resolve, reject) => {
    const messageHandler = (event: any) => {
      const expectedResponseType = getResponseType(type);
      if (event.data.type === expectedResponseType.toString()) {
        window.removeEventListener('message', messageHandler);
        resolve(event.data);
      }
    };
    window.addEventListener('message', messageHandler);
    window.parent.postMessage({ type: type.toString(), ...msg }, '*');

    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      reject(new Error('Session request timed out'));
    }, 2000); // 5 seconds timeout
  });
}

class LangdbFile implements Contents.IModel {
  name: string;
  path: string;
  serverPath?: string | undefined;
  type: string;
  writable: boolean;
  created: string;
  last_modified: string;
  mimetype: string;
  content: any;
  chunk?: number | undefined;
  format: Contents.FileFormat;
  size?: number | undefined;
  indices?: readonly number[] | null | undefined;
  hash?: string | undefined;
  hash_algorithm?: string | undefined;
}

/**
 * A Contents.IDrive implementation for s3-api-compatible object storage.
 */
export class LangdbDrive implements Contents.IDrive {
  readonly serverSettings: ServerConnection.ISettings;
  private lastModified: string | undefined;
  private updateCounter: number = 0;
  constructor(registry: DocumentRegistry) {
    this.serverSettings = ServerConnection.makeSettings();
  }

  /**
   * The name of the drive.
   */
  get name(): string {
    return 'ldrive';
  }

  /**
   * A signal emitted when a file operation takes place.
   */
  get fileChanged(): ISignal<IDrive, Contents.IChangedArgs> {
    return this._fileChanged;
  }

  /**
   * Test whether the manager has been disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose of the resources held by the manager.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
  }

  /**
   * Get a file or directory.
   *
   * @param path: The path to the file.
   *
   * @param options: The options used to fetch the file.
   *
   * @returns A promise which resolves with the file content.
   */

  async getNotebook(path: string, dirty: boolean): Promise<Contents.IModel> {
    const response = await requestParent({
      type: NotebookRequestType.AuthRequest,
      msg: {}
    });

    const authResponse = response.data as IAuthResponse;
    if (!authResponse?.metadata) {
      throw new Error('metadata is missing');
    }
    const remote = new RemoteNotebook(authResponse);
    const notebook = await remote.getFile(dirty);
    // check if result is json object
    const result_string = JSON.stringify(notebook);
    const display_content = JSON.parse(result_string);
    const contents: Contents.IModel = {
      type: 'notebook',
      format: 'json',
      path: `${path}`,
      name: `${path}`,
      created: authResponse.metadata.created,
      writable: !response.readonly,
      last_modified: authResponse.metadata.last_modified,
      mimetype: 'application/json',
      content: display_content,
      size: result_string.length
    };

    console.log('CONTENTS', contents);

    if (!this.lastModified) {
      this.lastModified = authResponse.metadata.last_modified;
    }

    return Promise.resolve(contents);
  }
  async get(
    path: string,
    options?: Contents.IFetchOptions
  ): Promise<Contents.IModel> {
    return this.getNotebook(path, false);
  }

  /**
   * Get an encoded download url given a file path.
   *
   * @param path - An absolute POSIX file path on the server.
   *
   * #### Notes
   * It is expected that the path contains no relative paths,
   * use [[ContentsManager.getAbsolutePath]] to get an absolute
   * path if necessary.
   */
  async getDownloadUrl(path: string): Promise<string> {
    throw Error('Not yet implemented');
  }

  /**
   * Create a new untitled file or directory in the specified directory path.
   *
   * @param options: The options used to create the file.
   *
   * @returns A promise which resolves with the created file content when the
   *    file is created.
   */
  async newUntitled(
    options: Contents.ICreateOptions = {}
  ): Promise<Contents.IModel> {
    throw Error('Not yet implemented newUntitled');
  }

  /**
   * Delete a file.
   *
   * @param path - The path to the file.
   *
   * @returns A promise which resolves when the file is deleted.
   */
  async delete(path: string): Promise<void> {
    throw Error('Not yet implemented delete');
  }

  /**
   * Rename a file or directory.
   *
   * @param path - The original file path.
   *
   * @param newPath - The new file path.
   *
   * @returns A promise which resolves with the new file contents model when
   *   the file is renamed.
   */
  async rename(path: string, newPath: string): Promise<Contents.IModel> {
    throw Error('Not yet implemented rename');
  }

  /**
   * Save a file.
   *
   * @param path - The desired file path.
   *
   * @param options - Optional overrides to the model.
   *
   * @returns A promise which resolves with the file content model when the
   *   file is saved.
   */
  async save(
    path: string,
    options: Partial<Contents.IModel>
  ): Promise<Contents.IModel> {
    console.log(' SAVE CALLED');
    if (path.startsWith('https:/')) {
      return Promise.resolve(options as Contents.IModel);
    }
    try {
      const response = await requestParent({
        type: NotebookRequestType.AuthRequest,
        msg: {}
      });

      const authResponse = response.data as IAuthResponse;
      const { metadata, isAuthenticated } = authResponse;
      if (!metadata || metadata.readonly || !isAuthenticated) {
        return Promise.resolve(options as Contents.IModel);
      }
      const remote = new RemoteNotebook(authResponse);
      await remote.saveFile(options.content!);
      const model = options as LangdbFile;
      model.writable = !authResponse.metadata?.readonly || false;
      return Promise.resolve(model);
    } catch (e: any) {
      console.error(e);
      return Promise.reject(e);
    }
  }

  /**
   * Copy a file into a given directory.
   *
   * @param path - The original file path.
   *
   * @param toDir - The destination directory path.
   *
   * @returns A promise which resolves with the new contents model when the
   *  file is copied.
   */
  async copy(fromFile: string, toDir: string): Promise<Contents.IModel> {
    throw Error('Not yet implemented copy');
  }

  /**
   * Create a checkpoint for a file.
   *
   * @param path - The path of the file.
   *
   * @returns A promise which resolves with the new checkpoint model when the
   *   checkpoint is created.
   */
  async createCheckpoint(path: string): Promise<Contents.ICheckpointModel> {
    return Promise.resolve({
      id: `${this.updateCounter++}`,
      last_modified: new Date().toString()
    });
  }

  /**
   * List available checkpoints for a file.
   *
   * @param path - The path of the file.
   *
   * @returns A promise which resolves with a list of checkpoint models for
   *    the file.
   */
  async listCheckpoints(path: string): Promise<Contents.ICheckpointModel[]> {
    return [];
  }

  /**
   * Restore a file to a known checkpoint state.
   *
   * @param path - The path of the file.
   *
   * @param checkpointID - The id of the checkpoint to restore.
   *
   * @returns A promise which resolves when the checkpoint is restored.
   */
  async restoreCheckpoint(path: string, checkpointID: string): Promise<void> {
    throw Error('Not yet implemented restore');
  }

  /**
   * Delete a checkpoint for a file.
   *
   * @param path - The path of the file.
   *
   * @param checkpointID - The id of the checkpoint to delete.
   *
   * @returns A promise which resolves when the checkpoint is deleted.
   */
  async deleteCheckpoint(path: string, checkpointID: string): Promise<void> {
    return void 0;
  }

  private _isDisposed = false;
  private _fileChanged = new Signal<this, Contents.IChangedArgs>(this);
  // private _fileTypeForPath: (path: string) => DocumentRegistry.IFileType;
}
