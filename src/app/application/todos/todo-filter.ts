import type { Todo } from './todo.ts';

export type TodoFilterName = 'all' | 'active' | 'completed';

/** Which todos to show. A value object: compare by name. */
export class TodoFilter {
  static readonly all = new TodoFilter('all', () => true);
  static readonly active = new TodoFilter('active', (todo) => todo.isOpen);
  static readonly completed = new TodoFilter('completed', (todo) => todo.done);
  static readonly values: readonly TodoFilter[] = [TodoFilter.all, TodoFilter.active, TodoFilter.completed];

  private constructor(
    readonly name: TodoFilterName,
    private readonly predicate: (todo: Todo) => boolean,
  ) {
    Object.freeze(this);
  }

  /** Unknown or missing names mean all. */
  static parse(name: string | undefined): TodoFilter {
    return TodoFilter.values.find((f) => f.name === name) ?? TodoFilter.all;
  }

  matches(todo: Todo): boolean {
    return this.predicate(todo);
  }

  is(name: string): boolean {
    return this.name === name;
  }
}
