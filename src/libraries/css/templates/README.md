# templates

`css` tagged stylesheets, scoped to an element or the document, with values bound live. No dependencies. This file is the one home of the rules: the styling seam points here and copies nothing.

## How a hole is read

A `css` hole is read by where it sits in the static CSS around it. In a declaration value
(`padding: ${x}`, including inside `calc()`) a string or number is bound live: the rule says
`var(--css-<sheet>-<n>)` and the value is set as a custom property on the styled element (on `<html>`
for the document), so a changed value touches no stylesheet; a CSS-wide keyword (`initial`,
`inherit`, `unset`, `revert`, `revert-layer`) is written into the text instead, since a custom
property holding it would apply it to itself; `null`, `undefined` and `false` are empty text, which
drops a standard property's declaration and leaves a custom property empty; inside a descriptor
at-rule (`@font-face`, `@property`, `@counter-style`, `@page`, `@font-palette-values`) a value is
text, verbatim, because `var()` is invalid there. At the start of a statement, a nested `css` block,
an array of them, or a string of CSS text composes inline, and an object is a declaration block whose
keys are property names and whose values bind live — inside a descriptor at-rule they are text, as
above; at the top level, outside every block, the object becomes `:scope { … }`: the styled element,
or `:root` when the sheet is applied to the document; empty is nothing. A nested block is read where
it lands: inside a descriptor at-rule its values are text too, and its own depth adds to the outer
one. In a selector, an at-rule prelude or a property name, a string or number is CSS text verbatim
and may not contain `{`, `}`, `;` or `/*`. Inside quotes, text is escaped. A function anywhere, a
`css` block in a value or selector, or an object outside a statement start is refused with a
TypeError naming the sheet and quoting the CSS before the hole; unbalanced braces, an open string or
comment, and a hole inside a comment or a bare `url()` are refused by the `css` tag itself, at the
call site. Raw CSS text at statement start must be self-contained — braces, parentheses, brackets,
quotes and comments balance within it — and nothing else is escaped: `@scope`, not the serializer,
is the fence. `apply(style, element)` adopts one constructed CSSStyleSheet per distinct text of a
call site on the element's document, wrapped in `@scope ([data-css~="<sheet>"]) to (:scope
<boundary>)`, and puts the token in the element's `data-css` and the bound values on its `style`,
re-set on every call since the morph strips both. Rules reach that element and its subtree and stop
at the boundary (the framework passes `[data-component] > *`: child components' views). The element
itself is `:scope` or `&`, and only those: a selector without them matches below the root, so
`.card { }` on the element `styled` sits on does not match it — write `:scope { }`, `:scope.card { }`
or `& { }`. A hole that changes the text (a selector, a conditional block, an emptied value) is a new
variant: a new shared sheet, the token becomes `<sheet>.<n>`; 64 variants of one call site throw a
TypeError naming the fix. Elements applying the same text share one sheet. `apply(style, document)`
adopts the text unwrapped and replaces it in place when it changes. `release(scope)` drops the
scope's tokens and properties, and a document's sheets; element-scope sheets stay adopted, inert
without a token, so a scope that leaves without release costs nothing per element. `data-css` and
every name under `--css-` are reserved: no engine or style defines one, so a sheet named
`space` or `color` cannot collide with a theme token. The sheet's name is the first class in its
text, else its first identifier. `declarations({ '--p': v })` writes a declaration block for a
template's `style=`. Floor: Chrome 118, Safari 17.4, Firefox 146 for `@scope`
(caniuse.com/mdn-css_at-rules_scope: Firefox 2–145 unsupported, so Firefox ESR 140 is out);
constructed sheets are older everywhere; probed once per document, with the floor in the error.

## Cascade, and what it costs

Cascade, all native: `@scope` adds no specificity; adopted sheets follow document sheets, so a scoped
`.card` beats a global `.card` of equal specificity by order; ties between nested scopes go to the
nearer root, before order; `@keyframes`, `@font-face` and `@layer` inside the wrapper are valid but
unscoped (css-cascade-6), so nothing needs hoisting; two sheets on one element cascade in adoption
order, not `styled` order — keep a property in one sheet. A bound `var()` resolves at the scope
element, not at the matched descendant: `--css-card-0: var(--space-1)` is substituted where it is
declared, so a token re-declared between them is not seen. Bind what varies per instance; put
per-state shape on classes: `styled` on N keyed rows is N×(k+1) attribute writes per render, while
`class=${done ? 'done' : ''}` with `.done { }` on the parent scope is zero. A value that moves
continuously (a progress width) belongs in the template's `style=` through `declarations()`, read by
`var()`: the morph keeps it and nothing is re-set. One `css` call site at a Style's root, branching
inside with holes or nested `css` / `nothing`; a rules function that alternates call sites accumulates
records on the element, exactly as `html`'s one-root rule. An engine's rule-emitting function returns
a `StyleResult` from one `css` call, so a style writes `${theme()}` as a statement.
