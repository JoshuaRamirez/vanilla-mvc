import { css, type StyleResult } from '../templates/index.ts';
import { attributes, KNOBS } from './knobs.ts';
import { LISTABLE, primitives } from './primitives.ts';
import { steps } from './steps.ts';

const { layout, gap, side, dense, list, principal } = attributes;
const not = (attribute: string, values: readonly string[]): string => values.map((v) => `:not([${attribute}="${v}"])`).join('');
const is = (primitive: string): string => `[${layout}="${primitive}"]`;

/** A mistake only the page can see: the elements it selects, and the label painted on them. */
interface Fault {
  readonly selector: string;
  readonly label: string;
}

/**
 * Rule 2 told at the place of the mistake: only gap is a step you may write as an attribute; every other
 * knob is set in the style. `data-layout-min` and `data-layout-width` are the option words written as
 * attributes; the rest are the knobs' own tails (`data-layout-grid-min`), one fault per knob but gap.
 */
const lengthsAsAttributes: readonly Fault[] = [
  ...['min', 'width'].map((word) => ({ selector: `[${layout}-${word}]`, label: `"layout: ${word} is not an attribute; set it in the style"` })),
  ...KNOBS.filter(({ key }) => key !== 'gap').map(({ name }) => {
    const tail = name.slice('--layout-'.length);
    return { selector: `[${layout}-${tail}]`, label: `"layout: ${tail} is not an attribute; set ${name} in the style"` };
  }),
];

export const faults: readonly Fault[] = [
  { selector: `[${layout}]${not(layout, primitives)}`, label: `"layout: unknown value " attr(${layout})` },
  { selector: `${is('sidebar')}:not(:has(> :nth-child(2):last-child))`, label: `"layout: a sidebar has exactly two children"` },
  { selector: `[${side}]:not(${is('sidebar')})`, label: `"layout: ${side} belongs on a sidebar"` },
  { selector: `[${side}]${not(side, ['start', 'end'])}`, label: `"layout: unknown side " attr(${side})` },
  { selector: `${is('cover')}:has(> [${principal}] ~ [${principal}])`, label: `"layout: a cover has one principal"` },
  { selector: `[${principal}]:not(${is('cover')} > *):not(${is('stack')} > *)`, label: `"layout: ${principal} belongs on a child of a cover or a stack"` },
  { selector: `[${dense}]:not(${is('grid')})`, label: `"layout: ${dense} belongs on a grid"` },
  { selector: `[${list}]${LISTABLE.map((p) => `:not(${is(p)})`).join('')}`, label: `"layout: ${list} belongs on a ${LISTABLE.slice(0, -1).join(', ')} or ${LISTABLE[LISTABLE.length - 1]}"` },
  { selector: `[${gap}]:not([${layout}])`, label: `"layout: ${gap} belongs on a primitive"` },
  { selector: `[${gap}]${not(gap, steps)}`, label: `"layout: unknown gap step " attr(${gap})` },
  ...lengthsAsAttributes,
];

const all = faults.map((f) => f.selector).join(', ');
const labels = faults.map((f) => `${f.selector}::before`).join(', ');
const text = [
  `${all} { outline: 2px dashed #d00; outline-offset: 2px; }`,
  `${labels} { display: block; flex-basis: 100%; grid-column: 1 / -1; margin-block: 0; padding: 0 .5em; font: .75rem/1.5 monospace; color: #fff; background: #d00; }`,
  ...faults.map((f) => `${f.selector}::before { content: ${f.label}; }`),
].join('\n');
/** The faults are constant, so there is one text and one StyleResult: raw CSS at statement start in one css call. */
const sheet: StyleResult = css`${text}`;

/**
 * Development only. Outlines and labels every layout mistake a selector can see: an unknown data-layout
 * value, a sidebar without exactly two children, two principals in one cover, a role or modifier on the
 * wrong primitive, an unknown step, a length written as an attribute. Plain selectors, so it wins; the
 * label is a ::before that takes its own row. Apply beside layout() to the document while developing;
 * never ship it.
 */
export function diagnostics(): StyleResult {
  return sheet;
}
