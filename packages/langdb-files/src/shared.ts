import {
  ICollaborativeDrive,
  ISharedModelFactory,
  SharedDocumentFactory
} from '@jupyter/docprovider';
import { LangdbDrive } from './drive';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { Contents } from '@jupyterlab/services';
import {
  DocumentChange,
  ISharedDocument,
  YDocument,
  YNotebook
} from '@jupyter/ydoc';
import { WebSocketProvider } from './provider';

export class SharedDrive extends LangdbDrive implements ICollaborativeDrive {
  readonly sharedModelFactory: ISharedModelFactory;
  private _providers: Map<string, WebSocketProvider>;

  get name(): string {
    return 'sdrive';
  }

  constructor(registry: DocumentRegistry) {
    super(registry);
    this.sharedModelFactory = new SharedModelFactory(this._onCreate);
    console.log('sharedModel', this.sharedModelFactory);
    this._providers = new Map<string, WebSocketProvider>();
    console.log('providers', this._providers);
  }

  async get(
    localPath: string,
    options?: Contents.IFetchOptions
  ): Promise<Contents.IModel> {
    console.log('shared get');

    const key = localPath;
    const provider = this._providers.get(key);

    if (provider) {
      // If the document does't exist, `super.get` will reject with an
      // error and the provider will never be resolved.
      // Use `Promise.all` to reject as soon as possible. The Context will
      // show a dialog to the user.
      const [model] = await Promise.all([
        super.get(localPath, { ...options, content: false }),
        provider.ready
      ]);
      return model;
    }

    return super.get(localPath, options);
  }

  /**
   * Save a file.
   *
   * @param localPath - The desired file path.
   *
   * @param options - Optional overrides to the model.
   *
   * @returns A promise which resolves with the file content model when the
   *   file is saved.
   */
  async save(
    localPath: string,
    options: Partial<Contents.IModel> = {}
  ): Promise<Contents.IModel> {
    // Check that there is a provider - it won't e.g. if the document model is not collaborative.
    console.log(localPath);
    return super.save(localPath, options);
  }

  private _onCreate = (
    options: Contents.ISharedFactoryOptions,
    sharedModel: YDocument<DocumentChange>
  ) => {
    if (typeof options.format !== 'string') {
      return;
    }
    try {
      const provider = new WebSocketProvider({
        model: sharedModel
      });

      const key = options.path;
      this._providers.set(key, provider);

      sharedModel.disposed.connect(() => {
        const provider = this._providers.get(key);
        if (provider) {
          provider.dispose();
          this._providers.delete(key);
        }
      });
    } catch (error) {
      // Falling back to the contents API if opening the websocket failed
      //  This may happen if the shared document is not a YDocument.
      console.error(
        `Failed to open websocket connection for ${options.path}.\n:${error}`
      );
    }
  };
}

/**
 * Yjs sharedModel factory for real-time collaboration.
 */
export class SharedModelFactory implements ISharedModelFactory {
  private _documentFactories: Map<Contents.ContentType, SharedDocumentFactory>;

  /**
   * Shared model factory constructor
   *
   * @param _onCreate Callback on new document model creation
   */
  constructor(
    private _onCreate: (
      options: Contents.ISharedFactoryOptions,
      sharedModel: YDocument<DocumentChange>
    ) => void
  ) {
    console.log('register ynotebook');
    const disableDocumentWideUndoRedo = true;
    const yNotebookFactory = () => {
      return new YNotebook({
        disableDocumentWideUndoRedo
      });
    };
    this._documentFactories = new Map();
    this._documentFactories.set('notebook', yNotebookFactory);
  }

  /**
   * Register a SharedDocumentFactory.
   *
   * @param type Document type
   * @param factory Document factory
   */
  registerDocumentFactory(
    type: Contents.ContentType,
    factory: SharedDocumentFactory
  ) {
    if (this._documentFactories.has(type)) {
      throw new Error(`The content type ${type} already exists`);
    }
    this._documentFactories.set(type, factory);
  }

  /**
   * Create a new `ISharedDocument` instance.
   *
   * It should return `undefined` if the factory is not able to create a `ISharedDocument`.
   */
  createNew(
    options: Contents.ISharedFactoryOptions
  ): ISharedDocument | undefined {
    console.log('Shared: Create New is called');
    if (typeof options.format !== 'string') {
      console.warn(`Only defined format are supported; got ${options.format}.`);
      return;
    }

    if (this._documentFactories.has(options.contentType)) {
      const factory = this._documentFactories.get(options.contentType)!;
      const sharedModel = factory(options);
      this._onCreate(options, sharedModel);
      return sharedModel;
    }

    return;
  }
}
