import { suite, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  atContainer,
  atLeast,
  below,
  between,
  block,
  breakpointNames,
  breakpoints,
  clampBetween,
  fluid,
  fluidDeclarations,
  fluidDefaults,
  fluidValues,
  inContainer,
  media,
  properties,
  spaceSteps,
  textSteps,
  width,
} from '../dist/libraries/css/responsive/index.js';
import { StyleResult, css, serialize } from '../dist/libraries/css/templates/index.js';
import * as theme from '../dist/libraries/css/theme/index.js';

/**
 * The same functions, untyped: the negative cases feed a bad value on purpose, and only they go through this.
 * @type {any}
 */
const loose = { atContainer, atLeast, below, between, clampBetween, fluid, fluidValues, inContainer, media, width };

const FOLDER = join(import.meta.dirname, '..', 'src', 'libraries', 'css', 'responsive');
const NAMES = [...breakpointNames];
const OVERRIDES = [
  '--text-xs', '--text-sm', '--text-md', '--text-lg', '--text-xl', '--text-2xl', '--text-3xl',
  '--space-0', '--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--space-7', '--space-8',
];
const FLUID_SPACE = spaceSteps.filter((s) => s !== '0');

/** The header's table: the derivation from Theme's literals, printed at Theme's places. */
const TABLE = {
  text: { xs: [0.64, 0.72], sm: [0.8, 0.9], md: [1, 1.125], lg: [1.25, 1.406], xl: [1.563, 1.758], '2xl': [1.953, 2.197], '3xl': [2.441, 2.747] },
  space: { 1: [0.25, 0.3125], 2: [0.5, 0.625], 3: [0.75, 0.9375], 4: [1, 1.25], 5: [1.5, 1.875], 6: [2, 2.5], 7: [3, 3.75], 8: [4, 5] },
};

/** Every output of every function passes these two. */
const balanced = (text) => (text.match(/\{/g) ?? []).length === (text.match(/\}/g) ?? []).length;
const clean = (text) => !/undefined|NaN|\[object Object\]|\d\.\d{5}/.test(text);
const wellFormed = (text) => {
  assert.ok(balanced(text), `braces balance in:\n${text}`);
  assert.ok(clean(text), `no undefined, NaN, [object Object] or float tail in:\n${text}`);
  return text;
};

/** A StyleResult's CSS text, as css-templates serializes it (value holes as var(--css-…)). */
const text = (result) => {
  assert.ok(result instanceof StyleResult, 'a rule-emitting function returns a StyleResult');
  return serialize(result).text;
};
/** A StyleResult's text with every bound var(--css-…) replaced by its value: what the scope element computes. */
const resolved = (result) => {
  const { text: sheet, properties } = serialize(result);
  const bound = new Map(properties.map(({ name, value }) => [name, String(value)]));
  return sheet.replace(/var\((--css-[\w-]+)\)/g, (all, name) => bound.get(name) ?? all);
};

/** The declarations of a sheet as { name: value }. */
const declarations = (text) => Object.fromEntries([...text.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));

/** The inputs out of 'clamp(<min>rem, calc(<min>rem + <delta> * (100<unit> - <from>rem) / <span>), <max>rem)'. */
const parseClamp = (value) => {
  const m = value.match(/^clamp\(([\d.]+)rem, calc\(([\d.]+)rem \+ ([\d.]+) \* \(100(vw|cqi) - ([\d.]+)rem\) \/ ([\d.]+)\), ([\d.]+)rem\)$/);
  assert.ok(m, `the documented clamp shape: ${value}`);
  return { min: Number(m[1]), base: Number(m[2]), delta: Number(m[3]), unit: m[4], from: Number(m[5]), span: Number(m[6]), max: Number(m[7]) };
};
/** clamp() as the browser computes it at a width in rem, then rounded to four places to shed float noise (not a tolerance: the decimals are exact). */
const at = (c, w) => Number(Math.min(Math.max(c.min, c.base + (c.delta * (w - c.from)) / c.span), c.max).toFixed(4));
/** The endpoints are exact by construction: the term vanishes at `from`; min + delta is max as decimals at `to`. */
const exact = (c, from, to) => {
  assert.equal(c.base, c.min, 'the calc opens with min');
  assert.equal(c.from, from);
  assert.equal(c.from + c.span, to);
  assert.equal(Number((c.min + c.delta).toFixed(4)), c.max, `min ${c.min} + delta ${c.delta} is max ${c.max}`);
  assert.equal(at(c, from), c.min);
  assert.equal(at(c, to), c.max);
  assert.equal(at(c, from - 10), c.min);
  assert.equal(at(c, to + 10), c.max);
};

suite('breakpoints', () => {
  test('exactly sm, md, lg, xl, in rem, ascending, frozen', () => {
    assert.deepEqual(Object.keys(breakpoints), NAMES);
    assert.deepEqual([...breakpointNames], NAMES);
    const values = NAMES.map((n) => breakpoints[n]);
    assert.deepEqual([...values].sort((a, b) => a - b), values);
    assert.ok(new Set(values).size === values.length);
    assert.ok(Object.isFrozen(breakpoints) && Object.isFrozen(breakpointNames));
    assert.equal(width('md'), '48rem');
    assert.equal(width('30rem'), '30rem');
  });

  test('told when wrong: an unknown name lists the four; a px width is refused', () => {
    assert.throws(() => loose.width('medium'), /^RangeError: responsive: width: no breakpoint 'medium'; the names are sm, md, lg, xl, or a width like '30rem'$/);
    assert.throws(() => loose.width('30px'), /responsive: width: no breakpoint '30px'/);
  });
});

suite('media', () => {
  test('the preludes carry the constant: >= for atLeast, < for below, a half-open band for between', () => {
    assert.equal(media.atLeast.md, '@media (width >= 48rem)');
    assert.equal(media.below.md, '@media (width < 48rem)');
    assert.equal(media.between('md', 'lg'), '@media (48rem <= width < 64rem)');
    assert.equal(media.between('md', '70rem'), '@media (48rem <= width < 70rem)');
    assert.equal(media.between('30rem', 'md'), '@media (30rem <= width < 48rem)');
    assert.ok(Object.isFrozen(media) && Object.isFrozen(media.atLeast));
  });

  test('partition: for every breakpoint, below and atLeast carry the same value with < and >=', () => {
    for (const n of NAMES) {
      assert.equal(media.below[n], `@media (width < ${breakpoints[n]}rem)`);
      assert.equal(media.atLeast[n], `@media (width >= ${breakpoints[n]}rem)`);
    }
  });

  test('the wrappers return a StyleResult whose text is @media from the constant and the rules verbatim', () => {
    const rules = '.a { color: red; }';
    assert.equal(wellFormed(text(atLeast('md', rules))), '@media (width >= 48rem) {\n.a { color: red; }\n}\n');
    assert.equal(wellFormed(text(below('md', rules))), '@media (width < 48rem) {\n.a { color: red; }\n}\n');
    assert.equal(wellFormed(text(between('md', 'lg', rules))), '@media (48rem <= width < 64rem) {\n.a { color: red; }\n}\n');
    assert.equal(wellFormed(text(atLeast('30rem', rules))), '@media (width >= 30rem) {\n.a { color: red; }\n}\n');
  });

  test('rules as a css block: its value holes stay live-bound, and the wrapper composes at statement start', () => {
    const inner = serialize(atLeast('md', css`:scope > .a { padding: ${'4px'}; }`));
    assert.match(inner.text, /^@media \(width >= 48rem\) \{\n:scope > \.a \{ padding: var\(--css-[\w-]+-0\); \}\n\}\n$/);
    assert.deepEqual(inner.properties.map((p) => p.value), ['4px']);
    const outer = serialize(css`:scope { color: red; } ${below('md', css`:scope { gap: ${'1rem'}; }`)}`);
    assert.ok(outer.text.includes('@media (width < 48rem) {\n:scope { gap: var('), outer.text);
    assert.deepEqual(outer.properties.map((p) => p.value), ['1rem']);
    assert.equal(serialize(css`:scope { color: red; } ${null}`).text, ':scope { color: red; } ', 'null at statement start is nothing: the idiom for a band the model decides');
  });

  test('preludes and wrappers agree for every name, so the two forms cannot drift', () => {
    const rules = 'x{}';
    for (const n of breakpointNames) {
      assert.equal(text(atLeast(n, rules)), text(block(media.atLeast[n], rules)));
      assert.equal(text(below(n, rules)), text(block(media.below[n], rules)));
    }
    assert.equal(text(between('sm', 'xl', rules)), text(block(media.between('sm', 'xl'), rules)));
  });

  test('empty rules emit an empty block: one css call site cannot emit nothing', () => {
    assert.equal(text(atLeast('md', '')), '@media (width >= 48rem) {\n\n}\n');
    assert.equal(text(between('sm', 'md', '')), '@media (40rem <= width < 48rem) {\n\n}\n');
    assert.equal(text(block('@media (width >= 48rem)', '')), '@media (width >= 48rem) {\n\n}\n');
  });

  test('told when wrong: a reversed or equal band names the function and the fix; an unknown name lists the four', () => {
    assert.throws(() => loose.media.between('lg', 'md'), /^RangeError: responsive: media\.between: 'lg' \(64rem\) is not below 'md' \(48rem\); write between\('md', 'lg'\)$/);
    assert.throws(() => loose.between('lg', 'md', 'x{}'), /^RangeError: responsive: between: 'lg' \(64rem\) is not below 'md' \(48rem\); write between\('md', 'lg'\)$/);
    assert.throws(() => loose.between('md', 'md', 'x{}'), /responsive: between: 'md' \(48rem\) is not below 'md' \(48rem\); a band needs two different widths, the lower first/);
    assert.throws(() => between('lg', '30rem', 'x{}'), /responsive: between: 'lg' \(64rem\) is not below '30rem' \(30rem\)/);
    assert.throws(() => loose.atLeast('medium', 'x{}'), /^RangeError: responsive: atLeast: no breakpoint 'medium'; the names are sm, md, lg, xl, or a width like '30rem'$/);
    assert.throws(() => loose.below('48px', 'x{}'), /responsive: below: no breakpoint '48px'/);
  });
});

suite('inContainer', () => {
  test('the same verbs as media, on inline-size, against the nearest container', () => {
    assert.equal(inContainer.atLeast.md, '@container (inline-size >= 48rem)');
    assert.equal(inContainer.below.md, '@container (inline-size < 48rem)');
    assert.equal(inContainer.between('md', 'lg'), '@container (48rem <= inline-size < 64rem)');
    for (const n of NAMES) assert.equal(inContainer.atLeast[n], `@container (inline-size >= ${breakpoints[n]}rem)`);
    assert.ok(Object.isFrozen(inContainer));
  });

  test('query: a breakpoint name or a rem width means at least; a parenthesised string is the condition verbatim', () => {
    assert.equal(inContainer.query('md', 'card'), '@container card (inline-size >= 48rem)');
    assert.equal(inContainer.query('30rem', 'card'), '@container card (inline-size >= 30rem)');
    assert.equal(inContainer.query('md'), '@container (inline-size >= 48rem)');
    assert.equal(inContainer.query('(inline-size >= 30em)', 'card'), '@container card (inline-size >= 30em)');
    assert.equal(inContainer.query('(inline-size >= 30em) and (orientation: portrait)'), '@container (inline-size >= 30em) and (orientation: portrait)');
    assert.equal(inContainer.query(`(inline-size < ${width('sm')})`, 'card'), '@container card (inline-size < 40rem)');
  });

  test('atContainer emits @container <name> and the rules; the same text as block(inContainer.query(…), rules)', () => {
    assert.equal(wellFormed(text(atContainer('card', 'md', '.a{}'))), '@container card (inline-size >= 48rem) {\n.a{}\n}\n');
    assert.equal(text(atContainer('card', '(inline-size < 40rem)', '.a{}')), '@container card (inline-size < 40rem) {\n.a{}\n}\n');
    assert.equal(text(atContainer('card', 'md', '.a{}')), text(block(inContainer.query('md', 'card'), '.a{}')));
    const live = serialize(atContainer('card', 'md', css`:scope > .a { gap: ${'2px'}; }`));
    assert.deepEqual(live.properties.map((p) => p.value), ['2px']);
  });

  test('told when wrong: a px length, an empty or unparenthesised condition, a name that is not one identifier', () => {
    assert.throws(() => loose.inContainer.query('30px', 'card'), /^RangeError: responsive: inContainer\.query: '30px' is not a condition; write a breakpoint name \(sm, md, lg, xl\), a rem width like '30rem', or a parenthesised condition like '\(inline-size < 30rem\)'$/);
    assert.throws(() => loose.inContainer.query('', 'card'), /responsive: inContainer\.query: '' is not a condition/);
    assert.throws(() => loose.inContainer.query('inline-size >= 30em'), /responsive: inContainer\.query: 'inline-size >= 30em' is not a condition/);
    assert.throws(() => inContainer.query('md', 'my sidebar'), /^RangeError: responsive: inContainer\.query: 'my sidebar' is not one CSS identifier; it must equal Layout's container-name$/);
    assert.throws(() => inContainer.query('md', 'none'), /is not one CSS identifier/);
    assert.throws(() => loose.atContainer('card', '30px', '.a{}'), /responsive: atContainer: '30px' is not a condition/);
    assert.throws(() => atContainer('1st', 'md', '.a{}'), /responsive: atContainer: '1st' is not one CSS identifier/);
    assert.throws(() => loose.inContainer.between('lg', 'sm'), /responsive: inContainer\.between: 'lg' \(64rem\) is not below 'sm' \(40rem\); write between\('sm', 'lg'\)/);
  });
});

suite('hole visibility', () => {
  test('a prelude leaves the inner hole to the tag; a wrapper over css keeps it live; a string wrapper is text; an object is live values', () => {
    const x = '4px';
    assert.deepEqual(serialize(css`${media.atLeast.md} { :scope { padding: ${x}; } }`).properties.map((p) => p.value), [x]);
    assert.deepEqual(serialize(css`${atLeast('md', css`:scope { padding: ${x}; }`)}`).properties.map((p) => p.value), [x]);
    assert.deepEqual(serialize(css`${atLeast('md', `:scope { padding: ${x}; }`)}`).properties, []);
    const object = serialize(css`:scope { ${fluidValues({ scales: ['text'] })} }`);
    assert.equal(object.properties.length, textSteps.length);
    assert.ok(!object.text.includes('clamp('), 'the values are bound, not printed');
  });
});

suite('clampBetween', () => {
  test('the documented text: inputs printed, CSS interpolates, endpoints exact', () => {
    const text = clampBetween(1, 1.125, 40, 80, 'vw');
    assert.equal(text, 'clamp(1rem, calc(1rem + 0.125 * (100vw - 40rem) / 40), 1.125rem)');
    exact(parseClamp(text), 40, 80);
    assert.equal(clampBetween(1, 3, 48, 64, 'vw'), 'clamp(1rem, calc(1rem + 2 * (100vw - 48rem) / 16), 3rem)');
    assert.equal(clampBetween(1, 1.25, 40, 80, 'cqi'), 'clamp(1rem, calc(1rem + 0.25 * (100cqi - 40rem) / 40), 1.25rem)');
    assert.equal(clampBetween(1, 1.25, 40, 80), clampBetween(1, 1.25, 40, 80, 'vw'));
    assert.equal(clampBetween(0.5, 1, 0, 100, 'vw'), 'clamp(0.5rem, calc(0.5rem + 0.5 * (100vw - 0rem) / 100), 1rem)');
  });

  test('delta is the difference of the printed decimals, so awkward inputs still meet max exactly', () => {
    for (const [min, max] of [[0.64, 0.72], [1.5625, 1.7578125], [2.44140625, 2.746582], [0.1, 0.3], [1, 1.0001]]) {
      const c = parseClamp(wellFormed(clampBetween(min, max, 40, 80, 'vw')));
      exact(c, 40, 80);
    }
  });

  test('equal bounds are the plain length; four places, no tail, no -0', () => {
    assert.equal(clampBetween(1.5, 1.5, 40, 80, 'vw'), '1.5rem');
    assert.equal(clampBetween(0, 0, 40, 80, 'vw'), '0rem');
    assert.equal(clampBetween(1, 1.00001, 40, 80, 'vw'), '1rem');
    assert.ok(!clampBetween(0.64, 0.72, 40, 80, 'vw').includes('-0rem'));
  });

  test('told when wrong: min above max, from not below to, a value that is not a length, a unit that is neither', () => {
    assert.throws(() => clampBetween(2, 1, 40, 80, 'vw'), /^RangeError: responsive: clampBetween: min 2rem is above max 1rem; write clampBetween\(1, 2, …\)$/);
    assert.throws(() => clampBetween(1, 2, 80, 40, 'vw'), /responsive: clampBetween: from \(80rem\) is not below to \(40rem\); write clampBetween\(1, 2, 40, 80, …\) with from below to/);
    assert.throws(() => clampBetween(1, 2, 40, 40, 'vw'), /responsive: clampBetween: from \(40rem\) is not below to \(40rem\)/);
    assert.throws(() => clampBetween(NaN, 2, 40, 80, 'vw'), /^RangeError: responsive: clampBetween: min NaN is not a length of 0rem or more; write a finite number of rem$/);
    assert.throws(() => clampBetween(-1, 2, 40, 80, 'vw'), /responsive: clampBetween: min -1 is not a length/);
    assert.throws(() => clampBetween(1, Infinity, 40, 80, 'vw'), /responsive: clampBetween: max Infinity is not a length/);
    assert.throws(() => loose.clampBetween(1, 2, 40, 80, 'vh'), /^RangeError: responsive: clampBetween: unit 'vh' is not one of 'vw', 'cqi'; write one of them$/);
  });
});

suite('fluid', () => {
  const sheet = resolved(fluid());
  const declared = declarations(sheet);
  const values = fluidValues();

  test('the sheet starts at :root and declares every --text-<step> and --space-<step> of Names with clamp(); --space-0 is 0', () => {
    wellFormed(sheet);
    assert.ok(sheet.startsWith(':root {\n'), sheet);
    assert.deepEqual(Object.keys(declared), OVERRIDES);
    assert.equal(declared['--space-0'], '0');
    for (const name of OVERRIDES.filter((n) => n !== '--space-0')) assert.ok(declared[name].startsWith('clamp('), `${name}: ${declared[name]}`);
  });

  test('fluidValues is the atom: fluidDeclarations lists it, fluid() binds it live on the selector, properties.overrides is its keys', () => {
    assert.deepEqual(Object.keys(values), OVERRIDES);
    assert.deepEqual(declared, values);
    assert.ok(Object.isFrozen(values));
    const lines = fluidDeclarations();
    assert.ok(!lines.includes('{') && !lines.includes('}'));
    assert.equal(lines, OVERRIDES.map((n) => `${n}: ${values[n]};`).join('\n'));
    const bound = serialize(fluid());
    assert.deepEqual(bound.properties.map((p) => p.value), Object.values(values), 'sixteen bound values, in order');
    assert.ok(!bound.text.includes('clamp('), 'no value is printed into the sheet');
    assert.equal(sheet, `:root {\n${OVERRIDES.map((n) => `${n}: ${values[n]};`).join(' ')} \n}\n`);
    assert.ok(text(fluid({ selector: '.article' })).startsWith('.article {\n'));
    assert.ok(text(fluid({ selector: ':scope', relativeTo: 'container' })).startsWith(':scope {\n'));
    assert.deepEqual([...properties.defines], []);
    assert.deepEqual([...properties.reads], []);
    assert.deepEqual([...properties.overrides], OVERRIDES);
    assert.deepEqual([...textSteps], ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']);
    assert.deepEqual([...spaceSteps], ['0', '1', '2', '3', '4', '5', '6', '7', '8']);
    assert.ok(Object.isFrozen(properties) && Object.isFrozen(properties.overrides));
  });

  test("the defaults are Theme's literals, and the emitted numbers are the header's table", () => {
    assert.deepEqual(fluidDefaults.text, { base: [1, 1.125], ratio: 1.25 });
    assert.deepEqual(fluidDefaults.space, { unit: [0.25, 0.3125], multipliers: [0, 1, 2, 3, 4, 6, 8, 12, 16] });
    assert.equal(fluidDefaults.from, 'sm');
    assert.equal(fluidDefaults.to, 'xl');
    assert.ok(Object.isFrozen(fluidDefaults) && Object.isFrozen(fluidDefaults.text.base));
    for (const step of textSteps) {
      const c = parseClamp(values[`--text-${step}`]);
      assert.deepEqual([c.min, c.max], TABLE.text[step], `--text-${step}`);
      assert.equal(c.unit, 'vw');
      exact(c, breakpoints.sm, breakpoints.xl);
    }
    for (const step of FLUID_SPACE) {
      const c = parseClamp(values[`--space-${step}`]);
      assert.deepEqual([c.min, c.max], TABLE.space[step], `--space-${step}`);
      exact(c, breakpoints.sm, breakpoints.xl);
    }
  });

  test('scales, from/to, relativeTo: a scale can be left out; cqi under container; a rem band', () => {
    assert.deepEqual(Object.keys(fluidValues({ scales: ['text'] })), OVERRIDES.filter((n) => n.startsWith('--text-')));
    assert.deepEqual(Object.keys(declarations(resolved(fluid({ scales: ['space'] })))), OVERRIDES.filter((n) => n.startsWith('--space-')));
    assert.equal(text(fluid({ scales: [] })), ':root {\n\n}\n');
    const own = fluidValues({ relativeTo: 'container', from: 'md', to: 'lg' });
    for (const name of OVERRIDES.filter((n) => n !== '--space-0')) {
      const c = parseClamp(own[name]);
      assert.equal(c.unit, 'cqi');
      exact(c, 48, 64);
    }
    assert.ok(!fluidDeclarations({ relativeTo: 'container' }).includes('vw'));
    const band = parseClamp(fluidValues({ from: '30rem', to: '90rem' })['--text-md']);
    exact(band, 30, 90);
  });

  test("Theme's numbers handed in as sizes are the minimums; each grows by base[1] / base[0]; a pair sets the growth", () => {
    const sizes = { xs: 0.64, sm: 0.8, md: 1, lg: 1.25, xl: 1.563, '2xl': 1.953, '3xl': 2.441 };
    const own = fluidValues({ text: { sizes, base: [1, 2] }, scales: ['text'], from: 'md', to: 'lg' });
    for (const step of textSteps) {
      const c = parseClamp(own[`--text-${step}`]);
      assert.equal(c.min, sizes[step]);
      assert.equal(c.max, Number((sizes[step] * 2).toFixed(4)));
      exact(c, 48, 64);
    }
    const partial = fluidValues({ text: { sizes: { md: 1.1 } }, scales: ['text'] });
    assert.equal(parseClamp(partial['--text-md']).min, 1.1);
    assert.equal(parseClamp(partial['--text-md']).max, Number((1.1 * 1.125).toFixed(4)));
    assert.deepEqual([parseClamp(partial['--text-lg']).min, parseClamp(partial['--text-lg']).max], TABLE.text.lg, 'a step not given is derived');
    const space = fluidValues({ space: { sizes: { 4: 1.2 }, unit: [0.25, 0.5] }, scales: ['space'] });
    assert.deepEqual([parseClamp(space['--space-4']).min, parseClamp(space['--space-4']).max], [1.2, 2.4]);
    assert.deepEqual([parseClamp(space['--space-1']).min, parseClamp(space['--space-1']).max], [0.25, 0.5]);
    const ratio = fluidValues({ text: { ratio: 2 }, scales: ['text'] });
    assert.deepEqual([parseClamp(ratio['--text-xs']).min, parseClamp(ratio['--text-3xl']).min], [0.25, 16]);
  });

  test('an equal pair is static: the sheet is Theme’s sheet, no clamp()', () => {
    const flat = fluidValues({ text: { base: [1, 1] }, space: { unit: [0.25, 0.25] } });
    assert.equal(flat['--text-md'], '1rem');
    assert.equal(flat['--text-xl'], '1.563rem');
    assert.equal(flat['--space-4'], '1rem');
    assert.equal(flat['--space-0'], '0');
    assert.ok(Object.values(flat).every((v) => !v.includes('clamp(')));
  });

  test('monotonic: mins and maxes ascend across steps, and min is below max for every step', () => {
    const ascending = (list) => list.every((v, i) => i === 0 || v > list[i - 1]);
    const text = textSteps.map((s) => parseClamp(values[`--text-${s}`]));
    const space = FLUID_SPACE.map((s) => parseClamp(values[`--space-${s}`]));
    for (const scale of [text, space]) {
      assert.ok(ascending(scale.map((c) => c.min)));
      assert.ok(ascending(scale.map((c) => c.max)));
      assert.ok(scale.every((c) => c.min < c.max));
    }
  });

  test('determinism and reuse: equal options give equal strings and objects; every output is well formed', () => {
    assert.equal(resolved(fluid()), sheet);
    assert.equal(serialize(fluid()).key, serialize(fluid()).key, 'equal options, one variant');
    assert.deepEqual(fluidValues({ relativeTo: 'container', scales: ['text'] }), fluidValues({ relativeTo: 'container', scales: ['text'] }));
    for (const out of [sheet, fluidDeclarations(), resolved(fluid({ relativeTo: 'container', selector: '.card' })), resolved(fluid({ text: { base: [1, 1] } })), text(atContainer('card', 'md', '.a{}')), text(between('sm', 'lg', '.a{}'))]) wellFormed(out);
  });

  test('told when wrong: a pair that shrinks, a ratio of 1, bad multipliers, from not below to, a bad relativeTo, a bad size, cqi on :root', () => {
    assert.throws(() => fluid({ text: { base: [1.125, 1] } }), /^RangeError: responsive: fluid: text\.base \[1\.125, 1\] is not a pair \[min, max\] of rem with 0 < min <= max; a scale grows from min at `from` to max at `to`, or stays put with min equal to max$/);
    assert.throws(() => fluid({ space: { unit: [0, 1] } }), /responsive: fluid: space\.unit \[0, 1\] is not a pair/);
    assert.throws(() => loose.fluid({ text: { base: 1 } }), /responsive: fluid: text\.base 1 is not a pair/);
    assert.throws(() => fluid({ text: { ratio: 1 } }), /^RangeError: responsive: fluid: text\.ratio 1 is not a finite number above 1; write a ratio like 1\.25, a major third$/);
    assert.throws(() => fluid({ space: { multipliers: [0, 1] } }), /^RangeError: responsive: fluid: space\.multipliers has 2 numbers, not 9; write one per step, 0 first, ascending$/);
    assert.throws(() => fluid({ space: { multipliers: [1, 2, 3, 4, 5, 6, 7, 8, 9] } }), /responsive: fluid: space\.multipliers \[0\] is 1, not 0; --space-0 must be 0/);
    assert.throws(() => fluid({ space: { multipliers: [0, 1, 2, 2, 4, 6, 8, 12, 16] } }), /responsive: fluid: space\.multipliers \[3\] 2 is not above \[2\] 2; write them ascending/);
    assert.throws(() => loose.fluid({ from: 'xl', to: 'sm' }), /^RangeError: responsive: fluid: from 'xl' \(80rem\) is not below to 'sm' \(40rem\); write from: 'sm', to: 'xl'$/);
    assert.throws(() => fluid({ from: 'md', to: 'md' }), /responsive: fluid: from 'md' \(48rem\) is not below to 'md' \(48rem\)/);
    assert.throws(() => loose.fluid({ from: 'huge' }), /responsive: fluid: no breakpoint 'huge'; the names are sm, md, lg, xl, or a width like '30rem'/);
    assert.throws(() => loose.fluid({ relativeTo: 'sideways' }), /^RangeError: responsive: fluid: relativeTo 'sideways' is not one of 'viewport', 'container'; write one of them$/);
    assert.throws(() => loose.fluid({ scales: ['colour'] }), /responsive: fluid: scales 'colour' is not one of 'text', 'space'/);
    assert.throws(() => fluid({ text: { sizes: { sm: null } } }), /^RangeError: responsive: fluid: text\.sizes\.sm null is not a length of 0rem or more; write a finite number of rem$/);
    assert.throws(() => fluid({ space: { sizes: { 3: -1 } } }), /responsive: fluid: space\.sizes\.3 -1 is not a length/);
    assert.throws(() => fluid({ relativeTo: 'container', selector: ' :root ' }), /responsive: fluid: relativeTo 'container' with selector ':root'/);
    assert.throws(() => fluid({ relativeTo: 'container' }), /^RangeError: responsive: fluid: relativeTo 'container' with selector ':root'; :root is above every container, so pass the selector of an element inside one — the component's root, e\.g\. selector: '\.card'$/);
  });

  test('told when wrong: an unknown option key, at any level, names the key and lists the accepted ones', () => {
    assert.throws(() => loose.fluid({ colour: 'red' }), /^RangeError: responsive: fluid: unknown option 'colour'; the options are from, to, relativeTo, scales, text, space, selector$/);
    assert.throws(() => loose.fluidValues({ scope: ':root' }), /responsive: fluid: unknown option 'scope'; the options are from, to, relativeTo, scales, text, space, selector/);
    assert.throws(() => loose.fluid({ text: { steps: 7 } }), /^RangeError: responsive: fluid: unknown option 'text\.steps'; the options are base, ratio, sizes$/);
    assert.throws(() => loose.fluid({ space: { base: [1, 2] } }), /responsive: fluid: unknown option 'space\.base'; the options are unit, multipliers, sizes/);
    assert.throws(() => loose.fluid({ text: { sizes: { huge: 3 } } }), /responsive: fluid: unknown option 'text\.sizes\.huge'; the options are xs, sm, md, lg, xl, 2xl, 3xl/);
    assert.throws(() => loose.fluid({ space: { sizes: { 0: 1 } } }), /responsive: fluid: unknown option 'space\.sizes\.0'; the options are 1, 2, 3, 4, 5, 6, 7, 8/);
  });
});

suite('Theme is the source', () => {
  const values = fluidValues();

  test("the step names are Theme's own exports, not copies", () => {
    assert.equal(textSteps, theme.textSteps);
    assert.equal(spaceSteps, theme.spaceSteps);
  });

  test("the defaults are computed from Theme's scaleDefaults, and every minimum is Theme's printed value", () => {
    const scale = theme.scaleValues();
    assert.equal(`${fluidDefaults.text.base[0]}rem`, theme.scaleDefaults.type.base);
    assert.equal(fluidDefaults.text.ratio, theme.scaleDefaults.type.ratio);
    assert.equal(`${fluidDefaults.space.unit[0]}rem`, theme.scaleDefaults.space.unit);
    assert.equal(fluidDefaults.space.multipliers, theme.scaleDefaults.space.multipliers);
    for (const step of textSteps) assert.equal(`${parseClamp(values[`--text-${step}`]).min}rem`, scale.text[step], `--text-${step} at and below from`);
    for (const step of FLUID_SPACE) assert.equal(`${parseClamp(values[`--space-${step}`]).min}rem`, scale.space[step], `--space-${step} at and below from`);
  });

  test("other inputs run Theme's derivation too: a static pair is Theme's scale for those inputs, byte for byte", () => {
    const type = { base: '1.1rem', ratio: 1.333 };
    const space = { unit: '0.3rem', multipliers: [0, 1, 2, 4, 5, 8, 10, 14, 20] };
    const scale = theme.scaleValues({ type, space });
    const flat = fluidValues({ text: { base: [1.1, 1.1], ratio: 1.333 }, space: { unit: [0.3, 0.3], multipliers: space.multipliers } });
    for (const step of textSteps) assert.equal(flat[`--text-${step}`], scale.text[step]);
    for (const step of spaceSteps) assert.equal(flat[`--space-${step}`], scale.space[step]);
  });
});

suite('the folder', () => {
  const files = readdirSync(FOLDER).filter((f) => f.endsWith('.ts'));
  const source = Object.fromEntries(files.map((f) => [f, readFileSync(join(FOLDER, f), 'utf8')]));
  const comments = (text) => [...text.matchAll(/\/\*[\s\S]*?\*\/|\/\/.*$/gm)].map(([c]) => c).join('\n');

  test('imports stay inside the import matrix: this folder, the templates index, the Theme index', () => {
    assert.ok(files.length >= 5, files.join(', '));
    const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const targets = files.flatMap((f) => [...code(source[f]).matchAll(/^(?:import|export)[^'"\n]*?from\s+['"]([^'"]+)['"]/gm)].map(([, target]) => `${f}: ${target}`));
    assert.ok(targets.length >= 5, 'the imports were found');
    assert.deepEqual(targets.filter((line) => !/: (?:\.\/[\w-]+|\.\.\/templates\/index|\.\.\/theme\/index)\.ts$/.test(line)), []);
    assert.ok(targets.some((line) => line.endsWith('../theme/index.ts')), 'Theme is imported');
    for (const f of files) assert.doesNotMatch(comments(source[f]), /\bimport\b[^\n]*\bfrom\s+['"]/, `${f}: no import … from '…' quoted in a comment`);
  });

  test('no --css- name and no @property in the engine\'s code (comments may name them)', () => {
    const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const f of files) {
      assert.ok(!code(source[f]).includes('--css-'), f);
      assert.ok(!code(source[f]).includes('@property'), f);
    }
  });

  test("README.md states the table, the two-line rule, the cascade rule pointing at Theme's, the component fragment and the floor", () => {
    const header = readFileSync(join(FOLDER, 'README.md'), 'utf8');
    for (const [step, [min, max]] of Object.entries(TABLE.text)) assert.match(header, new RegExp(`\\b${step}\\s+${min}rem\\s+${max}rem`), `--text-${step}`);
    for (const [step, [min, max]] of Object.entries(TABLE.space)) assert.match(header, new RegExp(`\\b${step}\\s+${min}rem\\s+${max}rem`), `--space-${step}`);
    for (const said of ['A component asks its container', 'The shell asks the viewport', "applied after Theme's, on the same selector", "is Theme's to state, and its README states it", "${fluid({ selector: ':scope'", "${atLeast('md', css`", 'Chrome 118, Safari 17.4, Firefox 146', 'breakpoints.ts']) {
      assert.ok(header.includes(said), said);
    }
  });
});
