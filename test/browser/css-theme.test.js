// css-theme in Chrome: the three cascade claims of theme/index.ts's mode rule, color-scheme on a
// subtree, and assign() as a live object hole. Tokens are read through inline var() on probes; each
// expected colour is the palette's own literal, computed on a reference element, so no serialisation
// of oklch() is assumed. The document sheet is released after every test.
import { assert, fixture, test } from './harness.js';
import { apply, css, release } from '/dist/libraries/css/templates/index.js';
import { assign, color, resolvePalette, stroke, theme } from '/dist/libraries/css/theme/index.js';

const { light, dark } = resolvePalette('neutral');
const sheets = () => document.adoptedStyleSheets;
/** @param {Element | null} node @returns {HTMLElement} */
const el = (node) => /** @type {HTMLElement} */ (node);
/** @param {Element} element */
const computed = (element) => getComputedStyle(element);
/** What Chrome computes for a literal colour, on a throwaway element. @param {string} literal */
const reference = (literal) => {
  const probe = el(fixture(`<span style="color: ${literal}">ref</span>`).firstElementChild);
  const value = computed(probe).color;
  probe.remove();
  return value;
};
/** Apply the document sheet, run, release it and clear <html>'s data-theme, whatever happens. @param {() => void} body */
const withTheme = (body) => {
  apply(theme(), document);
  try {
    body();
  } finally {
    release(document);
    document.documentElement.removeAttribute('data-theme');
  }
};
const PROBE = 'class="probe" style="color: var(--color-text); background-color: var(--color-surface)"';

test('css-theme: a [data-theme="dark"] subtree flips its computed colours; a nested [data-theme="light"] flips back', () => {
  withTheme(() => {
    const host = fixture(`<div data-theme="light"><p ${PROBE}>light</p><section data-theme="dark"><p ${PROBE}>dark</p><div data-theme="light"><p ${PROBE}>back</p></div></section></div>`);
    const [outer, inner, back] = [...host.querySelectorAll('.probe')];
    assert.equal(computed(outer).color, reference(light.text), 'light subtree: light text');
    assert.equal(computed(inner).color, reference(dark.text), 'dark subtree: dark text');
    assert.equal(computed(inner).backgroundColor, (() => {
      const probe = el(fixture(`<span style="background-color: ${dark.surface}">ref</span>`).firstElementChild);
      return computed(probe).backgroundColor;
    })(), 'dark subtree: dark surface');
    assert.equal(computed(back).color, reference(light.text), 'light inside dark flips back');
    assert.ok(computed(outer).color !== computed(inner).color, 'one token, two colours');
  });
});

test('css-theme: color-scheme is set on the subtree and inherited below it', () => {
  withTheme(() => {
    const host = fixture('<section data-theme="dark"><p class="child">c</p><div data-theme="light"><p class="grand">g</p></div></section>');
    assert.equal(computed(el(host.firstElementChild)).colorScheme, 'dark');
    assert.equal(computed(el(host.querySelector('.child'))).colorScheme, 'dark', 'inherited');
    assert.equal(computed(el(host.querySelector('[data-theme="light"]'))).colorScheme, 'light');
    assert.equal(computed(el(host.querySelector('.grand'))).colorScheme, 'light');
    assert.equal(computed(document.documentElement).colorScheme, 'light dark', ':root is the system, natively');
  });
});

test('css-theme: data-theme on <html> beats the system scheme — dark and light both win over :root { color-scheme: light dark }', () => {
  withTheme(() => {
    const host = fixture(`<p ${PROBE}>page</p>`);
    const probe = el(host.firstElementChild);
    for (const [mode, roles] of /** @type {const} */ ([['dark', dark], ['light', light]])) {
      document.documentElement.setAttribute('data-theme', mode);
      assert.equal(computed(document.documentElement).colorScheme, mode, `html is ${mode}`);
      assert.equal(computed(probe).color, reference(roles.text), `${mode} text on the page`);
    }
  });
});

test('css-theme: an assign() object hole on :scope re-declares --color-accent for the subtree, live, with no new variant', () => {
  withTheme(() => {
    const host = fixture('<div class="themed-card"><p class="accented">in</p></div><p class="outside" style="color: var(--color-accent)">out</p>');
    host.setAttribute('data-theme', 'light');
    const scope = el(host.firstElementChild);
    const style = (/** @type {string} */ hue) => css`:scope { ${assign({ color: { accent: hue } })} } .accented { color: var(--color-accent); }`;
    apply(style('rgb(255, 0, 0)'), scope);
    const count = sheets().length;
    const token = scope.getAttribute('data-css');
    assert.equal(computed(el(host.querySelector('.accented'))).color, 'rgb(255, 0, 0)');
    apply(style('rgb(0, 0, 255)'), scope);
    assert.equal(computed(el(host.querySelector('.accented'))).color, 'rgb(0, 0, 255)', 'the value followed');
    assert.equal(sheets().length, count, 'no new sheet');
    assert.equal(scope.getAttribute('data-css'), token, 'no new variant');
    assert.equal(computed(el(host.querySelector('.outside'))).color, reference(light.accent), 'outside the subtree: the theme\'s accent');
    release(scope);
  });
});

test('css-theme: --stroke-hairline computes as a real border width, and a subtree re-declaring it wins (never @property-registered)', () => {
  withTheme(() => {
    const host = fixture('<div class="stroked"><p class="rule">a</p><div class="thicker"><p class="rule">b</p></div></div>');
    const scope = el(host.firstElementChild);
    // The readers go in as CSS text at statement start, not as value holes: a bound value resolves at
    // the SCOPE element, so a hole would read the root's token for both probes and prove nothing.
    const rules = `:scope .rule { border-block-start: ${stroke('hairline')} solid ${color('border')}; } :scope .thicker { --stroke-hairline: 3px; }`;
    apply(css`${rules}`, scope);
    const [outer, inner] = [...host.querySelectorAll('.rule')];
    assert.equal(computed(el(outer)).borderTopStyle, 'solid');
    assert.equal(computed(el(outer)).borderTopWidth, '1px', "the theme's hairline reaches the element");
    assert.equal(computed(el(inner)).borderTopWidth, '3px', 'a subtree re-declares the token: a plain inherited custom property');
    release(scope);
  });
});
