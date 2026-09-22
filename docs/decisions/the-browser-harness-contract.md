# The browser harness's contract

`test/browser/harness.js` judges `test/browser/index.html` — the page of in-browser
cases that exercise what only a real engine can answer. This file is the one home
of what it promises. `testing/index.mjs` and the harness's own header point here
and copy nothing.

## Registering a case

A case file imports from `./harness.js` and may call four things.

- `test(name, fn)` queues a case. `fn` may be sync or async, and is awaited.
- `skip(file, reason)` reports a file the page did not run. It fails nothing.
- `fixture(html)` appends a `<div>` with that markup inside `#fixtures` and
  returns it. **Every fixture is removed after each case**, pass or fail.
- `assert` carries `equal` (`Object.is`), `deepEqual` (JSON shape — so key order
  counts, and an `Element` prints as `<tag>`), `ok`, and `throws(fn, pattern?)`.

Cases run in registration order, which is the import order `index.html` fixes,
one at a time, never in parallel. There is no `before`, `after` or per-file
teardown, by design.

## The counts

`run()` returns and publishes `{ passed, failed, failures, skipped }` and nothing
else. There is no `total`; a reader who wants one adds `passed + failed`.

- `passed` — cases whose `fn` returned or resolved.
- `failed` — cases whose `fn` threw or rejected. A case that does neither cannot
  be `failed`, so **a silent assertion is a pass**.
- `failures` — `[{ name, error }]`, both strings, one entry per failed case in
  run order. `error` is `String(error.message ?? error)`: no stack, no cause, no
  type.
- `skipped` — a list of **file names**, the first argument of each `skip()`. The
  reason is drawn on the page and is not in the object.

Nothing after `run()` mutates the object.

## When `window.results` may be read

`window.results` is `null` from the moment `harness.js` loads until `run()`
finishes, and the finished object afterwards. Two things follow.

**A driver waits.** Poll `#summary` until it no longer reads `Running…`, or poll
`window.results` for non-null. `run()` sets the object before it writes
`#summary`, so either gate is safe and the two cannot disagree.

**A driver never gets an element.** `results` is also the id of the page's
`<ul>`, which the window exposes by name; the harness shadows that at load.
Proved in `test/browser-testing.test.mjs`.

## What the page must provide

`#summary` (text, replaced with `<passed> passed, <failed> failed, <skipped>
skipped`), `#results` (a list, one `<li>` per case, `li.fail` for a failure and
`li.skip` for a skipped file), and `#fixtures` (emptied after every case). A page
without all three throws inside `run()`.

## A test file restores what it installs globally

The harness installs nothing and undoes nothing outside `#fixtures`. Adapters,
the domain, `history`, `document.adoptedStyleSheets`, `window` listeners —
anything global belongs to the file that set it, which restores it in its own
`finally`. Ordering between files is import order and must never be load-bearing.

The one place nothing can undo is module scope: a file that calls
`useAdapters(defaultAdapters())` there leaves it for every later file. That is a
rule rather than a capability — a per-file `after` hook cannot reach a
module-scope install, so adding one would buy nothing and read as a promise the
harness could not keep.
