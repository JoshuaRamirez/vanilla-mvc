import { assert, fixture, test } from './harness.js';
import { behavior, html, morph, nothing, render } from '/dist/libraries/templates/index.js';

test('render puts the view in the target', () => {
  const target = fixture('');
  render(html`<p class=${'x'}>${'Hi'}</p>`, target);
  assert.equal(target.innerHTML, '<p class="x">Hi</p>');
});

test('re-render updates in place: same elements, focus and typed value survive', () => {
  const target = fixture('');
  document.body.append(target);
  const view = (label) => html`<form><label>${label}</label><input name="a"></form>`;
  render(view('One'), target);
  const input = target.querySelector('input');
  input.focus();
  input.value = 'typed';
  render(view('Two'), target);
  assert.equal(target.querySelector('input'), input);
  assert.equal(document.activeElement, input);
  assert.equal(input.value, 'typed');
  assert.equal(target.querySelector('label').textContent, 'Two');
  target.remove();
});

test('keyed children are reordered, not recreated', () => {
  const target = fixture('');
  const list = (ids) => html`<ul>${ids.map((id) => html`<li data-key=${id}>${id}</li>`)}</ul>`;
  render(list([1, 2, 3]), target);
  const [one, two, three] = target.querySelectorAll('li');
  render(list([3, 1]), target);
  const items = [...target.querySelectorAll('li')];
  assert.deepEqual(items.map((li) => li.textContent), ['3', '1']);
  assert.equal(items[0], three);
  assert.equal(items[1], one);
  assert.ok(!two.isConnected);
});

test('attributes are added, changed, and removed', () => {
  const target = fixture('');
  const view = (title) => html`<p title=${title} ?hidden=${!title}></p>`;
  render(view('a'), target);
  render(view(null), target);
  const p = target.querySelector('p');
  assert.equal(p.hasAttribute('title'), false);
  assert.equal(p.hasAttribute('hidden'), true);
});

test('properties are set after rendering', () => {
  const target = fixture('');
  render(html`<input type="checkbox" .checked=${true}><input .value=${'v'}>`, target);
  const [box, text] = target.querySelectorAll('input');
  assert.equal(box.checked, true);
  assert.equal(text.value, 'v');
});

test('events are delegated with (event, element), nearest first, and see fresh handlers', () => {
  const target = fixture('');
  const calls = [];
  const view = (tag) => html`<div @click=${(e, el) => calls.push(`outer-${tag}-${el.tagName}`)}><button @click=${(e, el) => calls.push(`inner-${tag}-${el.tagName}`)}><span>x</span></button></div>`;
  render(view('a'), target);
  render(view('b'), target);
  target.querySelector('span').click();
  assert.deepEqual(calls, ['inner-b-BUTTON', 'outer-b-DIV']);
});

test('stopPropagation stops the delegated bubbling', () => {
  const target = fixture('');
  const calls = [];
  render(html`<div @click=${() => calls.push('outer')}><button @click=${(e) => { e.stopPropagation(); calls.push('inner'); }}></button></div>`, target);
  target.querySelector('button').click();
  assert.deepEqual(calls, ['inner']);
});

test('non-bubbling events (blur) reach only their own element', () => {
  const target = fixture('');
  document.body.append(target);
  const calls = [];
  render(html`<div @blur=${() => calls.push('div')}><input @blur=${() => calls.push('input')}></div>`, target);
  // Dispatched directly: background tabs don't fire real focus events.
  target.querySelector('input').dispatchEvent(new FocusEvent('blur'));
  assert.deepEqual(calls, ['input']);
  target.remove();
});

test('boundaries keep their contents: a parent re-render leaves a child view alone', () => {
  const parent = fixture('');
  const view = (label) => html`<section><h1>${label}</h1><div data-component="child"></div></section>`;
  render(view('One'), parent, { boundary: '[data-component]' });
  const slot = parent.querySelector('[data-component=child]');
  const childCalls = [];
  render(html`<button @click=${() => childCalls.push('child')}>child</button>`, slot, { boundary: '[data-component]' });
  const button = slot.querySelector('button');
  render(view('Two'), parent, { boundary: '[data-component]' });
  assert.equal(parent.querySelector('[data-component=child] button'), button);
  button.click();
  assert.deepEqual(childCalls, ['child']);
});

test('parent and child handler tables never collide', () => {
  const parent = fixture('');
  const calls = [];
  render(html`<div @click=${() => calls.push('parent')}><div data-component="c"></div></div>`, parent, { boundary: '[data-component]' });
  const slot = parent.querySelector('[data-component=c]');
  render(html`<button @click=${() => calls.push('child')}></button>`, slot, { boundary: '[data-component]' });
  slot.querySelector('button').click();
  assert.deepEqual(calls, ['child', 'parent']);
});

test('changing a keyed placeholder swaps it; the old contents go with it', () => {
  const target = fixture('');
  const view = (page) => html`<main data-component=${page}></main>`;
  render(view('home'), target, { boundary: '[data-component]' });
  target.querySelector('main').innerHTML = '<p>home content</p>';
  render(view('todos'), target, { boundary: '[data-component]' });
  assert.equal(target.querySelector('main').dataset.component, 'todos');
  assert.equal(target.querySelector('main').innerHTML, '');
});

test('behaviors run after each render with the element', () => {
  const target = fixture('');
  const seen = [];
  const mark = behavior((element, label) => seen.push(`${element.tagName}:${label}`));
  render(html`<form ${mark('a')}><input ${mark('b')}></form>`, target);
  assert.deepEqual(seen, ['FORM:a', 'INPUT:b']);
});

test('morph handles text-only and mixed content', () => {
  const target = fixture('<p>old</p>text');
  morph(target, 'new text<p>new</p>');
  assert.equal(target.innerHTML, 'new text<p>new</p>');
});
