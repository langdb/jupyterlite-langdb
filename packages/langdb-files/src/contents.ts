import { Contents, ServerConnection } from '@jupyterlab/services';
import { ISignal, Signal } from '@lumino/signaling';
import IDrive = Contents.IDrive;
import { DocumentRegistry } from '@jupyterlab/docregistry';
import axios from 'axios';

const temp_token = 'eyJraWQiOiJ2cDJRRUZrODNzSWw4WFwvcDd3S2VObnJxOU9DalwvdFJxQ0lXU2k3QldlN3M9IiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiJhOWZhYjViYy0wMGIxLTcwOGQtODQzOS1hM2MyNWViNDRjYmUiLCJjb2duaXRvOmdyb3VwcyI6WyJjb21wYW55XzM2YjMwOTc2LTkyMmYtNDUxOS1iMDg0LTlmYjdiNzk1YjgyMCIsImFwLXNvdXRoZWFzdC0xX1c4TmtNcVBkcV9Hb29nbGUiXSwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLmFwLXNvdXRoZWFzdC0xLmFtYXpvbmF3cy5jb21cL2FwLXNvdXRoZWFzdC0xX1c4TmtNcVBkcSIsInZlcnNpb24iOjIsImNsaWVudF9pZCI6ImNiNm8xOXN2dWJ1dHR0a25qMTQ4dTJrZTQiLCJvcmlnaW5fanRpIjoiYzM4NzU1NDYtYWU5Yy00ZDBkLWJiYzItZmRjMTlmOTM0N2JiIiwidG9rZW5fdXNlIjoiYWNjZXNzIiwic2NvcGUiOiJhd3MuY29nbml0by5zaWduaW4udXNlci5hZG1pbiBvcGVuaWQgcHJvZmlsZSBlbWFpbCIsImF1dGhfdGltZSI6MTcxNzU1ODk5NSwiZXhwIjoxNzE3NTgxMTQ0LCJpYXQiOjE3MTc1Nzc1NDQsImp0aSI6ImVkNzI3YThlLTAxMmEtNGEwZi1iMTJiLTkxNWU4YTgyMTUzNSIsInVzZXJuYW1lIjoiZ29vZ2xlXzEwODg0MzQwMzA3MDU3MjQ0MzM0MSJ9.ZCCtjaN1KDLpNI3avL-i8Nb0CoCZRaQQIELJXw1X4RPxgbR9MPodhBP68NkZV-EZmW1mdo7oSMBAgTm22on0Wdd-jtiUT02piCELL0IRbVIZ_zVWMixtnQmcLRyTYLRFwPc0omTJmDqZX-ZAQOsffediRGuBoHfNFBnckRWe1YLUbq9zyxMM1_XZlrc4JPemSH8-ayUL3usWuGuo_nR_j2l6IbdGCSadOynbVC706dnnY9lf3CayxaDsNCKBs5Jo5pEas-uQcA_IoUhWOpurMGDMnUzhqfNvSVmLLyh_eY6xtOG304st7QNv1YdSz6hRfH0D3UrjS5YGwUPZKco5Dw'

async function getFile(app_id: string, token: string | undefined): Promise<any> {
  console.log(token, temp_token);
  try {
    const response = await axios.get(`http://localhost:8081/apps/${app_id}/file`, {
      headers: {
        'Authorization': `Bearer ${token || temp_token}`
      },
      maxBodyLength: Infinity,
    });
    // get response data as json
    return response.data;
  } catch (error) {
    console.error('Error fetching blob:', error);
    throw error;
  }
}

/**
 * A Contents.IDrive implementation for s3-api-compatible object storage.
 */
export class LangdbDrive implements Contents.IDrive {
  readonly serverSettings: ServerConnection.ISettings;
  private token: string | undefined;

  constructor(registry: DocumentRegistry, token: string | undefined) {
    this.serverSettings = ServerConnection.makeSettings();
    this.token = token;
  }

  set_token(token: string | undefined): void {
    this.token = token;
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

  async get(
    path: string,
    options?: Contents.IFetchOptions
  ): Promise<Contents.IModel> {
    let fetch_path = path.replace('.ipynb', '');
    const result = await getFile(fetch_path, this.token);

    // check if result is json object
    let result_string = JSON.stringify(result);
    let display_content = JSON.parse(result_string)
    const contents: Contents.IModel = {
      type: 'notebook',
      format: 'json',
      path: `${path}.ipynb`,
      name: `${path}.ipynb`,
      content: display_content,
      created: '',
      writable: true,
      last_modified: '',
      size: result_string.length,
      mimetype: 'application/json',
    };

    return Promise.resolve(contents);
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
    console.log('=== GETTING DOWNLOAD URL', path);
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
    throw Error('Not yet implemented save');
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
    console.log('===== Creating checkpoint', path);
    const emptyCheckpoint: Contents.ICheckpointModel = {
      id: '',
      last_modified: ''
    };
    return Promise.resolve(emptyCheckpoint);
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
