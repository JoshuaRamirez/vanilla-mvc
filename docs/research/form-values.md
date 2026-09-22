# Reading values out of the DOM: build or borrow?

**Decision: form-data-json-convert 3** behind an `IFormAccess` seam, with the platform's own element properties for single fields.

## Question

lit-html only writes to the DOM. Its `live()` directive compares against DOM values when setting them, but it never reads them back. Our `bind()` directive was reading field values itself, coupled directly to lit's directive API. We want reading (and writing back) behind a library seam, like rendering.

## What we need

| Need | Why |
|---|---|
| Whole-form read into an object | Uncontrolled forms (the editor) read everything on input and submit instead of binding field by field. |
| Arrays from repeated names | A checkbox group `tags[]` must come back as `['home', 'work']`. |
| Write an object back into a form | Load a record into a form, and Revert. |
| Clearing on write | `[]` and `false` must uncheck boxes. |
| Single-field read and write | `bind()` and `fieldValue()` work on one element. |
| No dependency on the renderer | Swapping lit-html must not affect form access. |

We don't need: file inputs as base64, form validation UI (the server validates), schema parsing (domain classes normalize values).

## Options

| Library | Version | Last release | Reads | Writes | Notes |
|---|---|---|---|---|---|
| **form-data-json-convert** | 3.0.1 | Mar 2026 | ✅ nested names, arrays | ✅ `fromJson`, `reset`, `clear` | ~3 KB compressed, MIT, ES module build, zero dependencies |
| Native `FormData` | platform | — | ✅ flat | ❌ | No arrays or nesting without extra code; can't write |
| parse-nested-form-data | 1.0.1 | May 2026 | ✅ from `FormData` | ❌ | Read only |
| zod-form-data | 3.0.3 | Jul 2026 | ✅ with a zod schema | ❌ | Read only; brings zod |
| @conform-to/dom | 1.21 | Aug 2026 | ✅ | partial | Built around constraint-validation UX; more than we need |
| get-form-data | 3.0.0 | 2022 | ✅ | ❌ | Stale |
| form-serialize | 0.7.2 | 2022 | ✅ | ❌ | Stale |
| form-to-object | 6.0.0 | 2022 | ✅ | ❌ | Stale |

## Verified behavior (Chrome, 2026-09-16)

- **Reading** returns strings. Checkbox groups (`tags[]`) come back as arrays. A checked checkbox returns its `value` attribute (`done` → `"true"`). An unchecked checkbox is **omitted**, not `false`. Domain classes normalize these values.
- **Writing** with default options does **not** uncheck boxes for `[]` or `false`. With `{ clearOthers: true }` it does, and fields not named are cleared. The adapter always writes with `clearOthers`, so `writeForm` means "replace".
- **Single fields:** the library works on containers, not single elements, so the adapter reads single fields with element properties (`checked`, `valueAsNumber`, `value`).
- **Node:** it loads through CommonJS `module.exports`, so tests can import the framework without a browser.

## The seam

```ts
interface IFormAccess {
  readForm(container: HTMLElement): Record<string, unknown>;
  writeForm(container: HTMLElement, values: Record<string, unknown>): void; // replaces
  readField(field: FormField): unknown;
  writeField(field: FormField, value: unknown): void;
  changeEvent(field: FormField): 'input' | 'change';
}
```

- **Adapters:** `FormDataJsonAccess` implements `IFormAccess`, and `LitRenderer` implements `IRenderer`. Both are installed by `Application.createAdapters()`, which an app overrides to swap a library.
- **Rule:** only files under `src/framework/adapters/<library>/` may import that library. `test/seams.test.mjs` enforces it.
- **Template helpers** use the seam: `bind()`, `fill()`, `formValues()`, `fieldValue()`.

**Limit of the rendering seam:** templates are written in lit-html's tagged-template syntax, re-exported from `adapters/lit/syntax.ts`. Swapping to a library with the same syntax (uhtml) means a new adapter plus that one file. Swapping to a different syntax means rewriting templates.
