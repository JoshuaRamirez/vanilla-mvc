/** Which todo is being renamed in place, if any. */
export interface RenamingChanged {
  readonly type: 'RenamingChanged';
  readonly id: number | null;
}
