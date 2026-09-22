import { assert, fixture, test } from './harness.js';
import { apply, css } from '/dist/libraries/css/templates/index.js';
import { atContainer, atLeast, below, fluid, inContainer } from '/dist/libraries/css/responsive/index.js';
import { layout, responsive } from '/dist/libraries/css/index.js';
import { Style, Template, css as frameworkCss, defaultAdapters, html, styled, useAdapters } from '/dist/framework/index.js';

// The Responsive engine in a real browser: its wrappers and preludes inside css-templates' @scope,
// and its fluid values resolving cqi at the consumer. Containers are resized, never the window.
const RED = 'rgb(255, 0, 0)';
const BLACK = 'rgb(0, 0, 0)';
const color = (element) => getComputedStyle(element).color;
const px = (element) => getComputedStyle(element).fontSize;
const sheets = () => document.adoptedStyleSheets;
/** The seam scopes an HTMLElement; the DOM hands back Element. @param {Element | null} node @returns {HTMLElement} */
const el = (node) => /** @type {HTMLElement} */ (node);
/** A descendant as an HTMLElement. @param {Element} root @param {string} selector */
const find = (root, selector) => el(root.querySelector(selector));

test('responsive: a scoped rule inside @media matches only within the scope; a band that is false matches nothing', () => {
  const host = fixture('<div><p class="rsp-m">in</p></div><div><p class="rsp-m">out</p></div>');
  const scope = el(host.children[0]);
  apply(css`${atLeast('1rem', css`.rsp-m { color: ${'red'}; }`)} ${below('1rem', '.rsp-m { font-weight: 700; }')}`, scope);
  assert.equal(color(find(scope, '.rsp-m')), RED, '@scope descends into @media');
  assert.equal(color(find(el(host.children[1]), '.rsp-m')), BLACK, 'outside the scope');
  assert.equal(getComputedStyle(find(scope, '.rsp-m')).fontWeight, '400', 'below 1rem is never true');
});

test('responsive: a scoped rule inside @container follows the container as it is resized, and matches only within the scope', () => {
  const card = (w) => `<div class="rsp-card" style="container: rsp-card / inline-size; width: ${w}px"><p class="rsp-c">x</p></div>`;
  const host = fixture(card(800) + card(800));
  const scope = el(host.children[0]);
  apply(css`${atContainer('rsp-card', 'md', css`.rsp-c { color: ${'red'}; }`)}`, scope);
  assert.equal(color(find(scope, '.rsp-c')), RED, '800px is at least md (48rem at the 16px default)');
  assert.equal(color(find(el(host.children[1]), '.rsp-c')), BLACK, 'the same container outside the scope');
  scope.style.width = '300px';
  assert.equal(color(find(scope, '.rsp-c')), BLACK, 'narrowed below md: the band no longer applies');
  scope.style.width = '800px';
  assert.equal(color(find(scope, '.rsp-c')), RED, 'widened again');
});

test('responsive: a prelude at statement start leaves its inner hole live, on the nearest container', () => {
  const host = fixture('<div style="container-type: inline-size; width: 700px"><div><p class="rsp-p">x</p></div></div>');
  const outer = el(host.firstElementChild);
  const scope = el(outer.firstElementChild);
  apply(css`${inContainer.atLeast.sm} { .rsp-p { color: ${'red'}; } }`, scope);
  assert.equal(color(find(scope, '.rsp-p')), RED, '700px is at least sm (40rem)');
  outer.style.width = '500px';
  assert.equal(color(find(scope, '.rsp-p')), BLACK);
});

test('responsive: fluid({ selector: ":scope", relativeTo: "container" }) sizes text by the container, exact at both ends', () => {
  const host = fixture('<div style="container-type: inline-size; width: 600px"><div><p class="rsp-f">x</p></div></div>');
  const outer = el(host.firstElementChild);
  const scope = el(outer.firstElementChild);
  apply(css`${fluid({ selector: ':scope', relativeTo: 'container', scales: ['text'] })} .rsp-f { font-size: var(--text-md); }`, scope);
  const text = find(scope, '.rsp-f');
  assert.equal(px(text), '16px', 'at and below sm: the minimum, 1rem');
  outer.style.width = '1400px';
  assert.equal(px(text), '18px', 'at and above xl: the maximum, 1.125rem');
  outer.style.width = '960px';
  assert.equal(px(text), '17px', 'halfway, 60rem: halfway');
});

test('responsive: a wrapper equal by value on re-apply touches no sheet — string rules and css rules alike', () => {
  const scope = el(fixture('<div><p class="rsp-r">x</p></div>').firstElementChild);
  const style = (weight) => css`${atLeast('1rem', ['.rsp-r {', ` font-weight: ${weight};`, ' }'].join(''))} ${atLeast('2rem', css`.rsp-r { color: ${'red'}; }`)}`;
  apply(style(700), scope);
  const snapshot = [...sheets()];
  const token = scope.getAttribute('data-css');
  apply(style(700), scope);
  assert.equal(sheets().length, snapshot.length);
  snapshot.forEach((sheet, i) => assert.ok(sheets()[i] === sheet, `sheet ${i} is the same object in the same place`));
  assert.equal(scope.getAttribute('data-css'), token);
  assert.equal(getComputedStyle(find(scope, '.rsp-r')).fontWeight, '700');
  assert.equal(color(find(scope, '.rsp-r')), RED);
  apply(style(400), scope);
  assert.equal(sheets().length, snapshot.length + 1, 'a changed string is a new variant: one new sheet');
});

// The path an application takes: a Style mounted by styled on a Template root, the CSS library
// through its root index as namespaces, the framework's css tag around the engine's wrappers.
const BUDGET = 4000;
const cssIndex = '/dist/libraries/css/index.js';
const frameworkIndex = '/dist/framework/index.js';

/** Two animation frames: a resized iframe re-evaluates its media queries by then. */
const frames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

test('responsive through the framework: atLeast/below on :scope follow the viewport of the document the component renders in', async () => {
  // A page test cannot move its own viewport, and a constructed sheet cannot be adopted by another
  // document: the component renders inside an iframe that loads the framework itself, and the
  // iframe's width is its viewport.
  const doc = `<!doctype html><body style="margin: 0"><div id="host"></div><script type="module">
    import { Style, Template, css, defaultAdapters, html, styled, useAdapters } from '${frameworkIndex}';
    import { responsive } from '${cssIndex}';
    useAdapters(defaultAdapters());
    const style = new Style((m) => css\`
      \${responsive.atLeast('md', css\`:scope { color: \${m.wide}; }\`)}
      \${responsive.below('md', css\`:scope { font-weight: \${m.narrow}; }\`)}
    \`);
    const template = new Template((m) => html\`<nav class="rsp-shell" \${styled(style, m)}>shell</nav>\`);
    const view = template.render({ wide: 'red', narrow: 700 }, {}, document.getElementById('host'));
    window.read = () => [getComputedStyle(view).color, getComputedStyle(view).fontWeight];
    parent.postMessage('rsp-ready', '*');
  </scr` + `ipt></body>`;
  const frame = /** @type {HTMLIFrameElement} */ (document.createElement('iframe'));
  frame.width = '600';
  frame.height = '200';
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ready from the iframe in ${BUDGET} ms`)), BUDGET);
    const heard = (/** @type {MessageEvent} */ event) => {
      if (event.source !== frame.contentWindow || event.data !== 'rsp-ready') return;
      clearTimeout(timer);
      removeEventListener('message', heard);
      resolve(undefined);
    };
    addEventListener('message', heard);
    frame.addEventListener('error', () => reject(new Error('the iframe failed to load')));
  });
  frame.srcdoc = doc;
  fixture('').append(frame);
  await ready;
  const read = async (width) => {
    frame.width = String(width);
    void frame.offsetWidth; // lay out the parent, so the child's viewport is the new width
    await frames();
    return /** @type {any} */ (frame.contentWindow).read();
  };
  assert.deepEqual(await read(600), [BLACK, '700'], '600px is below md: below applies, atLeast does not');
  assert.deepEqual(await read(1000), [RED, '400'], '1000px is at least md: atLeast applies, below does not');
  assert.deepEqual(await read(768), [RED, '400'], 'exactly 48rem is atLeast md, not below it');
  assert.deepEqual(await read(600), [BLACK, '700'], 'and back');
});

test('responsive through the framework: atContainer under Layout container() switches the container’s child, only inside the scope', () => {
  useAdapters(defaultAdapters());
  const style = new Style((m) => frameworkCss`
    .rsp-list { ${layout.container('rsplist')} }
    ${responsive.atContainer('rsplist', 'md', frameworkCss`.rsp-list > .rsp-row { color: ${m.wide}; }`)}
  `);
  const template = new Template((m) => html`<section ${styled(style, m)}><div class="rsp-list"><p class="rsp-row">${m.label}</p></div></section>`);
  const host = fixture('<div style="width: 800px"><div></div></div><div style="width: 800px"><section><div class="rsp-list"><p class="rsp-row">plain</p></div></section></div>');
  const wrapper = el(host.children[0]);
  const view = template.render({ wide: 'red', label: 'one' }, {}, el(wrapper.firstElementChild));
  const row = find(view, '.rsp-row');
  const plain = find(el(host.children[1]), '.rsp-row');
  assert.equal(getComputedStyle(find(view, '.rsp-list')).containerName, 'rsplist', 'Layout declared the container');
  assert.equal(color(row), RED, '800px is at least md');
  assert.equal(color(plain), BLACK, 'the same markup outside the scope is no container and does not switch');
  wrapper.style.width = '300px';
  assert.equal(color(row), BLACK, 'narrowed below md');
  assert.equal(color(plain), BLACK);
  template.render({ wide: 'blue', label: 'two' }, {}, el(wrapper.firstElementChild));
  wrapper.style.width = '800px';
  assert.equal(row.textContent, 'two');
  assert.equal(color(row), 'rgb(0, 0, 255)', 'widened again, after a re-render with a changed model');
  assert.equal(color(plain), BLACK);
});
