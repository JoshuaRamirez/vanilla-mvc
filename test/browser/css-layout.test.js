import { assert, fixture, test } from './harness.js';
import { apply, css, release } from '/dist/libraries/css/templates/index.js';
import { attributes, grid, knobs, layout, LISTABLE, pair, properties } from '/dist/libraries/css/layout/index.js';

// The runtime claims the node test cannot make: a registered knob does not inherit into a nested
// primitive, the sidebar wraps at its threshold, and a knob on the element beats a block's fallback.

/** A fixture's root as the HTMLElement apply() takes. @param {string} html */
const scopeOf = (html) => /** @type {HTMLElement} */ (fixture(html).firstElementChild);
/** A descendant as an HTMLElement. @param {Element} root @param {string} selector */
const find = (root, selector) => /** @type {HTMLElement} */ (root.querySelector(selector));
const computed = (/** @type {Element} */ element) => getComputedStyle(element);

test('layout() adopted on the document: every knob is a CSSPropertyRule, inherits false, so a nested primitive keeps its own fallback', () => {
  const before = document.adoptedStyleSheets.length;
  apply(css`${layout()}`, document);
  const sheet = document.adoptedStyleSheets[document.adoptedStyleSheets.length - 1];
  const registered = [...sheet.cssRules].filter((rule) => rule instanceof CSSPropertyRule).map((rule) => /** @type {CSSPropertyRule} */ (rule));
  assert.equal(registered.length, 9, 'nine knobs registered');
  for (const rule of registered) {
    assert.ok(properties.defines.includes(rule.name), rule.name);
    assert.equal(rule.inherits, false, `${rule.name} inherits`);
  }
  const outer = scopeOf(`<div ${attributes.layout}="stack" style="--layout-gap: 7px"><div ${attributes.layout}="stack"><p>a</p><p>b</p></div><p>c</p></div>`);
  const inner = find(outer, `[${attributes.layout}="stack"]`);
  assert.equal(computed(outer).rowGap, '7px', 'the knob on the element reaches its own rule');
  assert.equal(computed(inner).getPropertyValue('--layout-gap'), '', 'and no descendant');
  assert.equal(computed(inner).rowGap, '16px', "the nested stack reads its fallback, var(--space-4, 1rem)");
  release(document);
  assert.equal(document.adoptedStyleSheets.length, before);
});

test('sidebar: side and main share a row above (width + gap) / (1 - min); below it the side stacks over the main', () => {
  apply(css`${layout()}`, document);
  const frame = (/** @type {number} */ width) =>
    scopeOf(`<div ${attributes.layout}="sidebar" ${attributes.gap}="0" style="width: ${width}px; ${knobs({ sidebarWidth: '100px', sidebarMin: '50%' })}"><div class="side">side</div><div class="main">main</div></div>`);
  const top = (/** @type {Element} */ root, /** @type {string} */ selector) => find(root, selector).getBoundingClientRect().top;
  const wide = frame(400);
  assert.equal(top(wide, '.side'), top(wide, '.main'), 'at 400px the threshold (200px) is met: one row');
  assert.ok(find(wide, '.main').getBoundingClientRect().width >= 200, 'the main keeps its minimum');
  const narrow = frame(150);
  assert.ok(top(narrow, '.main') > top(narrow, '.side'), 'at 150px the main cannot keep 50%: it wraps under the side');
  assert.equal(find(narrow, '.side').getBoundingClientRect().width, 150, 'the side grows to the full row');
  release(document);
});

test("a knob set on the element beats a per-selector block's option: the option only moved the fallback", () => {
  const scope = scopeOf(`<div><div class="g" style="${knobs({ gap: '0', gridMin: '50px' })}"><i></i><i></i><i></i><i></i></div><div class="g" style="${knobs({ gap: '0' })}"><i></i><i></i></div></div>`);
  scope.style.width = '200px';
  apply(css`.g { ${grid({ min: '20rem' })} }`, scope);
  const [knobbed, plain] = [...scope.children];
  assert.equal(computed(knobbed).display, 'grid');
  assert.equal(computed(knobbed).gridTemplateColumns, '50px 50px 50px 50px', 'the element’s --layout-grid-min: 50px wins over the block’s 20rem');
  assert.equal(computed(plain).gridTemplateColumns, '200px', 'without the knob the block’s 20rem, capped at 100%, is one column');
  release(scope);
});

// The round-4 landings. Each is a claim about what the browser computes, which the node
// test — which only reads the text — cannot make.

test('pair: the label track is exactly its widest label, the value track takes the rest, and the rows are tighter than the columns', () => {
  apply(css`${layout()}`, document);
  const scope = scopeOf(
    `<dl ${attributes.layout}="pair" style="width: 300px">` +
      `<dt style="width: 40px">a</dt><dd class="one">1</dd>` +
      `<dt style="width: 60px">bb</dt><dd class="two">2</dd>` +
      `</dl>`,
  );
  // max-content 1fr, with the column gap between: 60 + 12 + 228 = 300.
  assert.equal(computed(scope).gridTemplateColumns, '60px 228px', 'the widest label sizes the first track');
  assert.equal(computed(scope).columnGap, '12px', 'var(--layout-pair-column-gap, var(--space-3, 0.75rem))');
  assert.equal(computed(scope).rowGap, '4px', 'var(--layout-gap, var(--space-1, 0.25rem))');
  // A <dd> is indented 40px by every UA; the child rule is what four application pages wrote by hand.
  assert.equal(computed(find(scope, '.one')).marginInlineStart, '0px');
  release(document);

  // Channel C, the per-selector block, computes to the same thing as channel A, the attribute.
  const block = scopeOf(`<dl style="width: 300px"><dt style="width: 60px">bb</dt><dd>2</dd></dl>`);
  apply(css`:scope { ${pair()} }`, block);
  assert.equal(computed(block).gridTemplateColumns, '60px 228px');
  assert.equal(computed(block).rowGap, '4px');
  release(block);
});

test('data-layout-gap moves a pair’s rows and leaves its columns alone: the row gap is the one shared knob', () => {
  apply(css`${layout()}`, document);
  const scope = scopeOf(`<dl ${attributes.layout}="pair" ${attributes.gap}="0"><dt>a</dt><dd>1</dd></dl>`);
  assert.equal(computed(scope).rowGap, '0px');
  assert.equal(computed(scope).columnGap, '12px', 'the column gap has its own knob and is untouched');
  release(document);
});

test('list: the marker box and the UA indent go, and only on the four primitives that take it', () => {
  apply(css`${layout()}`, document);
  const scope = scopeOf(
    `<div><ul class="plain" ${attributes.layout}="stack"><li>a</li></ul>` +
      `<ul class="listed" ${attributes.layout}="stack" ${attributes.list}><li>a</li></ul>` +
      `<ul class="side" ${attributes.layout}="sidebar" ${attributes.list}><li>a</li><li>b</li></ul></div>`,
  );
  const plain = computed(find(scope, '.plain'));
  assert.equal(plain.paddingInlineStart, '40px', 'the UA indent a list is born with');
  assert.equal(plain.listStyleType, 'disc');
  const listed = computed(find(scope, '.listed'));
  assert.equal(listed.paddingInlineStart, '0px');
  assert.equal(listed.listStyleType, 'none');
  assert.equal(listed.marginBlockStart, '0px');
  assert.equal(listed.marginBlockEnd, '0px');
  // The word is refused on a sidebar by the option guard; the sheet simply has no rule for it, so the UA wins.
  assert.equal(computed(find(scope, '.side')).paddingInlineStart, '40px', 'data-layout-list is not a sidebar’s word');
  assert.deepEqual([...LISTABLE], ['stack', 'cluster', 'grid', 'pair']);
  release(document);
});

test('grid: a whole-number repeat lays exactly that many tracks where auto-fit would lay one', () => {
  // auto-fit collapses a track with no item in it, so both grids get one.
  const scope = scopeOf(`<div><div class="fixed"><i></i></div><div class="fit"><i></i></div></div>`);
  scope.style.width = '200px';
  apply(
    css`
      .fixed { ${grid({ repeat: 2, min: '0', gap: '0' })} }
      .fit { ${grid({ min: '20rem', gap: '0' })} }
    `,
    scope,
  );
  assert.equal(computed(find(scope, '.fixed')).gridTemplateColumns, '100px 100px', 'two tracks that share 200px and never overflow');
  assert.equal(computed(find(scope, '.fit')).gridTemplateColumns, '200px', 'auto-fit above 20rem, capped at 100%, is one');
  // The count is a knob like any other, so the element wins over the block.
  const knobbed = scopeOf(`<div style="${knobs({ gridRepeat: 4, gap: '0' })}"></div>`);
  apply(css`:scope { ${grid({ repeat: 2, min: '0' })} }`, knobbed);
  knobbed.style.width = '200px';
  assert.equal(computed(knobbed).gridTemplateColumns, '50px 50px 50px 50px', 'the element’s --layout-grid-repeat: 4 beats the block’s 2');
  release(knobbed);
  release(scope);
});
