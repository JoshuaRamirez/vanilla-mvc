import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  accent, assign, color, defaults, font, leading, modes as modesStyle, modesText, palette as paletteStyle, paletteText, palettes, properties, radius, resolvePalette,
  scaleNumbers, scales as scalesStyle, scalesText, scaleValues, shadow, space, stroke, text, theme as themeStyle, ThemeError, themeText, tokens, weight,
} from '../dist/libraries/css/theme/index.js';
import { css, serialize, StyleResult } from '../dist/libraries/css/templates/index.js';

// theme(), scales(), palette() and modes() return a StyleResult; the assertions below read
// its text through serialize, what the styling seam adopts. The first test pins that the text is
// exactly the *Text() function's, so every other assertion is about both.
/** @param {import('../dist/libraries/css/templates/index.js').StyleResult} result */
const textOf = (result) => serialize(result).text;
/** @param {Parameters<typeof themeStyle>[0]} [o] */
const theme = (o) => textOf(themeStyle(o));
/** @param {Parameters<typeof scalesStyle>[0]} [o] */
const scales = (o) => textOf(scalesStyle(o));
/** @param {Parameters<typeof paletteStyle>[0]} p @param {Parameters<typeof paletteStyle>[1]} [o] */
const palette = (p, o) => textOf(paletteStyle(p, o));
/** @param {string} [on] */
const modes = (on) => textOf(modesStyle(on));
/** The shipped palette names, typed. */
const paletteNames = /** @type {('neutral' | 'accent')[]} */ (Object.keys(palettes));
/** A ThemeError whose message matches. @param {() => unknown} fn @param {RegExp} message */
const throws = (fn, message) => assert.throws(fn, (/** @type {any} */ e) => (e instanceof ThemeError && message.test(e.message) ? true : new Error(`${e.constructor.name}: ${e.message}`)));
/** A negative case feeding a bad value on purpose. @type {any} */
const bad = (v) => v;

// The guaranteed names, copied from the contract as the independent check.
const GUARANTEED = {
  color: ['surface', 'surface-raised', 'text', 'text-muted', 'accent', 'on-accent', 'border', 'focus', 'danger', 'success', 'warning'],
  space: ['0', '1', '2', '3', '4', '5', '6', '7', '8'],
  text: ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'],
  font: ['body', 'heading', 'mono'],
  leading: ['tight', 'normal', 'loose'],
  weight: ['normal', 'medium', 'bold'],
  radius: ['none', 'sm', 'md', 'lg', 'full'],
  shadow: ['none', 'sm', 'md', 'lg'],
  stroke: ['hairline'],
};
const PREFIXES = Object.keys(GUARANTEED);
const NAMES = PREFIXES.flatMap((p) => GUARANTEED[p].map((n) => `--${p}-${n}`));

/** The text without its comments: what the browser acts on. */
const rules = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
/** Every `--name: value;` in a text, last declaration wins. */
const declared = (css) => new Map([...css.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map(([, name, value]) => [name, value]));
const rem = (value) => {
  assert.match(value, /^(?:0|\d*\.?\d+rem)$/, value);
  return value === '0' ? 0 : Number(value.slice(0, -3));
};
const ascending = (values) => values.every((v, i) => i === 0 || v > values[i - 1]);
/** The L of an oklch() colour, in percentage points. */
const lightness = (colour) => {
  const match = /^oklch\((\d+(?:\.\d+)?)% /.exec(colour);
  assert.ok(match, `${colour} is oklch()`);
  return Number(match[1]);
};

const sheet = theme();

test('StyleResult: theme(), scales(), palette(), modes() are one css call each whose text is the *Text() string, verbatim, with nothing bound', () => {
  const pairs = [
    [themeStyle(), themeText()],
    [themeStyle({ palette: 'accent', selector: '.x' }), themeText({ palette: 'accent', selector: '.x' })],
    [scalesStyle(), scalesText()],
    [paletteStyle('accent', { selector: '.promo' }), paletteText('accent', { selector: '.promo' })],
    [modesStyle(), modesText()],
  ];
  for (const [result, string] of pairs) {
    assert.ok(result instanceof StyleResult);
    assert.equal(result.values.length, 1);
    assert.equal(result.values[0], string);
    const out = serialize(result);
    assert.equal(out.text, string);
    assert.deepEqual(out.properties, []);
  }
  const composed = serialize(css`${themeStyle()} .card { padding: ${space(4)}; }`);
  assert.ok(composed.text.startsWith(themeText()), 'composes inline at statement start');
  assert.equal(composed.properties.length, 1, 'the reader in value position is the one bound value');
});

test('scaleNumbers() is scaleValues() in rem as numbers, exactly: text and space, defaults and options; rem only', () => {
  for (const o of [undefined, { type: { ratio: 1.2, base: '1.125rem' }, space: { unit: '0.2rem', multipliers: [0, 1, 2, 3, 5, 8, 13, 21, 34] } }]) {
    const values = scaleValues(o);
    const numbers = scaleNumbers(o);
    assert.deepEqual(Object.keys(numbers).sort(), ['space', 'text']);
    for (const group of /** @type {const} */ (['text', 'space'])) {
      assert.deepEqual(Object.keys(numbers[group]), Object.keys(values[group]));
      for (const [step, v] of Object.entries(values[group])) assert.equal(numbers[group][step], rem(v), `${group} ${step}`);
    }
  }
  assert.equal(scaleNumbers().space['0'], 0);
  assert.equal(scaleNumbers().text.md, 1);
  throws(() => scaleNumbers({ space: { unit: '4px' } }), /^theme: scaleNumbers\(\): space\.unit must be in rem for a numeric scale; got "4px"; use scaleValues\(\) for other units$/);
  throws(() => scaleNumbers({ type: { base: '16px' } }), /^theme: scaleNumbers\(\): type\.base must be in rem/);
});

test('an unknown option key is refused by name with the accepted keys; scope names selector', () => {
  throws(() => themeStyle(bad({ scope: '.x' })), /^theme: theme\(\): "scope" is not an option — the rule's selector is the option named selector; options keys are selector, space, type, fonts, leading, weight, radius, stroke, palette, shadow, set$/);
  throws(() => scalesStyle(bad({ scope: '.x' })), /^theme: scales\(\): "scope" is not an option — .*; options keys are selector, space, type, fonts, leading, weight, radius, stroke$/);
  throws(() => paletteStyle('neutral', bad({ scope: '.x' })), /^theme: palette\(\): "scope" is not an option — .*; options keys are selector, shadow$/);
  throws(() => themeStyle(bad({ space: { unti: '1rem' } })), /^theme: theme\(\): space\.unti is not an option; space keys are unit, multipliers$/);
  throws(() => themeStyle(bad({ shadow: { xl: 'none' } })), /^theme: theme\(\): shadow\.xl is not an option; shadow keys are none, sm, md, lg$/);
  throws(() => scaleValues(bad({ fonts: { serif: 'Georgia' } })), /^theme: scaleValues\(\): fonts\.serif is not an option; fonts keys are body, heading, mono$/);
  throws(() => scaleNumbers(bad({ pallete: 'accent' })), /^theme: scaleNumbers\(\): "pallete" is not an option; options keys are /);
  throws(() => themeStyle(bad('dark')), /^theme: theme\(\): options must be an object; got "dark"$/);
});

test('the guarantees: no root font-size, no @property, the sixteen scale names declared once, on :root', () => {
  for (const css of [sheet, theme({ palette: 'accent' })]) {
    assert.doesNotMatch(rules(css), /(^|[\s;{])font-size\s*:/m);
    assert.doesNotMatch(css, /@property/);
  }
  const scale = [...GUARANTEED.text.map((s) => `--text-${s}`), ...GUARANTEED.space.map((s) => `--space-${s}`)];
  assert.equal(scale.length, 16);
  const blocks = [...rules(sheet).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({ sel: sel.trim(), body }));
  for (const name of scale) {
    const where = blocks.filter((b) => new RegExp(`(^|\\s)${name}:`).test(b.body)).map((b) => b.sel);
    assert.deepEqual(where, [':root'], name);
  }
});

test('--stroke-hairline is the round-4 token: one border width, mode-independent, on :root, with one name in its group', () => {
  assert.deepEqual([...GUARANTEED.stroke], ['hairline'], 'exactly one stroke step is guaranteed');
  assert.equal(stroke('hairline'), 'var(--stroke-hairline, 1px)');
  assert.equal(defaults['--stroke-hairline'], '1px');
  assert.equal(scaleValues().stroke.hairline, '1px');
  assert.equal(declared(sheet).get('--stroke-hairline'), '1px');
  // A width, not a colour: one literal, no light-dark(), and it is there on a scoped sheet too.
  assert.doesNotMatch(defaults['--stroke-hairline'], /light-dark\(/);
  assert.equal(declared(theme({ selector: '.x' })).get('--stroke-hairline'), '1px');
  // It is declared exactly once, on ':root', like every other scale name.
  const blocks = [...rules(sheet).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({ sel: sel.trim(), body }));
  assert.deepEqual(blocks.filter((b) => /(^|\s)--stroke-hairline:/.test(b.body)).map((b) => b.sel), [':root']);
  // The author's own width, through the scale option and through set; assign() is its subtree form.
  assert.equal(declared(theme({ stroke: { hairline: '0.0625rem' } })).get('--stroke-hairline'), '0.0625rem');
  assert.equal(declared(theme({ set: { '--stroke-hairline': '2px' } })).get('--stroke-hairline'), '2px');
  assert.deepEqual(assign({ stroke: { hairline: '2px' } }), { '--stroke-hairline': '2px' });
  throws(() => stroke(bad('thick')), /^theme: stroke\(\): "thick" is not a name; stroke names are hairline$/);
  throws(() => scaleValues(bad({ stroke: { thick: '2px' } })), /^theme: scaleValues\(\): stroke\.thick is not an option; stroke keys are hairline$/);
  throws(() => tokens({ stroke: { hairline: '' } }), /^theme: tokens\(\): stroke\.hairline is "" — omit the key or pass undefined to leave the token alone$/);
});

test('properties: 46 defined names, each under an owned prefix, no duplicates; reads and overrides are empty', () => {
  assert.equal(properties.defines.length, 46);
  assert.equal(new Set(properties.defines).size, properties.defines.length);
  assert.deepEqual(properties.defines.filter((name) => !PREFIXES.some((p) => name.startsWith(`--${p}-`))), []);
  assert.deepEqual([...properties.reads], []);
  assert.deepEqual([...properties.overrides], []);
});

test('every name in properties.defines and every guaranteed name is declared by theme()', () => {
  const names = declared(sheet);
  assert.deepEqual(properties.defines.filter((name) => !names.has(name)), []);
  assert.deepEqual(NAMES.filter((name) => !names.has(name)), []);
  assert.deepEqual(NAMES.filter((name) => !properties.defines.includes(name)), []);
});

test('every declared custom property is one this engine owns', () => {
  assert.deepEqual([...declared(sheet).keys()].filter((name) => !properties.defines.includes(name)), []);
});

test('the text is whole: braces balance; no undefined, NaN or [object Object]', () => {
  for (const css of [sheet, theme({ palette: 'accent' }), scales(), palette('neutral'), modes(), themeText(), scalesText(), paletteText('neutral'), modesText()]) {
    assert.equal((css.match(/{/g) ?? []).length, (css.match(/}/g) ?? []).length);
    assert.doesNotMatch(css, /undefined|NaN|\[object Object\]/);
  }
});

test('every colour role of both palettes is one light-dark(<light>, <dark>) with two non-empty arguments', () => {
  for (const name of paletteNames) {
    const names = declared(palette(name));
    for (const role of GUARANTEED.color) {
      const match = /^light-dark\((.+),\s*(.+)\)$/.exec(names.get(`--color-${role}`));
      assert.ok(match, `${name}: --color-${role} is ${names.get(`--color-${role}`)}`);
      assert.ok(match[1].trim() && match[2].trim());
    }
    const { light, dark } = resolvePalette(name);
    for (const role of GUARANTEED.color) assert.ok(light[role] && dark[role], `${name}: ${role} resolves in both modes`);
  }
});

test('mode-dependent shadows are one light-dark() each; --shadow-none is none', () => {
  const names = declared(sheet);
  assert.equal(names.get('--shadow-none'), 'none');
  for (const step of ['sm', 'md', 'lg']) assert.match(names.get(`--shadow-${step}`), /light-dark\(.+,\s*.+\)/);
});

test('modes: :root is color-scheme: light dark (the system, natively, no media query), and the data-theme rules come after every :root', () => {
  assert.match(sheet, /:root \{ color-scheme: light dark; \}/);
  assert.doesNotMatch(sheet, /prefers-color-scheme|@media/);
  assert.match(sheet, /\[data-theme="light"\] \{ color-scheme: light; \}/);
  assert.match(sheet, /\[data-theme="dark"\] \{ color-scheme: dark; \}/);
  const lastRoot = sheet.lastIndexOf(':root {');
  assert.ok(sheet.indexOf('[data-theme="light"]') > lastRoot);
  assert.ok(sheet.indexOf('[data-theme="dark"]') > lastRoot);
  assert.equal(modes('.x').match(/\.x \{ color-scheme: light dark; \}/g).length, 1);
});

test('--space-0 is 0; space and text steps ascend; --text-md is the type base', () => {
  const names = declared(sheet);
  assert.equal(names.get('--space-0'), '0');
  assert.ok(ascending(GUARANTEED.space.map((s) => rem(names.get(`--space-${s}`)))));
  assert.ok(ascending(GUARANTEED.text.map((s) => rem(names.get(`--text-${s}`)))));
  assert.equal(names.get('--text-md'), '1rem');
});

test('a custom ratio, base and unit rescale every step', () => {
  const names = declared(theme({ type: { ratio: 1.2, base: '1.125rem' }, space: { unit: '0.2rem' } }));
  assert.equal(names.get('--text-md'), '1.125rem');
  assert.equal(names.get('--text-lg'), '1.35rem');
  assert.equal(names.get('--space-4'), '0.8rem');
  assert.equal(names.get('--space-8'), '3.2rem');
  assert.ok(ascending(GUARANTEED.text.map((s) => rem(names.get(`--text-${s}`)))));
});

test('a token is a leaf: theme() reads nothing and derives nothing in the sheet — no var(, no calc( — and is pure', () => {
  for (const css of [sheet, theme({ palette: 'accent', selector: '.x' }), theme({ type: { ratio: 1.2 }, space: { unit: '0.2rem' } })]) {
    assert.doesNotMatch(rules(css), /var\(/);
    assert.doesNotMatch(rules(css), /calc\(/);
  }
  assert.equal(theme(), sheet);
});

test('composition is verbatim: theme() carries scales() and palette(); a selector carries no bare :root and no mode of its own', () => {
  assert.ok(sheet.includes(scales()));
  assert.ok(sheet.includes(palette('neutral')));
  assert.ok(sheet.includes(modes()));
  assert.ok(theme({ palette: 'accent' }).includes(palette('accent')));
  const scoped = theme({ selector: '.x' });
  assert.doesNotMatch(scoped, /:root/);
  assert.doesNotMatch(scoped, /color-scheme:/);
  assert.equal(declared(scoped).size, 46);
  const promo = palette('accent', { selector: '.promo' });
  assert.match(promo, /^\.promo \{$/m);
  assert.doesNotMatch(promo, /:root/);
  assert.equal(promo.split('{').length, 2);
});

test('the two shipped palettes resolve every role in both modes and differ in accent; a palette of your own is accepted', () => {
  const neutral = resolvePalette('neutral');
  const accent = resolvePalette('accent');
  for (const mode of ['light', 'dark']) assert.deepEqual(Object.keys(neutral[mode]).sort(), [...GUARANTEED.color].sort());
  assert.notEqual(neutral.light.accent, accent.light.accent);
  const brand = resolvePalette({ name: 'brand', accent: 30, chroma: 0.18, light: { accent: '#c2410c', 'on-accent': '#fff' } });
  assert.equal(brand.light.accent, '#c2410c');
  assert.equal(brand.light['on-accent'], '#fff');
  assert.match(brand.dark.accent, /^oklch\(72% 0\.18 30\)$/);
  assert.ok(theme({ palette: { name: 'brand', accent: 30 } }).includes('palette "brand"'));
});

test('on-accent is dark ink on a light accent and near-white on a dark one', () => {
  const { light, dark } = resolvePalette('neutral');
  assert.ok(lightness(light.accent) < 66 && lightness(light['on-accent']) >= 95);
  assert.ok(lightness(dark.accent) >= 66 && lightness(dark['on-accent']) <= 20);
});

test('contrast proxy: text against surface and on-accent against accent differ by at least 55 L points, every palette, both modes', () => {
  for (const name of paletteNames) {
    const resolved = resolvePalette(name);
    for (const mode of ['light', 'dark']) {
      const roles = resolved[mode];
      assert.ok(Math.abs(lightness(roles.text) - lightness(roles.surface)) >= 55, `${name} ${mode}: text vs surface`);
      assert.ok(Math.abs(lightness(roles['on-accent']) - lightness(roles.accent)) >= 55, `${name} ${mode}: on-accent vs accent`);
    }
  }
});

test('readers write var(--name, <this engine default>); a colour default is the light-dark() pair', () => {
  const { light, dark } = resolvePalette('neutral');
  assert.equal(color('accent'), `var(--color-accent, light-dark(${light.accent}, ${dark.accent}))`);
  assert.equal(space(4), 'var(--space-4, 1rem)');
  assert.equal(space('4'), space(4));
  assert.equal(space('0'), 'var(--space-0, 0)');
  assert.equal(text('lg'), 'var(--text-lg, 1.25rem)');
  assert.equal(font('mono'), `var(--font-mono, ${scaleValues().font.mono})`);
  assert.equal(leading('tight'), 'var(--leading-tight, 1.2)');
  assert.equal(weight('bold'), 'var(--weight-bold, 700)');
  assert.equal(radius('full'), 'var(--radius-full, 9999px)');
  assert.equal(shadow('none'), 'var(--shadow-none, none)');
  assert.match(shadow('sm'), /^var\(--shadow-sm, 0 1px 2px light-dark\(/);
  const names = declared(sheet);
  for (const p of PREFIXES) for (const n of GUARANTEED[p]) if (p !== 'color') assert.ok(names.get(`--${p}-${n}`), `${p}-${n} declared`);
});

test('tokens() is declarations only, skips undefined, and keeps the fallback-free value verbatim', () => {
  assert.equal(tokens({ color: { accent: 'red' }, space: { 4: undefined } }), '--color-accent: red;\n');
  assert.equal(tokens({ leading: { tight: 1.1 }, color: { accent: 'var(--color-danger)' } }), '--leading-tight: 1.1;\n--color-accent: var(--color-danger);\n');
  assert.equal(tokens({}), '');
});

test('a font option declares itself and changes nothing else', () => {
  const before = sheet.split('\n');
  const after = theme({ fonts: { body: 'Inter, sans-serif' } }).split('\n');
  assert.equal(after.length, before.length);
  const changed = after.filter((line, i) => line !== before[i]);
  assert.deepEqual(changed, ['  --font-body: Inter, sans-serif;']);
});

test('told when wrong: each guard throws a ThemeError, theme: <fn>: <what>; <fix>', () => {
  throws(() => theme({ space: { multipliers: [0, 1, 2, 4, 3, 6, 8, 12, 16] } }), /^theme: theme\(\): space\.multipliers must ascend; \[4\] = 3 is not above \[3\] = 4$/);
  throws(() => theme({ space: { multipliers: [1, 2, 3, 4, 5, 6, 7, 8, 9] } }), /^theme: theme\(\): space\.multipliers\[0\] must be 0/);
  throws(() => theme({ space: { multipliers: [0, 1, 2] } }), /^theme: theme\(\): space\.multipliers must be exactly 9 numbers/);
  throws(() => theme({ type: { ratio: 0.9 } }), /^theme: theme\(\): type\.ratio must be greater than 1; got 0\.9$/);
  throws(() => theme({ space: { unit: 'four px' } }), /^theme: theme\(\): space\.unit must be a positive number with a unit, like '0\.25rem'; got "four px"$/);
  throws(() => theme(bad({ fonts: { body: {} } })), /^theme: theme\(\): fonts\.body must be a non-empty string; got \{\}$/);
  throws(() => theme({ selector: '' }), /^theme: theme\(\): selector must be CSS selector text, like ':root' or '\.promo'; got ""$/);
  throws(() => scales({ leading: { tight: -1 } }), /^theme: scales\(\): leading\.tight must be a positive number; got -1$/);
  throws(() => resolvePalette({ name: 'brand', accent: NaN }), /^theme: palette "brand": accent must be a finite hue in degrees, 0 to 360; got NaN$/);
  throws(() => resolvePalette({ name: 'brand', accent: 250, light: { accent: '#0066cc' } }), /^theme: palette "brand": light\.accent is hand-picked, so light\.on-accent must be too — the engine cannot read the lightness of "#0066cc"$/);
  throws(() => resolvePalette({ name: 'My Brand', accent: 250 }), /^theme: palette name must be kebab-case; got "My Brand"$/);
  throws(() => resolvePalette(bad('sepia')), /^theme: palette "sepia" is not shipped; shipped palettes are neutral, accent$/);
  throws(() => resolvePalette({ name: 'brand', accent: 250, light: bad({ acent: 'red' }) }), /^theme: palette "brand": light\.acent is not a role; roles are surface, /);
  throws(() => tokens({ color: { accent: '' } }), /^theme: tokens\(\): color\.accent is "" — omit the key or pass undefined to leave the token alone$/);
  throws(() => tokens({ color: { accent: 'red; } body { display: none' } }), /^theme: tokens\(\): color\.accent is "red; \} body \{ display: none" — a value may not contain ";", "\{" or "\}"; data goes through a css hole, not into a declaration$/);
  throws(() => tokens(bad({ colour: { accent: 'red' } })), /^theme: tokens\(\): "colour" is not a token group; groups are color, space, text, font, leading, weight, radius, shadow, stroke$/);
  throws(() => tokens(bad({ color: { acent: 'red' } })), /^theme: tokens\(\): color\.acent is not a name; color names are surface, /);
  throws(() => palette({ name: 'brand', accent: 250, dark: { border: 'a }' } }), /^theme: palette "brand": dark\.border is "a \}" — a value may not contain/);
  throws(() => color(bad('acent')), /^theme: color\(\): "acent" is not a name; color names are surface, /);
  throws(() => space(bad(9)), /^theme: space\(\): "9" is not a name/);
  throws(() => theme({ set: bad({ '--colour-accent': 'red' }) }), /^theme: theme\(\): set\["--colour-accent"\] is not a token this engine defines/);
  throws(() => theme({ set: { '--space-4': '1rem; } html { display: none' } }), /^theme: theme\(\): set\["--space-4"\] is "1rem; \} html \{ display: none" — a value may not contain/);
  throws(() => assign({ color: { accent: '' } }), /^theme: assign\(\): color\.accent is "" — omit the key/);
  throws(() => assign(bad({ colour: {} })), /^theme: assign\(\): "colour" is not a token group/);
  throws(() => accent(NaN), /^theme: accent\(\): hue must be a finite hue in degrees, 0 to 360; got NaN$/);
  throws(() => accent(30, 0.5), /^theme: accent\(\): chroma must be a chroma between 0 and 0.4; got 0\.5$/);
});

// ---- Grafts from the relaunch's verdict: defaults, set, assign, accent, and the shape of the text.

/** The top-level arguments of the first light-dark( in a value: split on commas outside parentheses. */
const lightDarkArguments = (value) => {
  const at = value.indexOf('light-dark(');
  assert.notEqual(at, -1, `${value} carries light-dark(`);
  const args = [];
  let depth = 0;
  let current = '';
  for (const char of value.slice(at + 'light-dark('.length)) {
    if (char === '(') depth++;
    if (char === ')' && depth-- === 0) break;
    if (char === ',' && depth === 0) { args.push(current.trim()); current = ''; } else current += char;
  }
  args.push(current.trim());
  return args;
};
/** Every declaration line, duplicates kept. */
const declarationLines = (css) => [...rules(css).matchAll(/^\s*(--[\w-]+):/gm)].map(([, name]) => name);

test('defaults: the 46 values theme() declares with no options, keyed by full name, and what every reader falls back to', () => {
  const names = declared(sheet);
  assert.deepEqual(Object.keys(defaults).sort(), [...NAMES].sort());
  for (const name of NAMES) assert.equal(defaults[name], names.get(name), name);
  assert.equal(color('surface'), `var(--color-surface, ${defaults['--color-surface']})`);
  assert.equal(shadow('lg'), `var(--shadow-lg, ${defaults['--shadow-lg']})`);
  assert.ok(Object.isFrozen(defaults));
});

test('set pins a token to a literal, printed once with its default nowhere; the sheet is still the 46', () => {
  const pinned = theme({ set: { '--space-4': '2rem', '--color-accent': 'light-dark(#c2410c, #fdba74)', '--shadow-none': undefined } });
  assert.equal((pinned.match(/--space-4: 2rem;/g) ?? []).length, 1);
  assert.doesNotMatch(pinned, /--space-4: 1rem/);
  assert.equal(declared(pinned).get('--color-accent'), 'light-dark(#c2410c, #fdba74)');
  assert.equal(declarationLines(pinned).length, 46);
  assert.deepEqual(NAMES.filter((name) => !declared(pinned).has(name)), []);
  assert.equal(theme({ set: {} }), sheet);
});

test('assign() is the override as data: keys are token names, undefined is skipped, tokens() is its serialisation', () => {
  const t = { color: { accent: 'oklch(62% 0.2 30)', focus: undefined }, leading: { tight: 1.1 } };
  assert.deepEqual(assign(t), { '--color-accent': 'oklch(62% 0.2 30)', '--leading-tight': '1.1' });
  assert.deepEqual(Object.keys(assign(t)).filter((name) => !properties.defines.includes(name)), []);
  assert.equal(tokens(t), Object.entries(assign(t)).map(([name, value]) => `${name}: ${value};\n`).join(''));
  assert.deepEqual(assign({}), {});
});

test('accent(hue) is exactly the three hue-dependent roles as light-dark() pairs and meets the contrast proxy', () => {
  for (const hue of [0, 30, 145, 250, 300, 360]) {
    const brand = accent(hue, 0.18);
    assert.deepEqual(Object.keys(brand).sort(), ['--color-accent', '--color-focus', '--color-on-accent']);
    for (const value of Object.values(brand)) assert.equal(lightDarkArguments(value).length, 2, value);
    const [accentLight, accentDark] = lightDarkArguments(brand['--color-accent']);
    const [onLight, onDark] = lightDarkArguments(brand['--color-on-accent']);
    assert.ok(Math.abs(lightness(onLight) - lightness(accentLight)) >= 55, `hue ${hue} light`);
    assert.ok(Math.abs(lightness(onDark) - lightness(accentDark)) >= 55, `hue ${hue} dark`);
    assert.match(accentLight, new RegExp(`0\\.18 ${hue}\\)$`));
  }
  assert.equal(accent(250)['--color-accent'], defaults['--color-accent']);
});

test('a colour or shadow pin carries one light-dark(, or a mode-neutral keyword, or light-dark(x, x) to accept one mode; anything else throws', () => {
  const rule = /^theme: theme\(\): set\["--color-accent"\] is "#c2410c" — a colour or shadow pin carries exactly one light-dark\(<light>, <dark>\) so both modes resolve; to accept one colour for both modes write light-dark\(x, x\)$/;
  throws(() => theme({ set: { '--color-accent': '#c2410c' } }), rule);
  throws(() => theme({ set: { '--shadow-sm': '0 1px 2px #0002' } }), /^theme: theme\(\): set\["--shadow-sm"\] is "0 1px 2px #0002" — a colour or shadow pin carries exactly one light-dark\(/);
  throws(() => theme({ set: { '--color-focus': 'light-dark(#000, light-dark(#111, #222))' } }), /^theme: theme\(\): set\["--color-focus"\] is .* — a colour or shadow pin carries exactly one light-dark\(/);
  assert.equal(declared(theme({ set: { '--color-accent': 'light-dark(#c2410c, #c2410c)' } })).get('--color-accent'), 'light-dark(#c2410c, #c2410c)');
  assert.equal(declared(theme({ set: { '--color-border': 'transparent', '--shadow-sm': 'none' } })).get('--shadow-sm'), 'none');
  assert.equal(declared(theme({ set: { '--space-4': '2rem', '--font-mono': 'Menlo' } })).get('--font-mono'), 'Menlo');
});

test('delivery: the text a document Style composes as ${theme()} — deterministic, no @property, attribute selectors quoted', () => {
  assert.equal(theme(), theme());
  assert.equal(theme({ palette: 'accent', selector: '.x' }), theme({ palette: 'accent', selector: '.x' }));
  for (const css of [sheet, theme({ palette: 'accent' }), modes()]) assert.doesNotMatch(css, /@property/);
  assert.equal((sheet.match(/\[data-theme="light"\]/g) ?? []).length, 1);
  assert.equal((sheet.match(/\[data-theme="dark"\]/g) ?? []).length, 1);
  assert.doesNotMatch(sheet, /\[data-theme=[a-z]/);
});

test('every --color-* and every --shadow-* but none carries exactly one light-dark( with two colour arguments; no name is declared twice', () => {
  for (const css of [sheet, theme({ palette: 'accent' }), theme({ palette: { name: 'brand', accent: 30 }, selector: '.brand' })]) {
    const lines = declarationLines(css);
    assert.equal(lines.length, 46);
    assert.equal(new Set(lines).size, 46);
    for (const [name, value] of declared(css)) {
      if (!name.startsWith('--color-') && !(name.startsWith('--shadow-') && name !== '--shadow-none')) continue;
      assert.equal((value.match(/light-dark\(/g) ?? []).length, 1, `${name}: ${value}`);
      const [light, dark] = lightDarkArguments(value);
      assert.ok(light && dark, `${name}: ${value}`);
      if (name.startsWith('--color-')) assert.ok(lightness(light) >= 0 && lightness(dark) >= 0);
    }
  }
});
