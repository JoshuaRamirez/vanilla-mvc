import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, css, declarations, idOf, scoped, serialize, StyleResult } from '../dist/libraries/css/templates/index.js';

const kinds = (style) => analyze(style.strings).map((h) => h.kind);

test('css returns a StyleResult whose strings identity is the call site', () => {
  const site = (x) => css`.s1 { color: ${x}; }`;
  const a = site('red');
  const b = site('blue');
  assert.ok(a instanceof StyleResult);
  assert.equal(a.strings, b.strings);
  assert.deepEqual([a.values, b.values], [['red'], ['blue']]);
  assert.notEqual(a.strings, css`.s1 { color: ${'red'}; }`.strings);
});

test('analyze tells positions apart', () => {
  const style = css`${0} .a ${1} { color: ${2}; width: calc(${3} + 1px); content: "${4}"; ${5} } @media (min-width: ${6}) { ${7} }
    @font-face { font-family: ${8}; src: url("${9}"); } .b:hover ${10} { --x: ${11} } .c { ${12}: red; color: ${13} !important; }`;
  assert.deepEqual(kinds(style), ['rule', 'text', 'value', 'value', 'string', 'rule', 'text', 'rule', 'text', 'string', 'text', 'value', 'rule', 'value']);
  const holes = analyze(style.strings);
  assert.deepEqual(holes.map((h) => h.depth), [0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1]);
  assert.deepEqual(holes.map((h) => h.descriptor), [false, false, false, false, false, false, false, false, true, true, false, false, false, false]);
});

test('static mistakes throw at the css tag and name the sheet', () => {
  assert.throws(() => css`.brace { color: red; `, /^TypeError: css "brace": braces do not balance \(1 opened, 0 closed\)/);
  assert.throws(() => css`.stray { } }`, /css "stray": braces do not balance \(1 opened, 2 closed\)/);
  assert.throws(() => css`.str { content: "x; }`, /css "str": an unterminated string/);
  assert.throws(() => css`.cmt { /* ${1} */ }`, /css "cmt" \(after "\.cmt \{ \/\* "\): a hole inside a comment does nothing/);
  assert.throws(() => css`.u { background: url(${'x'}); }`, /css "u" \(after "\.u \{ background: url\("\): quote it: url\("\$\{…\}"\)/);
});

test('a value hole binds live: var() in the text, the value in the plan, the same text for any values', () => {
  const style = (p, w) => css`.v1 { padding: ${p}; width: ${w}; }`;
  const out = serialize(style('4px', 12));
  assert.equal(out.id, 'v1');
  assert.equal(out.text, '.v1 { padding: var(--css-v1-0); width: var(--css-v1-1); }');
  assert.deepEqual(out.properties, [{ name: '--css-v1-0', value: '4px' }, { name: '--css-v1-1', value: '12' }]);
  const again = serialize(style('8px', 13));
  assert.equal(again.key, out.key);
  assert.equal(again.text, out.text);
  assert.deepEqual(again.properties.map((p) => p.value), ['8px', '13']);
});

test('empties leave the declaration without a value, bind nothing, and are a variant of their own', () => {
  const style = (p) => css`.v2 { padding: ${p}; margin: ${undefined}; color: ${false}; }`;
  const out = serialize(style(null));
  assert.equal(out.text, '.v2 { padding: ; margin: ; color: ; }');
  assert.deepEqual(out.properties, []);
  assert.notEqual(serialize(style('4px')).key, out.key);
});

test('a CSS-wide keyword is written into the text, never bound', () => {
  const out = serialize(css`.kw { color: ${'inherit'}; margin: ${' Unset '}; padding: ${'revert-layer'}; }`);
  assert.equal(out.text, '.kw { color: inherit; margin: unset; padding: revert-layer; }');
  assert.deepEqual(out.properties, []);
});

test('nested sheets and arrays inline at statement start, numbering continued on the outer sheet', () => {
  const inner = (c) => css`.t { color: ${c}; }`;
  const out = serialize(css`.n1 { gap: ${1}; } ${inner('red')} ${[inner('blue'), null, inner('green')]} ${undefined}`);
  assert.equal(out.text, '.n1 { gap: var(--css-n1-0); } .t { color: var(--css-n1-1); } .t { color: var(--css-n1-2); }.t { color: var(--css-n1-3); } ');
  assert.deepEqual(out.properties.map((p) => `${p.name}=${p.value}`), ['--css-n1-0=1', '--css-n1-1=red', '--css-n1-2=blue', '--css-n1-3=green']);
});

test('raw css text at statement start is verbatim', () => {
  const out = serialize(css`.r1 { ${'color: red; margin: 0;'} } ${'.x { display: none }'}`);
  assert.equal(out.text, '.r1 { color: red; margin: 0; } .x { display: none }');
});

test('an object at statement start is a declaration block whose values bind live', () => {
  const out = serialize(css`.o1 { ${{ padding: '4px', '--gap': 8, margin: null, color: 'inherit' }} }`);
  assert.equal(out.text, '.o1 { padding: var(--css-o1-0); --gap: var(--css-o1-1); color: inherit;  }');
  assert.deepEqual(out.properties, [{ name: '--css-o1-0', value: '4px' }, { name: '--css-o1-1', value: '8' }]);
});

test('an object at the top level is a declaration block on :scope; inlined inside a block, a nested sheet is not', () => {
  const out = serialize(css`${{ padding: '4px', color: 'red' }} .top { ${{ gap: 1 }} }`);
  assert.equal(out.text, ':scope { padding: var(--css-top-0); color: var(--css-top-1); } .top { gap: var(--css-top-2);  }');
  assert.deepEqual(out.properties.map((p) => p.value), ['4px', 'red', '1']);
  const inner = css`${{ margin: 0 }}`;
  assert.equal(serialize(css`.outer { ${inner} }`).text, '.outer { margin: var(--css-outer-0);  }', 'depth follows the nesting');
  assert.equal(serialize(css`.outer2 { } ${inner}`).text, '.outer2 { } :scope { margin: var(--css-outer2-0); }', 'and the same sheet at the top level wraps');
});

test('inside a descriptor at-rule an object is text too, and so is a nested sheet\u2019s value', () => {
  const out = serialize(css`@font-face { ${{ 'font-family': 'Inter', src: 'url(a.woff2)' }} ${css`font-weight: ${400};`} } .desc { ${{ 'font-weight': 400 }} }`);
  assert.equal(out.text, '@font-face { font-family: Inter; src: url(a.woff2);  font-weight: 400; } .desc { font-weight: var(--css-desc-0);  }');
  assert.deepEqual(out.properties, [{ name: '--css-desc-0', value: '400' }]);
  assert.throws(() => serialize(css`@property --x { ${{ syntax: '"<length>"; } .evil {' }} }`), /css "property" \(after "@property --x \{ "\): ";" cannot go in a selector or a name/);
});

test('bound properties live under --css-, so a sheet named like a token cannot collide with it', () => {
  const out = serialize(css`.space { --space-1: ${'8px'}; padding: ${'4px'}; }`);
  assert.equal(out.text, '.space { --space-1: var(--css-space-0); padding: var(--css-space-1); }');
  assert.deepEqual(out.properties.map((p) => p.name), ['--css-space-0', '--css-space-1']);
});

test('text holes are verbatim in selectors, preludes and names', () => {
  const out = serialize(css`.t1-${'a'} { ${'padding'}: ${1}; } @media (min-width: ${'40em'}) { .b { color: red } }`);
  assert.equal(out.id, 't1');
  assert.equal(out.text, '.t1-a { padding: var(--css-t1-0); } @media (min-width: 40em) { .b { color: red } }');
});

test('inside a descriptor at-rule a value is text, since var() is invalid there', () => {
  const out = serialize(css`@font-face { font-family: ${'Inter'}; font-weight: ${400}; } .d1 { font-weight: ${400}; }`);
  assert.equal(out.text, '@font-face { font-family: Inter; font-weight: 400; } .d1 { font-weight: var(--css-d1-0); }');
  assert.deepEqual(out.properties, [{ name: '--css-d1-0', value: '400' }]);
});

test('string holes are escaped inside quotes', () => {
  const out = serialize(css`.s2::before { content: "${'a"b\\c\nd'}"; }`);
  assert.equal(out.text, `.s2::before { content: "a\\"b\\\\c\\a d"; }`);
});

test('a value cannot reach the text: closing a block binds as an inert property', () => {
  const out = serialize(css`.inj { color: ${'red } .evil { display: none'}; }`);
  assert.equal(out.text, '.inj { color: var(--css-inj-0); }');
  assert.equal(out.properties[0].value, 'red } .evil { display: none');
});

test('misuse throws a TypeError naming the sheet and quoting the css before the hole', () => {
  assert.throws(() => serialize(css`.m1-${'x } body { display: none'} { }`), /^TypeError: css "m1" \(after "\.m1-"\): "\}" cannot go in a selector or a name/);
  assert.throws(() => serialize(css`.m2 { color: ${() => 'red'}; }`), /css "m2" \(after "\.m2 \{ color: "\): a function is not a value; holes are values from the model/);
  assert.throws(() => serialize(css`.m3 { color: ${css`.x { }`}; }`), /css "m3" .*: a css block goes at the start of a statement/);
  assert.throws(() => serialize(css`.m4 { color: ${{ a: 1 }}; }`), /css "m4" .*: a declaration block goes at the start of a statement/);
  assert.throws(() => serialize(css`.m5 { color: ${true}; }`), /css "m5" .*: boolean true is not a value/);
  assert.throws(() => serialize(css`.m6 { color: ${Symbol('s')}; }`), TypeError);
  assert.throws(() => serialize(css`.m7 { ${{ 'bad name': 1 }} }`), /css "m7" .*: "bad name" is not a property name/);
  assert.throws(() => serialize(css`.m8 { ${{ color: () => 1 }} }`), /css "m8" .*: a function is not a value for color/);
  assert.throws(() => serialize(css`.m9 { ${() => ''} }`), /css "m9" .*: a function is not css/);
  assert.throws(() => serialize(css`.m10 ${css`.x { }`} { }`), /css "m10" .*: an object cannot go in a selector or a name/);
  assert.throws(() => serialize(css`.m11 { content: "${{}}"; }`), /css "m11" .*: an object cannot go inside quotes/);
  const inner = css`.in { color: ${() => 1}; }`;
  assert.throws(() => serialize(css`.m12 { } ${inner}`), /css "in" \(after "\.in \{ color: "\)/, 'a nested sheet names itself');
});

test('raw css must be self-contained: braces, parens, brackets, quotes and comments all balance', () => {
  const cases = [
    ['.a { color: red', 'an unclosed "\\{"'],
    ['color: red } .evil {', 'a stray "\\}"'],
    ['width: calc(1px', 'an unclosed "\\("'],
    ['a: ) b: (', 'a stray "\\)"'],
    ['a: [', 'an unclosed "\\["'],
    ['x: "open', 'an unterminated string'],
    ['/* open', 'an unterminated comment'],
  ];
  for (const [raw, why] of cases) {
    assert.throws(() => serialize(css`.raw { ${raw} }`), new RegExp(`css "raw" \\(after "\\.raw \\{ "\\): raw css is not self-contained: ${why}`), raw);
  }
  assert.equal(serialize(css`.raw { ${'color: "}"; background: url(x) /* ( */'} }`).text, '.raw { color: "}"; background: url(x) /* ( */ }');
});

test('a sheet is named by its first identifier, unique per module', () => {
  assert.equal(idOf(css`.card { }`.strings), 'card');
  assert.equal(idOf(css`  /* note */ .card { }`.strings), 'card2');
  assert.equal(idOf(css`:root { }`.strings), 'root');
  assert.equal(idOf(css`:scope { color: #fff; content: ".no"; background: url(a.png) } /* .no */ .title { }`.strings), 'title', 'the first class, past comments, strings and urls');
  assert.equal(idOf(css`:scope.meter { display: block } .bar { }`.strings), 'meter', "the scope's own class names the sheet, as README § Binding a value from the model tells a style to do");
  assert.equal(idOf(css`@media (x) { }`.strings), 'media');
  assert.match(idOf(css`${'raw'}`.strings), /^style\d*$/, 'a sheet starting with a hole is style, or style<n> once that is taken');
  assert.equal(idOf(css`--tok: 1`.strings), 'tok');
  const site = css`.same { }`;
  assert.equal(idOf(site.strings), idOf(site.strings));
});

test('scoped wraps text for one token, with and without a boundary', () => {
  assert.equal(scoped('.a { }', 'a'), '@scope ([data-css~="a"]) { .a { } }');
  assert.equal(scoped('.a { }', 'a.1', '[data-component] > *'), '@scope ([data-css~="a.1"]) to (:scope [data-component] > *) { .a { } }');
});

test('past 64 variants of one call site, the error names the fix', () => {
  const site = (n) => css`.cap-${n} { color: red; }`;
  for (let n = 0; n < 64; n++) serialize(site(n));
  assert.throws(
    () => serialize(site(64)),
    /css "cap": 64 variants of one call site; this value varies per instance: bind it in a declaration, or give the variants their own css call sites/,
  );
  assert.equal(serialize(site(3)).text, '.cap-3 { color: red; }', 'a known variant is still served');
});

test('declarations() writes a block for a style attribute', () => {
  assert.equal(declarations({ padding: '4px', '--gap': 8, margin: null, hidden: false, x: undefined }), 'padding: 4px; --gap: 8;');
  assert.equal(declarations({}), '');
  assert.throws(() => declarations({ 'bad name': 1 }), /css: "bad name" is not a property name/);
  assert.throws(() => declarations({ a: () => 1 }), /css: "a" needs text or a number, got function/);
});
