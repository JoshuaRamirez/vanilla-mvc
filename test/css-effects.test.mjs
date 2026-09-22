import { suite, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import {
  attributes,
  describe,
  durationTokens,
  easeTokens,
  effectNames,
  elevation,
  fx,
  knobDefaults,
  knobNames,
  properties,
  registrations,
  restartable,
  rules,
  sheet,
  specKeys,
  stateNames,
  stateful,
  states,
  transition,
  transitioned,
  when,
} from '../dist/libraries/css/effects/index.js';
import { StyleResult, serialize } from '../dist/libraries/css/templates/index.js';
import * as animation from '../dist/libraries/css/animation/index.js';
import * as theme from '../dist/libraries/css/theme/index.js';

// ---- Reading a StyleResult: its text is the one raw-text hole at statement start ----

/** The CSS text of a rule-emitting function's result: strings and values interleaved; every value is text. */
const textOf = (/** @type {StyleResult} */ result) => {
  assert.ok(result instanceof StyleResult, 'not a StyleResult');
  return result.strings.reduce((out, part, i) => {
    const value = i < result.values.length ? result.values[i] : '';
    assert.equal(typeof value, 'string', 'a hole that is not raw text');
    return out + part + value;
  }, '');
};
/** A value a negative case feeds on purpose; the only place the checker is told to look away. */
const bad = (/** @type {unknown} */ value) => /** @type {any} */ (value);
const LEVELS = /** @type {const} */ ([
  [0, 'elevation-0'],
  [1, 'elevation-1'],
  [2, 'elevation-2'],
  [3, 'elevation-3'],
]);

// ---- Helpers: facts parsed from the text, never whitespace ----

/** The first `<prelude> {` block at the given nesting, with its body. */
const blockOf = (text, prelude) => {
  const at = text.indexOf(`${prelude} {`);
  assert.notEqual(at, -1, `no block "${prelude} {" in:\n${text}`);
  let depth = 0;
  for (let i = at; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(at, i + 1);
  }
  assert.fail(`unclosed block "${prelude} {"`);
};
/** Every `--x: value;` in a text, as [name, value] pairs in order. */
const declared = (text) => [...text.matchAll(/(--[a-z0-9-]+):\s*([^;\n]+);/g)].map((m) => [m[1], m[2]]);
/** Every `--x` read through var(). */
const reads = (text) => new Set([...text.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
/** Every `var(--x` read, with whether it carries a fallback. */
const readsWithFallback = (text) => [...text.matchAll(/var\((--[a-z0-9-]+)(,)?/g)].map((m) => [m[1], m[2] === ',']);
/** Every selector prelude of a style rule (not an at-rule), comments stripped. */
const preludes = (text) =>
  [...text.replace(/\/\*[^]*?\*\//g, '').matchAll(/^\s*([^@{}\n][^{}\n]*?)\s*\{/gm)].map((m) => m[1]);
const balanced = (text) => (text.match(/{/g) ?? []).length === (text.match(/}/g) ?? []).length;
const smells = /undefined|NaN|\[object Object\]|null|;;/;
const idents = (text) => new Set([...text.matchAll(/anim-[a-z-]+/g)].map((m) => m[0]));
const ERROR = /^effects: [a-z]+: .+; .+$/;
const throwsShape = (fn) => assert.throws(fn, (err) => err instanceof Error && ERROR.test(err.message) && !err.message.includes('\n'));

/**
 * Specificity's (b) column: attributes, classes and pseudo-classes, with :is()/:not() as the max of their
 * arguments and :where() as zero; pseudo-elements and types ignored.
 */
const classes = (selector) => {
  let b = 0;
  let i = 0;
  const args = (from) => {
    let depth = 0;
    let start = from;
    const parts = [];
    for (let j = from; j < selector.length; j++) {
      if (selector[j] === '(') depth++;
      else if (selector[j] === ')') {
        if (depth === 0) return { parts: [...parts, selector.slice(start, j)], end: j + 1 };
        depth--;
      } else if (selector[j] === ',' && depth === 0) {
        parts.push(selector.slice(start, j));
        start = j + 1;
      }
    }
    assert.fail(`unclosed ( in ${selector}`);
  };
  while (i < selector.length) {
    const rest = selector.slice(i);
    let m;
    if ((m = /^:(is|not|where)\(/.exec(rest))) {
      const { parts, end } = args(i + m[0].length);
      if (m[1] !== 'where') b += Math.max(...parts.map((p) => classes(p.trim())));
      i = end;
    } else if ((m = /^\[[^\]]*\]/.exec(rest))) {
      b++;
      i += m[0].length;
    } else if ((m = /^::[a-z-]+/.exec(rest))) i += m[0].length;
    else if ((m = /^[.:][a-z-]+/.exec(rest))) {
      b++;
      i += m[0].length;
    } else i++;
  }
  return b;
};

const SERIALIZED = serialize(sheet());
const SHEET = SERIALIZED.text;
const REGISTRATIONS = serialize(registrations());
const DUR = { instant: '50ms', fast: '150ms', base: '250ms', slow: '400ms' };

// ---- §1 Mechanics of the text ----

suite('the text', () => {
  test('braces balance and nothing smells, in the sheet, every rules() and registrations()', () => {
    for (const text of [SHEET, REGISTRATIONS.text, ...effectNames.map((e) => textOf(rules(e))), ...effectNames.map((e) => textOf(rules(e, { selector: '.x' })))]) {
      assert.ok(balanced(text));
      assert.doesNotMatch(text, smells);
    }
  });
  test('no @keyframes, no :root, no transition: all, no transition-property: all', () => {
    assert.doesNotMatch(SHEET, /@keyframes|:root|transition:\s*all|transition-property:\s*all/);
  });
  test('every var(--duration- and var(--ease- read carries a fallback, and the four durations are Animation\'s literals', () => {
    for (const [name, fallback] of readsWithFallback(SHEET)) if (/^--(duration|ease)-/.test(name)) assert.ok(fallback, name);
    for (const [token, ms] of Object.entries(DUR)) if (SHEET.includes(`--duration-${token}`)) assert.ok(SHEET.includes(`var(--duration-${token}, ${ms})`), token);
  });
  test('every --fx-* read carries a fallback', () => {
    for (const [name, fallback] of readsWithFallback(SHEET)) if (name.startsWith('--fx-')) assert.ok(fallback, name);
  });
  test('every duration is scaled by --fx-speed', () => {
    const lines = SHEET.split('\n').filter((line) => /transition-duration:|animation:/.test(line));
    assert.ok(lines.length > 5);
    for (const line of lines) assert.match(line, /calc\(var\(--(?:fx-[a-z-]+, var\(--)?duration-[a-z]+, \d+ms\)\)? \* var\(--fx-speed, 1\)\)/);
  });
  test('sheet() twice is byte-equal, and sheet() and registrations() serialize with nothing bound', () => {
    assert.equal(serialize(sheet()).text, SHEET);
    assert.equal(textOf(sheet()), SHEET);
    assert.deepEqual(SERIALIZED.properties, []);
    assert.deepEqual(REGISTRATIONS.properties, []);
    assert.equal(REGISTRATIONS.text, textOf(registrations()));
  });
});

// ---- §2 Names both ways ----

suite('properties', () => {
  test('defines is every --fx-* declared or read, both ways; nothing else is declared', () => {
    const own = new Set([...reads(SHEET)].filter((n) => n.startsWith('--fx-')));
    for (const [name] of declared(SHEET)) {
      assert.ok(name.startsWith('--fx-'), `${name} declared outside --fx-`);
      own.add(name);
    }
    assert.deepEqual([...own].sort(), [...properties.defines].sort());
    assert.deepEqual([...properties.defines].sort(), knobNames.map((k) => `--fx-${k}`).sort());
    assert.deepEqual(properties.overrides, []);
  });
  test('reads is every foreign read the sheet or transition() can make, both ways', () => {
    const foreign = new Set([...reads(SHEET)].filter((n) => !n.startsWith('--fx-')));
    for (const name of foreign) assert.ok(properties.reads.includes(name), name);
    for (const d of durationTokens) for (const e of easeTokens) for (const n of reads(transition(['opacity'], { duration: d, ease: e }))) if (!n.startsWith('--fx-')) foreign.add(n);
    assert.deepEqual([...properties.reads].sort(), [...foreign].sort());
    for (const name of properties.reads) assert.match(name, /^--(duration|ease|shadow)-|^--color-accent$/);
  });
  test('every anim-* referenced is one of the four idents or the shake twin', () => {
    assert.deepEqual([...idents(SHEET)].sort(), ['anim-fade-in', 'anim-fade-out', 'anim-pulse', 'anim-shake', 'anim-shake-again']);
  });
  test('the hook is read off attributes', () => {
    assert.deepEqual(attributes, { fx: 'data-fx' });
    assert.ok(SHEET.includes(`[${attributes.fx}~=`));
  });
});

suite('the imports agree with their owners', () => {
  test("Animation: durations, eases, every keyframe row's ident and pace, the twins", () => {
    assert.deepEqual(DUR, animation.defaults.durations);
    assert.deepEqual([...durationTokens], Object.keys(animation.defaults.durations));
    assert.deepEqual([...easeTokens], Object.keys(animation.defaults.eases));
    for (const token of durationTokens) assert.ok(transition(['opacity'], { duration: token }).includes(`var(--duration-${token}, ${animation.defaults.durations[token]})`), token);
    for (const token of easeTokens) assert.ok(transition(['opacity'], { ease: token }).includes(`var(--ease-${token}, ${animation.defaults.eases[token]})`), token);
    for (const name of /** @type {const} */ (['fade-in', 'fade-out', 'pulse', 'shake'])) {
      const v = animation.vocabulary[name];
      const row = blockOf(textOf(rules(name)), `[data-fx~="${name}"][data-fx]`);
      assert.ok(row.includes(`animation: ${animation.ident(name)} calc(var(--duration-${v.duration}, ${animation.defaults.durations[v.duration]}) * var(--fx-speed, 1)) var(--ease-${v.ease}, ${animation.defaults.eases[v.ease]}) ${v.iterations}`), name);
    }
    for (const id of idents(SHEET)) assert.ok(animation.keyframes.includes(id), id);
    for (const name of restartable) assert.ok(animation.vocabulary[name].again, `${name} has no -again twin in Animation`);
  });
  test("Theme: every shadow read carries shadowDefaults, the accent carries defaults['--color-accent']", () => {
    for (const [step, value] of Object.entries(theme.shadowDefaults)) if (SHEET.includes(`--shadow-${step},`)) assert.ok(SHEET.includes(`var(--shadow-${step}, ${value})`), step);
    assert.equal(knobDefaults['shadow-lifted'], `var(--shadow-md, ${theme.shadowDefaults.md})`);
    assert.equal(knobDefaults['flash-color'], `var(--color-accent, ${theme.defaults['--color-accent']})`);
  });
  test('no anim-* ident is a literal in the source, and nothing of anim-flash is named', () => {
    const dir = new URL('../src/libraries/css/effects/', import.meta.url);
    for (const file of readdirSync(dir)) {
      const code = readFileSync(new URL(file, dir), 'utf8').replace(/\/\*[^]*?\*\//g, '');
      assert.doesNotMatch(code, /['"`]anim-/, file);
    }
    assert.doesNotMatch(SHEET, /anim-flash|--anim-/);
  });
});

// ---- §3 The round trip that makes channel A safe ----

suite('fx()', () => {
  test('every word fx() can say has a [data-fx~="word"] row in sheet()', () => {
    const words = new Set();
    for (const effect of stateful) {
      words.add(fx({ [effect]: true }));
      for (const state of stateNames) words.add(fx({ [effect]: state }));
    }
    for (const effect of /** @type {const} */ (['waiting', 'fade', 'fade-in', 'fade-out'])) words.add(fx({ [effect]: true }));
    words.add(fx({ shake: 1 })).add(fx({ shake: 2 })).add(fx({ flash: 1 }));
    for (const [level] of LEVELS) words.add(fx({ elevation: level }));
    assert.equal(words.size, stateful.length * (stateNames.length + 1) + 4 + 3 + 4);
    for (const word of words) assert.ok(SHEET.includes(`[data-fx~="${word}"]`), word);
  });
  test('fixed order, byte-stable, states sorted', () => {
    const a = fx({ elevation: 2, shake: 3, dim: 'busy', lift: ['selected', 'hover'] });
    const b = fx({ lift: ['hover', 'selected'], dim: ['busy'], shake: 1, elevation: 2 });
    assert.equal(a, 'lift:hover lift:selected dim:busy shake elevation-2');
    assert.equal(a, b);
  });
  test('parity: shake 1|3 → shake, 2 → shake-again, true → shake; flash any count → flash; 0/false/undefined/null absent', () => {
    assert.equal(fx({ shake: 1 }), 'shake');
    assert.equal(fx({ shake: 3 }), 'shake');
    assert.equal(fx({ shake: 2 }), 'shake-again');
    assert.equal(fx({ shake: true }), 'shake');
    assert.equal(fx({ flash: 2 }), 'flash');
    assert.equal(fx({ flash: 3 }), 'flash');
    assert.equal(fx({ shake: 0, flash: false, lift: undefined, dim: null, elevation: false }), null);
    assert.deepEqual(restartable, ['shake']);
  });
  test('null when nothing survives; elevation 0 is a word', () => {
    assert.equal(fx({}), null);
    assert.equal(fx({ elevation: 0 }), 'elevation-0');
    assert.deepEqual(specKeys, ['lift', 'dim', 'blur', 'frost', 'waiting', 'fade', 'fade-in', 'fade-out', 'pulse', 'shake', 'flash', 'elevation']);
  });
  test('throws naming the known set', () => {
    assert.throws(() => fx(bad({ lft: true })), /the keys are lift, dim, .*elevation$/);
    assert.throws(() => fx(bad({ lift: 'hovered' })), /the states are hover, focus/);
    assert.throws(() => fx({ shake: 1.5 }), /not a count; give the number of times/);
    assert.throws(() => fx({ shake: -1 }), /not a count/);
    assert.throws(() => fx(bad({ fade: 'open' })), /takes no state or count/);
    assert.throws(() => fx(bad({ elevation: 4 })), /the levels are 0, 1, 2, 3/);
    assert.throws(() => fx(null), /give an object/);
  });
});

// ---- §4 Runtime shape ----

suite('the sheet', () => {
  test('every selector is :where or at least (0,2,0)', () => {
    const all = preludes(SHEET);
    assert.ok(all.length > 60, `only ${all.length} selectors`);
    for (const selector of all) {
      if (selector.startsWith(':where(')) assert.equal(classes(selector), 0, selector);
      else assert.ok(classes(selector) >= 2, `${selector} is (0,${classes(selector)},x)`);
    }
  });
  test('setup is :where([data-fx]) with the transitioned list; the fade rows are the only other transition-property on the hook', () => {
    const setup = blockOf(SHEET, ':where([data-fx])');
    assert.ok(setup.includes(`transition-property: ${transitioned.join(', ')};`));
    const properties = [...SHEET.matchAll(/transition-property:\s*([^;]+);/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(properties)].sort(), ['opacity', 'opacity, display, overlay', transitioned.join(', ')]);
  });
  test('sheet({ states: [] }) has steady rows only; states trim the matrix', () => {
    const steady = textOf(sheet({ states: [] }));
    assert.doesNotMatch(steady, /\[data-fx~="[a-z]+:/);
    for (const effect of effectNames) assert.ok(steady.includes(`[data-fx~="${effect}"][data-fx]`), effect);
    const some = textOf(sheet({ states: ['hover'] }));
    assert.ok(some.includes('[data-fx~="lift:hover"]'));
    assert.ok(!some.includes('[data-fx~="lift:busy"]'));
    throwsShape(() => sheet({ states: bad(['hovered']) }));
    throwsShape(() => sheet(bad({ state: ['hover'] })));
    throwsShape(() => sheet({ states: bad('hover') }));
  });
  test('every rule group opens with its own describe() sentence, in effectNames order', () => {
    let last = -1;
    for (const effect of effectNames) {
      const at = SHEET.indexOf(`/* fx:${effect} — ${describe(effect)} */`);
      assert.ok(at > last, effect);
      last = at;
      assert.ok(textOf(rules(effect)).startsWith(`/* fx:${effect} — ${describe(effect)} */`));
    }
  });
  test('states: each is (0,1,0), every stateful effect has a row per state, and when() is balanced', () => {
    for (const state of stateNames) {
      assert.equal(classes(states[state]), 1, state);
      assert.equal(when(state), states[state]);
      for (const effect of stateful) assert.ok(SHEET.includes(`[data-fx~="${effect}:${state}"]${states[state]} {`), `${effect}:${state}`);
    }
    assert.equal(when('hover', 'busy'), ':is(:hover, :focus-visible, [aria-busy="true"])');
    assert.equal(states.open, ':is([open], :popover-open)');
    assert.equal(states.expanded, '[aria-expanded="true"]');
    assert.ok(balanced(when(...stateNames)));
    throwsShape(() => when());
  });
});

suite('rules()', () => {
  test('lift: a steady row, a hover row at :is(:hover, :focus-visible), transform not translate', () => {
    const lift = textOf(rules('lift'));
    const hover = blockOf(lift, '[data-fx~="lift:hover"]:is(:hover, :focus-visible)');
    assert.match(hover, /transform: translateY\(var\(--fx-lift-rise, -2px\)\)/);
    assert.match(hover, /box-shadow: var\(--fx-shadow-lifted, var\(--shadow-md, /);
    assert.doesNotMatch(lift, /translate:/);
    assert.ok(blockOf(lift, '[data-fx~="lift"][data-fx]'));
  });
  test('on a selector: setup first, then the states given and no steady row; no states → the steady row; no data-fx at all', () => {
    const card = textOf(rules('lift', { selector: '[data-card]', states: ['hover'] }));
    assert.ok(!card.includes('data-fx'));
    assert.ok(blockOf(card, '[data-card]').includes('transition-property:'));
    assert.ok(blockOf(card, '[data-card]:is(:hover, :focus-visible)').includes('translateY'));
    assert.ok(!blockOf(card, '[data-card]').includes('translateY'));
    const dim = textOf(rules('dim', { selector: '.done' }));
    assert.equal((dim.match(/\.done \{/g) ?? []).length, 1);
    assert.ok(blockOf(dim, '.done').includes('transition-property:'));
    assert.ok(blockOf(dim, '.done').includes('opacity: var(--fx-dim, 0.5)'));
    assert.ok(!textOf(rules('flash', { selector: '.x' })).includes('transition-property: opacity, transform'));
    assert.throws(() => rules('fade', { states: ['open'] }), /takes no state/);
    assert.throws(() => rules(bad('nope')), /the effects are/);
    assert.throws(() => rules('lift', bad({ selector: ':scope', state: ['hover'] })), /"state" is not an option; the options are selector, states$/);
    assert.throws(() => rules('lift', { states: bad('hover') }), /states is not an array/);
  });
  test('elevation-n declares --fx-shadow and --fx-shadow-lifted one step up, capped', () => {
    const steps = ['none', 'sm', 'md', 'lg'];
    for (const [level, word] of LEVELS) {
      const row = Object.fromEntries(declared(blockOf(textOf(rules(word)), `[data-fx~="${word}"][data-fx]`)));
      assert.match(row['--fx-shadow'], new RegExp(`^var\\(--shadow-${steps[level]}, `));
      assert.match(row['--fx-shadow-lifted'], new RegExp(`^var\\(--shadow-${steps[Math.min(level + 1, 3)]}, `));
      assert.equal(elevation(level).split('\n').length, 3);
    }
    assert.ok(elevation(2, { lift: true }).includes('transition-property: transform, box-shadow;'));
    assert.ok(elevation(2, { lift: true }).includes(`var(--shadow-md, ${theme.shadowDefaults.md})`));
    throwsShape(() => elevation(bad(4)));
    assert.throws(() => elevation(2, bad({ lifted: true })), /"lifted" is not an option; the options are lift$/);
  });
  test('fade: @starting-style, display, overlay, allow-discrete as its own line, [hidden], dialog:not([open]), [popover]:not(:popover-open), ::backdrop', () => {
    const fade = textOf(rules('fade'));
    for (const needle of ['@starting-style', 'transition-property: opacity, display, overlay;', 'transition-behavior: allow-discrete;', '[hidden]', 'dialog:not([open])', '[popover]:not(:popover-open)', '[open]::backdrop', 'display: none;']) assert.ok(fade.includes(needle), needle);
    assert.doesNotMatch(fade, /allow-discrete[^;]*,|,[^;]*allow-discrete/);
    assert.ok(blockOf(fade, '@starting-style').includes('[data-fx~="fade"][data-fx] {'));
    const own = textOf(rules('fade', { selector: '.row' }));
    assert.ok(blockOf(own, '.row').includes('transition-duration:'));
  });
  test('flash: one ::after box from --fx-flash-color under @starting-style, position at :where, no ::before, no keyframe', () => {
    const flash = textOf(rules('flash'));
    assert.ok(blockOf(flash, ':where([data-fx~="flash"])').includes('position: relative;'));
    const box = blockOf(flash, '[data-fx~="flash"][data-fx]::after');
    assert.match(box, /background: var\(--fx-flash-color, var\(--color-accent, /);
    assert.match(box, /transition-duration: calc\(var\(--fx-flash-duration, var\(--duration-slow, 400ms\)\)/);
    assert.ok(blockOf(flash, '@starting-style').includes('opacity: 1;'));
    assert.ok(!flash.includes('::before'));
    assert.ok(!flash.includes('anim-'));
  });
  test('keyframe rows take Animation\'s pairing: shake fast/linear 1, pulse slow/in-out infinite, fade-in fast/out both, fade-out fast/in forwards', () => {
    const row = (/** @type {'shake' | 'pulse' | 'fade-in' | 'fade-out'} */ effect) => blockOf(textOf(rules(effect)), `[data-fx~="${effect}"][data-fx]`);
    assert.match(row('shake'), /animation: anim-shake calc\(var\(--duration-fast, 150ms\) \* var\(--fx-speed, 1\)\) var\(--ease-linear, linear\) 1;/);
    assert.match(textOf(rules('shake')), /\[data-fx~="shake-again"\]\[data-fx\] \{\n\s+animation: anim-shake-again /);
    assert.match(row('pulse'), /anim-pulse calc\(var\(--duration-slow, 400ms\)[^;]* var\(--ease-in-out, ease-in-out\) infinite;/);
    assert.match(row('fade-in'), /anim-fade-in [^;]* var\(--ease-out, ease-out\) 1 both;/);
    assert.match(row('fade-out'), /anim-fade-out [^;]* var\(--ease-in, ease-in\) 1 forwards;/);
  });
  test('waiting is cursor: progress and nothing else — no knob, no transition, no state, and cursor is not transitioned', () => {
    const own = textOf(rules('waiting'));
    assert.equal(blockOf(own, '[data-fx~="waiting"][data-fx]'), '[data-fx~="waiting"][data-fx] {\n  cursor: progress;\n}');
    assert.deepEqual(declared(own), []);                       // declares no --fx-* knob
    assert.deepEqual(reads(own), new Set());                   // and reads none, so it needs no fallback
    assert.doesNotMatch(own, /transition|animation/);
    assert.ok(!knobNames.some((knob) => knob.startsWith('waiting')), 'waiting has no knob');
    assert.ok(!transitioned.includes('cursor'), 'a pointer shape does not animate');
    const withState = /** @type {readonly string[]} */ ([...stateful, ...restartable]);
    assert.ok(!withState.includes('waiting'), 'waiting is steady: the model says when');
    // The only cursor in the whole sheet, and one row.
    assert.equal([...SHEET.matchAll(/cursor:/g)].length, 1);
    // It takes no state, hooked or on a selector; the `busy` state stays the stateful words'.
    throwsShape(() => rules('waiting', { states: ['busy'] }));
    throwsShape(() => rules('waiting', { selector: '.x', states: ['busy'] }));
    assert.equal(fx({ waiting: true }), 'waiting');
    assert.equal(fx({ waiting: false }), null);
    assert.equal(fx({ waiting: null }), null);
    assert.equal(fx({ waiting: true, dim: 'busy' }), 'dim:busy waiting');
    assert.throws(() => fx(bad({ waiting: 'busy' })), /write waiting: <boolean> from the model/);
  });
  test('frost frosts a dialog backdrop too', () => {
    assert.ok(textOf(rules('frost')).includes('dialog[data-fx~="frost"][data-fx]::backdrop {'));
  });
  test('registrations() registers the five literal knobs, typed, inheriting, with knobDefaults as initial', () => {
    const text = REGISTRATIONS.text;
    for (const knob of /** @type {const} */ (['speed', 'lift-rise', 'dim', 'blur', 'frost'])) {
      const at = blockOf(text, `@property --fx-${knob}`);
      assert.ok(at.includes('inherits: true;'));
      assert.ok(at.includes(`initial-value: ${knobDefaults[knob]};`), knob);
    }
    assert.equal((text.match(/@property/g) ?? []).length, 5);
    assert.ok(!text.includes('--fx-duration'));
  });
});

// ---- §5 transition() ----

suite('transition()', () => {
  test('defaults to the transitioned list, explicit, never all', () => {
    const t = transition();
    assert.ok(t.includes(`transition-property: ${transitioned.join(', ')};`));
    assert.doesNotMatch(t, /\ball\b/);
    assert.ok(t.includes('transition-duration: calc(var(--duration-fast, 150ms) * var(--fx-speed, 1));'));
    assert.ok(t.includes('transition-timing-function: var(--ease-out, ease-out);'));
    assert.ok(!t.includes('allow-discrete'));
  });
  test("['all'] is honoured because the author wrote it; [] throws", () => {
    assert.ok(transition(['all']).includes('transition-property: all;'));
    assert.throws(() => transition([]), /is empty/);
  });
  test('display, overlay, visibility add transition-behavior: allow-discrete as its own line; delay passes through', () => {
    for (const p of /** @type {const} */ (['display', 'overlay', 'visibility'])) {
      const t = transition([p, 'opacity'], { delay: '100ms' });
      assert.ok(t.split('\n').includes('transition-behavior: allow-discrete;'), p);
      assert.ok(t.includes('transition-delay: 100ms;'));
      assert.doesNotMatch(t, /transition-property:[^;]*allow-discrete/);
    }
  });
  test('a duration or ease outside the four is refused, naming them', () => {
    assert.throws(() => transition(['opacity'], { duration: bad('slower') }), /the tokens are instant, fast, base, slow/);
    assert.throws(() => transition(['opacity'], { ease: bad('bounce') }), /the tokens are linear, in, out, in-out/);
    assert.ok(transition(['opacity'], { duration: 'base', ease: 'in-out' }).includes('var(--duration-base, 250ms)'));
    assert.throws(() => transition(['opacity'], bad({ time: 'base' })), /"time" is not an option; the options are duration, ease, delay$/);
  });
});

// ---- Errors: every path, one shape ----

suite('errors', () => {
  test('every throw is one Error on one line matching /^effects: [a-z]+: .+; .+$/', () => {
    const paths = [
      () => fx(bad({ nope: true })),
      () => fx(bad({ lift: 'hovered' })),
      () => fx({ shake: 1.5 }),
      () => fx(bad({ fade: 'open' })),
      () => fx(bad({ elevation: 4 })),
      () => fx(bad([])),
      () => fx({ shake: 1, pulse: true }),
      () => transition(['all', '']),
      () => transition([]),
      () => transition(['opacity'], { duration: bad('slower') }),
      () => transition(['opacity'], { ease: bad('bounce') }),
      () => transition(['opacity'], bad({ time: 'base' })),
      () => transition(['opacity'], { delay: 'a; b' }),
      () => elevation(bad('2')),
      () => elevation(1, bad({ lifted: true })),
      () => rules(bad('nope')),
      () => rules('fade', { states: ['open'] }),
      () => rules('lift', { states: bad(['hovered']) }),
      () => rules('lift', bad({ state: ['hover'] })),
      () => rules('lift', { states: bad('hover') }),
      () => rules('lift', { selector: '' }),
      () => rules('lift', { selector: '.a { }' }),
      () => sheet({ states: bad(['x']) }),
      () => sheet(bad({ selector: '.x' })),
      () => when(),
      () => when(bad('x')),
      () => describe(bad('x')),
    ];
    for (const path of paths) throwsShape(path);
  });
  test('throw appears only in text.ts: every error path goes through fail()', () => {
    const dir = new URL('../src/libraries/css/effects/', import.meta.url);
    for (const file of readdirSync(dir)) {
      const code = readFileSync(new URL(file, dir), 'utf8').replace(/\/\*[^]*?\*\//g, '');
      if (file !== 'text.ts') assert.doesNotMatch(code, /\bthrow\b/, file);
    }
  });
});
