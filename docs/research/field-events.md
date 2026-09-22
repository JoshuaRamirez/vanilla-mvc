# Field events and binding libraries

**Question:** is there a library that, when a DOM event happens, hands the handler the field's value, and on change the new *and previous* value, the same way for every input type? Also: are there libraries that only do binding, one-way or two-way?

**Short answer:** no maintained library does exactly the first. The closest pieces each do part of it. Among binding-only libraries, Knockout is the only mature, maintained one, and it gives old and new values, but it's a second binding system that wants to own its DOM.

Researched 2026-09-16. Versions and release dates from npm on that date; READMEs read from the published packages.

## What we want

```ts
onFieldChange((change) => {
  change.name;      // 'priority'
  change.value;     // 'high'     — checkbox → boolean, number → number, multi-select → string[], checkbox group → string[]
  change.previous;  // 'normal'
  change.field;     // the element
});
```

## Event → value libraries

| Library | Version | Last release | Delegation | Uniform value | Previous value | Notes |
|---|---|---|---|---|---|---|
| @form-observer/core | 1.0.1 | Feb 2026 | ✅ per form | ❌ gives the raw `event` | ❌ | Observer-style API (`new FormObserver('input', cb).observe(form)`); also storage and validity observers |
| delegate-it | 6.4.0 | May 2026 | ✅ | ❌ | ❌ | Delegation only |
| dirty-form | 2.0.0 | Apr 2026 | ✅ | ❌ | baseline only | `isDirty`, `onDirty`, `onClean`, `markAsClean()`; no per-field callback |
| final-form | 5.0.1 | May 2026 | — | — | ✅ `initial` vs `value` | Framework-agnostic form *state*; never touches the DOM, so something still has to read fields |
| @hotwired/stimulus | 3.2.2 | Jan 2026 | ✅ actions | ❌ params come from `data-*` attributes, not field values | ❌ | A controller framework; would compete with ours |
| receptor | 2.2.1 | 2018 | ✅ | ❌ | ❌ | Stale |
| Prototype.js `Form.Element.Observer` | — | legacy | — | ✅ `(element, value)` | ❌ | The old idea exactly, but dead |

**Finding:** the platform's `input` and `change` events carry neither a normalized value nor the previous one. Every library above stops at delegation, dirty tracking, or DOM-free state.

## Binding-only libraries

| Library | Version | Last release | Direction | Previous value | Notes |
|---|---|---|---|---|---|
| **knockout** | 3.5.3 | **Mar 2026** (revived after 2019) | one- and two-way: `value`, `textInput`, `checked`, `selectedOptions`, `event` | ✅ `subscribe(fn, null, 'beforeChange')` | Most mature; uniform across input types. Owns bound regions via `data-bind` and its own `foreach`/`if`, so it overlaps lit-html |
| @tko/build.reference | 4.1.0 | Apr 2026 | same as Knockout | ✅ | Knockout's modernized successor |
| simulacra | 2.2.0 | **2019** | object → DOM, inputs → object | ✅ change fn `(element, value, previousValue)` | The exact callback shape, but stale |
| tinybind | 1.0.0 | **2019** | one- and two-way binders with per-element `getValue` | ❌ | Rivets fork; npm metadata updated 2026, code not |
| rivets | 0.9.6 | 2016 | one- and two-way | ❌ | Stale |
| bind.js, way.js, two-way-binding, data-bind, databind | — | 2016–2022 | two-way | varies | Small, stale |
| alpinejs (`x-model`), petite-vue (`v-model`) | 3.17.3 / 0.4.1 | 2026 / 2022 | two-way | ❌ | Frameworks, not binding libraries |
| @preact/signals-core, hyperactiv | 1.14.4 / 0.11.3 | 2026 / 2022 | reactive state | signals: ❌ | State only; no DOM |

## Options

1. **Knockout for field binding.**
   - For: maintained, uniform across input types, old values via `beforeChange`.
   - Against: a second binding system next to lit-html. `ko.applyBindings` over DOM that lit updates in place is fragile, since each wants to own the same elements. Using Knockout would really mean replacing lit-html, not adding to it.
2. **@form-observer/core for delegation, plus our adapter for value and previous.**
   - The library listens; our `IFieldEvents` adapter normalizes the value and remembers the previous one per field.
   - The library contributes little, since lit already attaches listeners where templates say.
3. **Our own `IFieldEvents` seam, no library.**
   - The adapter builds `{ name, value, previous, field }` from the event: the value from `IFormAccess.readField`, the previous value from a per-field `WeakMap` seeded on focus or first render.
   - About 60 lines, behind a seam, replaceable if a library appears.

## Decision so far

- **Knockout:** ruled out; too heavy.
- **Rivets:** remembered as having worked well, but last released in 2016 (tinybind, its fork, in 2019). Its binder design is the model to borrow: per-element-type `getValue` plus a routine for writing.
- **No maintained library** matches the requirement, so the likely path is option 3, with binders shaped like Rivets'.

## Sources

- [form-observer (GitHub)](https://github.com/enthusiastic-js/form-observer)
- [delegate-it (npm)](https://www.npmjs.com/package/delegate-it)
- [dirty-form (npm)](https://www.npmjs.com/package/dirty-form)
- [final-form (npm)](https://www.npmjs.com/package/final-form)
- [Knockout (GitHub)](https://github.com/knockout/knockout)
- [Simulacra.js](http://simulacra.js.org/)
- [tinybind guide](https://blikblum.github.io/tinybind/docs/guide/)
- [bind.js (GitHub)](https://github.com/remy/bind.js/)
- [way.js](https://gwendall.github.io/way/)
- [data-bind (GitHub)](https://github.com/ahabra/data-bind)
- [databind (GitHub)](https://github.com/grnadav/databind)
- [How to detect all changes to a form with vanilla JavaScript (Go Make Things)](https://gomakethings.com/how-to-detect-all-changes-to-a-form-with-vanilla-javascript/)
