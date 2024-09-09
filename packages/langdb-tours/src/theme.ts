import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { IThemeManager } from '@jupyterlab/apputils';

export const themeChangerPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlite-theme-changer-query',
  autoStart: true,
  requires: [IThemeManager],
  activate: (app: JupyterFrontEnd, themeManager: IThemeManager) => {
    // Function to get query parameters
    const getQueryParam = (param: string) => {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get(param);
    };
    const availableThemes = themeManager.themes;
    console.log('availableThemes', availableThemes);
    // Get the theme from the query string
    const theme = getQueryParam('theme');

    // If the theme is defined, try to set it
    if (theme) {
      if (availableThemes.includes(theme)) {
        themeManager.setTheme(theme);
        console.log(`Theme changed to: ${theme}`);
      } else {
        console.warn(`Theme '${theme}' is not available.`);
      }
    }
  }
};
