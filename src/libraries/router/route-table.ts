// Every query key is a list, and href is the only URL builder.
// see docs/decisions/repeatable-query-keys.md
export interface Route {
  /** Unique; used to build links with href(). */
  name: string;
  /** '/todos/:filter?', '/todos/:id(\\d+)', '/docs/*'. */
  path: string;
  /** Send matching URLs here instead, replacing the history entry. */
  redirect?: string;
}

export interface RouteMatch {
  name: string;
  path: string;
  /** Path plus query string: what to navigate to to come back here. */
  url: string;
  params: Record<string, string>;
  /** Every value the URL gave a key, in order: a key present once is a one-element list, an absent key is absent. */
  query: Record<string, readonly string[]>;
  redirect?: string;
}

export interface RouteTableOptions {
  /** Where the app lives, e.g. '/app'. Defaults to the site root. */
  base?: string;
  /** Route name reported when nothing matches. */
  fallback?: string;
}

interface Entry {
  route: Route;
  pattern: RegExp;
  keys: string[];
  ranks: number[];
}

/**
 * The application's routes. Matches paths most specific route first, and
 * builds URLs from route names. Pure: no history, no DOM.
 *
 *   :name          one segment
 *   :name?         optional segment
 *   :name(regex)   one segment matching regex, e.g. :id(\\d+)
 *   *              the rest of the path, as param "0"
 */
export class RouteTable {
  readonly base: string;
  readonly fallback: string;
  readonly #entries: Entry[];

  constructor(
    readonly routes: readonly Route[],
    { base = '', fallback = 'not-found' }: RouteTableOptions = {},
  ) {
    this.base = trimSlash(base.startsWith('/') || base === '' ? base : `/${base}`, '');
    this.fallback = fallback;

    const names = new Set<string>();
    for (const { name } of routes) {
      if (names.has(name)) throw new Error(`Duplicate route name "${name}"`);
      names.add(name);
    }

    this.#entries = routes
      .map((route) => ({ route, ...compile(this.#join(route.path)), ranks: rank(route.path) }))
      .sort((a, b) => bySpecificity(a.ranks, b.ranks));
  }

  /** True when the URL is inside this app's base path. */
  owns(url: URL | string): boolean {
    const { pathname } = toUrl(url);
    return this.base === '' || pathname === this.base || pathname.startsWith(`${this.base}/`);
  }

  match(url: URL | string): RouteMatch {
    const target = toUrl(url);
    const pathname = trimSlash(target.pathname, '/');
    // Null-prototype: a `?__proto__=x` or `?toString=x` key must land as data, not reach Object.prototype.
    const query: Record<string, string[]> = Object.create(null);
    for (const [key, value] of target.searchParams) (query[key] ??= []).push(value);

    for (const { route, pattern, keys } of this.#entries) {
      const found = pattern.exec(pathname);
      if (!found) continue;
      const params: Record<string, string> = Object.create(null);
      keys.forEach((key, i) => {
        const value = found[i + 1];
        if (value !== undefined) params[key] = safeDecode(value);
      });
      const url = target.pathname + target.search;
      return { name: route.name, path: target.pathname, url, params, query, ...(route.redirect && { redirect: route.redirect }) };
    }
    return { name: this.fallback, path: target.pathname, url: target.pathname + target.search, params: Object.create(null), query };
  }

  /** Build a URL for a named route: href('todos', { filter: 'active' }) → '/todos/active'. A list writes one pair per value; an empty list writes none. */
  href(name: string, params: Record<string, string | number> = {}, query: Record<string, string | number | readonly (string | number)[]> = {}): string {
    const route = this.routes.find((r) => r.name === name);
    if (!route) throw new Error(`No route named "${name}"`);
    if (route.path.includes('*')) throw new Error(`Route "${name}" has a wildcard; build its URL by hand`);

    const path = route.path.replace(/\/:(\w+)(?:\([^)]*\))?(\?)?/g, (_, key: string, optional?: string) => {
      const value = params[key];
      if (value === undefined || value === '') {
        if (optional) return '';
        throw new Error(`Route "${name}" needs the "${key}" parameter`);
      }
      return `/${encodeURIComponent(String(value))}`;
    });

    // One pair per value, in the order given: URLSearchParams owns the encoding, so ?q=x+y is unchanged.
    const pairs = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      for (const one of listOf(value)) {
        if (one !== undefined && one !== '') pairs.append(key, String(one));
      }
    }
    const search = pairs.toString();
    return this.#join(path) + (search ? `?${search}` : '');
  }

  #join(path: string): string {
    return trimSlash(this.base + (path.startsWith('/') ? path : `/${path}`), '/');
  }
}

/** A path pattern as a regular expression plus its parameter names, in order. */
function compile(path: string): { pattern: RegExp; keys: string[] } {
  if (path === '/') return { pattern: /^\/$/, keys: [] };
  const keys: string[] = [];
  const source = path
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      if (segment === '*') {
        keys.push('0');
        return '(?:/(.*))?';
      }
      const param = /^:(\w+)(?:\(([^)]*)\))?(\?)?$/.exec(segment);
      if (!param) return `/${segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
      const [, name, constraint = '[^/]+', optional] = param;
      keys.push(name);
      return optional ? `(?:/(${constraint}))?` : `/(${constraint})`;
    })
    .join('');
  return { pattern: new RegExp(`^${source}$`), keys };
}

/** One value or many, as many: the query a caller wrote, read one way. */
function listOf(value: string | number | readonly (string | number)[]): readonly (string | number)[] {
  return typeof value === 'string' || typeof value === 'number' ? [value] : value;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function toUrl(url: URL | string): URL {
  return typeof url === 'string' ? new URL(url, 'http://app.invalid') : url;
}

/** Remove trailing slashes; an empty result becomes `empty`. */
function trimSlash(path: string, empty: string): string {
  return path.replace(/\/+$/, '') || empty;
}

/** Per segment: static 3, param 2, optional param 1, wildcard 0. */
function rank(path: string): number[] {
  return path
    .split('/')
    .filter(Boolean)
    .map((pattern) => {
      const segment = pattern.replace(/\([^)]*\)/g, ''); // ignore regex constraints like (\d+)
      if (segment.includes('*') || /^:\w+[+*]$/.test(segment)) return 0;
      if (/^:\w+\?$/.test(segment)) return 1;
      if (segment.startsWith(':')) return 2;
      return 3;
    });
}

/** More specific segments first; when one is a prefix of the other, the shorter wins. Stable otherwise. */
function bySpecificity(a: number[], b: number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return b[i] - a[i];
  }
  return a.length - b.length;
}
