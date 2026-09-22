/**
 * theme(): the whole sheet for a document, one line of composition over
 * scales(), palette() and modes(). Every option is one a re-declared token
 * cannot change: the palette as a set, the ramp mathematics, the fonts — and
 * `set`, a literal pinned in place of what the mathematics would print.
 */
import { checked, ThemeError, value } from './emit.ts';
import { checkedPaletteOptions, modesText, type PaletteOptions, paletteIn } from './modes.ts';
import { groups, properties, type TokenName } from './names.ts';
import type { Palette, PaletteName } from './palettes.ts';
import { checkedScaleOptions, type ScaleOptions, scaleKeys, scalesIn } from './scales.ts';

export interface ThemeOptions extends ScaleOptions {
  /** 'neutral' (default), 'accent', or a Palette of your own. */
  readonly palette?: Palette | PaletteName;
  readonly shadow?: PaletteOptions['shadow'];
  /**
   * Pin any token to a literal, by its full name: { '--space-4': '1.25rem' }. The pin replaces the
   * declaration in its block — once, the derived value nowhere. A --color-* or --shadow-* pin must
   * carry one light-dark(<light>, <dark>) so both modes resolve, or be a mode-neutral keyword (none,
   * transparent, currentcolor, inherit, initial, unset); to accept one colour for both modes, say so:
   * light-dark(x, x). Anything else throws, so a pinned colour cannot silently lose dark mode.
   */
  readonly set?: Partial<Record<TokenName, string>>;
}

/** Values a colour or shadow pin may carry without a light-dark(): they mean the same in both modes. */
const MODE_NEUTRAL = new Set(['none', 'transparent', 'currentcolor', 'inherit', 'initial', 'unset']);

const CASCADE =
  `/* theme: the selector below defines every token once. A scope — [data-theme], or any element an author\n` +
  `   applies palette() or tokens() to — re-declares for its subtree: custom properties inherit, so the\n` +
  `   nearest declaring ancestor wins. An element overrides for itself. Read a token with var(--name, fallback). */\n`;

/** The keys theme() accepts: ScaleOptions' and palette, shadow, set. */
export const themeKeys: readonly string[] = Object.freeze([...scaleKeys, 'palette', 'shadow', 'set']);

/**
 * The document's sheet as text; theme() wraps it. The cascade rule as a comment, then the scales,
 * palette and modes text on the selector. With a selector other than ':root' the mode rules are left
 * out: an island's mode is the page's — color-scheme inherits and the page's [data-theme] rules
 * already reach it. The island is the author's: apply responsive's fluid({ selector }) to it too.
 */
export function themeText(given: ThemeOptions = {}): string {
  const where = 'theme()';
  const o = checkedScaleOptions(where, given, themeKeys) as ThemeOptions;
  const { palette = 'neutral', shadow, selector = ':root', set, ...scale } = o;
  checkedPaletteOptions(where, { shadow });
  const pins = set === undefined ? undefined : checkedPins(where, set);
  const text = CASCADE + scalesIn(where, { selector, ...scale }, pins) + paletteIn(where, palette, { selector, shadow }, pins) + (selector === ':root' ? modesText(selector) : '');
  return checked(where, text);
}

function checkedPins(where: string, set: Partial<Record<TokenName, string>>): Readonly<Record<string, string>> {
  if (typeof set !== 'object' || set === null) throw new ThemeError(`${where}: set must be an object of tokens by full name, like { '--space-4': '1.25rem' }; got ${String(set)}`);
  const out: Record<string, string> = {};
  for (const [name, given] of Object.entries(set)) {
    if (!properties.defines.includes(name)) throw new ThemeError(`${where}: set["${name}"] is not a token this engine defines; names are --<group>-<name> over the groups ${Object.keys(groups).join(', ')}`);
    if (given === undefined) continue;
    const text = value(where, `set["${name}"]`, given);
    if ((name.startsWith('--color-') || name.startsWith('--shadow-')) && !MODE_NEUTRAL.has(text.trim().toLowerCase())) {
      const count = text.split('light-dark(').length - 1;
      if (count !== 1) {
        throw new ThemeError(`${where}: set["${name}"] is ${JSON.stringify(text)} — a colour or shadow pin carries exactly one light-dark(<light>, <dark>) so both modes resolve; to accept one colour for both modes write light-dark(x, x)`);
      }
    }
    out[name] = text;
  }
  return out;
}
