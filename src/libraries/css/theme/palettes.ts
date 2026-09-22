/**
 * A palette is a hue plus optional pins. The eleven roles derive in oklch()
 * from one table with two lightness columns, light and dark: dark mode is a
 * column, never a second hand-written palette. Pure data; no CSS here.
 */
import { ThemeError, value } from './emit.ts';
import { type ColorRole, colorRoles } from './names.ts';

/** Degrees, 0 to 360, finite. */
export type Hue = number;
/** CSS colour text per role. */
export type Roles = Readonly<Record<ColorRole, string>>;

export interface Palette {
  /** kebab-case; appears in the emitted comment. */
  readonly name: string;
  /** The one decision that matters: the accent hue. */
  readonly accent: Hue;
  /** Accent saturation, 0.02 muted … 0.25 vivid. Default 0.12. */
  readonly chroma?: number;
  /** The hue the greys lean toward. Default: the accent's. */
  readonly neutral?: Hue;
  /** Chroma of the greys: 0.005 is near-neutral, 0.02 is visibly tinted. Default 0.005. */
  readonly tint?: number;
  /** Hand-picked values that win over derivation, per mode. Pin accent and you must pin on-accent too. */
  readonly light?: Partial<Roles>;
  readonly dark?: Partial<Roles>;
}

export type PaletteName = 'neutral' | 'accent';

/** neutral: grey surfaces, a calm blue accent. accent: tinted surfaces, a vivid violet accent — accent-forward. */
export const palettes: Readonly<Record<PaletteName, Palette>> = {
  neutral: { name: 'neutral', accent: 250, chroma: 0.12, tint: 0.005 },
  accent: { name: 'accent', accent: 300, chroma: 0.2, tint: 0.02 },
};

/** Lightness per mode, chroma, hue. L is held as a number so the contrast proxy in the test can read it. */
interface Derivation {
  readonly l: readonly [light: number, dark: number];
  readonly c: 'tint' | 'accent' | number;
  readonly h: 'neutral' | 'accent' | number;
}

/** on-accent is not here: it follows accent's L, below. Raised is lighter in both modes — elevation is light. */
export const derivation: Readonly<Record<Exclude<ColorRole, 'on-accent'>, Derivation>> = {
  surface: { l: [0.98, 0.15], c: 'tint', h: 'neutral' },
  'surface-raised': { l: [1, 0.21], c: 'tint', h: 'neutral' },
  text: { l: [0.2, 0.93], c: 'tint', h: 'neutral' },
  'text-muted': { l: [0.48, 0.7], c: 'tint', h: 'neutral' },
  border: { l: [0.88, 0.3], c: 'tint', h: 'neutral' },
  accent: { l: [0.42, 0.72], c: 'accent', h: 'accent' },
  focus: { l: [0.6, 0.78], c: 'accent', h: 'accent' },
  danger: { l: [0.55, 0.7], c: 0.19, h: 25 },
  success: { l: [0.55, 0.72], c: 0.16, h: 145 },
  warning: { l: [0.72, 0.8], c: 0.16, h: 80 },
};

/** Text on the accent: dark ink when the accent is light (L ≥ this), near-white otherwise. */
export const onAccentThreshold = 0.66;

export const modes = ['light', 'dark'] as const;
export type Mode = (typeof modes)[number];

/** Every role for both modes: pins first, the table otherwise. Throws ThemeError on a bad palette. */
export function resolvePalette(p: Palette | PaletteName): { readonly light: Roles; readonly dark: Roles } {
  const palette = typeof p === 'string' ? named(p) : validated(p);
  const where = `palette "${palette.name}"`;
  const chroma = palette.chroma ?? 0.12;
  const tint = palette.tint ?? 0.005;
  const neutral = palette.neutral ?? palette.accent;
  const resolve = (mode: Mode): Roles => {
    const pins = palette[mode] ?? {};
    const column = mode === 'light' ? 0 : 1;
    const derived = (role: Exclude<ColorRole, 'on-accent'>): string => {
      const { l, c, h } = derivation[role];
      return oklch(l[column], c === 'tint' ? tint : c === 'accent' ? chroma : c, h === 'neutral' ? neutral : h === 'accent' ? palette.accent : h);
    };
    const onAccent = (): string => {
      if (pins.accent !== undefined) {
        throw new ThemeError(`${where}: ${mode}.accent is hand-picked, so ${mode}.on-accent must be too — the engine cannot read the lightness of ${JSON.stringify(pins.accent)}`);
      }
      return derivation.accent.l[column] >= onAccentThreshold ? oklch(0.15, tint, palette.accent) : oklch(0.99, 0, 0);
    };
    const entries = colorRoles.map((role) => {
      const pinned = pins[role];
      if (pinned !== undefined) return [role, value(where, `${mode}.${role}`, pinned)];
      return [role, role === 'on-accent' ? onAccent() : derived(role)];
    });
    return Object.fromEntries(entries) as Roles;
  };
  return { light: resolve('light'), dark: resolve('dark') };
}

/** "oklch(55% 0.12 250)": L one decimal as a percentage, C three decimals, H an integer. */
export function oklch(l: number, c: number, h: number): string {
  return `oklch(${trim((l * 100).toFixed(1))}% ${trim(c.toFixed(3))} ${Math.round(h)})`;
}

function trim(text: string): string {
  return String(Number(text));
}

function named(name: string): Palette {
  const palette = Object.hasOwn(palettes, name) ? palettes[name as PaletteName] : undefined;
  if (!palette) throw new ThemeError(`palette ${JSON.stringify(name)} is not shipped; shipped palettes are ${Object.keys(palettes).join(', ')}`);
  return palette;
}

function validated(p: Palette): Palette {
  if (typeof p !== 'object' || p === null) throw new ThemeError(`palette must be a name or a Palette object; got ${String(p)}`);
  if (typeof p.name !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(p.name)) throw new ThemeError(`palette name must be kebab-case; got ${JSON.stringify(p.name)}`);
  const where = `palette "${p.name}"`;
  checkHue(where, 'accent', p.accent);
  if (p.neutral !== undefined) checkHue(where, 'neutral', p.neutral);
  if (p.chroma !== undefined) checkChroma(where, 'chroma', p.chroma);
  if (p.tint !== undefined) checkChroma(where, 'tint', p.tint);
  for (const mode of modes) {
    const pins = p[mode];
    if (pins === undefined) continue;
    if (typeof pins !== 'object' || pins === null) throw new ThemeError(`${where}: ${mode} must be an object of roles; got ${String(pins)}`);
    for (const role of Object.keys(pins)) {
      if (!(colorRoles as readonly string[]).includes(role)) throw new ThemeError(`${where}: ${mode}.${role} is not a role; roles are ${colorRoles.join(', ')}`);
    }
  }
  return p;
}

/** Throws ThemeError unless h is a finite hue in degrees, 0 to 360. */
export function checkHue(where: string, field: string, h: unknown): asserts h is number {
  if (typeof h !== 'number' || !Number.isFinite(h) || h < 0 || h > 360) throw new ThemeError(`${where}: ${field} must be a finite hue in degrees, 0 to 360; got ${String(h)}`);
}

/** Throws ThemeError unless c is a chroma between 0 and 0.4. */
export function checkChroma(where: string, field: string, c: unknown): asserts c is number {
  if (typeof c !== 'number' || !Number.isFinite(c) || c < 0 || c > 0.4) throw new ThemeError(`${where}: ${field} must be a chroma between 0 and 0.4; got ${String(c)}`);
}
