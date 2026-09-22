import { assert, fixture, test } from './harness.js';
import { FieldTracker, readField, readForm, writeField, writeForm } from '/dist/libraries/fields/index.js';

/**
 * A field inside a fixture, typed loosely so tests can set any field property.
 * @returns {any}
 */
const field = (root, selector) => root.querySelector(selector);

const FORM = `
  <form>
    <input name="title" value="Hi">
    <textarea name="notes">Some notes</textarea>
    <input type="number" name="count" value="3">
    <input type="number" name="empty">
    <input type="date" name="due" value="2026-10-01">
    <input type="radio" name="priority" value="low">
    <input type="radio" name="priority" value="normal" checked>
    <input type="radio" name="priority" value="high">
    <input type="checkbox" name="tags[]" value="home" checked>
    <input type="checkbox" name="tags[]" value="work">
    <input type="checkbox" name="tags[]" value="errand" checked>
    <input type="checkbox" name="done">
    <select name="size"><option>s</option><option selected>m</option></select>
    <select name="colors" multiple><option selected>red</option><option>green</option><option selected>blue</option></select>
    <input name="skipped" disabled value="x">
    <button name="go" value="1">Go</button>
  </form>`;

test('readForm gives uniform values per input type', () => {
  const form = fixture(FORM).querySelector('form');
  assert.deepEqual(readForm(form), {
    title: 'Hi', notes: 'Some notes', count: 3, empty: null, due: '2026-10-01',
    priority: 'normal', tags: ['home', 'errand'], done: false, size: 'm', colors: ['red', 'blue'],
  });
});

test('readField on any member of a group reads the whole group', () => {
  const form = fixture(FORM).querySelector('form');
  assert.deepEqual(readField(field(form, '[value=work]')), ['home', 'errand']);
  assert.equal(readField(field(form, '[value=high]')), 'normal');
});

test('an unchecked radio group reads null; a lone checkbox reads a boolean', () => {
  const form = fixture('<form><input type="radio" name="r" value="a"><input type="checkbox" name="c" checked></form>').querySelector('form');
  assert.deepEqual(readForm(form), { r: null, c: true });
});

test('checkboxes sharing a plain name form a group too', () => {
  const form = fixture('<form><input type="checkbox" name="pets" value="cat" checked><input type="checkbox" name="pets" value="dog"></form>').querySelector('form');
  assert.deepEqual(readForm(form), { pets: ['cat'] });
});

test('writeForm replaces values, clearing and unchecking what is not given', () => {
  const form = fixture(FORM).querySelector('form');
  writeForm(form, { title: 'Bye', priority: 'high', tags: ['work'], done: true, colors: ['green'], count: 7 });
  assert.deepEqual(readForm(form), {
    title: 'Bye', notes: '', count: 7, empty: null, due: '', priority: 'high',
    tags: ['work'], done: true, size: 's', colors: ['green'],
  });
  writeForm(form, { tags: [], done: false, priority: null });
  const values = readForm(form);
  assert.deepEqual([values.tags, values.done, values.priority], [[], false, null]);
});

test('writeField leaves an unchanged text value alone, so the caret stays', () => {
  const input = fixture('<input value="hello">').querySelector('input');
  document.body.append(input);
  input.focus();
  input.setSelectionRange(2, 2);
  writeField(input, 'hello');
  assert.equal(input.selectionStart, 2);
  input.remove();
});

test('change reports the previous value from the rendered defaults', () => {
  const form = fixture(FORM).querySelector('form');
  const tracker = new FieldTracker();
  const title = field(form, '[name=title]');
  title.value = 'Hello';
  assert.deepEqual(pick(tracker.change(title)), { name: 'title', value: 'Hello', previous: 'Hi' });
  title.value = 'Hello there';
  assert.deepEqual(pick(tracker.change(title)), { name: 'title', value: 'Hello there', previous: 'Hello' });
});

test('change is uniform: radio, checkbox group, lone checkbox, number, select, multi-select', () => {
  const form = fixture(FORM).querySelector('form');
  const tracker = new FieldTracker();
  tracker.remember(form);

  const high = field(form, '[value=high]');
  high.checked = true;
  assert.deepEqual(pick(tracker.change(high)), { name: 'priority', value: 'high', previous: 'normal' });

  const work = field(form, '[value=work]');
  work.checked = true;
  assert.deepEqual(pick(tracker.change(work)), { name: 'tags', value: ['home', 'work', 'errand'], previous: ['home', 'errand'] });

  const done = field(form, '[name=done]');
  done.checked = true;
  assert.deepEqual(pick(tracker.change(done)), { name: 'done', value: true, previous: false });

  const count = field(form, '[name=count]');
  count.value = '';
  assert.deepEqual(pick(tracker.change(count)), { name: 'count', value: null, previous: 3 });

  const size = field(form, '[name=size]');
  size.value = 's';
  assert.deepEqual(pick(tracker.change(size)), { name: 'size', value: 's', previous: 'm' });

  const colors = field(form, '[name=colors]');
  colors.options[1].selected = true;
  assert.deepEqual(pick(tracker.change(colors)), { name: 'colors', value: ['red', 'green', 'blue'], previous: ['red', 'blue'] });
});

test('remember without force keeps known values; with force re-baselines', () => {
  const form = fixture(FORM).querySelector('form');
  const tracker = new FieldTracker();
  const title = field(form, '[name=title]');
  tracker.remember(form);
  title.value = 'Typed';
  tracker.remember(form);
  assert.equal(tracker.change(title).previous, 'Hi');
  title.value = 'Filled';
  tracker.remember(form, true);
  title.value = 'Edited';
  assert.equal(tracker.change(title).previous, 'Filled');
});

test('fieldFor prefers the event target, then the element', () => {
  const form = fixture(FORM).querySelector('form');
  const title = field(form, '[name=title]');
  assert.equal(FieldTracker.fieldFor(/** @type {any} */ ({ target: title }), form), title);
  assert.equal(FieldTracker.fieldFor(/** @type {any} */ ({ target: form }), title), title);
  assert.equal(FieldTracker.fieldFor(/** @type {any} */ ({ target: form }), form), null);
});

function pick({ name, value, previous }) {
  return { name, value, previous };
}
