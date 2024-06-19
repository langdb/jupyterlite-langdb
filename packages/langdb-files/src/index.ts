import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { LangdbDrive } from './contents';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { Widget } from '@lumino/widgets';
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
  activate: (
    app: JupyterFrontEnd,
    manager: IDocumentManager,
    settingRegistry: ISettingRegistry
  ) => {
    console.log('JupyterLab extension langdb-files is activated!');

    const { serviceManager } = app;

    if (window.self !== window.top) {
      // The application is not loaded as an iframe
      // Add a widget to get login
      // Assuming you have a function createLoginWidget that returns a widget for login
      const loginWidget = createLoginWidget();
      app.shell.add(loginWidget, 'login');
    }

    const drive = new LangdbDrive(app.docRegistry);
    manager.services.contents.addDrive(drive);
    serviceManager.contents.addDrive(drive);

    console.log('Drive "ldrive" attached');
    window.parent.postMessage({ type: 'JupyterReady' }, '*');
  }
};

class LoginWidget extends Widget {
  constructor() {
    super();
    this.addClass('my-LoginWidget');
    this.id = 'login-widget-id';
    this.title.label = 'Login';
    this.title.closable = true;
    this.node.textContent = 'Login Widget Placeholder';
  }
}

function createLoginWidget(): LoginWidget {
  return new LoginWidget();
}

export default plugin;
