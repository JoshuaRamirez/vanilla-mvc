# Templating: build or borrow?

**Decision: lit-html 3** as the renderer, wrapped by the framework's `Template` class so every handler still ends in `update()`.

## Starting point

Our engine (`src/framework/template.ts`, ~230 lines, no dependencies):

- Handlebars-style `{{ }}`, `{{{ }}}`, `{{#if}}`, `{{#each}}`
- Binding done by the engine: `@event="method(args)"` (captures loop variables), `bind="expr"` (two-way), `?attr="expr"` (boolean attributes)
- Compiled with `new Function` and `with (model)`; regex tokenizer
- Output parsed into DOM; the whole view is replaced on every render, with a focus-restore patch afterwards

## What professional engines have that we need

| Gap | Why it matters here |
|---|---|
| Values can never become markup | Our `{{ }}` escapes HTML characters, which covers text and quoted attributes. It can't stop `href="{{ url }}"` from receiving `javascript:…`. Lit sets values as text nodes and properties, so a value can never turn into markup. None of these libraries block `javascript:` links by default except Angular, so we need a URL check either way. |
| No `eval` | We need `'unsafe-eval'` to work at all, so a site with a strict Content Security Policy would block us. Libraries compile at build time or use JavaScript template literals. |
| Errors that point at the template | A bad expression throws a bare `SyntaxError` from generated code, with no template name or line number. |
| Editor support | Typos in templates are invisible until runtime. Lit plus its plugin, or Vue with Volar, type-check templates. |
| Surviving tricky input | Regex parsing breaks on `{{ "}}" }}`, a `>` or quote inside `@click="…"`, or `@click` written as plain text. |
| Updating in place | Replacing the view loses focus, scroll position inside the view, text selection, CSS transitions, playing media and IME input. It also costs more as lists grow. |

## What they have that we don't need

| Feature | Why we don't need it |
|---|---|
| Server rendering, streaming, hydration | The app stays in memory, and the server does business logic, not HTML. |
| Partials, layouts, inheritance, slots | Components and `data-component` placeholders handle composition. |
| Filters, helpers, pipes, formatting, i18n | They belong in rich model getters. |
| Reactivity: signals, dependency tracking | Snapshot change detection in `update()` covers it. |
| Directives like `until`, `cache`, `guard`, `ref`, `v-model` modifiers | Async work lives in models, and controllers handle the rest. |
| Scoped CSS, shadow DOM, custom element interop | Not in scope. |
| Sandboxing user-authored templates (Liquid) | Our templates are trusted source code. |
| Template loaders, async rendering, other output languages | Not relevant in the browser. |

**Takeaway:** what's missing is safety and tooling, not features.

## Options

Excluded: anything that's really a framework (Vue, Alpine, Preact with htm) and string-only engines that can't bind (Eta, EJS, Nunjucks, Mustache).

| | lit-html 3.3 | uhtml 5 | Handlebars 4.7 + our binding | Handlebars/ours + idiomorph or morphdom |
|---|---|---|---|---|
| Binding is built in | ✅ | ✅ | ❌ | ❌ |
| Updates in place | ✅ | ✅ | ❌ | ✅ |
| No `eval` | ✅ | ✅ | ✅ (needs a build step) | depends |
| Type-checked templates | ✅ | partial | ❌ | ❌ |
| HTML-looking templates | ❌ (template literals) | ❌ | ✅ | ✅ |
| Size (compressed, approx.) | ~3 KB | ~3 KB | ~20 KB runtime | varies |
| Maintainers | a team (Lit / Google) | one person | a team | a team |
| License | BSD-3-Clause | MIT | MIT | 0BSD / MIT |

Notes:
- **lit-html:** `@event`, `?attr`, `.prop` and `repeat()` for keyed lists. The catch is that it comes from the Lit team, and Lit is on the "over-engineered" list. lit-html alone is a rendering library, not a framework.
- **uhtml:** same approach and syntax, but one maintainer, a smaller community, and an API that has changed a lot between major versions.
- **Handlebars:** logic-less templates suit rich models, but we'd keep writing the binding and it still replaces the whole view.
- **Morphing (idiomorph, morphdom):** keeps HTML-string templates but merges instead of replacing. That's two libraries plus our binding, and with our engine the `eval` and regex problems remain.

## Decision

lit-html. It covers the security, parsing, editor and in-place-update gaps and does the binding itself. Our framework wraps it so that:

- templates are `(model, controller) => html\`...\``;
- the controller passed to a template ends every handler call in `update()`;
- a framework `bind()` directive provides two-way binding, which lit-html doesn't have;
- a framework URL check covers `javascript:` links.

Component, controller and model classes don't change.
