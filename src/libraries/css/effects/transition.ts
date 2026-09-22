/**
 * Declarations for an author's own rule, never a rule: transition() writes the
 * longhands with the property list explicit, and elevation() writes the shadow
 * step as the elevation-n row does. Both go in at statement start or inside the
 * author's `:scope { }` in a css`` block (a whole declaration is verbatim text).
 */
import { type DurationToken, duration, type EaseToken, ease, type Elevation, checkElevation, elevationSteps, shadow } from './names.ts';
import { declaration, fail, known, text, timed } from './text.ts';

export type TransitionProperty =
  | 'opacity'
  | 'transform'
  | 'translate'
  | 'scale'
  | 'rotate'
  | 'filter'
  | 'backdrop-filter'
  | 'box-shadow'
  | 'background-color'
  | 'color'
  | 'border-color'
  | 'outline-color'
  | 'display'
  | 'overlay'
  | 'visibility'
  | 'all'
  | (string & {});

export interface TransitionOptions {
  /** One of the four guaranteed tokens; an author's extra token would be a silent 0s, so it is refused. */
  duration?: DurationToken;
  ease?: EaseToken;
  /** A CSS <time>, e.g. Animation's total(). */
  delay?: string;
}

/** The properties every [data-fx] element transitions: what the effects change, and nothing that lays out. */
export const transitioned: readonly TransitionProperty[] = Object.freeze(['opacity', 'transform', 'box-shadow', 'filter', 'backdrop-filter']);

/** The properties that only switch: listed, `transition-behavior: allow-discrete` is added as its own line. */
export const discrete: readonly string[] = Object.freeze(['display', 'overlay', 'visibility', 'content-visibility']);

/**
 * `transition-property: opacity, transform; transition-duration: calc(var(--duration-fast, 150ms) * var(--fx-speed, 1));
 * transition-timing-function: var(--ease-out, ease-out);` — plus `transition-delay` when given and
 * `transition-behavior: allow-discrete;` when display, overlay or visibility is listed. The list defaults to
 * `transitioned`; `['all']` is honoured because the author wrote it; an empty list throws.
 */
export function transition(properties: readonly TransitionProperty[] = transitioned, options: TransitionOptions = {}): string {
  if (!Array.isArray(properties)) fail('transition', 'the property list is not an array', "list the properties, e.g. ['opacity', 'transform']");
  known('transition', options, ['duration', 'ease', 'delay']);
  if (properties.length === 0) fail('transition', 'the property list is empty', "list the properties to transition, e.g. ['opacity', 'transform'], or leave it out for the default");
  const listed = properties.map((property) => text('transition', 'a property', property));
  const lines = [
    declaration('transition-property', listed.join(', ')),
    declaration('transition-duration', timed(duration(options.duration ?? 'fast', 'transition'))),
    declaration('transition-timing-function', ease(options.ease ?? 'out', 'transition')),
  ];
  if (options.delay !== undefined) lines.push(declaration('transition-delay', text('transition', 'delay', options.delay)));
  if (listed.some((property) => discrete.includes(property))) lines.push(declaration('transition-behavior', 'allow-discrete'));
  return lines.join('\n');
}

/** The elevation-n row's body: `--fx-shadow`, `--fx-shadow-lifted` one step up, and the box-shadow reading the first. */
export function elevationBody(level: Elevation): string {
  const resting = shadow(elevationSteps[level]!);
  const lifted = shadow(elevationSteps[Math.min(level + 1, elevationSteps.length - 1)]!);
  return [declaration('--fx-shadow', resting), declaration('--fx-shadow-lifted', lifted), declaration('box-shadow', `var(--fx-shadow, ${resting})`)].join('\n');
}

/**
 * `elevation(2)` → the level's shadow declarations, as the elevation-2 row writes them, for a rule that is not
 * on data-fx; `{ lift: true }` adds the transition of transform and box-shadow so a `rules('lift', { selector,
 * states })` beside it animates.
 */
export function elevation(level: Elevation, options: { lift?: boolean } = {}): string {
  const body = elevationBody(checkElevation('elevation', level));
  known('elevation', options, ['lift']);
  return options.lift ? `${body}\n${transition(['transform', 'box-shadow'])}` : body;
}
