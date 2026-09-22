import { ApplicationElement } from '../../../framework/index.ts';
import { Confirmation } from '../communication/confirmation.ts';
import type { Questions } from '../communication/questions.ts';
import type { ServerRequests } from '../server/server-requests.ts';
import type { TodoApi } from '../server/todo-api.ts';
import { TodoList } from './todo-list.ts';
import { TodoPublisher } from './todo-publisher.ts';

/**
 * The todos as the server last described them, and every change to them,
 * including renaming one in place. Each change answers with the whole list,
 * which is announced.
 */
export class TodoCollection extends ApplicationElement {
  todos = TodoList.empty;
  loaded = false;
  /** The todo being renamed in place, if any. */
  renamingId: number | null = null;
  readonly #publisher = new TodoPublisher((event) => this.publish(event));

  constructor(
    private readonly api: TodoApi,
    private readonly requests: ServerRequests,
    private readonly questions: Questions,
  ) {
    super();
  }

  protected override onActivate(): void {
    this.#publisher.options();
  }

  /** Ask the server for the list. Whoever asks owns the answer. */
  refresh(): Promise<boolean> {
    return this.requests.run(async () => this.receive(await this.api.list()));
  }

  add(title: string): Promise<boolean> {
    return this.requests.run(async () => {
      const list = await this.api.add(title);
      this.receive(list);
      const added = list.items.find((todo) => todo.hasTitle(title));
      if (added) this.#publisher.added(added);
    });
  }

  toggle(id: number): Promise<boolean> {
    const todo = this.todos.find(id);
    return todo ? this.requests.run(async () => this.receive(await this.api.toggle(todo))) : Promise.resolve(false);
  }

  beginRenaming(id: number): void {
    if (!this.todos.find(id) || this.renamingId === id) return;
    this.renamingId = id;
    this.#publisher.renaming(id);
  }

  /** Stop renaming (only that todo, when given). */
  stopRenaming(id?: number): void {
    if (this.renamingId === null || (id !== undefined && id !== this.renamingId)) return;
    this.renamingId = null;
    this.#publisher.renaming(null);
  }

  /** Blank or unchanged titles just stop renaming. A rejected rename keeps it going, to fix. */
  rename(id: number, title: string): Promise<boolean> {
    const todo = this.todos.find(id);
    const trimmed = title.trim();
    if (!todo) return Promise.resolve(false);
    if (!trimmed || trimmed === todo.title) {
      this.stopRenaming();
      return Promise.resolve(false);
    }
    return this.requests.run(async () => {
      this.receive(await this.api.rename(todo, trimmed));
      this.#publisher.renamed(id, trimmed);
      if (this.renamingId === id) this.stopRenaming();
    });
  }

  /** Deleting asks first. */
  async remove(id: number): Promise<boolean> {
    const todo = this.todos.find(id);
    if (!todo || !(await this.questions.ask(Confirmation.deleteTodo(todo)))) return false;
    return this.requests.run(async () => this.receive(await this.api.remove(todo)));
  }

  /** Clearing asks first. */
  async clearCompleted(): Promise<boolean> {
    if (!this.todos.hasCompleted || !(await this.questions.ask(Confirmation.clearCompleted(this.todos.completed)))) return false;
    return this.requests.run(async () => this.receive(await this.api.clearCompleted()));
  }

  /** The server's list becomes ours, and is announced. */
  receive(todos: TodoList): void {
    this.todos = todos;
    this.loaded = true;
    this.#publisher.listed(todos);
  }
}
