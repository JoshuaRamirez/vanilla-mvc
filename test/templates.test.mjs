import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, behavior, html, nothing, serialize } from '../dist/libraries/templates/index.js';

const kinds = (view) => analyze(view.strings).map((h) => (h.name ? `${h.kind}:${h.name}` : h.kind));
const out = (view) => serialize(view, 'v0');

test('analyze tells positions apart', () => {
  const view = html`<p class="a ${1}" title=${2} data-x="${3}" ?hidden=${4} .value=${5} @click=${6} ${7}>${8}</p>`;
  assert.deepEqual(kinds(view), ['attributePart', 'attribute:title', 'attribute:data-x', 'boolean:hidden', 'property:value', 'event:click', 'element', 'text']);
});

test('text is escaped; nothing, null, undefined, and false render empty', () => {
  assert.equal(out(html`<p>${'<b>&"'}</p>`).html, '<p>&lt;b&gt;&amp;&quot;</p>');
  assert.equal(out(html`<p>${nothing}${null}${undefined}${false}${0}</p>`).html, '<p>0</p>');
});

test('nested templates and arrays render inline', () => {
  const items = ['a', 'b'];
  assert.equal(out(html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`).html, '<ul><li>a</li><li>b</li></ul>');
});

test('attributes: quoted and unquoted become quoted and escaped; nothing removes them', () => {
  assert.equal(out(html`<a href=${'/x?a=1&b="2"'} title="${'t'}">`).html, '<a href="/x?a=1&amp;b=&quot;2&quot;" title="t">');
  assert.equal(out(html`<a href=${nothing} title=${null}>`).html, '<a  >');
});

test('attribute parts are escaped in place', () => {
  assert.equal(out(html`<p class="toast ${'error'} big">`).html, '<p class="toast error big">');
});

test('boolean attributes are present only when truthy', () => {
  assert.equal(out(html`<button ?disabled=${true} ?hidden=${false}>`).html, '<button disabled >');
});

test('events become prefixed markers and collect handlers and event types', () => {
  const click = () => {};
  const result = out(html`<button @click=${click} @dblclick=${nothing}>`);
  assert.equal(result.html, '<button data-on-click="v0:0" >');
  assert.deepEqual(result.handlers, [click]);
  assert.deepEqual([...result.events], ['click']);
});

test('properties and behaviors become prefixed markers with bindings in order', () => {
  const focus = behavior(() => {});
  const result = out(html`<input .value=${'x'} ${focus()}><input .checked=${true}>`);
  assert.equal(result.html, '<input data-v0-0 data-v0-1><input data-v0-2>');
  assert.deepEqual(result.bindings.map((b) => (b.kind === 'property' ? `${b.name}=${b.value}` : 'behavior')), ['value=x', 'behavior', 'checked=true']);
});

test('markers are deterministic across renders, so morphing sees no change', () => {
  const view = (n) => html`<button @click=${() => n}>${n}</button>`;
  assert.equal(out(view(1)).html.replace('1<', '#<'), out(view(2)).html.replace('2<', '#<'));
});

test('handlers inside loops capture their own item', () => {
  const clicked = [];
  const result = out(html`${[1, 2, 3].map((n) => html`<b @click=${() => clicked.push(n)}></b>`)}`);
  result.handlers[1](new Event('click'), null);
  assert.deepEqual(clicked, [2]);
});

test('misuse is reported', () => {
  assert.throws(() => out(html`<b @click=${'nope'}>`), /needs a function/);
  assert.throws(() => out(html`<b ${'nope'}>`), /Only behaviors/);
  assert.throws(() => analyze(html`<b class="x @click=${() => {}}">`.strings), /whole attribute value/);
});
