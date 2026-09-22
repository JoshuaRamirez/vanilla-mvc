import { assert, fixture, test } from './harness.js';
import { apply, css, declarations, release } from '/dist/libraries/css/templates/index.js';
import { Style, Template, defaultAdapters, html, styled, useAdapters } from '/dist/framework/index.js';

const RED = 'rgb(255, 0, 0)';
const BLUE = 'rgb(0, 0, 255)';
const BLACK = 'rgb(0, 0, 0)';
const color = (element) => getComputedStyle(element).color;
const weight = (element) => getComputedStyle(element).fontWeight;
const sheets = () => document.adoptedStyleSheets;
const last = () => sheets()[sheets().length - 1];
/** The seam scopes an HTMLElement; the DOM hands back Element. @param {Element | null} node @returns {HTMLElement} */
const el = (node) => /** @type {HTMLElement} */ (node);
/** A fixture's first child as the scope. @param {string} markup */
const scopeOf = (markup) => el(fixture(markup).firstElementChild);
/** A descendant as an HTMLElement. @param {Element} root @param {string} selector */
const find = (root, selector) => el(root.querySelector(selector));

test('apply into a fixture: the token in data-css, the value on the element as --css-<sheet>-<n>, one CSSScopeRule sheet', () => {
  const scope = scopeOf('<div><p class="one">in</p></div>');
  const before = sheets().length;
  apply(css`.one { color: ${'red'}; }`, scope);
  assert.equal(color(find(scope, '.one')), RED);
  assert.equal(scope.getAttribute('data-css'), 'one');
  assert.equal(scope.style.getPropertyValue('--css-one-0'), 'red');
  assert.equal(sheets().length, before + 1);
  assert.equal(last().cssRules.length, 1);
  assert.ok(last().cssRules[0] instanceof CSSScopeRule, 'the first rule of an element-scope sheet is a CSSScopeRule: the floor');
});

test('rules reach the scope element (:scope, &) and its subtree, and nothing outside whatever they say', () => {
  const host = fixture('<div><p class="two">in</p></div><div><p class="two">out</p></div>');
  const scope = el(host.children[0]);
  const sibling = el(host.children[1]);
  apply(css`:scope { color: ${'red'}; padding: ${'3px'}; } & { font-style: italic; } .two { font-weight: ${700}; } body, .two, :root, html { text-decoration: underline; }`, scope);
  assert.equal(color(scope), RED, ':scope is the root');
  assert.equal(getComputedStyle(scope).paddingTop, '3px');
  assert.equal(getComputedStyle(scope).fontStyle, 'italic', '& is the root');
  assert.equal(weight(find(scope, '.two')), '700');
  assert.equal(weight(find(sibling, '.two')), '400');
  assert.equal(getComputedStyle(find(sibling, '.two')).textDecorationLine, 'none', 'body, :root, html match nothing outside');
  assert.equal(getComputedStyle(document.body).textDecorationLine, 'none');
});

test('with a boundary, rules stop at child components: their views are untouched, the placeholder itself is styleable', () => {
  const scope = scopeOf('<div><p class="three">mine</p><div data-component="child"><p class="three">theirs</p></div></div>');
  apply(css`.three { color: ${'red'}; } [data-component] { padding: ${'5px'}; }`, scope, { boundary: '[data-component] > *' });
  assert.equal(color(find(scope, ':scope > .three')), RED);
  assert.equal(color(find(scope, '[data-component] .three')), BLACK, 'inside the child view');
  assert.equal(getComputedStyle(find(scope, '[data-component]')).paddingTop, '5px');
});

test('an object at the top level is a declaration block on :scope: the element, or :root for the document', () => {
  const scope = scopeOf('<div><p class="top">in</p></div>');
  apply(css`.top { } ${{ color: 'red', padding: '2px' }}`, scope);
  assert.equal(color(scope), RED, 'the styled element itself');
  assert.equal(getComputedStyle(scope).paddingTop, '2px');
  assert.equal(color(find(scope, '.top')), RED, 'inherited below it');
  const x = fixture('<p class="doc-top">anywhere</p>').firstElementChild;
  const before = sheets().length;
  apply(css`${{ '--doc-top-accent': 'blue' }} .doc-top { color: var(--doc-top-accent); }`, document);
  assert.equal(color(x), BLUE, ':scope in a document sheet is :root');
  assert.equal(document.documentElement.style.getPropertyValue('--css-doc-top-0'), 'blue');
  release(document);
  assert.equal(sheets().length, before);
});

test('a bound var() resolves at the scope element, not at the matched descendant', () => {
  const scope = scopeOf('<div style="--tok: red"><p class="res" style="--tok: blue">in</p></div>');
  apply(css`.res { color: ${'var(--tok)'}; }`, scope);
  assert.equal(color(find(scope, '.res')), RED, 'substituted where --css-res-0 is declared: on the scope');
  assert.equal(scope.style.getPropertyValue('--css-res-0'), 'var(--tok)');
});

test('re-apply with a changed value: same element, computed style follows, no new sheet', () => {
  const host = fixture('<div><p class="four">in</p></div>');
  const scope = el(host.firstElementChild);
  const style = (c) => css`.four { color: ${c}; }`;
  apply(style('red'), scope);
  const count = sheets().length;
  apply(style('blue'), scope);
  assert.equal(host.firstElementChild, scope);
  assert.equal(color(find(scope, '.four')), BLUE);
  assert.equal(sheets().length, count);
  assert.equal(scope.getAttribute('data-css'), 'four');
});

test('a no-op re-apply leaves document.adoptedStyleSheets members and order identical', () => {
  const scope = scopeOf('<div><p class="noop">in</p></div>');
  const style = (c) => css`.noop { color: ${c}; }`;
  apply(style('red'), scope);
  const snapshot = [...sheets()];
  apply(style('red'), scope);
  assert.equal(sheets().length, snapshot.length);
  snapshot.forEach((sheet, i) => assert.ok(sheets()[i] === sheet, `sheet ${i} is the same object in the same place`));
  assert.equal(color(find(scope, '.noop')), RED);
});

test('re-apply with a changed selector: one new sheet, the token becomes <id>.1, the old token is gone, a known variant is reused', () => {
  const scope = scopeOf('<div><p class="five a">in</p></div>');
  const style = (cls) => css`.five.${cls} { color: ${'red'}; }`;
  apply(style('a'), scope);
  const count = sheets().length;
  apply(style('b'), scope);
  assert.equal(sheets().length, count + 1);
  assert.equal(scope.getAttribute('data-css'), 'five.1');
  assert.equal(color(find(scope, '.five')), BLACK, 'the old variant no longer applies');
  apply(style('a'), scope);
  assert.equal(sheets().length, count + 1);
  assert.equal(scope.getAttribute('data-css'), 'five');
  assert.equal(color(find(scope, '.five')), RED);
});

test('two sheets on one element: both apply, two tokens, re-applying one leaves the other, release removes both', () => {
  const scope = scopeOf('<div><p class="six sixb">in</p></div>');
  const x = find(scope, '.six');
  const a = (c) => css`.six { color: ${c}; }`;
  const b = (w) => css`.sixb { font-weight: ${w}; }`;
  apply(a('red'), scope);
  apply(b(700), scope);
  assert.deepEqual([color(x), weight(x)], [RED, '700']);
  assert.equal(scope.getAttribute('data-css'), 'six sixb');
  apply(a('blue'), scope);
  assert.deepEqual([color(x), weight(x)], [BLUE, '700']);
  assert.equal(scope.getAttribute('data-css'), 'six sixb');
  assert.equal(scope.style.getPropertyValue('--css-sixb-0'), '700');
  release(scope);
  assert.deepEqual([color(x), weight(x)], [BLACK, '400']);
  assert.equal(scope.hasAttribute('data-css'), false);
});

test('a scope inside a scope: the parent reaches the inner subtree, the child wins the tie by proximity, release(parent) leaves the child styled', () => {
  const outer = scopeOf('<div><p class="t">outer</p><div><p class="t">inner</p></div></div>');
  const inner = find(outer, 'div');
  const [outerT, innerT] = outer.querySelectorAll('.t');
  apply(css`.t { color: ${'red'}; font-style: italic; }`, outer);
  apply(css`.t { color: ${'blue'}; }`, inner);
  assert.equal(color(outerT), RED);
  assert.equal(color(innerT), BLUE, 'the nearer scope wins the tie');
  assert.equal(getComputedStyle(innerT).fontStyle, 'italic', 'the parent reaches inside');
  release(outer);
  assert.equal(color(outerT), BLACK);
  assert.equal(color(innerT), BLUE);
  assert.equal(getComputedStyle(innerT).fontStyle, 'normal');
});

test('what the morph does — strip data-css and style — is undone by the next apply, with no new sheet', () => {
  const scope = scopeOf('<div><p class="seven">in</p></div>');
  const style = (c) => css`.seven { color: ${c}; }`;
  apply(style('red'), scope);
  const count = sheets().length;
  scope.removeAttribute('data-css');
  scope.removeAttribute('style');
  assert.equal(color(find(scope, '.seven')), BLACK);
  apply(style('red'), scope);
  assert.equal(color(find(scope, '.seven')), RED);
  assert.equal(scope.getAttribute('data-css'), 'seven');
  assert.equal(scope.style.getPropertyValue('--css-seven-0'), 'red');
  assert.equal(sheets().length, count);
});

test('release(element): style reverts, attribute and properties gone, the author’s own property kept, sheets stay adopted', () => {
  const scope = scopeOf('<div style="--mine: 1"><p class="eight">in</p></div>');
  apply(css`.eight { color: ${'red'}; }`, scope);
  const count = sheets().length;
  release(scope);
  assert.equal(color(find(scope, '.eight')), BLACK);
  assert.equal(scope.hasAttribute('data-css'), false);
  assert.equal(scope.style.getPropertyValue('--css-eight-0'), '');
  assert.equal(scope.style.getPropertyValue('--mine'), '1');
  assert.equal(sheets().length, count);
  release(scope);
});

test('document scope: unwrapped rules, values on <html>; a changed text replaces the same sheet in place; release un-adopts it', () => {
  const x = fixture('<p class="doc-x">anywhere</p>').firstElementChild;
  const before = sheets().length;
  const theme = (c, bold) => css`:root { --doc-accent: ${c}; } .doc-x { color: var(--doc-accent); } ${bold ? css`.doc-x { font-weight: 700; }` : null}`;
  apply(theme('red', false), document);
  assert.equal(sheets().length, before + 1);
  const sheet = last();
  assert.ok(!(sheet.cssRules[0] instanceof CSSScopeRule), 'unwrapped');
  assert.equal(color(x), RED);
  assert.equal(document.documentElement.style.getPropertyValue('--css-doc-x-0'), 'red');
  assert.equal(document.documentElement.hasAttribute('data-css'), false);
  apply(theme('blue', false), document);
  assert.equal(color(x), BLUE);
  apply(theme('blue', true), document);
  assert.equal(weight(x), '700');
  assert.equal(sheets().length, before + 1);
  assert.ok(last() === sheet, 'the same sheet object, replaced in place');
  release(document);
  assert.equal(sheets().length, before);
  assert.equal(color(x), BLACK);
  assert.equal(document.documentElement.style.getPropertyValue('--css-doc-x-0'), '');
});

test('a scoped rule beats a global rule of equal specificity by order; @keyframes inside the wrapper parses', () => {
  const host = fixture('<style>.thirteen { color: red }</style><div><p class="thirteen">in</p></div>');
  const scope = find(host, 'div');
  assert.equal(color(find(scope, '.thirteen')), RED);
  apply(css`.thirteen { color: ${'blue'}; } @keyframes thirteen-spin { to { transform: rotate(1turn) } }`, scope);
  assert.equal(color(find(scope, '.thirteen')), BLUE);
  const wrapper = /** @type {CSSScopeRule} */ (last().cssRules[0]);
  assert.ok([...wrapper.cssRules].some((rule) => rule instanceof CSSKeyframesRule), '@keyframes lives inside the scope rule');
});

test('through the framework: styled on a template root survives the morph and follows the model', () => {
  useAdapters(defaultAdapters());
  const host = scopeOf('<div></div>');
  const style = new Style((m) => css`.ten { color: ${m.color}; } ${m.bold ? css`.ten { font-weight: 700; }` : null}`);
  const template = new Template((m) => html`<article ${styled(style, m)}><p class="ten">${m.label}</p></article>`);
  const count = sheets().length;
  const view = template.render({ color: 'red', bold: false, label: 'one' }, {}, host);
  const x = find(view, '.ten');
  assert.equal(color(x), RED);
  assert.equal(view.getAttribute('data-css'), 'ten');
  const again = template.render({ color: 'blue', bold: true, label: 'two' }, {}, host);
  assert.ok(again === view, 'the same root element');
  assert.equal(x.textContent, 'two');
  assert.equal(color(x), BLUE);
  assert.equal(weight(x), '700');
  assert.equal(view.getAttribute('data-css'), 'ten.1');
  assert.equal(sheets().length, count + 2);
});

test('a per-instance value rides the template’s style attribute through declarations() beside a bound value', () => {
  useAdapters(defaultAdapters());
  const host = scopeOf('<div></div>');
  const style = new Style((m) => css`.fourteen { width: calc(var(--p) * 1px); color: ${m.color}; }`);
  const template = new Template((m) => html`<div style=${declarations({ '--p': m.p })} ${styled(style, m)}><div class="fourteen"></div></div>`);
  const view = template.render({ p: 40, color: 'red' }, {}, host);
  const bar = find(view, '.fourteen');
  assert.deepEqual([getComputedStyle(bar).width, color(bar)], ['40px', RED]);
  template.render({ p: 60, color: 'blue' }, {}, host);
  assert.deepEqual([getComputedStyle(bar).width, color(bar)], ['60px', BLUE]);
  assert.equal(view.style.getPropertyValue('--p'), '60');
});

// The value-only path of "through the framework: styled on a template root…" above, which also changes the rule set.
test('through the framework, a value-only model change: computed value follows, same root, same adopted sheet object, token unchanged', () => {
  useAdapters(defaultAdapters());
  const host = scopeOf('<div></div>');
  const style = new Style((m) => css`:scope { inline-size: 200px; } .fifteen { inline-size: calc(${m.ratio} * 100%); }`);
  const template = new Template((m) => html`<div ${styled(style, m)}><div class="fifteen"></div></div>`);
  const view = template.render({ ratio: 0.25 }, {}, host);
  const bar = find(view, '.fifteen');
  const sheet = [...sheets()].find((s) => s.cssRules[0] instanceof CSSScopeRule && s.cssRules[0].cssText.includes('fifteen'));
  assert.ok(sheet, 'the element-scope sheet for .fifteen is adopted');
  const before = [...sheets()];
  assert.equal(getComputedStyle(bar).inlineSize, '50px');
  assert.equal(view.getAttribute('data-css'), 'fifteen');
  assert.equal(view.style.getPropertyValue('--css-fifteen-0'), '0.25');
  const again = template.render({ ratio: 0.75 }, {}, host);
  assert.ok(again === view, 'the same root element');
  assert.ok(find(view, '.fifteen') === bar, 'the same bar element');
  assert.equal(getComputedStyle(bar).inlineSize, '150px', 'the computed value follows');
  assert.equal(view.style.getPropertyValue('--css-fifteen-0'), '0.75');
  assert.equal(view.getAttribute('data-css'), 'fifteen', 'the token is unchanged');
  assert.ok(sheets().includes(sheet), 'the same CSSStyleSheet object is still adopted');
  assert.equal(sheets().length, before.length);
  before.forEach((s, i) => assert.ok(sheets()[i] === s, `adopted sheet ${i} is the same object in the same place`));
});

// The read-back README § Binding a value from the model hands to a B front, run verbatim: the sheet
// name comes from data-css and the bound properties are found by prefix, so no test hard-codes a name.
test('the documented read-back: :scope.<class> names the sheet, data-css gives the name, --css-<sheet>-<n> holds the value', () => {
  useAdapters(defaultAdapters());
  const host = scopeOf('<div></div>');
  const style = new Style((m) => css`:scope.meter { display: block; inline-size: 200px; } .bar { inline-size: calc(${m.share} * 100%); }`);
  const template = new Template((m) => html`<div class="meter" ${styled(style, m)}><div class="bar"></div></div>`);
  const view = template.render({ share: 0.25 }, {}, host);
  const bar = find(view, '.bar');
  assert.equal(getComputedStyle(bar).inlineSize, '50px');
  template.render({ share: 0.75 }, {}, host);
  assert.equal(getComputedStyle(bar).inlineSize, '150px', 'the computed style of the element the rule targets: the assertion that needs no name');
  const sheet = view.dataset.css.split('.')[0];
  assert.equal(sheet, 'meter', "the scope's own class names the sheet");
  const bound = [...view.style].filter((p) => p.startsWith(`--css-${sheet}-`)).map((p) => [p, view.style.getPropertyValue(p)]);
  assert.ok(bound.some(([, value]) => value === '0.75'), `the share crossed the seam: ${JSON.stringify(bound)}`);
});
