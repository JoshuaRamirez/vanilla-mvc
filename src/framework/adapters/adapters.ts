import type { Adapters, IFormAccess, IRenderer, IRouting, IStyling } from '../seams.ts';

let installed: Adapters | null = null;

/** Install the adapters the framework uses. Application.create() does this; tests call it directly. */
export function useAdapters(adapters: Adapters): void {
  installed = adapters;
}

function require(): Adapters {
  if (!installed) throw new Error('No adapters installed. Application.create() installs them; tests call useAdapters(defaultAdapters()).');
  return installed;
}

/** The installed library seams. */
export const adapters = {
  get renderer(): IRenderer {
    return require().renderer;
  },
  get forms(): IFormAccess {
    return require().forms;
  },
  get routing(): IRouting {
    return require().routing;
  },
  get styling(): IStyling {
    return require().styling;
  },
};
