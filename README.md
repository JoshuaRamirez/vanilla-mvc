# VanillaMVC

**Your SPA library is overrated.**

React, Angular, Vue, Svelte, Solid, Ember, Preact, Lit, Qwik, Alpine, HTMX. They are all over-engineered.
A single-page application needs a tree of objects that stays in memory, templates,
a way to say what changed, an event bus, and a router. That's all this is. No virtual DOM, no signals, no hooks,
no compiler, and no runtime dependencies: templates, styles, form values, and routing are small libraries of our own.

## Start an application

```sh
mkdir notes-app && cd notes-app
npm install vanilla-mvc
npx vanilla-mvc init
npm install && npm run theme:css && npm start          # http://localhost:4500
```

Needs Node 22 or later. The browser tests need Chrome or Chromium, found on macOS, Linux and
Windows, or wherever `$CHROME` points. Installing from a private registry instead:
`npx vanilla-mvc init --registry <url>` writes the `.npmrc`.

`init` writes a manifest, a tsconfig, a dev server, a reset, an index.html carrying the import map,
one feature wired end to end — a component whose gesture goes to a capability and comes back as an
event — and three things for whoever works on it next:

- **`AGENTS.md`**, the guide an agent reads before writing code, with a `CLAUDE.md` that imports it.
  It is generated from the same rule records the checks run, and `npm test` fails when it drifts
  from the installed framework (`vanilla-mvc guide` refreshes it).
- **`test/architecture.test.mjs`**, which runs all [sixteen rules](RULES.md) over `src/`.
- **`npx vanilla-mvc add component|event|capability <name>`** to make the next piece in the shape
  the rules check for, instead of the shape another framework taught.
- **`.claude/settings.json`**, a hook that runs `vanilla-mvc check` on every file an agent edits
  and hands any broken rule back to it while that edit is still the last thing it did. Proven
  live: asked for a Reset button, an agent wrote a public method that wrote the model; the hook
  named both rules; four seconds later the handler went to the domain instead.

It refuses a directory that already holds an application.

The other two commands are the jobs every application on this framework has, so neither is worth
writing twice:

| Command | Why it exists |
|---|---|
| `vanilla-mvc vendor` | A browser cannot resolve the bare name `vanilla-mvc`. index.html carries an import map pointing at `/vendor`; this puts the framework there. Run it on every build. `--check` fails when it is stale. |
| `vanilla-mvc theme-css` | The document sheet is applied at start, but the module bundle is fetched first — so until it runs the page is a reset and nothing else. This emits the same tokens as a file, for the first paint. `--check` fails when it drifts. |

### Keep your application honest

The rules this framework is built on are not advice: they ship, and your application can run them
over its own source. Each one, with its reason and a wrong and a right example, is in
[RULES.md](RULES.md) — generated from the checks, so the two cannot disagree. Fifteen of them — a model is an interface, an event is its own file and names
itself, a controller has nothing public of its own, a change is stated at the site that knows, a
gesture goes to the application domain and never writes the model itself.

```js
// test/architecture.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applicationRules } from 'vanilla-mvc/architecture';

applicationRules({
  test, assert,
  base: new URL('..', import.meta.url).pathname,
  root: 'src', app: 'src/',
  within: ['vanilla-mvc', 'src/'],
  styling: { folder: 'vanilla-mvc/css', from: /\.(template|style)\.ts$/ },
  events: ['src/events'],
  atLeast: { models: 1, events: 1, controllers: 1, handlers: 1, waits: 0, calls: 0, tags: 0 },
});
```

Nothing there imports `node:test`; the runner is an argument, so any runner drives it. `atLeast` is
a floor per rule, read off your tree as it stands — raise it as the application grows, never lower
it. A rule that finds nothing to check is a rule that is not running, and the floor is what says
so.

### The one rule that will bite you

A DOM handler is registered, then bound by name:

```ts
protected override onInterconnect(): void { this.handle('save', this.#save); }   // controller
#save(): void { this.model.saved = true; this.changed(); }
```
```ts
html`<button @click=${c.handler('save')}>Save</button>`                            // template
```

**Not** `@click=${() => c.save()}`. That is the idiom everywhere else and it type-checks here, but
change is stated, never detected: the engine draws at the end of a DOM event *it delivered*, and an
inline arrow is not one. The model would move and the screen would not, so the framework refuses
it: the template throws at its first render, naming the registered form — see
`docs/decisions/a-change-is-stated-never-detected.md`.

Two places hold the prose. **[`src/libraries/css/`](src/libraries/css/)** documents the seven CSS
engines, one README beside each. **[`docs/decisions/`](docs/decisions/)** holds one record per
decision, named by its subject, for every rule whose reason the code cannot show you.

## The pattern

Everything follows **create → interconnect → activate**.

| Phase | Does |
|---|---|
| `create()` | Instantiate everything: models, controllers, child components. |
| `interconnect()` | Wire up communication: event subscriptions. |
| `activate()` | Initialize. Everything exists and is wired. |
| `render()` | Components only. Render the view into the target, then render the children. |

The application boots by running every create, then every interconnect, then every activate, then every render.
Each method calls the same method on its children.

## The pieces

```
IComposite            parent, children
└─ IApplicationElement   create, interconnect, activate
   ├─ IComponent            key, template, view, target, controller, model, children, render, rerender
   └─ IController           creates the model; translates gestures and events
```

- **Application**: the root. Owns the event bus, the application domain, the router, and the shell.
- **Application domain**: what the app knows and does, apart from any screen (see below). Made of `ApplicationElement`s, not models.
- **Shell**: the first component and the root of the component tree.
- **Component**: a template, a view, a controller, and a model. **Models belong to components only.**
  - **Template**: one-way. Values go into the DOM; events come out with their values. You never write DOM code.
  - **View**: the rendered DOM. It is the single child of **target**, and the target element carries `element.component`.
  - **Model**: a TypeScript `interface`. Fields only: no methods, no logic. It's the data the template reads.
  - **Controller**: the translator. It creates the model in its create phase, turns user gestures into application domain method calls, and turns events into model field updates. It states what changed and renders when asked.
- **Router**: our router library on the History API. Talks only through events (see below).

## Rules

1. The application domain and other components are reached **only through events**, whose payloads are plain data.
2. **Components serve presentation only.** Application behavior lives in the application domain, even when one screen is its only user.
3. **All state changes go through the application domain.** Controllers call domain methods; the domain announces what changed as events; controllers write models.
4. A child renders into `data-component="<key>"` inside its parent's view. If there's no placeholder, the child isn't mounted.
5. Templates do all DOM work (see below). App code never touches DOM listeners, attributes, or values.
6. **Change is stated, never detected.** A handler that writes the model says so with `changed()`. Nothing compares models or searches the tree for work.
7. **A DOM event is the unit of work.** It is one synchronous stack: the gesture is delegated, the domain publishes, every controller states its change, and one render pass draws them all. Work that outlives the stack — anything that talks to the server — is owned by whoever started it: a handler returns its promise, and `own()` says the same where there is no gesture to return to.
8. Models are interfaces. Decisions live in the domain; wording, labels, and hrefs are mapped by the controller.
9. Business logic lives on the server.

## Application domain and components

Two domains that change on their own schedules.

```
DOM gesture ─▶ controller ─▶ domain method ─▶ application domain
                                                   │ publishers
template ◀─ model (interface) ◀─ controller ◀─ event bus ◀─ events (data-only interfaces)
```

- **Templates** are the contract for what a screen displays; their variables resolve against the component's **model**, an interface.
- **Controllers translate in both directions, always through private methods.**
  - A DOM handler turns a gesture into a domain method named for what it means to the domain: `this.#todos.beginRenaming(id)`, `this.#editing.save()`. It's registered by name, `this.handle('startRenaming', this.#startRenaming)`, and a template binds it with `c.handler('startRenaming')`.
  - A bus handler turns an event into model fields, including wording, labels, and hrefs: `this.subscribe('RenamingChanged', this.#renamingChanged)`.
  - A bus handler ends in `this.changed()` and never renders. A DOM handler ends by returning any work that takes time. Controllers have no public methods of their own.
  - The domain root is `this.domain` in every controller; controllers copy the capabilities they need into private fields in `onCreate`.
- **All state changes go through the application domain,** including what looks like screen state: renaming in place, the counter, notices, the open question, filter and search.
- **Events are the only data coming back.** Every event is an interface in its own file in `src/app/events/`, as is every data type an event carries (`TodoFact`, `EditValues`, `Priority`, …). An event names itself with a literal `type`, and the bus routes on it: `publish<TodosListed>({ type: 'TodosListed', … })`, `subscribe('TodosListed', this.#todosListed)`. Type names are checked against the handler's event type, and events are frozen as they're published.
- **The router speaks in events too** (`src/framework/events/`): see [Routing](#routing) for the three.
- **The domain pays for its own change.** Publishers, one small class per capability, turn internal classes into events. When a capability's classes change or move, its publisher changes; no model, template, or view does.

```ts
export interface TodoRowModel { id: number; title: string; renaming: boolean; /* … */ }

export class TodoRowController extends Controller<TodoRowModel, ApplicationDomain> {
  #todos!: TodoCollection;

  protected createModel(): TodoRowModel { return { ...shape(this.todo), renaming: false }; }
  protected override onCreate(): void { this.#todos = this.domain.collection; }

  protected override onInterconnect(): void {
    this.subscribe('RenamingChanged', this.#renamingChanged);
    this.handle('startRenaming', this.#startRenaming);
  }

  #renamingChanged({ id }: RenamingChanged): void { this.model.renaming = id === this.model.id; this.changed(); }
  #startRenaming(): void { this.#todos.beginRenaming(this.model.id); }
}

// todo-row.template.ts
html`<span @dblclick=${c.handler('startRenaming')}>${m.title}</span>`
```

### Events (`src/app/events/`)

| Event | Carries |
|---|---|
| `TodosListed` | `todos: TodoFact[]`, `remaining`, `completed` |
| `TodosShown` | `filter`, `query`, `ids`, `loaded`, `remaining`, `completed` |
| `TodoOptionsListed` | `priorities`, `tags` |
| `TodoAdded`, `TodoRenamed` | `id`, `title` |
| `RenamingChanged` | `id` or null |
| `DraftChanged` | `text` |
| `EditingChanged` | `id`, `status`, `baseline`, `revision`, `values`, `errors`, `dirty`, `saving`, `canSave`, `lastChange` |
| `BusyChanged` | `busy` |
| `NoticeRaised` / `NoticeDismissed` | `reason`, `detail`, `retryable` / nothing |
| `ConfirmationAsked` / `ConfirmationAnswered` | `id`, `reason`, `subject`, `count` / `id`, `confirmed` |
| `TallyChanged` | `count`, `step` |

### The application domain (`src/app/application/`)

`ApplicationDomain` composes the capabilities as its children (`ApplicationElement`s, not models), so they go through create, interconnect, and activate with it.

```
application/
  application-domain.ts composes the capabilities
  publish.ts            what publishers are handed
  todos/                Todo, TodoList, TodoFilter, TodoChanges; TodoCollection (incl. renaming), TodoBrowsing, TodoDraft; publishers
  editing/              EditSession; TodoEditing; EditingPublisher
  work/                 UnsavedWork; WorkAtRisk, WorkDiscarded (internal events)
  server/               TodoApi, ServerRequests, FieldErrors, ValidationError, NotFoundError
  communication/        Notice, Notices, NoticePublisher; Confirmation, Questions
  tally/                Tally; TallyPublisher
```

`test/seams.test.mjs` enforces the boundary:
- models are interfaces, and only components have them;
- component models, templates and styles never import the application; only controllers do;
- every event type is an interface in its own file, and names itself with a matching `type`;
- controller subscriptions and DOM handlers go to private methods, and controllers have no public methods of their own;
- the application never imports components.

## Templates

A template is a function of the model and the controller, written with our `html` tag:

```ts
export const todosTemplate = new Template<TodosModel, TodosController>((m, c) => html`
  <form @submit=${prevent(c.handler('add'))}>
    <input .value=${m.draft} @input=${field(c.handler('changeDraft'))}>
    <button ?disabled=${!m.canAdd}>Add</button>
  </form>
  <ul>
    ${m.visible.map((todo) => html`
      <li data-key=${todo.id} class=${todo.done ? 'done' : ''}>
        <input type="checkbox" .checked=${todo.done} @change=${c.handler('toggle')}>
        ${todo.title}
        <button @click=${c.handler('remove')}>✕</button>
      </li>`)}
  </ul>
`);
```

| Syntax | Does |
|---|---|
| `${expr}` | Text or attribute value, escaped. Never becomes markup. `nothing`, `null`, and `false` render empty. |
| `@event=${c.handler('name')}` | Calls the controller's private handler registered as `name`, with `(event, element)`. The render pass runs when it returns. |
| `?attr=${expr}` | Boolean attribute. |
| `.prop=${expr}` | Sets a DOM property, e.g. `.checked`, `.value`. |
| `@change=${field(c.handler('method'))}` | Hands the controller `{ name, value, previous, field, event }`, uniform across input types. |
| `@input=${formValues(c.handler('method'))}` | Reads the whole form and hands the controller an object. |
| `<form ${fill(values)}>` | Uncontrolled form: writes values into fields by name. Refills only when given a new object. |
| `@keydown=${keys({ Enter: …, Escape: … })}` | Handles specific keys. |
| `${prevent(handler)}` | Calls `preventDefault()` first, for forms. |
| `<dialog ${modal(open)}>` / `<input ${focus(when)}>` | Native modal dialogs; focus when a condition becomes true. |
| `<article ${attrs(record)}>` | Writes a record of attributes: `true` is an empty value, `false`/`null`/`undefined` remove, anything else is its string, and a name this wrote before and the record has dropped is removed. Never spread a record by hand. |
| `data-key=${id}` | Keeps list rows matched across renders, so they move instead of being recreated. |
| `href=${safeUrl(url)}` | Blocks `javascript:` and other script-capable URLs coming from data. |
| `<article ${styled(style, m)}>` | Mounts the component's `Style` on this element, re-applied after every render (see Styles). |

Rendering updates the DOM in place, so focus, caret, selection, and scroll position survive. Events are delegated: one listener per component.

## Styles

A component's `<widget>.style.ts` is a `Style<Model>` over our `css` tag, mounted on the template's root:

```ts
export const cardStyle = new Style<CardModel>((m) => css`
  :scope { padding: ${m.dense ? '4px' : '12px'}; }
  .title { font-weight: 600; }
`);
```

- `:scope` (or `&`) is the element `styled` sits on; other selectors match its subtree and stop at child components.
- `padding: ${x}` binds live as a custom property; a changed value touches no stylesheet.
- ``${cond ? css`…` : nothing}`` adds or drops rules; `.sel-${x} {` is selector text; `"${x}"` is escaped.
- Per-instance values that move continuously ride `style=${declarations({ '--p': v })}` in the template.
- Document-wide rules are one `Style` the shell applies to `document`.
- Floor: Chrome 118, Safari 17.4, Firefox 146 (`@scope`).

The rules — every hole position, the cascade, what costs what — have one home: the header of
`src/libraries/css/templates/index.ts`. The engines (`theme/`, `layout/`, `responsive/`, `animation/`,
`effects/`, `semantics/`) author on the same tag and are reached through `src/libraries/css/index.ts` as namespaces.

### Binding a value from the model

A hole in a declaration value is a **bound hole**. The rule is written once as `var(--css-<sheet>-<n>)`,
and the value is set as that custom property on the scope element. A changed model changes one property
on one element: no stylesheet is rebuilt, no selector is re-matched, nothing is diffed.

```ts
// meter.style.ts — m.share is 0..1 and moves with the model
export const meterStyle = new Style<MeterModel>((m) => css`
  :scope.meter { display: block; block-size: ${theme.space(2)}; background: ${theme.color('border')}; }
  .bar { block-size: 100%; inline-size: calc(${m.share} * 100%); background: ${theme.color('accent')}; }
`);

// meter.template.ts
html`<div class="meter" ${styled(meterStyle, m)}><div class="bar"></div></div>`
```

Two things land in the DOM, both on the element `styled` sits on (on `<html>` for a document style), and
both re-set after every render because the morph strips them:

| On the element | Is |
|---|---|
| `data-css="<sheet>"` | The scope token. `<sheet>` is derived from the sheet's own text — the first class in it, else its first identifier — so **read it, never hard-code it**: a second sheet in the same app deriving the same name takes a numeric suffix, and a hole that changes the *text* rather than a value makes the token `<sheet>.<n>`. To make the derived name your component's, open the sheet with the scope's own class: `:scope.meter { … }` names it `meter`. |
| `style="--css-<sheet>-0: 0.25"` | One property per bound hole, numbered in the order they render. An empty or CSS-wide-keyword hole binds nothing and takes no number, so count bound holes, not `${}`s. |

Reading it back in a test: **assert the computed style of the element the rule targets.** That is the
assertion that proves the binding, and it needs no name at all. Read the property as well when you want
to show the value itself crossed the seam — taking the name from `data-css`, not from a guess:

```js
const width = () => page.evaluate('(s) => getComputedStyle(document.querySelector(s)).inlineSize', '.meter .bar');

assert.equal(await width(), '50px');
await page.click('…');                       // a gesture that moves the model
assert.equal(await width(), '150px');        // the same element and the same sheet, drawn from the new value

// The value itself, by the name the DOM gives you: data-css names the sheet.
const bound = await page.evaluate(
  `(s) => { const e = document.querySelector(s), sheet = e.dataset.css.split('.')[0];
            return [...e.style].filter((p) => p.startsWith('--css-' + sheet + '-'))
                               .map((p) => [p, e.style.getPropertyValue(p)]); }`,
  '.meter',
);
assert.ok(bound.some(([, value]) => value === '0.75'), 'the share crossed the seam');
```

`test/browser/css.test.js` proves the mechanism itself, under the framework and through a real render:
*"through the framework, a value-only model change: computed value follows, same root, same adopted sheet
object, token unchanged"*. Copy that case's shape; you never need to read the styling library.

**Bind a measurement; class a state.** Bind what a class cannot carry because it is a number — a share, a
count turned into a size, a progress, a per-instance colour. Put per-*state* shape on a class:
`class=${done ? 'done' : ''}` with `.done { }` on the scope costs nothing per render, while `styled` on N
keyed rows is N×(k+1) attribute writes. The two belong together on one component: the state is a class,
the numbers are bound holes. A row that draws one bar per count is that case —
each family's count is bound as a share of that row's largest, so two rows sharing one sheet draw
differently from their own data.

## Rendering

Nothing watches anything. A controller that writes its model says so, and a render pass draws
everything that said so, once each:

```ts
#todosListed({ todos }: TodosListed): void {   // an event: state the change, never render
  this.model.rows = todos.map(…);
  this.changed();
}

#toggle(): Promise<boolean> {                  // a gesture: delegate, and hand back the wait
  return this.#todos.toggle(this.model.id);
}
```

A DOM event is one synchronous stack. The gesture is delegated, the domain publishes its facts,
every controller that cared maps them onto its model and states the change, and when the handler
returns, one pass renders all of them. Four events in a gesture is still one pass.

A promise leaves that stack — the server answers with no gesture left to end — so whoever starts
work that takes time owns it. A handler returns its promise; `own()` says the same thing where
there is no gesture to return to, as when the shell asks for a list at startup. A seam test fails
the build if either is forgotten.

**A change stated outside a DOM event is never drawn.** `changed()` only registers; the render pass
runs at the end of a DOM event, so a change stated from a timer, a promise, a `setInterval`, a
`MessageChannel`, or a bus event published with no gesture behind it sits in the register and the
screen keeps the old picture until some *later* gesture happens to flush it — which looks like a
render that is one action behind, not like a missing render. What to do instead: **hand the work to
whoever started it.** A gesture's handler returns its promise. Anything else — a startup fetch, a
poll, a retry, a subscription that pushes — is wrapped in the controller's `own()`, which renders when
it settles. Only two places in the framework end a gesture, a DOM handler and the router, and
`test/seams.test.mjs` pins that: if you cannot name the gesture or the owned work a change belongs to,
the change has no owner yet, and that is the bug to fix.

```ts
protected override onActivate(): void { this.own(this.#todos.refresh()); } // no gesture: own the wait
```

A domain capability never renders and never owns: it returns its promise to the controller that asked,
and the controller owns it. `own()` is the controller's.

Rendering a component is local. Its children's views are held aside, its own template renders into
the target with the placeholders empty, and the children go back where they were — so a parent
redrawing never disturbs a child's DOM, its focus, or what the user has half-typed into it. A child
renders only when it stated a change of its own.

## Field values

`field()` values are the same shape whatever the input:

| Input | Value |
|---|---|
| text, textarea, date, select | string |
| number, range | number, or `null` when empty |
| checkbox on its own | boolean |
| checkbox group (`name[]` or a shared name), `select[multiple]` | string[] |
| radio group | the checked value, or `null` |

`previous` is the value before this change: what was rendered or filled, then each committed change after that.

## Libraries and seams

Four libraries of our own live in `src/libraries/`. Each stands alone: no imports outside its folder, publishable on its own (inside `css/`, engines import each other only along the matrix `test/seams.test.mjs` enforces).
The framework never touches them directly. It talks to **seams** (interfaces in `src/framework/seams.ts`), and **adapters** implement each seam on one library.

| Seam | Interface | Adapter (`src/framework/adapters/`) | Library (`src/libraries/`) |
|---|---|---|---|
| Rendering | `IRenderer`: `html`, `behavior`, `render` | `templates/TemplatesRenderer` | `templates/`: `html` tag, in-place morphing, delegated events |
| Form values | `IFormAccess`: read, write, remember, change | `fields/FieldsAccess` | `fields/`: uniform values, changes with previous values |
| Routing | `IRouting`: `createTable`, `createNavigator` | `router/RouterRouting` | `router/`: path matching, History API navigation, guards |
| Styling | `IStyling`: `css`, `apply`, `release` | `css/CssStyling` | `css/`: the `css` tag with `@scope` adoption, plus the engines |

Framework and app code use only the seams: `html`, `behavior`, `nothing`, `Routes`, `Router`, `field()`, `fill()`, `css`, `styled`, and so on all delegate to the installed adapters.

**Swap a library:** implement the seam's interface and return it from `createAdapters()`:

```ts
class MyApplication extends Application<ApplicationDomain> {
  protected override createAdapters() {
    return { ...defaultAdapters(), renderer: new MyRenderer() };
  }
}
```

**Add a seam:** add its interface and a property on `Adapters` in `seams.ts`, a getter in `adapters/adapters.ts`, an adapter folder named after its library, and a line in `adapters/defaults.ts`.

`test/seams.test.mjs` enforces:
- no runtime dependencies;
- each library imports only from its own folder;
- every library has an adapter folder of the same name;
- `adapters/<name>/` reaches only `libraries/<name>/`;
- the rest of the framework and the app never import a library.

Why we built these instead of borrowing is in [docs/research/](docs/research/).

## Routing

Routing uses `libraries/router` on the History API, through the routing seam. It intercepts same-origin links, runs guards on every navigation including back and forward (and puts the URL back if one cancels), restores scroll on back and forward, starts new pages at the top, moves focus to the new page, and leaves `#anchor` links to the browser.

```ts
// src/app/routes.ts
export const routes = new Routes([
  { name: 'home', path: '/' },
  { name: 'todos', path: '/todos/:filter(active|completed)?' },
  { name: 'todo', path: '/todos/:id(\\d+)' },
  { name: 'old-home', path: '/home', redirect: '/' },
]);

routes.href('todos', { filter: 'active' }); // '/todos/active'
```

- **Matching**: `:param`, `:param?`, `:param(regex)`, and `*`; most specific route first; trailing slashes ignored; optional `base` path.
- **Links**: build hrefs with `routes.href(name, params, query)` so renames can't break them silently.
- **Query**: a key repeats. `href('search', {}, { kind: ['skill', 'command'] })` writes `?kind=skill&kind=command` (an empty list writes no pair), and `RouteMatch.query` hands every key back as a list, so a key given once reads `query.q?.[0] ?? ''` and an absent key is absent.

The router speaks only through the bus (`src/framework/events/`):

| Event | Carries | Use |
|---|---|---|
| `NavigationRequested` | `path`, `replace` | Publish to go somewhere. |
| `RouteChanging` | `change: RouteChange` | Guards: `change.cancel(reason?)` or `change.redirect(path)`; `change.leaves('todos')`, `change.enters('admin')`. |
| `RouteChanged` | `route: RouteMatch` | Name, params, query, url. Shells pick pages; models follow params. |

## Scenarios

The demo is built to stretch the pattern. The home page links to each one.

| Scenario | What it exercises | Where |
|---|---|---|
| Domain-held state | The counter's count lives in `Tally`; the component model is only an interface | `counter` |
| Runtime child components | `syncChildren()` adds and removes a row per todo; hidden rows keep their state | `todo-list-page`, `todo-row` |
| Keyboard and focus | `keys()`, `focus()`, `field()` for inline rename; Enter saves, Escape cancels | `todo-row` |
| Value and previous value | `field()` hands `{ name, value, previous }` for every input type | `edit-todo-page` |
| Search in the URL | `?q=` with replace history; back, forward, reload, and tabs keep it | `todo-list-page` |
| Edit session | The domain holds the edit and publishes `EditingChanged`; the controller maps it to a form with `fill()` and `formValues()` | `TodoEditing`, `edit-todo-page` |
| Server validation | Per-field errors from a 422, kept on the edit session | `EditSession` |
| Asking first | `ConfirmationAsked` goes out with an id; the dialog words it and answers through `Questions.answer` | `Questions`, `confirm-dialog` |
| Unsaved work | Drafts and edits report work at risk; navigation asks, on back and forward too | `UnsavedWork` |
| Missing records | Route params plus a 404 from the server | `/todos/999` |
| Failure and retry | `ServerRequests` keeps the failed request; the toast offers Retry | Home: "Fail the next request" |
| Redirects and 404 pages | Route redirects and the fallback route | `/home`, `/nowhere` |

## Run it

```sh
npm install
npm start     # builds and serves the demo on http://localhost:4400
npm test      # build, type-check tests and server, run node tests (the browser page too, when Chrome is present)
npm run typecheck
```

## Using it in an application

The entries are `vanilla-mvc` (the framework), `vanilla-mvc/css`, `/fields`, `/router`, `/templates`,
and two for Node only: `vanilla-mvc/testing` (the Chrome driver) and `vanilla-mvc/architecture` (the
rules). Node resolves them through `node_modules`. A browser cannot resolve a bare name, so the
`index.html` that `init` writes carries an import map pointing at `/vendor`, and `vanilla-mvc vendor`
copies the compiled framework there on every build.

`npm update` will not cross a `0.x` minor: npm reads `^0.3.1` as `>=0.3.1 <0.4.0`, so a `0.4.0`
needs `npm install vanilla-mvc@latest`. While the version starts with 0, every minor may break;
[CHANGELOG.md](CHANGELOG.md) says how.

## Checking the framework against an application

An application is this framework's forcing function: surface nobody has had to use is surface
nobody has had to defend. The one it was developed against — 36 components, 68 events, every
library exercised — is not public. Point the checks at any application built on it:

```sh
CONSUMER=../my-app npm run test:consumer        # the architecture rules over its src/
npm run surface -- ../my-app/src ../my-app/scripts   # library exports it never calls
```

Without `CONSUMER` those suites skip, saying so.

Browser tests for the libraries run at http://localhost:4400/test/browser/index.html with no test framework;
`test/browser-page.test.mjs` drives that page headlessly through `testing/` and fails on any failure.

```
src/libraries/               our libraries: templates/, fields/, router/, css/ (CSS templates and engines)
src/framework/               the framework
  seams.ts                   the seam interfaces
  adapters/                  one adapter folder per library, plus defaults.ts
src/app/
  app.ts                     the application: model, shell, routes
  routes.ts                  the route table
  events/                    events and the data they carry: one interface per file
  application/               the application model, by capability, with its publishers
  components/<widget>/       <widget>.component.ts, .controller.ts, .model.ts (interface), .template.ts, and .style.ts where it has one
testing/                     end-to-end driver: Chrome over CDP, serve() for child servers; no third parties
scripts/surface.mjs          what a consumer does not exercise: authoring surface with no call site
```

Everything that travels the bus is frozen data, so every controller that hears it can hand the same instance to its model safely.

## Contributing

Issues and pull requests are welcome: [CONTRIBUTING.md](CONTRIBUTING.md) says how to run everything
and what a change needs. Report a security problem privately — [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Joshua Ramirez
