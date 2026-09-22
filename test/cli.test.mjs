// The CLI, which is how an application that is not this repository gets built.
//
// `init` is the only thing here that produces source, so it is the only thing worth a slow test:
// the scaffold is compiled with this repo's own tsc against this repo's own dist. If the shell it
// writes stops compiling, every new application starts broken and nothing else would say so.
import { test, suite } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applicationRules } from '../architecture/rules.mjs';
import { chromePath, launch, serve } from '../testing/index.mjs';
import { after } from 'node:test';
import { access } from 'node:fs/promises';

const REPO = join(import.meta.dirname, '..');
const CLI = join(REPO, 'bin', 'vanilla-mvc.mjs');

/** Run the CLI in `cwd` and give back its status and output together. */
const cli = (cwd, ...args) => {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
};

/** A temp directory with this repo installed as node_modules/vanilla-mvc, the way a consumer has it. */
const consumer = () => {
  const dir = mkdtempSync(join(tmpdir(), 'vanilla-mvc-cli-'));
  mkdirSync(join(dir, 'node_modules'));
  symlinkSync(REPO, join(dir, 'node_modules', 'vanilla-mvc'));
  return dir;
};

suite('vanilla-mvc init', () => {
  test('the scaffold it writes compiles against the framework it scaffolds for', () => {
    const dir = consumer();
    try {
      const made = cli(dir, 'init', '--name', 'notes-app');
      assert.equal(made.status, 0, made.out);

      // tsc needs to resolve 'vanilla-mvc' from the scaffold, and the repo's own tsconfig shape.
      const tsc = spawnSync(process.execPath, [join(REPO, 'node_modules', 'typescript', 'bin', 'tsc')], {
        cwd: dir,
        encoding: 'utf8',
      });
      assert.equal(tsc.status, 0, `the scaffolded application does not compile:\n${tsc.stdout}${tsc.stderr}`);
      assert.ok(existsSync(join(dir, 'dist', 'main.js')), 'it emits the entry index.html asks for');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('the import map it writes names every entry the package exports', () => {
    const dir = consumer();
    try {
      cli(dir, 'init', '--name', 'notes-app');
      const html = readFileSync(join(dir, 'index.html'), 'utf8');
      const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
      // ./testing and ./architecture are Node tooling — they read the filesystem and spawn
      // processes — so they belong in a test runner, never in a browser's import map. Everything
      // else a consumer imports from source has to be resolvable in the page.
      const NODE_ONLY = ['./testing', './architecture'];
      const exported = Object.keys(JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')).exports)
        .filter((e) => ![...NODE_ONLY, './dist/*', './package.json'].includes(e))
        .map((e) => (e === '.' ? 'vanilla-mvc' : `vanilla-mvc/${e.slice(2)}`));
      for (const name of exported) {
        assert.ok(map.imports[name], `the import map has no entry for ${name}, so a browser cannot resolve it`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('it refuses a directory that already holds an application, and writes nothing', () => {
    const dir = consumer();
    try {
      writeFileSync(join(dir, 'tsconfig.json'), '{}');
      const refused = cli(dir, 'init');
      assert.equal(refused.status, 1);
      assert.match(refused.out, /already has an application/);
      assert.equal(readFileSync(join(dir, 'tsconfig.json'), 'utf8'), '{}', 'it left the file alone');
      assert.ok(!existsSync(join(dir, 'src')), 'and wrote no source');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

suite('vanilla-mvc vendor and theme-css', () => {
  test('vendor copies the compiled tree, stamps it, and --check reads the stamp', () => {
    const dir = consumer();
    try {
      assert.equal(cli(dir, 'vendor').status, 0);
      assert.ok(existsSync(join(dir, 'vendor', 'framework', 'index.js')), 'the framework entry is there');
      assert.ok(existsSync(join(dir, 'vendor', 'libraries', 'css', 'index.js')), 'and the css library');
      assert.equal(cli(dir, 'vendor', '--check').status, 0);

      writeFileSync(join(dir, 'vendor', '.version'), 'vanilla-mvc@0.0.0-stale\n');
      const stale = cli(dir, 'vendor', '--check');
      assert.equal(stale.status, 1);
      assert.match(stale.out, /0\.0\.0-stale/, 'it says what it found, not just that it is wrong');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('theme-css writes the engine tokens, and --check fails when the file drifts', () => {
    const dir = consumer();
    try {
      assert.equal(cli(dir, 'theme-css').status, 0);
      const css = readFileSync(join(dir, 'theme.css'), 'utf8');
      assert.ok(css.split('\n').length > 50, 'it is the tokens, not a stub');
      assert.equal(cli(dir, 'theme-css', '--check').status, 0);

      writeFileSync(join(dir, 'theme.css'), `${css}/* edited by hand */\n`);
      const stale = cli(dir, 'theme-css', '--check');
      assert.equal(stale.status, 1);
      assert.match(stale.out, /stale/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('an accent palette is emitted for the selector asked for', () => {
    const dir = consumer();
    try {
      cli(dir, 'theme-css', '--accent', '.page.optimize');
      assert.match(readFileSync(join(dir, 'theme.css'), 'utf8'), /\.page\.optimize/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

test('a command nobody has says so, and names the ones that exist', () => {
  const dir = consumer();
  try {
    const r = cli(dir, 'frobnicate');
    assert.equal(r.status, 1);
    assert.match(r.out, /init, add, rules, guide, check, vendor, theme-css/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The scaffold obeys the framework's own rules.
//
// It did not, once: its one handler wrote the model directly, which is the thing this framework
// exists to stop. Every application that ran `init` would have started from that shape. The rules
// ship now, so the scaffold is held to them here.

const SCAFFOLD = (() => {
  const dir = mkdtempSync(join(tmpdir(), 'vanilla-mvc-scaffold-'));
  mkdirSync(join(dir, 'node_modules'));
  symlinkSync(REPO, join(dir, 'node_modules', 'vanilla-mvc'));
  // init, then one of everything `add` makes: the rules below judge the generated files too.
  for (const args of [
    ['init', '--name', 'ledger'],
    ['add', 'component', 'note-list'],
    ['add', 'component', 'NoteRow', '--no-style'],
    ['add', 'event', 'NoteSaved'],
    ['add', 'capability', 'notes'],
  ]) {
    const r = spawnSync(process.execPath, [CLI, ...args], { cwd: dir, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`${args.join(' ')} failed: ${r.stdout}${r.stderr}`);
  }
  return dir;
})();

process.on('exit', () => rmSync(SCAFFOLD, { recursive: true, force: true }));

applicationRules({
  test,
  assert,
  base: SCAFFOLD,
  root: 'src',
  app: 'src/',
  within: ['vanilla-mvc', 'src/'],
  libraries: 'vanilla-mvc/',
  styling: { folder: 'vanilla-mvc/css', from: /\.(template|style)\.ts$/ },
  events: ['src/events'],
  // The floors a one-screen scaffold can meet. Raise them if init grows.
  atLeast: { models: 1, events: 1, controllers: 1, handlers: 1, waits: 0, calls: 0, tags: 0 },
});

// And it runs.
//
// The rules above, and tsc, both passed on a scaffold whose one gesture threw on every click:
// the capability was pushed into `children` without a parent, so it had no bus. Nothing short of
// running it in a browser would have said so. This does that — build it, serve it, click it,
// and require the number to move with no error and no warning on the console.

const chrome = chromePath();
const hasChrome = await access(chrome).then(() => true, () => false);

suite('the scaffold runs', { skip: !hasChrome && `no Chrome at ${chrome}` }, () => {
  /** @type {any} */ let server;
  /** @type {any} */ let browser;

  after(async () => {
    await browser?.close().catch(() => {});
    await server?.stop().catch(() => {});
  });

  test('a fresh application builds, boots, and its gesture reaches the model', async () => {
    const built = spawnSync(process.execPath, [join(REPO, 'node_modules', 'typescript', 'bin', 'tsc')], {
      cwd: SCAFFOLD,
      encoding: 'utf8',
    });
    assert.equal(built.status, 0, `${built.stdout}${built.stderr}`);
    assert.equal(cli(SCAFFOLD, 'vendor').status, 0);
    assert.equal(cli(SCAFFOLD, 'theme-css').status, 0);

    server = await serve({ args: ['server.mjs'], env: { PORT: '0' }, cwd: SCAFFOLD });
    browser = await launch();
    const page = await browser.newPage();
    await page.goto(server.url.replace('//localhost', '//127.0.0.1'));
    await page.evaluate("window.__warn = []; const w = console.warn; console.warn = (...a) => { window.__warn.push(a.join(' ')); w(...a); };");
    await page.waitFor('h1');

    assert.equal(await page.text('button'), 'ticks: 0');
    for (let i = 0; i < 3; i++) await page.click('button');
    assert.equal(await page.text('button'), 'ticks: 3', 'the gesture reached the domain and came back as a fact');

    assert.deepEqual(page.errors(), [], 'the page raised nothing');
    assert.deepEqual(JSON.parse(await page.evaluate('JSON.stringify(window.__warn)')), [], 'and nothing went undrawn');
  });
});

suite('vanilla-mvc add', () => {
  test('it writes the files under the names the rules expect', () => {
    for (const path of [
      'src/components/note-list/note-list.model.ts',
      'src/components/note-list/note-list.controller.ts',
      'src/components/note-list/note-list.template.ts',
      'src/components/note-list/note-list.component.ts',
      'src/components/note-list/note-list.style.ts',
      'src/components/note-row/note-row.component.ts',
      'src/events/note-saved.ts',
      'src/application/notes.ts',
    ]) {
      assert.ok(existsSync(join(SCAFFOLD, path)), path);
    }
    assert.ok(!existsSync(join(SCAFFOLD, 'src/components/note-row/note-row.style.ts')), '--no-style writes no style');
    assert.match(readFileSync(join(SCAFFOLD, 'src/events/note-saved.ts'), 'utf8'), /readonly type: 'NoteSaved';/);
    assert.match(readFileSync(join(SCAFFOLD, 'src/components/note-row/note-row.component.ts'), 'utf8'), /class NoteRowComponent/);
  });

  test('everything it writes compiles', () => {
    const tsc = spawnSync(process.execPath, [join(REPO, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit'], { cwd: SCAFFOLD, encoding: 'utf8' });
    assert.equal(tsc.status, 0, `${tsc.stdout}${tsc.stderr}`);
  });

  test('it refuses to overwrite, and writes nothing when it refuses', () => {
    const model = join(SCAFFOLD, 'src/components/note-list/note-list.model.ts');
    const before = readFileSync(model, 'utf8');
    const r = cli(SCAFFOLD, 'add', 'component', 'note-list');
    assert.equal(r.status, 1);
    assert.match(r.out, /already exists\. Nothing was written/);
    assert.equal(readFileSync(model, 'utf8'), before);
  });

  test('a name that is not a name is refused', () => {
    const r = cli(SCAFFOLD, 'add', 'event', 'no spaces');
    assert.equal(r.status, 1);
  });
});

suite('the guide an agent reads', () => {
  test('init writes AGENTS.md, a CLAUDE.md that imports it, and the architecture test', () => {
    assert.ok(existsSync(join(SCAFFOLD, 'AGENTS.md')));
    assert.equal(readFileSync(join(SCAFFOLD, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n', 'one text, not two');
    assert.ok(existsSync(join(SCAFFOLD, 'test', 'architecture.test.mjs')));
  });

  test('the guide leads with the mistake that compiles and draws nothing, and states every rule', async () => {
    const guide = readFileSync(join(SCAFFOLD, 'AGENTS.md'), 'utf8');
    const { RULES } = await import('../architecture/rules.mjs');
    assert.ok(guide.indexOf("c.handler('save')") < guide.indexOf('## The rules'), 'the handler rule comes before the list');
    for (const rule of RULES) assert.ok(guide.includes(rule.says), `the guide states: ${rule.says}`);
  });

  test('guide --check passes on what init wrote, and fails once it drifts', () => {
    assert.equal(cli(SCAFFOLD, 'guide', '--check').status, 0);
    const path = join(SCAFFOLD, 'AGENTS.md');
    const text = readFileSync(path, 'utf8');
    writeFileSync(path, `${text}\nedited by hand\n`);
    try {
      const stale = cli(SCAFFOLD, 'guide', '--check');
      assert.equal(stale.status, 1);
      assert.match(stale.out, /stale/);
    } finally {
      writeFileSync(path, text);
    }
  });

  test('the architecture test init writes runs green on what init and add wrote', () => {
    // A test runner started inside a test inherits NODE_TEST_CONTEXT and reports to its parent in a
    // machine format instead of printing; without it, this child reports the way an author sees it.
    const { NODE_TEST_CONTEXT, ...env } = process.env;
    const r = spawnSync(process.execPath, ['--test', 'test/architecture.test.mjs'], { cwd: SCAFFOLD, encoding: 'utf8', env });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /pass 16\b/);
  });

  test('rules prints every rule with a wrong and a right example', async () => {
    const r = cli(SCAFFOLD, 'rules');
    const { RULES } = await import('../architecture/rules.mjs');
    assert.equal(r.status, 0);
    assert.equal((r.out.match(/^Wrong:$/gm) ?? []).length, RULES.length);
  });
});

test('RULES.md is what the rule records say today', async () => {
  const { rulesMarkdown } = await import('../architecture/guide.mjs');
  assert.equal(readFileSync(join(REPO, 'RULES.md'), 'utf8'), rulesMarkdown(), 'RULES.md is stale: npm run rules:md');
});

suite('vanilla-mvc check, and the hook init wires it to', () => {
  const hook = (file) =>
    spawnSync(process.execPath, [CLI, 'check', '--hook'], {
      cwd: SCAFFOLD,
      encoding: 'utf8',
      input: JSON.stringify({ cwd: SCAFFOLD, tool_name: 'Edit', tool_input: { file_path: join(SCAFFOLD, file) } }),
    });
  const CONTROLLER = 'src/components/home-page/home-page.controller.ts';

  test('init wires a PostToolUse command hook on edits, and it cds itself', () => {
    const settings = JSON.parse(readFileSync(join(SCAFFOLD, '.claude', 'settings.json'), 'utf8'));
    const [entry] = settings.hooks.PostToolUse;
    assert.equal(entry.matcher, 'Edit|Write|MultiEdit');
    assert.equal(entry.hooks[0].type, 'command');
    assert.match(entry.hooks[0].command, /^cd "\$\{CLAUDE_PROJECT_DIR:-\.\}" && node node_modules\/vanilla-mvc\/bin\/vanilla-mvc\.mjs check --hook$/);
  });

  test('a clean edit says nothing and exits 0', () => {
    const r = hook(CONTROLLER);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr, '');
  });

  test('an edit that breaks a rule exits 2 — feedback to the agent — naming the rule, the file and the fix', () => {
    const path = join(SCAFFOLD, CONTROLLER);
    const before = readFileSync(path, 'utf8');
    writeFileSync(path, before.replace('  #tick(): void {', '  reset(): void {}\n\n  #tick(): void {'));
    try {
      const r = hook(CONTROLLER);
      assert.equal(r.status, 2);
      assert.match(r.stderr, /breaks 1 architecture rule/);
      assert.match(r.stderr, /at: src\/components\/home-page\/home-page\.controller\.ts/);
      assert.match(r.stderr, /right:/);
    } finally {
      writeFileSync(path, before);
    }
  });

  test('a rule broken elsewhere is not this edit\'s', () => {
    const path = join(SCAFFOLD, CONTROLLER);
    const before = readFileSync(path, 'utf8');
    writeFileSync(path, before.replace('  #tick(): void {', '  reset(): void {}\n\n  #tick(): void {'));
    try {
      assert.equal(hook('src/events/ticks-changed.ts').status, 0);
    } finally {
      writeFileSync(path, before);
    }
  });

  test('a file that is not TypeScript source is skipped', () => {
    assert.equal(hook('AGENTS.md').status, 0);
  });
});
