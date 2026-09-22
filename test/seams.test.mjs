import { suite, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
// The rules themselves ship with the package, so an application built on it can run them too.
import {
  applicationRules as rulesOver,
  writesModel,
  classBodyOf,
  cssTagsAtModuleScope,
  fieldTypes,
  privateMethods,
  unheldCalls,
  waitsIn,
} from '../architecture/rules.mjs';

// The architecture, as rules over imports and text. The framework and its
// libraries live under src/ and are checked once. The application rules are a
// function of a root: src (the demo, app tree src/app/) and the external consumer's src
// (whose components/, application/ and events/ are direct children).
// Every file and import target is named relative to the repo.

const REPO = join(import.meta.dirname, '..');

// An application built on this framework is its forcing function: the suites below read one in
// place, wherever CONSUMER points (`npm run test:consumer` sets it). With no CONSUMER they skip,
// saying so, rather than passing on nothing — a check that examines zero files is worse than none.
const CONSUMER = process.env.CONSUMER ?? '';
const CONSUMER_SRC = join(CONSUMER, 'src');
const PACKAGE = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'));

const posix = (path) => path.split(sep).join('/');
const inRepo = (path) => posix(relative(REPO, path));
const present = (dir) => existsSync(join(REPO, dir));
const folders = (dir) => (present(dir) ? readdirSync(join(REPO, dir), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []);

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

/** Every source under a repo-relative dir as { file, text }, file relative to the repo. */
const read = (dir) => [...sources(join(REPO, dir))].map((path) => ({ file: inRepo(path), path, text: readFileSync(path, 'utf8') }));

/** A specifier as a repo-relative target (the specifier itself for packages). */
const targetOf = (path, specifier) => (specifier.startsWith('.') ? inRepo(resolve(dirname(path), specifier)) : specifier);

/** Every import under a dir: the importing file, and the target relative to the repo (the specifier itself for packages). */
const importsOf = (dir) =>
  read(dir).flatMap(({ file, path, text }) =>
    [...text.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g)].map(([, specifier]) => ({
      file,
      target: targetOf(path, specifier),
    })),
  );

/** Every named import under a dir: the importing file, the target, and the names bound (before any `as`). */
const namedImportsOf = (dir) =>
  read(dir).flatMap(({ file, path, text }) =>
    [...text.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s+['"]([^'"]+)['"]/g)].map(([, names, specifier]) => ({
      file,
      target: targetOf(path, specifier),
      names: names.split(',').map((n) => n.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]).filter(Boolean),
    })),
  );

// ---- The framework and its libraries: once, over src ----

suite('src/framework and src/libraries', () => {
  const imports = importsOf('src');
  const libraries = folders('src/libraries');
  const adapterFolders = folders('src/framework/adapters');

  test('no runtime dependencies', () => {
    assert.deepEqual(PACKAGE.dependencies ?? {}, {});
  });

  test('each library stands alone: imports only from its own folder', () => {
    assert.deepEqual(
      imports.filter((i) => i.file.startsWith('src/libraries/') && !i.target.startsWith(i.file.split('/').slice(0, 3).join('/') + '/')),
      [],
    );
  });

  test('each library has an adapter folder of the same name', () => {
    assert.deepEqual(adapterFolders.sort(), libraries.sort());
  });

  test('framework/adapters/<name>/ reaches only libraries/<name>/', () => {
    const offenders = imports.filter((i) => {
      const [, , , folder] = i.file.split('/');
      const inAdapterFolder = i.file.startsWith('src/framework/adapters/') && adapterFolders.includes(folder);
      return inAdapterFolder && i.target.startsWith('src/libraries/') && !i.target.startsWith(`src/libraries/${folder}/`);
    });
    assert.deepEqual(offenders, []);
  });

  test('the rest of the framework reaches libraries only through the seams', () => {
    const offenders = imports.filter((i) => {
      const inAdapterFolder = adapterFolders.some((folder) => i.file.startsWith(`src/framework/adapters/${folder}/`));
      return i.file.startsWith('src/framework/') && !inAdapterFolder && i.target.startsWith('src/libraries/');
    });
    assert.deepEqual(offenders, []);
  });

  test('in the framework, exactly two places end a gesture: a DOM handler, and the router', () => {
    // For the popstate and link clicks no controller wraps.
    const callers = read('src/framework')
      .filter(({ text }) => /changes\.update\(\)/.test(text))
      .map(({ file }) => file)
      .sort();
    assert.deepEqual(callers, ['src/framework/controller.ts', 'src/framework/router.ts']);
  });
});

// ---- The application rules, as a function of a root ----


// ---- The module-scope rule: the css tag never runs at import ----

suite('src (the demo)', () => {
  rulesOver({
    test,
    assert,
    base: REPO,
    libraries: 'src/libraries/',
    root: 'src',
    app: 'src/app/',
    within: ['src/app/', 'src/framework/', 'src/libraries/'],
    styling: null,
    events: ['src/app/events', 'src/framework/events'],
    // Each count is what its rule read on the tree; raised, never lowered.
    atLeast: {
      models: 10, // read 2026-09-19
      events: 26, // read 2026-09-19
      controllers: 10, // read 2026-09-19
      handlers: 16, // read 2026-09-19
      waits: 21, // read 2026-09-19 — <Class>.<method> pairs now, not method names
      calls: 9, // read 2026-09-19
      tags: 0, // read 2026-09-19 — the demo dresses its document with styles.css, not the css tag
    },
  });
});

// A consumer imports the framework anywhere, the styling library only from
// presentation (*.template.ts, *.style.ts — the document sheet included), and only
// through the library's root index; never src/app/, never another library. Each
// threshold is the count toolchain read; raised, never lowered, and never below the
// Colonel's floor (17 models, events, controllers; 14 handlers, waits, calls).
//
// The consumer is external now, and installs this framework from the local registry, so it
// imports 'vanilla-mvc' and 'vanilla-mvc/css' rather than a path into src/.
const SAMPLE_STYLING = { folder: 'vanilla-mvc/css', from: /\.(template|style)\.ts$/ };
const SAMPLE_CSS_DOOR = 'vanilla-mvc/css';

suite(`${CONSUMER_SRC} (the consumer)`, {
  skip: (!CONSUMER || !present(CONSUMER_SRC)) && (CONSUMER ? `no consumer at ${CONSUMER_SRC}` : 'CONSUMER is not set: npm run test:consumer'),
}, () => {
  test('the styling rule names presentation, and nothing else', () => {
    assert.match('src/document.style.ts', SAMPLE_STYLING.from);
    assert.match('src/components/shell/shell.style.ts', SAMPLE_STYLING.from);
    assert.doesNotMatch('src/app.ts', SAMPLE_STYLING.from);
    assert.doesNotMatch('src/components/shell/shell.controller.ts', SAMPLE_STYLING.from);
  });

  test(`the CSS library is imported only as ${SAMPLE_CSS_DOOR}`, () => {
    // A deep import — 'vanilla-mvc/dist/libraries/css/theme/…' — is the library's inside.
    const offenders = importsOf(CONSUMER_SRC)
      .filter((i) => /(^|\/)libraries\/css\//.test(i.target) || (i.target.startsWith(SAMPLE_CSS_DOOR) && i.target !== SAMPLE_CSS_DOOR))
      .map((i) => `${i.file} imports ${i.target}`);
    assert.deepEqual(offenders, [], `import the CSS library only as ${SAMPLE_CSS_DOOR}:\n${offenders.join('\n')}`);
  });

  // No mocked backend: journeys run on startStack() against the real one. That is the consumer's
  // own ruling (docs/decisions/journeys-run-on-a-real-browser-and-a-real-backend.md, in its repo);
  // this checks the shape the framework's harness assumes.
  test('the consumer has no mocks folder', () => {
    assert.ok(!present(join(CONSUMER, 'mocks')), `${join(CONSUMER, 'mocks')} exists; the consumer has no mocks`);
  });

  rulesOver({
    test,
    assert,
    base: REPO,
    libraries: 'src/libraries/',
    root: CONSUMER_SRC,
    app: `${CONSUMER_SRC}/`,
    // It installs the framework, so the only things it may import are the package and itself.
    within: ['vanilla-mvc', `${CONSUMER_SRC}/`],
    styling: SAMPLE_STYLING,
    events: [`${CONSUMER_SRC}/events`],
    atLeast: {
      models: 36, // read 2026-09-19
      events: 67, // read 2026-09-19
      controllers: 36, // read 2026-09-19
      handlers: 59, // read 2026-09-19
      waits: 116, // read 2026-09-19 — <Class>.<method> pairs now, not method names
      calls: 51, // read 2026-09-19
      tags: 43, // read 2026-09-19
    },
  });
});

// ---- Engine boundaries inside the CSS library ----

const CSS = 'src/libraries/css/';

/**
 * Which folders a folder may import, through ../<folder>/index.ts only.
 * Theme is the second floor; no engine imports semantics/ — only the library's root index does.
 */
const ENGINE_MATRIX = {
  templates: [],
  theme: ['templates'],
  layout: ['templates', 'theme'],
  responsive: ['templates', 'theme'],
  animation: ['templates', 'theme'],
  effects: ['templates', 'theme', 'animation'],
  semantics: ['templates', 'theme', 'layout', 'responsive', 'animation', 'effects'],
};

const engineFolders = folders(CSS);

suite('src/libraries/css (the engine matrix)', { skip: engineFolders.length === 0 && `${CSS} has no folders yet` }, () => {
  /** The folder under css/ a file is in; null for a file at the library's root. */
  const folderOf = (file) => {
    const parts = file.slice(CSS.length).split('/');
    return parts.length > 1 ? parts[0] : null;
  };

  test('every folder is one the engine boundary names', () => {
    assert.deepEqual(engineFolders.filter((folder) => !(folder in ENGINE_MATRIX)), []);
  });

  test('imports cross folders only as ../<folder>/index.ts, and only along the matrix', () => {
    // The library's root index is its front door, above the engines: it may reach
    // every folder's index, semantics included. Nothing inside a folder
    // imports a root file.
    const offenders = importsOf(CSS)
      .filter((i) => i.target.startsWith(CSS) && folderOf(i.target) !== folderOf(i.file))
      .filter(({ file, target }) => {
        const from = folderOf(file);
        const to = folderOf(target);
        if (to === null) return true;
        if (target !== `${CSS}${to}/index.ts`) return true;
        if (from === null) return false;
        return !(ENGINE_MATRIX[from] ?? []).includes(to);
      });
    assert.deepEqual(offenders, []);
  });
});

// ---- Vocabulary in the consumer ----

/**
 * The words a consumer never uses, whole and with an optional plural; workflow anywhere at all.
 * @type {[string, RegExp][]}
 */
const BANNED = [
  ['workflow', /workflow/gi],
  ['memo', /\bmemos?\b/gi],
  ['mailroom', /\bmailrooms?\b/gi],
  ['interoffice', /\binteroffice\b/gi],
  ['interdepartmental', /\binterdepartmental\b/gi],
  ['clerk', /\bclerks?\b/gi],
  ['department', /\bdepartments?\b/gi],
  ['in-tray', /\bin[-\s]trays?\b/gi],
  ['out-tray', /\bout[-\s]trays?\b/gi],
  ['inbox', /\binbox(?:es)?\b/gi],
  ['outbox', /\boutbox(?:es)?\b/gi],
  ['routing slip', /\brouting\sslips?\b/gi],
  ['carbon copy', /\bcarbon\s(?:copy|copies)\b/gi],
  ['filing cabinet', /\bfiling\scabinets?\b/gi],
  ['paperwork', /\bpaperwork\b/gi],
];

/** Every file under a dir, any extension, skipping the named subfolders of dir. */
function* everyFile(dir, skip) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skip.includes(path)) yield* everyFile(path, skip);
    } else yield path;
  }
}

suite('the consumer (vocabulary)', {
  skip: (!CONSUMER || !present(CONSUMER)) && (CONSUMER ? `no consumer at ${CONSUMER}` : 'CONSUMER is not set: npm run test:consumer'),
}, () => {
  test(`no workflow, and none of the reserved words, in any file the consumer tracks`, () => {
    const offenders = [];
    // Tracked files, not every file: the consumer's build outputs are a 111 MB binary and a staged
    // copy of this framework, and neither is its prose. `git ls-files` is the one list that says
    // what the application is, and it is what the author would grep.
    const root = join(REPO, CONSUMER);
    const listed = spawnSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8' });
    assert.equal(listed.status, 0, `${CONSUMER} is not a git repository: ${listed.stderr}`);
    const files = listed.stdout.split('\0').filter(Boolean);
    assert.ok(files.length > 100, `only ${files.length} tracked files in ${CONSUMER}`);
    for (const relative of files) {
      const path = join(root, relative);
      const text = readFileSync(path, 'utf8');
      for (const [word, pattern] of BANNED) {
        for (const match of text.matchAll(pattern)) {
          offenders.push(`${relative}:${text.slice(0, match.index).split('\n').length}: ${word}`);
        }
      }
    }
    assert.deepEqual(offenders, [], `banned words under ${CONSUMER}:\n${offenders.join('\n')}`);
  });
});

// ---- The two new rules, proved in both directions  ----

/** A fixture source, written as lines so a `css` tag and a template hole stay readable. */
const source = (...lines) => lines.join('\n');

suite('the rules themselves', () => {
  const application = source(
    'export class Optimizing extends ApplicationElement {',
    '  choose(id: string, on: boolean): void {',
    '    this.#review.choose(id, on);',
    '  }',
    '',
    '  load(): Promise<void> {',
    '    return this.#requests.get();',
    '  }',
    '}',
  );
  const consistency = source(
    'export class Consistency extends ApplicationElement {',
    '  async choose(id: string, on: boolean): Promise<void> {',
    '    await this.#requests.post();',
    '  }',
    '}',
  );
  const waits = waitsIn([{ text: application }, { text: consistency }]);

  test('waits is keyed by owner: one capability’s async verb never judges another’s', () => {
    assert.deepEqual([...waits].sort(), ['Consistency.choose', 'Optimizing.load']);
  });

  test('the rule is red on a genuine unheld promise', () => {
    const controller = source(
      'export class OptimizePageController extends Controller<M, D> {',
      '  #optimizing!: Optimizing;',
      '',
      '  #refresh(): void {',
      '    this.#optimizing.load();',
      '  }',
      '}',
    );
    const found = unheldCalls({ file: 'fixture.controller.ts', text: controller }, waits);
    assert.equal(found.judged, 1);
    assert.equal(found.offenders.length, 1);
    assert.match(found.offenders[0], /fixture\.controller\.ts:5: Optimizing\.load\(\) hands back a promise/);
  });

  test('the rule is green when the promise is held, and on the verb its owner does not wait on', () => {
    const controller = source(
      'export class FindingRowController extends Controller<M, D> {',
      '  #optimizing!: Optimizing;',
      '',
      '  #toggle(): Promise<void> {',
      '    return this.#optimizing.load();',
      '  }',
      '',
      '  #tick(): void {',
      '    this.#optimizing.choose(this.model.id, true);',
      '  }',
      '}',
    );
    const found = unheldCalls({ file: 'fixture.controller.ts', text: controller }, waits);
    assert.deepEqual(found.offenders, []);
    assert.deepEqual([found.sites, found.judged, found.unresolved], [2, 1, 0]);
  });

  test('a field with no declared type is counted, not judged', () => {
    const controller = source(
      'export class ShellController extends Controller<M, D> {',
      '  #names = new Map<string, string>();',
      '',
      '  #name(id: string): string {',
      '    return this.#names.load(id);',
      '  }',
      '}',
    );
    const found = unheldCalls({ file: 'fixture.controller.ts', text: controller }, waits);
    assert.deepEqual(found.offenders, []);
    assert.deepEqual([found.sites, found.judged, found.unresolved], [1, 0, 1]);
  });

  test('a field with no annotation takes the type of the constructor parameter it is assigned from', () => {
    const controller = source(
      'export class OptimizePageController extends Controller<M, D> {',
      '  #work;',
      '',
      '  constructor(optimizing: Optimizing) {',
      '    super();',
      '    this.#work = optimizing;',
      '  }',
      '',
      '  #refresh(): void {',
      '    this.#work.load();',
      '  }',
      '}',
    );
    assert.equal(fieldTypes(controller).get('work'), 'Optimizing');
    assert.equal(unheldCalls({ file: 'fixture.controller.ts', text: controller }, waits).offenders.length, 1);
  });

  test('the css tag is refused at module scope, however it is reached', () => {
    const style = source(
      "import { css, Style } from '../../../../src/framework/index.ts';",
      '',
      "const WIDE = responsive.atContainer(PAGE, 'md', css`.list { display: grid; }`);",
      '',
      'const SHEET = css`:scope { color: red; }`;',
    );
    const found = cssTagsAtModuleScope(style);
    assert.deepEqual(found.hits, [3, 5]);
    assert.equal(found.tags, 2);
  });

  test('the css tag is green inside the Style callback, and an engine word hoisted to module scope is not a tag', () => {
    const style = source(
      "import { css, Style } from '../../../../src/framework/index.ts';",
      '',
      '/** The comment may name the `css` tag; only code is read. */',
      "const ACCENT = theme.color('accent');",
      "const ENTER = animation.animate('fade-in');",
      "const GRID = layout.grid({ gap: '1', min: '14rem' });",
      "const WIDE = (rules: string) => responsive.atContainer('page', 'md', rules);",
      '',
      'export const pageStyle = new Style<M>((m) => css`',
      '  :scope { ${GRID} color: ${ACCENT}; animation: ${ENTER}; }',
      "  ${responsive.atContainer('page', 'md', css`.list { ${GRID} }`)}",
      '  .bar { inline-size: ${m.share}%; }',
      '`);',
    );
    const found = cssTagsAtModuleScope(style);
    assert.deepEqual(found.hits, []);
    assert.equal(found.tags, 2, 'the tag nested in a hole is read too, and is inside the callback like its parent');
  });

  test('a module-scope helper below the class is not a public member of it', () => {
    const controller = source(
      'export class SearchPageController extends Controller<M, D> {',
      '  #searching!: Searching;',
      '}',
      '',
      'function listOf(value: unknown): string[] {',
      '  if (Array.isArray(value)) return value.map(String);',
      '  return [];',
      '}',
    );
    const members = [...classBodyOf(controller).matchAll(/^  (?!protected |private |static #|#|readonly #|constructor)(static )?(\w+)\s*[(<]/gm)].map((m) => m[2]);
    assert.deepEqual(members, []);
  });
});

// ---- Every library is reached by a consumer, and reached the right way ----


suite('a consumer exercises every library', {
  skip: (!CONSUMER || !present(CONSUMER_SRC)) && (CONSUMER ? `no consumer at ${CONSUMER_SRC}` : 'CONSUMER is not set: npm run test:consumer'),
}, () => {
  const consumer = read(CONSUMER_SRC).map((f) => ({ ...f, code: f.text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '') }));
  const anywhere = consumer.map((f) => f.code).join('\n');

  test('the consumer is actually there: the scan found files', () => {
    assert.ok(consumer.length > 50, `only ${consumer.length} files under ${CONSUMER_SRC}`);
  });

  test('scripts/surface.mjs reports no cold authoring surface', () => {
    const result = spawnSync(
      process.execPath,
      [join(REPO, 'scripts/surface.mjs'), join(REPO, CONSUMER_SRC)],
      { cwd: REPO, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, `surface.mjs is red:\n${result.stdout}${result.stderr}`);
  });

  test('the three seamed libraries are reached through their seam, never around it', () => {
    // fields: the consumer writes fill() and formValues(); readForm() and its peers are the adapter's.
    assert.match(anywhere, /\bfill\(/, 'fill() writes the form');
    assert.match(anywhere, /\bformValues\(/, 'formValues() reads it back');
    for (const past of ['readForm', 'writeForm', 'readField', 'writeField', 'FieldTracker']) {
      const offenders = consumer.filter((f) => new RegExp(`\\b${past}\\b`).test(f.code)).map((f) => f.file);
      assert.deepEqual(offenders, [], `${past} is the form seam's: a component reaching it goes around the seam`);
    }
    // router: href() and the RouteChanged event; never the RouteTable or the HistoryRouter.
    assert.match(anywhere, /routes\.href\(/, 'the consumer builds URLs through the routing seam');
    for (const past of ['RouteTable', 'HistoryRouter']) {
      assert.deepEqual(consumer.filter((f) => new RegExp(`\\b${past}\\b`).test(f.code)).map((f) => f.file), [], `${past} is the framework's to wire`);
    }
    // templates: the html tag and behavior(); never morph() or the serializer.
    assert.match(anywhere, /\bhtml`/, 'the consumer renders through the html tag');
    assert.match(anywhere, /\bbehavior\(/, 'and extends it with a behaviour of its own');
    for (const past of ['morph', 'ViewResult', 'ElementBehavior']) {
      assert.deepEqual(consumer.filter((f) => new RegExp(`\\b${past}\\b`).test(f.code)).map((f) => f.file), [], `${past} is the rendering seam's`);
    }
  });

  test('every CSS engine has a call site in the consumer', () => {
    for (const engine of ['templates', 'theme', 'layout', 'responsive', 'animation', 'effects', 'semantics']) {
      const direct = new RegExp(`\\b${engine}\\.[a-zA-Z]`).test(anywhere);
      // css-templates is reached through the framework's css tag rather than by name.
      const reached = engine === 'templates' ? /\bcss`/.test(anywhere) || direct : direct;
      assert.ok(reached, `no call site for the ${engine} engine under ${CONSUMER_SRC}`);
    }
  });
});

// ---- What counts as writing the model ----
//
// Read only `=` and `this.model.ticks += 1` is invisible: the rule that says a change must be
// stated stops seeing the change. Found by scaffolding a new application with `vanilla-mvc init`,
// whose one handler happens to use `+=`, and watching the rule report zero handlers.

suite('writesModel', () => {
  test('every assignment form is a write', () => {
    for (const code of [
      'this.model.x = 1;',
      'this.model.ticks += 1;',
      'this.model.left -= 1;',
      'this.model.n *= 2;',
      'this.model.flag ||= true;',
      'this.model.v ??= 2;',
      'this.model.n++;',
      'this.model.n--;',
      'Object.assign(this.model, next);',
      'const m = this.model;\n  m.rows += 1;',
    ]) {
      assert.equal(writesModel(code), true, code);
    }
  });

  test('a comparison is not a write', () => {
    for (const code of [
      'if (this.model.x === 1) return;',
      'if (this.model.x == 1) return;',
      'if (this.model.x != 1) return;',
      'if (this.model.x <= 1) return;',
      'if (this.model.x >= 1) return;',
      'return this.model.rows.length;',
    ]) {
      assert.equal(writesModel(code), false, code);
    }
  });
});
