import { Component } from '../../../framework/index.ts';
import { ConfirmDialogController } from './confirm-dialog.controller.ts';
import type { ConfirmDialogModel } from './confirm-dialog.model.ts';
import { confirmDialogTemplate } from './confirm-dialog.template.ts';

export class ConfirmDialogComponent extends Component<ConfirmDialogModel, ConfirmDialogController> {
  protected createTemplate() { return confirmDialogTemplate; }
  protected createController() { return new ConfirmDialogController(); }
}
