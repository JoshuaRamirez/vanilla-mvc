import { assert, fixture, test } from './harness.js';
import { apply, css, release } from '/dist/libraries/css/templates/index.js';
import { keyframeRules, keyframes, stagger, timeline, tokens } from '/dist/libraries/css/animation/index.js';

// The runtime claims the node test cannot make: a var() inside a keyframe reads the animated element,
// the -again twin restarts a finished animation, and min() over --anim-index computes inside a delay.

/** The document sheet, as the shell applies it. */
const motion = css`${tokens()} ${keyframeRules()}`;
/** A fixture's root as the HTMLElement apply() takes. */
const scopeOf = (html) => /** @type {HTMLElement} */ (fixture(html).firstElementChild);
const computed = (element) => getComputedStyle(element);
/** The next animation event of a kind on an element, by name, or a failure after 2 s so a lost event names itself. */
const next = (element, type) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ${type} on the element within 2s`)), 2000);
    element.addEventListener(
      type,
      (event) => {
        clearTimeout(timer);
        resolve(/** @type {AnimationEvent} */ (event).animationName);
      },
      { once: true },
    );
  });

test('the document sheet adopts unwrapped: tokens on :root, every ident in keyframes as a CSSKeyframesRule, released cleanly', () => {
  const before = document.adoptedStyleSheets.length;
  apply(motion, document);
  const root = computed(document.documentElement);
  assert.equal(root.getPropertyValue('--duration-fast').trim(), '150ms');
  assert.equal(root.getPropertyValue('--anim-distance').trim(), '1rem');
  assert.equal(root.getPropertyValue('--anim-index').trim(), '0');
  const sheet = document.adoptedStyleSheets[document.adoptedStyleSheets.length - 1];
  const names = [...sheet.cssRules].filter((rule) => rule instanceof CSSKeyframesRule).map((rule) => /** @type {CSSKeyframesRule} */ (rule).name);
  assert.deepEqual(names, [...keyframes]);
  release(document);
  assert.equal(document.adoptedStyleSheets.length, before);
});

test('var(--anim-distance) inside a keyframe is read from the animated element; the fallback is the root token', () => {
  apply(motion, document);
  const scope = scopeOf('<div><p class="near">x</p><p class="far">y</p></div>');
  apply(css`${timeline({ name: 'slide', steps: ['slide-up'] }, 'p')} .near { --anim-distance: 7px; } p { animation-play-state: paused; }`, scope);
  const [near, far] = scope.children;
  assert.equal(computed(near).translate, '0px 7px', 'the element’s own knob, read where the keyframe applies');
  assert.equal(computed(far).translate, '0px 16px', 'the root default, 1rem');
  assert.equal(computed(near).opacity, '0', 'the from frame holds while paused at the origin');
  release(document);
});

test('the -again twin restarts a finished animation: animationstart fires again on each ident flip', async () => {
  apply(motion, document);
  const scope = scopeOf('<div><p class="err">x</p></div>');
  const element = /** @type {HTMLElement} */ (scope.firstElementChild);
  const errors = (count) => css`:scope { --duration-fast: 20ms; } ${timeline({ name: 'row-error', steps: [{ keyframe: 'shake', restart: count }] }, '.err')}`;
  let started = next(element, 'animationstart');
  const ended = next(element, 'animationend');
  apply(errors(0), scope);
  assert.equal(await started, 'anim-shake');
  assert.equal(await ended, 'anim-shake', 'the first run finishes');
  started = next(element, 'animationstart');
  apply(errors(1), scope);
  assert.equal(await started, 'anim-shake-again', 'an odd count names the twin and the browser replays');
  started = next(element, 'animationstart');
  apply(errors(2), scope);
  assert.equal(await started, 'anim-shake', 'the flip back restarts too');
  release(document);
});

test('min(var(--anim-index, 0), cap) inside the shorthand delay computes: the ladder, the cap, a hand-set index, an inherited and a reset index', () => {
  apply(motion, document);
  const scope = scopeOf('<ul><li>a</li><li>b</li><li>c<span class="kid">k</span><span class="reset">r</span></li><li>d</li><li style="--anim-index: 50">e</li></ul>');
  apply(
    css`
      ${timeline({ name: 'row', steps: ['fade-in'], cap: 2 }, 'li')}
      ${stagger({ selector: 'li', count: 4 })}
      ${timeline({ name: 'kid', steps: ['fade-in'] }, 'li > span')}
      .reset { --anim-index: 0; }
      li, li > span { animation-play-state: paused; }
    `,
    scope,
  );
  const delays = [...scope.children].map((li) => computed(li).animationDelay);
  assert.deepEqual(delays, ['0s', '0.04s', '0.08s', '0.08s', '0.08s'], 'rungs 0, 1, 2; rung 3 capped at 2; a hand-set 50 capped at 2');
  assert.equal(computed(scope.querySelector('.kid')).animationDelay, '0.08s', 'the index inherits into the row');
  assert.equal(computed(scope.querySelector('.reset')).animationDelay, '0s', 'an inner animation that must not wait sets --anim-index: 0');
  release(document);
});

// ---- Round 4: the two calls this engine is built for, in a real browser ----

/** True when no event of the kind reaches the element within ms — a replay that did not happen. */
const quiet = (element, type, ms) =>
  new Promise((resolve) => {
    const seen = (event) => resolve(/** @type {AnimationEvent} */ (event).animationName);
    element.addEventListener(type, seen, { once: true });
    setTimeout(() => {
      element.removeEventListener(type, seen);
      resolve(null);
    }, ms);
  });

/** The shell's flow: the toast is a region at the end of it, never a layer over the page. */
const SHELL = '<div class="shell"><header>nav</header><main><p>page</p></main><aside><div role="status"><p data-toast>Saved “notes.md”.</p></div></aside></div>';
/** @typedef {import('/dist/libraries/css/animation/index.js').Timeline} Timeline */
/** The entrance css-semantics' toastRules() composes beside its own text. */
const toastEnter = /** @type {Timeline} */ ({ name: 'toast-enter', steps: ['fade-in', 'slide-up'] });
/** The same entrance replayed per message: the count is the model's, the flip is what the browser replays on. */
const toastReplay = (count) => timeline({ name: 'toast-enter', steps: [{ keyframe: 'fade-in', restart: count }] }, '[data-toast]');

test('the toast entrance runs unpositioned at the end of the shell’s flow, and pins nothing when it ends', async () => {
  apply(motion, document);
  const shell = scopeOf(SHELL);
  const toast = /** @type {HTMLElement} */ (shell.querySelector('[data-toast]'));
  const main = /** @type {HTMLElement} */ (shell.querySelector('main'));

  apply(css`${timeline(toastEnter, '[data-toast]')} [data-toast] { animation-play-state: paused; }`, shell);
  assert.equal(computed(toast).animationName, 'anim-fade-in, anim-slide-up', 'both steps, in order');
  assert.equal(computed(toast).animationDuration, '0.15s, 0.25s', 'the tokens the document sheet declares');
  assert.equal(computed(toast).animationDelay, '0s, 0s', 'index 0: a toast waits for nothing');
  assert.equal(computed(toast).position, 'static', 'the entrance needs no position');
  assert.ok(toast.offsetTop > main.offsetTop, 'the region is after the page in the flow, not over it');
  assert.equal(computed(toast).opacity, '0', 'held at the origin: the from frame');
  assert.equal(computed(toast).translate, '0px 16px', 'and 1rem below its place, by translate, so nothing reflows');

  const ended = next(toast, 'animationend');
  apply(css`:scope { --duration-fast: 20ms; --duration-base: 20ms; } ${timeline(toastEnter, '[data-toast]')}`, shell);
  assert.equal(await ended, 'anim-fade-in');
  await next(toast, 'animationend');
  assert.equal(computed(toast).opacity, '1', 'a from-only entrance with fill: both pins nothing over the element’s own cascade');
  assert.equal(computed(toast).translate, '0px', 'and the filled end is the element’s own place — a from-only keyframe’s implicit to frame');
  release(document);
});

test('the toast replays its entrance for a second message by the name flip, with the element left in the DOM', async () => {
  apply(motion, document);
  const shell = scopeOf(SHELL);
  const toast = /** @type {HTMLElement} */ (shell.querySelector('[data-toast]'));
  const fast = (count) => css`:scope { --duration-fast: 20ms; } ${toastReplay(count)}`;

  let started = next(toast, 'animationstart');
  apply(fast(0), shell);
  assert.equal(await started, 'anim-fade-in', 'the first message');

  // What the morph does to a toast that is already on screen: the text changes, the element does not move.
  toast.textContent = 'Deleted “notes.md”.';
  apply(fast(0), shell);
  assert.equal(await quiet(toast, 'animationstart', 150), null, 'an element that stays in the DOM does not replay on its own');

  started = next(toast, 'animationstart');
  apply(fast(1), shell);
  assert.equal(await started, 'anim-fade-in-again', 'the model’s count flips the ident and the browser replays it');
  release(document);
});

test('reduced motion: the block the browser parsed zeroes every --duration-* and --stagger, and a zero duration stops even an infinite step', async () => {
  apply(motion, document);
  const sheet = document.adoptedStyleSheets[document.adoptedStyleSheets.length - 1];
  const media = /** @type {CSSMediaRule} */ ([...sheet.cssRules].find((rule) => rule instanceof CSSMediaRule && rule.conditionText.includes('prefers-reduced-motion')));
  assert.ok(media, 'the document sheet carries the reduced-motion block');
  const still = /** @type {CSSStyleRule} */ (media.cssRules[0]);
  assert.equal(still.selectorText, ':root', 'on the same selector as the tokens');
  const zeroed = [...still.style];
  assert.ok(zeroed.length > 0 && zeroed.every((name) => still.style.getPropertyValue(name).trim() === '0ms'), `every one 0ms: ${zeroed}`);
  const root = /** @type {CSSStyleRule} */ ([...sheet.cssRules].find((rule) => rule instanceof CSSStyleRule && rule.selectorText === ':root'));
  const durations = [...root.style].filter((name) => name.startsWith('--duration-'));
  assert.deepEqual(zeroed.sort(), [...durations, '--stagger'].sort(), 'every duration the tokens declare, and the stagger step');

  // What the block does when it applies, asserted on the paths this round added.
  const shell = scopeOf(SHELL);
  const toast = /** @type {HTMLElement} */ (shell.querySelector('[data-toast]'));
  apply(
    css`
      :scope { --duration-fast: 0ms; --duration-base: 0ms; --duration-slow: 0ms; --stagger: 0ms; }
      ${timeline(toastEnter, '[data-toast]')}
      ${timeline(/** @type {Timeline} */ ({ name: 'busy', steps: ['spin'] }), 'main p')}
      ${stagger({ selector: 'main p', count: 4 })}
    `,
    shell,
  );
  const busy = /** @type {HTMLElement} */ (shell.querySelector('main p'));
  assert.equal(computed(toast).animationDuration, '0s, 0s', 'the entrance takes no time');
  assert.equal(computed(busy).animationDuration, '0s', 'an infinite step has a zero active duration, whatever the count');
  assert.equal(computed(toast).animationDelay, '0s, 0s', 'and nothing waits: the stagger step is zero too');
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  assert.equal(computed(toast).opacity, '1', 'no motion: the element is at its own values from the first frame');
  assert.equal(computed(toast).translate, '0px', 'never 1rem below: the entrance was over before the first frame');
  // A zeroed step still *ends*, and fill: both holds its end frame. That is why entrances are from-only —
  // their end is the element's own value — and why spin's end is a whole turn, which is the identity rotation.
  assert.equal(computed(busy).rotate, '360deg', 'the infinite spin is over too, holding a full turn: visually where it started');
  release(document);
});

test('a list’s rows enter staggered on an application’s own shape: each level group counts from 0, the cap matches the ladder', () => {
  apply(motion, document);
  // memory-list-page.template.ts: per-level <section class="level"> each holding its own <ul class="memory-list">.
  const row = (name) => `<li data-key="${name}"><span>${name}</span></li>`;
  const level = (names) => `<section class="level"><h2>Project</h2><ul class="memory-list">${names.map(row).join('')}</ul></section>`;
  const page = scopeOf(`<div class="memory">${level(['a', 'b', 'c'])}${level(['d', 'e'])}</div>`);
  const rows = '.memory-list > li';
  const rowEnter = /** @type {Timeline} */ ({ name: 'row-enter', steps: ['fade-in', 'slide-up'], cap: 12 });
  apply(css`${timeline(rowEnter, rows)} ${stagger({ selector: rows, count: 12 })} ${rows} { animation-play-state: paused; }`, page);

  const delays = [...page.querySelectorAll(rows)].map((li) => computed(li).animationDelay);
  assert.deepEqual(delays, ['0s, 0s', '0.04s, 0.04s', '0.08s, 0.08s', '0s, 0s', '0.04s, 0.04s'], 'nth-child counts inside each list, so the second group starts again at 0');
  const first = page.querySelector(rows);
  assert.equal(computed(first).animationName, 'anim-fade-in, anim-slide-up');
  assert.equal(computed(first).opacity, '0', 'held at the origin while paused');
  assert.equal(computed(page.querySelectorAll(rows)[2]).translate, '0px 16px', 'every row enters from the same 1rem below');
  release(document);
});
