import { Component } from '../../../framework/index.ts';
import { ToastController } from './toast.controller.ts';
import type { ToastModel } from './toast.model.ts';
import { toastTemplate } from './toast.template.ts';

export class ToastComponent extends Component<ToastModel, ToastController> {
  protected createTemplate() { return toastTemplate; }
  protected createController() { return new ToastController(); }
}
