import type { Adapters } from '../seams.ts';
import { CssStyling } from './css/css-styling.ts';
import { FieldsAccess } from './fields/fields-access.ts';
import { RouterRouting } from './router/router-routing.ts';
import { TemplatesRenderer } from './templates/templates-renderer.ts';

/** Our own libraries, one adapter each. */
export function defaultAdapters(): Adapters {
  return {
    renderer: new TemplatesRenderer(),
    forms: new FieldsAccess(),
    routing: new RouterRouting(),
    styling: new CssStyling(),
  };
}
