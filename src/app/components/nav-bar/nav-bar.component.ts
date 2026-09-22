import { Component } from '../../../framework/index.ts';
import { NavBarController } from './nav-bar.controller.ts';
import type { NavBarModel } from './nav-bar.model.ts';
import { navBarTemplate } from './nav-bar.template.ts';

export class NavBarComponent extends Component<NavBarModel, NavBarController> {
  protected createTemplate() { return navBarTemplate; }
  protected createController() { return new NavBarController(); }
}
