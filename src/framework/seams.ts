/**
 * Library seams. The framework talks to rendering, form values, routing, and
 * styling only through these interfaces. Adapters in framework/adapters/<library>/
 * implement them on top of libraries/<library>/.
 *
 * To swap a library: write a class implementing the seam, and return it
 * from Application.createAdapters(). To add a seam: add its interface here,
 * a property to Adapters, an adapter folder, and a line in defaultAdapters().
 */

// ---- Rendering ----

/** A rendered template's description. Opaque to the framework; the renderer makes and reads it. */
export interface ViewResult {
  readonly strings: TemplateStringsArray;
  readonly values: readonly unknown[];
}

/** Something to do with an element after each render. Opaque; the renderer makes and applies it. */
export interface ElementBehaviorResult {
  readonly apply: (element: Element) => void;
}

export interface IRenderer {
  /** Build a view from an html`` tagged template. */
  html(strings: TemplateStringsArray, values: unknown[]): ViewResult;
  /** Wrap an element callback so it can sit in an element position: <form ${behavior}>. */
  behavior(apply: (element: Element) => void): ElementBehaviorResult;
  /** Render a view into target, updating in place. Handlers are called with (event, element). */
  render(view: ViewResult, target: HTMLElement): void;
}

// ---- Form values ----

export type FormField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** A field's value changed: what it is now, and what it was. */
export interface FieldChange {
  /** Field name without a trailing [] ('' when unnamed). */
  name: string;
  /** Uniform across input types: string, number | null, boolean, string[], or null for an unchecked radio group. */
  value: unknown;
  previous: unknown;
  field: FormField;
  event: Event | null;
}

export interface IFormAccess {
  /** A whole form (or any container) as an object keyed by field name (`tags[]` → `tags`). */
  readForm(container: HTMLElement): Record<string, unknown>;
  /** Replace a form's values by field name. Fields not named are cleared. */
  writeForm(container: HTMLElement, values: Record<string, unknown>): void;
  readField(field: FormField): unknown;
  writeField(field: FormField, value: unknown): void;
  /** Record current values as the baseline for previous. Without force, only fields not yet known. */
  remember(container: HTMLElement, force?: boolean): void;
  /** The change behind an event: the event's field, or element if it is one. Null when neither is a field. */
  change(event: Event, element: Element): FieldChange | null;
}

// ---- Routing ----

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

export interface IRouteTable {
  readonly base: string;
  match(url: URL | string): RouteMatch;
  /** Build a URL for a named route: href('todos', { filter: 'active' }) → '/todos/active'. A list writes one pair per value; an empty list writes none. */
  href(name: string, params?: Record<string, string | number>, query?: Record<string, string | number | readonly (string | number)[]>): string;
  /** True when the URL is inside this app's base path. */
  owns(url: URL | string): boolean;
}

/** A navigation about to happen. Guards cancel it or send it elsewhere. */
export interface RouteChange {
  readonly from: RouteMatch;
  readonly to: RouteMatch;
  readonly cancelable: boolean;
  readonly cancelled: boolean;
  readonly reason: string | undefined;
  readonly redirectTo: string | undefined;
  readonly isLeaving: boolean;
  leaves(name: string): boolean;
  enters(name: string): boolean;
  cancel(reason?: string): void;
  redirect(path: string): void;
}

export interface NavigatorOptions {
  table: IRouteTable;
  /** Before a navigation commits (not the first route). */
  onNavigating: (change: RouteChange) => void;
  /** After the location changed. */
  onChanged: (match: RouteMatch) => void;
}

export interface INavigator {
  readonly current: RouteMatch | null;
  /** Listen, and announce the current location. */
  start(): void;
  stop(): void;
  /** Returns false when a guard cancelled it or it left the app. */
  navigate(url: string, options?: { replace?: boolean }): boolean;
}

export interface IRouting {
  createTable(routes: readonly Route[], options?: RouteTableOptions): IRouteTable;
  createNavigator(options: NavigatorOptions): INavigator;
}

// ---- Styling ----

/** An authored stylesheet with its bound values. Opaque; the styling library makes and reads it. */
export interface StyleResult {
  readonly strings: TemplateStringsArray;
  readonly values: readonly unknown[];
}

/**
 * The styling seam: a `Style` reaches the page only through this.
 * see docs/decisions/the-styling-seam-owns-the-sheet.md
 */
export interface IStyling {
  /** Build a stylesheet from a css`` tagged template. */
  css(strings: TemplateStringsArray, values: unknown[]): StyleResult;
  /** Apply a stylesheet to a scope: the document, or an element and its subtree. The same scope again updates in place. */
  apply(style: StyleResult, scope: Document | HTMLElement): void;
  /** Take back everything applied to a scope. */
  release(scope: Document | HTMLElement): void;
}

// ---- All seams ----

export interface Adapters {
  renderer: IRenderer;
  forms: IFormAccess;
  routing: IRouting;
  styling: IStyling;
}
