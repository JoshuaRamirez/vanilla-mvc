import { ApplicationElement, NavigationRequested, RouteChanged, type RouteMatch } from '../../../framework/index.ts';
import type { TodosListed } from '../../events/todos-listed.ts';
import { routes } from '../../routes.ts';
import { BrowsingPublisher } from './browsing-publisher.ts';
import type { TodoCollection } from './todo-collection.ts';
import { TodoFilter } from './todo-filter.ts';

/**
 * Looking through the todos: which filter and search are chosen, and which
 * todos they select. Both live in the URL, so back, forward, reload, and
 * links keep them.
 */
export class TodoBrowsing extends ApplicationElement {
  filter = TodoFilter.all;
  query = '';
  readonly #publisher = new BrowsingPublisher((event) => this.publish(event));

  constructor(private readonly collection: TodoCollection) {
    super();
  }

  protected override onInterconnect(): void {
    this.subscribe<RouteChanged>('RouteChanged', ({ route }) => this.follow(route));
    this.subscribe<TodosListed>('TodosListed', () => this.#announce());
  }

  follow(route: RouteMatch): void {
    if (route.name !== 'todos') return;
    this.filter = TodoFilter.parse(route.params.filter);
    this.query = route.query.q?.[0] ?? '';
    this.#announce();
  }

  /** Search as the user types; replace history so each keystroke isn't a back-button stop. */
  search(query: string): void {
    this.query = query;
    this.#announce();
    this.publish<NavigationRequested>({ type: 'NavigationRequested', path: TodoBrowsing.href(this.filter.name, query), replace: true });
  }

  /** Where a filter and search live. */
  static href(filter: string, query: string): string {
    return routes.href('todos', filter === 'all' ? {} : { filter }, query ? { q: query } : {});
  }

  #announce(): void {
    this.#publisher.shown(this.filter, this.query, this.collection.todos, this.collection.loaded);
  }
}
