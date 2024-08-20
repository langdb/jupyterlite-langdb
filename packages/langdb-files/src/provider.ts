import { showErrorMessage, Dialog } from '@jupyterlab/apputils';
import { PromiseDelegate } from '@lumino/coreutils';
import { DocumentChange, YDocument } from '@jupyter/ydoc';
import { Awareness } from 'y-protocols/awareness';
import { WebsocketProvider as YWebsocketProvider } from 'y-websocket';
import { IAuthResponse, NotebookRequestType, requestParent } from './drive';
import { IDocumentProvider } from '@jupyter/docprovider';
import { Signal } from '@lumino/signaling';
import { User } from '@jupyterlab/services';

/**
 * A class to provide Yjs synchronization over WebSocket.
 *
 * We specify custom messages that the server can interpret. For reference please look in yjs_ws_server.
 *
 */
export class WebSocketProvider implements IDocumentProvider {
  /**
   * Construct a new WebSocketProvider
   *
   * @param options The instantiation options for a WebSocketProvider
   */
  constructor(options: WebSocketProvider.IOptions) {
    this._isDisposed = false;
    this._sharedModel = options.model;
    this._awareness = options.model.awareness;
    this._yWebsocketProvider = null;
    this._connect().catch(e => console.warn(e));
  }

  /**
   * Test whether the object has been disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * A promise that resolves when the document provider is ready.
   */
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  /**
   * Dispose of the resources held by the object.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._yWebsocketProvider?.off('connection-close', this._onConnectionClosed);
    this._yWebsocketProvider?.off('sync', this._onSync);
    this._yWebsocketProvider?.destroy();
    Signal.clearData(this);
  }

  private async _connect(): Promise<void> {
    const response = await requestParent({
      type: NotebookRequestType.AuthRequest,
      msg: {}
    });

    const authResponse = response.data as IAuthResponse;
    const token = authResponse.token!;
    const user = authResponse.user;
    if (!user) {
      this._awareness.setLocalStateField('user', {
        username: user.attributes.email,
        name: user.attributes.name,
        avatar_url: user.attributes.picture
      } as User.IIdentity);
    }
    this._yWebsocketProvider = new YWebsocketProvider(
      authResponse.socketUrl,
      `${authResponse.appId}.ipynb`,
      this._sharedModel.ydoc,
      {
        disableBc: true,
        params: { token },
        awareness: this._awareness
      }
    );

    this._yWebsocketProvider.on('sync', this._onSync);
    this._yWebsocketProvider.on('connection-close', this._onConnectionClosed);
    this._yWebsocketProvider.on('connection-error', this._connect);
  }

  private _onConnectionClosed = (event: any): void => {
    if (event.code === 1003) {
      console.error('Document provider closed:', event.reason);

      showErrorMessage('Document session error', event.reason, [
        Dialog.okButton()
      ]);

      // Dispose shared model immediately. Better break the document model,
      // than overriding data on disk.
      this._sharedModel.dispose();
    }
  };

  private _onSync = (isSynced: boolean) => {
    if (isSynced) {
      if (this._yWebsocketProvider) {
        this._yWebsocketProvider.off('sync', this._onSync);

        const state = this._sharedModel.ydoc.getMap('state');
        state.set('document_id', this._yWebsocketProvider.roomname);
      }
      this._ready.resolve();
    }
  };

  private _awareness: Awareness;
  private _isDisposed: boolean;
  private _ready = new PromiseDelegate<void>();
  private _sharedModel: YDocument<DocumentChange>;
  private _yWebsocketProvider: YWebsocketProvider | null;
}

/**
 * A namespace for WebSocketProvider statics.
 */
export namespace WebSocketProvider {
  /**
   * The instantiation options for a WebSocketProvider.
   */
  export interface IOptions {
    /**
     * The shared model
     */
    model: YDocument<DocumentChange>;
  }
}
