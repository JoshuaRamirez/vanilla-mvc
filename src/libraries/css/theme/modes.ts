/**
 * What a selector declares to choose its colours and its mode. palette() is one
 * block: every --color-<role> as light-dark(<light>, <dark>) from the palette's
 * two columns, and every --shadow-<step>. modes() is the switch: color-scheme.
 * Dark mode is not a second block; it is the second argument.
 */
import { block, checked, declarations, options, pinned, selector } from './emit.ts';
import { type ShadowStep, colorRoles, property, shadowSteps } from './names.ts';
import { type Palette, type PaletteName, resolvePalette } from './palettes.ts';

export interface PaletteOptions {
  /** The rule the palette is declared on. Default ':root'. */
  readonly selector?: string;
  /** Replace a shadow: any CSS shadow list. Write the colour as light-dark(<light>, <dark>) where the modes differ. */
  readonly shadow?: Partial<Record<ShadowStep, string>>;
}

export const paletteKeys: readonly string[] = Object.freeze(['selector', 'shadow']);

export const shadowDefaults: Readonly<Record<ShadowStep, string>> = {
  none: 'none',
  sm: '0 1px 2px light-dark(oklch(0% 0 0 / 0.08), oklch(0% 0 0 / 0.5))',
  md: '0 4px 12px light-dark(oklch(0% 0 0 / 0.1), oklch(0% 0 0 / 0.55))',
  lg: '0 12px 32px light-dark(oklch(0% 0 0 / 0.14), oklch(0% 0 0 / 0.6))',
};

/**
 * One block on the selector: the eleven colour roles and four shadows, as text. palette() wraps it.
 * A scoped palette — palette('accent', { selector: '.promo' }) — re-colours a subtree in both modes
 * with no rule of its own for mode: each light-dark() resolves where the token is read, under the
 * color-scheme the subtree inherits.
 */
export function paletteText(p: Palette | PaletteName, options: PaletteOptions = {}): string {
  const where = 'palette()';
  return paletteIn(where, p, checkedPaletteOptions(where, options));
}

export function checkedPaletteOptions(where: string, given: unknown, accepted: readonly string[] = paletteKeys): PaletteOptions {
  const o = options<PaletteOptions>(where, given, accepted);
  options(where, o.shadow, shadowSteps, 'shadow');
  return o;
}

export function paletteIn(where: string, p: Palette | PaletteName, options: PaletteOptions, set?: Readonly<Record<string, string>>): string {
  const on = selector(where, options.selector ?? ':root');
  const name = typeof p === 'string' ? p : p.name;
  const comment = `/* theme: palette "${name}" — each role is light-dark(<light>, <dark>); color-scheme picks */\n`;
  return checked(where, comment + block(on, declarations(where, pinned(paletteValues(p, options.shadow), set))));
}

/**
 * The fifteen values a palette block declares, keyed by property — `--color-<role>` as
 * light-dark(<light>, <dark>) from the two columns, `--shadow-<step>` — the one place that text is made:
 * palette() prints it, `defaults` and the readers fall back to it, accent() picks three of it.
 */
export function paletteValues(p: Palette | PaletteName, shadow: Partial<Record<ShadowStep, string>> = {}): Readonly<Record<string, string>> {
  const { light, dark } = resolvePalette(p);
  const out: Record<string, string> = {};
  for (const role of colorRoles) out[property('color', role)] = `light-dark(${light[role]}, ${dark[role]})`;
  for (const step of shadowSteps) out[property('shadow', step)] = shadow[step] ?? shadowDefaults[step];
  return out;
}

/**
 * The mode switch for a document, as text; modes() wraps it. The selector takes `color-scheme:
 * light dark` — the system's preference, natively, no media query — and [data-theme="light"|"dark"]
 * on any element sets its subtree. The two attribute rules come after the selector's so that
 * data-theme on <html> beats it at equal specificity. color-scheme inherits, so a nested data-theme
 * flips its own subtree and nothing else.
 */
export function modesText(on: string = ':root'): string {
  const where = 'modes()';
  const s = selector(where, on);
  return checked(
    where,
    `/* theme: modes — color-scheme is the switch; light dark is the system's choice, data-theme overrides for a subtree */\n` +
      `${s} { color-scheme: light dark; }\n` +
      `[data-theme="light"] { color-scheme: light; }\n` +
      `[data-theme="dark"] { color-scheme: dark; }\n`,
  );
}
