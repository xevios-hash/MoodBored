import { useState, useEffect } from 'react'

interface ShortcutGroup {
  title: string
  shortcuts: { keys: string; label: string }[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: 'Scroll', label: 'Pan canvas' },
      { keys: 'Ctrl/⌘ + Scroll', label: 'Zoom in/out' },
      { keys: 'Alt + Scroll', label: 'Zoom (alternative)' },
      { keys: '+ / -', label: 'Zoom in/out' },
      { keys: '0', label: 'Reset zoom' },
    ],
  },
  {
    title: 'Creation',
    shortcuts: [
      { keys: 'Double-click', label: 'Create blank card' },
      { keys: 'N', label: 'New note' },
      { keys: 'T', label: 'New text' },
      { keys: 'I', label: 'New image' },
      { keys: 'L', label: 'New link' },
      { keys: 'P', label: 'New palette' },
      { keys: 'G', label: 'New gradient' },
      { keys: 'F', label: 'New font' },
      { keys: 'V', label: 'New video' },
    ],
  },
  {
    title: 'Selection & Editing',
    shortcuts: [
      { keys: '⌘A', label: 'Select all' },
      { keys: '⌘C', label: 'Copy' },
      { keys: '⌘V', label: 'Paste' },
      { keys: '⌘D', label: 'Duplicate' },
      { keys: '⌫ / Delete', label: 'Delete selected' },
      { keys: 'Shift + Click', label: 'Multi-select' },
      { keys: 'Drag', label: 'Move item' },
      { keys: 'Drag edges', label: 'Resize item' },
    ],
  },
  {
    title: 'History',
    shortcuts: [
      { keys: '⌘Z', label: 'Undo' },
      { keys: '⇧⌘Z', label: 'Redo' },
    ],
  },
  {
    title: 'Annotations',
    shortcuts: [
      { keys: 'Alt + Drag', label: 'Draw annotation' },
      { keys: 'T (in annotation mode)', label: 'Text tool' },
      { keys: 'A (in annotation mode)', label: 'Arrow tool' },
      { keys: 'B (in annotation mode)', label: 'Box tool' },
      { keys: 'C (in annotation mode)', label: 'Circle tool' },
      { keys: 'H (in annotation mode)', label: 'Highlight tool' },
    ],
  },
  {
    title: 'Browser Cards',
    shortcuts: [
      { keys: 'Double-click card', label: 'Focus fullscreen' },
      { keys: 'Esc', label: 'Exit fullscreen' },
      { keys: 'Hover card', label: 'Interact with website' },
      { keys: 'Alt + Draw', label: 'Annotate website' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { keys: '⌘K', label: 'Search' },
      { keys: '⌘F', label: 'Find on board' },
      { keys: '?', label: 'Show this help' },
      { keys: 'Esc', label: 'Cancel/Close' },
    ],
  },
]

interface KeyboardShortcutsProps {
  onClose: () => void
}

export function KeyboardShortcuts({ onClose }: KeyboardShortcutsProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-card max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-2 transition-colors"
            aria-label="Close shortcuts"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  {group.title}
                </h3>
                <div className="space-y-1">
                  {group.shortcuts.map((shortcut) => (
                    <div key={shortcut.keys} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-text-secondary">{shortcut.label}</span>
                      <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-surface-2 rounded border border-border text-text-primary">
                        {shortcut.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border text-xs text-text-muted text-center">
          Press <kbd className="px-1 py-0.5 text-[10px] font-mono bg-surface-2 rounded">?</kbd> to toggle this help
        </div>
      </div>
    </div>
  )
}