import { suite, test } from 'node:test';
import assert from 'node:assert/strict';
import { css, serialize, StyleResult } from '../dist/libraries/css/templates/index.js';
import {
  animate,
  animation,
  attributes,
  defaultCap,
  defaults,
  duration,
  ease,
  ident,
  keyframeNames,
  keyframeRules,
  keyframes,
  properties,
  stagger,
  staggerLimit,
  timeline,
  timelines,
  tokens,
  total,
  vocabulary,
} from '../dist/libraries/css/animation/index.js';

/** @typedef {import('../dist/libraries/css/animation/index.js').Timeline} Timeline */
/** @typedef {import('../dist/libraries/css/animation/index.js').Keyframe} Keyframe */

// ---- Helpers: facts parsed from the text, never whitespace ----

/** The CSS text of a StyleResult, as the templates engine serializes it (rules are StyleResults). */
const cssOf = (result) => serialize(result).text;
/** A value fed on purpose where the types refuse it: negative cases only. */
const any = (value) => /** @type {any} */ (value);
/** The ident list widened to strings, so a name built in the test can be looked up. */
const idents = /** @type {readonly string[]} */ (keyframes);
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
/** The entries of an `animation` shorthand value. `, ` also appears inside var() and min(), so split before a keyframe name. */
const entries = (value) => value.split(/, (?=anim-)/);
const balanced = (text) => (text.match(/{/g) ?? []).length === (text.match(/}/g) ?? []).length;
const smells = /undefined|NaN|\[object Object\]|null|;;/;
const ORIGIN = 'min(var(--anim-index, 0), 10) * var(--stagger, 40ms)';
/** One shorthand entry, seven fields in canonical order. */
const ENTRY = /^(anim-[a-z-]+) (var\(--duration-[a-z]+, \d+ms\)) (var\(--ease-[a-z-]+, [a-z-]+\)) (calc\(.+\)) (\d+(?:\.\d+)?|infinite) (normal|reverse|alternate|alternate-reverse) (none|forwards|backwards|both)$/;

const guaranteed = {
  durations: ['instant', 'fast', 'base', 'slow'],
  eases: ['linear', 'in', 'out', 'in-out'],
  keyframes: ['fade-in', 'fade-out', 'slide-up', 'slide-down', 'scale-in', 'scale-out', 'spin', 'pulse', 'shake'],
};

// ---- tokens ----

suite('tokens()', () => {
  test('the :root block declares every guaranteed --duration-*, --ease-*, --stagger, the index and the two knobs', () => {
    const root = Object.fromEntries(declared(blockOf(cssOf(tokens()), ':root')));
    for (const t of guaranteed.durations) assert.equal(root[`--duration-${t}`], defaults.durations[t]);
    for (const t of guaranteed.eases) assert.equal(root[`--ease-${t}`], defaults.eases[t]);
    assert.equal(root['--stagger'], '40ms');
    assert.equal(root['--anim-index'], '0');
    assert.equal(root['--anim-distance'], '1rem');
    assert.equal(root['--anim-scale'], '0.95');
    assert.equal(root['--anim-flash-color'], undefined, 'flash is Effects’');
  });

  test('the reduced-motion block sets every --duration-* and --stagger to 0ms, and nothing else', () => {
    const media = blockOf(cssOf(tokens()), '@media (prefers-reduced-motion: reduce)');
    const still = declared(media);
    assert.deepEqual(
      still.map(([name]) => name).sort(),
      [...guaranteed.durations.map((t) => `--duration-${t}`), '--stagger'].sort(),
    );
    assert.ok(still.every(([, value]) => value === '0ms'), media);
    assert.equal(blockOf(media, ':root').split(':root').length, 2);
  });

  test("an extra duration is declared, and zeroed under reduced motion; a changed value is the author's", () => {
    const text = cssOf(tokens({ durations: { slower: '600ms', fast: '100ms' }, eases: { bounce: 'cubic-bezier(.34,1.56,.64,1)' }, stagger: '20ms', distance: '2rem' }));
    const root = Object.fromEntries(declared(blockOf(text, ':root')));
    assert.equal(root['--duration-slower'], '600ms');
    assert.equal(root['--duration-fast'], '100ms');
    assert.equal(root['--duration-base'], '250ms');
    assert.equal(root['--ease-bounce'], 'cubic-bezier(.34,1.56,.64,1)');
    assert.equal(root['--stagger'], '20ms');
    assert.equal(root['--anim-distance'], '2rem');
    const still = Object.fromEntries(declared(blockOf(text, '@media (prefers-reduced-motion: reduce)')));
    assert.equal(still['--duration-slower'], '0ms');
    assert.equal(still['--stagger'], '0ms');
  });

  test('tokens({ selector }) declares on the selector, the reduced-motion block included; :root is the default', () => {
    const text = cssOf(tokens({ selector: '.scope' }));
    assert.ok(!text.includes(':root'), text);
    assert.equal(declared(blockOf(text, '.scope')).length, 12);
    assert.ok(blockOf(text, '@media (prefers-reduced-motion: reduce)').includes('.scope {'));
    assert.equal(cssOf(tokens()), cssOf(tokens({ selector: ':root' })));
  });

  test('a bad option fails at compile, naming the option and the fix; undefined leaves the default alone', () => {
    assert.throws(() => tokens(any({ distance: null })), /animation: declaration: --anim-distance is null; give a string or a finite number/);
    assert.throws(() => tokens(any({ durations: { fast: NaN } })), /--duration-fast is NaN; give a finite number/);
    assert.throws(() => tokens(any({ scale: {} })), /--anim-scale is an object/);
    assert.throws(() => tokens({ stagger: '40ms; color: red' }), /holds ";", "{" or "}"/);
    assert.throws(() => tokens({ selector: '' }), /animation: tokens: selector is empty/);
    assert.throws(() => tokens(any({ durations: ['fast'] })), /animation: tokens: durations is not an object/);
    assert.equal(cssOf(tokens({ distance: undefined, durations: { fast: undefined } })), cssOf(tokens()));
  });

  test("duration() and ease() carry the default as the fallback; an author's own token has none", () => {
    assert.equal(duration('fast'), 'var(--duration-fast, 150ms)');
    assert.equal(ease('in-out'), 'var(--ease-in-out, ease-in-out)');
    assert.equal(duration('slower'), 'var(--duration-slower)');
    assert.equal(ease('bounce'), 'var(--ease-bounce)');
  });
});

// ---- keyframes ----

suite('keyframeRules()', () => {
  const text = cssOf(keyframeRules());
  const emitted = [...text.matchAll(/@keyframes ([a-z-]+) \{/g)].map((m) => m[1]);

  test('every guaranteed keyframe is emitted as @keyframes anim-<name> and listed in keyframes', () => {
    for (const name of guaranteed.keyframes) {
      assert.ok(emitted.includes(`anim-${name}`), `anim-${name} emitted`);
      assert.ok(idents.includes(`anim-${name}`), `anim-${name} listed`);
    }
  });

  test('keyframes and the text agree exactly, in order, and every ident carries the anim- prefix', () => {
    assert.deepEqual(emitted, [...keyframes]);
    assert.ok(keyframes.every((id) => id.startsWith('anim-')));
    assert.deepEqual([...keyframeNames], Object.keys(vocabulary));
    assert.equal(ident('shake'), 'anim-shake');
    assert.equal(ident('shake', true), 'anim-shake-again');
  });

  test('entrances are from-only, fade-out and scale-out are to-only, frames write translate/scale/rotate and never transform', () => {
    for (const name of ['fade-in', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'scale-in']) {
      const block = blockOf(text, `@keyframes anim-${name}`);
      assert.ok(block.includes('from {'), `${name} has a from frame`);
      assert.ok(!block.includes('to {'), `${name} has no to frame`);
    }
    for (const name of ['fade-out', 'scale-out']) {
      const out = blockOf(text, `@keyframes anim-${name}`);
      assert.ok(out.includes('to {') && !out.includes('from {'), `${name} is to-only`);
    }
    assert.ok(!/transform:/.test(text));
    assert.ok(blockOf(text, '@keyframes anim-slide-up').includes('translate: 0 var(--anim-distance, 1rem)'));
    assert.ok(blockOf(text, '@keyframes anim-scale-in').includes('scale: var(--anim-scale, 0.95)'));
    assert.ok(blockOf(text, '@keyframes anim-scale-out').includes('scale: var(--anim-scale, 0.95)'));
    assert.ok(blockOf(text, '@keyframes anim-spin').includes('rotate: 1turn'));
  });

  test('a keyframe reads exactly the knobs its vocabulary entry lists', () => {
    const property = { distance: '--anim-distance', scale: '--anim-scale' };
    for (const name of keyframeNames) {
      const read = [...reads(blockOf(text, `@keyframes anim-${name}`))].sort();
      assert.deepEqual(read, vocabulary[name].knobs.map((k) => property[k]).sort(), name);
    }
  });

  test('every keyframe has an -again twin, the same block under another name: two blocks per entry, none missing', () => {
    const again = keyframeNames.filter((n) => 'again' in vocabulary[n]);
    assert.deepEqual([...again].sort(), [...keyframeNames].sort(), 'round 4: every keyframe is restartable, so a composite can replay any entrance');
    for (const name of again) {
      const base = blockOf(text, `@keyframes anim-${name}`).replace(`anim-${name}`, '');
      const twin = blockOf(text, `@keyframes anim-${name}-again`).replace(`anim-${name}-again`, '');
      assert.equal(twin, base);
    }
    assert.equal(keyframes.length, keyframeNames.length * 2);
    assert.ok(text.includes('anim-fade-in-again'), 'the toast entrance can be replayed by a name flip');
  });

  test('vocabulary defaults: spin slow/linear/infinite, pulse slow/in-out/infinite, shake fast/linear/1, fades fast, slides and scale-in base/out, scale-out base/in', () => {
    const d = (n) => [vocabulary[n].duration, vocabulary[n].ease, vocabulary[n].iterations];
    assert.deepEqual(d('spin'), ['slow', 'linear', 'infinite']);
    assert.deepEqual(d('pulse'), ['slow', 'in-out', 'infinite']);
    assert.deepEqual(d('shake'), ['fast', 'linear', 1]);
    assert.equal(vocabulary['fade-in'].duration, 'fast');
    assert.equal(vocabulary['fade-out'].duration, 'fast');
    for (const n of ['slide-up', 'slide-down', 'slide-left', 'slide-right', 'scale-in']) assert.deepEqual(d(n), ['base', 'out', 1]);
    assert.deepEqual(d('scale-out'), ['base', 'in', 1]);
  });

  test('the shape Effects reads: every entry has duration, ease, iterations and again: true; twenty-two idents', () => {
    for (const name of keyframeNames) {
      const entry = /** @type {Keyframe} */ (vocabulary[name]);
      assert.ok(guaranteed.durations.includes(entry.duration) && guaranteed.eases.includes(entry.ease), name);
      assert.ok(entry.iterations === 'infinite' || typeof entry.iterations === 'number', name);
      assert.equal(entry.again, entry.again === undefined ? undefined : true, name);
    }
    assert.equal(keyframes.length, 22);
    assert.ok(!('flash' in vocabulary) && !keyframes.some((id) => id.includes('flash')), 'flash is Effects’');
  });
});

// ---- stagger ----

suite('stagger()', () => {
  test('count 5: five rungs, --anim-index 0..4 ascending, the last for every later sibling', () => {
    const text = cssOf(stagger({ selector: '.rows > li', count: 5 }));
    const rungs = [...text.matchAll(/^(.+):nth-child\(([^)]+)\) \{\n  --anim-index: (\d+);\n\}$/gm)].map((m) => [m[1], m[2], Number(m[3])]);
    assert.equal(rungs.length, 5);
    assert.deepEqual(rungs.map(([, , i]) => i), [0, 1, 2, 3, 4]);
    assert.deepEqual(rungs.map(([, nth]) => nth), ['1', '2', '3', '4', 'n+5']);
    assert.ok(rungs.every(([selector]) => selector === '.rows > li'));
    assert.equal(declared(text).length, 5);
  });

  test('count 1 is one rung for every sibling', () => {
    assert.match(cssOf(stagger({ selector: 'li', count: 1 })), /^li:nth-child\(n\+1\) \{\n  --anim-index: 0;\n\}\n$/);
  });

  test('a count outside 1..64, or not an integer, says what to do instead', () => {
    assert.equal(staggerLimit, 64);
    for (const count of [0, 1.5, 65, -1, NaN, '3']) {
      assert.throws(() => stagger({ selector: 'li', count: any(count) }), /animation: stagger: count .* is not an integer from 1 to 64; .*set --anim-index on each item from the template/);
    }
    assert.throws(() => stagger({ selector: '', count: 3 }), /animation: stagger: selector is empty/);
    assert.throws(() => stagger({ selector: 'li {', count: 3 }), /holds ";", "{" or "}"/);
  });
});

// ---- animation ----

suite('animation()', () => {
  test('entries name the steps in order, each with seven fields in canonical order', () => {
    const value = animation(['fade-in', { keyframe: 'shake', after: 'previous' }, 'spin']);
    const parsed = entries(value).map((e) => e.match(ENTRY));
    assert.ok(parsed.every(Boolean), value);
    assert.deepEqual(parsed.map((m) => m[1]), ['anim-fade-in', 'anim-shake', 'anim-spin']);
    assert.deepEqual([...value.matchAll(/(?:^|, )(anim-[a-z-]+)/g)].map((m) => m[1]), ['anim-fade-in', 'anim-shake', 'anim-spin']);
  });

  test('every delay starts from the capped stagger origin; Timeline.cap changes the cap; the default is 10', () => {
    assert.equal(defaultCap, 10);
    for (const entry of entries(animation(timelines.attention))) assert.ok(entry.includes(`calc(${ORIGIN}`), entry);
    const capped = animation({ name: 'x', steps: ['fade-in'], cap: 12 });
    assert.ok(capped.includes('calc(min(var(--anim-index, 0), 12) * var(--stagger, 40ms))'), capped);
    assert.throws(() => animation({ name: 'x', steps: ['fade-in'], cap: 0 }), /cap 0 is not an integer of 1 or more; give the stagger\(\) count/);
  });

  test("after: 'previous' sums the previous step's end; iterations multiply; a literal delay is milliseconds; a token delay is its var()", () => {
    const [a, b, c] = entries(
      animation([
        { keyframe: 'fade-in', duration: 'base', iterations: 2 },
        { keyframe: 'shake', after: 'previous', delay: 100 },
        { keyframe: 'pulse', after: 'previous', delay: 'slow', iterations: 1 },
      ]),
    ).map((e) => e.match(ENTRY));
    assert.equal(a[4], `calc(${ORIGIN})`);
    assert.equal(a[5], '2');
    assert.equal(b[4], `calc(${ORIGIN} + var(--duration-base, 250ms) * 2 + 100ms)`);
    assert.equal(c[4], `calc(${ORIGIN} + var(--duration-fast, 150ms) + var(--duration-base, 250ms) * 2 + var(--duration-slow, 400ms) + 100ms)`);
  });

  test('a step with no after runs from the origin whatever came before; after on the first step is ignored', () => {
    const [, b] = entries(animation([{ keyframe: 'fade-in', iterations: 3 }, 'shake'])).map((e) => e.match(ENTRY));
    assert.equal(b[4], `calc(${ORIGIN})`);
    assert.equal(animation([{ keyframe: 'fade-in', after: 'previous' }]), animation(['fade-in']));
  });

  test('a step after an infinite step says which step and the fix', () => {
    assert.throws(() => animation(['spin', { keyframe: 'pulse', after: 'previous' }]), /animation: animation: step 2 waits for step 1, which never ends; drop after/);
    assert.throws(() => animation(['fade-in', 'spin', { keyframe: 'shake', after: 'previous' }]), /step 3 waits for step 2, which never ends; drop after/);
    assert.doesNotThrow(() => animation(['spin', 'pulse']));
  });

  test('omitted fields come from the vocabulary; a one-word step and animate() are the same statement', () => {
    const spin = animate('spin');
    assert.equal(spin, animation(['spin']));
    assert.equal(spin, animation([{ keyframe: 'spin' }]));
    const m = spin.match(ENTRY);
    assert.deepEqual([m[2], m[3], m[5], m[6], m[7]], ['var(--duration-slow, 400ms)', 'var(--ease-linear, linear)', 'infinite', 'normal', 'both']);
    const exit = animate('slide-up', { direction: 'reverse', fill: 'forwards', ease: 'in' }).match(ENTRY);
    assert.deepEqual([exit[1], exit[3], exit[6], exit[7]], ['anim-slide-up', 'var(--ease-in, ease-in)', 'reverse', 'forwards']);
  });

  test('an unknown keyframe lists every known name; the anim- prefix is named as the mistake', () => {
    const known = keyframeNames.join(', ');
    assert.throws(() => animate(any('fade')), new RegExp(`animation: animation: step 1 keyframe 'fade' is not one of ${known}; pick one of them`));
    assert.throws(() => animation(['fade-in', any({ keyframe: 'anim-shake' })]), /step 2 keyframe 'anim-shake' carries the anim- prefix; a step names the keyframe bare: 'shake'/);
    assert.throws(() => animation([any({})]), /step 1 keyframe 'undefined' is not one of/);
  });

  test('restart flips any keyframe to its -again name by parity; a count is an integer from 0', () => {
    /** @type {[number, string][]} */
    const cases = [[0, 'anim-shake'], [1, 'anim-shake-again'], [2, 'anim-shake'], [7, 'anim-shake-again']];
    for (const [restart, name] of cases) {
      assert.equal(animate('shake', { restart }).match(ENTRY)[1], name, `restart ${restart}`);
    }
    assert.equal(animate('pulse', { restart: 1 }).match(ENTRY)[1], 'anim-pulse-again');
    assert.ok(keyframes.includes('anim-shake-again') && keyframes.includes('anim-pulse-again'));
    // Round 4: the toast's entrance replays by the same flip — the element stays in the DOM, so the name is what the browser replays on.
    assert.equal(animate('fade-in', { restart: 0 }).match(ENTRY)[1], 'anim-fade-in');
    assert.equal(animate('fade-in', { restart: 1 }).match(ENTRY)[1], 'anim-fade-in-again');
    for (const name of keyframeNames) assert.ok(keyframes.includes(`anim-${name}-again`), `${name} has a twin to flip to`);
    assert.throws(() => animate('shake', { restart: -1 }), /restart -1 is not a count/);
    assert.throws(() => animate('shake', { restart: 1.5 }), /restart 1.5 is not a count/);
  });

  test('a bad field fails at compile, naming the step, the field and the known set', () => {
    assert.throws(() => animate('fade-in', any({ duration: 'slower' })), /step 1 duration 'slower' is not one of instant, fast, base, slow; pick one of them/);
    assert.throws(() => animate('fade-in', any({ ease: 'bounce' })), /step 1 ease 'bounce' is not one of linear, in, out, in-out/);
    assert.throws(() => animate('fade-in', any({ delay: '40' })), /step 1 delay '40' is not one of instant, fast, base, slow/);
    assert.throws(() => animate('fade-in', { delay: -5 }), /step 1 delay -5 is not a number of milliseconds/);
    assert.throws(() => animate('fade-in', { iterations: NaN }), /step 1 iterations NaN is not a number of 0 or more; give a count, or 'infinite'/);
    assert.throws(() => animate('fade-in', any({ direction: 'backwards' })), /step 1 direction 'backwards' is not one of normal, reverse, alternate, alternate-reverse/);
    assert.throws(() => animate('fade-in', any({ fill: 'yes' })), /step 1 fill 'yes' is not one of none, forwards, backwards, both/);
    assert.throws(() => animation(['fade-in', any({ keyframe: 'shake', after: 'first' })]), /step 2 after 'first' is not 'previous'/);
    assert.throws(() => animation([]), /animation: animation: no steps; give at least one keyframe/);
    assert.throws(() => animation({ name: 'x', steps: [] }), /no steps/);
  });

  test('animation() is pure: the same input is the same text', () => {
    assert.equal(animation(timelines.enter), animation(timelines.enter));
    assert.equal(animation({ name: 'a', steps: ['fade-in'] }), animation({ name: 'b', steps: ['fade-in'] }));
  });
});

suite('total()', () => {
  test('a chain is calc(origin + end); parallel ends are max(); equal ends dedupe; infinite steps have no end', () => {
    assert.equal(total(['fade-in', { keyframe: 'shake', after: 'previous', delay: 100 }]), `calc(${ORIGIN} + var(--duration-fast, 150ms) * 2 + 100ms)`);
    assert.equal(total(timelines.enter), `calc(${ORIGIN} + max(var(--duration-fast, 150ms), var(--duration-base, 250ms)))`);
    assert.equal(total(['fade-in', { keyframe: 'slide-up', duration: 'fast' }]), `calc(${ORIGIN} + var(--duration-fast, 150ms))`);
    assert.equal(total(['spin']), `calc(${ORIGIN})`);
    assert.equal(total(timelines.attention), `calc(${ORIGIN} + var(--duration-fast, 150ms) + var(--duration-slow, 400ms) * 2)`);
    assert.equal(total(['shake', { keyframe: 'pulse', after: 'previous' }]), `calc(${ORIGIN} + var(--duration-fast, 150ms))`);
    assert.equal(total(['fade-in', { keyframe: 'shake', after: 'previous' }, { keyframe: 'slide-up', duration: 'slow' }]), `calc(${ORIGIN} + max(var(--duration-fast, 150ms) * 2, var(--duration-slow, 400ms)))`);
    assert.equal(total({ name: 'x', steps: ['fade-in'], cap: 3 }), 'calc(min(var(--anim-index, 0), 3) * var(--stagger, 40ms) + var(--duration-fast, 150ms))');
  });
});

suite('timeline()', () => {
  test('wraps the value in [data-anim="<name>"], or the selector given; a name that is not kebab-case says so', () => {
    /** @type {Timeline} */
    const t = { name: 'row-enter', steps: ['fade-in', 'slide-up'] };
    assert.equal(cssOf(timeline(t)), `[data-anim="row-enter"] {\n  animation: ${animation(t)};\n}\n`);
    assert.equal(cssOf(timeline(t, '.rows > li')), `.rows > li {\n  animation: ${animation(t)};\n}\n`);
    assert.throws(() => timeline({ name: 'Row Enter', steps: ['fade-in'] }), /animation: timeline: name 'Row Enter' is not a kebab-case identifier; write it like 'row-enter'/);
    assert.throws(() => timeline(any({ steps: ['fade-in'] })), /animation: timeline: name is undefined/);
    assert.throws(() => timeline(t, ''), /animation: timeline: selector is empty/);
  });

  test('timelines.enter, leave and attention compile as named', () => {
    assert.deepEqual(Object.keys(timelines), ['enter', 'leave', 'attention']);
    assert.deepEqual(entries(animation(timelines.enter)).map((e) => e.match(ENTRY)[1]), ['anim-fade-in', 'anim-slide-up']);
    const leave = animation(timelines.leave).match(ENTRY);
    assert.deepEqual([leave[1], leave[2]], ['anim-fade-out', 'var(--duration-fast, 150ms)']);
    const [shake, pulse] = entries(animation(timelines.attention)).map((e) => e.match(ENTRY));
    assert.deepEqual([shake[1], pulse[1], pulse[5]], ['anim-shake', 'anim-pulse', '2']);
    assert.ok(pulse[4].includes('var(--duration-fast, 150ms)'), 'pulse waits for shake');
    for (const t of Object.values(timelines)) assert.ok(cssOf(timeline(t)).startsWith(`[data-anim="${t.name}"]`));
  });
});

// ---- the header's round-2 fragment, executed through the css tag ----

suite("the index.ts header's round-2 fragment", () => {
  test('its exact calls compose through css, balance and are clean, so the doc cannot rot silently', () => {
    /** @type {Timeline} */
    const rowEnter = { name: 'row-enter', steps: ['fade-in', 'slide-up'], cap: 12 };
    const m = { dense: true, errorCount: 3 };
    const motion = serialize(css`${tokens()} ${keyframeRules()}`);
    const style = serialize(css`
      :scope { --stagger: ${m.dense ? '20ms' : '40ms'}; --anim-distance: 0.5rem; }
      ${timeline(rowEnter, '.rows > li')}
      ${stagger({ selector: '.rows > li', count: 12 })}
      ${timeline({ name: 'row-error', steps: [{ keyframe: 'shake', restart: m.errorCount }] }, '.rows > li.error')}
    `);
    for (const [name, text] of Object.entries({ sheet: motion.text, style: style.text })) {
      assert.ok(balanced(text), `${name}: braces`);
      assert.ok(!smells.test(text), `${name}: ${text}`);
    }
    assert.ok(motion.text.includes(':root {') && motion.text.includes('@keyframes anim-fade-in {'), 'the document sheet holds the tokens and the keyframes');
    assert.deepEqual(motion.properties, [], 'nothing bound: raw text at statement start');
    assert.deepEqual(style.properties.map((p) => p.value), ['20ms'], 'the one bound value is the stagger step, declared on the scope element where var() resolves');
    assert.ok(style.text.includes('.rows > li {\n  animation: anim-fade-in var(--duration-fast, 150ms)'), 'the entrance rule lands on the rows');
    assert.ok(style.text.includes('min(var(--anim-index, 0), 12)'), 'cap 12 matches the ladder');
    assert.ok(style.text.includes('.rows > li:nth-child(n+12) {'), 'the ladder has twelve rungs');
    assert.ok(style.text.includes('.rows > li.error {\n  animation: anim-shake-again'), 'an odd errorCount names the -again twin');
  });
});

// ---- the header's round-4 calls: the toast composite and a list's rows ----

suite("the index.ts header's round-4 calls", () => {
  test("the toast entrance: one rule on the composite's own selector, nothing positioned, nothing bound", () => {
    /** @type {Timeline} */
    const toastEnter = { name: 'toast-enter', steps: ['fade-in', 'slide-up'] };
    const own = '[data-toast] {\n  display: flex;\n}\n';
    const sheet = serialize(css`${own}\n${timeline(toastEnter, '[data-toast]')}`);
    assert.ok(balanced(sheet.text) && !smells.test(sheet.text), sheet.text);
    assert.deepEqual(sheet.properties, [], "a composite's sheet binds nothing: raw text at statement start");
    assert.ok(sheet.text.includes('[data-toast] {\n  animation: anim-fade-in var(--duration-fast, 150ms)'), 'the entrance lands on the composite');
    assert.deepEqual(entries(animation(toastEnter)).map((e) => e.match(ENTRY)[1]), ['anim-fade-in', 'anim-slide-up']);
    assert.ok(!/position|inset|z-index|top-layer/.test(sheet.text), 'a region at the end of the flow — the entrance never positions');
    for (const entry of entries(animation(toastEnter))) assert.equal(entry.match(ENTRY)[7], 'both', 'a from-only entrance pins nothing after it ends');
  });

  test('the same entrance replayed per message: the model count flips the ident, and both names are emitted', () => {
    const replay = (count) => cssOf(timeline({ name: 'toast-enter', steps: [{ keyframe: 'fade-in', restart: count }] }, '[data-toast]'));
    assert.ok(replay(0).includes('animation: anim-fade-in '), 'an even count is the base name');
    assert.ok(replay(1).includes('animation: anim-fade-in-again '), 'an odd count is the twin the browser replays on');
    assert.notEqual(replay(0), replay(1), 'a changed name is the whole mechanism');
    const sheet = cssOf(keyframeRules());
    for (const id of ['anim-fade-in', 'anim-fade-in-again', 'anim-slide-up', 'anim-slide-up-again']) assert.ok(sheet.includes(`@keyframes ${id} {`), id);
  });

  test("a list's rows entering: the ladder and the timeline on a consumer's own selector, each group staggering from 0", () => {
    /** @type {Timeline} */
    const rowEnter = { name: 'row-enter', steps: ['fade-in', 'slide-up'], cap: 12 };
    const rows = '.memory-list > li';
    const style = serialize(css`
      ${timeline(rowEnter, rows)}
      ${stagger({ selector: rows, count: 12 })}
    `);
    assert.ok(balanced(style.text) && !smells.test(style.text), style.text);
    assert.deepEqual(style.properties, [], 'nothing bound: the rows are identical, the index is the ladder’s');
    assert.ok(style.text.includes(`${rows} {\n  animation: anim-fade-in`), 'the entrance rule lands on the rows');
    assert.ok(style.text.includes('min(var(--anim-index, 0), 12)'), 'the cap matches the rung count');
    assert.ok(style.text.includes(`${rows}:nth-child(1) {`) && style.text.includes(`${rows}:nth-child(n+12) {`), 'rungs 1 to 12, the last shared');
    const rungs = [...style.text.matchAll(/--anim-index: (\d+);/g)].map((m) => Number(m[1]));
    assert.deepEqual(rungs, [...Array(12).keys()], 'indexes 0..11, ascending');
  });
});

// ---- text hygiene and the manifest ----

const every = () => ({
  'tokens()': cssOf(tokens()),
  'tokens(options)': cssOf(tokens({ selector: '.scope', durations: { slower: '600ms' }, eases: { bounce: 'ease' }, stagger: '20ms', distance: '2rem', scale: '0.9' })),
  'keyframeRules()': cssOf(keyframeRules()),
  'stagger()': cssOf(stagger({ selector: '.rows > li', count: 7 })),
  'animation(enter)': animation(timelines.enter),
  'animation(attention)': animation(timelines.attention),
  'animation(options)': animation([{ keyframe: 'shake', restart: 1, delay: 'slow', iterations: 2, direction: 'alternate', fill: 'none' }, { keyframe: 'fade-out', after: 'previous', delay: 50 }]),
  'animate(spin)': animate('spin'),
  'total(attention)': total(timelines.attention),
  'timeline(enter)': cssOf(timeline(timelines.enter)),
  'timeline(leave, selector)': cssOf(timeline(timelines.leave, '.leaving')),
});

suite('every emitted text', () => {
  test('balances braces and is clean: no undefined, NaN, null, [object Object] or ;;', () => {
    for (const [name, text] of Object.entries(every())) {
      assert.ok(balanced(text), `${name}: braces`);
      assert.ok(!smells.test(text), `${name}: ${text}`);
    }
  });

  test('every declaration in a rule ends with ; and every rule closes on its own line', () => {
    for (const [name, text] of Object.entries(every())) {
      if (!text.includes('{')) continue;
      for (const line of text.split('\n')) {
        if (line === '' || /[{}]$/.test(line)) continue;
        assert.match(line, /;$/, `${name}: "${line}"`);
      }
      assert.ok(text.endsWith('}\n'), `${name} ends with a closing brace and newline`);
    }
  });
});

suite('surfaces', () => {
  test('rules are a StyleResult from one css call, values are strings, data is data', () => {
    for (const result of [tokens(), keyframeRules(), stagger({ selector: 'li', count: 2 }), timeline(timelines.enter), timeline(timelines.leave, '.x')]) {
      assert.ok(result instanceof StyleResult);
      assert.equal(result.values.length, 1, 'one hole: the raw text, at statement start');
    }
    for (const value of [animation(timelines.enter), animate('spin'), total(timelines.enter), duration('fast'), ease('out'), ident('shake')]) assert.equal(typeof value, 'string');
    assert.ok(Array.isArray(keyframes) && typeof vocabulary === 'object' && typeof defaults === 'object' && typeof timelines === 'object');
  });

  test('they compose at statement start inside a css block; @keyframes comes from keyframeRules() alone; no @property', () => {
    const composed = cssOf(css`${tokens()} ${keyframeRules()} ${stagger({ selector: 'li', count: 2 })} ${timeline(timelines.enter)}`);
    for (const piece of [':root {', '@keyframes anim-spin {', 'li:nth-child(1) {', '[data-anim="enter"] {']) assert.ok(composed.includes(piece), piece);
    assert.ok(!composed.includes('@property'));
    for (const [name, text] of Object.entries(every())) if (name !== 'keyframeRules()') assert.ok(!text.includes('@keyframes'), name);
  });

  test('attributes.anim is the hook timeline() selects on, frozen', () => {
    assert.equal(attributes.anim, 'data-anim');
    assert.ok(Object.isFrozen(attributes));
    assert.ok(cssOf(timeline(timelines.enter)).startsWith(`[${attributes.anim}="enter"] {`));
  });

  test('an unknown option, timeline field or step field is refused by name with the accepted keys', () => {
    assert.throws(() => tokens(any({ on: '.scope' })), /animation: tokens: option "on" is not one of selector, durations, eases, stagger, distance, scale; drop it, or fix the spelling/);
    assert.throws(() => stagger(any({ selector: 'li', count: 2, cap: 3 })), /animation: stagger: option "cap" is not one of selector, count/);
    assert.throws(() => animation(any({ name: 'x', steps: ['fade-in'], on: 'li' })), /animation: animation: timeline field "on" is not one of name, steps, cap/);
    assert.throws(() => timeline(any({ name: 'x', steps: ['fade-in'], selector: 'li' })), /animation: timeline: timeline field "selector" is not one of name, steps, cap/);
    assert.throws(() => animate('shake', any({ replay: 1 })), /animation: animation: step 1 field "replay" is not one of keyframe, duration, ease, delay, after, iterations, direction, fill, restart/);
    assert.throws(() => timeline(any(null)), /animation: timeline: timeline fields are null; give an object with name, steps, cap/);
    assert.throws(() => tokens(any(null)), /animation: tokens: options are null; give an object with selector/);
  });

  test('no name outside --duration-*, --ease-*, --stagger, --anim-* and anim-*; nothing under --css-; no flash', () => {
    const all = Object.values(every()).join('');
    assert.ok(!/--css-|flash/.test(all));
    for (const name of [...declared(all).map(([n]) => n), ...reads(all)]) assert.match(name, /^--(duration-|ease-|stagger$|anim-)/);
    for (const id of all.matchAll(/anim-[a-z-]+/g)) assert.ok(idents.includes(id[0]) || /^anim-(index|distance|scale)$/.test(id[0]), id[0]);
  });
});

suite('properties', () => {
  test('defines is exactly the set of every --x declared across tokens(), keyframeRules(), stagger() and animation(), with and without options', () => {
    const texts = [cssOf(tokens()), cssOf(tokens({ selector: '.scope', stagger: '20ms', distance: '2rem', scale: '0.9' })), cssOf(keyframeRules()), cssOf(stagger({ selector: 'li', count: 4 })), animation(timelines.enter), animation(timelines.attention), animate('shake', { restart: 1 })];
    const seen = new Set(texts.flatMap((text) => declared(text).map(([name]) => name)));
    assert.deepEqual([...seen].sort(), [...properties.defines].sort());
    assert.equal(properties.defines.length, 12);
  });

  test('every var(--x read anywhere in the text is a name in defines; reads and overrides are empty', () => {
    const read = new Set(Object.values(every()).flatMap((text) => [...reads(text)]));
    assert.ok(read.size >= 8, `reads found: ${read.size}`);
    for (const name of read) assert.ok(properties.defines.includes(name), `${name} is read but not defined`);
    assert.deepEqual([...properties.reads], []);
    assert.deepEqual([...properties.overrides], []);
  });

  test('every name is under an owned prefix; the guaranteed names are all present; the manifest is frozen', () => {
    for (const name of properties.defines) assert.match(name, /^--(duration-|ease-|stagger$|anim-)/);
    for (const t of guaranteed.durations) assert.ok(properties.defines.includes(`--duration-${t}`));
    for (const t of guaranteed.eases) assert.ok(properties.defines.includes(`--ease-${t}`));
    for (const knob of ['--stagger', '--anim-index', '--anim-distance', '--anim-scale']) assert.ok(properties.defines.includes(knob), knob);
    assert.ok(!properties.defines.includes('--anim-flash-color'));
    assert.ok(Object.isFrozen(properties) && Object.isFrozen(properties.defines) && Object.isFrozen(keyframes) && Object.isFrozen(defaults));
  });
});
