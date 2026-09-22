/**
 * One emitter per effect: body(effect) is the declarations a steady or state row
 * carries; the multi-rule effects (fade, flash, frost's backdrop) build their group
 * from a base selector. Each body reads only `--fx-*`, with the owner's token
 * underneath as the fallback's fallback, and references a keyframe by Animation's ident only.
 */
import { duration, ease, type Elevation, type FxEffect, knob, type Paired, pairing } from './names.ts';
import { block, declaration, timed } from './text.ts';
import { elevationBody, transitioned } from './transition.ts';

/** The pace every transition here runs at: Animation's fast/out, scaled by --fx-speed. Re-declare `--duration-fast`/`--ease-out` on a scope to retune a region. */
export function pace(): string[] {
  return [declaration('transition-duration', timed(duration('fast'))), declaration('transition-timing-function', ease('out'))];
}

/** The three longhands every [data-fx] element gets at `:where`, and a selector form gets on its first row. */
export function setup(): string {
  return [declaration('transition-property', transitioned.join(', ')), ...pace()].join('\n');
}

/** `animation: <ident> <duration × speed> <ease> <iterations> [fill];` — ident and pace are Animation's (`ident()`, `vocabulary`), the fill this engine's. */
export function keyframeRow(name: Paired, again = false): string {
  const p = pairing(name, again);
  const fields = [p.ident, timed(duration(p.duration)), ease(p.ease), String(p.iterations)];
  if (p.fill) fields.push(p.fill);
  return declaration('animation', fields.join(' '));
}

/** The effects that are one row: fade and flash are groups — fadeRows() and flashRows() — and have no body. */
export type Rowed = Exclude<FxEffect, 'fade' | 'flash'>;

/** The declarations of a one-rule effect. */
export function body(effect: Rowed, again = false): string {
  switch (effect) {
    case 'lift':
      return [declaration('transform', `translateY(${knob('lift-rise')})`), declaration('box-shadow', knob('shadow-lifted'))].join('\n');
    case 'dim':
      return declaration('opacity', knob('dim'));
    case 'blur':
      return declaration('filter', `blur(${knob('blur')})`);
    case 'frost':
      return declaration('backdrop-filter', `blur(${knob('frost')})`);
    case 'waiting':
      return declaration('cursor', 'progress');
    case 'pulse':
    case 'shake':
    case 'fade-in':
    case 'fade-out':
      return keyframeRow(effect, again);
    default:
      return elevationBody(Number(effect.slice('elevation-'.length)) as Elevation);
  }
}

const closed = ':is([hidden], dialog:not([open]), [popover]:not(:popover-open))';
const fadeProperties = 'opacity, display, overlay';

/**
 * The native hidden/open transition on `base`; `own` is the (0,2,0) form of it. Hooked, the
 * setup row supplies duration and ease; on an author's selector they ride along here.
 */
export function fadeRows(base: string, own: string, hooked: boolean): string {
  const fading = [declaration('transition-property', fadeProperties), declaration('transition-behavior', 'allow-discrete')];
  const backdrop = `dialog${own}::backdrop`;
  return (
    block(own, [...(hooked ? [] : pace()), ...fading].join('\n')) +
    block(`${base}${closed}`, [declaration('display', 'none'), declaration('opacity', '0')].join('\n')) +
    block('@starting-style', block(own, declaration('opacity', '0'))) +
    block(backdrop, [...fading, ...pace(), declaration('opacity', '0')].join('\n')) +
    block(`dialog${own}[open]::backdrop`, declaration('opacity', '1')) +
    block('@starting-style', block(`dialog${own}[open]::backdrop`, declaration('opacity', '0')))
  );
}

/** One box, `::after`, created by the word: starts at the flash colour under @starting-style and fades to transparent. */
export function flashRows(base: string, own: string): string {
  const overlay = [
    declaration('content', "''"),
    declaration('position', 'absolute'),
    declaration('inset', '0'),
    declaration('pointer-events', 'none'),
    declaration('border-radius', 'inherit'),
    declaration('background', knob('flash-color')),
    declaration('opacity', '0'),
    declaration('transition-property', 'opacity'),
    declaration('transition-duration', timed(knob('flash-duration'))),
    declaration('transition-timing-function', ease('out')),
  ];
  return block(`:where(${base})`, declaration('position', 'relative')) + block(`${own}::after`, overlay.join('\n')) + block('@starting-style', block(`${own}::after`, declaration('opacity', '1')));
}

/** A frosted dialog frosts its scrim too. */
export function frostBackdrop(own: string): string {
  return block(`dialog${own}::backdrop`, declaration('backdrop-filter', `blur(${knob('frost')})`));
}
