import { assert, fixture, test } from './harness.js';
import { apply, css, release } from '/dist/libraries/css/templates/index.js';
import { attributes, fx, registrations, sheet } from '/dist/libraries/css/effects/index.js';

// The runtime claims the node test cannot make: the [hidden] display transition under allow-discrete,
// @starting-style on a freshly created ::after box and on dialog[open]::backdrop, and --fx-speed as a
// calc() inside a time slot scaling the computed duration. Every test adopts the document sheet as the
// shell does (registrations and sheet on document) and releases it.

/** The document sheet, as the shell applies it. */
const effects = css`${registrations()} ${sheet()}`;
/** A fixture's first child as an HTMLElement. @param {string} markup */
const first = (markup) => /** @type {HTMLElement} */ (fixture(markup).firstElementChild);
/** @param {Element} element @param {string} [pseudo] */
const computed = (element, pseudo) => getComputedStyle(element, pseudo);
/** @param {number} ms */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

test('the document sheet adopts: the hook is attributes.fx and --fx-speed is a registered <number>', () => {
  apply(effects, document);
  const element = first(`<p ${attributes.fx}="${fx({ dim: true })}">x</p>`);
  assert.equal(computed(element).opacity, '0.5', 'dim reads --fx-dim, 0.5');
  element.style.setProperty('--fx-speed', 'fast');
  assert.equal(computed(element).getPropertyValue('--fx-speed').trim(), '1', 'a registered knob refuses a bad value and falls to its initial');
  release(document);
});

test('[hidden] under fade: display transitions with allow-discrete — visible for the duration, then display: none', async () => {
  apply(effects, document);
  const element = first('<p data-fx="fade" style="--duration-fast: 300ms">x</p>');
  assert.equal(computed(element).display, 'block', 'shown');
  assert.ok(Number(computed(element).opacity) < 0.1, 'first paint fades in from its starting style');
  await wait(350);
  assert.equal(computed(element).opacity, '1', 'the entrance has ended');
  element.hidden = true;
  assert.equal(computed(element).display, 'block', 'still displayed at the start of the transition');
  await wait(120);
  assert.equal(computed(element).display, 'block', 'still displayed mid-transition');
  const opacity = Number(computed(element).opacity);
  assert.ok(opacity > 0 && opacity < 1, `opacity mid-fade, got ${opacity}`);
  await wait(320);
  assert.equal(computed(element).display, 'none', 'display: none once the duration is over');
  release(document);
});

test('@starting-style on the freshly created ::after: the flash box starts at opacity 1 and fades to 0', async () => {
  apply(effects, document);
  const element = first('<p data-fx="x" style="--fx-flash-duration: 400ms">x</p>');
  assert.equal(computed(element, '::after').content, 'none', 'no box before the word');
  element.setAttribute('data-fx', 'flash');
  const start = Number(computed(element, '::after').opacity);
  assert.ok(start > 0.9, `the first frame is the starting style, got ${start}`);
  assert.equal(computed(element).position, 'relative', 'the host positions the box');
  await wait(500);
  await frame();
  assert.equal(computed(element, '::after').opacity, '0', 'the end value');
  release(document);
});

test('@starting-style on dialog[open]::backdrop: the scrim and the dialog start at opacity 0 on the first frame', async () => {
  apply(effects, document);
  const dialog = /** @type {HTMLDialogElement} */ (first('<dialog data-fx="fade" style="--duration-fast: 400ms">d</dialog>'));
  dialog.showModal();
  const backdrop = Number(computed(dialog, '::backdrop').opacity);
  const own = Number(computed(dialog).opacity);
  assert.ok(backdrop < 0.1, `the backdrop starts from its starting style, got ${backdrop}`);
  assert.ok(own < 0.1, `the dialog starts from its starting style, got ${own}`);
  await wait(500);
  await frame();
  assert.equal(computed(dialog, '::backdrop').opacity, '1', 'the backdrop ends open');
  assert.equal(computed(dialog).opacity, '1', 'the dialog ends open');
  dialog.close();
  release(document);
});

test('--fx-speed scales a computed duration: calc() in the transition slot and in the animation shorthand', () => {
  apply(effects, document);
  const host = fixture('<p data-fx="dim">a</p><p data-fx="dim" style="--fx-speed: 2">b</p><p data-fx="shake" style="--fx-speed: 3">c</p>');
  const [plain, slow, shaking] = /** @type {HTMLElement[]} */ ([...host.children]);
  assert.equal(computed(plain).transitionDuration, '0.15s', 'Animation\'s fast fallback, 150ms, times 1');
  assert.equal(computed(slow).transitionDuration, '0.3s', 'times 2');
  assert.equal(computed(shaking).animationDuration, '0.45s', 'the shorthand\'s time slot, 150ms times 3');
  release(document);
});

// The waiting word: the consuming application hand-wrote `cursor: progress` in four components, so the
// word landed. Two runtime claims no node test can make — the computed cursor, and the one the whole
// design rests on and that nothing had proved: the doubled-attribute (0,2,0) row beats an author's
// one-class rest rule even when the author's sheet is adopted AFTER the document sheet.
test('waiting: the computed cursor is progress, and its (0,2,0) row beats a later one-class author rule', () => {
  apply(effects, document);
  const host = fixture(`<p class="rest" ${attributes.fx}="${fx({ waiting: true })}">a</p><p class="rest">b</p>`);
  const [working, idle] = /** @type {HTMLElement[]} */ ([...host.children]);
  // The author's rest rule, one class, adopted after the document sheet: later in the cascade, lower in specificity.
  const authors = css`.rest { cursor: text; }`;
  apply(authors, document);
  assert.equal(computed(idle).cursor, 'text', 'the author rule reaches both elements');
  assert.equal(computed(working).cursor, 'progress', 'the word wins on specificity, not on order');
  working.setAttribute(attributes.fx, '');
  assert.equal(computed(working).cursor, 'text', 'withholding the word gives the element back to the author');
  release(document);
});
