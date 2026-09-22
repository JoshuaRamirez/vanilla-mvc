import { Todo, type TodoData } from './todo.ts';
import type { TodoFilter } from './todo-filter.ts';

/** The server's list of todos. Immutable: a change is a new list from the server. */
export class TodoList {
  static readonly empty = new TodoList([]);

  readonly items: readonly Todo[];

  constructor(items: readonly Todo[]) {
    this.items = Object.freeze([...items]);
    Object.freeze(this);
  }

  static fromData(data: TodoData[]): TodoList {
    return new TodoList(data.map((d) => new Todo(d)));
  }

  get size(): number {
    return this.items.length;
  }

  get remaining(): number {
    return this.items.filter((t) => t.isOpen).length;
  }

  get completed(): number {
    return this.size - this.remaining;
  }

  get hasCompleted(): boolean {
    return this.completed > 0;
  }

  find(id: number): Todo | undefined {
    return this.items.find((t) => t.id === id);
  }

  containsTitle(title: string): boolean {
    return title.trim() !== '' && this.items.some((t) => t.hasTitle(title));
  }

  filter(filter: TodoFilter): readonly Todo[] {
    return this.items.filter((t) => filter.matches(t));
  }

  /** Todos passing the filter and matching the search query. */
  select(filter: TodoFilter, query: string): readonly Todo[] {
    return this.items.filter((t) => filter.matches(t) && t.matches(query));
  }
}
