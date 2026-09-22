/** Someone wants to go to a path. The router answers. */
export interface NavigationRequested {
  readonly type: 'NavigationRequested';
  readonly path: string;
  /** Replace the current history entry instead of adding one. */
  readonly replace: boolean;
}
