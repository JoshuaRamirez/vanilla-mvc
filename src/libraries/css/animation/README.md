# animation

Timing tokens, keyframes, stagger and timelines. Imports the `css` tag out of templates/ and nothing else. Everything the orders ask for already exists in CSS; this is a typed surface that emits exactly that text and nothing else. The one mechanism added is one inherited integer property, `--anim-index`, so stagger and multi-step timelines compose on one element.

## Rules

Each is a StyleResult built by one css call, composing at statement start:

    tokens()        `:root { --duration-*; --ease-*; --stagger; --anim-index; --anim-distance; --anim-scale }` plus
                    one `@media (prefers-reduced-motion: reduce)` block zeroing every --duration-* (the author's
                    extras too) and --stagger: every reader of a duration respects it with no rule of its own, and
                    infinite keyframes stop (a zero iteration duration is a zero active duration, whatever the
                    count). `tokens({ selector: '.scope' })` puts both blocks on that selector.
    keyframeRules() two `@keyframes` per `vocabulary` entry — anim-<name> and its anim-<name>-again twin, so any
                    keyframe can be restarted by a name flip; the only emitter of `@keyframes` here. Entrances are from-only, so `fill: both` pins nothing
                    over the element's own cascade; fade-out and scale-out are the to-only exits; any entrance
                    reversed (`direction: 'reverse'`) is one too. Frames write translate/scale/rotate, never
                    transform. Distance and scale are read per element from --anim-* with the keyframe's own
                    fallback. `@keyframes` are global names: document level. Flash is Effects' transition.
    timeline(t, s?) the whole rule, `[data-anim="<name>"] { animation: …; }` (attributes.anim) or on the selector given.
    stagger({ selector, count })   `:nth-child` rungs setting --anim-index 0..count-1; later siblings share the last.
    The shell applies `css\`${tokens()} ${keyframeRules()}\`` to document; the rest sit in a component's Style.

## Values

Strings, for a rule the author writes:

    animation(t)    the `animation` shorthand value, one entry per step, seven fields in canonical order:
                    `anim-<name> var(--duration-<d>, <ms>) var(--ease-<e>, <keyword>) <delay> <count> <direction> <fill>`.
                    Every token is `var(--x, default)`, so the value works before tokens() is applied. Every delay
                    is `calc(min(var(--anim-index, 0), <cap>) * var(--stagger, 40ms) + …)`: set --anim-index on an
                    element by any means and its whole timeline shifts; a hand-set index waits at most `cap` steps
                    (Timeline.cap, default 10 — match your stagger() count). A step is a keyframe name, or
                    `{ keyframe, duration, ease, delay, after, iterations, direction, fill, restart }`; omitted
                    fields come from the keyframe's `vocabulary` entry; any other field is refused by name.
                    `after: 'previous'` adds the previous end. `restart: n` flips the step between anim-<name>
                    and anim-<name>-again by parity, on any keyframe: a controller re-triggers by counting, and
                    an element that stays in the DOM plays its entrance again (a toast whose message changed).
    animate(k, o)   one step: animate('spin') is animation(['spin']).
    total(t)        a CSS <time>: `calc(origin + end)`, or `max(…)` of parallel ends. For a transition-delay or
                    another element's delay; reduced motion and stagger apply to it for free.
    duration(t), ease(t), ident(name, again?)   the var() reads and the ident, for Effects and hand-written CSS.
    attributes.anim the hook timeline() selects on; a consumer reads the export, never the literal.
    properties      every --name declared (defines, 12); reads and overrides are empty.

Rules:

    - Compile a fixed timeline at module top level, never inside a Style function: a render pass should be a
      string compare. A step fed by the model (`restart`) is compiled in the Style and is one short string.
    - Never wrap a compiled value in a custom property declared above the animated element: a custom property's
      var()s substitute where it is declared, freezing the tokens and the index there. With the css tag
      a string in a declaration value IS such a property, bound on the scope element; so anything staggered or
      retuned below the scope goes in as `${timeline(t, selector)}` at statement start, a whole rule.
      `animation: ${animation(t)}` is right only when the animated element is the scope element itself.
    - Every throw is `animation: <function>: <what>; <fix>`; a bad option fails at compile, not in DevTools.

## In a component

Round 2, with the css tag:

    // document.style.ts — once, at the document
    export const motionStyle = new Style(() => css`${tokens()} ${keyframeRules()}`);
    // todo-list.style.ts — a presentation file may reach stagger, timeline, timelines and Timeline through this
    // engine index (the seams test allows it); fixed timelines at module top level; rules at statement start
    const rowEnter: Timeline = { name: 'row-enter', steps: ['fade-in', 'slide-up'], cap: 12 };
    export const todoListStyle = new Style<TodoListModel>((m) => css`
      :scope { --stagger: ${m.dense ? '20ms' : '40ms'}; --anim-distance: 0.5rem; }
      ${timeline(rowEnter, '.rows > li')}
      ${stagger({ selector: '.rows > li', count: 12 })}
      ${timeline({ name: 'row-error', steps: [{ keyframe: 'shake', restart: m.errorCount }] }, '.rows > li.error')}
    `);
    // todo-list.template.ts — nothing animation-specific: a keyed row the morph creates plays its entrance
    html`<ul class="rows" ${styled(todoListStyle, m)}>${m.rows.map((r) => html`<li data-key=${r.id}>…</li>`)}</ul>`
    // a list past the ladder: html`<li data-key=${r.id} style=${declarations({ '--anim-index': i })}>`

## Stagger and timeline together

Round 4 — the two calls this engine is built for, proven in test/browser/css-animation.test.js:

    // a composite's entrance (Semantics' toast): a region at the end of the shell's
    // flow, never a layer. Nothing here positions, so the entrance holds wherever the region sits.
    const toastEnter: Timeline = { name: 'toast-enter', steps: ['fade-in', 'slide-up'] };
    const sheet = css`${own}\n${timeline(toastEnter, '[data-toast]')}`;          // in the composite's own sheet
    // the same entrance replayed per message, where the element is morphed in place rather than
    // re-inserted: the count is the model's, and the flip is what the browser replays on.
    timeline({ name: 'toast-enter', steps: [{ keyframe: 'fade-in', restart: m.messageCount }] }, '[data-toast]')

    // a list's rows entering: the ladder sets the index, the timeline reads it in every delay.
    const rowEnter: Timeline = { name: 'row-enter', steps: ['fade-in', 'slide-up'], cap: 12 };
    ${timeline(rowEnter, '.memory-list > li')}
    ${stagger({ selector: '.memory-list > li', count: 12 })}
    // :nth-child counts within each parent, so a page of grouped lists staggers each group from 0.
