import { useState, useMemo } from 'react'
import { useStore } from '@/stores/useStore'
import { X, Copy, Download, Check, Image, Video, Gamepad2, Globe, Box, Music, FileText, Sparkles } from 'lucide-react'
import { showToast } from '@/lib/toasts'
import {
  compileCreationBrief, renderMarkdown, renderJSON, renderXML,
  copyBriefToClipboard, downloadBrief,
  CREATION_TYPES, type CreationType, type ExportFormat,
} from '@/lib/exportForCreation'

const ICONS: Record<string, any> = { Image, Video, Gamepad2, Globe, Box, Music, FileText, Sparkles }

interface Props {
  items: import('@/types').BoardItem[]
  boardName: string
  onClose: () => void
}

export function ExportModal({ items, boardName, onClose }: Props) {
  const [creationType, setCreationType] = useState<CreationType>('general')
  const [format, setFormat] = useState<ExportFormat>('markdown')
  const [userPrompt, setUserPrompt] = useState('')
  const [copied, setCopied] = useState(false)

  const brief = useMemo(
    () => compileCreationBrief(items, boardName, creationType, userPrompt),
    [items, boardName, creationType, userPrompt],
  )

  const preview = useMemo(() => {
    switch (format) {
      case 'json': return renderJSON(brief)
      case 'xml': return renderXML(brief)
      case 'markdown': return renderMarkdown(brief)
    }
  }, [brief, format])

  const handleCopy = async () => {
    await copyBriefToClipboard(brief, format)
    setCopied(true)
    showToast('Creative brief copied to clipboard', 'success')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    downloadBrief(brief, format)
    showToast('Brief downloaded', 'success')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-fadeIn" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-[min(900px,95vw)] h-[min(700px,90vh)] glass-card rounded-xl shadow-panel flex flex-col animate-scaleIn overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Export for Creation</h2>
            <p className="text-xs text-text-muted mt-0.5">{items.length} items selected — {brief.palette.length} colors, {brief.typography.length} fonts, {brief.imagery.length} images</p>
          </div>
          <button onClick={onClose} className="btn p-1 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left: Configuration */}
          <div className="w-72 border-r border-white/[0.06] p-4 overflow-y-auto space-y-4">
            {/* Creation type */}
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">What are you creating?</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(CREATION_TYPES) as CreationType[]).map((key) => {
                  const meta = CREATION_TYPES[key]
                  const Icon = ICONS[meta.icon] || Sparkles
                  return (
                    <button
                      key={key}
                      onClick={() => setCreationType(key)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-fast border ${
                        creationType === key
                          ? 'bg-accent/10 border-accent text-accent'
                          : 'bg-surface-2 border-surface-4 text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <Icon size={16} />
                      <span className="font-medium">{meta.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* User direction */}
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">Creative direction (optional)</label>
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="e.g. A hero section for a SaaS landing page with a dark theme…"
                className="input w-full resize-none"
                rows={3}
              />
            </div>

            {/* Output format */}
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">Output format</label>
              <div className="flex gap-2">
                {(['markdown', 'json', 'xml'] as ExportFormat[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-fast border ${
                      format === f
                        ? 'bg-accent text-white border-accent'
                        : 'bg-surface-2 border-surface-4 text-text-secondary'
                    }`}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button onClick={handleCopy} className="btn btn-primary flex-1 flex items-center justify-center gap-2">
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={handleDownload} className="btn btn-ghost flex items-center gap-2">
                <Download size={14} />
              </button>
            </div>

            {/* Stats */}
            <div className="text-2xs text-text-muted space-y-1 pt-2 border-t border-white/[0.06]">
              <p>{brief.palette.length} colors · {brief.typography.length} fonts · {brief.imagery.length} images</p>
              <p>{brief.notes.length} notes · {brief.videos.length} videos · {brief.containers.length} groups</p>
              <p>{brief.connectors.length} connections · {brief.sizes.length} size guides</p>
            </div>
          </div>

          {/* Right: Preview */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-4 py-2 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-xs text-text-muted">Preview — {CREATION_TYPES[creationType].description}</span>
              <span className="text-2xs text-text-muted">{preview.length} chars</span>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-text-secondary whitespace-pre-wrap leading-relaxed bg-surface-0">
              {preview}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
