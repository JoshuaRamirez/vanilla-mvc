/** The new todo being written. */
export interface DraftChanged {
  readonly type: 'DraftChanged';
  readonly text: string;
}
