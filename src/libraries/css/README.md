# The CSS framework

Seven engines, no dependencies, no build step. Each stands alone, reads the others through their
index files only, and emits CSS text the styling seam adopts.

| Engine | What it is |
|---|---|
| [templates](templates/README.md) | `css` tagged stylesheets, scoped to an element or the document, values bound live. Everything else is written with it. |
| [theme](theme/README.md) | Design tokens as custom properties: colour, space, type, radius, shadow, stroke. |
| [layout](layout/README.md) | Six structural primitives — stack, cluster, grid, pair, sidebar, cover — hooked by `data-layout`. |
| [responsive](responsive/README.md) | Breakpoints, media and container queries written on them, fluid type and space. |
| [animation](animation/README.md) | Timing tokens, keyframes, stagger ladders, compiled timelines. |
| [effects](effects/README.md) | Transitions, fades, attention-getters, elevation, blur — on animation's and theme's names. |
| [semantics](semantics/README.md) | Composites — card, toolbar, field group, dialog, toast, nav — as attribute records plus their sheets. |

## What they agree on

- **One engine owns a prefix of custom properties and reads every other's with a fallback.** Each
  index exports a `properties` record naming what it defines, reads and overrides, so the claim is
  checkable rather than aspirational. See
  [engines read tokens, never redeclare them](../../../docs/decisions/engines-read-tokens-never-redeclare-them.md).
- **`--css-*` and `data-css` are the styling seam's.** No engine defines either.
- **A value reaches the page by the cheapest channel that can carry it** — an attribute word, a
  custom property, or text composed once into a sheet. Each engine's README costs its channels.
- **The `css` tag never runs at module scope.** An engine function that returns a *string* may.
  See [the module-scope rule](../../../docs/decisions/no-css-tag-at-module-scope.md).

## Where the reasoning lives

These READMEs say what each engine does and how to use it. Why it is shaped that way — and what was
rejected — is in [`docs/decisions/`](../../../docs/decisions/).
