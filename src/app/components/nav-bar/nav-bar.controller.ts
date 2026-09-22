import { Controller, type RouteChanged } from '../../../framework/index.ts';
import type { TodosListed } from '../../events/todos-listed.ts';
import { routes } from '../../routes.ts';
import type { NavBarModel } from './nav-bar.model.ts';

export class NavBarController extends Controller<NavBarModel> {
  protected createModel(): NavBarModel {
    return { homeHref: routes.href('home'), todosHref: routes.href('todos'), homeActive: false, todosActive: false, remaining: 0, hasBadge: false };
  }

  protected override onInterconnect(): void {
    this.subscribe('RouteChanged', this.#routeChanged);
    this.subscribe('TodosListed', this.#todosListed);
  }

  #routeChanged({ route: { name } }: RouteChanged): void {
    this.model.homeActive = name === 'home';
    this.model.todosActive = name === 'todos' || name === 'todo'; // the edit page belongs to the todos tab
    this.changed();
  }

  #todosListed({ remaining }: TodosListed): void {
    this.model.remaining = remaining;
    this.model.hasBadge = remaining > 0;
    this.changed();
  }
}
