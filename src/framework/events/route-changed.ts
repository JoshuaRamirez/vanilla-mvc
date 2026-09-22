import type { RouteMatch } from '../seams.ts';

/** The location changed. */
export interface RouteChanged {
  readonly type: 'RouteChanged';
  readonly route: RouteMatch;
}
