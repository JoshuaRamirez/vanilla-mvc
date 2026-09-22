/**
 * theme: design tokens as custom properties — colour, space, type, radius, shadow, stroke — with
 * readers that write `var(--name, <default>)` so a component renders the same before and after the
 * theme is applied.
 *
 * Every other engine reads these names and declares none of them. A colour token is one
 * `light-dark(<light>, <dark>)` declaration and `color-scheme` is the switch, so one declaration
 * serves both modes and `data-theme` flips any subtree.
 *
 * ./README.md has the cascade, mode and binding rules, what this engine guarantees the others,
 * the runtime-override half, and the browser floor.
 */
export { ThemeError } from './emit.ts';
export {
  type ColorRole,
  colorRoles,
  type FontRole,
  fontRoles,
  type Group,
  groups,
  type LeadingName,
  leadingNames,
  properties,
  property,
  type RadiusStep,
  radiusSteps,
  type ShadowStep,
  shadowSteps,
  type SpaceStep,
  spaceSteps,
  type StrokeStep,
  strokeSteps,
  type TextStep,
  textSteps,
  type TokenName,
  type WeightName,
  weightNames,
} from './names.ts';
export { type ScaleNumbers, type ScaleOptions, type ScaleValues, scaleDefaults, scaleNumbers, scalesText, scaleValues } from './scales.ts';
export { derivation, type Hue, type Mode, modes as modeNames, onAccentThreshold, type Palette, type PaletteName, palettes, resolvePalette, type Roles } from './palettes.ts';
export { modesText, paletteText, type PaletteOptions, shadowDefaults } from './modes.ts';
export { accent, type AccentToken, assign, color, defaults, font, leading, radius, shadow, space, stroke, text, tokens, type Tokens, weight } from './read.ts';
export { modes, palette, scales, theme } from './styles.ts';
export { themeText, type ThemeOptions } from './theme.ts';
