import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { LangdbDrive } from './contents';
import { IDocumentManager } from '@jupyterlab/docmanager';
import {ISettingRegistry} from "@jupyterlab/settingregistry";
/**
 * Initialization data for the langdb-files extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'langdb-files:plugin',
  description: 'Langdb Files extension',
  autoStart: true,
  requires: [IDocumentManager, ISettingRegistry],
  activate: (
    app: JupyterFrontEnd,
    manager: IDocumentManager,
    settingRegistry: ISettingRegistry
  ) => {
    console.log('JupyterLab extension langdb-files is activated!');

    const { serviceManager } = app;

    window.addEventListener('message', (event) => {
      if (event.data.type === 'update-token') {
        settingRegistry.set('langdb-files:plugin', 'token', event.data.token).then(() => {
          console.log('Token saved!');
        });
      }
    });

    settingRegistry.load('langdb-files:plugin').then(settings => {
      const setting = settings.get('token').composite;

      const drive = new LangdbDrive(app.docRegistry, setting?.toString());
      manager.services.contents.addDrive(drive);
      serviceManager.contents.addDrive(drive);

      console.log('Drive "ldrive" attached');

      settings.changed.connect((sender, key) => {
        const updatedSetting = settings.get('token').composite;

        drive.set_token(updatedSetting?.toString());
        window.localStorage.setItem('token', updatedSetting?.toString() ?? '');
      });
    });


  }
};

export default plugin;
