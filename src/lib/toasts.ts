import { v4 as uuid } from 'uuid'

type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  kind: ToastKind
  message: string
}

// Tiny external store so toasts work from anywhere (store actions, api lib)
let toasts: Toast[] = []
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function subscribeToasts(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getToasts(): Toast[] {
  return toasts
}

export function showToast(message: string, kind: ToastKind = 'info', durationMs = 4000) {
  const toast: Toast = { id: uuid(), kind, message }
  toasts = [...toasts, toast].slice(-4)
  emit()
  if (typeof globalThis.setTimeout === 'function') {
    globalThis.setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== toast.id)
      emit()
    }, durationMs)
  }
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}
