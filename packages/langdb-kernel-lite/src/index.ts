import {
  JupyterLiteServer,
  JupyterLiteServerPlugin
} from '@jupyterlite/server';

import { IKernel, IKernelSpecs } from '@jupyterlite/kernel';

import { LangdbKernel } from './kernel';

/**
 * A plugin to register the langdb kernel.
 */
const kernel: JupyterLiteServerPlugin<void> = {
  id: '@jupyterlite/langdb-kernel:kernel',
  autoStart: true,
  requires: [IKernelSpecs],
  activate: (app: JupyterLiteServer, kernelspecs: IKernelSpecs) => {
    kernelspecs.register({
      spec: {
        name: 'langdb',
        display_name: 'langdb',
        language: 'sql',
        argv: [],
        resources: {
          'logo-32x32': '',
          'logo-64x64': ''
        }
      },
      create: async (options: IKernel.IOptions): Promise<IKernel> => {
        return new LangdbKernel(options);
      }
    });
  }
};

const plugins: JupyterLiteServerPlugin<any>[] = [kernel];

export default plugins;
