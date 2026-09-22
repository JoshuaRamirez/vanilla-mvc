import { suite, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as engine from '../dist/libraries/css/layout/index.js';
import {
  attributes,
  cluster,
  contain,
  container,
  contentVisibility,
  cover,
  DEFAULTS,
  diagnostics as diagnosticsSheet,
  fallbacks,
  faults,
  grid,
  knobs,
  KNOBS,
  layout as layoutSheet,
  LIST,
  LISTABLE,
  pair,
  primitives,
  properties,
  registrations,
  sidebar,
  space,
  stack,
  stepRules,
  steps,
} from '../dist/libraries/css/layout/index.js';
import { serialize, StyleResult } from '../dist/libraries/css/templates/index.js';
import { scaleValues } from '../dist/libraries/css/theme/index.js';

// layout() and diagnostics() return a StyleResult from one css call; the assertions read its text
// as the tag composes it. The raw sheet functions stay reachable as layoutSheet and diagnosticsSheet.
/** @param {Parameters<typeof layoutSheet>[0]} [defaults] @returns {string} */
const layout = (defaults) => serialize(layoutSheet(defaults)).text;
/** @returns {string} */
const diagnostics = () => serialize(diagnosticsSheet()).text;

// tsc refuses a bad step, length or keyword first; these tests reach the runtime guards the way a JS caller would.
const js = /** @type {any} */ ({ cluster, contain, container, contentVisibility, cover, grid, knobs, layout: layoutSheet, pair, sidebar, space, stack });

// Every primitive function with every option set, both sides of every modifier.
const blocks = () => [
  stack({ gap: '1', align: 'center' }),
  cluster({ gap: '1', align: 'baseline', justify: 'space-between' }),
  grid({ gap: '1', min: '12rem', repeat: 'auto-fill', dense: true }),
  grid({ repeat: 2, min: '0', list: true }),
  grid({ min: '0' }),
  pair({ gap: '1', columnGap: '4', list: true }),
  sidebar({ gap: '1', width: '18rem', min: '60%', side: 'end', align: 'start' }),
  cover({ gap: '1', min: '80svh' }),
  stack({ list: true }),
  cluster({ list: true }),
  stack(),
  cluster(),
  grid(),
  pair(),
  sidebar(),
  cover(),
];
/** @returns {string[]} */
const every = () => [
  layout(),
  layout({ stack: { gap: '5' } }),
  diagnostics(),
  ...blocks(),
  ...steps.map((step) => stack({ gap: step })),
  knobs({ gap: '2', align: 'end', justify: 'center', gridMin: '10rem', gridRepeat: 'auto-fill', pairColumnGap: '3', sidebarWidth: '20rem', sidebarMin: '40%', coverMin: '50dvh' }),
  knobs({ gridRepeat: 3 }),
  container('pane'),
  container('pane', 'size'),
  contain('layout', 'paint'),
  contain('strict'),
  contentVisibility('3rem'),
];

/**
 * A sheet as { selector, body } pairs in order, by brace depth: an at-rule's prelude is its selector.
 * This engine puts no brace inside a string, so no string state is needed. Refuses unbalanced braces
 * and text outside any rule.
 */
const rulesOf = (sheet) => {
  const rules = [];
  let depth = 0;
  let start = 0;
  let open = 0;
  for (let i = 0; i < sheet.length; i++) {
    if (sheet[i] === '{' && depth++ === 0) open = i;
    else if (sheet[i] === '}' && --depth === 0) {
      rules.push({ selector: sheet.slice(start, open).trim(), body: sheet.slice(open + 1, i).trim() });
      start = i + 1;
    }
    assert.ok(depth >= 0, `a } before its { at ${i}`);
  }
  assert.equal(depth, 0, 'braces balance');
  assert.equal(sheet.slice(start).trim(), '', 'nothing outside a rule');
  return rules;
};
/** The style rules of a sheet (not the at-rules). */
const styleRulesOf = (sheet) => rulesOf(sheet).filter((r) => !r.selector.startsWith('@'));
/** The rules whose selector is exactly the given text, as `selector { body }`. */
const rulesFor = (sheet, selector) => rulesOf(sheet).filter((r) => r.selector === selector).map((r) => `${r.selector} { ${r.body} }`);
/** The comma-separated parts of a selector list, split at paren depth 0. */
const partsOf = (selector) => {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < selector.length; i++) {
    if (selector[i] === '(') depth++;
    else if (selector[i] === ')') depth--;
    else if (selector[i] === ',' && depth === 0) {
      parts.push(selector.slice(start, i).trim());
      start = i + 1;
    }
  }
  return [...parts, selector.slice(start).trim()];
};
/** One :where() group unwrapped to its parts; anything else is its own parts. */
const unwrapped = (selector) => partsOf(selector.startsWith(':where(') && selector.endsWith(')') ? selector.slice(':where('.length, -1) : selector);
/** Ownership, structurally: a part starts at [data-layout, combines only by child, and names no type, class or id. */
const owned = (part) => {
  assert.match(part, /^\[data-layout/, `${part}: a rule starts at the primitive`);
  const bare = part.replace(/\[[^\]]*\]/g, '').replace(/::?[\w-]+(\([^()]*\))?/g, '');
  assert.match(bare, /^[*&]?(\s*>\s*[*&]?)*$/, `${part}: only the child combinator, no type, class or id (left: "${bare}")`);
};
const count = (text, char) => text.split(char).length - 1;

suite('the document sheet', () => {
  test('each of the six primitives has a rule on its data-layout value; the sheet is memoized', () => {
    const sheet = layout();
    for (const p of primitives) assert.equal(rulesFor(sheet, `[data-layout="${p}"]`).length, 1, p);
    assert.equal(layout(), sheet);
    assert.equal(layout({ grid: { min: '20rem' } }), layout({ grid: { min: '20rem' } }));
    assert.notEqual(layout({ grid: { min: '20rem' } }), sheet);
    assert.equal(layoutSheet(), layoutSheet(), 'the same defaults give the same StyleResult');
    assert.equal(layoutSheet({ grid: { min: '20rem' } }), layoutSheet({ grid: { min: '20rem' } }));
  });

  test('layout() and diagnostics() are StyleResults from one css call: the whole text is one hole at statement start', () => {
    for (const result of [layoutSheet(), layoutSheet({ stack: { gap: '5' } }), diagnosticsSheet()]) {
      assert.ok(result instanceof StyleResult);
      assert.deepEqual([...result.strings], ['', '']);
      assert.equal(result.values.length, 1);
      assert.equal(serialize(result).text, result.values[0], 'composed verbatim');
      assert.deepEqual(serialize(result).properties, [], 'nothing bound: document text only');
    }
    assert.equal(diagnosticsSheet(), diagnosticsSheet());
    assert.equal(typeof registrations(), 'string');
    assert.equal(typeof stepRules(), 'string');
  });

  test('ownership: every selector starts at [data-layout, combines only by child, names no type, class or id; child rules are :where()', () => {
    for (const sheet of [layout(), layout({ stack: { gap: '5' } }), layout({ sidebar: { width: '20rem', min: '40%' } })]) {
      const rules = styleRulesOf(sheet);
      assert.ok(rules.length > 20);
      for (const { selector } of rules) {
        for (const part of unwrapped(selector)) {
          owned(part);
          assert.ok(count(part, '>') <= 1, `${selector}: at most one child combinator`);
          if (part.includes('>')) assert.ok(selector.startsWith(':where('), `${selector}: child rules are :where()`);
          else assert.ok(!selector.startsWith(':where('), `${selector}: root rules keep (0,1,0)`);
        }
      }
      for (const { selector, body } of rulesOf(sheet).filter((r) => r.selector.startsWith('@'))) {
        assert.match(selector, /^@property --layout-[\w-]+$/, selector);
        assert.equal(body, "syntax: '*'; inherits: false;");
      }
    }
    for (const { selector } of styleRulesOf(diagnostics())) {
      for (const part of partsOf(selector.replace(/::before$/, ''))) assert.match(part, /^\[data-layout/, `${part}: diagnostics starts at the vocabulary`);
    }
    assert.doesNotThrow(() => owned('[data-layout="stack"] > *'));
    for (const bad of ['[data-layout="stack"] li', '[data-layout="stack"] [data-x]', '[data-layout="stack"] > .row', '[data-layout="stack"] > #x', 'ul[data-layout="stack"]', '.stack']) {
      assert.throws(() => owned(bad), bad);
    }
  });

  test('attributes: the six names by option word; every selector the engine emits is built from them', () => {
    const names = /** @type {readonly string[]} */ (Object.values(attributes));
    assert.deepEqual(names, ['data-layout', 'data-layout-gap', 'data-layout-side', 'data-layout-dense', 'data-layout-list', 'data-layout-principal']);
    assert.equal(attributes.side, 'data-layout-side');
    const everything = [layout(), diagnostics(), ...blocks()].join('\n');
    for (const name of names) assert.ok(everything.includes(`[${name}`), name);
    for (const [, name] of everything.matchAll(/\[(data-layout(?:-[\w-]+)?)(?=[=\]])/g)) {
      assert.ok(names.includes(name) || faults.some((f) => f.selector.includes(`[${name}]`)), `${name} is in the vocabulary or is a named fault`);
    }
  });

  test('registrations: every knob is @property with syntax * and inherits false, no initial value; carriers are set, not registered', () => {
    const sheet = layout();
    const knobsDefined = properties.defines.filter((name) => !/sidebar-(basis|main-min)$/.test(name));
    const carriers = properties.defines.filter((name) => /sidebar-(basis|main-min)$/.test(name));
    assert.equal(knobsDefined.length, 9);
    assert.equal(carriers.length, 2);
    for (const name of knobsDefined) {
      assert.ok(sheet.includes(`@property ${name} { syntax: '*'; inherits: false; }`), name);
      assert.ok(sheet.includes(`var(${name}`), `${name} is read`);
    }
    for (const name of carriers) {
      assert.ok(!sheet.includes(`@property ${name}`), `${name} inherits: unregistered`);
      assert.ok(sheet.includes(`${name}: var(`), `${name} is set from a knob`);
      assert.ok(sheet.includes(`var(${name})`), `${name} is read by a child`);
    }
    assert.equal(registrations(), sheet.split('\n').filter((line) => line.startsWith('@property')).join('\n'));
    assert.ok(!sheet.includes('initial-value'));
    assert.ok(!sheet.includes('&'), 'no nesting in the document sheet');
  });

  test('the sheet never sets a knob: only the nine step rules do', () => {
    const sheet = layout();
    const setters = sheet.split('\n').filter((line) => /--layout-(gap|align|justify|grid-min|grid-repeat|sidebar-width|sidebar-min|cover-min):/.test(line));
    assert.deepEqual(setters, stepRules().split('\n'));
    assert.equal(setters.length, 9);
    for (const step of steps) assert.ok(sheet.includes(`[data-layout-gap="${step}"] { --layout-gap: var(--space-${step}, ${fallbacks[step]}); }`));
  });

  test('properties: reads are --space-0..8 as var(--space-N, fallback); overrides is empty', () => {
    assert.deepEqual(properties.reads, steps.map((s) => `--space-${s}`));
    assert.deepEqual(properties.overrides, []);
    const all = every().join('\n');
    for (const name of properties.reads) assert.match(all, new RegExp(`var\\(${name}, `), name);
    for (const [, name] of all.matchAll(/var\((--space-[\w-]+)/g)) assert.ok(properties.reads.includes(name), name);
  });

  test('per-primitive defaults move one rule\'s fallback and no other', () => {
    const sheet = layout({ stack: { gap: '5' }, cluster: { justify: 'space-between' } });
    const root = (p) => rulesFor(sheet, `[data-layout="${p}"]`)[0];
    assert.ok(root('stack').includes('gap: var(--layout-gap, var(--space-5, 1.5rem))'));
    assert.ok(root('cluster').includes('justify-content: var(--layout-justify, space-between)'));
    for (const p of primitives.filter((p) => p !== 'stack')) assert.ok(!root(p).includes('--space-5'), p);
    assert.ok(root('cluster').includes(`var(--space-${DEFAULTS.cluster.gap}, `), 'cluster keeps its own default gap');
    assert.throws(() => js.layout({ grid: { dense: true } }), /^RangeError: layout: layout: grid\.dense is an attribute, not a default; set data-layout-dense on the element$/);
    assert.throws(() => js.layout({ sidebar: { side: 'end' } }), /layout: layout: sidebar\.side is an attribute, not a default; set data-layout-side/);
    assert.throws(() => js.layout({ stack: { gap: '9' } }), /^RangeError: layout: layout: stack\.gap is "9", not a space step; use '0'\.\.'8'$/);
  });

  test('the cluster defaults to a smaller step than the stack', () => {
    assert.ok(Number(DEFAULTS.cluster.gap) < Number(DEFAULTS.stack.gap));
  });
});

suite('the mathematics', () => {
  const sheet = layout();

  test('stack: a column with the gap as its only rhythm; the principal grows', () => {
    assert.ok(rulesFor(sheet, '[data-layout="stack"]')[0].includes('display: flex; flex-direction: column; gap: var(--layout-gap, var(--space-4, 1rem)); align-items: var(--layout-align, stretch);'));
    assert.ok(sheet.includes(':where([data-layout="stack"] > *) { margin-block: 0; }'));
    assert.ok(sheet.includes(':where([data-layout="stack"] > [data-layout-principal]) { flex-grow: 1; }'));
  });

  test('cluster: a wrapping row reading align and justify', () => {
    assert.ok(rulesFor(sheet, '[data-layout="cluster"]')[0].includes('flex-wrap: wrap; gap: var(--layout-gap, var(--space-2, 0.5rem)); align-items: var(--layout-align, center); justify-content: var(--layout-justify, start);'));
  });

  test('grid: auto-fit above a minimum guarded by min(…, 100%); repeat is a knob; dense is an attribute', () => {
    assert.ok(sheet.includes('grid-template-columns: repeat(var(--layout-grid-repeat, auto-fit), minmax(min(var(--layout-grid-min, 16rem), 100%), 1fr));'));
    assert.ok(sheet.includes('[data-layout="grid"][data-layout-dense] { grid-auto-flow: dense; }'));
    assert.ok(!rulesFor(sheet, '[data-layout="grid"]')[0].includes('grid-auto-flow'));
    assert.ok(grid({ dense: true }).includes('grid-auto-flow: dense;'));
    assert.ok(grid({ repeat: 'auto-fill' }).includes('var(--layout-grid-repeat, auto-fill)'));
  });

  test('sidebar: carriers from the knobs; side grows 1 on its basis, main grows 999 above its minimum; end swaps the roles', () => {
    const root = rulesFor(sheet, '[data-layout="sidebar"]')[0];
    assert.ok(root.includes('--layout-sidebar-basis: var(--layout-sidebar-width, 16rem); --layout-sidebar-main-min: var(--layout-sidebar-min, 50%); display: flex; flex-wrap: wrap;'));
    const side = 'flex-grow: 1; flex-basis: var(--layout-sidebar-basis);';
    const main = 'flex-grow: 999; flex-basis: 0; min-inline-size: var(--layout-sidebar-main-min);';
    assert.ok(sheet.includes(`:where([data-layout="sidebar"] > :first-child) { ${side} }`));
    assert.ok(sheet.includes(`:where([data-layout="sidebar"] > :last-child) { ${main} }`));
    const end = sheet.split('\n').filter((line) => line.includes('[data-layout-side="end"]'));
    assert.deepEqual(end, [
      `:where([data-layout="sidebar"][data-layout-side="end"] > :first-child) { ${main} }`,
      `:where([data-layout="sidebar"][data-layout-side="end"] > :last-child) { ${side} }`,
    ]);
    assert.ok(sheet.indexOf(end[0]) > sheet.indexOf(':where([data-layout="sidebar"] > :last-child)'), 'end rules come later, so they win at equal specificity');
    assert.ok(sidebar({ side: 'end' }).includes(`:where(& > :first-child) { ${main} }`));
    assert.ok(sidebar().includes(`:where(& > :first-child) { ${side} }`));
  });

  test('cover: a full-height column; the principal or an only child is centred by auto margins; no padding', () => {
    const root = rulesFor(sheet, '[data-layout="cover"]')[0];
    assert.ok(root.includes('display: flex; flex-direction: column; gap: var(--layout-gap, var(--space-4, 1rem)); min-block-size: var(--layout-cover-min, 100dvh);'));
    assert.ok(!root.includes('padding'));
    assert.ok(sheet.includes(':where([data-layout="cover"] > *) { margin-block: 0; }'));
    assert.ok(sheet.includes(':where([data-layout="cover"] > [data-layout-principal], [data-layout="cover"] > :only-child) { margin-block: auto; }'));
    assert.ok(cover().includes(':where(& > [data-layout-principal], & > :only-child) { margin-block: auto; }'));
  });
});

suite('steps and knobs', () => {
  test('a step becomes var(--space-<step>, <fallback>); fallbacks ascend from 0', () => {
    for (const step of steps) {
      assert.equal(space(step), `var(--space-${step}, ${fallbacks[step]})`);
      assert.ok(stack({ gap: step }).includes(`gap: var(--layout-gap, var(--space-${step}, ${fallbacks[step]}))`));
    }
    assert.equal(fallbacks['0'], '0');
    assert.deepEqual(fallbacks, scaleValues().space, "read from Theme's default scale, in Theme's own text");
    assert.deepEqual(Object.keys(fallbacks), [...steps]);
    const rem = (v) => (v === '0' ? 0 : Number(v.replace('rem', '')));
    for (let i = 1; i < steps.length; i++) assert.ok(rem(fallbacks[steps[i]]) > rem(fallbacks[steps[i - 1]]), steps[i]);
    assert.throws(() => js.space('9'), /^RangeError: layout: space: step is "9", not a space step; use '0'\.\.'8'$/);
  });

  test('knobs(): declarations only, in one fixed order whatever the key order; {} is empty', () => {
    assert.equal(knobs({}), '');
    assert.equal(knobs({ sidebarWidth: '18rem', gap: '2' }), '--layout-gap: var(--space-2, 0.5rem); --layout-sidebar-width: 18rem;');
    assert.equal(knobs({ gap: '2', sidebarWidth: '18rem' }), knobs({ sidebarWidth: '18rem', gap: '2' }));
    assert.equal(knobs({ gridRepeat: 'auto-fill', gridMin: 'clamp(10rem, 20vw, 16rem)' }), '--layout-grid-min: clamp(10rem, 20vw, 16rem); --layout-grid-repeat: auto-fill;');
  });

  test('an option key a function does not have is refused by name; a typo is never silently ignored', () => {
    assert.throws(() => js.stack({ gaps: '1' }), /^RangeError: layout: stack: no option "gaps"; the options are gap, align, list$/);
    assert.throws(() => js.grid({ min: '1rem', dence: true }), /layout: grid: no option "dence"; the options are gap, min, repeat, dense, list/);
    assert.throws(() => js.pair({ min: '1rem' }), /^RangeError: layout: pair: no option "min"; the options are gap, columnGap, list$/);
    assert.throws(() => js.sidebar({ list: true }), /layout: sidebar: no option "list"; the options are gap, width, min, side, align/);
    assert.throws(() => js.cover({ list: true }), /layout: cover: no option "list"; the options are gap, min/);
    assert.throws(() => js.sidebar({ justify: 'end' }), /layout: sidebar: no option "justify"; the options are gap, width, min, side, align/);
    assert.throws(() => js.cover({ align: 'center' }), /layout: cover: no option "align"/);
    assert.throws(() => js.cluster({ width: '1rem' }), /layout: cluster: no option "width"/);
    assert.throws(() => js.knobs({ width: '1rem' }), /layout: knobs: no option "width"; the options are gap, align, justify, gridMin, gridRepeat, pairColumnGap, sidebarWidth, sidebarMin, coverMin/);
    assert.throws(() => js.layout({ stak: { gap: '1' } }), /layout: layout: no option "stak"; the options are stack, cluster, grid, pair, sidebar, cover/);
    assert.throws(() => js.layout({ stack: { gaps: '1' } }), /^RangeError: layout: layout: no option "stack\.gaps"; the options are gap, align, list$/);
    assert.doesNotThrow(() => js.stack({ gap: undefined }), 'an undefined value on a known key is the default');
  });

  test('every guard names the option and the accepted form', () => {
    assert.throws(() => js.stack({ gap: '9' }), /^RangeError: layout: stack: gap is "9", not a space step; use '0'\.\.'8'$/);
    assert.throws(() => js.knobs({ gap: 9 }), /layout: knobs: gap is 9, not a space step; use '0'\.\.'8'/);
    assert.throws(() => js.sidebar({ width: 'wide' }), /^RangeError: layout: sidebar: width is "wide", not a CSS length; use one like '20rem', '50%' or 'clamp\(…\)'$/);
    assert.throws(() => js.sidebar({ width: '20rem; color: red' }), /layout: sidebar: width is .*, not a CSS length/);
    assert.throws(() => js.sidebar({ width: 'calc(1rem + 2px) } .x { color: red' }), /layout: sidebar: width is .*, not a CSS length/);
    assert.throws(() => js.grid({ min: '20' }), /layout: grid: min is "20", not a CSS length; use one like '20rem'/);
    assert.throws(() => js.cover({ min: 'auto' }), /layout: cover: min is "auto", not a CSS length/);
    assert.throws(() => js.knobs({ sidebarMin: '' }), /layout: knobs: sidebarMin is "", not a CSS length/);
    assert.throws(() => js.cluster({ justify: 'middle' }), /layout: cluster: justify is "middle"; use one of 'start', 'center', 'end', 'space-between', 'space-around', 'space-evenly'/);
    assert.throws(() => js.sidebar({ side: 'left' }), /layout: sidebar: side is "left"; use one of 'start', 'end'/);
    assert.throws(() => js.grid({ dense: 'yes' }), /layout: grid: dense is "yes"; use true or false/);
    assert.throws(() => js.layout({ grid: { min: '20' } }), /^RangeError: layout: layout: grid\.min is "20", not a CSS length/);
    for (const call of [() => js.stack({ gap: '9' }), () => js.knobs({ x: 1 }), () => js.contain(), () => js.container('a b')]) {
      assert.throws(call, /^RangeError: layout: \w+: [^;]+; \S/, 'layout: <fn>: <what>; <fix>');
    }
    for (const value of ['0', '.5rem', '1.5em', '50%', '100dvh', '20cqi', 'var(--x)', 'min(10rem, 100%)', 'clamp(1rem, 2vw, 3rem)', 'calc(100% - 2rem)']) {
      assert.doesNotThrow(() => js.grid({ min: value }), value);
    }
  });
});

suite('the round-4 landings (the consuming application hand-wrote each of these in more than one component)', () => {
  test('pair: two tracks, the row gap on the shared knob, the column gap on its own; the child margin goes', () => {
    assert.equal(
      pair(),
      [
        'display: grid; grid-template-columns: max-content 1fr;' +
          ' row-gap: var(--layout-gap, var(--space-1, 0.25rem));' +
          ' column-gap: var(--layout-pair-column-gap, var(--space-3, 0.75rem));',
        ':where(& > *) { margin: 0; }',
      ].join('\n'),
    );
    // The label track is intrinsic and the value track takes the rest: never two equal columns.
    assert.ok(pair().includes('grid-template-columns: max-content 1fr;'));
    // data-layout-gap moves the rows, because pair's row gap is the one shared --layout-gap.
    assert.ok(layout().includes('[data-layout="pair"] { display: grid;'));
    assert.ok(layout().includes(':where([data-layout="pair"] > *) { margin: 0; }'));
    assert.equal(DEFAULTS.pair.gap, '1');
    assert.equal(DEFAULTS.pair.columnGap, '3');
    assert.ok(pair({ columnGap: '5' }).includes('column-gap: var(--layout-pair-column-gap, var(--space-5, 1.5rem));'));
    assert.ok(
      layout({ pair: { columnGap: '5' } }).includes('column-gap: var(--layout-pair-column-gap, var(--space-5, 1.5rem));'),
      'a default moves the fallback the rule reads',
    );
    assert.ok(!layout({ pair: { columnGap: '5' } }).includes('--layout-pair-column-gap: '), 'a default never sets the knob');
  });

  test('the four primitives a list is laid out with take list; a sidebar and a cover refuse it by name', () => {
    assert.deepEqual(/** @type {readonly string[]} */ (LISTABLE), ['stack', 'cluster', 'grid', 'pair']);
    assert.equal(LIST, 'list-style: none; padding-inline-start: 0; margin-block: 0;');
    // Longhand padding, so an author's padding-inline-end on the same element survives.
    assert.ok(!LIST.includes('padding: '));
    for (const block of [stack, cluster, grid, pair]) {
      assert.ok(block({ list: true }).includes(LIST), block.name);
      assert.ok(!block({ list: false }).includes('list-style'), `${block.name}: false is the default`);
      assert.ok(!block().includes('list-style'), `${block.name}: absent is the default`);
    }
    assert.throws(() => js.sidebar({ list: true }), /layout: sidebar: no option "list"/);
    assert.throws(() => js.cover({ list: true }), /layout: cover: no option "list"/);
    // One sheet rule for the four, at (0,2,0), so it beats the primitive's own root rule.
    assert.ok(
      layout().includes(
        '[data-layout="stack"][data-layout-list], [data-layout="cluster"][data-layout-list], ' +
          '[data-layout="grid"][data-layout-list], [data-layout="pair"][data-layout-list] { ' + LIST + ' }',
      ),
    );
    assert.throws(() => js.layout({ stack: { list: true } }), /layout: layout: stack.list is an attribute, not a default; set data-layout-list on the element/);
    assert.ok(
      diagnostics().includes('[data-layout-list]:not([data-layout="stack"]):not([data-layout="cluster"]):not([data-layout="grid"]):not([data-layout="pair"])::before { content: "layout: data-layout-list belongs on a stack, cluster, grid or pair"; }'),
    );
  });

  test('grid: repeat takes a whole number of columns as well as the two keywords', () => {
    assert.ok(
      grid({ repeat: 2, min: '0' }).includes('grid-template-columns: repeat(var(--layout-grid-repeat, 2), minmax(min(var(--layout-grid-min, 0px), 100%), 1fr));'),
      'repeat(2, minmax(0px, 1fr)): two tracks that share the width and never overflow',
    );
    assert.equal(knobs({ gridRepeat: 3 }), '--layout-grid-repeat: 3;');
    assert.ok(grid({ repeat: 'auto-fill' }).includes('repeat(var(--layout-grid-repeat, auto-fill)'));
    assert.ok(layout({ grid: { repeat: 4 } }).includes('repeat(var(--layout-grid-repeat, 4)'));
    for (const bad of [0, -1, 2.5, '2', 'two', null, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(
        () => js.grid({ repeat: bad }),
        /^RangeError: layout: grid: repeat is .*; use 'auto-fit', 'auto-fill' or a whole number of columns like 2$/,
        String(bad),
      );
      assert.throws(() => js.knobs({ gridRepeat: bad }), /layout: knobs: gridRepeat is .*; use 'auto-fit', 'auto-fill' or a whole number of columns like 2/, String(bad));
    }
  });

  test("a bare '0' length is emitted 0px: inside min(…, 100%) an unitless zero would void the declaration", () => {
    assert.ok(grid({ min: '0' }).includes('minmax(min(var(--layout-grid-min, 0px), 100%), 1fr)'));
    assert.equal(knobs({ gridMin: '0' }), '--layout-grid-min: 0px;');
    assert.equal(knobs({ sidebarWidth: '0' }), '--layout-sidebar-width: 0px;');
    assert.ok(sidebar({ width: '0' }).includes('--layout-sidebar-basis: var(--layout-sidebar-width, 0px);'));
    assert.ok(cover({ min: '0' }).includes('min-block-size: var(--layout-cover-min, 0px);'));
    assert.equal(contentVisibility('0'), 'content-visibility: auto; contain-intrinsic-block-size: auto 0px;');
    // Nothing anywhere emits a unitless zero into a math function.
    for (const text of every()) assert.ok(!/min\(\s*0\s*,/.test(text), text.slice(0, 80));
  });

  test('dense and list are marks: true or false, never a value', () => {
    for (const bad of ['yes', 1, null, {}]) {
      assert.throws(() => js.grid({ dense: bad }), /^RangeError: layout: grid: dense is .*; use true or false$/, String(bad));
      assert.throws(() => js.stack({ list: bad }), /^RangeError: layout: stack: list is .*; use true or false$/, String(bad));
    }
    assert.throws(() => js.layout({ grid: { dense: true } }), /layout: layout: grid.dense is an attribute, not a default/);
  });
});

suite('containment', () => {
  test('container: the longhands the orders name, with the author\'s name; one word only', () => {
    assert.equal(container('todo-list'), 'container-type: inline-size; container-name: todo-list;');
    assert.equal(container('pane', 'size'), 'container-type: size; container-name: pane;');
    for (const bad of ['my card', '1x', 'none', 'default', 'a;b', '']) {
      assert.throws(() => container(bad), /^RangeError: layout: container: name is .*, not a container name; use one word like 'card'$/, bad);
    }
    assert.throws(() => js.container('pane', 'block-size'), /layout: container: type is "block-size"; use one of 'inline-size', 'size'/);
  });

  test('contain: longhands together; content and strict alone', () => {
    assert.equal(contain('layout', 'paint'), 'contain: layout paint;');
    assert.equal(contain('strict'), 'contain: strict;');
    assert.equal(contain('content'), 'contain: content;');
    assert.throws(() => js.contain('strict', 'paint'), /layout: contain: 'strict' stands alone, got 'strict', 'paint'; pass it by itself/);
    assert.throws(() => contain('size', 'inline-size'), /layout: contain: 'size' and 'inline-size' together, got 'size', 'inline-size'; keep one/);
    assert.throws(() => js.contain(), /layout: contain: no value; give at least one of/);
    assert.throws(() => js.contain('everything'), /layout: contain: value is "everything"; use one of/);
  });

  test('contentVisibility: auto always paired with an intrinsic block size the author owns', () => {
    assert.equal(contentVisibility('3rem'), 'content-visibility: auto; contain-intrinsic-block-size: auto 3rem;');
    assert.throws(() => js.contentVisibility(), /layout: contentVisibility: size is undefined, not a CSS length/);
    assert.throws(() => js.contentVisibility('auto'), /layout: contentVisibility: size is "auto", not a CSS length/);
  });
});

suite('diagnostics', () => {
  const sheet = diagnostics();

  test('selects an unknown data-layout value and labels it with attr()', () => {
    const unknown = `[data-layout]${primitives.map((p) => `:not([data-layout="${p}"])`).join('')}`;
    assert.ok(sheet.includes(`${unknown}::before { content: "layout: unknown value " attr(data-layout); }`));
    assert.ok(sheet.includes('outline: 2px dashed'));
  });

  test('selects a sidebar without exactly two children, two principals in a cover, and roles or modifiers on the wrong primitive', () => {
    assert.ok(sheet.includes('[data-layout="sidebar"]:not(:has(> :nth-child(2):last-child))::before'));
    assert.ok(sheet.includes('[data-layout="cover"]:has(> [data-layout-principal] ~ [data-layout-principal])::before'));
    assert.ok(sheet.includes('[data-layout-side]:not([data-layout="sidebar"])::before'));
    assert.ok(sheet.includes('[data-layout-dense]:not([data-layout="grid"])::before'));
    assert.ok(sheet.includes('[data-layout-principal]:not([data-layout="cover"] > *):not([data-layout="stack"] > *)::before'));
    assert.ok(sheet.includes('[data-layout-gap]:not([data-layout])::before'));
    assert.ok(sheet.includes('attr(data-layout-gap)'));
  });

  test('a length written as an attribute is told rule 2 where it stands: min and width, and every knob but gap', () => {
    assert.ok(sheet.includes('[data-layout-min]::before { content: "layout: min is not an attribute; set it in the style"; }'));
    assert.ok(sheet.includes('[data-layout-width]::before { content: "layout: width is not an attribute; set it in the style"; }'));
    for (const { name, key } of KNOBS.filter((k) => k.key !== 'gap')) {
      const tail = name.slice('--layout-'.length);
      assert.ok(sheet.includes(`[data-layout-${tail}]::before { content: "layout: ${tail} is not an attribute; set ${name} in the style"; }`), key);
    }
    assert.ok(!sheet.includes('[data-layout-gap]::before'), 'gap is an attribute');
    for (const { label } of faults) assert.match(label, /^"layout: /, label);
    assert.equal(faults.length, 20);
  });
});

suite('what an author reads', () => {
  test("README.md names each primitive as data-layout=\"<p>\", every attribute, and every exported function", () => {
    const source = readFileSync(new URL('../src/libraries/css/layout/index.ts', import.meta.url), 'utf8');
    const card = readFileSync(new URL('../src/libraries/css/layout/README.md', import.meta.url), 'utf8');
    assert.ok(card.startsWith('# layout'), 'the README is the document');
    for (const p of primitives) assert.ok(card.includes(`data-layout="${p}"`), p);
    for (const name of Object.values(attributes)) assert.ok(card.includes(name), name);
    const functions = Object.entries(engine).filter(([, v]) => typeof v === 'function').map(([name]) => name);
    assert.ok(functions.length >= 18);
    for (const name of functions) assert.match(card, new RegExp(`\\b${name}\\b`), `the card names ${name}`);
    assert.match(source, /^  attributes,$/m, 'attributes are exported beside properties and KNOBS');
  });
});

suite('the "Do not" list, enforced over every output', () => {
  const all = every();

  test('braces balance; no undefined, NaN or [object Object]', () => {
    for (const text of all) {
      assert.equal(count(text, '{'), count(text, '}'), text);
      assert.doesNotMatch(text, /undefined|NaN|\[object Object\]/, text);
    }
  });

  test('every custom property is --layout-* or --space-*; every --layout-* is in properties.defines', () => {
    for (const text of all) {
      for (const [name] of text.matchAll(/--[\w-]+/g)) {
        assert.ok(name.startsWith('--layout-') || name.startsWith('--space-'), `${name} in ${text}`);
        if (name.startsWith('--layout-')) assert.ok(properties.defines.includes(name), `${name} is not defined`);
      }
    }
  });

  test('every step read is var(--space-N, <fallback>): a length never travels bare', () => {
    for (const text of all) {
      for (const [, step, fallback] of text.matchAll(/var\(--space-(\d), ([^)]+)\)/g)) assert.equal(fallback, fallbacks[step], text);
      assert.doesNotMatch(text, /var\(--space-\d\)/);
    }
  });

  test('a per-selector block sets no knob: an option moves the fallback, so a knob set on the element wins', () => {
    for (const text of blocks()) {
      assert.doesNotMatch(text, /--layout-(gap|align|justify|grid-min|grid-repeat|sidebar-width|sidebar-min|cover-min):/, text);
    }
    assert.ok(grid({ min: '12rem' }).includes('var(--layout-grid-min, 12rem)'));
  });
});
