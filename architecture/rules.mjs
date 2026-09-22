// The architecture, as rules over the syntax tree.
//
// These are the rules that make this framework what it is: a model is an interface, an event is
// its own file and names itself, a controller has nothing public of its own, a change is stated at
// the site that knows, a gesture goes to the application domain. Each is one record below — what
// it says, why, a wrong and a right example, and the check — so the prose an author or an agent
// reads (`vanilla-mvc rules`, RULES.md) and the check that runs are the same record.
//
// They take their trees as arguments, and the runner too — nothing here imports node:test:
//
//   import { test } from 'node:test';
//   import assert from 'node:assert/strict';
//   import { applicationRules } from 'vanilla-mvc/architecture';
//
//   applicationRules({
//     test, assert,
//     base: new URL('..', import.meta.url).pathname,   // everything below is relative to this
//     root: 'src', app: 'src/',
//     within: ['vanilla-mvc', 'src/'],                 // what an import may land under
//     libraries: 'vanilla-mvc/',                        // library entries: reached through the framework
//     styling: { folder: 'vanilla-mvc/css', from: /\.(template|style)\.ts$/ },
//     events: ['src/events'],
//     atLeast: { models: 1, events: 1, controllers: 1, handlers: 1, waits: 0, calls: 0, tags: 0 },
//   });
//
// `atLeast` is a floor per rule, read off the tree as it stands: raise it as the application grows,
// never lower it. A rule that finds nothing to check is a rule that is not running.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import {
  callsTo,
  calledMethods,
  classBodyOf,
  cssTagsAtModuleScope,
  eventTypesIn,
  exportsIn,
  fieldTypes,
  importsIn,
  logicIn,
  methodsOf,
  namedImportsIn,
  privateMethods,
  publicMembers,
  registeredWith,
  registrationsIn,
  statesChange,
  unheldCalls,
  waitsIn,
  writesModel,
} from './syntax.mjs';

// This repository's own tests check each reader against fixtures before the rules lean on it.
export { classBodyOf, cssTagsAtModuleScope, fieldTypes, methodsOf, privateMethods, registeredWith, unheldCalls, waitsIn, writesModel };

const posix = (path) => path.split(sep).join('/');

function* sources(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // A dotfile is not source: macOS writes ._name.ts beside name.ts on some volumes and in archives.
    if (entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sources(path);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) yield path;
  }
}

/** The trees a rule reads, bound to `base`: files and import targets are named relative to it. */
function treeAt(base) {
  const named = (path) => posix(relative(base, path));
  const read = (dir) => [...sources(join(base, dir))].map((path) => ({ file: named(path), path, text: readFileSync(path, 'utf8') }));
  const targetOf = (path, specifier) => (specifier.startsWith('.') ? named(resolve(dirname(path), specifier)) : specifier);
  const importsOf = (dir) => read(dir).flatMap(({ file, path, text }) => importsIn(text).map((s) => ({ file, target: targetOf(path, s) })));
  const namedImportsOf = (dir) =>
    read(dir).flatMap(({ file, path, text }) => namedImportsIn(text).map(({ specifier, names }) => ({ file, target: targetOf(path, specifier), names })));
  return { read, importsOf, namedImportsOf };
}

/**
 * From method `name`, following this.#x() and this.x() calls into the class's own methods: does
 * anything reached write the model, and does anything reached call this.changed()?
 */
function reach(methods, name, seen = new Set()) {
  if (seen.has(name) || !methods.has(name)) return { writes: false, states: false };
  seen.add(name);
  const { node } = methods.get(name);
  let writes = writesModel(node);
  let states = statesChange(node);
  for (const called of calledMethods(node, methods)) {
    const below = reach(methods, called, seen);
    writes ||= below.writes;
    states ||= below.states;
  }
  return { writes, states };
}

/**
 * Every rule: an id, what it says, why, a wrong and a right example, and the check. `check`
 * receives the context applicationRules builds and throws — through `assert` — when broken.
 */
export const RULES = [
  {
    id: 'imports',
    name: (c) => `every import lands under ${c.within.join(', ')}`,
    says: 'Import only the framework package and your own source.',
    why: 'Anything else is a dependency the architecture never agreed to. The framework has no runtime dependencies so an application can have few too.',
    wrong: "import { chunk } from 'lodash';",
    right: "import { Controller } from 'vanilla-mvc';",
    check: ({ assert, imports, within }) => assert.deepEqual(imports.filter((i) => !within.some((tree) => i.target.startsWith(tree))), []),
  },
  {
    id: 'libraries',
    name: () => 'the app reaches libraries only through the framework',
    says: "Reach the router, fields and templates libraries through the framework's seams, never directly. Style and template files may import vanilla-mvc/css.",
    why: 'The seams are what let a library be swapped. A component that imports RouteTable has welded itself to one router.',
    wrong: "import { RouteTable } from 'vanilla-mvc/router';   // in a controller",
    right: "this.navigate(routes.href('home'));",
    check: ({ assert, imports, app, libraries, styling }) => {
      const allowed = (i) => styling !== null && styling.from.test(i.file) && i.target.startsWith(styling.folder);
      assert.deepEqual(imports.filter((i) => i.file.startsWith(app) && i.target.startsWith(libraries) && !allowed(i)), []);
    },
  },
  {
    id: 'cssTag',
    name: () => 'css and styled come from the framework, never from a library',
    says: "Take `css`, `Style` and `styled` from 'vanilla-mvc'. The css library lends engines (layout, theme…), not its tag.",
    why: "The framework's css tag goes through the styling seam, which owns the sheet. The library's raw tag bypasses it.",
    wrong: "import { css } from 'vanilla-mvc/css';",
    right: "import { css, Style } from 'vanilla-mvc';\nimport { layout } from 'vanilla-mvc/css';",
    check: ({ assert, namedImportsOf, app, libraries }) =>
      assert.deepEqual(namedImportsOf(app).filter((i) => i.target.startsWith(libraries) && i.names.some((n) => n === 'css' || n === 'styled')), []),
  },
  {
    id: 'modelsReach',
    name: () => 'component models, templates and styles never reach the application; only controllers do',
    says: 'Only a controller imports from application/. Models, templates and styles see only their own component.',
    why: 'The controller is the one place presentation meets the application. A template that reaches the domain has two masters.',
    wrong: "import type { Counter } from '../../application/counter.ts';   // in home.model.ts",
    right: "// home.controller.ts\nimport type { ApplicationDomain } from '../../application/application-domain.ts';",
    check: ({ assert, imports, app }) =>
      assert.deepEqual(imports.filter((i) => i.file.startsWith(`${app}components/`) && !i.file.endsWith('.controller.ts') && i.target.startsWith(`${app}application/`)), []),
  },
  {
    id: 'eventContract',
    name: () => 'the event contract depends on neither side',
    says: 'An event file imports only other event files.',
    why: 'Events are the contract between the application and presentation. A contract that imports one side belongs to it.',
    wrong: "import type { Counter } from '../application/counter.ts';   // in an event",
    right: "export interface TicksChanged {\n  readonly type: 'TicksChanged';\n  ticks: number;\n}",
    check: ({ assert, imports, app }) => assert.deepEqual(imports.filter((i) => i.file.startsWith(`${app}events/`) && !i.target.startsWith(`${app}events/`)), []),
  },
  {
    id: 'presentation',
    name: () => 'the application never reaches into presentation',
    says: 'Nothing under application/ imports from components/.',
    why: 'The application domain knows nothing about screens. It publishes facts; whoever cares maps them.',
    wrong: "import type { HomeModel } from '../components/home/home.model.ts';   // in a capability",
    right: "this.publish<TicksChanged>({ type: 'TicksChanged', ticks });",
    check: ({ assert, imports, app }) => assert.deepEqual(imports.filter((i) => i.file.startsWith(`${app}application/`) && i.target.startsWith(`${app}components/`)), []),
  },
  {
    id: 'modelShape',
    name: () => 'models belong to components, and a model is only an interface',
    says: 'A *.model.ts lives in its component folder and holds types only: interfaces, type aliases, type-only imports.',
    why: 'The model is what the view reads. The moment it holds behaviour, the view has somewhere to put logic.',
    wrong: 'export class HomeModel { ticks = 0; }',
    right: 'export interface HomeModel {\n  ticks: number;\n}',
    check: ({ assert, read, root, app, atLeast }) => {
      const models = read(root).filter((f) => f.file.endsWith('.model.ts'));
      assert.ok(models.length >= atLeast.models, `only ${models.length} models; the rule stopped matching`);
      assert.deepEqual(models.filter((f) => !f.file.startsWith(`${app}components/`)).map((f) => f.file), []);
      assert.deepEqual(models.flatMap((f) => logicIn(f.text).map((l) => `${f.file}:${l}`)), []);
    },
  },
  {
    id: 'eventFiles',
    name: () => 'every event type is in its own file, as an interface',
    says: 'One event per file under events/, exported as an interface or a type — never a class.',
    why: 'An event is plain frozen data on the bus. A class invites methods, and a second event in the file hides from the one looking for it.',
    wrong: 'export class TicksChanged { … }',
    right: "export interface TicksChanged {\n  readonly type: 'TicksChanged';\n  ticks: number;\n}",
    check: ({ assert, read, events, app, atLeast }) => {
      const work = read(`${app}application/work`).filter((f) => /work-(at-risk|discarded)\.ts$/.test(f.file));
      const files = [...events.flatMap(read), ...work];
      assert.ok(files.length >= atLeast.events, `only ${files.length} event files; the rule stopped matching`);
      for (const { file, text } of files) {
        const exported = exportsIn(text);
        assert.equal(exported.length, 1, `${file}: exactly one exported type`);
        assert.ok(['interface', 'type'].includes(exported[0].kind), `${file}: an interface or type, not a ${exported[0].kind}`);
      }
    },
  },
  {
    id: 'eventNames',
    name: () => 'events name themselves: each event interface declares a literal type matching its name',
    says: "An event interface's `type` is the string of its own name.",
    why: 'Subscribers key on the string. A mismatch compiles, and the subscriber never hears the event.',
    wrong: "export interface TicksChanged { readonly type: 'TickChanged'; }",
    right: "export interface TicksChanged { readonly type: 'TicksChanged'; }",
    check: ({ assert, read, events }) => {
      for (const { file, text } of events.flatMap(read)) {
        for (const { name, literal } of eventTypesIn(text)) assert.equal(literal, name, `${file}: type literal matches the interface name`);
      }
    },
  },
  {
    id: 'controllers',
    name: () => 'controllers: subscriptions and DOM handlers go to private methods; nothing public of their own',
    says: 'Register every handler as a private method — this.handle(name, this.#method), this.subscribe(type, this.#method) — and give a controller no public member of its own.',
    why: 'A controller is driven by gestures and facts, not by callers. A public method is an invitation to call it from somewhere the change engine cannot see.',
    wrong: 'save(): void { … }\nthis.subscribe(\'X\', (e) => this.#x(e));',
    right: "protected override onInterconnect(): void {\n  this.handle('save', this.#save);\n  this.subscribe<Saved>('Saved', this.#saved);\n}",
    check: ({ assert, controllers, atLeast }) => {
      assert.ok(controllers.length >= atLeast.controllers, `only ${controllers.length} controllers; the rule stopped matching`);
      for (const { file, text } of controllers) {
        for (const r of registrationsIn(text)) assert.ok(r.target, `${file}:${r.line}: ${r.kind} must register a private method — this.${r.kind}(…, this.#method)`);
        assert.deepEqual(publicMembers(text), [], `${file}: public members`);
      }
    },
  },
  {
    id: 'stated',
    name: () => 'a change to the model is stated, however deep the call goes',
    says: 'Whatever writes the model — the handler, or any method it calls — must reach this.changed().',
    why: 'There is no change detection. A write nobody states is never drawn.',
    wrong: '#ticksChanged({ ticks }: TicksChanged): void {\n  this.model.ticks = ticks;\n}',
    right: '#ticksChanged({ ticks }: TicksChanged): void {\n  this.model.ticks = ticks;\n  this.changed();\n}',
    check: ({ assert, controllers, atLeast }) => {
      let checked = 0;
      for (const { file, text } of controllers) {
        const methods = new Map(methodsOf(text).map((m) => [m.name, m]));
        for (const name of new Set([...registeredWith(text, 'subscribe'), ...registeredWith(text, 'handle')])) {
          const { writes, states } = reach(methods, name);
          if (!writes) continue;
          checked++;
          assert.ok(states, `${file}: #${name} reaches a write to the model without stating the change`);
        }
      }
      assert.ok(checked >= atLeast.handlers, `only ${checked} handlers reach a model write; the rule stopped matching`);
    },
  },
  {
    id: 'handedBack',
    name: () => 'a handler that starts server work hands it back, so the gesture can close the loop',
    says: 'A promise a controller starts is returned, awaited, or handed to this.own().',
    why: "A DOM event is one synchronous stack. A promise leaves it, and whatever it publishes when it settles has no gesture to end — so nothing draws it unless its starter owns it.",
    wrong: '#reload(): void {\n  this.#store.load();\n}',
    right: '#reload(): Promise<void> {\n  return this.#store.load();\n}',
    check: ({ assert, read, controllers, app, atLeast }) => {
      const waits = waitsIn(read(`${app}application`));
      assert.ok(waits.size >= atLeast.waits, `only ${waits.size} waits (<Class>.<method> pairs that hand back a promise); the rule stopped matching`);
      const offenders = [];
      let sites = 0;
      let judged = 0;
      let unresolved = 0;
      for (const controller of controllers) {
        const found = unheldCalls(controller, waits);
        offenders.push(...found.offenders);
        sites += found.sites;
        judged += found.judged;
        unresolved += found.unresolved;
      }
      const judgement = `${waits.size} <Class>.<method> pairs hand back a promise; ${sites} call sites seen, ${judged} judged, ${unresolved} not judged (no declared field type)`;
      assert.deepEqual(offenders, [], `${judgement}\n${offenders.join('\n')}`);
      assert.ok(judged >= atLeast.calls, `only ${judged} calls judged (${judgement}); the rule stopped matching`);
    },
  },
  {
    id: 'moduleScope',
    name: () => 'nothing at module scope in a style or a template reaches the css tag',
    says: 'Write the css tag inside the Style callback, never at the top of a module.',
    why: "The tag goes through the styling adapter, which Application.create() installs. At import there is none, and the whole application fails to boot with 'No adapters installed.'",
    wrong: 'const card = css`:scope { padding: 1rem; }`;',
    right: 'export const cardStyle = new Style<CardModel>(() => css`:scope { padding: 1rem; }`);',
    check: ({ assert, read, root, atLeast }) => {
      const presentation = read(root).filter((f) => /\.(style|template)\.ts$/.test(f.file));
      const offenders = [];
      let tags = 0;
      for (const { file, text } of presentation) {
        const found = cssTagsAtModuleScope(text);
        tags += found.tags;
        offenders.push(...found.hits.map((line) => `${file}:${line}: the css tag runs at import — move it inside the Style callback`));
      }
      assert.ok(tags >= atLeast.tags, `only ${tags} css tags in ${presentation.length} style and template files; the rule stopped matching`);
      assert.deepEqual(offenders, [], `the css tag needs the styling adapter, which Application.create() installs:\n${offenders.join('\n')}`);
    },
  },
  {
    id: 'gestures',
    name: () => 'DOM handlers change nothing themselves: gestures go to the application domain',
    says: 'A DOM handler calls the application domain and writes nothing. The model changes when the fact comes back.',
    why: "If the click writes the model, the domain never hears of it — and the next screen that cares has no fact to hear.",
    wrong: "#tick(): void {\n  this.model.ticks += 1;\n  this.changed();\n}",
    right: '#tick(): void {\n  this.domain.counter.increment();   // publishes TicksChanged\n}',
    check: ({ assert, controllers }) => {
      for (const { file, text } of controllers) {
        const methods = new Map(methodsOf(text).map((m) => [m.name, m]));
        for (const name of registeredWith(text, 'handle')) {
          assert.ok(!reach(methods, name).writes, `${file}: #${name} writes the model; a gesture goes to the domain instead`);
        }
      }
    },
  },
  {
    id: 'adopted',
    name: () => 'a capability is adopted, never pushed: a child without a parent has no bus',
    says: 'Add a child with this.adopt(capability), never this.children.push(capability).',
    why: "push() alone compiles and runs until the child publishes. Then it fails somewhere else as 'not attached to an application', because the bus is found through parent.",
    wrong: 'this.children.push(new Counter());',
    right: 'this.counter = this.adopt(new Counter());',
    check: ({ assert, read, app }) =>
      assert.deepEqual(read(app).flatMap(({ file, text }) => callsTo(text, 'this.children', 'push').map((line) => `${file}:${line}: use this.adopt(capability)`)), []),
  },
  {
    id: 'renderPass',
    name: () => 'a render pass begins only at the end of a DOM event',
    says: 'A controller never calls changes.update(). It states changes; the gesture ends the pass.',
    why: 'One gesture, one render. A controller that renders mid-gesture draws a half-updated screen, and draws it twice.',
    wrong: 'this.changed();\nchanges.update();',
    right: 'this.changed();',
    check: ({ assert, controllers }) => {
      for (const { file, text } of controllers) {
        assert.deepEqual(callsTo(text, 'changes', 'update'), [], `${file}: calls update(); handlers state changes and let the gesture end the pass`);
      }
    },
  },
];

export function applicationRules({ test, assert, base, root, app, within, styling, events, libraries = 'vanilla-mvc/', atLeast }) {
  const tree = treeAt(base);
  const context = {
    assert, root, app, within, styling, events, libraries, atLeast,
    read: tree.read,
    namedImportsOf: tree.namedImportsOf,
    imports: tree.importsOf(root),
    get controllers() {
      return tree.read(`${app}components`).filter((f) => f.file.endsWith('.controller.ts'));
    },
  };
  for (const rule of RULES) test(rule.name(context), () => rule.check(context));
}
