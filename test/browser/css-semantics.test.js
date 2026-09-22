import { assert, fixture, test } from './harness.js';
import { apply, css, release } from '/dist/libraries/css/templates/index.js';
import { cardRules, dialogRules, fieldGroupRules, navRules, toastRules, toolbarRules } from '/dist/libraries/css/semantics/index.js';
import { keyframeRules, tokens } from '/dist/libraries/css/animation/index.js';

// The runtime claims the node test cannot make: the three sheets at the document, read by Chrome.
// Each test applies the document sheet, as the shell does, plus one static rule of its own, and releases it.

const DANGER = 'rgb(200, 0, 0)';
/** The shell's delivery, plus a scoped token re-declaration standing for a [data-theme] island. */
const documentSheet = css`${tokens()} ${keyframeRules()}
${cardRules()} ${toolbarRules()} ${fieldGroupRules()} ${dialogRules()} ${toastRules()} ${navRules()}
[data-theme="roomy"] { --space-4: 40px; }
`;
const computed = (element) => getComputedStyle(element);
/** @param {Element} root @param {string} selector @returns {HTMLElement} */
const find = (root, selector) => /** @type {HTMLElement} */ (root.querySelector(selector));
/** Run a check with the document sheet applied, and take it back after. @param {() => void | Promise<void>} check */
const withSheet = async (check) => {
  apply(documentSheet, document);
  try {
    await check();
  } finally {
    release(document);
  }
};

test('semantics: a scoped [data-theme] re-declaring --space-4 reaches a card\'s padding; no sheet is added to do it', () =>
  withSheet(() => {
    const host = fixture('<article data-card>plain</article><div data-theme="roomy"><article data-card>roomy</article><article data-card data-card-dense>dense</article></div>');
    const [plain, roomy, dense] = host.querySelectorAll('[data-card]');
    const count = document.adoptedStyleSheets.length;
    assert.equal(computed(plain).paddingTop, '16px', 'Theme\'s default through the reader\'s fallback');
    assert.equal(computed(roomy).paddingTop, '40px', 'the island\'s --space-4, resolved on the card');
    assert.equal(computed(dense).paddingTop, '8px', 'dense reassigns the knob to --space-2');
    assert.equal(document.adoptedStyleSheets.length, count);
  }));

test('semantics: a knob set on an ancestor alone does not reach the card; set on [data-card] it does', () =>
  withSheet(() => {
    const host = fixture('<div style="--card-padding: 50px"><article data-card>a</article><article data-card style="--card-padding: 30px">b</article></div>');
    const [a, b] = host.querySelectorAll('[data-card]');
    assert.equal(computed(a).paddingTop, '16px', 'the base rule re-declares the knob on the card');
    assert.equal(computed(b).paddingTop, '30px');
  }));

test('semantics: elevation is Effects\' --fx-shadow: 0 is none, 2 is a shadow, and --card-shadow on the card wins the resting shadow', () =>
  withSheet(() => {
    const host = fixture('<article data-card data-card-elevation="0">0</article><article data-card data-card-elevation="2">2</article><article data-card data-card-elevation="2" style="--card-shadow: none">x</article>');
    const [flat, raised, overridden] = host.querySelectorAll('[data-card]');
    assert.equal(computed(flat).boxShadow, 'none');
    assert.ok(computed(raised).boxShadow !== 'none', `elevation 2 casts a shadow: ${computed(raised).boxShadow}`);
    assert.equal(computed(overridden).boxShadow, 'none');
  }));

test('semantics: the legend turns --color-danger through :has() when a control is aria-invalid, and not before', () =>
  withSheet(() => {
    const host = fixture(`<fieldset data-field-group style="--color-danger: ${DANGER}"><legend>Details</legend><div data-field><label for="s-a">A</label><input id="s-a"></div></fieldset>`);
    const legend = find(host, 'legend');
    assert.ok(computed(legend).color !== DANGER, 'valid: the legend keeps its colour');
    find(host, 'input').setAttribute('aria-invalid', 'true');
    assert.equal(computed(legend).color, DANGER);
    assert.equal(computed(find(host, 'input')).borderTopColor, DANGER, 'the control reads aria-invalid too');
  }));

test('semantics: :user-invalid styles a required control once the form has been submitted, not before', () =>
  withSheet(() => {
    const host = fixture(`<form><fieldset data-field-group style="--color-danger: ${DANGER}"><div data-field><label for="s-b">B</label><input id="s-b" required></div></fieldset></form>`);
    const input = find(host, 'input');
    const form = /** @type {HTMLFormElement} */ (host.querySelector('form'));
    assert.ok(!input.matches(':user-invalid'), 'no interaction yet');
    assert.ok(computed(input).borderTopColor !== DANGER);
    form.addEventListener('submit', (event) => event.preventDefault());
    form.requestSubmit();
    assert.ok(input.matches(':user-invalid'), 'requestSubmit() sets user validity (the nearest provable stand-in for typing and leaving)');
    assert.equal(computed(input).borderTopColor, DANGER);
  }));

test('semantics: an empty [data-field-error] is display none, and shows once it has text', () =>
  withSheet(() => {
    const host = fixture('<div data-field><label for="s-c">C</label><input id="s-c"><small id="s-c-error" data-field-error aria-live="polite"></small></div>');
    const error = find(host, '[data-field-error]');
    assert.equal(computed(error).display, 'none');
    error.textContent = 'Required';
    assert.equal(computed(error).display, 'block');
  }));

test('semantics: an inline group puts labels in column 1 and the control, hint and error in column 2; stacked is one column', () =>
  withSheet(() => {
    const field = (id) => `<div data-field><label for="${id}">Label</label><input id="${id}"><small data-field-hint>Hint</small><small data-field-error>Error</small></div>`;
    const host = fixture(`<fieldset data-field-group data-field-group-inline style="inline-size: 40rem">${field('s-d')}</fieldset><fieldset data-field-group style="inline-size: 40rem">${field('s-e')}</fieldset>`);
    const [inline, stacked] = host.querySelectorAll('[data-field-group]');
    const left = (group, selector) => find(group, selector).getBoundingClientRect().left;
    assert.equal(computed(find(inline, '[data-field]')).gridTemplateColumns.split(' ').length, 2);
    assert.equal(left(inline, 'label') < left(inline, 'input'), true, 'label before control');
    assert.equal(left(inline, '[data-field-hint]'), left(inline, 'input'));
    assert.equal(left(inline, '[data-field-error]'), left(inline, 'input'));
    assert.equal(computed(find(inline, 'label')).width, '160px', '--field-label-width is 10rem');
    assert.equal(computed(find(stacked, '[data-field]')).gridTemplateColumns.split(' ').length, 1);
    assert.equal(left(stacked, 'input'), left(stacked, 'label'));
    assert.equal(left(stacked, '[data-field-hint]'), left(stacked, 'label'));
  }));

// ---- dialog ----

test('semantics: a closed dialog stays display none; an open one is a grid — display is never in the base rule', () =>
  withSheet(() => {
    const host = fixture('<dialog data-dialog aria-label="Closed"><h2>a</h2></dialog><dialog data-dialog aria-label="Open"><h2>b</h2><p>c</p><footer><button data-dialog-confirm>Yes</button></footer></dialog>');
    const [closed, open] = host.querySelectorAll('[data-dialog]');
    assert.equal(computed(closed).display, 'none', 'the base rule sets no display');
    /** @type {HTMLDialogElement} */ (open).showModal();
    try {
      assert.equal(computed(open).display, 'grid');
      assert.equal(computed(open).paddingTop, '24px', "--dialog-padding is Theme's --space-5");
      assert.equal(computed(open).maxInlineSize, '384px', '--dialog-inline-size is 24rem');
      assert.equal(computed(open).rowGap, '16px', "--dialog-gap is Theme's --space-4");
    } finally {
      /** @type {HTMLDialogElement} */ (open).close();
    }
  }));

test('semantics: data-dialog-danger swaps the confirm control from the accent to the danger colour, and nothing else', () =>
  withSheet(() => {
    const style = 'style="--color-accent: rgb(0, 0, 255); --color-danger: rgb(200, 0, 0)"';
    const host = fixture(`<dialog data-dialog aria-label="Plain" ${style}><footer><button data-dialog-confirm>Yes</button><button>No</button></footer></dialog><dialog data-dialog data-dialog-danger aria-label="Danger" ${style}><footer><button data-dialog-confirm>Yes</button></footer></dialog>`);
    const [plain, danger] = host.querySelectorAll('[data-dialog]');
    assert.equal(computed(find(plain, '[data-dialog-confirm]')).backgroundColor, 'rgb(0, 0, 255)');
    assert.equal(computed(find(danger, '[data-dialog-confirm]')).backgroundColor, 'rgb(200, 0, 0)');
    assert.ok(computed(find(plain, 'button:not([data-dialog-confirm])')).backgroundColor !== 'rgb(0, 0, 255)', 'the other answer keeps the page\'s own look');
  }));

// ---- toast ----

test('semantics: the toast region is in the flow and pushes what follows — it never covers an action row', () =>
  withSheet(() => {
    const host = fixture('<div style="inline-size: 30rem"><div data-toast role="status"></div><p id="s-after">Action row</p></div>');
    const region = find(host, '[data-toast]');
    const after = find(host, '#s-after');
    assert.equal(computed(region).position, 'static', 'no position anywhere in the sheet');
    assert.equal(computed(region).zIndex, 'auto');
    assert.equal(region.getBoundingClientRect().height, 0, 'an empty live region takes no space, and is still in the tree');
    const before = after.getBoundingClientRect().top;
    region.innerHTML = '<p data-toast-notice><span>Saved</span></p>';
    assert.ok(after.getBoundingClientRect().top > before, 'the notice pushed the action row down instead of covering it');
  }));

test("semantics: the notice's entrance is Animation's timeline, and it names keyframes the document sheet defines", () =>
  withSheet(() => {
    const host = fixture('<div data-toast role="status"><p data-toast-notice><span>Saved</span><button data-toast-dismiss>x</button></p></div>');
    const notice = find(host, '[data-toast-notice]');
    assert.equal(computed(notice).animationName, 'anim-fade-in, anim-slide-up');
    assert.equal(computed(notice).animationDuration, '0.15s, 0.25s', 'the --duration-fast and --duration-base tokens resolved; Chrome serializes a computed <time> in seconds');
    assert.equal(computed(notice).animationFillMode, 'both, both');
    assert.equal(notice.getAnimations().length, 2, 'both steps are running, so the keyframes the timeline names exist');
  }));

test('semantics: an alert toast takes the danger colour; a status toast does not', () =>
  withSheet(() => {
    const style = 'style="--color-danger: rgb(200, 0, 0)"';
    const host = fixture(`<div data-toast role="status" ${style}><p data-toast-notice>a</p></div><div data-toast role="alert" ${style}><p data-toast-notice>b</p></div>`);
    const [polite, assertive] = host.querySelectorAll('[data-toast]');
    assert.ok(computed(find(polite, '[data-toast-notice]')).color !== 'rgb(200, 0, 0)');
    assert.equal(computed(find(assertive, '[data-toast-notice]')).color, 'rgb(200, 0, 0)');
    assert.equal(computed(find(assertive, '[data-toast-notice]')).borderTopColor, 'rgb(200, 0, 0)');
  }));

// ---- nav ----

/** A nav in a container of the given inline size; `pinned` adds data-nav-vertical. @param {string} inlineSize @param {boolean} pinned */
const navIn = (inlineSize, pinned) =>
  `<div style="inline-size: ${inlineSize}; container-type: inline-size"><nav data-nav ${pinned ? 'data-nav-vertical' : ''} aria-label="Main"><a data-nav-brand href="/">Brand</a><a href="/a" aria-current="page">A</a><a href="/b">B</a><span data-nav-title>Workspace</span></nav></div>`;

test('semantics: the nav asks its container, not the viewport — a row while it is narrow, a column from md', () =>
  withSheet(() => {
    const host = fixture(`${navIn('30rem', false)}${navIn('60rem', false)}`);
    const [narrow, wide] = host.querySelectorAll('[data-nav]');
    assert.equal(computed(narrow).flexDirection, 'row');
    assert.equal(computed(narrow).flexWrap, 'nowrap', 'below md one row that scrolls rather than wrapping');
    assert.equal(computed(narrow).overflowX, 'auto');
    assert.equal(computed(wide).flexDirection, 'column', 'the same markup, the same viewport, a wider container');
    assert.equal(computed(wide).alignItems, 'stretch');
  }));

test('semantics: with no container declared neither band matches and the wrapping row is what draws', () =>
  withSheet(() => {
    const host = fixture('<nav data-nav aria-label="Loose"><a href="/a">A</a></nav>');
    const nav = find(host, '[data-nav]');
    assert.equal(computed(nav).flexDirection, 'row');
    assert.equal(computed(nav).flexWrap, 'wrap');
  }));

test('semantics: data-nav-vertical pins the column whatever the container says, and the bands never fight it', () =>
  withSheet(() => {
    const host = fixture(`${navIn('30rem', true)}${navIn('60rem', true)}`);
    const [narrow, wide] = host.querySelectorAll('[data-nav]');
    for (const nav of [narrow, wide]) {
      assert.equal(computed(nav).flexDirection, 'column');
      assert.equal(computed(nav).flexWrap, 'nowrap');
    }
    assert.equal(computed(find(narrow, '[data-nav-brand]')).marginInlineEnd, '0px', 'the brand follows the axis');
    assert.equal(computed(find(narrow, '[data-nav-title]')).paddingInlineStart, '0px', 'and so does the title');
  }));

test('semantics: the current link is aria-current="page", and the axis flip moves the brand and the title with it', () =>
  withSheet(() => {
    const host = fixture(`${navIn('30rem', false)}${navIn('60rem', false)}`);
    const [narrow, wide] = host.querySelectorAll('[data-nav]');
    const accent = computed(find(narrow, '[aria-current="page"]')).color;
    assert.ok(accent !== computed(find(narrow, 'a[href="/b"]')).color, 'the current link is marked without a class');
    assert.equal(computed(find(narrow, '[data-nav-brand]')).marginInlineEnd, '16px', 'a row separates the brand along the inline axis');
    assert.equal(computed(find(wide, '[data-nav-brand]')).marginBlockEnd, '12px', 'a column separates it along the block axis');
    assert.equal(computed(find(wide, '[data-nav-title]')).borderInlineStartWidth, '0px');
    assert.ok(computed(find(wide, '[data-nav-title]')).borderBlockStartWidth !== '0px', 'the rule before the title turns with the axis');
  }));
