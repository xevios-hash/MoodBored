import { useStore } from '@/stores/useStore'
import { Plus, Trash2, Map } from 'lucide-react'

export function Sidebar() {
  const project = useStore((s) => s.project)
  const activeViewportId = useStore((s) => s.activeViewportId)
  const setActiveViewport = useStore((s) => s.setActiveViewport)
  const addViewport = useStore((s) => s.addViewport)
  const removeViewport = useStore((s) => s.removeViewport)
  const renameViewport = useStore((s) => s.renameViewport)

  return (
    <aside className="h-full glass-panel border-r border-surface-4 flex flex-col">
      <div className="p-3 border-b border-surface-4">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Viewports</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {project.viewports.map((vp) => (
          <button
            key={vp.id}
            onClick={() => setActiveViewport(vp.id)}
            className={`group w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-fast text-left ${
              vp.id === activeViewportId ? 'bg-accent/10 text-accent' : 'hover:bg-surface-2 text-text-secondary hover:text-text-primary'
            }`}
          >
            <Map size={14} className="shrink-0" />
            <input
              value={vp.name}
              onChange={(e) => renameViewport(vp.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="bg-transparent text-sm flex-1 min-w-0 outline-none"
              spellCheck={false}
            />
            <span className="text-xs text-text-muted">{vp.items.length}</span>
            {project.viewports.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${vp.name}"?`)) removeViewport(vp.id) }}
                className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-fast p-0.5 rounded"
              >
                <Trash2 size={12} />
              </button>
            )}
          </button>
        ))}
      </div>
      <div className="p-2 border-t border-surface-4">
        <button onClick={addViewport} className="btn btn-ghost w-full flex items-center justify-center gap-1.5 text-xs">
          <Plus size={14} /> New Viewport
        </button>
      </div>
    </aside>
  )
}
