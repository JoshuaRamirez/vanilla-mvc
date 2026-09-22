import { Controller, type RouteChanged } from '../../../framework/index.ts';
import type { ApplicationDomain } from '../../application/application-domain.ts';
import type { TodoCollection } from '../../application/todos/todo-collection.ts';
import type { ShellModel } from './shell.model.ts';

const PAGES: Record<string, string> = { home: 'home-page', todos: 'todo-list-page', todo: 'edit-todo-page' };

export class ShellController extends Controller<ShellModel, ApplicationDomain> {
  #todos!: TodoCollection;

  protected createModel(): ShellModel {
    return { page: 'home-page' };
  }

  protected override onCreate(): void {
    this.#todos = this.domain.collection;
  }

  protected override onInterconnect(): void {
    this.subscribe('RouteChanged', this.#routeChanged);
  }

  /** The shell outlives every page, so it asks for the list they all count on. */
  protected override onActivate(): void {
    this.own(this.#todos.refresh());
  }

  #routeChanged({ route }: RouteChanged): void {
    this.model.page = PAGES[route.name] ?? 'not-found-page';
    this.changed();
  }
}
