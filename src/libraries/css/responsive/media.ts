import { type StyleResult, css } from '../templates/index.ts';
import type { Upper, Width } from './breakpoints.ts';
import { type Queries, type Rules, conditions, queries } from './text.ts';

const width = conditions('width');

/**
 * The viewport. Preludes, precomputed at module load, on the shared names:
 *
 *   media.atLeast.md          '@media (width >= 48rem)'
 *   media.below.md            '@media (width < 48rem)'
 *   media.between('md', 'lg') '@media (48rem <= width < 64rem)'
 *
 * A prelude opens a block whose inner `${}` holes stay visible to the css tag.
 */
export const media: Queries<'@media', 'width'> = queries('@media', 'width', 'media');

/**
 * The wrappers: one css`` call each, the condition a text hole, the rules raw text or a
 * nested sheet whose holes stay live. `${atLeast('md', css`…`)}` composes at statement start.
 */

/** `@media (width >= 48rem) {\n rules \n}\n` */
export function atLeast(w: Width, rules: Rules): StyleResult {
  return css`@media (${width.atLeast('atLeast', w)}) {
${rules}
}
`;
}

/** `@media (width < 48rem) {\n rules \n}\n` */
export function below(w: Width, rules: Rules): StyleResult {
  return css`@media (${width.below('below', w)}) {
${rules}
}
`;
}

/** `@media (48rem <= width < 64rem) {\n rules \n}\n`; `to` must be above `from`. */
export function between<A extends Width>(from: A, to: Upper<A>, rules: Rules): StyleResult {
  return css`@media (${width.between('between', from, to)}) {
${rules}
}
`;
}
