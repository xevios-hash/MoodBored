import { useStore } from '@/stores/useStore'
import { X, Tag, Plus, Trash2 } from 'lucide-react'
import { useState, useMemo } from 'react'
import type { BoardItem } from '@/types'

export function Inspector() {
  const project = useStore((s) => s.project)
  const selectedIds = useStore((s) => s.selectedIds)
  const updateItem = useStore((s) => s.updateItem)
  const removeItem = useStore((s) => s.removeItem)
  const toggleInspector = useStore((s) => s.toggleInspector)
  const [newTag, setNewTag] = useState('')

  const selectedItem = useMemo(() => {
    if (selectedIds.size !== 1) return null
    const id = [...selectedIds][0]
    return project.viewports.flatMap((v) => v.items).find((i) => i.id === id) ?? null
  }, [project.viewports, selectedIds])

  if (!selectedItem) {
    return (
      <div className="h-full glass-panel border-l border-white/[0.06] flex flex-col items-center justify-center" role="complementary" aria-label="Inspector panel">
        <div className="text-center animate-fadeIn">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-surface-2 flex items-center justify-center">
            <Tag size={20} className="text-text-muted" />
          </div>
          <p className="text-text-muted text-sm">Select an item to inspect</p>
          <p className="text-text-muted text-xs mt-1">Click any item on the canvas</p>
        </div>
      </div>
    )
  }

  const update = (updates: Record<string, any>) => updateItem(selectedItem.id, updates)

  const addTag = () => {
    if (!newTag.trim()) return
    if ('tags' in selectedItem) update({ tags: [...(selectedItem.tags || []), newTag.trim()] })
    setNewTag('')
  }

  const removeTag = (tag: string) => {
    if ('tags' in selectedItem) update({ tags: selectedItem.tags.filter((t) => t !== tag) })
  }

  const handleDelete = () => {
    if (confirm(`Delete this ${selectedItem.kind}?`)) {
      removeItem(selectedItem.id)
    }
  }

  return (
    <div className="h-full glass-panel border-l border-white/[0.06] flex flex-col overflow-y-auto" role="complementary" aria-label="Inspector panel">
      {/* Header */}
      <div className="p-3 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-accent uppercase">{selectedItem.kind}</span>
          <span className="text-2xs text-text-muted font-mono">#{selectedItem.id.slice(0, 8)}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleDelete}
            className="btn p-1 text-text-muted hover:text-danger hover:bg-danger-light rounded"
            title="Delete item"
            aria-label="Delete item"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={toggleInspector}
            className="btn p-1 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded"
            title="Close inspector"
            aria-label="Close inspector"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="p-3 space-y-3">
        {renderKindFields(selectedItem, update)}

        {/* Tags */}
        {'tags' in selectedItem && selectedItem.kind !== 'connector' && (
          <div>
            <label className="text-xs text-text-muted block mb-1">Tags</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {(selectedItem.tags || []).map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 bg-surface-2 text-text-secondary text-xs px-2 py-0.5 rounded-full">
                  <Tag size={10} />
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="text-text-muted hover:text-danger transition-fast"
                    aria-label={`Remove tag ${tag}`}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                placeholder="Add tag..."
                className="input flex-1 text-xs"
                aria-label="New tag input"
              />
              <button onClick={addTag} className="btn btn-primary text-xs" aria-label="Add tag">
                Add
              </button>
            </div>
          </div>
        )}

        {/* Position */}
        {selectedItem.kind !== 'connector' && (
          <div className="pt-2 border-t border-white/[0.06]">
            <label className="text-xs text-text-muted block mb-1">Position</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-2xs text-text-muted block mb-0.5">X</label>
                <input
                  type="number"
                  value={Math.round(selectedItem.pos.x)}
                  onChange={(e) => update({ pos: { ...selectedItem.pos, x: Number(e.target.value) } })}
                  className="input w-full text-xs"
                  aria-label="X position"
                />
              </div>
              <div className="flex-1">
                <label className="text-2xs text-text-muted block mb-0.5">Y</label>
                <input
                  type="number"
                  value={Math.round(selectedItem.pos.y)}
                  onChange={(e) => update({ pos: { ...selectedItem.pos, y: Number(e.target.value) } })}
                  className="input w-full text-xs"
                  aria-label="Y position"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function renderKindFields(item: BoardItem, update: (u: Record<string, any>) => void) {
  switch (item.kind) {
    case 'text':
      return <Field label="Content" value={item.raw} onChange={(v) => update({ raw: v })} multiline />
    case 'note':
      return <>
        <Field label="Text" value={item.text} onChange={(v) => update({ text: v })} multiline />
        <Field label="Purpose" value={item.purpose} onChange={(v) => update({ purpose: v })} />
      </>
    case 'image':
      return <>
        <Field label="Description" value={item.description} onChange={(v) => update({ description: v })} multiline />
        <Field label="Source URL" value={item.source} onChange={(v) => update({ source: v })} />
        <Field label="Purpose" value={item.purpose} onChange={(v) => update({ purpose: v })} />
      </>
    case 'link':
      return <>
        <Field label="URL" value={item.url} onChange={(v) => update({ url: v })} />
        <Field label="Title" value={item.title} onChange={(v) => update({ title: v })} />
        <Field label="Description" value={item.description} onChange={(v) => update({ description: v })} multiline />
      </>
    case 'video':
      return <>
        <Field label="Subject" value={item.subjectDesc} onChange={(v) => update({ subjectDesc: v })} multiline />
        <Field label="Motion" value={item.motionDesc} onChange={(v) => update({ motionDesc: v })} multiline />
      </>
    case 'palette':
      return <>
        <Field label="Label" value={item.label} onChange={(v) => update({ label: v })} />
        <div>
          <label className="text-xs text-text-muted block mb-1">Colors</label>
          {item.colors.map((c, i) => (
            <div key={i} className="flex gap-2 mb-1.5 items-center">
              <input
                type="color"
                value={c.hex}
                onChange={(e) => {
                  const colors = [...item.colors]; colors[i] = { ...colors[i], hex: e.target.value }; update({ colors })
                }}
                className="w-8 h-7 border-none rounded cursor-pointer"
                aria-label={`Color ${i + 1}`}
              />
              <input
                value={c.label}
                onChange={(e) => {
                  const colors = [...item.colors]; colors[i] = { ...colors[i], label: e.target.value }; update({ colors })
                }}
                placeholder="Label"
                className="input flex-1 text-xs"
              />
              <button
                onClick={() => { const colors = item.colors.filter((_, j) => j !== i); update({ colors }) }}
                className="btn p-1 text-text-muted hover:text-danger rounded"
                aria-label={`Remove color ${i + 1}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <button
            onClick={() => update({ colors: [...item.colors, { hex: '#000000', label: '' }] })}
            className="btn btn-ghost w-full flex items-center justify-center gap-1 text-xs border border-dashed border-surface-4 mt-1"
          >
            <Plus size={12} /> Add Color
          </button>
        </div>
      </>
    case 'gradient':
      return <>
        <Field label="Label" value={item.label} onChange={(v) => update({ label: v })} />
        <Field label="Direction (deg)" value={String(item.direction)} onChange={(v) => update({ direction: Number(v) })} />
      </>
    case 'font':
      return <>
        <Field label="Font Family" value={item.fontFamily} onChange={(v) => update({ fontFamily: v })} />
        <Field label="Sample Text" value={item.sampleText} onChange={(v) => update({ sampleText: v })} multiline />
      </>
    case 'swatch':
      return <>
        <div>
          <label className="text-xs text-text-muted block mb-1">Color</label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={item.hex}
              onChange={(e) => update({ hex: e.target.value })}
              className="w-12 h-10 border-none rounded cursor-pointer"
            />
            <input
              value={item.hex}
              onChange={(e) => update({ hex: e.target.value })}
              className="input flex-1 text-xs font-mono"
            />
          </div>
        </div>
        <Field label="Name" value={item.name} onChange={(v) => update({ name: v })} />
        <Field label="Usage" value={item.usage} onChange={(v) => update({ usage: v })} multiline />
      </>
    case 'sizeguide':
      return <>
        <Field label="Label" value={item.label} onChange={(v) => update({ label: v })} />
        <div className="flex gap-2">
          <Field label="Width" value={String(item.width)} onChange={(v) => update({ width: Number(v) })} />
          <Field label="Height" value={String(item.height)} onChange={(v) => update({ height: Number(v) })} />
        </div>
        <Field label="Unit" value={item.unit} onChange={(v) => update({ unit: v })} />
      </>
    case 'container':
      return <>
        <Field label="Label" value={item.label} onChange={(v) => update({ label: v })} />
        <div>
          <label className="text-xs text-text-muted block mb-1">Layout</label>
          <select
            value={item.layout}
            onChange={(e) => update({ layout: e.target.value })}
            className="input w-full"
          >
            <option value="free">Free</option>
            <option value="grid">Grid</option>
            <option value="stack-h">Horizontal Stack</option>
            <option value="stack-v">Vertical Stack</option>
          </select>
        </div>
        {item.layout === 'grid' && (
          <Field label="Grid Columns" value={String(item.gridCols || 3)} onChange={(v) => update({ gridCols: Number(v) })} />
        )}
        <Field label="Gap (px)" value={String(item.gap || 8)} onChange={(v) => update({ gap: Number(v) })} />
        <div className="text-xs text-text-muted">
          {item.children.length} items in container
        </div>
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={item.collapsed}
            onChange={(e) => update({ collapsed: e.target.checked })}
            className="rounded"
          />
          Collapsed
        </label>
      </>
    case 'connector':
      return <>
        <Field label="Label" value={item.label} onChange={(v) => update({ label: v })} />
        <div>
          <label className="text-xs text-text-muted block mb-1">Style</label>
          <select
            value={item.style}
            onChange={(e) => update({ style: e.target.value })}
            className="input w-full"
          >
            <option value="arrow">Arrow</option>
            <option value="solid">Solid Line</option>
            <option value="dashed">Dashed Line</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">Owner</label>
          <select
            value={item.owner}
            onChange={(e) => update({ owner: e.target.value })}
            className="input w-full"
          >
            <option value="user">User (blue)</option>
            <option value="llm">LLM (purple)</option>
            <option value="objective">Objective (gray)</option>
          </select>
        </div>
      </>
    default:
      return null
  }
}

function Field({ label, value, onChange, multiline }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean
}) {
  return (
    <div>
      <label className="text-xs text-text-muted block mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input w-full resize-none"
          rows={3}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input w-full"
        />
      )}
    </div>
  )
}
