# semantics

Six composites — card, toolbar, field group, dialog, toast, nav — as data and functions over data. For each: a typed inputs interface, an attributes function returning a frozen record, a function returning the composite's rules as a StyleResult, and the custom properties it defines and reads. Nothing here knows a component, a controller or a model exists; the template computes inputs from model fields at the call site and binds the record name by name.

## The binding rule

A record's keys are the literal attribute names and its values are typed for
the binding position: a `true` key is a constant the author writes bare (`data-card`,
`role="toolbar"`); a `boolean` key binds with `?name=` (present when true); a `string | null`
key binds with `name=` (null leaves the attribute off, as the html tag treats null). So the
by-hand form `<article data-card ?data-card-dense=${m.dense}>` and the record form
`<article data-card ?data-card-dense=${card['data-card-dense']}>` render byte-identical markup:
an author starts by hand and switches to the record with no markup change. Never bind a boolean
key with `=`: the attribute written "false" still matches `[data-card-dense]` (wrong form, below).

A toolbar's, a dialog's and a nav's name is required at the type level (`label` or `labelledBy`):
an unnamed landmark or dialog is a tsc error at the call site. A field's id must be non-empty with
no whitespace, or fieldAttributes throws a RangeError; every attributes function refuses a
non-object or an unknown key with a TypeError naming the key and the accepted keys —
`semantics: <fn>: <what>; <fix>`. The attribute hooks are `attributes`, keyed by option word:
attributes.card is 'data-card'.

## The state rule

A state is the ARIA or native attribute assistive technology already reads —
aria-current or aria-selected, aria-orientation, aria-invalid, disabled, a live region's role —
emitted once, and the sheet selects on that same attribute. There is no data twin to keep in step.
Modifiers with no accessible meaning (density, elevation, alignment, overflow, inline, danger, the
nav's pinned axis) are `data-<composite>-<modifier>` and are always in a record. A default is
absent (null), never "horizontal", "start" or "false"; the base rule is the default.

Two readings that look inconsistent and are not. The toolbar's axis is `aria-orientation`; the
nav's is `data-nav-vertical`, because `aria-orientation` is valid on toolbar, listbox, menu,
tablist and their kin and is not valid on the navigation role. The toast's tone is its role —
`status` polite, `alert` assertive — because urgency is what a reader hears, and a colour word
beside it would be a twin.

## Region markers

`data-field`, `data-field-hint`, `data-field-error`, `data-dialog-confirm`,
`data-toast-notice`, `data-toast-dismiss`, `data-nav-brand`, `data-nav-title` mark parts HTML has
no element for. They are written bare by the author and never appear in a record — which is how
to tell one from a modifier, since both are spelled `data-<composite>-<word>`.

## The complete fragments

every key bound; the test renders these for every input combination.

    const card = cardAttributes({ dense: m.dense, elevation: m.raised ? 2 : 1, selected: m.current, role: null });
    html`<article data-card role=${card.role} ?data-card-dense=${card['data-card-dense']}
      data-card-elevation=${card['data-card-elevation']} aria-selected=${card['aria-selected']} aria-current=${card['aria-current']}>
      <header>…</header> … <footer>…</footer></article>`

    const bar = toolbarAttributes({ label: 'Actions', orientation: 'vertical', align: 'between', overflow: 'scroll' });
    html`<div data-toolbar role="toolbar" aria-label=${bar['aria-label']} aria-labelledby=${bar['aria-labelledby']}
      aria-orientation=${bar['aria-orientation']} data-toolbar-align=${bar['data-toolbar-align']}
      data-toolbar-overflow=${bar['data-toolbar-overflow']}>
      <div role="group" aria-label="Edit">…</div> <hr> …</div>`

    const group = fieldGroupAttributes({ inline: m.wide, disabled: m.saving });
    const title = fieldAttributes({ id: 'title', hint: true, invalid: !!m.errors.title });
    html`<fieldset data-field-group ?data-field-group-inline=${group['data-field-group-inline']} ?disabled=${group.disabled}>
      <legend>Details</legend>
      <div data-field>
        <label for=${title.label.for}>Title</label>
        <input name="title" id=${title.control.id} aria-invalid=${title.control['aria-invalid']} aria-describedby=${title.control['aria-describedby']}>
        <small id=${title.hint.id} data-field-hint>Shown in the list</small>
        ${m.errors.title ? html`<small id=${title.error.id} data-field-error aria-live="polite">${m.errors.title}</small>` : nothing}
      </div>
    </fieldset>`

    const dialog = dialogAttributes({ labelledBy: 'confirm-title', danger: m.danger });
    html`<dialog data-dialog aria-label=${dialog['aria-label']} aria-labelledby=${dialog['aria-labelledby']}
      ?data-dialog-danger=${dialog['data-dialog-danger']} ${modal(m.open)}>
      <h2 id="confirm-title">${m.title}</h2>
      <p>${m.message}</p>
      <footer>
        <button @click=${c.handler('decline')}>${m.cancelLabel}</button>
        <button data-dialog-confirm @click=${c.handler('accept')}>${m.confirmLabel}</button>
      </footer>
    </dialog>`

    const toast = toastAttributes({ tone: m.tone });
    html`<div data-toast role=${toast.role}>
      ${m.visible
        ? html`<p data-toast-notice>
            <span>${m.text}</span>
            ${m.canRetry ? html`<button @click=${c.handler('retry')}>Retry</button>` : nothing}
            <button data-toast-dismiss title="Dismiss" @click=${c.handler('dismiss')}>✕</button>
          </p>`
        : nothing}
    </div>`

    const nav = navAttributes({ label: 'Configuration', vertical: false });
    html`<nav data-nav aria-label=${nav['aria-label']} aria-labelledby=${nav['aria-labelledby']} ?data-nav-vertical=${nav['data-nav-vertical']}>
      <a data-nav-brand href=${m.homeHref}>Claude Code configuration</a>
      ${m.links.map((link) => html`<a href=${link.href} aria-current=${navLinkAttributes({ current: link.active })['aria-current']}>${link.label}</a>`)}
      <span data-nav-title>${m.workspaceName}</span>
    </nav>`

The conditional error render above is the default: aria-describedby names only elements that
exist. An aria-live region announces only if it existed before its text changed, so where the
announcement matters more than the honest describedby, render the element always and toggle
its text — `[data-field-error]:empty { display: none }` hides it while empty:

    <small id=${title.error.id} data-field-error aria-live="polite">${m.errors.title ?? nothing}</small>

The toast is the same shape the other way round: the region is always rendered and the notice
inside it comes and goes, so the live region is in the accessibility tree before the text
arrives, and the empty region is a grid of zero height.

Regions are HTML where HTML has an element — `> header`, `> footer`, `<legend>`, `<label for>`,
`<dialog>`, `[role="group"]`, `hr` or `[role="separator"]`, a heading, a paragraph — and a region
marker where it has none. A region arranges nothing inside itself: that is Layout's
(`<footer data-layout="cluster">`). Static attributes are written literally; only what the model
drives is a hole. Ids derive from one string per field, so the morph sees no change.

## What an author writes

a page of the sample (static attributes literal, states bound):

    const card = cardAttributes({ selected: m.current });
    const bar = toolbarAttributes({ labelledBy: 'memory-file-title', align: 'between' });
    const group = fieldGroupAttributes({ disabled: m.saving });
    const content = fieldAttributes({ id: 'memory-file-content', hint: true, invalid: !!m.errors.content });
    html`
      <article data-card data-card-elevation="2" aria-current=${card['aria-current']}>
        <header><h2 id="memory-file-title">${m.path}</h2></header>
        <div data-toolbar role="toolbar" aria-labelledby=${bar['aria-labelledby']} data-toolbar-align=${bar['data-toolbar-align']}>
          <div role="group" aria-label="Edit">
            <button type="button" ?disabled=${!m.dirty || m.saving} @click=${c.handler('revert')}>Revert</button>
            <button class="primary" ?disabled=${!m.canSave}>${m.saveLabel}</button>
          </div>
          <a href=${m.listHref}>← Memory files</a>
        </div>
        <form ${fill(m.formValues ?? {})} @input=${formValues(c.handler('change'))} @submit=${prevent(formValues(c.handler('save')))}>
          <fieldset data-field-group ?disabled=${group.disabled}>
            <legend>Content</legend>
            <div data-field>
              <label for=${content.label.for}>Markdown</label>
              <textarea id=${content.control.id} name="content" rows="12"
                aria-invalid=${content.control['aria-invalid']} aria-describedby=${content.control['aria-describedby']}></textarea>
              <small id=${content.hint.id} data-field-hint>Saved to the file on disk.</small>
              ${m.errors.content ? html`<small id=${content.error.id} data-field-error aria-live="polite">${m.errors.content}</small>` : nothing}
            </div>
          </fieldset>
        </form>
        <footer>${m.modifiedLabel}</footer>
      </article>`

## The sheets

Each *Rules() returns one StyleResult, built once by one css call on the CSS
templates folder, `===` on every call: the rule text is composed first as a plain string with
Theme's readers (color(), space(), text(), weight(), radius(), shadow()) interpolated, then placed
at statement start, where a string composes verbatim. No reader ever sits in a css value hole: at
document scope a value hole binds on <html> and resolves there, so a scoped [data-theme]
re-declaring --space-4 would never reach a card. Every foreign read is a Theme reader, so its
fallback is Theme's default and lives only in Theme; NAMES lists them. No :root, no @keyframes, no
@property, no --css- name anywhere; because the sheets contain no :root they apply unchanged at an
element scope. Each sheet's :focus-visible ring reads --color-focus; selection uses border-color,
so the two never fight.

Three sheets compose another engine's text, which is that engine declaring wherever it is composed
. The card: Effects' elevation(n) in the base rule and each elevation rule —
--fx-shadow and --fx-shadow-lifted one step up, so the lift tracks data-card-elevation — and
Effects' rules('lift', …) last, so its hover shadow wins the elevation rows at equal specificity.
The nav: Effects' transition on the link colour. The toast: Animation's timeline() on the notice,
every duration a --duration-* token, so prefers-reduced-motion zeroes the entrance through
Animation's own tokens() and no rule here mentions motion.

Two sheets state more than a look. The toast's placement is the composite's: the region
is a block at the end of the flow — no position, no inset, no z-index in the sheet — so a notice
can never cover a page's action row. The nav's axis is its container's: the base rule is a
wrapping row, and two unnamed @container bands (below md it scrolls rather than wraps, from md it
is a column) resolve against the nearest ancestor container. THE AUTHOR DECLARES THAT CONTAINER,
with Layout's container() on the frame around the nav; with none declared neither band matches and
the wrapping row is what draws. A nav pinned with data-nav-vertical is excluded from both bands by
selector, so the record always beats the container and no override is needed.

DELIVERY, round 4: the shell applies ${cardRules()} ${toolbarRules()} ${fieldGroupRules()}
${dialogRules()} ${toastRules()} ${navRules()} at statement start in its document sheet,
after Theme's, Animation's and Effects' sheets — Animation's keyframeRules() must be there or the
toast's entrance names keyframes nobody defined. Templates keep binding attributes exactly as
above. Never through an html text hole: the html tag escapes `>` and `"`, which the selectors use.

## The channels

How a value reaches a composite, cheapest first; this engine writes no code for
any of them. A state or modifier is an attribute from the record, bound per instance. A token is
Theme's: re-declare it on a scope ([data-theme], palette(), assign()) and every composite under
it follows, because every read is plain var() text resolved on the composite. A knob is declared
in the composite's base rule and read without a fallback: to override it, target [data-card] (or
a descendant selector of it) in a *.style.ts, or `style=${declarations({ '--card-padding': … })}`
on the element — an ancestor alone is beaten by the base rule. A width is the container's, and the
author declares it. Effects' --fx-* and Animation's --anim-* knobs are theirs to document.

## Wrong form, write instead

The test asserts no left-hand form appears in a sheet, nor anywhere in this file outside the table:

    | wrong form | write instead |
    |---|---|
    | data-card-selected | aria-current or aria-selected, from the record |
    | data-card-dense="false" | ?data-card-dense=${card['data-card-dense']} |
    | data-toolbar-orientation | aria-orientation, from the record |
    | data-field-invalid | aria-invalid on the control, from the record |
    | data-field-group-disabled | ?disabled on the fieldset |
    | class="active" | aria-current="page", from navLinkAttributes |
    | data-toast-tone | role="status" or role="alert", from toastAttributes |

## The knobs

One row per name in `properties.defines`; the default is the base rule's declaration verbatim, a Theme
reader standing for the text it returns (the test resolves the reader through Theme and checks
each row against its sheet):

    | knob | default | what it drives |
    |---|---|---|
    | --card-padding | space('4') | the card's padding; dense reassigns to --space-2 |
    | --card-gap | space('3') | the gap between header, content and footer; dense reassigns to --space-1 |
    | --card-shadow | var(--fx-shadow, shadow('sm')) | the card's resting box-shadow; follows Effects' --fx-shadow, which elevation 0, 2 and 3 set |
    | --toolbar-gap | space('3') | the gap between controls and groups (inside a group it is --space-1) |
    | --toolbar-padding | space('2') | the toolbar's padding |
    | --field-gap | space('3') | the gap between fields in a group |
    | --field-label-width | 10rem | the label column of an inline group |
    | --field-columns | 1fr | each [data-field]'s grid-template-columns; inline reassigns to `var(--field-label-width) 1fr` |
    | --field-message-column | auto | the grid column the hint and the error occupy; inline reassigns to 2 |
    | --dialog-padding | space('5') | the dialog's padding |
    | --dialog-gap | space('4') | the gap between the question, its explanation and the answers |
    | --dialog-inline-size | 24rem | the dialog's max-inline-size |
    | --toast-gap | space('2') | the gap between notices, and between one notice's parts |
    | --toast-padding | space('3') space('4') | a notice's padding |
    | --nav-gap | space('3') | the gap between the nav's items |
    | --nav-padding | space('3') space('5') | the nav's padding |

`check(el)` — a runtime lint of a rendered composite — is deferred.
