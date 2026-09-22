import type { RouteChange } from '../seams.ts';

/** A navigation is about to commit. Guards cancel or redirect it through change. */
export interface RouteChanging {
  readonly type: 'RouteChanging';
  readonly change: RouteChange;
}
