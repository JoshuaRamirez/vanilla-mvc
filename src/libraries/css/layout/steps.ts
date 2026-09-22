import { scaleValues } from '../theme/index.ts';

/** Theme's spacing scale, by step. A primitive takes space as a step and never invents a length. */
export type Step = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';

export const steps: readonly Step[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8'];

/**
 * What --space-<step> falls back to when Theme's sheet is absent: Theme's default scale, read from Theme
 *, in Theme's own text (0.25rem, not .25rem). The one assumption this engine makes about another,
 * now held in one place: Theme's.
 */
export const fallbacks: Readonly<Record<Step, string>> = Object.freeze({ ...scaleValues().space });

/** A value as the error message shows it: strings quoted, anything else as is. */
export const show = (value: unknown): string => (typeof value === 'string' ? JSON.stringify(value) : String(value));

/** Throws unless value is a Step. `fn` is the function called, `option` what was being set: ('stack', 'gap'). */
export function assertStep(fn: string, option: string, value: unknown): asserts value is Step {
  if (typeof value !== 'string' || !(steps as readonly string[]).includes(value)) {
    throw new RangeError(`layout: ${fn}: ${option} is ${show(value)}, not a space step; use '0'..'8'`);
  }
}

/** `var(--space-3, 0.75rem)`: the only way a length reaches a primitive's gap. */
export function space(step: Step): string {
  assertStep('space', 'step', step);
  return `var(--space-${step}, ${fallbacks[step]})`;
}
