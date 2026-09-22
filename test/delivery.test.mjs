// An event position takes a function the change engine will hear from, or nothing.
//
// An unregistered function there runs on a click, writes the model, calls changed() and draws
// nothing. The renderer adapter refuses it when the template is built, so the mistake is an error
// at the first render instead of a button that silently does nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultAdapters, field, formValues, html, keys, nothing, prevent, useAdapters } from '../dist/framework/index.js';
import { deliver, isDelivered } from '../dist/framework/delivery.js';

useAdapters(defaultAdapters());

const registered = () => deliver(() => {});

test('an unregistered function in an event position is refused, naming the fix', () => {
  assert.throws(
    () => html`<button @click=${() => {}}>Save</button>`,
    (error) =>
      error instanceof TypeError &&
      /@click is bound to a function no controller registered/.test(error.message) &&
      /this\.handle\('save', this\.#save\)/.test(error.message) &&
      /c\.handler\('save'\)/.test(error.message),
  );
});

test('a registered handler, nothing and null are all accepted', () => {
  html`<button @click=${registered()}>Save</button>`;
  html`<button @click=${nothing}>Save</button>`;
  html`<button @click=${null}>Save</button>`;
});

test('the view helpers keep the registration of what they wrap, and only then', () => {
  for (const helper of [prevent, field, formValues]) {
    assert.ok(isDelivered(helper(registered())), `${helper.name} of a registered handler`);
    assert.ok(!isDelivered(helper(() => {})), `${helper.name} of a bare function`);
  }
  assert.ok(isDelivered(keys({ Enter: registered(), Escape: registered() })), 'keys of registered handlers');
  assert.ok(!isDelivered(keys({ Enter: registered(), Escape: () => {} })), 'keys with one bare function');
  html`<form @submit=${prevent(formValues(registered()))}></form>`;
  assert.throws(() => html`<form @submit=${prevent(() => {})}></form>`, TypeError);
});

test('a function anywhere but an event position is not judged', () => {
  html`<input .value=${() => 'a property may hold a function'}>`;
  html`<p>${'text'}</p>`;
});

test('a nested template is checked too: every html call goes through the adapter', () => {
  assert.throws(() => html`<ul>${[1].map(() => html`<li @click=${() => {}}></li>`)}</ul>`, TypeError);
});
