import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { LangdbDrive } from './drive';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { SharedDrive } from './shared';
import {
  EditorExtensionRegistry,
  IEditorExtensionRegistry
} from '@jupyterlab/codemirror';
import { remoteUserCursors } from '@jupyter/collaboration';
import { themeChangerPlugin } from './theme';
import { tourPlugin } from './tour';
import jupyterLabPlugins from 'jupyterlab-tour';
/**
 * Initialization data for the langdb-files extension.
 */
const excludeDefaultsPlugin = jupyterLabPlugins.filter(
  p => p.id !== 'jupyterlab-tour:default-tours'
);
export type AuthResponse = {
  token: string;
  apiUrl: string;
};
const ldrive: JupyterFrontEndPlugin<void> = {
  id: 'langdb-drive:plugin',
  description: 'Langdb Files extension',
  autoStart: true,
  requires: [IDocumentManager, ISettingRegistry],
  activate: (app: JupyterFrontEnd, manager: IDocumentManager) => {
    const { serviceManager } = app;
    manager.autosave = true;
    const drive = new LangdbDrive(app.docRegistry);
    manager.services.contents.addDrive(drive);
    serviceManager.contents.addDrive(drive);
    window.parent.postMessage({ type: 'JupyterReady' }, '*');
  }
};

const sdrive: JupyterFrontEndPlugin<void> = {
  id: 'langdb-sdrive:plugin',
  description: 'Langdb Files extension',
  autoStart: true,
  requires: [IDocumentManager, ISettingRegistry],
  activate: (app: JupyterFrontEnd, manager: IDocumentManager) => {
    console.log('==== JupyterLab extension langdb-files is activated!');
    console.log('===== excludeDefaultsPlugin', excludeDefaultsPlugin);

    const { serviceManager } = app;

    manager.autosave = true;
    // Add shared drive
    const collabDrive = new SharedDrive(app.docRegistry);
    manager.services.contents.addDrive(collabDrive);
    serviceManager.contents.addDrive(collabDrive);
    console.log('Drive "sdrive" attached');

    window.parent.postMessage({ type: 'JupyterReady' }, '*');
  }
};

const userEditorCursors: JupyterFrontEndPlugin<void> = {
  id: '@jupyter/collaboration-extension:userEditorCursors',
  description:
    'Add CodeMirror extension to display remote user cursors and selections.',
  autoStart: true,
  requires: [IEditorExtensionRegistry],
  activate: (
    app: JupyterFrontEnd,
    extensions: IEditorExtensionRegistry
  ): void => {
    extensions.addExtension({
      name: 'remote-user-cursors',
      factory(options) {
        const { awareness, ysource: ytext } = options.model.sharedModel as any;
        return EditorExtensionRegistry.createImmutableExtension(
          remoteUserCursors({ awareness, ytext })
        );
      }
    });
  }
};

const plugins: JupyterFrontEndPlugin<any>[] = [
  ...excludeDefaultsPlugin,
  ldrive,
  sdrive,
  userEditorCursors,
  themeChangerPlugin,
  tourPlugin
];

export default plugins;
