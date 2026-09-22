/**
 * responsive: breakpoints as one source of truth, media and container queries written on them,
 * and fluid type and space.
 *
 * Every band is half-open: `below(x)` is `width < x`, `atLeast(x)` is `width >= x`, so at every
 * width exactly one applies — no gap, no overlap, no epsilon. A component asks its container
 * (`inContainer.atLeast.md`); the shell asks the viewport (`media.atLeast.md`). Same verbs, same
 * names, same cost.
 *
 * ./README.md has the bands, the two-line rule, the channels with their costs, fluid scales and
 * the browser floor.
 */
export { type Above, type Breakpoint, type Rem, type Upper, type Width, breakpointNames, breakpoints, width } from './breakpoints.ts';
export { type ContainerCondition, atContainer, inContainer } from './container.ts';
export {
  type FluidDefaults,
  type FluidName,
  type FluidOptions,
  type FluidSpace,
  type FluidSpaceStep,
  type FluidText,
  type FluidUnit,
  type Pair,
  type SpaceStep,
  type TextStep,
  clampBetween,
  fluid,
  fluidDeclarations,
  fluidDefaults,
  fluidValues,
  spaceSteps,
  textSteps,
} from './fluid.ts';
export { atLeast, below, between, media } from './media.ts';
export { type Queries, block } from './text.ts';

import { fluidValues } from './fluid.ts';

/**
 * The custom properties this engine defines (none), reads (none) and overrides:
 * exactly the sixteen --text-<step> and --space-<step> names of Names, the keys of
 * the same call that emits them, so the list and the sheet cannot disagree.
 */
export const properties: { readonly defines: readonly string[]; readonly reads: readonly string[]; readonly overrides: readonly string[] } =
  Object.freeze({
    defines: Object.freeze([]),
    reads: Object.freeze([]),
    overrides: Object.freeze(Object.keys(fluidValues())),
  });
