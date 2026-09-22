export interface ToastModel {
  visible: boolean;
  tone: 'info' | 'error';
  text: string;
  canRetry: boolean;
}
