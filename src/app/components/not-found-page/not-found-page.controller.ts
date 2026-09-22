import { Controller, type RouteChanged } from '../../../framework/index.ts';
import { routes } from '../../routes.ts';
import type { NotFoundPageModel } from './not-found-page.model.ts';

export class NotFoundPageController extends Controller<NotFoundPageModel> {
  protected createModel(): NotFoundPageModel {
    return { path: '', homeHref: routes.href('home') };
  }

  protected override onInterconnect(): void {
    this.subscribe('RouteChanged', this.#routeChanged);
  }

  #routeChanged({ route }: RouteChanged): void {
    this.model.path = route.path;
    this.changed();
  }
}
