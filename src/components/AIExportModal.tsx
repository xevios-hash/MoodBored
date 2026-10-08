import { useState, useMemo } from 'react'
import { useStore } from '@/stores/useStore'
import { X, Copy, Download, Check, Palette, Film, Type, Sparkles } from 'lucide-react'
import { showToast } from '@/lib/toasts'
import {
  exportForAI,
  getFormatDescription,
  getFormatIcon,
  type AIExportFormat,
  type ExportOptions,
} from '@/lib/aiExport'

const FORMAT_GROUPS = [
  {
    label: 'Image Generation',
    formats: ['sd-prompt', 'midjourney', 'dalle', 'flux', 'comfyui-workflow'] as AIExportFormat[],
  },
  {
    label: 'Video Generation',
    formats: ['video-scene'] as AIExportFormat[],
  },
  {
    label: 'LLM & Text',
    formats: ['llm-context', 'markdown'] as AIExportFormat[],
  },
  {
    label: 'Design Tools',
    formats: ['design-tokens'] as AIExportFormat[],
  },
]

interface Props {
  items: import('@/types').BoardItem[]
  boardName: string
  onClose: () => void
}

export function AIExportModal({ items, boardName, onClose }: Props) {
  const project = useStore((s) => s.project)
  const [format, setFormat] = useState<AIExportFormat>('sd-prompt')
  const [style, setStyle] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [quality, setQuality] = useState<'draft' | 'standard' | 'high'>('standard')
  const [copied, setCopied] = useState(false)

  const options: ExportOptions = useMemo(() => ({
    format,
    includeImages: true,
    includeColors: true,
    includeTypography: true,
    includeNotes: true,
    style: style || undefined,
    negativePrompt: negativePrompt || undefined,
    aspectRatio,
    quality,
  }), [format, style, negativePrompt, aspectRatio, quality])

  const output = useMemo(() => {
    const result = exportForAI(project, options)
    return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
  }, [project, options])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    showToast('Copied to clipboard', 'success')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const ext = format === 'comfyui-workflow' ? 'json' : 'md'
    const blob = new Blob([output], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${boardName}-ai-export-${format}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Downloaded', 'success')
  }

  const isImageGen = ['sd-prompt', 'midjourney', 'dalle', 'flux', 'comfyui-workflow'].includes(format)

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-fadeIn" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-[min(1000px,95vw)] h-[min(750px,90vh)] glass-card rounded-xl shadow-panel flex flex-col animate-scaleIn overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Export for AI</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Generate prompts and context for AI models
            </p>
          </div>
          <button onClick={onClose} className="btn p-1 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left: Configuration */}
          <div className="w-80 border-r border-white/[0.06] p-4 overflow-y-auto space-y-4">
            {/* Format Selection */}
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">Export Format</label>
              {FORMAT_GROUPS.map((group) => (
                <div key={group.label} className="mb-3">
                  <div className="text-2xs text-text-muted mb-1">{group.label}</div>
                  <div className="space-y-1">
                    {group.formats.map((f) => (
                      <button
                        key={f}
                        onClick={() => setFormat(f)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-fast border ${
                          format === f
                            ? 'bg-accent/10 border-accent text-accent'
                            : 'border-transparent hover:bg-surface-2 text-text-primary'
                        }`}
                      >
                        <span>{getFormatIcon(f)}</span>
                        <span className="flex-1 text-left">{f}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Quality */}
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">Quality</label>
              <div className="flex gap-2">
                {(['draft', 'standard', 'high'] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs transition-fast border ${
                      quality === q
                        ? 'bg-accent/10 border-accent text-accent'
                        : 'border-white/[0.06] hover:bg-surface-2 text-text-primary'
                    }`}
                  >
                    {q.charAt(0).toUpperCase() + q.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio (for image/video) */}
            {(isImageGen || format === 'video-scene') && (
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">Aspect Ratio</label>
                <div className="grid grid-cols-3 gap-2">
                  {['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'].map((ar) => (
                    <button
                      key={ar}
                      onClick={() => setAspectRatio(ar)}
                      className={`px-3 py-2 rounded-lg text-xs transition-fast border ${
                        aspectRatio === ar
                          ? 'bg-accent/10 border-accent text-accent'
                          : 'border-white/[0.06] hover:bg-surface-2 text-text-primary'
                      }`}
                    >
                      {ar}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Style Keywords */}
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">Style Keywords</label>
              <input
                type="text"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                placeholder="e.g., cinematic, watercolor, minimalist"
                className="input w-full"
              />
            </div>

            {/* Negative Prompt (for image gen) */}
            {isImageGen && (
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">Negative Prompt</label>
                <textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="low quality, blurry, distorted..."
                  className="input w-full resize-none"
                  rows={3}
                />
              </div>
            )}

            {/* Format Description */}
            <div className="p-3 rounded-lg border border-accent/15 bg-accent/5">
              <p className="text-xs text-text-secondary">
                {getFormatDescription(format)}
              </p>
            </div>
          </div>

          {/* Right: Preview */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
              <span className="text-xs text-text-muted">Preview</span>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="btn btn-ghost text-xs flex items-center gap-1"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={handleDownload}
                  className="btn btn-ghost text-xs flex items-center gap-1"
                >
                  <Download size={14} />
                  Download
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-xs text-text-primary font-mono whitespace-pre-wrap break-words bg-surface-0 rounded-lg p-4 border border-white/[0.06]">
                {output}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
