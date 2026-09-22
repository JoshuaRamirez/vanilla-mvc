import { Component } from '../../../framework/index.ts';
import { NotFoundPageController } from './not-found-page.controller.ts';
import type { NotFoundPageModel } from './not-found-page.model.ts';
import { notFoundPageTemplate } from './not-found-page.template.ts';

export class NotFoundPageComponent extends Component<NotFoundPageModel, NotFoundPageController> {
  protected createTemplate() { return notFoundPageTemplate; }
  protected createController() { return new NotFoundPageController(); }
}
