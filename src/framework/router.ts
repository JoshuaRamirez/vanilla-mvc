import { adapters } from './adapters/adapters.ts';
import { ApplicationElement } from './application-element.ts';
import { changes } from './change-engine.ts';
import type { NavigationRequested } from './events/navigation-requested.ts';
import type { RouteChanged } from './events/route-changed.ts';
import type { RouteChanging } from './events/route-changing.ts';
import type { INavigator, IRouteTable, RouteChange, RouteMatch } from './seams.ts';

/**
 * The application's router: the routing seam's navigator, speaking only
 * through the bus: it answers NavigationRequested, and publishes
 * RouteChanging (guards) and RouteChanged. It never touches components.
 */
export class Router extends ApplicationElement {
  #navigator!: INavigator;

  constructor(readonly table: IRouteTable) {
    super();
  }

  get current(): RouteMatch | null {
    return this.#navigator?.current ?? null;
  }

  protected override onCreate(): void {
    this.#navigator = adapters.routing.createNavigator({
      table: this.table,
      // A popstate or an intercepted link click is a DOM event no controller
      // wraps, so the router ends it the way a DOM handler would: once per
      // navigation, here when a guard cancelled it (it may have asked why),
      // in onChanged otherwise. A redirect comes back through onChanged.
      onNavigating: (change: RouteChange) => {
        this.publish<RouteChanging>({ type: 'RouteChanging', change });
        if (change.cancelled) changes.update();
      },
      onChanged: (route: RouteMatch) => {
        this.publish<RouteChanged>({ type: 'RouteChanged', route });
        changes.update();
      },
    });
  }

  protected override onInterconnect(): void {
    this.subscribe<NavigationRequested>('NavigationRequested', ({ path, replace }) => this.navigate(path, replace));
  }

  protected override onActivate(): void {
    this.#navigator.start();
  }

  navigate(path: string, replace = false): boolean {
    return this.#navigator.navigate(path, { replace });
  }

  href(name: string, params?: Record<string, string | number>, query?: Record<string, string | number | readonly (string | number)[]>): string {
    return this.table.href(name, params, query);
  }
}
