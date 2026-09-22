/**
 * One home for every name this engine defines. The text generator and the types
 * both read these arrays, so a name cannot exist in one and not the other. The
 * guaranteed names are the guaranteed token names'; every other engine reads
 * them with var(--name, <fallback>) and defines nothing under these prefixes.
 */
export const colorRoles = ['surface', 'surface-raised', 'text', 'text-muted', 'accent', 'on-accent', 'border', 'focus', 'danger', 'success', 'warning'] as const;
/** Strings: css-layout's primitives take a step as '0'..'8'. */
export const spaceSteps = ['0', '1', '2', '3', '4', '5', '6', '7', '8'] as const;
export const textSteps = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'] as const;
export const fontRoles = ['body', 'heading', 'mono'] as const;
export const leadingNames = ['tight', 'normal', 'loose'] as const;
export const weightNames = ['normal', 'medium', 'bold'] as const;
export const radiusSteps = ['none', 'sm', 'md', 'lg', 'full'] as const;
export const shadowSteps = ['none', 'sm', 'md', 'lg'] as const;
/**
 * Border widths. One step, because one width is in use: `hairline` is the 1px rule every
 * bordered surface draws, paired with `color('border')`. Not SVG's `stroke` (a paint) —
 * this is a width, the thing `stroke-width` and `border-width` take.
 */
export const strokeSteps = ['hairline'] as const;

export type ColorRole = (typeof colorRoles)[number];
export type SpaceStep = (typeof spaceSteps)[number];
export type TextStep = (typeof textSteps)[number];
export type FontRole = (typeof fontRoles)[number];
export type LeadingName = (typeof leadingNames)[number];
export type WeightName = (typeof weightNames)[number];
export type RadiusStep = (typeof radiusSteps)[number];
export type ShadowStep = (typeof shadowSteps)[number];
export type StrokeStep = (typeof strokeSteps)[number];

/** The nine prefixes this engine owns, each with its names: a property is `--<prefix>-<name>`. */
export const groups = {
  color: colorRoles,
  space: spaceSteps,
  text: textSteps,
  font: fontRoles,
  leading: leadingNames,
  weight: weightNames,
  radius: radiusSteps,
  shadow: shadowSteps,
  stroke: strokeSteps,
} as const;
export type Group = keyof typeof groups;

/** The full property name of every token: '--color-accent' | '--space-4' | … — the 46, as a type. */
export type TokenName = { [G in Group]: `--${G}-${(typeof groups)[G][number]}` }[Group];

/** The custom property for a group and a name: property('color', 'accent') → '--color-accent'. */
export const property = (group: Group, name: string): `--${string}` => `--${group}-${name}`;

/** Every custom property this engine defines (46), reads (none) and re-declares from another engine (none). */
export const properties: { readonly defines: readonly string[]; readonly reads: readonly string[]; readonly overrides: readonly string[] } = Object.freeze({
  defines: Object.freeze((Object.keys(groups) as Group[]).flatMap((group) => groups[group].map((name) => property(group, name)))),
  reads: Object.freeze([]),
  overrides: Object.freeze([]),
});
