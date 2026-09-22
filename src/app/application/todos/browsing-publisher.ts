import type { TodosShown } from '../../events/todos-shown.ts';
import type { Publish } from '../publish.ts';
import type { TodoFilter } from './todo-filter.ts';
import type { TodoList } from './todo-list.ts';

/** Announces which todos are shown. */
export class BrowsingPublisher {
  constructor(private readonly publish: Publish) {}

  shown(filter: TodoFilter, query: string, todos: TodoList, loaded: boolean): void {
    const ids = Object.freeze(todos.select(filter, query).map((todo) => todo.id));
    this.publish<TodosShown>({ type: 'TodosShown', filter: filter.name, query, ids, loaded, remaining: todos.remaining, completed: todos.completed });
  }
}
