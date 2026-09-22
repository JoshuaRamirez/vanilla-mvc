/**
 * The four rule-emitting functions as StyleResults: one css call each, the text
 * function's output as one raw hole at statement start, so `${theme()}` in a document sheet
 * composes inline exactly as the string did. The only file here that reads templates/.
 */
import { css, type StyleResult } from '../templates/index.ts';
import { modesText, type PaletteOptions, paletteText } from './modes.ts';
import type { Palette, PaletteName } from './palettes.ts';
import { type ScaleOptions, scalesText } from './scales.ts';
import { type ThemeOptions, themeText } from './theme.ts';

/** The document's sheet: every token on ':root', both modes, the [data-theme] switch. Text: themeText(). */
export function theme(options: ThemeOptions = {}): StyleResult {
  return css`${themeText(options)}`;
}

/** One block declaring the thirty mode-independent tokens on the selector. Text: scalesText(). */
export function scales(options: ScaleOptions = {}): StyleResult {
  return css`${scalesText(options)}`;
}

/** One block declaring the eleven colours and four shadows on the selector, both modes. Text: paletteText(). */
export function palette(p: Palette | PaletteName, options: PaletteOptions = {}): StyleResult {
  return css`${paletteText(p, options)}`;
}

/** The mode switch: `<selector> { color-scheme: light dark }` and the two [data-theme] rules. Text: modesText(). */
export function modes(selector: string = ':root'): StyleResult {
  return css`${modesText(selector)}`;
}
