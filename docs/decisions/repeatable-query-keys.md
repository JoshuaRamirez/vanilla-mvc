# Every query key is a list

`RouteMatch.query` is `Record<string, readonly string[]>`. One type: a key
present once is a one-element list, an absent key is absent. Reading a single
value is `query.q?.[0] ?? ''`.

`Routes.href(name, params?, query?)` takes
`Record<string, string | number | readonly (string | number)[]>`. It writes one
pair per value, in the order given. **An empty list writes no pair, and neither
does an empty string** — so `href('search', {}, { q: '', kind: ['skill'] })` is
`/search?kind=skill`, and an empty form is `/search`.

## The rule

No screen recovers a query by parsing `route.url`, and none appends to a URL
pair by pair. `href` is the one builder.

## Why

The consuming application is the forcing function. A comparison targets several workspaces at
once — `?to=a&to=b` — and a router that could not express that made one journey
hand-roll its URL with string concatenation. The moment one screen does that,
encoding is that screen's problem, and it will get it wrong.

Making *every* key a list, rather than some, means a reader never has to know
which kind of key they hold.

## Also worth knowing

`RouteTable.match` builds `query` and `params` with `Object.create(null)`. A URL
like `?__proto__=a` or `?toString=x` would otherwise find `Object.prototype`,
which is not nullish and has no `push`, and the router would throw.
