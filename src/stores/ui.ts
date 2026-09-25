import { create } from 'zustand'
import { newId } from '@/lib/id'

export type ToastKind = 'info' | 'success' | 'error'

export interface Toast {
  id: string
  kind: ToastKind
  title: string
  body?: string
  action?: { label: string; run: () => void }
  /** Auto-dismiss delay; `null` keeps the toast until dismissed. */
  timeoutMs: number | null
}

interface UiState {
  toasts: Toast[]
  pushToast: (toast: Omit<Toast, 'id' | 'timeoutMs'> & { timeoutMs?: number | null }) => string
  dismissToast: (id: string) => void
  clearToasts: () => void
}

/** More than a few stacked toasts cover the screen; older ones give way. */
export const MAX_VISIBLE_TOASTS = 3

export const useUiStore = create<UiState>((set) => ({
  toasts: [],
  pushToast: (toast) => {
    const id = newId()
    set((state) => ({ toasts: [...state.toasts, { timeoutMs: 5000, ...toast, id }].slice(-MAX_VISIBLE_TOASTS) }))
    return id
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clearToasts: () => set({ toasts: [] }),
}))

export const toast = (input: Parameters<UiState['pushToast']>[0]) => useUiStore.getState().pushToast(input)
