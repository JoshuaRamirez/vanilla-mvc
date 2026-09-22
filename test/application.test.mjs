import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RouteChange } from '../dist/libraries/router/route-change.js';
import { defaultAdapters, useAdapters } from '../dist/framework/index.js';
import { ApplicationDomain } from '../dist/app/application/application-domain.js';
import { Confirmation } from '../dist/app/application/communication/confirmation.js';
import { Notice } from '../dist/app/application/communication/notice.js';
import { Notices } from '../dist/app/application/communication/notices.js';
import { Questions } from '../dist/app/application/communication/questions.js';
import { EditSession } from '../dist/app/application/editing/edit-session.js';
import { TodoEditing } from '../dist/app/application/editing/todo-editing.js';
import { FieldErrors } from '../dist/app/application/server/field-errors.js';
import { NotFoundError } from '../dist/app/application/server/not-found-error.js';
import { ServerRequests } from '../dist/app/application/server/server-requests.js';
import { ValidationError } from '../dist/app/application/server/validation-error.js';
import { Tally } from '../dist/app/application/tally/tally.js';
import { Todo } from '../dist/app/application/todos/todo.js';
import { TodoBrowsing } from '../dist/app/application/todos/todo-browsing.js';
import { TodoChanges } from '../dist/app/application/todos/todo-changes.js';
import { TodoCollection } from '../dist/app/application/todos/todo-collection.js';
import { TodoDraft } from '../dist/app/application/todos/todo-draft.js';
import { TodoFilter } from '../dist/app/application/todos/todo-filter.js';
import { TodoList } from '../dist/app/application/todos/todo-list.js';
import { UnsavedWork } from '../dist/app/application/work/unsaved-work.js';
import { application, last, namesOf, route } from './support.mjs';

useAdapters(defaultAdapters()); // the domain builds URLs through the routing seam

/** @type {import('../dist/app/application/todos/todo.js').TodoData[]} */
const data = [
  { id: 1, title: 'Write it', done: true },
  { id: 2, title: 'Ship it', notes: 'Soon', priority: 'high', due: '2026-09-01', tags: ['work'], done: false },
];
const list = () => TodoList.fromData(data);

/**
 * The capabilities wired on one bus, over a fake server.
 * @param {any} [api]
 */
function domain(api = {}) {
  const app = application();
  const notices = new Notices();
  const questions = new Questions();
  const requests = new ServerRequests({ failNext() {}, ...api }, notices);
  const collection = new TodoCollection(api, requests, questions);
  const browsing = new TodoBrowsing(collection);
  const draft = new TodoDraft(collection);
  const editing = new TodoEditing(api, requests, collection, notices);
  const unsavedWork = new UnsavedWork(questions);
  const tally = new Tally();
  for (const capability of [notices, questions, requests, collection, browsing, draft, editing, unsavedWork, tally]) {
    capability.parent = app;
    capability.interconnect();
  }
  return { ...app, notices, questions, requests, collection, browsing, draft, editing, unsavedWork, tally };
}

/** Answer the next question the way the dialog does: through Questions. */
function answerNext({ bus, questions }, confirmed) {
  const off = bus.subscribe('ConfirmationAsked', ({ id }) => {
    off();
    queueMicrotask(() => questions.answer(id, confirmed));
  });
}

// ---- Values ----

test('Todo, TodoList, TodoFilter, TodoChanges', () => {
  const todo = new Todo(data[1]);
  assert.deepEqual([todo.hasTitle('  SHIP it '), todo.matches('work'), todo.isOverdue('2026-09-17')], [true, true, true]);
  assert.throws(() => { /** @type {any} */ (todo).done = true; }, TypeError);
  assert.deepEqual(list().select(TodoFilter.active, 'ship').map((t) => t.id), [2]);
  const a = TodoChanges.fromTodo(new Todo({ ...data[1], tags: ['work', 'home'] }));
  assert.equal(a.equals(TodoChanges.of({ ...a, tags: ['home', 'work'] })), true);
});

test('EditSession: dirty, errors cleared on change, saving, fail, revert, last change', () => {
  const open = EditSession.open(new Todo(data[1]));
  const changed = open.change(TodoChanges.of({ ...open.values, title: '' })).reject(FieldErrors.from({ title: 'Needed', notes: 'Long' }));
  const fixed = changed.change(TodoChanges.of({ ...changed.values, title: 'Ship it now' }));
  assert.deepEqual([changed.isDirty, fixed.errors.fields], [true, ['notes']]);
  assert.equal(fixed.startSaving().fail().canSave, true);
  assert.deepEqual(fixed.noteChange({ field: 'title', previous: 'a', value: 'b' }).lastChange, { field: 'title', previous: 'a', value: 'b' });
  assert.equal(fixed.revert().isDirty, false);
});

// ---- Events are data-only classes ----

test('events are frozen plain objects named by their type', () => {
  const { collection, sent } = domain();
  collection.receive(list());
  const listed = last(sent, 'TodosListed');
  assert.equal(listed.type, 'TodosListed');
  assert.equal(Object.getPrototypeOf(listed), Object.prototype);
  assert.ok(Object.isFrozen(listed) && Object.isFrozen(listed.todos[1]));
  assert.deepEqual(listed.todos[1], { id: 2, title: 'Ship it', notes: 'Soon', priority: 'high', due: '2026-09-01', tags: ['work'], done: false, overdue: true });
});

// ---- Capabilities ----

test('notices: raise, dismiss, and expire', async () => {
  const { notices, sent } = domain();
  notices.raise(Notice.saved('Ship it'));
  assert.deepEqual({ ...last(sent, 'NoticeRaised') }, { type: 'NoticeRaised', reason: 'saved', detail: 'Ship it', retryable: false });
  notices.dismiss();
  notices.dismiss();
  assert.deepEqual(namesOf(sent), ['NoticeRaised', 'NoticeDismissed']);
});

test('questions: one at a time; a new question declines the open one; answers are announced', async () => {
  const { questions, sent } = domain();
  const first = questions.ask(Confirmation.clearCompleted(2));
  const second = questions.ask(Confirmation.deleteTodo(new Todo(data[1])));
  assert.equal(await first, false);
  const asked = last(sent, 'ConfirmationAsked');
  questions.answer(asked.id + 50, true);
  questions.answer(asked.id, true);
  assert.equal(await second, true);
  assert.deepEqual({ ...last(sent, 'ConfirmationAnswered') }, { type: 'ConfirmationAnswered', id: asked.id, confirmed: true });
});

test('requests: busy while running, retry for failures, notices for both', async () => {
  const { requests, sent } = domain();
  let calls = 0;
  assert.equal(await requests.run(async () => { if (++calls === 1) throw new Error('down'); }), false);
  assert.deepEqual(namesOf(sent), ['BusyChanged', 'NoticeRaised', 'BusyChanged']);
  assert.equal(last(sent, 'NoticeRaised').retryable, true);
  assert.equal(await requests.retry(), true);
  assert.equal(await requests.run(async () => { throw new ValidationError('Taken'); }), false);
  assert.deepEqual([last(sent, 'NoticeRaised').reason, requests.canRetry], ['rejected', false]);
});

test('collection: renaming in place is domain state; blank or unchanged stops it', async () => {
  const d = domain({ rename: async (todo, title) => TodoList.fromData([data[0], { ...data[1], title }]) });
  d.collection.receive(list());
  d.collection.beginRenaming(2);
  assert.equal(last(d.sent, 'RenamingChanged').id, 2);
  await d.collection.rename(2, '  ');
  assert.equal(last(d.sent, 'RenamingChanged').id, null);
  d.collection.beginRenaming(2);
  d.collection.stopRenaming(1);
  assert.equal(d.collection.renamingId, 2, 'stopping another todo leaves this one');
  await d.collection.rename(2, 'Ship it now');
  assert.deepEqual([{ ...last(d.sent, 'TodoRenamed') }, d.collection.renamingId], [{ type: 'TodoRenamed', id: 2, title: 'Ship it now' }, null]);
});

test('collection: a rejected rename keeps renaming', async () => {
  const d = domain({ rename: async () => { throw new ValidationError('That todo already exists.'); } });
  d.collection.receive(list());
  d.collection.beginRenaming(2);
  await d.collection.rename(2, 'Write it');
  assert.equal(d.collection.renamingId, 2);
});

test('collection: delete and clear ask first', async () => {
  const d = domain({ remove: async () => TodoList.empty, clearCompleted: async () => TodoList.empty });
  d.collection.receive(list());
  answerNext(d, false);
  assert.equal(await d.collection.remove(2), false);
  answerNext(d, true);
  assert.equal(await d.collection.remove(2), true);
  d.collection.receive(list());
  answerNext(d, true);
  assert.equal(await d.collection.clearCompleted(), true);
  assert.equal(last(d.sent, 'ConfirmationAsked').reason, 'clear-completed');
});

test('browsing: filter and search from the route select ids; search navigates with replace', () => {
  const d = domain();
  d.collection.receive(list());
  d.browsing.follow({ ...route('todos', { filter: 'active' }), query: { q: ['ship'] } });
  assert.deepEqual({ ...last(d.sent, 'TodosShown') }, { type: 'TodosShown', filter: 'active', query: 'ship', ids: [2], loaded: true, remaining: 1, completed: 1 });
  d.browsing.search('write');
  assert.deepEqual({ ...last(d.sent, 'NavigationRequested') }, { type: 'NavigationRequested', path: '/todos/active?q=write', replace: true });
  assert.deepEqual(last(d.sent, 'TodosShown').ids, []);
});

test('draft: at risk while it has text; cleared once the server has the todo', async () => {
  const d = domain({ add: async (title) => TodoList.fromData([...data, { id: 3, title, done: false }]) });
  d.draft.change('Buy milk');
  assert.equal(last(d.sent, 'WorkAtRisk').atRisk, true);
  await d.draft.submit();
  assert.deepEqual([d.draft.text, last(d.sent, 'DraftChanged').text, last(d.sent, 'WorkAtRisk').atRisk], ['', '', false]);
});

test('editing: follows the route, changes with plain values, notes field changes, saves', async () => {
  /** @type {any} */
  let saved;
  const d = domain({
    get: async (id) => { if (id === 2) return new Todo(data[1]); throw new NotFoundError('No such todo.'); },
    update: async (id, changes) => (saved = changes, TodoList.fromData([{ ...data[1], title: changes.title }])),
  });
  await d.editing.follow(route('todo', { id: '9' }));
  assert.equal(last(d.sent, 'EditingChanged').status, 'missing');
  await d.editing.follow(route('todo', { id: '2' }));
  const opened = last(d.sent, 'EditingChanged');
  d.editing.change({ ...opened.values, title: 'Ship it now' });
  d.editing.noteFieldChange('title', 'Ship it', 'Ship it now');
  const changed = last(d.sent, 'EditingChanged');
  assert.deepEqual([changed.dirty, changed.canSave, changed.revision, changed.lastChange.field], [true, true, opened.revision, 'title']);
  await d.editing.save();
  assert.equal(saved.title, 'Ship it now');
  assert.deepEqual([last(d.sent, 'NoticeRaised').reason, last(d.sent, 'NavigationRequested').path], ['saved', '/todos']);
  assert.equal(last(d.sent, 'EditingChanged').revision > opened.revision, true);
});

test('editing: keeps field errors; un-sticks after a failure', async () => {
  let fail = false;
  const d = domain({ get: async () => new Todo(data[1]), update: async () => { if (fail) throw new Error('down'); throw new ValidationError('Nope', FieldErrors.from({ title: 'Taken' })); } });
  await d.editing.follow(route('todo', { id: '2' }));
  d.editing.change({ ...last(d.sent, 'EditingChanged').values, title: 'Write it' });
  await d.editing.save();
  assert.deepEqual({ ...last(d.sent, 'EditingChanged').errors }, { title: 'Taken' });
  fail = true;
  d.editing.change({ ...last(d.sent, 'EditingChanged').values, title: 'Other' });
  await d.editing.save();
  assert.deepEqual([last(d.sent, 'EditingChanged').saving, last(d.sent, 'EditingChanged').dirty], [false, true]);
});

test('unsaved work: asks, keeps or discards, then continues; uncancelable discards', async () => {
  const d = domain({ get: async () => new Todo(data[1]) });
  await d.editing.follow(route('todo', { id: '2' }));
  d.editing.change({ ...last(d.sent, 'EditingChanged').values, notes: 'unsaved' });
  answerNext(d, false);
  const stay = new RouteChange(route('todo', { id: '2' }), route('home'));
  await d.unsavedWork.guard(stay);
  assert.deepEqual([stay.cancelled, d.editing.session.isDirty], [true, true]);
  answerNext(d, true);
  await d.unsavedWork.guard(new RouteChange(route('todo', { id: '2' }), route('todos', {}, { q: 'x' })));
  assert.deepEqual([d.editing.session.isDirty, last(d.sent, 'NavigationRequested').path], [false, '/todos?q=x']);

  d.draft.change('half typed');
  const filterChange = new RouteChange(route('todos'), route('todos', {}, { q: 'x' }));
  await d.unsavedWork.guard(filterChange);
  assert.equal(filterChange.cancelled, false);
  await d.unsavedWork.guard(new RouteChange(route('todos'), route('home'), false));
  assert.equal(d.draft.text, '');
});

test('tally: counts by a step; a bad step counts as 1', () => {
  const d = domain();
  d.tally.changeStep(5);
  d.tally.increment();
  d.tally.changeStep(null);
  d.tally.decrement();
  assert.deepEqual({ ...last(d.sent, 'TallyChanged') }, { type: 'TallyChanged', count: 4, step: null });
});

test('the application domain composes its capabilities as children', () => {
  const root = new ApplicationDomain();
  root.parent = application();
  root.create();
  assert.deepEqual(
    root.children.map((c) => c.constructor.name),
    ['Notices', 'Questions', 'ServerRequests', 'TodoCollection', 'TodoBrowsing', 'TodoDraft', 'TodoEditing', 'UnsavedWork', 'Tally'],
  );
});
