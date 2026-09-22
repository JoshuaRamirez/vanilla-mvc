/**
 * The CSS library's front door: every folder as a namespace. Inside the library nothing
 * imports this file; an engine reaches another only through `../<folder>/index.ts` along the matrix.
 */
export * as templates from './templates/index.ts';
export * as theme from './theme/index.ts';
export * as layout from './layout/index.ts';
export * as responsive from './responsive/index.ts';
export * as animation from './animation/index.ts';
export * as effects from './effects/index.ts';
export * as semantics from './semantics/index.ts';
