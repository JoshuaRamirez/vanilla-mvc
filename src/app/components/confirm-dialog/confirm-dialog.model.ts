export interface ConfirmDialogModel {
  open: boolean;
  questionId: number | null;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}
