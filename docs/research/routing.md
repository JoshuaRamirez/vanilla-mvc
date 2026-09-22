# Routing: build or borrow?

**Decision: native browser APIs.** URLPattern for matching, the Navigation API for interception, plus a thin framework `RouteTable` and `Router`.

## Starting point

Our router (`src/framework/router.ts`, ~90 lines): History API `pushState`, `:param` patterns compiled to regexes, query parsing, same-origin link click interception, `popstate`. It announces `router:changed` and listens for `router:navigate` on the event bus.

## What professional routers have that we need

| Gap | Why it matters here |
|---|---|
| Guards: leave and enter | "You have unsaved changes" on leave, and "not signed in, redirect to login" on enter. We can't block or redirect a navigation. |
| Scroll and focus handling | Back should restore scroll position, a new page should start at the top, and screen readers need to hear that the page changed. |
| Anchor links | We intercept `href="#section"` as a route change, so in-page anchors break. That's a real bug. |
| Richer patterns | Optional params, wildcards, most-specific-match ordering, trailing slashes. |
| Building URLs from route names | Hardcoded `href="/todos/active"` breaks silently when a path changes. |
| Base path | We can't deploy under `/app/`. |
| Redirects and aliases | For example `/` → `/todos`, or old URLs → new ones. |

## What they have that we don't need

| Feature | Why we don't need it |
|---|---|
| Nested routes that render component trees, layouts, outlets (React Router, Vue Router) | The shell and components decide what shows. The router only announces. |
| Data loaders, actions, prefetching (React Router, TanStack) | The app model and the server own data. |
| File-based routing, server rendering | Not our model. |
| Route transitions, Suspense-style loading | The busy state lives in models. |
| Code-splitting per route | Not yet. |
| Typed search-param schemas | Models parse params. |

## Options

| | Native (URLPattern + Navigation API) | universal-router 10 | path-to-regexp 8 / regexparam 3 |
|---|---|---|---|
| Patterns: optional, wildcard | ✅ | ✅ | ✅ |
| Build URLs from route names | ours (small) | ✅ `generateUrls()` | ✅ `compile()` |
| Enter guards and redirects | ✅ | ✅ async `resolve()` | ours |
| Leave guards | ✅ cancel the `navigate` event | ours | ours |
| Back-button scroll and new-page focus | ✅ browser | ours | ours |
| Anchor links | ✅ browser (`hashChange`) | ours | ours |
| Link, form, back/forward interception | ✅ one `navigate` event | ours | ours |
| Dependencies | 0 | 1 | 1 |

Not recommended:

| Library | Why not |
|---|---|
| navigo 8.11 | Last release June 2022 |
| page.js 1.11 | Last release November 2023, dated |
| history 5.3 | Last release June 2022, superseded by the Navigation API |
| @vaadin/router 2 | Built around web components |
| TanStack Router core | Built around loaders and typed data, a framework in all but name |

## Browser support (verified 2026-09-16)

- **URLPattern:** Baseline Newly Available since September 15, 2025 (Chrome, Edge, Firefox, Safari). `urlpattern-polyfill` exists for older browsers. Node 24 has it as a global.
- **Navigation API:** Baseline Newly Available since January 2026 (Chrome, Edge, Firefox 147, Safari 26.2).
- **Caveat:** Safari 26.2 lacks `precommitHandler`. Our guards don't need it: leaving is cancelled with `preventDefault()`, and redirects navigate from inside the handler.
- **Typings:** TypeScript 5.9's DOM lib has neither API. We need declarations: `@types/dom-navigation`, plus declarations for URLPattern.

## Decision

Native APIs. They cover more of the gap list than any library and add no dependency. Still ours:

- building URLs from route names (`RouteTable.href`);
- the base path;
- most-specific-match ordering;
- publishing to the bus (`router:navigating` with cancel/redirect, and `router:changed`).

The router stays an application element that talks only through events. Components don't change.

## Sources

- [Navigation API is now Baseline Newly Available (web.dev)](https://web.dev/blog/baseline-navigation-api)
- [Navigation API reaches Baseline (InfoQ)](https://www.infoq.com/news/2026/05/navigation-api-browser/)
- [URLPattern is now Baseline Newly Available (web.dev)](https://web.dev/blog/baseline-urlpattern)
- [URL Pattern API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API)
- [Navigation API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)
