import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { MainAreaWidget } from '@jupyterlab/apputils';
import { Cell, CodeCell, ICellModel, ICodeCellModel } from '@jupyterlab/cells';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import {
  CellList,
  INotebookModel,
  INotebookTracker,
  NotebookPanel
} from '@jupyterlab/notebook';
import { IObservableList } from '@jupyterlab/observables';
import { IOutputAreaModel } from '@jupyterlab/outputarea';
import { Toolbar, addToolbarButtonClass } from '@jupyterlab/ui-components';
import { IDisposable } from '@lumino/disposable';
import { PanelLayout, Widget } from '@lumino/widgets';
import { TraceWidget } from './widget';

const TRACING_UI_CLASS = 'langdb-tracing-toolbar';

class TraceUIWIdget extends Widget {
  constructor(panel: NotebookPanel, _tracker: INotebookTracker) {
    super();
    this._panel = panel;
    this.updateConnectedCell = this.updateConnectedCell.bind(this);

    const cells = this._panel.context.model.cells;
    cells.changed.connect(this.updateConnectedCell);
    for (let i = 0; i < cells.length; ++i) {
      this._registerOutputChanges(cells.get(i));
    }
  }

  updateConnectedCell(
    _sender: CellList,
    changed: IObservableList.IChangedArgs<ICellModel>
  ) {
    // When a cell is moved it's model gets re-created so we need to update
    // the `metadataChanged` listeners.

    // When cells are moved around the `CellList.changed` signal is first
    // emitted with "add" type and the cell model information and then
    // with "remove" type but lacking the old model (it is `undefined`).
    // This causes a problem for the sequence of registering and deregistering
    // listeners for the `metadataChanged` signal (register can be called when
    // the cell was no yet removed from `this._cellSlotMap`, and deregister
    // could be called with `undefined` value hence unable to remove it).
    // There are two possible solutions:
    // - (a) go over the list of cells and compare it with `cellSlotMap` (slow)
    // - (b) deregister the cell model as it gets disposed just before
    //      `CellList.changed` signals are emitted; we can do this by
    //       listening to the `ICellModel.sharedModel.disposed` signal.
    // The (b) solution is implemented in `_registerMetadataChanges` method.

    // Reference:
    // https://github.com/jupyterlab/jupyterlab/blob/4.0.x/packages/notebook/src/celllist.ts#L131-L159

    changed.oldValues.forEach(this._deregisterOutputChanges.bind(this));
    changed.newValues.forEach(this._registerOutputChanges.bind(this));
  }

  _registerOutputChanges(cellModel: ICellModel) {
    if (!(cellModel.id in this._cellSlotMap)) {
      const fn = (sender: IOutputAreaModel, i: IOutputAreaModel.ChangedArgs) =>
        this._cellMetadataChanged(sender, i.newIndex);
      this._cellSlotMap[cellModel.id] = fn;
      if (cellModel.type === 'code') {
        console.log('Connecting to signal for ', cellModel.id);
        (cellModel as ICodeCellModel).outputs.changed.connect(fn);
      }

      // Copy cell model identifier and store a reference to `metadataChanged`
      // signal to keep them available even during cell model disposal.
      const id = cellModel.id;
      const metadataChanged = cellModel.metadataChanged;

      // Register a model disposal handler on the underlying shared model,
      // see the explanation in `updateConnectedCell()` method.
      const deregisterOnDisposal = () => {
        this._deregisterOutputChanges({ metadataChanged, id } as ICellModel);
        cellModel.sharedModel.disposed.disconnect(deregisterOnDisposal);
      };
      cellModel.sharedModel.disposed.connect(deregisterOnDisposal);
    }
    /*
        // Always re-render cells.
        // In case there was already metadata: do not highlight on first load.
        if (cellModel.type === 'code') {
            const outputs = (cellModel as ICodeCellModel).outputs;
            for (let i = 0; i < outputs.length; ++i) {
                this._cellMetadataChanged(outputs, i);
            }
        }
        */
  }

  _deregisterOutputChanges(cellModel: ICellModel) {
    if (cellModel !== undefined) {
      console.log('Disconnecting from signal for ', cellModel.id);
      const fn = this._cellSlotMap[cellModel.id];
      if (fn) {
        (cellModel as ICodeCellModel).outputs.changed.disconnect(fn);
      }
      delete this._cellSlotMap[cellModel.id];
    }
  }

  _cellMetadataChanged(model: IOutputAreaModel, index: number) {
    const codeCell = this._getCodeCell(model);
    if (codeCell) {
      this._updateCodeCell(codeCell, index).catch(console.error);
    } else {
      console.error(`Could not find code cell for model: ${model}`);
    }
  }
  async _updateCodeCell(cell: CodeCell, index: number) {
    const updateNumber = this._increaseUpdateCounter(cell);
    await cell.ready;

    if (!cell.inViewport) {
      if (!(await this._cellInViewport(cell, updateNumber))) {
        return;
      }
    }

    const outputs = cell.model.outputs;
    if (outputs) {
      let node = cell.node.querySelector(`.${TRACING_UI_CLASS}`);
      const trace_id = outputs.get(index)?.metadata['trace'];
      if (!trace_id) {
        return;
      }
      if (node && node.getAttribute('data-trace-id') !== trace_id) {
        (cell.outputArea.parent?.layout as PanelLayout).removeWidgetAt(0);
        node = null;
      }
      if (!node) {
        const toolbar = new Toolbar();
        toolbar.addClass(TRACING_UI_CLASS);
        const widget = new TraceWidget(trace_id as string);

        toolbar.addItem('trace', addToolbarButtonClass(widget));
        // Inserting into the parent container, so that any new output in
        // the outputArea layout won't push the toolbar down
        (cell.outputArea.parent?.layout as PanelLayout).insertWidget(
          0,
          toolbar
        );
      }
      console.log(cell.model.outputs.get(index).metadata);
    }
  }

  /**
   * Return a codeCell for this model if there is one. This will return null
   * in cases of non-code cells.
   *
   * @param cellModel
   * @private
   */
  _getCodeCell(outputAreaModel: IOutputAreaModel): CodeCell | null {
    for (const widget of this._panel.content.widgets) {
      if (widget.model.type === 'code') {
        const model = (widget as CodeCell).outputArea.model;
        if (outputAreaModel === model) {
          return widget as CodeCell;
        }
      }
    }
    return null;
  }

  private _cellInViewport(
    cell: CodeCell,
    updateNumber: number
  ): Promise<boolean> {
    return new Promise<boolean>(resolved => {
      const clearHandlers = () => {
        cell.inViewportChanged.disconnect(handler);
        cell.disposed.disconnect(disposedHandler);
        this._panel.disposed.disconnect(disposedHandler);
      };
      const handler = (_emitter: Cell<ICellModel>, attached: boolean) => {
        const currentNumber = this._updateCounter.get(cell);
        if (updateNumber !== currentNumber) {
          clearHandlers();
          return resolved(false);
        }
        if (attached) {
          clearHandlers();
          return resolved(true);
        }
      };
      const disposedHandler = () => {
        // Disconnect handlers and resolve promise on cell/notebook disposal.
        clearHandlers();
        return resolved(false);
      };
      cell.inViewportChanged.connect(handler);
      // Listen to `dispose` signal of individual cells to clear promise
      // when cells get deleted before entering the viewport (ctrl + a, dd).
      cell.disposed.connect(disposedHandler);
      // Listen to notebook too because the `disposed` signal of individual
      // cells is not fired when closing the entire notebook.
      this._panel.disposed.connect(disposedHandler);
    });
  }

  /**
   * Increase counter of updates ever scheduled for a given `cell`.
   * Returns the current counter value for the given `cell`.
   */
  private _increaseUpdateCounter(cell: CodeCell): number {
    const newValue = (this._updateCounter.get(cell) ?? 0) + 1;
    this._updateCounter.set(cell, newValue);
    return newValue;
  }

  /**
   * The counter of updates ever scheduled for each existing cell.
   */
  private _updateCounter: WeakMap<CodeCell, number> = new WeakMap();
  private _cellSlotMap: {
    [id: string]: (
      model: IOutputAreaModel,
      i: IOutputAreaModel.ChangedArgs
    ) => void;
  } = {};
  private _panel: NotebookPanel;
}

class TraceUIWidgetExtension implements DocumentRegistry.WidgetExtension {
  constructor(tracker: INotebookTracker) {
    this._tracker = tracker;
  }

  createNew(
    panel: NotebookPanel,
    _context: DocumentRegistry.IContext<INotebookModel>
  ): void | IDisposable {
    return new TraceUIWIdget(panel, this._tracker);
  }

  private _tracker: INotebookTracker;
}
/**
 * Initialization data for the @langdb/trace-ui extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: '@langdb/trace-ui:plugin',
  description: 'UI to show langdb traces for notebook cells',
  requires: [INotebookTracker],
  autoStart: true,
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    const content = new Widget();
    const widget = new MainAreaWidget({ content });
    widget.title.label = 'Test';
    widget.title.closable = true;
    //app.shell.add(widget, 'main');
    app.docRegistry.addWidgetExtension(
      'Notebook',
      new TraceUIWidgetExtension(tracker)
    );
    console.log('JupyterLab extension @langdb/trace-ui is activated');
  }
};
export default plugin;
