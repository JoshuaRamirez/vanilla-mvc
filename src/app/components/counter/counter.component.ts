import { Component } from '../../../framework/index.ts';
import { CounterController } from './counter.controller.ts';
import type { CounterModel } from './counter.model.ts';
import { counterTemplate } from './counter.template.ts';

export class CounterComponent extends Component<CounterModel, CounterController> {
  protected createTemplate() { return counterTemplate; }
  protected createController() { return new CounterController(); }
}
