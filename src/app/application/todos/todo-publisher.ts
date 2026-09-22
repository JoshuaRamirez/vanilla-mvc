import type { TodoFact } from '../../events/todo-fact.ts';
import type { RenamingChanged } from '../../events/renaming-changed.ts';
import type { TodoAdded } from '../../events/todo-added.ts';
import type { TodoOptionsListed } from '../../events/todo-options-listed.ts';
import type { TodoRenamed } from '../../events/todo-renamed.ts';
import type { TodosListed } from '../../events/todos-listed.ts';
import type { Publish } from '../publish.ts';
import { Todo } from './todo.ts';
import type { TodoList } from './todo-list.ts';

/** Announces todo events. The only place Todo and TodoList become event data. */
export class TodoPublisher {
  constructor(private readonly publish: Publish) {}

  listed(list: TodoList): void {
    const today = TodoPublisher.today();
    this.publish<TodosListed>({
      type: 'TodosListed',
      todos: Object.freeze(list.items.map((todo) => TodoPublisher.fact(todo, today))),
      remaining: list.remaining,
      completed: list.completed,
    });
  }

  options(): void {
    this.publish<TodoOptionsListed>({ type: 'TodoOptionsListed', priorities: Todo.priorities, tags: Todo.tags });
  }

  added(todo: Todo): void {
    this.publish<TodoAdded>({ type: 'TodoAdded', id: todo.id, title: todo.title });
  }

  renamed(id: number, title: string): void {
    this.publish<TodoRenamed>({ type: 'TodoRenamed', id, title });
  }

  renaming(id: number | null): void {
    this.publish<RenamingChanged>({ type: 'RenamingChanged', id });
  }

  static today(): string {
    return new Date().toLocaleDateString('en-CA');
  }

  static fact(todo: Todo, today = TodoPublisher.today()): TodoFact {
    return Object.freeze({
      id: todo.id,
      title: todo.title,
      notes: todo.notes,
      priority: todo.priority,
      due: todo.due,
      tags: todo.tags,
      done: todo.done,
      overdue: todo.isOverdue(today),
    });
  }
}
