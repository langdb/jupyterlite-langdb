/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { ITour, ITourManager } from 'jupyterlab-tour';
import { ToolbarButton } from '@jupyterlab/apputils';
import { LabIcon } from '@jupyterlab/ui-components';
export const tourIcon = new LabIcon({
  name: 'langdb-tour:touricon',
  svgstr: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
</svg>`
});
export const tourPlugin: JupyterFrontEndPlugin<void> = {
  id: 'langdb-tour:plugin',
  autoStart: true,
  requires: [INotebookTracker, ITourManager],
  optional: [],
  activate: async (
    app: JupyterFrontEnd,
    nbTracker: INotebookTracker,
    tourManager: ITourManager
  ) => {
    try {
      nbTracker.currentChanged.connect((tracker, panel) => {
        const current = tracker.currentWidget;
        if (current) {
          const notebook = current.content;
          const model = notebook.model;
          
          model?.metadataChanged.connect((nbModel, change) => {
            if (change.key !== 'jupyterlab-tour') {
              return;
            }
            const jupyterLabTour: any = change.newValue;
            if (jupyterLabTour) {
              if (
                jupyterLabTour.tours &&
                tourManager &&
                jupyterLabTour.tours.length
              ) {
                // take fist tour for now
                const tour = jupyterLabTour.tours[0] as ITour;
                const currentTours = tourManager.tours;
                for (const tourId of currentTours.keys()) {
                  tourManager.removeTour(tourId);
                }
                tourManager.addTour(tour);
                const button = new ToolbarButton({
                  className: 'langdb-myButton',
                  icon: tourIcon,
                  onClick: () => {
                    console.log('Button clicked!');
                    if (tourManager.tours.has(tour.id)) {
                      tourManager.launch([tour.id], false);
                    }
                  },
                  tooltip: 'Click me'
                });
                // Add the button to the notebook toolbar
                const btnId = `${tour.id}-tour-button`;
                const notebookPanel = current;
                if (!notebookPanel.toolbar.contains(button)) {
                  notebookPanel.toolbar.insertItem(10, btnId, button);
                }
                // auto start tour
                if (tourManager.tours.has(tour.id)) {
                  tourManager.launch([tour.id], false);
                }
              }
            }
          });
        }
      });
    } catch (error) {
      console.error('==== Error in tour activation', error);
    }
  }
};
