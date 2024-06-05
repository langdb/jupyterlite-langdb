import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { LangdbDrive } from './contents';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { RemoteCloudFileBrowser } from './browser';
import { IFileBrowserFactory } from '@jupyterlab/filebrowser';

const NAMESPACE = 'langdb-files';
/**
 * Initialization data for the langdb-files extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'langdb-files:drive',
  description: 'Langdb Files extension',
  autoStart: true,
  requires: [IFileBrowserFactory, IDocumentManager],
  activate: (
    app: JupyterFrontEnd,
    browserFactory: IFileBrowserFactory,
    manager: IDocumentManager,
    restorer: ILayoutRestorer | null
  ) => {
    console.log('JupyterLab extension langdb-files is activated!');

    const drive = new LangdbDrive(app.docRegistry);

    manager.services.contents.addDrive(drive);

    const browser = browserFactory.createFileBrowser(NAMESPACE, {
      driveName: drive.name,
      state: null,
      refreshInterval: 300000
    });

    const remoteCloudBrowser = new RemoteCloudFileBrowser(browser, drive);

    // Add the file browser widget to the application restorer.
    if (restorer) {
      restorer.add(remoteCloudBrowser, NAMESPACE);
    }
  }
};

export default plugin;
