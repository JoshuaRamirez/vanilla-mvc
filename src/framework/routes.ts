import { adapters } from './adapters/adapters.ts';
import type { IRouteTable, Route, RouteMatch, RouteTableOptions } from './seams.ts';

/**
 * The application's route table, declared once and built by the installed
 * routing adapter on first use.
 *
 *   export const routes = new Routes([{ name: 'home', path: '/' }, …]);
 *   routes.href('todos', { filter: 'active' });
 */
export class Routes implements IRouteTable {
  #table: IRouteTable | null = null;

  constructor(
    readonly definitions: readonly Route[],
    readonly options: RouteTableOptions = {},
  ) {}

  get base(): string {
    return this.#resolved.base;
  }

  match(url: URL | string): RouteMatch {
    return this.#resolved.match(url);
  }

  href(name: string, params?: Record<string, string | number>, query?: Record<string, string | number | readonly (string | number)[]>): string {
    return this.#resolved.href(name, params, query);
  }

  owns(url: URL | string): boolean {
    return this.#resolved.owns(url);
  }

  get #resolved(): IRouteTable {
    return (this.#table ??= adapters.routing.createTable(this.definitions, this.options));
  }
}
