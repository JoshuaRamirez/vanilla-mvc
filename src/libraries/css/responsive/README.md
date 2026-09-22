# responsive

Breakpoints as one source of truth, media and container queries on them, and fluid type and space. Every export is a constant, a type, or a pure function of its arguments; the engine holds no state and no cache — css-templates keys sheets on text, so determinism is the cache. Rule-emitting functions (the wrappers, block(), fluid()) return a StyleResult from one css`` call and compose at statement start; preludes, width(), fluidValues(), fluidDeclarations() and clampBetween() stay strings or records. It imports css from css-templates and the step names and scale derivation from Theme, nothing else. It defines no custom property and overrides sixteen.

## The bands

                 sm 40rem       md 48rem       lg 64rem       xl 80rem
    ────────────────┼──────────────┼──────────────┼──────────────┼──────────▶ width
    below.md        ◀─────────────┤
    atLeast.md                     ├─────────────────────────────────────────▶
    between('md', 'lg')            ├──────────────┤

## Range syntax

Every band is half-open [from, to): below(x) is `width < x`,
atLeast(x) is `width >= x`, so at every width exactly one of them applies —
no gap, no overlap, no `.02px` epsilon. The constant is in rem (breakpoints.ts
says why); the reader's font-size preference moves every band. between('lg', 'md')
does not compile: Above<'lg'> is 'xl', and completion offers only that.

## The two-line rule

    A component asks its container:  ${inContainer.atLeast.md} { … }
    The shell asks the viewport:      ${media.atLeast.md} { … }

## Media or container

Same verbs, same names, same length, same cost — the recommended path costs
nothing to follow. A component is reused in a sidebar, a main column, a dialog;
what changes at runtime is its container's inline-size, which @container
re-evaluates for free while @media never notices. Layout declares containers
(`container('card')` → `container-type: inline-size; container-name: card;`);
this engine only queries them. A container never measures itself: rules on a
component root that is the container follow the container above it, and rules on
its descendants follow it. Spec behaviour, not a library choice. @scope descends
into @media and @container blocks, so a scoped rule inside a band still matches
only within its scope.

## Channels, costed

    Channel              Form in a css tag                              Cost on a stated change             Use for
    A. Prelude constant  ${media.atLeast.md} { … }                      zero: same text, same sheet;        every band
                         ${inContainer.query('md', 'card')} { … }       the browser re-evaluates width
    B. Bound value       ${media.below.md} { :scope > .aside {          one setProperty on the scope        anything the model decides
       inside a band       display: ${m.aside ? 'block' : 'none'}; } }  element; no sheet touched
    C. Wrapper           ${atLeast('md', css`… ${x} …`)}                as A and B: the inner holes stay    a band as one expression
                                                                        live, the condition is text
    D. Wrapper, string   ${atLeast('md', '.a { … }')}  ${fluidDeclarations()}   the text is the variant key:   static text; document sheets
                                                                        equal is free, changed is a new
                                                                        sheet, 64 variants throw
    Object hole          ${fluidValues({ relativeTo: 'container' })}    sixteen setProperty calls, no sheet a per-instance scale

## A condition is never a model value

A model value never reaches a condition: the records are property access, the
builders take Width and ContainerCondition. A wrapper cannot emit nothing — empty
rules are an empty block — so a band the model decides is
`${m.dense ? atLeast('md', rules) : null}` at statement start.

## Fluid scales

## Fluid scales

`fluid()` re-declares Theme's --text-<step> and --space-<step> with the formula
clamp(min, calc(min + (max − min) * (100vw − from) / (to − from)), max): the
inputs are printed, CSS interpolates, and the value is exactly min at and below
`from`, exactly max at and above `to`. Both ends are Theme's own derivation, run
by Theme — the minimums from its defaults (base 1rem × 1.25^n, unit 0.25rem ×
its multipliers), so at and below `from` the fluid sheet is Theme's sheet byte for
byte; the maximums from base and unit widened by this engine's one literal each
(×1.125 text, ×1.25 space). One growth per scale keeps Theme's hierarchy at every
width. The defaults, from sm (40rem) to xl (80rem); a test checks this table
against fluidValues():

    text (base [1, 1.125] × 1.25^n)     space (unit [0.25, 0.3125] × multiplier)
    step   at sm        at xl           step   at sm        at xl
    xs     0.64rem      0.72rem         0      0            0
    sm     0.8rem       0.9rem          1      0.25rem      0.3125rem
    md     1rem         1.125rem        2      0.5rem       0.625rem
    lg     1.25rem      1.406rem        3      0.75rem      0.9375rem
    xl     1.563rem     1.758rem        4      1rem         1.25rem
    2xl    1.953rem     2.197rem        5      1.5rem       1.875rem
    3xl    2.441rem     2.747rem        6      2rem         2.5rem
                                        7      3rem         3.75rem
                                        8      4rem         5rem

## A theme with its own scale

A theme with its own scale passes the same inputs here as pairs (text.base,
space.unit, text.ratio, space.multipliers); text.sizes and space.sizes override
single minimums, each still growing by base[1] / base[0] or unit[1] / unit[0].

## The cascade rule

The fluid sheet is applied after Theme's, on the same selector
(`:root`); order decides, and no name changes. What that rests on — no root
font-size, never @property on the sixteen names, the names declared on `:root`
only — is Theme's to state, and its README states it; this engine does
not restate it. A `theme({ selector })` island is the author's, who applies
`fluid({ selector })` to it too.

## Round 2, in a component

    // card.style.ts — presentation only. css and Style come off the framework
    // index; atLeast, fluid and inContainer off this folder's index; container off
    // Layout's. (Imports as prose: no import statement is quoted in a comment.)

    export const cardStyle = new Style<CardModel>((m) => css`
      :scope { ${container('card')} display: grid; gap: var(--space-${m.dense ? 2 : 4}, 1rem); }
      ${fluid({ selector: ':scope', relativeTo: 'container', scales: ['text'] })}
      ${atLeast('md', css`:scope > .aside { display: ${m.aside ? 'block' : 'none'}; }`)}
      ${inContainer.query('md', 'card')} { :scope > .body { grid-template-columns: 1fr 1fr; } }
    `);
    // card.template.ts:  html`<article class="card" ${styled(cardStyle, m)}>…</article>`

## Scope

`:scope` is the styled element (css-templates' rule). Rules on `:scope` follow the
container above the card; rules on `:scope > *` follow the card, which is what the
inContainer block measures. Per render: the fluid block's seven values and the
nested band's display are live-bound — setProperty calls at most, no sheet; the
prelude compares equal. The shell writes `${fluid()}` after `${theme()}` in the
document sheet.

## Browser floor

Browser floor: none new. Range syntax (Chrome 104, Safari 16.4, Firefox 63),
@container and cqi (Chrome 105, Safari 16, Firefox 110) are all inside
css-templates' own @scope floor — Chrome 118, Safari 17.4, Firefox 146.
