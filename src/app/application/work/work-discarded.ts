/** Inside the domain: the user chose to lose this work; its owner should let it go. */
export interface WorkDiscarded {
  readonly type: 'WorkDiscarded';
  readonly key: string;
}
