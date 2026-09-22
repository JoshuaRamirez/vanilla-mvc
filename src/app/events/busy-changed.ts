/** Whether server requests are in flight. */
export interface BusyChanged {
  readonly type: 'BusyChanged';
  readonly busy: boolean;
}
