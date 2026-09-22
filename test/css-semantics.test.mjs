import { suite, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  NAMES,
  attributes,
  cardAttributes,
  cardProperties,
  cardRoles,
  cardRules,
  dialogAttributes,
  dialogProperties,
  dialogRules,
  fieldAttributes,
  fieldGroupAttributes,
  fieldGroupRules,
  fieldProperties,
  navAttributes,
  navLinkAttributes,
  navProperties,
  navRules,
  properties,
  toastAttributes,
  toastProperties,
  toastRules,
  toolbarAttributes,
  toolbarProperties,
  toolbarRules,
} from '../dist/libraries/css/semantics/index.js';
import { html, nothing, serialize } from '../dist/libraries/templates/index.js';
import { StyleResult, serialize as serializeSheet } from '../dist/libraries/css/templates/index.js';
import * as theme from '../dist/libraries/css/theme/index.js';
import { elevation, properties as effectsProperties, rules as effectRules, transition } from '../dist/libraries/css/effects/index.js';
import { properties as animationProperties, timeline } from '../dist/libraries/css/animation/index.js';

/** A sheet's CSS text: a StyleResult serialized, a string as it is (Effects' rules() before it migrates). @param {unknown} sheet @returns {string} */
const textOf = (sheet) => (typeof sheet === 'string' ? sheet : serializeSheet(/** @type {any} */ (sheet)).text);

/** What another engine contributes to each composite's text, exactly as the composite composes it; the rest is the composite's own. */
const FOREIGN_PARTS = {
  card: [
    ...[0, 1, 2, 3].map((level) => elevation(/** @type {any} */ (level)).replace(/^/gm, '  ')),
    textOf(effectRules('lift', { selector: '[data-card]', states: ['hover'] })),
  ],
  toolbar: [],
  'field group': [],
  dialog: [],
  toast: [textOf(timeline({ name: 'toast-enter', steps: ['fade-in', 'slide-up'] }, '[data-toast] [data-toast-notice]'))],
  nav: [transition(['color']).replace(/^/gm, '  ')],
};
/** @param {string} text @param {string[]} parts */
const without = (text, parts) => parts.reduce((rest, part) => rest.split(part).join(''), text);

// ---- The oracle: LOGS/commander-a.md § Names, typed here once as the contract ----

const ORACLE = {
  '--color-': ['surface', 'surface-raised', 'text', 'text-muted', 'accent', 'on-accent', 'border', 'focus', 'danger', 'success', 'warning'],
  '--space-': ['0', '1', '2', '3', '4', '5', '6', '7', '8'],
  '--text-': ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'],
  '--font-': ['body', 'heading', 'mono'],
  '--leading-': ['tight', 'normal', 'loose'],
  '--weight-': ['normal', 'medium', 'bold'],
  '--radius-': ['none', 'sm', 'md', 'lg', 'full'],
  '--shadow-': ['none', 'sm', 'md', 'lg'],
  '--duration-': ['instant', 'fast', 'base', 'slow'],
  '--ease-': ['linear', 'in', 'out', 'in-out'],
};
const guaranteed = new Set(Object.entries(ORACLE).flatMap(([prefix, names]) => names.map((name) => prefix + name)));
/** Effects' and Animation's knobs (`--fx-<name>`, `--anim-<name>`, `--stagger`), readable by any engine. */
const effectsKnobs = new Set([...effectsProperties.defines, ...animationProperties.defines]);

// ---- Every input combination ----

/** Every object with one value per key: cartesian({ a: [1, 2], b: [x] }) → [{ a: 1, b: x }, { a: 2, b: x }]. */
const cartesian = (options) =>
  Object.entries(options).reduce((rows, [key, values]) => rows.flatMap((row) => values.map((value) => ({ ...row, [key]: value }))), [{}]);

const cardInputs = cartesian({ dense: [undefined, false, true], elevation: [undefined, 0, 1, 2, 3], selected: [undefined, false, true], role: [undefined, null, ...cardRoles] });
const toolbarInputs = cartesian({
  label: [undefined, '', 'Actions'],
  labelledBy: [undefined, 'heading'],
  orientation: [undefined, 'horizontal', 'vertical'],
  align: [undefined, 'start', 'center', 'end', 'between'],
  overflow: [undefined, 'wrap', 'scroll'],
});
const groupInputs = cartesian({ inline: [undefined, false, true], disabled: [undefined, false, true] });
const fieldInputs = cartesian({ id: ['title'], hint: [undefined, false, true], invalid: [undefined, false, true] });
const dialogInputs = cartesian({ label: [undefined, '', 'Confirm'], labelledBy: [undefined, 'confirm-title'], danger: [undefined, false, true] });
const toastInputs = cartesian({ tone: [undefined, 'info', 'error'] });
const navInputs = cartesian({ label: [undefined, '', 'Configuration'], labelledBy: [undefined, 'nav-heading'], vertical: [undefined, false, true] });
const navLinkInputs = cartesian({ current: [undefined, false, true] });

/** Keys whose values name things (ids, names) rather than states the sheet selects on. */
const EXEMPT = new Set(['aria-label', 'aria-labelledby', 'aria-describedby', 'aria-live', 'id', 'for', 'role']);
/** Native boolean attributes and the pseudo-class the sheet reads instead of the attribute. */
const NATIVE = { disabled: ':disabled' };

const composites = [
  {
    name: 'card',
    root: 'data-card',
    prefix: '--card-',
    sheet: cardRules(),
    text: textOf(cardRules()),
    own: without(textOf(cardRules()), FOREIGN_PARTS['card']),
    properties: cardProperties,
    records: cardInputs.map((inputs) => cardAttributes(inputs)),
    regions: [],
    natives: ['> header', '> footer'],
  },
  {
    name: 'toolbar',
    root: 'data-toolbar',
    prefix: '--toolbar-',
    sheet: toolbarRules(),
    text: textOf(toolbarRules()),
    own: without(textOf(toolbarRules()), FOREIGN_PARTS['toolbar']),
    properties: toolbarProperties,
    records: toolbarInputs.map((inputs) => toolbarAttributes(inputs)),
    regions: [],
    natives: [':disabled', '[role="group"]', ':is(hr, [role="separator"])'],
  },
  {
    name: 'field group',
    root: 'data-field-group',
    prefix: '--field-',
    sheet: fieldGroupRules(),
    text: textOf(fieldGroupRules()),
    own: without(textOf(fieldGroupRules()), FOREIGN_PARTS['field group']),
    properties: fieldProperties,
    records: [...groupInputs.map((inputs) => fieldGroupAttributes(inputs)), ...fieldInputs.map((inputs) => fieldAttributes(inputs).control)],
    regions: ['data-field', 'data-field-hint', 'data-field-error'],
    natives: [':disabled', ':user-invalid', ':has([aria-invalid="true"])', '> legend'],
  },
  {
    name: 'dialog',
    root: 'data-dialog',
    prefix: '--dialog-',
    sheet: dialogRules(),
    text: textOf(dialogRules()),
    own: without(textOf(dialogRules()), FOREIGN_PARTS['dialog']),
    properties: dialogProperties,
    records: dialogInputs.map((inputs) => dialogAttributes(/** @type {any} */ (inputs))),
    regions: ['data-dialog-confirm'],
    natives: [':is([open], :modal)', '::backdrop', '> :is(h1, h2, h3)', '> p', '> footer'],
  },
  {
    name: 'toast',
    root: 'data-toast',
    prefix: '--toast-',
    sheet: toastRules(),
    text: textOf(toastRules()),
    own: without(textOf(toastRules()), FOREIGN_PARTS['toast']),
    properties: toastProperties,
    records: toastInputs.map((inputs) => toastAttributes(/** @type {any} */ (inputs))),
    regions: ['data-toast-notice', 'data-toast-dismiss'],
    natives: ['[role="alert"]'],
  },
  {
    name: 'nav',
    root: 'data-nav',
    prefix: '--nav-',
    sheet: navRules(),
    text: textOf(navRules()),
    own: without(textOf(navRules()), FOREIGN_PARTS['nav']),
    properties: navProperties,
    records: [...navInputs.map((inputs) => navAttributes(/** @type {any} */ (inputs))), ...navLinkInputs.map((inputs) => navLinkAttributes(/** @type {any} */ (inputs)))],
    regions: ['data-nav-brand', 'data-nav-title'],
    natives: ['a:hover', '@container (inline-size < 48rem)', '@container (inline-size >= 48rem)', ':not([data-nav-vertical])'],
  },
];

/** The keys whose values differ between two records. */
const changed = (a, b) => Object.keys(a).filter((key) => a[key] !== b[key]);

// ---- Attributes ----

suite('card attributes', () => {
  test('defaults are absent: the base rule is the default', () => {
    assert.deepEqual(cardAttributes(), { 'data-card': true, role: null, 'data-card-dense': false, 'data-card-elevation': null, 'aria-selected': null, 'aria-current': null });
  });

  test('each input flips exactly its attribute', () => {
    const base = cardAttributes();
    assert.deepEqual(changed(base, cardAttributes({ dense: true })), ['data-card-dense']);
    assert.deepEqual(changed(base, cardAttributes({ elevation: 1 })), []);
    assert.equal(cardAttributes({ elevation: 0 })['data-card-elevation'], '0');
    assert.equal(cardAttributes({ elevation: 2 })['data-card-elevation'], '2');
    assert.equal(cardAttributes({ elevation: 3 })['data-card-elevation'], '3');
    assert.deepEqual(changed(base, cardAttributes({ selected: true })), ['aria-current']);
    assert.equal(cardAttributes({ selected: true })['aria-current'], 'true');
  });

  test('a role that admits aria-selected gets "true" | "false" and no aria-current; any other role selects with aria-current', () => {
    for (const role of cardRoles) {
      assert.deepEqual(changed(cardAttributes(), cardAttributes({ role })), ['role', 'aria-selected']);
      assert.equal(cardAttributes({ role })['aria-selected'], 'false');
      const selected = cardAttributes({ role, selected: true });
      assert.equal(selected['aria-selected'], 'true');
      assert.equal(selected['aria-current'], null);
    }
    assert.equal(cardAttributes({ role: null, selected: true })['aria-selected'], null);
    assert.equal(cardAttributes({ role: null, selected: true })['aria-current'], 'true');
  });
});

suite('toolbar attributes', () => {
  test('defaults are absent, never "horizontal", "start" or "wrap"', () => {
    const bar = toolbarAttributes({ label: 'Actions' });
    assert.deepEqual(bar, { 'data-toolbar': true, role: 'toolbar', 'aria-label': 'Actions', 'aria-labelledby': null, 'aria-orientation': null, 'data-toolbar-align': null, 'data-toolbar-overflow': null });
    assert.deepEqual(toolbarAttributes({ label: 'Actions', orientation: 'horizontal', align: 'start', overflow: 'wrap' }), bar);
  });

  test('orientation is aria-orientation; label is aria-label; align and overflow are modifiers', () => {
    const bar = toolbarAttributes({ orientation: 'vertical', label: 'x', align: 'between', overflow: 'scroll' });
    assert.equal(bar.role, 'toolbar');
    assert.equal(bar['aria-orientation'], 'vertical');
    assert.equal(bar['aria-label'], 'x');
    assert.equal(bar['data-toolbar-align'], 'between');
    assert.equal(bar['data-toolbar-overflow'], 'scroll');
    assert.deepEqual(changed(toolbarAttributes({ label: 'x' }), toolbarAttributes({ label: 'x', orientation: 'vertical' })), ['aria-orientation']);
  });

  test('labelledBy wins over label; an empty name is no name (the type requires one; the record stays total for a JS caller)', () => {
    const bar = toolbarAttributes({ label: 'x', labelledBy: 'h' });
    assert.equal(bar['aria-labelledby'], 'h');
    assert.equal(bar['aria-label'], null);
    assert.equal(toolbarAttributes({ label: '' })['aria-label'], null);
    assert.equal(toolbarAttributes({ label: 'x', labelledBy: '' })['aria-label'], 'x');
    assert.deepEqual(toolbarAttributes(/** @type {any} */ ({}))['aria-label'], null);
  });
});

suite('field group and field attributes', () => {
  test('group defaults; inline and disabled are booleans for ?name=', () => {
    assert.deepEqual(fieldGroupAttributes(), { 'data-field-group': true, 'data-field-group-inline': false, disabled: false });
    assert.deepEqual(fieldGroupAttributes({ inline: true, disabled: true }), { 'data-field-group': true, 'data-field-group-inline': true, disabled: true });
  });

  test('ids derive from one string; describedby lists the error first, then the hint, or is null', () => {
    const both = fieldAttributes({ id: 'f', hint: true, invalid: true });
    assert.deepEqual(both, {
      label: { for: 'f' },
      control: { id: 'f', 'aria-invalid': 'true', 'aria-describedby': 'f-error f-hint' },
      hint: { id: 'f-hint' },
      error: { id: 'f-error' },
    });
    assert.equal(fieldAttributes({ id: 'f', hint: true }).control['aria-describedby'], 'f-hint');
    assert.equal(fieldAttributes({ id: 'f', invalid: true }).control['aria-describedby'], 'f-error');
    assert.equal(fieldAttributes({ id: 'f' }).control['aria-describedby'], null);
    assert.equal(fieldAttributes({ id: 'f' }).control['aria-invalid'], null);
  });

  test('an empty or whitespace id throws a RangeError naming the composite and the input, before any id is derived', () => {
    for (const id of ['', ' ', 'a b', 'a\tb', '\n', undefined, 3]) {
      assert.throws(() => fieldAttributes(/** @type {any} */ ({ id })), (error) => error instanceof RangeError && /^semantics: fieldAttributes: id is .+; give /.test(error.message) && error.message.includes(JSON.stringify(id)), String(id));
    }
    assert.doesNotThrow(() => fieldAttributes({ id: 'memory-file-content' }));
  });
});

suite('dialog attributes', () => {
  test('defaults are absent; labelledBy wins over label; an empty name is no name', () => {
    assert.deepEqual(dialogAttributes({ label: 'Confirm' }), { 'data-dialog': true, 'aria-label': 'Confirm', 'aria-labelledby': null, 'data-dialog-danger': false });
    const named = dialogAttributes({ label: 'x', labelledBy: 'confirm-title' });
    assert.equal(named['aria-labelledby'], 'confirm-title');
    assert.equal(named['aria-label'], null);
    assert.equal(dialogAttributes({ label: '' })['aria-label'], null);
    assert.equal(dialogAttributes({ label: 'x', labelledBy: '' })['aria-label'], 'x');
  });

  test('danger is a boolean modifier for ?name=, and flips nothing else', () => {
    assert.deepEqual(changed(dialogAttributes({ label: 'x' }), dialogAttributes({ label: 'x', danger: true })), ['data-dialog-danger']);
    assert.equal(dialogAttributes({ label: 'x', danger: true })['data-dialog-danger'], true);
  });
});

suite('toast attributes', () => {
  test('the tone is the live region\'s role: info polite, error assertive; there is no colour word beside it', () => {
    assert.deepEqual(toastAttributes(), { 'data-toast': true, role: 'status' });
    assert.deepEqual(toastAttributes({ tone: 'info' }), { 'data-toast': true, role: 'status' });
    assert.deepEqual(toastAttributes({ tone: 'error' }), { 'data-toast': true, role: 'alert' });
    assert.equal(Object.keys(toastAttributes()).filter((key) => key.startsWith('data-toast-')).length, 0);
  });

  test('the sheet selects on that role, and on nothing else for the tone', () => {
    const text = textOf(toastRules());
    assert.ok(text.includes('[data-toast][role="alert"]'), 'the assertive region is styled');
    assert.ok(!text.includes('[role="status"]'), 'polite is the base rule');
  });
});

suite('nav attributes', () => {
  test('defaults are absent; labelledBy wins over label; vertical is a boolean modifier for ?name=', () => {
    assert.deepEqual(navAttributes({ label: 'Configuration' }), { 'data-nav': true, 'aria-label': 'Configuration', 'aria-labelledby': null, 'data-nav-vertical': false });
    assert.equal(navAttributes({ label: 'x', labelledBy: 'h' })['aria-labelledby'], 'h');
    assert.equal(navAttributes({ label: 'x', labelledBy: 'h' })['aria-label'], null);
    assert.deepEqual(changed(navAttributes({ label: 'x' }), navAttributes({ label: 'x', vertical: true })), ['data-nav-vertical']);
  });

  test('a link is aria-current="page" or nothing — never "false"', () => {
    assert.deepEqual(navLinkAttributes(), { 'aria-current': null });
    assert.deepEqual(navLinkAttributes({ current: false }), { 'aria-current': null });
    assert.deepEqual(navLinkAttributes({ current: true }), { 'aria-current': 'page' });
  });

  test('the axis is the container\'s: two unnamed bands, and a pinned column is excluded from both by selector', () => {
    const text = textOf(navRules());
    assert.ok(text.includes('@container (inline-size < 48rem)'), 'below md');
    assert.ok(text.includes('@container (inline-size >= 48rem)'), 'from md');
    assert.ok(!/@container\s+[A-Za-z]/.test(text), 'the bands name no container: they ask the nearest one');
    for (const band of text.split('@container ').slice(1)) {
      for (const [, selector] of band.matchAll(/^\[data-nav\][^\s{]*/gm)) void selector;
      for (const line of band.split('\n')) {
        if (line.startsWith('[data-nav]')) assert.ok(line.startsWith('[data-nav]:not([data-nav-vertical])'), `a band rule never touches a pinned nav: ${line}`);
      }
    }
    assert.ok(text.includes('[data-nav][data-nav-vertical] {'), 'the pinned column is stated outside the bands');
  });
});

suite('the hole budget: every key is a per-instance attribute compare, so a new one is a deliberate change here', () => {
  test('card 6, toolbar 7, field group 3, field sub-records 1/3/1/1, dialog 4, toast 2, nav 4, nav link 1', () => {
    assert.equal(Object.keys(cardAttributes()).length, 6);
    assert.equal(Object.keys(toolbarAttributes({ label: 'x' })).length, 7);
    assert.equal(Object.keys(fieldGroupAttributes()).length, 3);
    assert.equal(Object.keys(dialogAttributes({ label: 'x' })).length, 4);
    assert.equal(Object.keys(toastAttributes()).length, 2);
    assert.equal(Object.keys(navAttributes({ label: 'x' })).length, 4);
    assert.equal(Object.keys(navLinkAttributes()).length, 1);
    const field = fieldAttributes({ id: 'f', hint: true, invalid: true });
    assert.deepEqual(Object.keys(field), ['label', 'control', 'hint', 'error']);
    assert.deepEqual(Object.values(field).map((part) => Object.keys(part).length), [1, 3, 1, 1]);
  });
});

suite('inputs are refused by name', () => {
  /** @type {[string, (x: any) => unknown, string][]} */
  const calls = [
    ['cardAttributes', (x) => cardAttributes(x), 'dense, elevation, selected, role'],
    ['toolbarAttributes', (x) => toolbarAttributes(x), 'label, labelledBy, orientation, align, overflow'],
    ['fieldGroupAttributes', (x) => fieldGroupAttributes(x), 'inline, disabled'],
    ['fieldAttributes', (x) => fieldAttributes({ id: 'f', ...x }), 'id, hint, invalid'],
    ['dialogAttributes', (x) => dialogAttributes({ label: 'x', ...x }), 'label, labelledBy, danger'],
    ['toastAttributes', (x) => toastAttributes(x), 'tone'],
    ['navAttributes', (x) => navAttributes({ label: 'x', ...x }), 'label, labelledBy, vertical'],
    ['navLinkAttributes', (x) => navLinkAttributes(x), 'current'],
  ];

  test('an unknown key is a TypeError naming the key and the accepted keys: semantics: <fn>: <what>; <fix>', () => {
    for (const [fn, call, keys] of calls) {
      assert.throws(() => call({ elevaton: 2 }), (error) => error instanceof TypeError && error.message === `semantics: ${fn}: "elevaton" is not an option; the options are ${keys}`, fn);
    }
  });

  test('a non-object is a TypeError; an absent argument takes the default where there is one', () => {
    for (const [fn, bad] of [['cardAttributes', null], ['cardAttributes', 'dense'], ['fieldGroupAttributes', []], ['toolbarAttributes', 3], ['dialogAttributes', null], ['toastAttributes', 'error'], ['navAttributes', []], ['navLinkAttributes', 1]]) {
      const call = { cardAttributes, fieldGroupAttributes, toolbarAttributes, dialogAttributes, toastAttributes, navAttributes, navLinkAttributes }[fn];
      assert.throws(() => call(/** @type {any} */ (bad)), (error) => error instanceof TypeError && error.message.startsWith(`semantics: ${fn}: the inputs are `), `${fn}(${JSON.stringify(bad)})`);
    }
    assert.doesNotThrow(() => cardAttributes(undefined));
    assert.doesNotThrow(() => fieldGroupAttributes(undefined));
    assert.doesNotThrow(() => toastAttributes(undefined));
    assert.doesNotThrow(() => navLinkAttributes(undefined));
  });
});

suite('attributes', () => {
  test('keyed by option word, frozen, every hook the sheets select on and no other', () => {
    assert.deepEqual(attributes, {
      card: 'data-card',
      toolbar: 'data-toolbar',
      fieldGroup: 'data-field-group',
      field: 'data-field',
      fieldHint: 'data-field-hint',
      fieldError: 'data-field-error',
      dialog: 'data-dialog',
      dialogConfirm: 'data-dialog-confirm',
      toast: 'data-toast',
      toastNotice: 'data-toast-notice',
      toastDismiss: 'data-toast-dismiss',
      nav: 'data-nav',
      navBrand: 'data-nav-brand',
      navTitle: 'data-nav-title',
    });
    assert.ok(Object.isFrozen(attributes));
    const all = composites.map((c) => c.text).join('');
    for (const hook of Object.values(attributes)) assert.ok(all.includes(`[${hook}]`), hook);
  });
});

suite('wrong form → write instead', () => {
  const header = readFileSync(new URL('../src/libraries/css/semantics/README.md', import.meta.url), 'utf8');
  const start = header.indexOf('## Wrong form');
  const table = header.slice(start, header.indexOf('## The knobs', start));
  const rows = [...table.matchAll(/^ {4}\| (?!wrong form|---)(.+?) \| (.+?) \|$/gm)].map(([, wrong, instead]) => ({ wrong, instead }));

  test('the table has its rows; no wrong form appears in a sheet or in the README outside the table', () => {
    assert.equal(rows.length, 7);
    const rest = header.replace(table, '');
    for (const { wrong } of rows) {
      for (const { name, text } of composites) assert.ok(!text.includes(wrong), `${wrong} in the ${name} sheet`);
      assert.ok(!rest.includes(wrong), `${wrong} in the header outside the table`);
    }
  });
});

suite('every record', () => {
  test('is frozen, sub-records included', () => {
    for (const { records } of composites) for (const record of records) assert.ok(Object.isFrozen(record));
    const field = fieldAttributes({ id: 'f' });
    assert.ok(Object.isFrozen(field));
    for (const part of Object.values(field)) assert.ok(Object.isFrozen(part));
  });

  test('a boolean key is data-* or a native boolean attribute (?name=); a string key is aria-*, role, an id, or a data-* whose value is never "true" | "false" (name=)', () => {
    /** @type {object[]} */
    const all = [];
    for (const { records } of composites) all.push(...records);
    for (const inputs of fieldInputs) all.push(...Object.values(fieldAttributes(inputs)));
    for (const record of all) {
      for (const [key, value] of Object.entries(record)) {
        if (typeof value === 'boolean') assert.ok(key.startsWith('data-') || key in NATIVE, `${key} binds with ?${key}=`);
        else if (typeof value === 'string') {
          assert.ok(key.startsWith('aria-') || key.startsWith('data-') || key === 'role' || key === 'id' || key === 'for', `${key} binds with ${key}=`);
          if (key.startsWith('data-')) assert.ok(value !== 'true' && value !== 'false', `${key}="${value}" would read as a boolean bound with =`);
        } else assert.equal(value, null, `${key}: null leaves the attribute off`);
      }
    }
  });

  test('is deterministic: equal inputs, deep-equal records; the same text object every call', () => {
    for (const inputs of cardInputs) assert.deepEqual(cardAttributes(inputs), cardAttributes(inputs));
    for (const inputs of toolbarInputs) assert.deepEqual(toolbarAttributes(inputs), toolbarAttributes(inputs));
    for (const inputs of fieldInputs) assert.deepEqual(fieldAttributes(inputs), fieldAttributes(inputs));
    for (const inputs of dialogInputs) assert.deepEqual(dialogAttributes(inputs), dialogAttributes(inputs));
    for (const inputs of navInputs) assert.deepEqual(navAttributes(inputs), navAttributes(inputs));
    assert.deepEqual(fieldAttributes({ id: 'x', hint: true }).hint, { id: 'x-hint' });
    assert.ok(cardRules() === cardRules() && toolbarRules() === toolbarRules() && fieldGroupRules() === fieldGroupRules());
    assert.ok(dialogRules() === dialogRules() && toastRules() === toastRules() && navRules() === navRules());
  });
});

// ---- Rules ----

for (const { name, root, prefix, sheet, text, own: ownText, properties: own, records, regions, natives } of composites) {
  suite(`${name} rules`, () => {
    test('is one StyleResult, the same object every call, binding nothing: every read is text resolved where the composite is', () => {
      assert.ok(sheet instanceof StyleResult);
      assert.deepEqual(serializeSheet(sheet).properties, []);
      assert.ok(!text.includes('--css-'), 'no --css- name');
    });

    test(`has a rule on [${root}]; braces balance; no undefined, NaN, [object Object], @keyframes, @property or :root`, () => {
      assert.match(text, new RegExp(`^\\[${root}\\] \\{$`, 'm'));
      assert.equal(text.split('{').length, text.split('}').length);
      for (const bad of ['undefined', 'NaN', '[object Object]', '@keyframes', '@property', ':root']) assert.ok(!text.includes(bad), bad);
      assert.match(text, new RegExp(`^/\\* semantics: ${name} \\*/`));
    });

    test('every knob is read bare; every foreign name is read with a fallback and is in reads', () => {
      const seen = new Set();
      for (const [, property, next] of text.matchAll(/var\((--[\w-]+)\s*([,)])/g)) {
        seen.add(property);
        if (own.defines.includes(property)) assert.equal(next, ')', `${property} is a knob: read without a fallback`);
        else {
          assert.equal(next, ',', `${property} is foreign: read with a fallback`);
          assert.ok(own.reads.includes(property), `${property} is in reads`);
        }
      }
      assert.deepEqual([...own.reads].sort(), [...seen].filter((p) => !own.defines.includes(p)).sort());
    });

    test(`every knob begins with ${prefix}, is declared in the base rule and read somewhere; no declaration outside the prefix`, () => {
      const start = text.indexOf(`[${root}] {`);
      const base = text.slice(start, text.indexOf('}', start));
      for (const knob of own.defines) {
        assert.ok(knob.startsWith(prefix), knob);
        assert.ok(base.includes(`\n  ${knob}:`), `${knob} is declared in the base rule`);
        assert.ok(text.includes(`var(${knob})`), `${knob} is read`);
      }
      for (const [, property] of ownText.matchAll(/(--[\w-]+)\s*:/g)) assert.ok(property.startsWith(prefix), `${property} declared outside ${prefix}`);
      assert.deepEqual(own.overrides, []);
    });

    test('every read is a guaranteed Name or an Effects knob; its own text reads only NAMES, each through a Theme reader', () => {
      for (const property of own.reads) {
        assert.ok(guaranteed.has(property) || effectsKnobs.has(property), `${property} is a guaranteed name`);
        assert.ok(!property.startsWith(prefix), property);
      }
      for (const [, group, step] of ownText.matchAll(/var\(--(color|space|text|weight|radius|shadow)-([\w-]+),/g)) {
        assert.ok(ownText.includes(theme[group](step)), `--${group}-${step} is read as ${group}('${step}') writes it`);
      }
    });

    test(':focus-visible reads --color-focus', () => {
      assert.match(text, /:focus-visible[^{]*\{[^}]*var\(--color-focus,/);
    });

    test('coherence: every emitted state and modifier is styled; every styled attribute is emittable', () => {
      const emitted = new Set([`[${root}]`, ...regions.map((r) => `[${r}]`)]);
      for (const record of records) {
        for (const [key, value] of Object.entries(record)) {
          if (EXEMPT.has(key)) continue;
          if (value === true) {
            const selector = key in NATIVE ? NATIVE[key] : `[${key}]`;
            emitted.add(selector);
            assert.ok(text.includes(selector), `${selector} is styled`);
          } else if (typeof value === 'string' && value !== 'false') {
            emitted.add(`[${key}="${value}"]`);
            assert.ok(text.includes(`[${key}="${value}"]`), `[${key}="${value}"] is styled`);
          }
        }
      }
      for (const [selector] of text.matchAll(/\[(?:data|aria)-[\w-]+(?:="[^"]*")?\]/g)) assert.ok(emitted.has(selector), `${selector} is emittable`);
      for (const native of natives) assert.ok(text.includes(native), `${native} is styled by name`);
    });
  });
}

// ---- Properties ----

suite('the knob table in README.md', () => {
  const header = readFileSync(new URL('../src/libraries/css/semantics/README.md', import.meta.url), 'utf8');
  const rows = [...header.matchAll(/^ {4}\| (--[\w-]+) \| (.+?) \| (.+?) \|$/gm)].map(([, knob, fallback, drives]) => ({ knob, fallback, drives }));

  test('has one row per knob in properties.defines, in order, each with a default and a purpose', () => {
    assert.deepEqual(rows.map((r) => r.knob), [...properties.defines]);
    for (const { knob, drives } of rows) assert.ok(drives.length > 8, `${knob} says what it drives`);
  });

  test("each row's knob is declared in its composite's base rule with exactly the default the row states, and is read by that sheet", () => {
    for (const { knob, fallback } of rows) {
      const composite = composites.find((c) => knob.startsWith(c.prefix));
      assert.ok(composite, `${knob} has a composite`);
      const start = composite.text.indexOf(`[${composite.root}] {`);
      const base = composite.text.slice(start, composite.text.indexOf('}', start));
      const declared = fallback.replace(/\b(color|space|text|weight|radius|shadow)\('([\w-]+)'\)/g, (_, group, step) => theme[group](step));
      assert.ok(base.includes(`\n  ${knob}: ${declared};`), `${knob} is declared as ${fallback} in the ${composite.name} base rule`);
      assert.ok(composite.text.includes(`var(${knob})`), `${knob} is read by the ${composite.name} sheet`);
    }
  });
});

suite('properties', () => {
  test('defines is the six concatenated; reads is NAMES plus what the foreign parts read; overrides is empty; the two never meet', () => {
    assert.deepEqual(properties.defines, [
      ...cardProperties.defines,
      ...toolbarProperties.defines,
      ...fieldProperties.defines,
      ...dialogProperties.defines,
      ...toastProperties.defines,
      ...navProperties.defines,
    ]);
    const effectsReads = Object.values(FOREIGN_PARTS).flat().flatMap((part) => [...part.matchAll(/var\((--[\w-]+),/g)].map(([, p]) => p));
    assert.deepEqual([...properties.reads].sort(), [...new Set([...NAMES, ...effectsReads])].sort());
    assert.equal(new Set(properties.reads).size, properties.reads.length);
    assert.deepEqual(properties.overrides, []);
    assert.deepEqual(properties.defines.filter((p) => properties.reads.includes(p)), []);
    assert.ok(Object.isFrozen(properties) && Object.isFrozen(properties.defines));
  });

  test('NAMES is exactly what the composites\' own text reads, both ways; Theme\'s default is the only fallback', () => {
    const ownReads = new Set(composites.flatMap((c) => [...c.own.matchAll(/var\((--[\w-]+),/g)].map(([, p]) => p)).filter((p) => !effectsKnobs.has(p)));
    assert.deepEqual([...ownReads].sort(), [...NAMES].sort());
    for (const name of NAMES) assert.ok(name in theme.defaults, `${name} is Theme's`);
    assert.ok(Object.isFrozen(NAMES));
    const used = new Set(composites.flatMap((c) => [...c.properties.reads]));
    assert.deepEqual([...used].sort(), [...properties.reads].sort());
  });

  test('the card composes Effects: elevation(n) in the base and each elevation rule, the hover lift last', () => {
    const card = composites[0];
    for (const part of FOREIGN_PARTS.card) assert.ok(card.text.includes(part), part.slice(0, 60));
    assert.ok(card.text.trimEnd().endsWith(FOREIGN_PARTS.card.at(-1).trimEnd()), 'the lift is the last group, so it wins the elevation rows at equal specificity');
    assert.ok(!card.text.includes('[data-card]:hover { box-shadow'), "the card states no hover shadow of its own");
    for (const level of ['0', '2', '3']) {
      const at = card.text.indexOf(`[data-card][data-card-elevation="${level}"] {`);
      const rule = card.text.slice(at, card.text.indexOf('}', at));
      assert.ok(rule.trimEnd().endsWith('box-shadow: var(--card-shadow);') || rule.includes('box-shadow: var(--card-shadow);\n  border-color'), `elevation ${level} restates the knob after Effects' box-shadow`);
      assert.ok(rule.indexOf('box-shadow: var(--card-shadow)') > rule.indexOf('box-shadow: var(--fx-shadow'), `elevation ${level}: the knob's line follows Effects'`);
    }
  });
});

suite('the toast composes Animation and the nav composes Effects', () => {
  test("the toast's entrance is timeline() on the notice, last, and every duration in it is a token so reduced motion zeroes it", () => {
    const toast = composites.find((c) => c.name === 'toast');
    const part = FOREIGN_PARTS.toast[0];
    assert.ok(toast.text.includes(part), 'the timeline is composed verbatim');
    assert.ok(toast.text.trimEnd().endsWith(part.trimEnd()), 'composed last');
    assert.match(part, /animation: anim-fade-in .*anim-slide-up /);
    assert.ok(!/animation:[^;]*\b\d+ms/.test(part.replace(/var\([^)]*\)/g, '')), 'no literal duration outside a token fallback');
    assert.ok(!toast.own.includes('animation:'), 'the toast states no motion of its own');
  });

  test("the nav's link transition is Effects', and the nav declares no --fx- knob itself", () => {
    const nav = composites.find((c) => c.name === 'nav');
    assert.ok(nav.text.includes(FOREIGN_PARTS.nav[0]), "Effects' transition is composed verbatim");
    assert.ok(!/--fx-[\w-]+\s*:/.test(nav.own), 'no Effects knob is declared by this engine');
  });
});

// ---- The documented fragments, rendered ----

const noop = () => {};
/** Attributes of the rendered markup as [name, value | undefined], markers of the html tag ignored. */
const attributesOf = (markup) =>
  [...markup.matchAll(/\s(data-[\w-]+|aria-[\w-]+)(?:="([^"]*)")?(?=[\s>])/g)].map(([, name, value]) => [name, value]).filter(([name]) => !/^data-(on-|v0-)/.test(name));

const renderCard = (card) =>
  html`<article data-card role=${card.role} ?data-card-dense=${card['data-card-dense']} data-card-elevation=${card['data-card-elevation']} aria-selected=${card['aria-selected']} aria-current=${card['aria-current']} tabindex="0" @click=${noop}><header><h2>Title</h2></header><p>Body</p><footer>Footer</footer></article>`;
const renderToolbar = (bar) =>
  html`<div data-toolbar role="toolbar" aria-label=${bar['aria-label']} aria-labelledby=${bar['aria-labelledby']} aria-orientation=${bar['aria-orientation']} data-toolbar-align=${bar['data-toolbar-align']} data-toolbar-overflow=${bar['data-toolbar-overflow']}><div role="group" aria-label="Edit"><button type="button" @click=${noop}>Revert</button><button class="primary" ?disabled=${true}>Save</button></div><hr><a href="/x">Back</a></div>`;
const renderGroup = (group, title, error) =>
  html`<fieldset data-field-group ?data-field-group-inline=${group['data-field-group-inline']} ?disabled=${group.disabled}><legend>Details</legend><div data-field><label for=${title.label.for}>Title</label><input name="title" id=${title.control.id} aria-invalid=${title.control['aria-invalid']} aria-describedby=${title.control['aria-describedby']}><small id=${title.hint.id} data-field-hint>Shown in the list</small>${error ? html`<small id=${title.error.id} data-field-error aria-live="polite">${error}</small>` : nothing}</div></fieldset>`;

const renderDialog = (dialog) =>
  html`<dialog data-dialog aria-label=${dialog['aria-label']} aria-labelledby=${dialog['aria-labelledby']} ?data-dialog-danger=${dialog['data-dialog-danger']}><h2 id="confirm-title">Delete?</h2><p>This cannot be undone.</p><footer><button type="button" @click=${noop}>Cancel</button><button data-dialog-confirm @click=${noop}>Delete</button></footer></dialog>`;
const renderToast = (toast, visible) =>
  html`<div data-toast role=${toast.role}>${visible ? html`<p data-toast-notice><span>Saved</span><button @click=${noop}>Retry</button><button data-toast-dismiss title="Dismiss" @click=${noop}>x</button></p>` : nothing}</div>`;
const renderNav = (nav) =>
  html`<nav data-nav aria-label=${nav['aria-label']} aria-labelledby=${nav['aria-labelledby']} ?data-nav-vertical=${nav['data-nav-vertical']}><a data-nav-brand href="/">Brand</a>${[true, false].map(
    (active) => html`<a href="/x" aria-current=${navLinkAttributes({ current: active })['aria-current']}>Link</a>`,
  )}<span data-nav-title>Workspace</span></nav>`;

suite('the documented fragments, rendered for every input combination', () => {
  const rendered = [
    ...cardInputs.map((inputs) => ({ text: textOf(cardRules()), markup: serialize(renderCard(cardAttributes(inputs)), 'v0').html })),
    ...toolbarInputs.map((inputs) => ({ text: textOf(toolbarRules()), markup: serialize(renderToolbar(toolbarAttributes(inputs)), 'v0').html })),
    ...dialogInputs.map((inputs) => ({ text: textOf(dialogRules()), markup: serialize(renderDialog(dialogAttributes(inputs)), 'v0').html })),
    ...toastInputs.flatMap((inputs) => [true, false].map((visible) => ({ text: textOf(toastRules()), markup: serialize(renderToast(toastAttributes(inputs), visible), 'v0').html }))),
    ...navInputs.map((inputs) => ({ text: textOf(navRules()), markup: serialize(renderNav(navAttributes(inputs)), 'v0').html })),
    ...groupInputs.flatMap((g) =>
      fieldInputs.flatMap((f) =>
        ['', 'Required'].map((error) => ({ text: textOf(fieldGroupRules()), markup: serialize(renderGroup(fieldGroupAttributes(g), fieldAttributes({ ...f, invalid: !!error || f.invalid }), error), 'v0').html })),
      ),
    ),
  ];

  test('no data-*="false" and no data-*="true": a boolean key is bound with ?name=', () => {
    for (const { markup } of rendered) assert.doesNotMatch(markup, /data-[\w-]+="(?:true|false)"/);
  });

  test('every data-* and aria-* the markup carries is in the sheet, as [name] or [name="value"]', () => {
    for (const { text, markup } of rendered) {
      for (const [name, value] of attributesOf(markup)) {
        if (EXEMPT.has(name) || value === 'false') continue;
        const selector = value === undefined ? `[${name}]` : `[${name}="${value}"]`;
        assert.ok(text.includes(selector), `${selector} from ${markup}`);
      }
    }
  });

  test('the alternative always-rendered live region: the element is present and empty with no error, and the sheet hides it while empty', () => {
    const title = fieldAttributes({ id: 'title', hint: true });
    const live = (error) => html`<small id=${title.error.id} data-field-error aria-live="polite">${error ?? nothing}</small>`;
    assert.equal(serialize(live(undefined), 'v0').html, '<small id="title-error" data-field-error aria-live="polite"></small>');
    assert.equal(serialize(live('Required'), 'v0').html, '<small id="title-error" data-field-error aria-live="polite">Required</small>');
    assert.ok(textOf(fieldGroupRules()).includes('[data-field-error]:empty { display: none; }'));
  });

  test('the by-hand form and the record form render byte-identical markup', () => {
    for (const m of [{ dense: true, current: true }, { dense: false, current: false }]) {
      const byHand = html`<article data-card ?data-card-dense=${m.dense} aria-current=${m.current ? 'true' : nothing}>x</article>`;
      const card = cardAttributes({ dense: m.dense, selected: m.current });
      const record = html`<article data-card ?data-card-dense=${card['data-card-dense']} aria-current=${card['aria-current']}>x</article>`;
      assert.equal(serialize(byHand, 'v0').html, serialize(record, 'v0').html);
    }
  });
});
