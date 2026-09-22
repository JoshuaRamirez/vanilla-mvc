import { type StyleResult, css } from '../templates/index.ts';
import { type Breakpoint, type Upper, type Width, band, breakpointNames, breakpoints, rems } from './breakpoints.ts';

/** What a wrapper wraps: raw CSS text, self-contained, or a css`` block whose holes stay live. */
export type Rules = string | StyleResult;

/**
 * A block: `${prelude} {\n${rules}\n}\n` as one css`` call. Any prelude, from any engine,
 * wraps rules the same way. The prelude is raw text at statement start (balanced within
 * itself); the rules are raw text or a nested sheet whose value holes bind on the scope
 * element. A block cannot emit nothing: for a band the model decides, write
 * `${m.dense ? block(prelude, rules) : null}` at statement start.
 */
export function block(prelude: string, rules: Rules): StyleResult {
  return css`${prelude} {
${rules}
}
`;
}

/** A number as CSS text: at most `places` decimals (four by default), trailing zeros trimmed, never -0. */
export function fmt(n: number, places = 4): string {
  const rounded = Number(n.toFixed(places));
  return String(rounded === 0 ? 0 : rounded);
}

/** The three comparisons as condition text on one feature, half-open: [from, to). */
export interface Conditions {
  /** 'width >= 48rem' */
  atLeast(fn: string, w: Width): string;
  /** 'width < 48rem' */
  below(fn: string, w: Width): string;
  /** '40rem <= width < 64rem' */
  between(fn: string, from: Width, to: Width): string;
}

export function conditions(feature: string): Conditions {
  return {
    atLeast: (fn, w) => `${feature} >= ${rems(fn, w)}rem`,
    below: (fn, w) => `${feature} < ${rems(fn, w)}rem`,
    between: (fn, from, to) => {
      const [low, high] = band(fn, from, to);
      return `${low}rem <= ${feature} < ${high}rem`;
    },
  };
}

/**
 * Preludes on the shared breakpoint names: the text that opens a query block. The
 * records are typed as the text they hold, so the editor's hover on media.atLeast.md
 * reads '@media (width >= 48rem)' — the documentation is the type.
 */
export interface Queries<At extends string, Feature extends string> {
  /** media.atLeast.md === '@media (width >= 48rem)' */
  readonly atLeast: { readonly [B in Breakpoint]: `${At} (${Feature} >= ${(typeof breakpoints)[B]}rem)` };
  /** media.below.md === '@media (width < 48rem)' */
  readonly below: { readonly [B in Breakpoint]: `${At} (${Feature} < ${(typeof breakpoints)[B]}rem)` };
  /** media.between('md', 'lg') === '@media (48rem <= width < 64rem)'; `to` must be above `from` — the type says so for names, the sentence for rem widths. */
  between<A extends Width>(from: A, to: Upper<A>): string;
}

/** The preludes for one at-rule on one feature, precomputed at module load: queries('@media', 'width', 'media'). */
export function queries<At extends string, Feature extends string>(at: At, feature: Feature, name: string): Queries<At, Feature> {
  const c = conditions(feature);
  const record = <T>(text: (n: Breakpoint) => string): T => Object.freeze(Object.fromEntries(breakpointNames.map((n) => [n, text(n)]))) as T;
  return Object.freeze({
    atLeast: record<Queries<At, Feature>['atLeast']>((n) => `${at} (${c.atLeast(`${name}.atLeast`, n)})`),
    below: record<Queries<At, Feature>['below']>((n) => `${at} (${c.below(`${name}.below`, n)})`),
    between: (from: Width, to: Width) => `${at} (${c.between(`${name}.between`, from, to)})`,
  });
}
