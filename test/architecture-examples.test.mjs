// The architecture rules, judged against known answers.
//
// One small application passes every rule. Each example below changes one thing in it and names
// the one rule that must turn red — no other. Some examples change something that must leave
// every rule green: a forbidden word in a comment or a string is not code.
//
// Two ways a rule fails, and both are caught here:
//   it misses — an example that should be red stays green (a `+=` the rule could not see);
//   it over-reaches — an example turns a second rule red, or a green example turns anything red.
//
// The rules take their test runner as an argument, so this file hands them one that records a
// verdict per rule instead of reporting. That is the whole harness.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { applicationRules } from '../architecture/rules.mjs';

/** The application every example starts from. It passes all the rules. */
const BASE = {
  'src/app.ts': `import { Application, type Component } from 'vanilla-mvc';
import { ApplicationDomain } from './application/application-domain.ts';
import { HomeComponent } from './components/home/home.component.ts';

export class NotesApplication extends Application<ApplicationDomain> {
  protected createDomain(): ApplicationDomain { return new ApplicationDomain(); }
  protected createShell(): Component { return new HomeComponent('home'); }
}
`,
  'src/application/application-domain.ts': `import { ApplicationElement } from 'vanilla-mvc';
import { Counter } from './counter.ts';
import { Store } from './store.ts';

export class ApplicationDomain extends ApplicationElement {
  counter!: Counter;
  store!: Store;

  protected override onCreate(): void {
    this.counter = this.adopt(new Counter());
    this.store = this.adopt(new Store());
  }
}
`,
  'src/application/counter.ts': `import { ApplicationElement } from 'vanilla-mvc';
import type { TicksChanged } from '../events/ticks-changed.ts';

export class Counter extends ApplicationElement {
  #ticks = 0;

  increment(): void {
    this.#ticks += 1;
    this.publish<TicksChanged>({ type: 'TicksChanged', ticks: this.#ticks });
  }
}
`,
  'src/application/store.ts': `import { ApplicationElement } from 'vanilla-mvc';

export class Store extends ApplicationElement {
  load(): Promise<void> {
    return Promise.resolve();
  }
}
`,
  'src/events/ticks-changed.ts': `export interface TicksChanged {
  readonly type: 'TicksChanged';
  ticks: number;
}
`,
  'src/events/ticks-reset.ts': `export interface TicksReset {
  readonly type: 'TicksReset';
}
`,
  'src/components/home/home.model.ts': `export interface HomeModel {
  ticks: number;
}
`,
  'src/components/home/home.controller.ts': `import { Controller } from 'vanilla-mvc';
import type { ApplicationDomain } from '../../application/application-domain.ts';
import type { Store } from '../../application/store.ts';
import type { TicksChanged } from '../../events/ticks-changed.ts';
import type { TicksReset } from '../../events/ticks-reset.ts';
import type { HomeModel } from './home.model.ts';

export class HomeController extends Controller<HomeModel, ApplicationDomain> {
  #store!: Store;

  protected createModel(): HomeModel {
    return { ticks: 0 };
  }

  protected override onCreate(): void {
    this.#store = this.domain.store;
  }

  protected override onInterconnect(): void {
    this.handle('tick', this.#tick);
    this.handle('reload', this.#reload);
    this.subscribe<TicksChanged>('TicksChanged', this.#ticksChanged);
    this.subscribe<TicksReset>('TicksReset', this.#ticksReset);
  }

  #tick(): void {
    this.domain.counter.increment();
  }

  #reload(): Promise<void> {
    return this.#store.load();
  }

  #ticksChanged({ ticks }: TicksChanged): void {
    this.model.ticks = ticks;
    this.changed();
  }

  #ticksReset(): void {
    this.model.ticks = 0;
    this.changed();
  }
}
`,
  'src/components/home/home.template.ts': `import { html, Template } from 'vanilla-mvc';
import type { HomeController } from './home.controller.ts';
import type { HomeModel } from './home.model.ts';

export const homeTemplate = new Template<HomeModel, HomeController>(
  (m, c) => html\`<section><button @click=\${c.handler('tick')}>\${m.ticks}</button></section>\`,
);
`,
  'src/components/home/home.style.ts': `import { css, Style } from 'vanilla-mvc';
import { layout } from 'vanilla-mvc/css';
import type { HomeModel } from './home.model.ts';

export const homeStyle = new Style<HomeModel>(
  () => css\`
    :scope { \${layout.stack({ gap: '2' })} }
  \`,
);
`,
  'src/components/home/home.component.ts': `import { Component } from 'vanilla-mvc';
import { HomeController } from './home.controller.ts';
import type { HomeModel } from './home.model.ts';
import { homeTemplate } from './home.template.ts';

export class HomeComponent extends Component<HomeModel, HomeController> {
  protected createTemplate() { return homeTemplate; }
  protected createController() { return new HomeController(); }
}
`,
};

const CONTROLLER = 'src/components/home/home.controller.ts';
const MODEL = 'src/components/home/home.model.ts';
const TEMPLATE = 'src/components/home/home.template.ts';
const STYLE = 'src/components/home/home.style.ts';
const EVENT = 'src/events/ticks-changed.ts';
const COUNTER = 'src/application/counter.ts';
const DOMAIN = 'src/application/application-domain.ts';

/** Every rule's name contains exactly one of these; an example names the one it must redden. */
const RULE = {
  imports: 'every import lands under',
  libraries: 'reaches libraries only through the framework',
  cssTag: 'css and styled come from the framework',
  modelsReach: 'never reach the application; only controllers do',
  eventContract: 'the event contract depends on neither side',
  presentation: 'the application never reaches into presentation',
  modelShape: 'a model is only an interface',
  eventFiles: 'every event type is in its own file',
  eventNames: 'events name themselves',
  controllers: 'nothing public of their own',
  stated: 'a change to the model is stated',
  handedBack: 'hands it back, so the gesture can close the loop',
  moduleScope: 'nothing at module scope in a style or a template reaches the css tag',
  gestures: 'DOM handlers change nothing themselves',
  adopted: 'a capability is adopted, never pushed',
  renderPass: 'a render pass begins only at the end of a DOM event',
};

/** Replace `from` with `to` in one file, and insist `from` was there: an example that edits nothing proves nothing. */
const edit = (file, from, to) => (files) => {
  if (!files[file].includes(from)) throw new Error(`example edits ${file} but "${from}" is not in it`);
  return { ...files, [file]: files[file].replace(from, to) };
};
const add = (file, text) => (files) => ({ ...files, [file]: text });

/** Run every rule over `files`, and give back the names of the rules that failed. */
function judge(files) {
  const dir = mkdtempSync(join(tmpdir(), 'vanilla-mvc-rules-'));
  try {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    const red = [];
    const verdicts = [];
    applicationRules({
      test: (name, fn) => {
        verdicts.push(name);
        try {
          fn();
        } catch (error) {
          red.push({ name, message: String(error.message).split('\n')[0] });
        }
      },
      assert,
      base: dir,
      root: 'src',
      app: 'src/',
      within: ['vanilla-mvc', 'src/'],
      libraries: 'vanilla-mvc/',
      styling: { folder: 'vanilla-mvc/css', from: /\.(template|style)\.ts$/ },
      events: ['src/events'],
      atLeast: { models: 1, events: 1, controllers: 1, handlers: 1, waits: 1, calls: 1, tags: 1 },
    });
    return { red, verdicts };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Which RULE key a failing rule name belongs to. */
const keyOf = (name) => Object.keys(RULE).find((k) => name.includes(RULE[k])) ?? `unknown: ${name}`;

test('the base application passes every rule, and every rule ran', () => {
  const { red, verdicts } = judge(BASE);
  assert.deepEqual(red, []);
  for (const [key, phrase] of Object.entries(RULE)) {
    assert.ok(verdicts.some((v) => v.includes(phrase)), `no rule matching ${key}: "${phrase}"`);
  }
});

/**
 * [what it shows, the rule it must redden (null: none), the change]
 * @type {[string, string | null, (files: Record<string, string>) => Record<string, string>][]}
 */
const EXAMPLES = [
  // ---- imports ----
  ['a package the application may not use', 'imports', edit(COUNTER, "import { ApplicationElement } from 'vanilla-mvc';", "import { ApplicationElement } from 'vanilla-mvc';\nimport { chunk } from 'lodash';")],
  ['a controller reaching a library around the framework', 'libraries', edit(CONTROLLER, "import { Controller } from 'vanilla-mvc';", "import { Controller } from 'vanilla-mvc';\nimport { RouteTable } from 'vanilla-mvc/router';")],
  ['the css tag taken from the library, not the framework', 'cssTag', edit(STYLE, "import { layout } from 'vanilla-mvc/css';", "import { layout, css as raw } from 'vanilla-mvc/css';")],
  ['a model reaching the application', 'modelsReach', edit(MODEL, 'export interface HomeModel {', "import type { Counter } from '../../application/counter.ts';\n\nexport interface HomeModel {")],
  ['an event reaching the application', 'eventContract', edit(EVENT, 'export interface TicksChanged {', "import type { Counter } from '../application/counter.ts';\n\nexport interface TicksChanged {")],
  ['the application reaching presentation', 'presentation', edit(COUNTER, "import type { TicksChanged } from '../events/ticks-changed.ts';", "import type { TicksChanged } from '../events/ticks-changed.ts';\nimport type { HomeModel } from '../components/home/home.model.ts';")],
  ['an import written across lines is still an import', 'imports', edit(COUNTER, "import { ApplicationElement } from 'vanilla-mvc';", "import { ApplicationElement } from 'vanilla-mvc';\nimport {\n  chunk,\n} from 'lodash';")],
  ['a re-export is an import too', 'imports', edit(COUNTER, "import { ApplicationElement } from 'vanilla-mvc';", "import { ApplicationElement } from 'vanilla-mvc';\nexport { chunk } from 'lodash';")],
  ['a dynamic import is an import too', 'imports', edit(COUNTER, '  increment(): void {', "  later(): Promise<unknown> {\n    return import('lodash');\n  }\n\n  increment(): void {")],
  ['an import in a comment is not an import', null, edit(COUNTER, '  increment(): void {', "  // import { chunk } from 'lodash';\n  increment(): void {")],

  // ---- models and events ----
  ['a model with a value in it', 'modelShape', edit(MODEL, '  ticks: number;\n}', '  ticks: number;\n}\n\nexport const START = 0;')],
  ['a model that is a class', 'modelShape', add(MODEL, 'export class HomeModel {\n  ticks = 0;\n}\n')],
  ['a model whose doc comment says "return" is still only an interface', null, edit(MODEL, 'export interface HomeModel {', '/** What the view reads; the controller will return here with a new one. */\nexport interface HomeModel {')],
  ['two events in one file', 'eventFiles', edit(EVENT, '  ticks: number;\n}', "  ticks: number;\n}\n\nexport interface TicksReset {\n  readonly type: 'TicksReset';\n}")],
  ['an event that is a class', 'eventFiles', add(EVENT, "export class TicksChanged {\n  readonly type = 'TicksChanged';\n}\n")],
  ['an event whose type is another name', 'eventNames', edit(EVENT, "readonly type: 'TicksChanged';", "readonly type: 'TickChanged';")],
  ['an event whose type is another name, without readonly', 'eventNames', edit(EVENT, "readonly type: 'TicksChanged';", "type: 'TickChanged';")],

  // ---- controllers ----
  ['a public method on a controller', 'controllers', edit(CONTROLLER, '  #tick(): void {', '  save(): void {}\n\n  #tick(): void {')],
  ['a public getter on a controller', 'controllers', edit(CONTROLLER, '  #tick(): void {', '  get total(): number { return 1; }\n\n  #tick(): void {')],
  ['a public field on a controller', 'controllers', edit(CONTROLLER, '  #store!: Store;', '  #store!: Store;\n  count = 0;')],
  ['a subscription to something other than a private method', 'controllers', edit(CONTROLLER, "this.subscribe<TicksChanged>('TicksChanged', this.#ticksChanged);", "this.subscribe<TicksChanged>('TicksChanged', (e) => this.#ticksChanged(e));")],
  ['a registration written across lines is still a registration', null, edit(CONTROLLER, "this.subscribe<TicksChanged>('TicksChanged', this.#ticksChanged);", "this.subscribe<TicksChanged>(\n      'TicksChanged',\n      this.#ticksChanged,\n    );")],

  // ---- stating the change ----
  ['a model write nobody states', 'stated', edit(CONTROLLER, '    this.model.ticks = ticks;\n    this.changed();', '    this.model.ticks = ticks;')],
  ['a compound write nobody states', 'stated', edit(CONTROLLER, '    this.model.ticks = ticks;\n    this.changed();', '    this.model.ticks += ticks;')],
  ['a write through a helper nobody states', 'stated', edit(CONTROLLER, '    this.model.ticks = ticks;\n    this.changed();\n  }', '    this.#apply(ticks);\n  }\n\n  #apply(ticks: number): void {\n    this.model.ticks = ticks;\n  }')],
  ['a write deeper in the model nobody states', 'stated', edit(CONTROLLER, '    this.model.ticks = ticks;\n    this.changed();', '    (this.model as any).counts.ticks = ticks;')],
  ['a comparison is not a write', null, edit(CONTROLLER, '    this.model.ticks = ticks;\n    this.changed();', '    if (this.model.ticks === ticks) return;\n    this.model.ticks = ticks;\n    this.changed();')],

  // ---- promises ----
  ['a promise a handler started and let go', 'handedBack', edit(CONTROLLER, '    return this.#store.load();', '    this.#store.load();\n    return Promise.resolve();')],
  ['a promise handed to own() is held', null, edit(CONTROLLER, '    return this.#store.load();', '    this.own(this.#store.load());\n    return Promise.resolve();')],
  ['a promise returned across lines is held', null, edit(CONTROLLER, '    return this.#store.load();', '    return this.#store\n      .load();')],
  ['an async method is a wait too', 'handedBack', (files) => edit(CONTROLLER, '    return this.#store.load();', '    this.#store.save();\n    return Promise.resolve();')(edit('src/application/store.ts', '  load(): Promise<void> {', '  async save() {}\n\n  load(): Promise<void> {')(files))],

  // ---- the css tag ----
  ['a css tag at module scope', 'moduleScope', edit(STYLE, 'export const homeStyle', "const loose = css`p { color: red; }`;\n\nexport const homeStyle")],
  ['a css tag at module scope, past an unrelated arrow', 'moduleScope', edit(STYLE, 'export const homeStyle', "export const pair = [() => 1, css`p { color: red; }`];\n\nexport const homeStyle")],
  ['a css tag in a comment is not a tag', null, edit(STYLE, 'export const homeStyle', '// const loose = css`p { color: red; }`;\nexport const homeStyle')],

  // ---- gestures ----
  ['a DOM handler that writes the model', 'gestures', edit(CONTROLLER, '    this.domain.counter.increment();', '    this.model.ticks += 1;\n    this.changed();')],
  ['a DOM handler that writes the model through a helper', 'gestures', edit(CONTROLLER, '    this.domain.counter.increment();\n  }', '    this.#bump();\n  }\n\n  #bump(): void {\n    this.model.ticks = 1;\n    this.changed();\n  }')],

  // ---- the tree ----
  ['a capability pushed without a parent', 'adopted', edit(DOMAIN, '    this.store = this.adopt(new Store());', '    this.store = new Store();\n    this.children.push(this.store);')],
  ['children.push in a comment is not a push', null, edit(DOMAIN, '    this.store = this.adopt(new Store());', '    // never this.children.push(store): adopt sets the parent\n    this.store = this.adopt(new Store());')],
  ['a controller that starts a render pass', 'renderPass', edit(CONTROLLER, '    this.model.ticks = ticks;\n    this.changed();', "    this.model.ticks = ticks;\n    this.changed();\n    changes.update();")],
  ['update() in a string is not a render pass', null, edit(CONTROLLER, '    this.domain.counter.increment();', "    this.domain.counter.increment();\n    console.log('never changes.update() here');")],
];

for (const [shows, rule, change] of EXAMPLES) {
  test(`${rule ? `red: ${rule}` : 'green'} — ${shows}`, () => {
    const { red } = judge(change(BASE));
    const got = [...new Set(red.map((r) => keyOf(r.name)))].sort();
    const want = rule ? [rule] : [];
    assert.deepEqual(got, want, red.map((r) => `${keyOf(r.name)}: ${r.message}`).join('\n'));
  });
}
