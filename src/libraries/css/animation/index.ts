/**
 * animation: timing tokens, keyframes, stagger ladders and compiled timelines.
 *
 * A duration or easing is always a token, so `tokens()` can zero every one of them under reduced
 * motion and every animation in the tree stops at once. A stagger ladder sets `--anim-index` and
 * never a delay, so a staggered element can still carry a multi-step timeline.
 *
 * ./README.md has the rules, the values, and what stagger and timeline do together.
 */
export { type Keyframe, type KeyframeIdent, type KeyframeName, ident, keyframeNames, keyframeRules, keyframes, vocabulary } from './keyframes.ts';
export { type StaggerOptions, stagger, staggerLimit } from './stagger.ts';
export { type StepOptions, type Timeline, type TimelineStep, animate, animation, defaultCap, timeline, timelines, total } from './timeline.ts';
export { type AnimationOptions, type DurationToken, type EaseToken, type Knob, attributes, defaults, duration, durationTokens, ease, easeTokens, tokens } from './tokens.ts';

import { durationProperty, durationTokens, easeProperty, easeTokens, knobs, names } from './tokens.ts';

/** Every custom property this engine defines (12), reads from another engine (none) and re-declares (none). */
export const properties: { readonly defines: readonly string[]; readonly reads: readonly string[]; readonly overrides: readonly string[] } = Object.freeze({
  defines: Object.freeze([...durationTokens.map(durationProperty), ...easeTokens.map(easeProperty), names.stagger, names.index, ...knobs.map((knob) => names[knob])]),
  reads: Object.freeze([]),
  overrides: Object.freeze([]),
});
