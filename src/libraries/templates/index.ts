/**
 * templates: html`` tagged templates rendered with in-place DOM updates and
 * delegated events. One-way: values go into the DOM, events come out. No dependencies.
 */
export { analyze, type Hole, type HoleKind } from './analyze.ts';
export { morph, type MorphOptions } from './morph.ts';
export { render, type RenderOptions } from './renderer.ts';
export { escape, serialize, type Binding, type Handler, type Serialized } from './serialize.ts';
export { behavior, ElementBehavior, html, nothing, ViewResult, type Nothing } from './view.ts';
