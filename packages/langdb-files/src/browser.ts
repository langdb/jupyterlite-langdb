import { PanelLayout, Widget } from '@lumino/widgets';
import { LangdbDrive } from './contents';
import { FileBrowser } from '@jupyterlab/filebrowser';

export class RemoteCloudFileBrowser extends Widget {
  constructor(browser: FileBrowser, drive: LangdbDrive) {
    super();
    this.addClass('jp-FileBrowser');
    this.layout = new PanelLayout();
    (this.layout as PanelLayout).addWidget(browser);
    this._browser = browser;
    this._drive = drive;
  }

  get browser(): FileBrowser {
    return this._browser;
  }

  get drive(): LangdbDrive {
    return this._drive;
  }

  private _browser: FileBrowser;
  private _drive: LangdbDrive;
}
