/**
 * The stagger ladder: `:nth-child` rungs that set `--anim-index`, never a delay, so
 * a staggered element can also carry a multi-step timeline (every compiled delay
 * starts from `--anim-index × --stagger`). Siblings past `count` share the last rung,
 * so a long list arrives with the last step rather than unstaggered. The index
 * inherits: an inner animation that must not wait sets `--anim-index: 0` on itself.
 */
import { css, type StyleResult } from '../templates/index.ts';
import { block, declaration, fail, known, text } from './text.ts';
import { names } from './tokens.ts';

export interface StaggerOptions {
  /** The siblings, e.g. '.rows > li'. */
  selector: string;
  /** The rungs: 1 to 64. Past 64, the template sets --anim-index on each item. */
  count: number;
}

/** The most rungs a ladder has; a longer list sets its index from the template. */
export const staggerLimit = 64;

const optionKeys = ['selector', 'count'] as const;

export function stagger(options: StaggerOptions): StyleResult {
  known('stagger', 'option', options, optionKeys);
  const { selector, count } = options;
  const on = text('stagger', 'selector', selector);
  if (!Number.isInteger(count) || count < 1 || count > staggerLimit) {
    fail('stagger', `count ${String(count)} is not an integer from 1 to ${staggerLimit}`, 'give the rung count; past 64, set --anim-index on each item from the template instead');
  }
  let out = '';
  for (let rung = 0; rung < count; rung++) {
    const nth = rung === count - 1 ? `n+${count}` : String(rung + 1);
    out += block(`${on}:nth-child(${nth})`, declaration(names.index, rung));
  }
  return css`${out}`;
}
