import { Component } from '../../../framework/index.ts';
import type { TodosListed } from '../../events/todos-listed.ts';
import { TodoRowComponent } from '../todo-row/todo-row.component.ts';
import { TodoListPageController } from './todo-list-page.controller.ts';
import type { TodoListPageModel } from './todo-list-page.model.ts';
import { todoListPageTemplate } from './todo-list-page.template.ts';

export class TodoListPageComponent extends Component<TodoListPageModel, TodoListPageController> {
  protected createTemplate() { return todoListPageTemplate; }
  protected createController() { return new TodoListPageController(); }

  /** One row component per todo; rows not shown keep existing. True when the set moved. */
  syncRows({ todos }: TodosListed): boolean {
    const byKey = new Map(todos.map((todo) => [TodoRowComponent.keyFor(todo), todo]));
    return this.syncChildren(byKey.keys(), (key) => new TodoRowComponent(byKey.get(key)!));
  }
}
