/**
 * The mode-independent tokens: space, type, fonts, leading, weight, radius, stroke.
 * Every step is printed as a literal value, never as calc(var(--anchor) * n):
 * var() inside a custom property substitutes where the property is declared,
 * so a derived ramp would not rescale under a subtree that re-declares its anchor.
 * scaleValues() is the strings the sheet prints; scaleNumbers() is the same
 * derivation as numbers in rem — what responsive's fluid minimums are built from.
 */
import { block, checked, declarations, describe, number, options, parseLength, pinned, selector, ThemeError } from './emit.ts';
import { type FontRole, fontRoles, type LeadingName, leadingNames, property, type RadiusStep, radiusSteps, type SpaceStep, spaceSteps, type StrokeStep, strokeSteps, type TextStep, textSteps, type WeightName, weightNames } from './names.ts';

export interface ScaleOptions {
  /** The rule the tokens are declared on. Default ':root'. */
  readonly selector?: string;
  /** Space: the unit (default '0.25rem') times nine multipliers (default [0, 1, 2, 3, 4, 6, 8, 12, 16]); [0] is 0 and they ascend. */
  readonly space?: { readonly unit?: string; readonly multipliers?: readonly number[] };
  /** Type: --text-md (default '1rem') times ratio^n (default 1.25, a major third) for n = -2..4. */
  readonly type?: { readonly base?: string; readonly ratio?: number };
  readonly fonts?: Partial<Record<FontRole, string>>;
  readonly leading?: Partial<Record<LeadingName, number>>;
  readonly weight?: Partial<Record<WeightName, number>>;
  readonly radius?: Partial<Record<RadiusStep, string>>;
  /** Border widths; one step today. The 1px rule every bordered surface draws (default '1px'). */
  readonly stroke?: Partial<Record<StrokeStep, string>>;
}

/** Every mode-independent token's value as CSS text, by group and name. */
export interface ScaleValues {
  readonly space: Readonly<Record<SpaceStep, string>>;
  readonly text: Readonly<Record<TextStep, string>>;
  readonly font: Readonly<Record<FontRole, string>>;
  readonly leading: Readonly<Record<LeadingName, string>>;
  readonly weight: Readonly<Record<WeightName, string>>;
  readonly radius: Readonly<Record<RadiusStep, string>>;
  readonly stroke: Readonly<Record<StrokeStep, string>>;
}

/** The two length scales as numbers in rem: exactly the decimals scaleValues() prints, parsed. */
export interface ScaleNumbers {
  readonly text: Readonly<Record<TextStep, number>>;
  readonly space: Readonly<Record<SpaceStep, number>>;
}

export const scaleDefaults = {
  space: { unit: '0.25rem', multipliers: [0, 1, 2, 3, 4, 6, 8, 12, 16] },
  type: { base: '1rem', ratio: 1.25 },
  fonts: { body: 'system-ui, sans-serif', heading: 'system-ui, sans-serif', mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
  leading: { tight: 1.2, normal: 1.5, loose: 1.75 },
  weight: { normal: 400, medium: 500, bold: 700 },
  radius: { none: '0', sm: '0.25rem', md: '0.5rem', lg: '1rem', full: '9999px' },
  stroke: { hairline: '1px' },
} as const satisfies Required<Omit<ScaleOptions, 'selector'>>;

/** The keys scales(), scaleValues(), scaleNumbers() and theme() accept from ScaleOptions. */
export const scaleKeys: readonly string[] = Object.freeze(['selector', 'space', 'type', 'fonts', 'leading', 'weight', 'radius', 'stroke']);
/** Space is printed at four places and type at three; scaleNumbers() carries exactly those decimals. */
const SPACE_PLACES = 4;
const TEXT_PLACES = 3;

/** The values scales() prints and the readers fall back to. Pure; validates every option and throws ThemeError. */
export function scaleValues(options: ScaleOptions = {}): ScaleValues {
  const where = 'scaleValues()';
  return scaleValuesIn(where, checkedScaleOptions(where, options));
}

/**
 * The text and space scales as numbers in rem — the numeric form of scaleValues(), for an engine
 * that computes on the steps (responsive's fluid minimums). The same derivation and the same
 * rounding, so scaleNumbers().space['4'] is scaleValues().space['4'] parsed, exactly. Requires
 * rem: Theme sets no root font-size, so a px unit has no honest rem value.
 */
export function scaleNumbers(options: ScaleOptions = {}): ScaleNumbers {
  const where = 'scaleNumbers()';
  const { unit, base, ratio, multipliers } = derive(where, checkedScaleOptions(where, options));
  for (const [field, length] of [['space.unit', unit], ['type.base', base]] as const) {
    if (length.unit !== 'rem') throw new ThemeError(`${where}: ${field} must be in rem for a numeric scale; got ${JSON.stringify(`${length.n}${length.unit}`)}; use scaleValues() for other units`);
  }
  return { text: textNumbers(base.n, ratio), space: spaceNumbers(unit.n, multipliers) };
}

/** One block on the selector declaring every mode-independent token, as text. scales() wraps it. */
export function scalesText(options: ScaleOptions = {}): string {
  const where = 'scales()';
  return scalesIn(where, checkedScaleOptions(where, options));
}

export function checkedScaleOptions(where: string, given: unknown, accepted: readonly string[] = scaleKeys): ScaleOptions {
  const o = options<ScaleOptions>(where, given, accepted);
  options(where, o.space, ['unit', 'multipliers'], 'space');
  options(where, o.type, ['base', 'ratio'], 'type');
  options(where, o.fonts, fontRoles, 'fonts');
  options(where, o.leading, leadingNames, 'leading');
  options(where, o.weight, weightNames, 'weight');
  options(where, o.radius, radiusSteps, 'radius');
  options(where, o.stroke, strokeSteps, 'stroke');
  return o;
}

export function scalesIn(where: string, options: ScaleOptions, set?: Readonly<Record<string, string>>): string {
  const on = selector(where, options.selector ?? ':root');
  const { space, type } = { ...scaleDefaults, ...options };
  const unit = space.unit ?? scaleDefaults.space.unit;
  const multipliers = space.multipliers ?? scaleDefaults.space.multipliers;
  const comment = `/* theme: scales — space ${unit} x [${multipliers.join(' ')}]; type ${type.base ?? scaleDefaults.type.base} x ${type.ratio ?? scaleDefaults.type.ratio}^n, n = -2..4 */\n`;
  return checked(where, comment + block(on, declarations(where, pinned(scaleRecord(scaleValuesIn(where, options)), set))));
}

/** The thirty-one mode-independent values keyed by property, in print order. */
export function scaleRecord(v: ScaleValues): Readonly<Record<string, string>> {
  return { ...keyed('space', v.space), ...keyed('text', v.text), ...keyed('font', v.font), ...keyed('leading', v.leading), ...keyed('weight', v.weight), ...keyed('radius', v.radius), ...keyed('stroke', v.stroke) };
}

export function scaleValuesIn(where: string, options: ScaleOptions): ScaleValues {
  const { unit, base, ratio, multipliers } = derive(where, options);
  const space = spaceNumbers(unit.n, multipliers);
  const text = textNumbers(base.n, ratio);
  return {
    space: record(spaceSteps, (step) => (space[step] === 0 ? '0' : `${space[step]}${unit.unit}`)),
    text: record(textSteps, (step) => `${text[step]}${base.unit}`),
    font: strings(where, 'fonts', fontRoles, { ...scaleDefaults.fonts, ...options.fonts }),
    leading: numbers(where, 'leading', leadingNames, { ...scaleDefaults.leading, ...options.leading }),
    weight: numbers(where, 'weight', weightNames, { ...scaleDefaults.weight, ...options.weight }),
    radius: strings(where, 'radius', radiusSteps, { ...scaleDefaults.radius, ...options.radius }),
    stroke: strings(where, 'stroke', strokeSteps, { ...scaleDefaults.stroke, ...options.stroke }),
  };
}

interface Derivation {
  readonly unit: { readonly n: number; readonly unit: string };
  readonly base: { readonly n: number; readonly unit: string };
  readonly ratio: number;
  readonly multipliers: readonly number[];
}

/** The validated inputs of the two length scales: unit, base, ratio, multipliers. */
function derive(where: string, options: ScaleOptions): Derivation {
  const space = { ...scaleDefaults.space, ...options.space };
  const type = { ...scaleDefaults.type, ...options.type };
  const unit = length(where, 'space.unit', space.unit);
  const base = length(where, 'type.base', type.base);
  if (typeof type.ratio !== 'number' || !Number.isFinite(type.ratio) || type.ratio <= 1) throw new ThemeError(`${where}: type.ratio must be greater than 1; got ${describe(type.ratio)}`);
  const m = space.multipliers;
  if (!Array.isArray(m) || m.length !== spaceSteps.length) throw new ThemeError(`${where}: space.multipliers must be exactly ${spaceSteps.length} numbers, one per step; got ${Array.isArray(m) ? m.length : typeof m}`);
  if (m[0] !== 0) throw new ThemeError(`${where}: space.multipliers[0] must be 0, so --space-0 is 0; got ${m[0]}`);
  for (let i = 1; i < m.length; i++) {
    if (typeof m[i] !== 'number' || !Number.isFinite(m[i]) || m[i] <= m[i - 1]) throw new ThemeError(`${where}: space.multipliers must ascend; [${i}] = ${m[i]} is not above [${i - 1}] = ${m[i - 1]}`);
  }
  return { unit, base, ratio: type.ratio, multipliers: m };
}

function spaceNumbers(unit: number, multipliers: readonly number[]): Readonly<Record<SpaceStep, number>> {
  return numbered(spaceSteps, (i) => (multipliers[i] === 0 ? 0 : Number(number(unit * multipliers[i], SPACE_PLACES))));
}

function textNumbers(base: number, ratio: number): Readonly<Record<TextStep, number>> {
  return numbered(textSteps, (i) => Number(number(base * ratio ** (i - 2), TEXT_PLACES)));
}

function length(where: string, field: string, text: unknown): { n: number; unit: string } {
  const parsed = typeof text === 'string' ? parseLength(text) : null;
  if (!parsed || parsed.n <= 0) throw new ThemeError(`${where}: ${field} must be a positive number with a unit, like '0.25rem'; got ${describe(text)}`);
  return parsed;
}

function record<N extends string>(names: readonly N[], make: (name: N, i: number) => string): Readonly<Record<N, string>> {
  return Object.fromEntries(names.map((name, i) => [name, make(name, i)])) as Record<N, string>;
}

function numbered<N extends string>(names: readonly N[], make: (i: number) => number): Readonly<Record<N, number>> {
  return Object.freeze(Object.fromEntries(names.map((name, i) => [name, make(i)]))) as Record<N, number>;
}

function strings<N extends string>(where: string, field: string, names: readonly N[], given: Record<N, unknown>): Readonly<Record<N, string>> {
  return record(names, (name) => {
    const v = given[name];
    if (typeof v !== 'string' || v.trim() === '') throw new ThemeError(`${where}: ${field}.${name} must be a non-empty string; got ${describe(v)}`);
    return v;
  });
}

function numbers<N extends string>(where: string, field: string, names: readonly N[], given: Record<N, unknown>): Readonly<Record<N, string>> {
  return record(names, (name) => {
    const v = given[name];
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) throw new ThemeError(`${where}: ${field}.${name} must be a positive number; got ${describe(v)}`);
    return String(v);
  });
}

function keyed<N extends string>(group: 'space' | 'text' | 'font' | 'leading' | 'weight' | 'radius' | 'stroke', values: Readonly<Record<N, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([name, v]) => [property(group, name), v as string]));
}
