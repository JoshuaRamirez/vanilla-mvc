/**
 * css templates: `css` tagged stylesheets, scoped to an element or the document, with values
 * bound live. No dependencies.
 *
 * Two rules worth knowing before you write one:
 *   - A hole's meaning comes from where it sits. In a declaration value it binds live as a custom
 *     property on the styled element; at statement start it composes text, a nested block or a
 *     declaration object; in a selector or a property name it is verbatim text.
 *   - The styled element is `:scope` or `&`, and only those. A bare `.card { }` matches below the
 *     element, never the element itself.
 *
 * ./README.md is the one home of the rules: every position, every refusal, what the platform does
 * with the result, and how to author cheaply. The styling seam points there and copies nothing.
 */
export { analyze, idOf, type Hole, type HoleKind } from './analyze.ts';
export { apply, release, type ApplyOptions } from './adopt.ts';
export { declarations, scoped, serialize, type Property, type Serialized } from './serialize.ts';
export { css, StyleResult } from './sheet.ts';
