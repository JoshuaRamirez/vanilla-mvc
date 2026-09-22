import { type StyleResult, css } from '../templates/index.ts';
import { type ScaleNumbers, type SpaceStep, type TextStep, scaleDefaults, scaleNumbers, spaceSteps, textSteps } from '../theme/index.ts';
import { type Width, rems } from './breakpoints.ts';
import { aboveMax, notBelow, notLength, notMultipliers, notOption, notPair, notRatio, rootContainer, unknownKey } from './errors.ts';
import { fmt } from './text.ts';

// The step names are Theme's; this engine re-exports them and derives `properties.overrides` from them.
export { type SpaceStep, type TextStep, spaceSteps, textSteps };
/** The space steps that are fluid: --space-0 is always 0. */
export type FluidSpaceStep = Exclude<SpaceStep, '0'>;
/** The sixteen names fluid() re-declares. */
export type FluidName = `--text-${TextStep}` | `--space-${SpaceStep}`;

/** What "width" means in a fluid value: the viewport (vw) or the nearest container (cqi). */
export type FluidUnit = 'vw' | 'cqi';

/** A length in rem at `from` and at `to`: [min, max], 0 < min <= max. Equal means static. */
export type Pair = readonly [min: number, max: number];

/** Theme's type scale, each scalar widened to a pair: --text-md is base[0] at `from`, base[1] at `to`; step n is that × ratio^n, n = −2..4. */
export interface FluidText {
  /** Default Theme's base widened an eighth: [1, 1.125] for '1rem'. */
  readonly base?: Pair;
  /** Default Theme's ratio, 1.25. */
  readonly ratio?: number;
  /** Per-step minimums in rem replacing the derived ones (a scaleNumbers().text of Theme's); each still grows by base[1] / base[0]. */
  readonly sizes?: Partial<Record<TextStep, number>>;
}

/** Theme's space scale, the unit widened to a pair: --space-<i> is unit × multipliers[i]. */
export interface FluidSpace {
  /** Default Theme's unit widened a quarter: [0.25, 0.3125] for '0.25rem'. */
  readonly unit?: Pair;
  /** Nine numbers, [0] is 0, ascending. Default Theme's multipliers. */
  readonly multipliers?: readonly number[];
  /** Per-step minimums in rem replacing the derived ones; each still grows by unit[1] / unit[0]. */
  readonly sizes?: Partial<Record<FluidSpaceStep, number>>;
}

export interface FluidOptions {
  /** At and below this width the minimum holds. Default 'sm'. */
  readonly from?: Width;
  /** At and above this width the maximum holds; from must be below to. Default 'xl'. */
  readonly to?: Width;
  /** 'viewport' emits vw; 'container' emits cqi. Default 'viewport'. */
  readonly relativeTo?: 'viewport' | 'container';
  /** Which scales to emit. Default both. */
  readonly scales?: readonly ('text' | 'space')[];
  readonly text?: FluidText;
  readonly space?: FluidSpace;
  /** fluid() only: the rule the declarations go on. Default ':root'. */
  readonly selector?: string;
}

export interface FluidDefaults {
  readonly from: Width;
  readonly to: Width;
  readonly relativeTo: 'viewport' | 'container';
  readonly scales: readonly ('text' | 'space')[];
  readonly text: { readonly base: Pair; readonly ratio: number };
  readonly space: { readonly unit: Pair; readonly multipliers: readonly number[] };
  readonly selector: string;
}

/** This engine's growth: the second number of each default pair is Theme's first times these. */
const TEXT_GROWTH = 1.125;
const SPACE_GROWTH = 1.25;

/** One of Theme's scaleDefaults lengths ('1rem', '0.25rem') as a number of rem: the first number of each default pair. */
function rem(text: string): number {
  if (text === '0') return 0;
  const m = /^(\d+\.?\d*|\.\d+)rem$/.exec(text);
  if (!m) throw new RangeError(`responsive: fluid: Theme printed '${text}', not a rem length; this engine derives from Theme's rem scales only`);
  return Number(m[1]);
}

/**
 * The defaults, computed from Theme's scaleDefaults at module load: the first number of
 * each pair is Theme's literal, the second is it times this engine's growth; ratio and
 * multipliers are Theme's own. Nothing of Theme's is copied here.
 */
export const fluidDefaults: FluidDefaults = Object.freeze({
  from: 'sm' as const,
  to: 'xl' as const,
  relativeTo: 'viewport' as const,
  scales: Object.freeze(['text', 'space'] as const),
  text: Object.freeze({ base: Object.freeze([rem(scaleDefaults.type.base), rem(scaleDefaults.type.base) * TEXT_GROWTH] as const), ratio: scaleDefaults.type.ratio }),
  space: Object.freeze({ unit: Object.freeze([rem(scaleDefaults.space.unit), rem(scaleDefaults.space.unit) * SPACE_GROWTH] as const), multipliers: scaleDefaults.space.multipliers }),
  selector: ':root',
});

const OPTIONS = Object.freeze(['from', 'to', 'relativeTo', 'scales', 'text', 'space', 'selector']);
const TEXT_OPTIONS = Object.freeze(['base', 'ratio', 'sizes']);
const SPACE_OPTIONS = Object.freeze(['unit', 'multipliers', 'sizes']);
const RELATIVE_TO = Object.freeze(['viewport', 'container']);
const SCALES = Object.freeze(['text', 'space']);
const UNITS = Object.freeze(['vw', 'cqi']);
const FLUID_SPACE_STEPS: readonly FluidSpaceStep[] = spaceSteps.filter((s): s is FluidSpaceStep => s !== '0');

function known(fn: string, prefix: string, given: object | undefined, accepted: readonly string[]): void {
  for (const key of Object.keys(given ?? {})) if (!accepted.includes(key)) unknownKey(fn, prefix, key, accepted);
}

function length(fn: string, option: string, value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  return notLength(fn, option, value);
}

/**
 * The one formula. A length that is `min` rem at `from` rem of width, `max` rem at
 * `to`, and linear between. The inputs are printed and CSS interpolates:
 *
 *   clampBetween(1, 1.125, 40, 80, 'vw')
 *   → 'clamp(1rem, calc(1rem + 0.125 * (100vw - 40rem) / 40), 1.125rem)'
 *
 * JavaScript computes only max − min and to − from (four places; the first is the
 * difference of the printed decimals, so min + it is max exactly). clamp()'s outer
 * arguments are the inputs, so the value is exactly min at and below `from` and
 * exactly max at and above `to` — no tolerance. The divisor is a number, never a
 * length: calc() cannot divide a length by a length. min equal to max returns the
 * plain length. Exported so Theme or Semantics can make a fluid value of their own —
 * a radius, a measure — on the same mathematics.
 */
export function clampBetween(min: number, max: number, from: number, to: number, unit: FluidUnit = 'vw'): string {
  const fn = 'clampBetween';
  length(fn, 'min', min);
  length(fn, 'max', max);
  length(fn, 'from', from);
  length(fn, 'to', to);
  if (min > max) return aboveMax(fn, min, max);
  if (from >= to) return notBelow(fn, 'from', from, 'to', to, `write ${fn}(${min}, ${max}, 40, 80, …) with from below to`);
  if (!UNITS.includes(unit)) return notOption(fn, 'unit', unit, UNITS);
  const lo = fmt(min);
  const hi = fmt(max);
  if (lo === hi) return `${lo}rem`;
  const delta = fmt(Number(hi) - Number(lo));
  return `clamp(${lo}rem, calc(${lo}rem + ${delta} * (100${unit} - ${fmt(from)}rem) / ${fmt(to - from)}), ${hi}rem)`;
}

interface Resolved {
  readonly from: number;
  readonly to: number;
  readonly unit: FluidUnit;
  readonly scales: readonly ('text' | 'space')[];
}

function resolve(fn: string, options: FluidOptions): Resolved {
  known(fn, '', options, OPTIONS);
  known(fn, 'text.', options.text, TEXT_OPTIONS);
  known(fn, 'space.', options.space, SPACE_OPTIONS);
  known(fn, 'text.sizes.', options.text?.sizes, textSteps);
  known(fn, 'space.sizes.', options.space?.sizes, FLUID_SPACE_STEPS);
  const fromName = options.from ?? fluidDefaults.from;
  const toName = options.to ?? fluidDefaults.to;
  const from = rems(fn, fromName);
  const to = rems(fn, toName);
  if (from >= to) notBelow(fn, `from '${fromName}'`, from, `to '${toName}'`, to, `write from: 'sm', to: 'xl'`);
  const relativeTo = options.relativeTo ?? fluidDefaults.relativeTo;
  if (!RELATIVE_TO.includes(relativeTo)) notOption(fn, 'relativeTo', relativeTo, RELATIVE_TO);
  const scales = options.scales ?? fluidDefaults.scales;
  for (const scale of scales) if (!SCALES.includes(scale)) notOption(fn, 'scales', scale, SCALES);
  return { from, to, unit: relativeTo === 'container' ? 'cqi' : 'vw', scales };
}

function pair(fn: string, option: string, value: unknown): Pair {
  if (Array.isArray(value) && value.length === 2) {
    const [min, max] = value as unknown[];
    if (typeof min === 'number' && typeof max === 'number' && Number.isFinite(min) && Number.isFinite(max) && min > 0 && min <= max) return [min, max];
  }
  return notPair(fn, option, value);
}

function ratioOf(fn: string, value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 1 ? value : notRatio(fn, value);
}

function multipliersOf(fn: string, value: unknown): readonly number[] {
  if (!Array.isArray(value) || value.length !== spaceSteps.length) {
    return notMultipliers(fn, `has ${Array.isArray(value) ? value.length : String(value)} numbers, not ${spaceSteps.length}`, 'write one per step, 0 first, ascending');
  }
  if (value[0] !== 0) notMultipliers(fn, `[0] is ${String(value[0])}, not 0`, '--space-0 must be 0');
  for (let i = 1; i < value.length; i++) {
    if (typeof value[i] !== 'number' || !Number.isFinite(value[i]) || value[i] <= value[i - 1]) {
      notMultipliers(fn, `[${i}] ${String(value[i])} is not above [${i - 1}] ${String(value[i - 1])}`, 'write them ascending');
    }
  }
  return value;
}

/** The inputs of one end of both scales, validated with this engine's sentences before Theme derives from them. */
interface Inputs {
  readonly base: number;
  readonly ratio: number;
  readonly unit: number;
  readonly multipliers: readonly number[];
}

/**
 * Theme's derivation, in rem as numbers: base × ratio^n at three places, unit × multiplier at
 * four — exactly the decimals Theme prints (scaleNumbers()). The one place this engine asks
 * Theme for numbers; its inputs are already checked, so a ThemeError cannot surface here.
 */
function numbers(inputs: Inputs): ScaleNumbers {
  return scaleNumbers({ type: { base: `${inputs.base}rem`, ratio: inputs.ratio }, space: { unit: `${inputs.unit}rem`, multipliers: inputs.multipliers } });
}

function values(fn: string, options: FluidOptions, r: Resolved): [FluidName, string][] {
  const base = pair(fn, 'text.base', options.text?.base ?? fluidDefaults.text.base);
  const ratio = ratioOf(fn, options.text?.ratio ?? fluidDefaults.text.ratio);
  const unit = pair(fn, 'space.unit', options.space?.unit ?? fluidDefaults.space.unit);
  const multipliers = multipliersOf(fn, options.space?.multipliers ?? fluidDefaults.space.multipliers);
  const lo = numbers({ base: base[0], ratio, unit: unit[0], multipliers });
  const hi = numbers({ base: base[1], ratio, unit: unit[1], multipliers });
  const entries: [FluidName, string][] = [];
  if (r.scales.includes('text')) {
    const growth = base[1] / base[0];
    for (const step of textSteps) {
      const own = options.text?.sizes?.[step];
      const min = own === undefined ? lo.text[step] : length(fn, `text.sizes.${step}`, own);
      const max = own === undefined ? hi.text[step] : min * growth;
      entries.push([`--text-${step}`, clampBetween(min, max, r.from, r.to, r.unit)]);
    }
  }
  if (r.scales.includes('space')) {
    const growth = unit[1] / unit[0];
    for (const step of spaceSteps) {
      if (step === '0') {
        entries.push(['--space-0', '0']);
        continue;
      }
      const own = options.space?.sizes?.[step];
      const min = own === undefined ? lo.space[step] : length(fn, `space.sizes.${step}`, own);
      const max = own === undefined ? hi.space[step] : min * growth;
      entries.push([`--space-${step}`, clampBetween(min, max, r.from, r.to, r.unit)]);
    }
  }
  return entries;
}

/**
 * The runtime form: name → value, text steps then space steps, frozen.
 *
 *   { '--text-xs': 'clamp(0.64rem, calc(0.64rem + 0.08 * (100vw - 40rem) / 40), 0.72rem)', …, '--space-0': '0', … }
 *
 * As an object hole at statement start in a css tag it is a declaration block whose
 * values bind live on the scope element (the styling seam): a changed pair is
 * sixteen setProperty calls and no sheet replaced. Hoist it to a module constant;
 * it is pure and deterministic, never rebuilt per render. `scales` leaves a scale out.
 */
export function fluidValues(options: FluidOptions = {}): Readonly<Partial<Record<FluidName, string>>> {
  const fn = 'fluid';
  const r = resolve(fn, options);
  return Object.freeze(Object.fromEntries(values(fn, options, r))) as Readonly<Partial<Record<FluidName, string>>>;
}

/** The same as text: `--text-xs: clamp(…);` one per line, no selector, no braces — raw text for any block. */
export function fluidDeclarations(options: FluidOptions = {}): string {
  return Object.entries(fluidValues(options))
    .map(([name, value]) => `${name}: ${value};`)
    .join('\n');
}

/**
 * The fluid sheet: one css`` call, `${selector} {\n${fluidValues(options)}\n}\n`, the object a
 * live-bound declaration block on that selector. The shell composes `${fluid()}` after
 * `${theme()}` in the document sheet: same selector, order decides, no name changes. A
 * component writes `${fluid({ selector: ':scope', relativeTo: 'container' })}`.
 */
export function fluid(options: FluidOptions = {}): StyleResult {
  const selector = options.selector ?? fluidDefaults.selector;
  if ((options.relativeTo ?? fluidDefaults.relativeTo) === 'container' && selector.trim() === ':root') rootContainer('fluid');
  return css`${selector} {
${fluidValues(options)}
}
`;
}
