/** A todo was renamed. */
export interface TodoRenamed {
  readonly type: 'TodoRenamed';
  readonly id: number;
  readonly title: string;
}
