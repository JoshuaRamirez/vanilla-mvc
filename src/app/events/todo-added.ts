/** A todo was added. */
export interface TodoAdded {
  readonly type: 'TodoAdded';
  readonly id: number;
  readonly title: string;
}
