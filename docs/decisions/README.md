# Decision records

Why this code is shaped the way it is. One file per decision, named by its
subject.

A record is here when the reasoning is not recoverable from the code — when a
reader would otherwise have to guess whether something is deliberate. The code
states its rules in its own comments; these files hold the **why**, and the
alternatives that were rejected.

Source comments do not cite these files as a rule. A handful of genuinely
surprising rules carry a `see docs/decisions/<name>.md` line; everything else
reads on its own.

These are the **framework's** decisions. The application they were worked out
against — a browser for Claude Code's configuration — is a separate, private
repository, and the records about its own subject live there.

## The framework and the CSS engines

| Decision | In one line |
|---|---|
| [The `css` tag never runs at module scope](no-css-tag-at-module-scope.md) | A sheet built at import has no adapter to own it |
| [Engines read tokens, never redeclare them](engines-read-tokens-never-redeclare-them.md) | Each engine owns a prefix and reads the rest with a fallback |
| [`attrs` writes what an engine states](attribute-records-have-one-writer.md) | A template never spells an engine's attribute name |
| [Bind a measurement; class a state](bind-a-measurement-class-a-state.md) | A class cannot carry a number, and a number should not be a class |
| [The styling seam owns the sheet](the-styling-seam-owns-the-sheet.md) | No component touches `adoptedStyleSheets` or a `<style>` element |

## Components, forms and routing

| Decision | In one line |
|---|---|
| [A change is stated, never detected](a-change-is-stated-never-detected.md) | `changed()` at the site that knows; a DOM event is the unit of work |
| [A tickable row is a group](a-row-tick-is-a-group.md) | One checkbox group per list; the form holds the ticks, not the model |
| [Every query key is a list](repeatable-query-keys.md) | One type for every key, and `href` is the only URL builder |

## Testing

| Decision | In one line |
|---|---|
| [A journey uses gestures only](journeys-use-gestures-only.md) | Never publish on the bus to set up state |
| [The browser harness's contract](the-browser-harness-contract.md) | What the in-page harness counts, and when its results may be read |

## Keeping the surface honest

`npm run surface <consumer-dir>…` reports every authoring surface a library exports that has no
call site in the directories you name. An application built on this framework is the forcing
function: surface nobody has had to use is surface nobody has had to defend.

```sh
npm run surface -- ../my-app/src
```

It sorts exports into four kinds and reports only the last — `metadata` (tables an engine publishes
about itself), `guard` (`assert*`), `mechanism` (what an adapter calls on the application's behalf)
and `authoring` (what a style, template or controller is meant to call). It requires a call site,
not a mention: `engine.name`, `name(` or a destructured `{ name }`, so an options key named
`duration` is not a call to `animation.duration`.
