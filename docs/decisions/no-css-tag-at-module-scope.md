# The `css` tag never runs at module scope

Every `css` call happens **inside** the `Style` callback:

```ts
export const pageStyle = new Style<PageModel>(() => css`
  :scope { ${layout.stack({ gap: '4' })} }
`);
```

Never at the top of the file, and never in an expression that reaches the tag.

## The rule

What may not run at module scope is the `css` tag and any expression reaching
it. An engine function that returns a **string** is safe at module scope — a
record of attribute names, a composed block of declaration text — and a couple
of files hoist one deliberately, with a comment saying why.

## Why

Module scope runs at import. The styling adapter is installed when the
application is created, which is later. A sheet built at import has no adapter
to own it, so the tag throws and the whole app fails to boot — with an error
pointing at a stylesheet, several frames away from the import that actually
caused it.

The `Style` callback exists precisely so the sheet is built when it is first
needed, not when the file is loaded.

The seams test enforces this by file and line.
