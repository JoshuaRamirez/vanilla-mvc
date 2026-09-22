import { RouteChange } from './route-change.ts';
import type { RouteMatch } from './route-table.ts';

/** What the router needs from a route table. RouteTable is one; anything with these two methods works. */
export interface RouteResolver {
  match(url: URL | string): RouteMatch;
  owns(url: URL | string): boolean;
}

export interface HistoryRouterOptions {
  table: RouteResolver;
  /** Before a navigation commits (not the first route). Cancel or redirect the change. */
  onNavigating?: (change: RouteChange) => void;
  /** After the location changed. Render here; scroll and focus are handled after this returns. */
  onChanged: (match: RouteMatch) => void;
  /** Where focus goes after moving to a different page. Default: main h1, main, then body. */
  focusTarget?: () => HTMLElement | null;
}

export interface NavigateOptions {
  /** Replace the current history entry instead of adding one. */
  replace?: boolean;
}

type Arrival = 'load' | 'push' | 'replace' | 'traverse';

interface EntryState {
  routerIndex: number;
  scroll?: { x: number; y: number };
}

/**
 * Routing on the History API. Intercepts same-origin link clicks, runs
 * guards (including on back and forward, which it can undo), restores
 * scroll on back and forward, starts new pages at the top, moves focus to
 * the new page for keyboard and screen reader users, and leaves in-page
 * #anchor links to the browser.
 */
export class HistoryRouter {
  current: RouteMatch | null = null;
  readonly #options: HistoryRouterOptions;
  #index = 0;
  #undoing = false;
  #started = false;
  readonly #onClick = (event: MouseEvent) => this.#intercept(event);
  readonly #onPopState = (event: PopStateEvent) => this.#traverse(event);

  constructor(options: HistoryRouterOptions) {
    this.#options = options;
  }

  get table(): RouteResolver {
    return this.#options.table;
  }

  /** Listen, and announce the current location. */
  start(): void {
    if (this.#started) return;
    this.#started = true;
    history.scrollRestoration = 'manual';
    this.#index = (history.state as EntryState | null)?.routerIndex ?? 0;
    history.replaceState({ ...history.state, routerIndex: this.#index }, '');
    document.addEventListener('click', this.#onClick);
    window.addEventListener('popstate', this.#onPopState);

    const match = this.table.match(location.href);
    if (match.redirect) this.navigate(match.redirect, { replace: true });
    else this.#commit(match, 'load');
  }

  stop(): void {
    if (!this.#started) return;
    this.#started = false;
    document.removeEventListener('click', this.#onClick);
    window.removeEventListener('popstate', this.#onPopState);
  }

  /** Go somewhere. Returns false when a guard cancelled it or it left the app. */
  navigate(url: string, { replace = false }: NavigateOptions = {}): boolean {
    const target = new URL(url, location.href);
    if (target.origin !== location.origin || !this.table.owns(target)) {
      location.assign(target.href);
      return false;
    }
    if (this.#onlyHashChanged(target)) {
      location.hash = target.hash;
      return true;
    }

    const to = this.table.match(target);
    if (to.redirect) return this.navigate(to.redirect, { replace });

    const change = this.#guard(to);
    if (change?.cancelled) return false;
    if (change?.redirectTo) return this.navigate(change.redirectTo, { replace: true });

    this.#saveScroll();
    if (replace) {
      history.replaceState({ routerIndex: this.#index }, '', target);
    } else {
      this.#index++;
      history.pushState({ routerIndex: this.#index }, '', target);
    }
    this.#commit(to, replace ? 'replace' : 'push', target.hash);
    return true;
  }

  #traverse(event: PopStateEvent): void {
    const state = event.state as EntryState | null;
    const index = state?.routerIndex ?? 0;
    if (this.#undoing) {
      this.#undoing = false;
      this.#index = index;
      return;
    }

    const to = this.table.match(location.href);
    if (this.current && to.url === this.current.url) {
      this.#index = index; // only the #hash changed; the browser handles anchors
      return;
    }

    const change = this.#guard(to);
    if (change?.cancelled) {
      // Put the URL back where it was.
      this.#undoing = true;
      history.go(this.#index - index);
      return;
    }
    if (change?.redirectTo || to.redirect) {
      this.#index = index;
      this.navigate(change?.redirectTo ?? to.redirect!, { replace: true });
      return;
    }

    this.#saveScroll();
    this.#index = index;
    this.#commit(to, 'traverse', location.hash, state?.scroll);
  }

  #intercept(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download') || link.hasAttribute('data-external')) return;
    const target = new URL(link.href);
    if (target.origin !== location.origin || !this.table.owns(target)) return;
    if (this.#onlyHashChanged(target)) return; // in-page anchor: the browser scrolls
    event.preventDefault();
    this.navigate(target.href);
  }

  #guard(to: RouteMatch): RouteChange | null {
    if (!this.current) return null;
    const change = new RouteChange(this.current, to);
    this.#options.onNavigating?.(change);
    return change;
  }

  #commit(match: RouteMatch, arrival: Arrival, hash = '', scroll?: { x: number; y: number }): void {
    const newPage = this.current?.name !== match.name;
    this.current = match;
    this.#options.onChanged(match);

    if (arrival === 'traverse') window.scrollTo(scroll?.x ?? 0, scroll?.y ?? 0);
    else if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
    else if (newPage && arrival !== 'load') window.scrollTo(0, 0);

    if (newPage && arrival !== 'load') this.#focusPage();
  }

  #focusPage(): void {
    const target = this.#options.focusTarget?.() ?? document.querySelector<HTMLElement>('main h1') ?? document.querySelector<HTMLElement>('main') ?? document.body;
    if (!target.hasAttribute('tabindex') && !target.matches('a, button, input, select, textarea')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  #saveScroll(): void {
    history.replaceState({ ...(history.state as EntryState | null), routerIndex: this.#index, scroll: { x: scrollX, y: scrollY } }, '');
  }

  #onlyHashChanged(target: URL): boolean {
    return target.hash !== '' && target.pathname === location.pathname && target.search === location.search;
  }
}
