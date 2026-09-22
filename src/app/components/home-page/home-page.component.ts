import { Component } from '../../../framework/index.ts';
import { CounterComponent } from '../counter/counter.component.ts';
import { HomePageController } from './home-page.controller.ts';
import type { HomePageModel } from './home-page.model.ts';
import { homePageTemplate } from './home-page.template.ts';

export class HomePageComponent extends Component<HomePageModel, HomePageController> {
  protected createTemplate() { return homePageTemplate; }
  protected createController() { return new HomePageController(); }
  protected override createChildren() {
    return [new CounterComponent('counter')];
  }
}
