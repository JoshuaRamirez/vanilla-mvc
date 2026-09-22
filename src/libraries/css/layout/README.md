# layout

Six structural primitives, hooked by data-layout on an element. Depends on the css tag in templates/ and on Theme's default space scale in theme/, through their index files only.

    <div data-layout="stack">     children in a column, a gap between
    <div data-layout="cluster">   children inline, wrapping, a gap between (pills, buttons, a header row)
    <ul  data-layout="grid">      as many columns as fit above a minimum width, or a fixed count
    <dl  data-layout="pair">      a label column as wide as its widest label, a value column taking the rest
    <div data-layout="sidebar">   one fixed side beside one fluid main; wraps when main gets too narrow
    <div data-layout="cover">     a full-height frame with one centred principal

## The three rules

    1. The attribute is the primitive. Words are attributes too:
         on the root:  data-layout-gap="0".."8"       any primitive: the step becomes --layout-gap
                       data-layout-side="start|end"  sidebar: which child is the side (absent = start)
                       data-layout-dense             grid: grid-auto-flow: dense
                       data-layout-list              stack, cluster, grid, pair: the element is a <ul>,
                                                     <ol> or <dl> — the marker, the UA indent and the
                                                     element's block margin go, since the gap is the rhythm
         on a child:   data-layout-principal         cover: the centred child (an only child needs no mark);
                                                     stack: the child that grows
    2. Lengths and keywords are knobs — custom properties set ON THE ELEMENT that carries data-layout,
       never on an ancestor: every knob is registered inherits: false, so nesting never leaks.
         --layout-gap  --layout-align  --layout-justify  --layout-grid-min  --layout-grid-repeat
         --layout-pair-column-gap  --layout-sidebar-width  --layout-sidebar-min  --layout-cover-min
       knobs({ gap: '2', sidebarWidth: '18rem' }) writes them, typed, as declarations for a style
       attribute or a rule. Gap is a Theme step '0'..'8' and becomes var(--space-<step>, <fallback>) —
       space('2') is that text, the fallback Theme's own default (fallbacks); never a raw length. A length is typed: '18rem', '50%', 'clamp(…)';
       never '20', never 'auto'. A bare '0' is emitted 0px (lengthText): inside grid's min(<min>, 100%)
       an unitless zero is a <number>, not a <length>, and the browser drops the whole declaration.
       A length is never an attribute: data-layout-min or data-layout-width
       is a diagnostics() fault ("min is not an attribute; set it in the style").
    3. layout() is the sheet: once, at the document, a StyleResult from one css call. Its child rules are :where() (specificity 0), so an
       author's single-class rule on a child wins; its root rules are (0,1,0), so a type-selector reset
       cannot beat display. It is registrations() (the @property rules) + the primitives + the two word
       rules (LIST, DENSE) + stepRules() (the nine [data-layout-gap] rules), all strings composed inside it. diagnostics() is a second
       StyleResult, for development: it outlines and labels every mistake it can see.

## How data reaches a layout

How data reaches a layout, by cost — the three channels:

    A. attributes on the element, from the template and the model: the primitive and every step or modifier
       that changes with the model. Zero stylesheet work; the renderer sets only what changed.
    B. custom properties on the element — a *.style.ts, or style=${knobs({ … })} today: lengths and keywords.
    C. per-selector blocks stack(), cluster(), grid(), pair(), sidebar(), cover() inside a *.style.ts rule: for rules
       that own a selector — a composite's region, an element you cannot attribute. Never a per-render value.
    The template chooses the primitive and its steps (A); a style sets lengths and names containers once
    per component (B); a block (C) is for a selector, not a value.

## Options and knobs

Option ↔ knob: the option is the knob's name after the primitive — grid({ min }) ↔ --layout-grid-min,
pair({ columnGap }) ↔ --layout-pair-column-gap, sidebar({ width }) ↔ --layout-sidebar-width; in knobs(),
with no primitive, the whole name camel-cased: knobs({ sidebarWidth }), knobs({ pairColumnGap }).
Two options are marks, never values: dense and list, true or false, attributes in the sheet.
grid({ repeat }) takes 'auto-fit', 'auto-fill' or a whole number of columns; a fixed count usually
wants min: '0' beside it — grid({ repeat: 2, min: '0' }) is repeat(2, minmax(0, 1fr)), two tracks
that share the width and never overflow, where a keyword repeat wants a real minimum.
pair's row gap is the shared --layout-gap, so data-layout-gap moves it; only its column gap is its own. An option in a block or in layout(defaults) moves the fallback the rule reads;
only knobs() and data-layout-gap set a property. So a knob set from any channel wins whatever the order.
An option key the function does not have is refused by name with the accepted keys; so is a bad value,
in the editor by the types and at the call by the guards assertStep, assertLength, assertKeyword,
assertRepeat and assertName, (fn, option, value) each: "layout: <fn>: <what>; <fix>" — "layout: sidebar: width is
\"wide\", not a CSS length; use one like '20rem'…"; inside layout(defaults) the option is a path, stack.gap. Containment, for the author's own rule: container(name)
declares the container Responsive queries; contain(...) and contentVisibility(size) are static text.
The join reads properties (defines, reads, overrides), attributes (the six data-layout* names,
by option word, LISTABLE naming the primitives data-layout-list is legal on) and KNOBS.

## In a component

The template chooses; a stated change re-renders an attribute and no CSS moves:

    // todo-list-page.template.ts
    html`
      <section class="page" ${styled(todoListStyle, m)}>
        <div class="panes" data-layout="sidebar" data-layout-side="end">
          <ul data-layout=${m.asCards ? 'grid' : 'stack'} data-layout-gap=${m.dense ? '1' : '3'}>
            ${m.rows.map((row) => html`<li data-key=${row.id} data-component=${row.key}></li>`)}
          </ul>
          <aside class="filters">${filters}</aside>
        </div>
      </section>`

    // todo-list-page.style.ts — the styled element is :scope; knobs and container names once per component;
    // a block for a region without an attribute. Each hole sits at statement start: text composed inline.
    export const todoListStyle = new Style<TodoListModel>(() => css`
      :scope { ${container('todo-list')} }
      :scope > .panes { ${knobs({ sidebarWidth: '18rem', sidebarMin: '60%' })} }
      .filters { ${cluster({ gap: '2' })} }
      li { ${contentVisibility('3rem')} }
    `);

    // the shell's document style, once: css`${layout()}` — plus `${diagnostics()}` while developing.
    // apply(style, document) adopts the text unwrapped, so the @property rules sit at the top level as they
    // must; layout() never goes in an element scope, where @scope would wrap them. A selector in the
    // author's own rule reads the name from attributes (attributes.gap), never the literal.

## Browser floor

Browser floor: @property (Chrome 85, Safari 16.4, Firefox 128); dvh (Chrome 108, Safari 15.4, Firefox 101);
@container (Chrome 105, Safari 16, Firefox 110). layout() has no nesting. The per-selector blocks nest
(Chrome 120, Safari 17.2, Firefox 117); diagnostics() uses :has() (Chrome 105, Safari 15.4, Firefox 121).
Without @property every knob inherits, and a nested primitive needs its knobs set explicitly.
