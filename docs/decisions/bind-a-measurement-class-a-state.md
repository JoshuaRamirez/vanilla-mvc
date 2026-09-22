# Bind a measurement; class a state

A value that varies per instance or moves as the user acts goes into a style as
a **hole**. A value from a fixed set goes on the element as a **class**.

```ts
// a measurement: a share, a progress width, a count as a fraction
`inline-size: calc(${m.consistent} * 100%);`

// a state: one of a known few
html`<section class=${`page batch step-${m.status}`}>`
```

## How a bound hole works

The styling seam gives the sheet one custom property per hole —
`--css-<sheet>-<n>` — writes the rule as `var(--css-<sheet>-<n>)`, and sets the
property **on the element**. So every instance shares one adopted stylesheet and
draws from its own model, and a changed value is one `setProperty` — no sheet is
rebuilt, no rule is reparsed.

## The rule

A class cannot carry a number. If you find yourself writing `.width-37`, or
generating a class name from a value, that value wants binding.

A bound hole for something with three possible values is the opposite mistake: a
custom property written on every render where a class would have cost nothing.

## A value that does not vary at all

The third case is a rule whose every value is fixed: a theme colour, a type step,
a layout block. Written inside the `css` tag it lands in a declaration position,
so it binds — a custom property per value, on every instance, saying "this varies"
about something that never does. Hoisting the rules to a module-scope string and
dropping that string in at statement start keeps them raw text instead.

    const RULES = `
      .level { color: ${color('text-muted')}; font-size: ${text('sm')}; }
    `;
    export const memoryRowStyle = new Style<MemoryRowModel>(() => css`
      :scope { ${layout.cluster({ gap: '2' })} }
      ${RULES}
    `);

Measured on `memory-row.style.ts`, whose three rules hold four fixed values: as a
hoisted string, zero bound properties; written inline, four — and the memory
screen draws 187 rows, so 748 custom properties carrying the same text on every
one. Nine of the consuming application's thirty-three style files hoist for this reason.

This is not a speed rule. Serializing a raw string is in fact slower per element
than the inline form (8.9µs against 4.6µs), because static template text is
analysed once and cached per call site while a raw string is walked again on each
render. The reason to hoist is that a hole means "this varies", and these do not.
The module-scope rule permits the hoist — an engine function returns a string, and
only the `css` tag needs an adapter — but it is not what asks for it.

## Why

This is the framework's central claim — that a component can have a stylesheet
of its own, per instance, without a stylesheet per instance. It is only true if
what varies is a value rather than the text of a rule.
