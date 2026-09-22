import { Component } from '../../../framework/index.ts';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component.ts';
import { EditTodoPageComponent } from '../edit-todo-page/edit-todo-page.component.ts';
import { HomePageComponent } from '../home-page/home-page.component.ts';
import { NavBarComponent } from '../nav-bar/nav-bar.component.ts';
import { NotFoundPageComponent } from '../not-found-page/not-found-page.component.ts';
import { ToastComponent } from '../toast/toast.component.ts';
import { TodoListPageComponent } from '../todo-list-page/todo-list-page.component.ts';
import { ShellController } from './shell.controller.ts';
import type { ShellModel } from './shell.model.ts';
import { shellTemplate } from './shell.template.ts';

export class ShellComponent extends Component<ShellModel, ShellController> {
  protected createTemplate() { return shellTemplate; }
  protected createController() { return new ShellController(); }
  protected override createChildren() {
    return [
      new NavBarComponent('nav-bar'),
      new ToastComponent('toast'),
      new ConfirmDialogComponent('confirm-dialog'),
      new HomePageComponent('home-page'),
      new TodoListPageComponent('todo-list-page'),
      new EditTodoPageComponent('edit-todo-page'),
      new NotFoundPageComponent('not-found-page'),
    ];
  }
}
