# theme

Tokens as custom properties, two palettes, light / dark / system modes, and readers that write `var(--name, <default>)` for a *.style.ts. theme(), scales(), palette() and modes() return a StyleResult (one css call each); themeText(), scalesText(), paletteText() and modesText() are the same CSS as a string. assign() and accent() return data in the shape a scope takes; the author types role and step names, never `--strings`, except to pin one by full name. Options are checked: an unknown key throws naming the accepted keys, and every message is `theme: <fn>: <what>; <fix>`.

## The cascade rule

theme() declares every token once on its selector (':root' by default).
A scope — [data-theme], or any element an author applies palette() or tokens() to —
re-declares tokens for its subtree: custom properties inherit, so the nearest declaring
ancestor wins whatever the selectors' specificity. An element overrides for itself the
same way. Nothing outside this engine reads a token without a fallback — var(--space-4, 1rem) —
which the readers write for you with this engine's default, so a component's sheet renders
before the theme is applied and identically after.

## The mode rule

Every colour token is one declaration, light-dark(<light>, <dark>), and
color-scheme is the switch: ':root { color-scheme: light dark }' is the system's choice, natively,
and data-theme="light" | "dark" on any element sets its subtree; the attribute absent means system.
A token declared once flips per subtree, light inside dark flips back, and data-theme on <html>
beats the ':root' rule at equal specificity because it comes later — test/browser/css-theme.test.js
checks all three in Chrome.
Never @property-register a token: a registered light-dark() computes at :root and stops
flipping on [data-theme] scopes. color-scheme is not only the tokens' switch: it also flips the
UA's form controls, scrollbars and the canvas colour of the subtree it is set on — the intent for
the shell, a surprise for a small data-theme region, whose native controls change with it.

## The binding rule

every engine should know it. var() inside a custom property substitutes
where the property is DECLARED; light-dark() resolves where the token is USED. So a --card-*
built as var(--color-accent) is fixed at :root and does not follow a subtree that re-declares
--color-accent, and a calc(var(--anchor) * n) ramp does not rescale under a subtree that
re-declares its anchor. A token is a leaf: this engine prints every step as a literal and its
sheet contains no var() and no calc(), so a subtree re-declaring one token affects exactly one
token; responsive's per-step clamp() re-declaration is the right shape.

## What this engine guarantees others

No root font-size, ever: rem is the user's. Never
@property on a token, --text-* and --space-* included, so responsive's fluid() re-declaration is a
plain cascade. theme() declares the sixteen scale names (--text-*, --space-*) on ':root' only, so
"the fluid sheet after Theme's" is the whole cascade rule. A theme({ selector }) island is the
author's, who applies fluid({ selector }) to it too. Theme reads no other engine's name.

## Round 4

--stroke-hairline. One border width, because one is in use: every bordered
surface in the sample and in semantics/{card,field-group,toast,toolbar} wrote 1px by hand beside
an already-tokenised color('border'). Write a rule as
border: <stroke('hairline')> solid <color('border')>; no engine writes the literal again. The
group exists so a second step can land when a consumer asks; it ships with one name and no
unexercised sibling.

## Browser floor

light-dark(): Chrome 123, Safari 17.5, Firefox 120 (Baseline May 2024);
oklch() is older. Below the floor a colour token is declared but invalid where it is read, so
that property computes to `unset`: a reader's var() fallback does not apply there, because a
fallback serves only a token that is not declared at all. The fallback's job is the one above —
render before the theme is applied. Wrapping palette() in @supports (color: light-dark(#000, #fff))
would send old browsers to the readers' defaults; not done, the effort's floor is Chrome 153.

## Round 2

one token for one subtree, in a *.style.ts (presentation only). The styled element is
`:scope` or `&` and only those (css-templates): a selector without them matches below the root, so
`.promo-card { }` in this sheet would never match the card.

    // promo-card.style.ts — css and Style come off the framework index; assign, color, defaults, radius,
    // shadow, space and text off ../../../../src/libraries/css/theme/index.ts (no `import … from` here:
    // the seams test reads comments too)
    export const promoCardStyle = new Style<PromoCardModel>((m) => css`
      :scope {
        ${assign({ color: { accent: m.featured ? 'light-dark(oklch(45% 0.2 30), oklch(72% 0.18 30))' : defaults['--color-accent'] } })}
        background: ${color('surface-raised')}; color: ${color('text')};
        padding: ${space(m.dense ? '2' : '4')}; border-radius: ${radius('md')}; box-shadow: ${shadow('sm')};
      }
      :scope h2 { color: ${color('accent')}; font-size: ${text('lg')}; }
    `);
    // promo-card.template.ts:  html`<article class="promo-card" ${styled(promoCardStyle, m)}>…</article>`

assign() at statement start is an object hole: css-templates binds each value live, so the override
follows the model with zero text variants. Keep its keys fixed per call site and branch on the value,
never on which keys exist — a dropped key is a new variant, and an emptied custom property is
valid-and-empty, which var(--x, fallback) does not rescue. The same override as text is
`${tokens({ … })}`, declarations at statement start under the author's own selector. A whole
palette for a region is `${palette('accent', { selector: '.promo' })}` in the document sheet — one block,
both modes. A whole mode for a region is `<aside data-theme="dark">` — no CSS at all. A mode for the
app is the shell's `data-theme=${m.theme ?? nothing}`, where nothing means system; a brand for the app
is `style=${declarations(accent(m.hue))}` on the shell — three properties, no sheet change.

## Delivery

The document sheet is a Style whose rules compose `${theme()}` at statement start, applied
to document once at boot; the styling seam owns the sheet and replaces it in place. Never
`<style>${themeText()}</style>` in an html`` template: the html tag escapes the text's quotes and `>`,
and the morph re-sets it every render.

## What a reader costs

In a css`` value position a reader is a bound value: one attribute write per
reader per render on the styled element, and it resolves at that element, so `:scope h2 { color:
${color('accent')} }` reads the root's --color-accent, not one re-declared between root and h2.
Readers belong on component roots and in the document sheet; per-row shape goes on classes — a row's
`.done { }` under the list's scope costs nothing per render.

## Token or authored

A token is a value two components must agree on and an application may change
per scope at runtime without touching CSS text; it names a role (accent, text-muted, step 4), never
an appearance (blue, grey-200). Everything else is authored: the choice of space('4') is the
component's, the value of --space-4 is the theme's. Derivation inputs — hue, chroma, ratio, base —
are TypeScript options, not custom properties: a reader sees --color-accent: light-dark(oklch(42% 0.12 250), …)
and knows what it is. The one-line test: a candidate token that could only be written as var() over
another token is not a token, it is a reader.
