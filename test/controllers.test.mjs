import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultAdapters, useAdapters } from '../dist/framework/index.js';
import { ConfirmDialogController } from '../dist/app/components/confirm-dialog/confirm-dialog.controller.js';
import { CounterController } from '../dist/app/components/counter/counter.controller.js';
import { EditTodoPageController } from '../dist/app/components/edit-todo-page/edit-todo-page.controller.js';
import { TodoFormValues } from '../dist/app/components/edit-todo-page/todo-form-values.js';
import { HomePageController } from '../dist/app/components/home-page/home-page.controller.js';
import { NavBarController } from '../dist/app/components/nav-bar/nav-bar.controller.js';
import { ShellController } from '../dist/app/components/shell/shell.controller.js';
import { ToastController } from '../dist/app/components/toast/toast.controller.js';
import { TodoListPageController } from '../dist/app/components/todo-list-page/todo-list-page.controller.js';
import { TodoRowController } from '../dist/app/components/todo-row/todo-row.controller.js';
import { mount, recorder, route } from './support.mjs';

useAdapters(defaultAdapters()); // controllers build URLs through the routing seam

/** A stand-in application domain whose capabilities record calls. */
function fakeDomain() {
  const calls = [];
  const names = ['collection', 'browsing', 'draft', 'editing', 'notices', 'questions', 'requests', 'tally'];
  return { calls, domain: Object.fromEntries(names.map((name) => [name, recorder(name, calls)])) };
}

const fact = (overrides) => Object.freeze({ notes: '', priority: 'normal', due: null, tags: [], done: false, overdue: false, ...overrides });
const todos = [fact({ id: 1, title: 'Write it', done: true }), fact({ id: 2, title: 'Ship it', priority: 'high', due: '2026-09-01', tags: ['work'], overdue: true })];
const values = { title: 'Ship it', notes: '', priority: 'high', due: '2026-09-01', tags: ['work'], done: false };
const editing = (overrides) => ({ type: 'EditingChanged', id: 2, status: 'open', baseline: values, revision: 1, values, errors: {}, dirty: false, saving: false, canSave: false, lastChange: null, ...overrides });

test('models are plain objects created by the controller', () => {
  const { domain } = fakeDomain();
  const { model } = mount(ShellController, domain);
  assert.equal(Object.getPrototypeOf(model), Object.prototype);
  assert.deepEqual(model, { page: 'home-page' });
});

test('shell: route events set the page', () => {
  const { domain } = fakeDomain();
  const { model, bus } = mount(ShellController, domain);
  bus.publish({ type: 'RouteChanged', route: route('todo', { id: '2' }) });
  assert.equal(model.page, 'edit-todo-page');
  bus.publish({ type: 'RouteChanged', route: route('nope') });
  assert.equal(model.page, 'not-found-page');
});

test('nav bar: tabs from route events, badge from TodosListed', () => {
  const { domain } = fakeDomain();
  const { model, bus } = mount(NavBarController, domain);
  bus.publish({ type: 'RouteChanged', route: route('todo') });
  bus.publish({ type: 'TodosListed', todos, remaining: 1, completed: 1 });
  assert.deepEqual([model.todosActive, model.homeActive, model.remaining, model.hasBadge], [true, false, 1, true]);
});

test('counter: gestures go to the tally; TallyChanged fills the model', () => {
  const { domain, calls } = fakeDomain();
  const { controller, model, bus } = mount(CounterController, domain);
  controller.handler('increment')();
  controller.handler('stepChanged')({ name: '', value: 5, previous: 1 });
  controller.handler('reset')();
  assert.deepEqual(calls, [['tally.increment'], ['tally.changeStep', 5], ['tally.reset']]);
  bus.publish({ type: 'TallyChanged', count: 3, step: null });
  assert.deepEqual(model, { count: 3, step: '', canReset: true });
});

test('list page: TodosShown fills tabs, rows, and text; gestures go to draft, browsing, collection', () => {
  const { domain, calls } = fakeDomain();
  const { controller, model, bus, synced } = mount(TodoListPageController, domain);
  bus.publish({ type: 'TodosListed', todos, remaining: 1, completed: 1 });
  assert.equal(synced.length, 1, 'rows synced from TodosListed');
  bus.publish({ type: 'TodosShown', filter: 'active', query: 'ship', ids: [2], loaded: true, remaining: 1, completed: 1 });
  assert.deepEqual(model.tabs.map((t) => `${t.href}${t.active ? '*' : ''}`), ['/todos?q=ship', '/todos/active?q=ship*', '/todos/completed?q=ship']);
  assert.deepEqual([model.rowKeys, model.query, model.empty, model.footerText, model.canClearCompleted], [['todo-row-2'], 'ship', false, '1 left · double-click a title to rename', true]);
  bus.publish({ type: 'BusyChanged', busy: true });
  assert.deepEqual([model.canAdd, model.canClearCompleted], [false, false]);
  bus.publish({ type: 'DraftChanged', text: 'Buy' });
  assert.equal(model.draft, 'Buy');

  controller.handler('changeDraft')({ value: 'Buy milk' });
  controller.handler('add')();
  controller.handler('search')({ value: 'milk' });
  controller.handler('clearCompleted')();
  assert.deepEqual(calls, [['draft.change', 'Buy milk'], ['draft.submit'], ['browsing.search', 'milk'], ['collection.clearCompleted']]);
});

test('row: starts from its todo; renaming comes from RenamingChanged; gestures go to the collection', () => {
  const { domain, calls } = fakeDomain();
  const { controller, model, bus } = mount(TodoRowController, domain, todos[1]);
  assert.deepEqual([model.title, model.highPriority, model.dueLabel, model.editHref, model.renaming], ['Ship it', true, 'overdue 2026-09-01', '/todos/2', false]);
  controller.handler('startRenaming')();
  assert.equal(model.renaming, false, 'asking to rename changes nothing until the domain says so');
  bus.publish({ type: 'RenamingChanged', id: 2 });
  assert.equal(model.renaming, true);
  controller.handler('rename')({ value: 'Ship it now' });
  controller.handler('stopRenaming')();
  controller.handler('toggle')();
  controller.handler('remove')();
  assert.deepEqual(calls, [['collection.beginRenaming', 2], ['collection.rename', 2, 'Ship it now'], ['collection.stopRenaming', 2], ['collection.toggle', 2], ['collection.remove', 2]]);
  bus.publish({ type: 'TodosListed', todos: [fact({ id: 2, title: 'Renamed' })], remaining: 1, completed: 0 });
  bus.publish({ type: 'RenamingChanged', id: null });
  assert.deepEqual([model.title, model.renaming], ['Renamed', false]);
});

test('form values translate between the form and EditValues', () => {
  const form = TodoFormValues.fromForm({ title: ' Hi ', tags: 'home', done: true, due: '' });
  assert.deepEqual(form.toValues(), { title: 'Hi', notes: '', priority: 'normal', due: null, tags: ['home'], done: true });
});

test('edit page: EditingChanged fills the model; fill values change only with the revision; gestures go to editing', () => {
  const { domain, calls } = fakeDomain();
  const { controller, model, bus } = mount(EditTodoPageController, domain);
  bus.publish({ type: 'TodoOptionsListed', priorities: ['low', 'normal', 'high'], tags: ['home', 'work'] });
  bus.publish(editing());
  const filled = model.formValues;
  bus.publish(editing({ values: { ...values, title: 'typing' }, dirty: true, canSave: true, lastChange: { field: 'tags', previous: ['work'], value: ['work', 'home'] } }));
  assert.equal(model.formValues, filled);
  assert.deepEqual([model.dirty, model.canSave, model.lastChangeText], [true, true, 'tags: work → work, home']);
  bus.publish(editing({ revision: 2, errors: { title: 'Taken' }, saving: true }));
  assert.notEqual(model.formValues, filled);
  assert.deepEqual([model.errors, model.saveLabel, model.priorities.length], [{ title: 'Taken' }, 'Saving…', 3]);

  controller.handler('fieldChanged')({ name: 'priority', previous: 'normal', value: 'high' });
  controller.handler('save')({ title: 'Ship', priority: 'high', tags: ['work'] });
  controller.handler('revert')();
  assert.deepEqual(calls.map(([name]) => name), ['editing.noteFieldChange', 'editing.change', 'editing.save', 'editing.revert']);
  assert.equal(calls[1][1].title, 'Ship');
});

test('toast: NoticeRaised is worded; retry and dismiss go to the domain', () => {
  const { domain, calls } = fakeDomain();
  const { controller, model, bus } = mount(ToastController, domain);
  bus.publish({ type: 'NoticeRaised', reason: 'saved', detail: 'Ship it', retryable: false });
  assert.deepEqual(model, { visible: true, tone: 'info', text: 'Saved “Ship it”.', canRetry: false });
  bus.publish({ type: 'NoticeRaised', reason: 'request-failed', detail: 'down', retryable: true });
  assert.deepEqual([model.tone, model.canRetry], ['error', true]);
  controller.handler('retry')();
  assert.deepEqual(calls, [['notices.dismiss'], ['requests.retry']]);
  bus.publish({ type: 'NoticeDismissed' });
  assert.equal(model.visible, false);
});

test('confirm dialog: ConfirmationAsked is worded; answers go to Questions; ConfirmationAnswered closes it', () => {
  const { domain, calls } = fakeDomain();
  const { controller, model, bus } = mount(ConfirmDialogController, domain);
  bus.publish({ type: 'ConfirmationAsked', id: 7, reason: 'discard-changes', subject: '', count: 1 });
  assert.deepEqual([model.open, model.title, model.cancelLabel], [true, 'Discard your changes?', 'Keep editing']);
  controller.handler('accept')();
  assert.deepEqual(calls, [['questions.answer', 7, true]]);
  bus.publish({ type: 'ConfirmationAnswered', id: 8, confirmed: true });
  assert.equal(model.open, true, 'another question’s answer');
  bus.publish({ type: 'ConfirmationAnswered', id: 7, confirmed: true });
  assert.equal(model.open, false);
});

test('home page: fail the next request goes to the domain', () => {
  const { domain, calls } = fakeDomain();
  const { controller, model } = mount(HomePageController, domain);
  controller.handler('failNextRequest')();
  assert.deepEqual([calls, model.scenarios.length], [[['requests.failNext']], 12]);
});

test('an application event states a change and renders nothing; the gesture renders once', () => {
  const { domain } = fakeDomain();
  const { controller, bus, renders } = mount(CounterController, domain);

  bus.publish({ type: 'TallyChanged', count: 3, step: 1 });
  bus.publish({ type: 'TallyChanged', count: 4, step: 1 });
  assert.deepEqual(renders, [], 'events map onto the model; they never render');

  controller.handler('increment')();
  assert.deepEqual(renders, ['rerender'], 'one render for the whole gesture');
});

test('a gesture that changed nothing renders nothing', () => {
  const { domain } = fakeDomain();
  const { controller, renders } = mount(HomePageController, domain);
  controller.handler('failNextRequest')();
  assert.deepEqual(renders, []);
});

test('an event a controller has no use for states nothing', () => {
  const { domain } = fakeDomain();
  const { controller, bus, renders } = mount(TodoRowController, domain, fact({ id: 1, title: 'Write it' }));

  bus.publish({ type: 'TodosListed', todos: [fact({ id: 99, title: 'Someone else' })], remaining: 1, completed: 0 });
  controller.handler('toggle')();
  assert.deepEqual(renders, [], 'the row is not in the list; nothing to render');

  bus.publish({ type: 'TodosListed', todos: [fact({ id: 1, title: 'Renamed' })], remaining: 1, completed: 0 });
  controller.handler('toggle')();
  assert.deepEqual(renders, ['rerender']);
});

/** A domain whose named method answers with a promise the test resolves. */
function slowDomain(capability, method) {
  /** @type {(value: unknown) => void} */
  let finish = () => {};
  const work = new Promise((resolve) => (finish = resolve));
  const calls = [];
  return { calls, work, finish, domain: { [capability]: recorder(capability, calls, { [method]: work }) } };
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

test('work handed back by a handler renders again when it settles', async () => {
  const { domain, work, finish } = slowDomain('collection', 'toggle');
  const { controller, bus, renders } = mount(TodoRowController, domain, fact({ id: 1, title: 'Write it' }));

  controller.handler('toggle')();
  assert.deepEqual(renders, [], 'nothing was stated yet: the server has not answered');

  // The server answers on its own stack, with no gesture to end it.
  bus.publish({ type: 'TodosListed', todos: [fact({ id: 1, title: 'Written' })], remaining: 0, completed: 1 });
  assert.deepEqual(renders, [], 'stated, and still waiting');

  finish(true);
  await work;
  await settled();
  assert.deepEqual(renders, ['rerender'], 'the handler owned the work, so the loop closed');
});

test('the shell asks for the list at startup and owns the wait', async () => {
  const { domain, calls, work, finish } = slowDomain('collection', 'refresh');
  const { bus, renders } = mount(ShellController, domain);
  assert.deepEqual(calls, [['collection.refresh']], 'the shell asks; the domain no longer asks itself');

  bus.publish({ type: 'RouteChanged', route: route('todos') });
  assert.deepEqual(renders, [], 'no gesture has ended, so nothing has rendered');

  finish(true);
  await work;
  await settled();
  assert.deepEqual(renders, ['rerender'], 'the startup load renders itself');
});
