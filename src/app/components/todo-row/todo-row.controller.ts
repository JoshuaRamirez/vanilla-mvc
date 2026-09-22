import { Controller, type FieldChange } from '../../../framework/index.ts';
import type { ApplicationDomain } from '../../application/application-domain.ts';
import type { TodoCollection } from '../../application/todos/todo-collection.ts';
import type { RenamingChanged } from '../../events/renaming-changed.ts';
import type { TodoFact } from '../../events/todo-fact.ts';
import type { TodosListed } from '../../events/todos-listed.ts';
import { routes } from '../../routes.ts';
import type { TodoRowModel } from './todo-row.model.ts';

export class TodoRowController extends Controller<TodoRowModel, ApplicationDomain> {
  #todos!: TodoCollection;

  /** The row starts from the todo it was created for. */
  constructor(private readonly todo: TodoFact) {
    super();
  }

  protected createModel(): TodoRowModel {
    return { ...TodoRowController.#shape(this.todo), renaming: false };
  }

  protected override onCreate(): void {
    this.#todos = this.domain.collection;
  }

  protected override onInterconnect(): void {
    this.subscribe('TodosListed', this.#todosListed);
    this.subscribe('RenamingChanged', this.#renamingChanged);
    this.handle('toggle', this.#toggle);
    this.handle('startRenaming', this.#startRenaming);
    this.handle('stopRenaming', this.#stopRenaming);
    this.handle('rename', this.#rename);
    this.handle('remove', this.#remove);
  }

  #todosListed({ todos }: TodosListed): void {
    const todo = todos.find((t) => t.id === this.model.id);
    if (!todo) return;
    Object.assign(this.model, TodoRowController.#shape(todo));
    this.changed();
  }

  #renamingChanged({ id }: RenamingChanged): void {
    this.model.renaming = id === this.model.id;
    this.changed();
  }

  #toggle(): Promise<boolean> {
    return this.#todos.toggle(this.model.id);
  }

  #startRenaming(): void {
    this.#todos.beginRenaming(this.model.id);
  }

  #stopRenaming(): void {
    this.#todos.stopRenaming(this.model.id);
  }

  #rename({ value }: FieldChange): Promise<boolean> {
    return this.#todos.rename(this.model.id, String(value));
  }

  // Asks first: this settles only once the dialog has been answered, a gesture later.
  #remove(): Promise<boolean> {
    return this.#todos.remove(this.model.id);
  }

  static #shape(todo: TodoFact): Omit<TodoRowModel, 'renaming'> {
    return {
      id: todo.id,
      title: todo.title,
      done: todo.done,
      overdue: todo.overdue,
      highPriority: todo.priority === 'high',
      tags: todo.tags,
      dueLabel: todo.due ? `${todo.overdue ? 'overdue' : 'due'} ${todo.due}` : '',
      editHref: routes.href('todo', { id: todo.id }),
    };
  }
}
