import { useState, useEffect } from 'react'
import { useStore } from '@/stores/useStore'
import { X, Zap, Download, Check, Loader2, ExternalLink } from 'lucide-react'
import { showToast } from '@/lib/toasts'
import {
  generateImage,
  boardToPrompt,
  SERVICE_PRESETS,
  type AIServiceType,
  type AIServiceConfig,
  type GenerationRequest,
} from '@/lib/aiServices'

interface Props {
  onClose: () => void
}

export function AIConnectionModal({ onClose }: Props) {
  const items = useStore((s) => {
    const vp = s.project.viewports.find(v => v.id === s.activeViewportId)
    return vp?.items ?? []
  })

  const [serviceType, setServiceType] = useState<AIServiceType>('invokeai')
  const [serviceUrl, setServiceUrl] = useState('http://localhost:9090')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])

  // Generation settings
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('low quality, blurry, distorted')
  const [width, setWidth] = useState(1024)
  const [height, setHeight] = useState(1024)
  const [steps, setSteps] = useState(20)
  const [cfgScale, setCfgScale] = useState(7)
  const [seed, setSeed] = useState(-1)

  // Auto-fill prompt from board content
  useEffect(() => {
    const { prompt: boardPrompt, negativePrompt: boardNeg } = boardToPrompt(items)
    if (boardPrompt && !prompt) {
      setPrompt(boardPrompt)
      setNegativePrompt(boardNeg)
    }
  }, [items])

  // Update URL when service type changes
  useEffect(() => {
    const preset = SERVICE_PRESETS[serviceType]
    setServiceUrl(preset.defaultUrl)
  }, [serviceType])

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      showToast('Please enter a prompt', 'error')
      return
    }

    setIsGenerating(true)
    setGeneratedImages([])

    try {
      const config: AIServiceConfig = {
        type: serviceType,
        url: serviceUrl,
        apiKey: apiKey || undefined,
        model: model || undefined,
      }

      const request: GenerationRequest = {
        prompt,
        negativePrompt,
        width,
        height,
        steps,
        cfgScale: cfgScale,
        seed: seed >= 0 ? seed : undefined,
      }

      const result = await generateImage(config, request)

      if (result.success) {
        setGeneratedImages(result.images)
        if (result.seed) {
          showToast(`Generated with seed: ${result.seed}`, 'success')
        } else {
          showToast('Image generated!', 'success')
        }
      } else {
        showToast(`Error: ${result.error}`, 'error')
      }
    } catch (err) {
      showToast('Failed to connect to service', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = (imageUrl: string, index: number) => {
    const a = document.createElement('a')
    a.href = imageUrl
    a.download = `moodbored-generated-${index + 1}.png`
    a.click()
  }

  const handleAddToBoard = (imageUrl: string) => {
    const state = useStore.getState()
    state.addItem({
      kind: 'image',
      id: crypto.randomUUID(),
      thumbnail: imageUrl,
      fullSource: imageUrl,
      description: 'AI Generated',
      source: serviceType,
      purpose: 'Generated from mood board',
      importance: 'AI output',
      tags: ['ai-generated', serviceType],
      pos: { x: 100 + Math.random() * 400, y: 100 + Math.random() * 300 },
      size: { w: 300, h: 300 },
    })
    showToast('Added to board', 'success')
  }

  const preset = SERVICE_PRESETS[serviceType]

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-fadeIn" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-[min(900px,95vw)] h-[min(700px,90vh)] glass-card rounded-xl shadow-panel flex flex-col animate-scaleIn overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={20} className="text-accent" />
            <div>
              <h2 className="text-base font-semibold text-text-primary">Generate with AI</h2>
              <p className="text-xs text-text-muted mt-0.5">Send prompts directly to image generation services</p>
            </div>
          </div>
          <button onClick={onClose} className="btn p-1 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left: Configuration */}
          <div className="w-80 border-r border-white/[0.06] p-4 overflow-y-auto space-y-4">
            {/* Service Selection */}
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">Service</label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as AIServiceType)}
                className="input w-full"
              >
                <optgroup label="Local (No API Key)">
                  <option value="invokeai">Invoke AI</option>
                  <option value="comfyui">ComfyUI</option>
                  <option value="automatic1111">Automatic1111</option>
                </optgroup>
                <optgroup label="Cloud (API Key Required)">
                  <option value="stability">Stability AI</option>
                  <option value="replicate">Replicate</option>
                  <option value="fal">fal.ai</option>
                </optgroup>
              </select>
              <p className="text-2xs text-text-muted mt-1">{preset.description}</p>
            </div>

            {/* URL */}
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">
                {preset.requiresApiKey ? 'API Endpoint' : 'Local URL'}
              </label>
              <input
                type="text"
                value={serviceUrl}
                onChange={(e) => setServiceUrl(e.target.value)}
                placeholder={preset.defaultUrl}
                className="input w-full"
              />
              {!preset.requiresApiKey && (
                <a
                  href={preset.defaultUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-2xs text-accent flex items-center gap-1 mt-1 hover:underline"
                >
                  Open in browser <ExternalLink size={10} />
                </a>
              )}
            </div>

            {/* API Key */}
            {preset.requiresApiKey && (
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Your API key"
                  className="input w-full"
                />
              </div>
            )}

            {/* Model */}
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">Model (optional)</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Default model"
                className="input w-full"
              />
            </div>

            {/* Size */}
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">Size</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-2xs text-text-muted">Width</label>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="text-2xs text-text-muted">Height</label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value))}
                    className="input w-full"
                  />
                </div>
              </div>
              <div className="flex gap-1 mt-1">
                {[
                  { label: '1:1', w: 1024, h: 1024 },
                  { label: '16:9', w: 1344, h: 768 },
                  { label: '9:16', w: 768, h: 1344 },
                  { label: '4:3', w: 1152, h: 896 },
                ].map(({ label, w, h }) => (
                  <button
                    key={label}
                    onClick={() => { setWidth(w); setHeight(h) }}
                    className={`flex-1 px-2 py-1 rounded text-2xs border ${
                      width === w && height === h
                        ? 'bg-accent/10 border-accent text-accent'
                        : 'border-white/[0.06] hover:bg-surface-2'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Steps & CFG */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-1">Steps</label>
                <input
                  type="number"
                  value={steps}
                  onChange={(e) => setSteps(Number(e.target.value))}
                  min={1}
                  max={100}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-1">CFG Scale</label>
                <input
                  type="number"
                  value={cfgScale}
                  onChange={(e) => setCfgScale(Number(e.target.value))}
                  min={1}
                  max={20}
                  step={0.5}
                  className="input w-full"
                />
              </div>
            </div>

            {/* Seed */}
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">Seed (-1 = random)</label>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
                className="input w-full"
              />
            </div>
          </div>

          {/* Right: Prompt & Results */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Prompt */}
            <div className="p-4 border-b border-white/[0.06]">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what to generate..."
                className="input w-full resize-none"
                rows={3}
              />
              <div className="mt-2">
                <label className="text-2xs text-text-muted">Negative Prompt</label>
                <input
                  type="text"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  className="input w-full text-xs"
                />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-2xs text-text-muted">
                  {items.length} items on board → {prompt.length} char prompt
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="btn btn-primary flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Zap size={14} />
                      Generate
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-auto p-4">
              {generatedImages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-text-muted">
                  <div className="text-center">
                    <Zap size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-sm">Generated images will appear here</p>
                    <p className="text-xs mt-1">Connect to a service and click Generate</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {generatedImages.map((img, i) => (
                    <div key={i} className="rounded-lg overflow-hidden border border-white/[0.06] group">
                      <img src={img} alt={`Generated ${i + 1}`} className="w-full h-auto" />
                      <div className="p-2 flex gap-2 bg-surface-1">
                        <button
                          onClick={() => handleDownload(img, i)}
                          className="btn btn-ghost text-xs flex-1 flex items-center justify-center gap-1"
                        >
                          <Download size={12} />
                          Download
                        </button>
                        <button
                          onClick={() => handleAddToBoard(img)}
                          className="btn btn-primary text-xs flex-1 flex items-center justify-center gap-1"
                        >
                          <Check size={12} />
                          Add to Board
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
