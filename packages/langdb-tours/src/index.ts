import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITourManager } from 'jupyterlab-tour';
/**
 * Initialization data for the langdb-tours extension.
 */
export type AuthResponse = {
  token: string;
  apiUrl: string;
};
const tourPlugin: JupyterFrontEndPlugin<void> = {
  id: 'langdb-tour:plugin',
  description: 'Langdb tours extension',
  autoStart: true,
  requires: [ISettingRegistry, ITourManager],
  activate: (app: JupyterFrontEnd, manager: ITourManager) => {
    console.log('JupyterLab extension langdb-tours is activated!');
  }
};

const plugins: JupyterFrontEndPlugin<any>[] = [tourPlugin];

export default plugins;
