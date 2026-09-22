/**
 * The runtime side: readers, defaults, and the three ways a token reaches a scope
 * as data. A reader writes `var(--name, <engine default>)` so a component's sheet
 * renders before the theme is applied and identically after; the reader is the
 * property's prefix. assign() and tokens() write a subtree override — the author
 * owns the selector — and accent() is the brand lever: three roles for one hue.
 */
import { ThemeError, value } from './emit.ts';
import { paletteValues } from './modes.ts';
import { type ColorRole, type FontRole, type Group, groups, type LeadingName, property, type RadiusStep, type ShadowStep, type SpaceStep, type StrokeStep, type TextStep, type TokenName, type WeightName } from './names.ts';
import { checkChroma, checkHue } from './palettes.ts';
import { scaleRecord, scaleValues } from './scales.ts';

/**
 * The value theme() declares for every token with no options, by full name — what every reader
 * falls back to, so a sheet renders the same before and after the theme is applied. Colours and
 * shadows are light-dark() pairs: the fallback honours the mode too.
 */
export const defaults: Readonly<Record<TokenName, string>> = Object.freeze({ ...scaleRecord(scaleValues()), ...paletteValues('neutral') }) as Record<TokenName, string>;

/** `var(--color-<role>, <fallback>)`; the fallback is the neutral palette's light-dark() pair. */
export function color(role: ColorRole): string {
  return read('color', role);
}

/**
 * `var(--space-<step>, <fallback>)`. Defaults, on a 0.25rem unit:
 * 0 → 0, 1 → 0.25rem (4px), 2 → 0.5rem, 3 → 0.75rem, 4 → 1rem (16px), 5 → 1.5rem, 6 → 2rem, 7 → 3rem, 8 → 4rem (64px).
 * A number is accepted as a kindness; the step's type stays the string css-layout takes.
 */
export function space(step: SpaceStep | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8): string {
  return read('space', String(step));
}

/** `var(--text-<step>, <fallback>)`. Defaults, 1rem x 1.25^n: xs 0.64, sm 0.8, md 1, lg 1.25, xl 1.563, 2xl 1.953, 3xl 2.441 rem. */
export function text(step: TextStep): string {
  return read('text', step);
}

/** `var(--font-<role>, <fallback>)`. Defaults: body and heading system-ui; mono ui-monospace. */
export function font(role: FontRole): string {
  return read('font', role);
}

/** `var(--leading-<name>, <fallback>)`. Defaults: tight 1.2, normal 1.5, loose 1.75. */
export function leading(name: LeadingName): string {
  return read('leading', name);
}

/** `var(--weight-<name>, <fallback>)`. Defaults: normal 400, medium 500, bold 700. */
export function weight(name: WeightName): string {
  return read('weight', name);
}

/** `var(--radius-<step>, <fallback>)`. Defaults: none 0, sm 0.25rem, md 0.5rem, lg 1rem, full 9999px. */
export function radius(step: RadiusStep): string {
  return read('radius', step);
}

/** `var(--shadow-<step>, <fallback>)`. Defaults: none; sm 0 1px 2px; md 0 4px 12px; lg 0 12px 32px, each a light-dark() colour. */
export function shadow(step: ShadowStep): string {
  return read('shadow', step);
}

/**
 * `var(--stroke-<step>, <fallback>)`. Default: hairline 1px — the one rule width, written
 * `border: ${stroke('hairline')} solid ${color('border')}`. A width, not SVG's `stroke` paint.
 */
export function stroke(step: StrokeStep): string {
  return read('stroke', step);
}

/** A subtree override: every key optional; undefined leaves that token alone. */
export interface Tokens {
  readonly color?: Partial<Record<ColorRole, string | undefined>>;
  readonly space?: Partial<Record<SpaceStep, string | undefined>>;
  readonly text?: Partial<Record<TextStep, string | undefined>>;
  readonly font?: Partial<Record<FontRole, string | undefined>>;
  readonly leading?: Partial<Record<LeadingName, string | number | undefined>>;
  readonly weight?: Partial<Record<WeightName, string | number | undefined>>;
  readonly radius?: Partial<Record<RadiusStep, string | undefined>>;
  readonly shadow?: Partial<Record<ShadowStep, string | undefined>>;
  readonly stroke?: Partial<Record<StrokeStep, string | undefined>>;
}

/**
 * The override as data: { '--color-accent': 'oklch(62% 0.2 30)' } — the shape a css`` object hole at
 * statement start, declarations() for a template's style=, and element.style.setProperty() take.
 * Keep the keys fixed per call site and branch on the value: a dropped key is a new text variant,
 * and an emptied custom property is valid-and-empty, which var(--x, fallback) does not rescue.
 * Throws ThemeError on an unknown group or name, an empty string, or a value carrying `;`, `{` or `}`.
 */
export function assign(t: Tokens): Partial<Record<TokenName, string>> {
  return assignIn('assign()', t);
}

/** The same override as declaration text — "--color-accent: oklch(62% 0.2 30);\n" — for a round-1 string hole under the author's own selector. */
export function tokens(t: Tokens): string {
  let out = '';
  for (const [name, given] of Object.entries(assignIn('tokens()', t))) out += `${name}: ${given};\n`;
  return out;
}

/** The three hue-dependent roles. */
export type AccentToken = '--color-accent' | '--color-on-accent' | '--color-focus';

/**
 * The brand lever: accent, on-accent and focus for one hue, each a light-dark() pair from the
 * palette table, in assign()'s shape — three property writes on a scope and no sheet change.
 * chroma defaults to 0.12; the pairs meet the contrast proxy for any hue.
 */
export function accent(hue: number, chroma?: number): Record<AccentToken, string> {
  const where = 'accent()';
  checkHue(where, 'hue', hue);
  if (chroma !== undefined) checkChroma(where, 'chroma', chroma);
  const values = paletteValues({ name: 'accent', accent: hue, chroma });
  return {
    '--color-accent': values['--color-accent'] as string,
    '--color-on-accent': values['--color-on-accent'] as string,
    '--color-focus': values['--color-focus'] as string,
  };
}

function assignIn(where: string, t: Tokens): Partial<Record<TokenName, string>> {
  if (typeof t !== 'object' || t === null) throw new ThemeError(`${where}: expected an object of token groups; got ${String(t)}`);
  const out: Record<string, string> = {};
  for (const [group, entries] of Object.entries(t)) {
    if (!Object.hasOwn(groups, group)) throw new ThemeError(`${where}: "${group}" is not a token group; groups are ${Object.keys(groups).join(', ')}`);
    if (entries === undefined) continue;
    if (typeof entries !== 'object' || entries === null) throw new ThemeError(`${where}: ${group} must be an object of names; got ${String(entries)}`);
    const names = groups[group as Group] as readonly string[];
    for (const [name, given] of Object.entries(entries as Record<string, unknown>)) {
      if (!names.includes(name)) throw new ThemeError(`${where}: ${group}.${name} is not a name; ${group} names are ${names.join(', ')}`);
      if (given === undefined) continue;
      out[property(group as Group, name)] = value(where, `${group}.${name}`, given);
    }
  }
  return out as Partial<Record<TokenName, string>>;
}

function read(group: Group, name: string): string {
  const token = property(group, name);
  const fallback = (defaults as Readonly<Record<string, string>>)[token];
  if (fallback === undefined) throw new ThemeError(`${group}(): ${JSON.stringify(name)} is not a name; ${group} names are ${groups[group].join(', ')}`);
  return `var(${token}, ${fallback})`;
}
