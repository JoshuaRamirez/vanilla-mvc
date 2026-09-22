# An engine reads another engine's tokens; it never declares them

The CSS engines — theme, layout, responsive, animation, effects, semantics —
each own a prefix of custom properties. An engine **defines** only its own, and
**reads** everyone else's through `var(--name, <fallback>)`.

Every engine's index exports a `properties` record saying exactly this:

```ts
export const properties = Object.freeze({
  defines:   [...],   // this engine's own
  reads:     [...],   // other engines', read with a fallback
  overrides: [],      // ideally empty
});
```

## The rule

- Theme owns `--color-*`, `--space-*`, `--text-*`, `--font-*`, `--radius-*`,
  `--shadow-*`, `--stroke-*`, `--leading-*`, `--weight-*`.
- Layout owns `--layout-*`, animation `--duration-*`/`--ease-*`/`--stagger`/
  `--anim-*`, effects `--fx-*`.
- **`--css-*` is reserved** for the styling seam's bound holes. No engine and no
  style file may define one.
- A fallback is never a copy of another engine's value invented locally. It is
  imported from the engine that owns it.

## Why

Two engines that both declare `--color-accent` produce a cascade that depends on
sheet order, and sheet order is decided by the document style's statement list —
a file neither engine can see. Reading with a fallback means an engine works
alone and composes without ordering rules.

The `properties` records make the claim checkable rather than aspirational: a
test reads them and fails on an overlap.
