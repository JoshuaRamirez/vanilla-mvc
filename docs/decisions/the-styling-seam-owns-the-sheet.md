# The styling seam owns the sheet

A component never touches `document.adoptedStyleSheets`, never creates a
`<style>` element, and never sets `.textContent` on one.

## The rule

`IStyling` in `src/framework/seams.ts` is the boundary. A `Style<TModel>` is
applied through it, and the adapter decides how the text reaches the page:
`@scope`-wrapped and adopted for a component, unwrapped and adopted for the
document.

Two consequences worth stating:

- **`@property` and `@keyframes` must sit at the top level.** They are the
  document style's, applied to `document`, where the adapter adopts the text
  unwrapped. Inside a component's scope, `@scope` would wrap them and they would
  be invalid.
- **Never `<style>${themeText()}</style>` inside an `html` template.** The `html`
  tag escapes quotes and `>`, so the CSS arrives mangled, and the morph re-sets
  the text on every render.

## Why

One seam means the whole framework can be tested against a stub renderer with no
DOM, and means a different delivery mechanism — constructable sheets, a build
step, something not yet written — is an adapter rather than a rewrite.
