import { type StyleResult, css } from '../templates/index.ts';
import { type Width, breakpointNames, isBreakpoint, isRem } from './breakpoints.ts';
import { notCondition, notIdentifier } from './errors.ts';
import { type Queries, type Rules, conditions, queries } from './text.ts';

/**
 * The feature a container query measures. Layout's container() declares
 * `container-type: inline-size`, which makes the inline axis queryable in every
 * writing mode; `width` would go unknown in a vertical one. @media has no
 * inline-size feature, so its verbs say width; these say inline-size.
 */
const FEATURE = 'inline-size';
const inline = conditions(FEATURE);

/**
 * What a container query asks. A breakpoint name or a rem width means at least
 * that inline size; a parenthesised string is the condition, verbatim — CSS the
 * author types, carrying the constant through width() when it needs one:
 *
 *   'md'                                       (inline-size >= 48rem)
 *   '30rem'                                    (inline-size >= 30rem)
 *   `(inline-size < ${width('md')})`           (inline-size < 48rem)
 *   '(inline-size >= 30em) and (orientation: portrait)'
 */
export type ContainerCondition = Width | `(${string})`;

const IDENTIFIER = /^-?[A-Za-z_][\w-]*$/;
const RESERVED = new Set(['none', 'and', 'or', 'not']);

function conditionText(fn: string, condition: ContainerCondition): string {
  if (isBreakpoint(condition) || isRem(condition)) return `(${inline.atLeast(fn, condition)})`;
  const text = String(condition).trim();
  if (text.length > 2 && text.startsWith('(') && text.endsWith(')')) return text;
  return notCondition(fn, condition, breakpointNames);
}

function identifier(fn: string, name: string): string {
  if (typeof name === 'string' && IDENTIFIER.test(name) && !RESERVED.has(name.toLowerCase())) return name;
  return notIdentifier(fn, String(name));
}

function prelude(fn: string, condition: ContainerCondition, name: string | undefined): string {
  const text = conditionText(fn, condition);
  return name === undefined ? `@container ${text}` : `@container ${identifier(fn, name)} ${text}`;
}

/**
 * The nearest container, or one Layout named. The same three verbs as media, on
 * inline-size, plus `query` for a named container or a hand-written condition:
 *
 *   inContainer.atLeast.md                                '@container (inline-size >= 48rem)'
 *   inContainer.below.md                                  '@container (inline-size < 48rem)'
 *   inContainer.between('md', 'lg')                       '@container (48rem <= inline-size < 64rem)'
 *   inContainer.query('md', 'card')                       '@container card (inline-size >= 48rem)'
 *   inContainer.query(`(inline-size < ${width('sm')})`, 'card')   '@container card (inline-size < 40rem)'
 *   inContainer.query('(inline-size >= 30em)')            '@container (inline-size >= 30em)'
 *
 * The name must be one CSS identifier, equal to Layout's container-name. A
 * container never measures itself: rules under one of these apply to the
 * container's descendants.
 */
export const inContainer: Queries<'@container', 'inline-size'> & { query(condition: ContainerCondition, name?: string): string } = Object.freeze({
  ...queries('@container', FEATURE, 'inContainer'),
  query: (condition: ContainerCondition, name?: string) => prelude('inContainer.query', condition, name),
});

/** `@container <name> (<condition>) {\n rules \n}\n` — one css`` call; the same text as block(inContainer.query(condition, name), rules). */
export function atContainer(name: string, condition: ContainerCondition, rules: Rules): StyleResult {
  return css`@container ${identifier('atContainer', name)} ${conditionText('atContainer', condition)} {
${rules}
}
`;
}
