import { Component } from '../../../framework/index.ts';
import { EditTodoPageController } from './edit-todo-page.controller.ts';
import type { EditTodoPageModel } from './edit-todo-page.model.ts';
import { editTodoPageTemplate } from './edit-todo-page.template.ts';

export class EditTodoPageComponent extends Component<EditTodoPageModel, EditTodoPageController> {
  protected createTemplate() { return editTodoPageTemplate; }
  protected createController() { return new EditTodoPageController(); }
}
