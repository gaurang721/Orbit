import { create } from 'zustand';

export interface ConfirmOptions {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** Style the confirm button as a destructive (red) action. */
  destructive?: boolean;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions;
  resolve: ((value: boolean) => void) | null;
  request: (options: ConfirmOptions) => Promise<boolean>;
  settle: (value: boolean) => void;
}

/**
 * Backs a single global confirmation dialog. `confirmDialog(...)` returns a
 * promise that resolves true (confirmed) or false (cancelled), so any
 * destructive action can `if (!(await confirmDialog(...))) return;` before
 * proceeding.
 */
export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: {},
  resolve: null,
  request: (options) =>
    new Promise<boolean>((resolve) => {
      // If a dialog is somehow already open, cancel it first.
      get().resolve?.(false);
      set({ open: true, options, resolve });
    }),
  settle: (value) => {
    get().resolve?.(value);
    set({ open: false, resolve: null });
  },
}));

/** Imperatively ask the user to confirm an action. Resolves true if confirmed. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().request(options);
}
