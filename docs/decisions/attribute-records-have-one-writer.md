# An engine states an attribute record; `attrs` writes it

A composite — a card, a toolbar, a dialog, a toast, a nav — is a **record** the
engine builds and a behaviour that writes it:

```ts
const CARD = semantics.cardAttributes({ dense: true });
html`<article ${attrs(CARD)}>…</article>`
```

## The rule

`attrs(record)` sets each key of a plain object as an attribute: `true` becomes
an empty value; `false`, `null` and `undefined` remove it; anything else is
`String(value)`. It also removes any attribute it set on that element before
that is absent now.

**A template never spells an engine's attribute name.** The engine names it, the
record carries it, `attrs` writes it. That is what keeps the boundary between a
component and an engine checkable.

Region markers HTML has no element for — `data-dialog-confirm`,
`data-toast-notice` — are written bare, as the engine states them.

## Why

If a template writes `role="status" aria-live="polite"` by hand, the engine's
sheet and the component's markup are two statements of one agreement, and the
next change to the composite silently breaks every component that spelled it
out. One record means one place to change.
