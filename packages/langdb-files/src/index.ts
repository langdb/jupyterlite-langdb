import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { LangdbDrive } from './contents';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
/**
 * Initialization data for the langdb-files extension.
 */
export type AuthResponse = {
  token: string;
  apiUrl: string;
};
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'langdb-files:plugin',
  description: 'Langdb Files extension',
  autoStart: true,
  requires: [IDocumentManager, ISettingRegistry],
  activate: (app: JupyterFrontEnd, manager: IDocumentManager) => {
    console.log('JupyterLab extension langdb-files is activated!');

    const { serviceManager } = app;

    const drive = new LangdbDrive(app.docRegistry);
    manager.services.contents.addDrive(drive);
    manager.autosave = true;
    serviceManager.contents.addDrive(drive);

    console.log('Drive "ldrive" attached');
    window.parent.postMessage({ type: 'JupyterReady' }, '*');
  }
};

export default plugin;
