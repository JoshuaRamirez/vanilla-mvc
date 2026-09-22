import { FieldErrors } from './field-errors.ts';
import { NotFoundError } from './not-found-error.ts';
import type { TodoChanges } from '../todos/todo-changes.ts';
import { Todo, type TodoData } from '../todos/todo.ts';
import { TodoList } from '../todos/todo-list.ts';
import { ValidationError } from './validation-error.ts';

/**
 * Gateway to the server, where the business rules live. Changes answer with
 * the whole, authoritative list. Rejections become ValidationError (422) or
 * NotFoundError (404); anything else is a plain Error.
 */
export class TodoApi {
  #failNext = false;

  constructor(private readonly baseUrl = '/api/todos') {}

  list(): Promise<TodoList> {
    return this.#list('GET', '');
  }

  async get(id: number): Promise<Todo> {
    return new Todo((await this.#request('GET', `/${id}`)) as TodoData);
  }

  add(title: string): Promise<TodoList> {
    return this.#list('POST', '', { title });
  }

  toggle(todo: Todo): Promise<TodoList> {
    return this.#list('PATCH', `/${todo.id}`, { done: !todo.done });
  }

  rename(todo: Todo, title: string): Promise<TodoList> {
    return this.#list('PATCH', `/${todo.id}`, { title });
  }

  update(id: number, changes: TodoChanges): Promise<TodoList> {
    return this.#list('PUT', `/${id}`, changes);
  }

  remove(todo: Todo): Promise<TodoList> {
    return this.#list('DELETE', `/${todo.id}`);
  }

  clearCompleted(): Promise<TodoList> {
    return this.#list('DELETE', '/completed');
  }

  /** Make the next request fail, to exercise error handling. */
  failNext(): void {
    this.#failNext = true;
  }

  async #list(method: string, path: string, body?: unknown): Promise<TodoList> {
    return TodoList.fromData((await this.#request(method, path, body)) as TodoData[]);
  }

  async #request(method: string, path: string, body?: unknown): Promise<unknown> {
    const url = this.baseUrl + path;
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (this.#failNext) {
      this.#failNext = false;
      headers['x-simulate-failure'] = '1';
    }

    const response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await response.json();
    if (response.ok) return data;

    const message = data.error ?? `${method} ${url} failed (${response.status})`;
    if (response.status === 404) throw new NotFoundError(message);
    if (response.status === 422) throw new ValidationError(message, FieldErrors.from(data.fields));
    throw new Error(message);
  }
}
