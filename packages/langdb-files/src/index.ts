import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { LangdbDrive } from './contents';
import { IDocumentManager } from '@jupyterlab/docmanager';
/**
 * Initialization data for the langdb-files extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'langdb-files:plugin',
  description: 'Langdb Files extension',
  autoStart: true,
  requires: [IDocumentManager],
  activate: (
    app: JupyterFrontEnd,
    manager: IDocumentManager
  ) => {
    console.log('JupyterLab extension langdb-files is activated!');

    const { serviceManager } = app;
    const drive = new LangdbDrive(app.docRegistry);

    manager.services.contents.addDrive(drive);
    serviceManager.contents.addDrive(drive);
  }
};

export default plugin;
