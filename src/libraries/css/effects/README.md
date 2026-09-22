# effects

Transitions, fades, attention-getters, elevation and blur as CSS, written on Animation's and Theme's names. Imports the css tag from the templates folder, `vocabulary`, `ident`, `keyframes`, `defaults`, `duration` and `ease` from Animation's index, and `shadowDefaults` and `defaults` from Theme's. An effect is data that reaches the page through the cheapest channel the platform has: the sheet is static text, applied once to the document and never regenerated; everything that changes at runtime changes through one of three channels, and no text-changing css hole ever carries an effect.

## The three channels

    A  one attribute word per effect — `data-fx="lift:hover dim:busy shake elevation-1"` — set by the
       template from the model through fx(spec): fixed word order, so equal specs are byte-equal and
       the morph writes nothing; `null` when nothing survives, so the attribute is omitted. Cost: one
       string build per render, one attribute write on change. `attributes.fx` is the hook's name.
    B  a `--fx-*` knob for a continuous value (dim, blur, rise, speed, colour): a value hole at `:scope`
       in a *.style.ts, bound live as a custom property, or the template's `style=` through
       `declarations()` for a value that moves continuously. Cost: one setProperty on change.
    C  a parity flip inside A for a restartable one-shot: `fx({ shake: m.errorCount })` names `shake`
       on an odd count and `shake-again` on an even one — Animation's twin ident — so the browser
       replays on every arrival. Shake only: flash is a transition on a box the word creates, and
       replays when the word leaves for a render or under `data-key`.

## The state rule

A state is named, never selected: `lift:hover`, `dim:busy`, `blur:disabled`. The
word after the colon is an ARIA or native state the element already carries — the attributes
Semantics emits and the pseudo-classes the platform has — so no data twin is kept in step. The
primary path is the bare word: a state the model carries is said by writing or withholding the word
(`dim: m.saving`); `word:state` is for states the model cannot carry or the platform owns (hover,
focus, open). `states` is the table, `when(...states)` the selector for a rule of your own; `hover`
is `:is(:hover, :focus-visible)`, so keyboard users get what mouse users get. `fade` takes no state:
it IS the hidden/open transition, driven by `[hidden]`, a closed `<dialog>` or a closed `[popover]`.

## The specificity rule

Setup is `:where([data-fx])` at zero, so any author rule wins its transition.
Every effect row is (0,2,0): a steady row is `[data-fx~="dim"][data-fx]` — the attribute twice on
purpose — and a state row `[data-fx~="dim:busy"][aria-busy="true"]`, so an effect beats a one-class
rest rule in a later-adopted scoped sheet on specificity, which the cascade weighs before scope
proximity and order. The test counts it. `rules(effect, { selector, states })` puts the same rows
on the author's selector, setup included, for a rule that is not on data-fx (Semantics' card lift).

## What each word does

`describe(effect)` is the sentence, and every rule group in the sheet opens
with `/* fx:<name> — <sentence> */` so DevTools shows it on the rule. lift, dim, blur, frost and
elevation-n are real motion with nothing else applied; waiting is the one word that is not motion —
`cursor: progress` while the region works, said by the model (`fx({ waiting: m.status === 'running' })`),
with no knob and no transition, because a pointer shape does not animate; fade and flash are transitions under
`@starting-style` and `transition-behavior: allow-discrete`, no keyframe; fade-in, fade-out, pulse
and shake take their ident from Animation's `ident()` and their pace from its `vocabulary`, and are
inert until Animation's keyframeRules() is applied — an unknown animation-name is valid, silent CSS.
A resting shadow on an element that never lifts is Theme's `shadow()` in the author's own declaration,
NOT `elevation(n)`: elevation exists to set the `--fx-shadow`/`--fx-shadow-lifted` pair so a `rules('lift',
…)` beside it has a step to rise to, and on a still element it declares two knobs nothing reads and
promises motion that never comes. lift writes `transform: translateY()`, not `translate`, because Animation's frames write the
individual `translate`, so a hovered card stays lifted while it shakes. elevation-n sets
`--fx-shadow` and `--fx-shadow-lifted` one step up, so `lift` on `elevation-1` rises to
`--shadow-md` by cascade alone. frost on a `<dialog>` frosts its `::backdrop` too; fade on a
`<dialog>` fades the backdrop with it, `overlay` included, so `modal(open)` is all a template needs.
Parity: fx counts arrivals from 1 (odd → base); Animation's timeline `restart` counts from 0, so a
controller sharing one counter passes `n - 1` there.

## Knobs and fallbacks

Nine `--fx-*` knobs, each read as `var(--fx-x, <default>)` where it is used,
none declared on `:root`, none of another engine's declared anywhere: speed, lift-rise, shadow,
shadow-lifted, dim, blur, frost, flash-color, flash-duration. Pace has one owner: a region is
retuned by re-declaring Animation's `--duration-*`/`--ease-*` on a scope, and every duration here is
Animation's `duration()` times `--fx-speed`. Every shadow is `var(--shadow-<s>, <Theme's
shadowDefaults>)`, the accent `var(--color-accent, <Theme's defaults>)`: read through the import,
never copied. `properties` names the nine it defines, the thirteen foreign names it can read, and
no override. Reduced motion needs no rule here — Animation's tokens() zeroes every `--duration-*`,
so every transition collapses and every infinite keyframe stops; until tokens() is applied the
fallbacks are real motion, the one honest gap. `transition()` refuses a duration or ease outside
the guaranteed four, since an undeclared token is a silent 0s. `registrations()` is the only
`@property` here: the five literal-defaulted knobs, typed; sheet() and registrations() are
document-level and the shell applies both to `document`.

## Floor

`@starting-style`, `transition-behavior: allow-discrete` and `overlay`: Chrome 117, Safari
17.5, Firefox 129 (Baseline 2024); below it a fading element still hides and shows, instantly.
`:popover-open` inside `:is()` is forgiving. The effort's floor is Chrome 153. The browser page
`test/browser/css-effects.test.js` proves the `[hidden]` display transition, `@starting-style` on
the fresh `::after` and on `dialog[open]::backdrop`, and `--fx-speed` scaling a computed duration.

## In a component

a *.template.ts imports fx, a *.style.ts imports rules, elevation, transition and
when, both off the effects index; a rule or a declaration goes in at statement start (verbatim
text), a knob in a `:scope` value hole (bound live):

    // document.style.ts — once, after Animation's tokens() and keyframeRules()
    export const documentStyle = new Style(() => css`${tokens()} ${keyframeRules()} ${registrations()} ${sheet()}`);
    // todo-row.template.ts — the words are the runtime; the controller counts errorCount and savedCount
    html`<li data-key=${r.id} data-fx=${fx({ lift: 'hover', dim: m.done, shake: m.errorCount, flash: m.savedCount, elevation: m.renaming ? 2 : 1 })} ${styled(todoRowStyle, m)}>…</li>`
    html`<dialog data-fx="fade frost" ${modal(m.open)}>…</dialog>`
    // a page's working region — the model carries the state, so the bare word says it
    html`<section data-fx=${fx({ waiting: m.status === 'running' })}>…</section>`
    // card.style.ts — an effect on the styled element itself
    export const cardStyle = new Style<CardModel>((m) => css`
      ${rules('lift', { selector: ':scope', states: ['hover'] })}
      :scope { --fx-speed: ${m.calm ? 2 : 1}; ${elevation(m.raised ? 2 : 1, { lift: true })} }
      :scope${when('disabled')} { ${transition(['opacity'])} opacity: 0.5; }
    `);
