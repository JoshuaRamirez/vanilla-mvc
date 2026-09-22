// The readers the architecture rules are written in, on TypeScript's syntax tree.
//
// They were regular expressions over source text, and the rules built on them were wrong in both
// directions: blind to `+=`, to `subscribe<T>(`, to a registration or a return written across
// lines, to a dynamic import; and alarmed by a comment that mentioned `children.push`. A syntax
// tree has no comments in it and no line breaks that matter, so each of those stops being a case.
//
// The parser is TypeScript 5's `createSourceFile`, installed under the alias `typescript5`. It is
// the one API TypeScript has kept stable for a decade, and it parses in-process. TypeScript 7 — the
// native compiler this repository builds with — exposes only an `unstable/` API behind a child
// process, and a rule set should not rest on something its authors call unstable.
import { createRequire } from 'node:module';

/**
 * The parser is a peer, not a dependency: the framework itself has none, and an application that
 * never runs these rules should not install a compiler for them. Resolved from the application,
 * so the one it installed is the one used.
 */
let ts;
let K;

/** Load the parser the first time anything is parsed: printing the rules needs no parser. */
function load() {
  if (ts) return;
  ts = (() => {
  try {
    return createRequire(`${process.cwd()}/`)('typescript5');
  } catch {
    try {
      return createRequire(import.meta.url)('typescript5');
    } catch {
      throw new Error(
        'vanilla-mvc/architecture reads source with TypeScript 5\'s parser, installed under the name typescript5:\n' +
          '  npm install --save-dev typescript5@npm:typescript@~5.9.3',
      );
    }
  }
  })();
  K = ts.SyntaxKind;
  ASSIGNMENT = new Set([
    K.EqualsToken, K.PlusEqualsToken, K.MinusEqualsToken, K.AsteriskEqualsToken, K.AsteriskAsteriskEqualsToken,
    K.SlashEqualsToken, K.PercentEqualsToken, K.LessThanLessThanEqualsToken, K.GreaterThanGreaterThanEqualsToken,
    K.GreaterThanGreaterThanGreaterThanEqualsToken, K.AmpersandEqualsToken, K.BarEqualsToken, K.CaretEqualsToken,
    K.BarBarEqualsToken, K.AmpersandAmpersandEqualsToken, K.QuestionQuestionEqualsToken,
  ]);
  FUNCTION_LIKE = new Set([K.ArrowFunction, K.FunctionExpression, K.FunctionDeclaration, K.MethodDeclaration, K.Constructor, K.GetAccessor, K.SetAccessor]);
  EXPORTED = new Set([K.InterfaceDeclaration, K.TypeAliasDeclaration, K.ClassDeclaration, K.FunctionDeclaration, K.VariableStatement, K.EnumDeclaration]);
}

const parsed = new Map();

/** The syntax tree of `text`, parsed once per distinct text. */
export function parse(text, file = 'source.ts') {
  load();
  const key = `${file}\0${text}`;
  let tree = parsed.get(key);
  if (!tree) {
    tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    parsed.set(key, tree);
    if (parsed.size > 2000) parsed.delete(parsed.keys().next().value);
  }
  return tree;
}

/** Every node under `node`, depth first. */
export function* walk(node) {
  yield node;
  for (const child of node.getChildren()) yield* walk(child);
}

/** The line `node` starts on, counting from 1. */
export const lineOf = (node) => node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1;

/** `x` with parentheses, `as`, `!` and `satisfies` taken off. */
export function bare(node) {
  while (
    node &&
    (node.kind === K.ParenthesizedExpression ||
      node.kind === K.AsExpression ||
      node.kind === K.NonNullExpression ||
      node.kind === K.SatisfiesExpression ||
      node.kind === K.TypeAssertionExpression)
  ) {
    node = node.expression;
  }
  return node;
}

const isThis = (node) => bare(node)?.kind === K.ThisKeyword;

/** `this.<name>`, or `this.#<name>` when `name` starts with #. */
export function isThisMember(node, name) {
  node = bare(node);
  return node?.kind === K.PropertyAccessExpression && isThis(node.expression) && node.name.getText() === name;
}

/** The name of `this.#x`, without the #, or null. */
export function privateOfThis(node) {
  node = bare(node);
  if (node?.kind !== K.PropertyAccessExpression || !isThis(node.expression)) return null;
  return node.name.kind === K.PrivateIdentifier ? node.name.getText().slice(1) : null;
}

// ---- imports ----

/** Every module a file depends on: import, export-from, dynamic import(), and import('x') in a type. */
export function importsIn(text) {
  const out = [];
  for (const node of walk(parse(text))) {
    if ((node.kind === K.ImportDeclaration || node.kind === K.ExportDeclaration) && node.moduleSpecifier) {
      out.push(node.moduleSpecifier.text);
    } else if (node.kind === K.CallExpression && node.expression.kind === K.ImportKeyword) {
      const [first] = node.arguments;
      if (first && ts.isStringLiteralLike(first)) out.push(first.text);
    } else if (node.kind === K.ImportType && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      out.push(node.argument.literal.text);
    }
  }
  return out;
}

/** Every named import: the module, and the names as the module exports them (before any `as`). */
export function namedImportsIn(text) {
  const out = [];
  for (const node of parse(text).statements) {
    if (node.kind !== K.ImportDeclaration) continue;
    const bindings = node.importClause?.namedBindings;
    if (!bindings || bindings.kind !== K.NamedImports) continue;
    out.push({
      specifier: node.moduleSpecifier.text,
      names: bindings.elements.map((e) => (e.propertyName ?? e.name).text),
    });
  }
  return out;
}

// ---- classes ----

const hasModifier = (node, kind) => (ts.canHaveModifiers(node) ? ts.getModifiers(node) ?? [] : []).some((m) => m.kind === kind);

/** The file's exported class, else its first class, else null. */
export function classIn(text) {
  const classes = parse(text).statements.filter((s) => s.kind === K.ClassDeclaration);
  return classes.find((c) => hasModifier(c, K.ExportKeyword)) ?? classes[0] ?? null;
}

/** The source text of the file's class — what a member rule reads, and never a helper below it. */
export function classBodyOf(text) {
  const cls = classIn(text);
  return cls ? cls.getText() : text;
}

const memberName = (member) => (member.name ? member.name.getText().replace(/^#/, '') : '');

/** Every method of the class with a body: { name (no #), private, node, body }. */
export function methodsOf(text) {
  const cls = classIn(text);
  if (!cls) return [];
  return cls.members
    .filter((m) => (m.kind === K.MethodDeclaration || m.kind === K.GetAccessor || m.kind === K.SetAccessor) && m.body)
    .map((m) => ({ name: memberName(m), private: m.name.kind === K.PrivateIdentifier, node: m.body, body: m.body.getText() }));
}

/** The private methods only. */
export const privateMethods = (text) => methodsOf(text).filter((m) => m.private);

/**
 * The members a controller must not have: anything public of its own. A public member is one with
 * a plain name and no `protected` or `private`: a method, an accessor or a property. The
 * constructor is not a member in this sense.
 */
export function publicMembers(text) {
  const cls = classIn(text);
  if (!cls) return [];
  return cls.members
    .filter((m) => m.kind === K.MethodDeclaration || m.kind === K.GetAccessor || m.kind === K.SetAccessor || m.kind === K.PropertyDeclaration)
    .filter((m) => m.name && m.name.kind !== K.PrivateIdentifier)
    .filter((m) => !hasModifier(m, K.ProtectedKeyword) && !hasModifier(m, K.PrivateKeyword))
    .map(memberName);
}

/** Every `this.subscribe(...)` / `this.handle(...)`: { kind, target } where target is the #method's name, or null. */
export function registrationsIn(text) {
  const out = [];
  for (const node of walk(parse(text))) {
    if (node.kind !== K.CallExpression) continue;
    for (const kind of ['subscribe', 'handle']) {
      if (!isThisMember(node.expression, kind)) continue;
      out.push({ kind, target: privateOfThis(node.arguments[1]), line: lineOf(node), text: node.getText() });
    }
  }
  return out;
}

/** The #methods registered with this.subscribe(...) or this.handle(...). */
export const registeredWith = (text, kind) => new Set(registrationsIn(text).filter((r) => r.kind === kind && r.target).map((r) => r.target));

/** The class's methods called from `node`: this.#x() and this.x(). */
export function calledMethods(node, methods) {
  const out = new Set();
  for (const n of walk(node)) {
    if (n.kind !== K.CallExpression) continue;
    const callee = bare(n.expression);
    if (callee?.kind !== K.PropertyAccessExpression || !isThis(callee.expression)) continue;
    const name = callee.name.getText().replace(/^#/, '');
    if (methods.has(name)) out.add(name);
  }
  return out;
}

/** Whether `node` calls this.changed(). */
export const statesChange = (node) => [...walk(node)].some((n) => n.kind === K.CallExpression && isThisMember(n.expression, 'changed'));

// ---- writing the model ----

/** Every assignment operator, set once the parser is loaded. */
let ASSIGNMENT;

/** Whether an access chain starts at this.model, or at a local that was assigned this.model. */
function rootedAtModel(node, aliases) {
  node = bare(node);
  while (node && (node.kind === K.PropertyAccessExpression || node.kind === K.ElementAccessExpression)) {
    if (isThisMember(node, 'model')) return true;
    node = bare(node.expression);
  }
  return node?.kind === K.Identifier && aliases.has(node.text);
}

/**
 * Whether `input` — source text, or a node — writes the component's model: any assignment
 * (`=`, `+=`, `||=` and the rest) or `++`/`--` to this.model or anything under it, or
 * Object.assign(this.model, …). A comparison is not a write, and neither is a comment.
 */
export function writesModel(input) {
  const root = typeof input === 'string' ? parse(input) : input;
  const aliases = new Set();
  for (const n of walk(root)) {
    if (n.kind === K.VariableDeclaration && n.name.kind === K.Identifier && n.initializer && isThisMember(n.initializer, 'model')) {
      aliases.add(n.name.text);
    }
  }
  for (const n of walk(root)) {
    if (n.kind === K.BinaryExpression && ASSIGNMENT.has(n.operatorToken.kind) && rootedAtModel(n.left, aliases)) return true;
    if ((n.kind === K.PrefixUnaryExpression || n.kind === K.PostfixUnaryExpression) &&
      (n.operator === K.PlusPlusToken || n.operator === K.MinusMinusToken) && rootedAtModel(n.operand, aliases)) {
      return true;
    }
    const target = n.kind === K.CallExpression && n.expression.getText() === 'Object.assign' ? n.arguments[0] : null;
    if (target && (isThisMember(target, 'model') || rootedAtModel(target, aliases))) return true;
  }
  return false;
}

// ---- promises ----

const isPromiseType = (type) => type?.kind === K.TypeReference && type.typeName.getText() === 'Promise';

/** Every method that hands back a promise, as `<Class>.<method>`: async, or declared `: Promise<…>`. */
export function waitsIn(files) {
  const waits = new Set();
  for (const { text } of files) {
    const cls = classIn(text);
    if (!cls?.name) continue;
    for (const m of cls.members) {
      if (m.kind !== K.MethodDeclaration || !m.name) continue;
      if (hasModifier(m, K.AsyncKeyword) || isPromiseType(m.type)) waits.add(`${cls.name.text}.${memberName(m)}`);
    }
  }
  return waits;
}

const typeName = (type) => (type?.kind === K.TypeReference ? type.typeName.getText() : null);

/**
 * Each `#field` of the class to the type it is declared with: the annotation, else the type of
 * the constructor parameter it is assigned from.
 */
export function fieldTypes(text) {
  const types = new Map();
  const cls = classIn(text);
  if (!cls) return types;
  const parameters = new Map();
  for (const m of cls.members) {
    if (m.kind === K.PropertyDeclaration && m.name.kind === K.PrivateIdentifier) {
      const t = typeName(m.type);
      if (t) types.set(memberName(m), t);
    }
    if (m.kind === K.Constructor) {
      for (const p of m.parameters) if (p.name.kind === K.Identifier && typeName(p.type)) parameters.set(p.name.text, typeName(p.type));
      for (const n of walk(m)) {
        if (n.kind !== K.BinaryExpression || n.operatorToken.kind !== K.EqualsToken) continue;
        const field = privateOfThis(n.left);
        const source = bare(n.right);
        if (field && !types.has(field) && source?.kind === K.Identifier && parameters.has(source.text)) types.set(field, parameters.get(source.text));
      }
    }
  }
  return types;
}

let FUNCTION_LIKE;

/**
 * Whether the promise `call` makes is held: returned (a return statement, or an arrow's concise
 * body), awaited, or handed to this.own(). Whatever wraps it on the way — `.then(…)`, a ternary,
 * parentheses — goes with it.
 */
function held(call) {
  let node = call;
  for (let up = node.parent; up; node = up, up = up.parent) {
    if (up.kind === K.ReturnStatement || up.kind === K.AwaitExpression) return true;
    if (up.kind === K.ArrowFunction && up.body === node) return true;
    if (up.kind === K.CallExpression && isThisMember(up.expression, 'own') && up.arguments.includes(node)) return true;
    if (FUNCTION_LIKE.has(up.kind) || ts.isStatement(up)) return false;
  }
  return false;
}

/**
 * The unheld promise calls in one controller, and what was judged. `sites` counts every
 * `this.#field.method(…)` call; `judged` those whose field's type owns a method that hands back a
 * promise; `unresolved` those whose field has no declared type — counted, not judged.
 */
export function unheldCalls({ file, text }, waits) {
  const types = fieldTypes(text);
  const lines = text.split('\n');
  const offenders = [];
  let sites = 0;
  let judged = 0;
  let unresolved = 0;
  for (const n of walk(parse(text, file))) {
    if (n.kind !== K.CallExpression) continue;
    const callee = bare(n.expression);
    if (callee?.kind !== K.PropertyAccessExpression) continue;
    const field = privateOfThis(callee.expression);
    if (!field) continue;
    sites++;
    const owner = types.get(field);
    if (owner === undefined) {
      unresolved++;
      continue;
    }
    const verb = callee.name.getText();
    if (!waits.has(`${owner}.${verb}`)) continue;
    judged++;
    if (held(n)) continue;
    const line = lineOf(n);
    offenders.push(`${file}:${line}: ${owner}.${verb}() hands back a promise and nobody holds it — return it, or wrap it in this.own()\n    ${lines[line - 1].trim()}`);
  }
  return { offenders, sites, judged, unresolved };
}

// ---- the css tag ----

/**
 * Where the framework's `css` tag runs at import, and how many tags were read. Inside a function
 * — the Style callback is one — or an instance field initialiser, it runs later, once the
 * adapters are installed; anywhere else it runs when the module is imported and throws.
 */
export function cssTagsAtModuleScope(text) {
  const hits = [];
  let tags = 0;
  for (const n of walk(parse(text))) {
    if (n.kind !== K.TaggedTemplateExpression || n.tag.kind !== K.Identifier || n.tag.text !== 'css') continue;
    tags++;
    let inside = false;
    for (let up = n.parent; up; up = up.parent) {
      if (FUNCTION_LIKE.has(up.kind) || (up.kind === K.PropertyDeclaration && !hasModifier(up, K.StaticKeyword))) {
        inside = true;
        break;
      }
    }
    if (!inside) hits.push(lineOf(n));
  }
  return { hits, tags };
}

// ---- file shapes ----

let EXPORTED;

/** Every top-level export: { kind: 'interface' | 'type' | 'class' | …, name }. */
export function exportsIn(text) {
  const out = [];
  for (const s of parse(text).statements) {
    if (EXPORTED.has(s.kind) && hasModifier(s, K.ExportKeyword)) {
      const kind = { [K.InterfaceDeclaration]: 'interface', [K.TypeAliasDeclaration]: 'type', [K.ClassDeclaration]: 'class', [K.FunctionDeclaration]: 'function', [K.VariableStatement]: 'value', [K.EnumDeclaration]: 'enum' }[s.kind];
      const names = s.kind === K.VariableStatement ? s.declarationList.declarations.map((d) => d.name.getText()) : [s.name?.text ?? 'default'];
      for (const name of names) out.push({ kind, name });
    } else if (s.kind === K.ExportDeclaration && !s.moduleSpecifier && s.exportClause?.kind === K.NamedExports) {
      for (const e of s.exportClause.elements) out.push({ kind: s.isTypeOnly || e.isTypeOnly ? 'type' : 'value', name: e.name.text });
    } else if (s.kind === K.ExportAssignment) {
      out.push({ kind: 'value', name: 'default' });
    }
  }
  return out;
}

/**
 * The statements in a model file that are not types: anything but a type-only import, an
 * interface, a type alias or a type-only export. Comments are not statements.
 */
export function logicIn(text) {
  const out = [];
  for (const s of parse(text).statements) {
    if (s.kind === K.InterfaceDeclaration || s.kind === K.TypeAliasDeclaration || s.kind === K.EmptyStatement) continue;
    if (s.kind === K.ImportDeclaration && s.importClause?.isTypeOnly) continue;
    if (s.kind === K.ExportDeclaration && s.isTypeOnly) continue;
    out.push(`${lineOf(s)}: ${s.getText().split('\n')[0]}`);
  }
  return out;
}

/** For each exported interface with a string-literal `type` property: { name, literal }. */
export function eventTypesIn(text) {
  const out = [];
  for (const s of parse(text).statements) {
    if (s.kind !== K.InterfaceDeclaration || !hasModifier(s, K.ExportKeyword)) continue;
    for (const m of s.members) {
      if (m.kind !== K.PropertySignature || m.name.getText() !== 'type') continue;
      const t = m.type;
      if (t?.kind === K.LiteralType && ts.isStringLiteral(t.literal)) out.push({ name: s.name.text, literal: t.literal.text });
    }
  }
  return out;
}

/** Every call `<receiver>.<method>(…)` whose receiver's text is `receiver`: `this.children`.push, `changes`.update. */
export function callsTo(text, receiver, method) {
  const out = [];
  for (const n of walk(parse(text))) {
    if (n.kind !== K.CallExpression) continue;
    const callee = bare(n.expression);
    if (callee?.kind === K.PropertyAccessExpression && callee.name.getText() === method && bare(callee.expression).getText() === receiver) {
      out.push(lineOf(n));
    }
  }
  return out;
}
