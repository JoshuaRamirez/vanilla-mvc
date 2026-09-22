import { Component } from '../../../framework/index.ts';
import type { TodoFact } from '../../events/todo-fact.ts';
import { TodoRowController } from './todo-row.controller.ts';
import type { TodoRowModel } from './todo-row.model.ts';
import { todoRowTemplate } from './todo-row.template.ts';

/** A row in the todo list, added and removed at runtime as the list changes. */
export class TodoRowComponent extends Component<TodoRowModel, TodoRowController> {
  static keyFor(todo: TodoFact): string {
    return `todo-row-${todo.id}`;
  }

  constructor(private readonly todo: TodoFact) {
    super(TodoRowComponent.keyFor(todo));
  }

  protected createTemplate() { return todoRowTemplate; }
  protected createController() { return new TodoRowController(this.todo); }
}
