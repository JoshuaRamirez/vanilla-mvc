# Research

Decisions on what VanillaMVC builds versus borrows. Each file records the question, the gap analysis, the options considered, and the decision.

> **Update 2026-09-16:** after the field-events research found no library for uniform event values, we built all three pieces ourselves: `src/libraries/templates` replaced lit-html, `src/libraries/fields` replaced form-data-json-convert, and `src/libraries/router` replaced the Navigation API and URLPattern. The gap analyses below still describe what those libraries needed to cover.

| File | Question | Decision |
|---|---|---|
| [templating.md](templating.md) | Keep our template engine or use a library? | lit-html 3, **superseded by `src/libraries/templates`** |
| [routing.md](routing.md) | Keep our router or use a library? | Native APIs, **superseded by `src/libraries/router`** |
| [form-values.md](form-values.md) | How do we read values out of the DOM? | form-data-json-convert 3, **superseded by `src/libraries/fields`** |
| [field-events.md](field-events.md) | Is there a library that hands handlers the value (and previous value) per event? Binding-only libraries? | No exact fit; Knockout too heavy. **Built `src/libraries/fields`**, Rivets-style |

Researched and implemented 2026-09-16. Library versions and browser support were checked on that date.
