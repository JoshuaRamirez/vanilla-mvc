// What a consumer does not exercise.
//
// Every value exported from a library's public index is one of four things. Only the last is a
// gap: the consuming application is the forcing function, so an authoring surface with no consumer in
// a consumer is surface nobody has had to defend.
//
//   metadata   tables an engine publishes about itself — `properties`, `attributes`, the name
//              arrays. Tests and tooling read them; an application never does.
//   guard      `assert*` and the error types: exported so an author gets the engine's own message.
//   mechanism  what an adapter or the framework calls on the application's behalf. An application
//              that called these directly would be reaching through a seam.
//   authoring  what a *.style.ts, *.template.ts or controller is meant to call.
//
// A consumer is anything the consumer is built from: a consumer, and the scripts that generate its
// assets out of the same libraries.
//
// `node scripts/surface.mjs` prints the authoring surface with no call site; `--all` prints every
// category. Comments are stripped before the search, so a word in prose is not a call site.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir) => readdirSync(dir).flatMap((e) => {
  const p = join(dir, e);
  return statSync(p).isDirectory() ? walk(p) : /\.(ts|mjs|js)$/.test(p) ? [p] : [];
});

/**
 * Every public index in the tree, discovered rather than listed. A hand-written list is how
 * `src/libraries/fields` went unaudited: the entry pointed at a folder that had been renamed, the
 * lookup failed quietly, and nine exports were never counted. Nothing here may fail quietly.
 */
const INDEXES = [
  ...walk('src/libraries')
    .filter((p) => p.endsWith('index.ts'))
    .map((p) => [p.replace(/^src\/libraries\//, '').replace(/\/index\.ts$/, ''), p])
    .filter(([label]) => label !== 'css'), // the css root re-exports the engines; each is audited on its own
  ['framework', 'src/framework/index.ts'],
];

/** Names that are not authoring surface, and why. Anything not here is authoring. */
const KIND = {
  metadata: [
    /^properties$/, /^attributes$/, /^NAMES$/, /^KNOBS$/, /^DEFAULTS$/, /^LIST$/, /^LISTABLE$/,
    /Roles$/, /Names$/, /Steps$/, /Tokens$/, /^aligns$/, /^justifies$/, /^repeats$/, /^sides$/,
    /^options$/, /^primitives$/, /^carriers$/, /^containments$/, /^fallbacks$/, /^faults$/,
    /^palettes$/, /^derivation$/, /^onAccentThreshold$/, /^vocabulary$/, /^keyframeNames$/,
    /^scaleDefaults$/, /^scaleNumbers$/, /^scaleValues$/, /^fluidDefaults$/, /^breakpoints$/,
    /^defaultCap$/, /^staggerLimit$/, /^elevationSteps$/, /^knobDefaults$/, /^knobProperty$/,
    /^restartable$/, /^stateful$/, /^specKeys$/, /^describe$/, /^descriptions$/, /Properties$/,
    /^stepRules$/, /^resolvePalette$/, /^lengthText$/, /^ident$/,
    // Tables another engine reads, or that a guard is the authoring form of.
    /^shadowDefaults$/, /^discrete$/, /^states$/, /^keyframes$/,
  ],
  guard: [/^assert/, /Error$/],
  mechanism: [
    /^analyze$/, /^serialize$/, /^escape$/, /^morph$/, /^idOf$/, /^scoped$/, /^release$/,
    /^adapters$/, /^useAdapters$/, /^defaultAdapters$/, /^establishDomain$/, /^establishedDomain$/,
    /^EventBus$/, /^ChangeEngine$/, /^CssStyling$/, /^TemplatesRenderer$/, /^RouterRouting$/,
    /^FieldsAccess$/, /^Router$/, /^HistoryRouter$/, /^RouteTable$/, /^StyleResult$/,
    /^ElementBehavior$/, /^ViewResult$/, /^RouteChange$/, /^changes$/,
    // libraries/fields is reached through the form seam and nowhere else: a component writes
    // `fill(values)` and `formValues(handler)`, and the IFormAccess adapter is the only caller of
    // what is below. A template that called readForm() itself would be reaching past the seam,
    // which is the one thing the seam exists to prevent — so these are not surface the consumer may
    // exercise, however many of them there are.
    /^readForm$/, /^writeForm$/, /^readField$/, /^writeField$/, /^FieldTracker$/,
    /^fieldsOf$/, /^isField$/, /^isGrouped$/, /^readDefault$/, /^keyOf$/,
  ],
};
const kindOf = (name) => {
  for (const [kind, patterns] of Object.entries(KIND)) if (patterns.some((r) => r.test(name))) return kind;
  return 'authoring';
};


const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
/**
 * A consumer is any directory of source built on these libraries — an application's `src`, and the
 * scripts that generate its assets from the same engines. A generator that emits a stylesheet is as
 * much a consumer as a *.style.ts.
 *
 * The consumers are named on the command line, because the application that exercises this
 * framework is no longer in this repository:
 *
 *   npm run surface -- ../my-app/src \
 *                      ../my-app/scripts
 */
const ROOTS = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (ROOTS.length === 0) {
  console.error(
    'surface.mjs needs at least one consumer directory: the application source that exercises these\n' +
    'libraries. Without one every authoring export reads as cold, which says nothing.\n\n' +
    '  npm run surface -- ../my-app/src',
  );
  process.exit(2);
}
// The framework's own CLI is a consumer too: `vanilla-mvc theme-css` emits the theme engine's
// tokens as a file, and those *Text forms have no other call site. It is always scanned.
const OWN = ['bin'];
const CONSUMERS = [...OWN, ...ROOTS].flatMap((root) => {
  try {
    return walk(root);
  } catch {
    console.error(`surface.mjs: no such consumer directory: ${root}`);
    process.exit(2);
  }
});
const SAMPLE = strip(CONSUMERS.map((p) => readFileSync(p, 'utf8')).join('\n'));

const valuesOf = (index) => {
  const text = readFileSync(index, 'utf8');
  const names = new Set();
  for (const [, body] of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const raw of body.split(',')) {
      const part = raw.trim();
      if (!part || part.startsWith('type ')) continue;
      const name = (part.split(/\s+as\s+/).pop() || '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  for (const [, name] of text.matchAll(/^export\s+(?:const|function|class)\s+([A-Za-z_$][\w$]*)/gm)) names.add(name);
  return [...names].sort();
};

/**
 * A call site, not a mention. Three forms count, and an options key does not: `engine.name` for the
 * namespace imports, `name(` for a call, and `{ name }` for a destructured import. Without this,
 * `{ duration: 'fast' }` would report `animation.duration` as exercised — the word is there, the
 * call is not.
 */
const usedIn = (_label, name) =>
  new RegExp(`\\.${name}\\b`).test(SAMPLE) ||
  new RegExp(`\\b${name}\\s*\\(`).test(SAMPLE) ||
  new RegExp(`[{,]\\s*${name}\\s*[,}]`).test(SAMPLE);

const all = process.argv.includes('--all');
const cold = [];
let authoring = 0, warm = 0;
for (const [label, index] of INDEXES) {
  const names = valuesOf(index); // a missing index throws: an unaudited library is the bug this tool exists to catch
  for (const name of names) {
    const kind = kindOf(name);
    const used = usedIn(label, name);
    if (kind === 'authoring') { authoring++; if (used) warm++; else cold.push([label, name]); }
    if (all && !used) console.log(`  ${kind.padEnd(10)} ${label}.${name}`);
  }
}
/**
 * Every library the consumer reaches, and how. A library with a seam is reached *through* it: the
 * consumer writes `fill()` and never `readForm()`, and that is the point of the seam, not a gap. A
 * library nothing reaches at all is the gap this check is for.
 */
const REACHED = [
  ['css/templates', 'through the styling seam: `css`, `Style` and `styled` off the framework index'],
  ['css/theme', 'directly: `theme.*` in style files, and the *Text forms from `vanilla-mvc theme-css`'],
  ['css/layout', 'directly: `layout.*` in style files, and `data-layout` in templates'],
  ['css/responsive', 'directly: `responsive.*` in style files'],
  ['css/animation', 'directly: `animation.*` in style files'],
  ['css/effects', 'directly: `effects.*` in style files, and `data-fx` in templates'],
  ['css/semantics', 'directly: `semantics.*Attributes()` written with `attrs()`'],
  ['fields', 'through the form seam: `fill(values)` and `formValues(handler)`'],
  ['router', 'through the routing seam: `routes.href()` and `RouteChanged`'],
  ['templates', 'through the rendering seam: the `html` tag and `behavior()`'],
];
const MISSING = REACHED.filter(([label]) => !INDEXES.some(([l]) => l === label));
if (MISSING.length) {
  console.error(`surface.mjs names a library that no longer exists: ${MISSING.map(([l]) => l).join(', ')}`);
  process.exit(2);
}
const UNNAMED = INDEXES.filter(([l]) => l !== 'framework').filter(([l]) => !REACHED.some(([r]) => r === l));
if (UNNAMED.length) {
  console.error(`a library nothing accounts for: ${UNNAMED.map(([l]) => l).join(', ')} — say how the consumer reaches it.`);
  process.exit(2);
}
console.log('\nEvery library, and how the consumer reaches it:');
for (const [label, how] of REACHED) console.log(`  ${label.padEnd(16)} ${how}`);

console.log(`\nauthoring surface: ${authoring}   exercised: ${warm}   cold: ${cold.length}\n`);
let last = '';
for (const [label, name] of cold) {
  if (label !== last) { console.log(`${label}`); last = label; }
  console.log(`  ${name}`);
}
process.exit(cold.length ? 1 : 0);
