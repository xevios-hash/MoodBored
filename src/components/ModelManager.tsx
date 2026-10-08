import { useState, useEffect, useCallback } from 'react'
import { useStore } from '@/stores/useStore'
import { X, Search, Download, FolderOpen, RefreshCw, Check, AlertCircle, Loader2, HardDrive, Cpu, Zap, ExternalLink, ChevronDown, ChevronRight, Info } from 'lucide-react'
import { showToast } from '@/lib/toasts'
import {
  startModelScan,
  MODEL_CATALOG,
  type ScannedModel,
  type RuntimeType,
  type ScanResult,
  type CatalogModel,
} from '@/lib/modelScanner'

interface Props {
  onClose: () => void
}

type Tab = 'installed' | 'catalog' | 'runtimes' | 'settings'

export function ModelManager({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('installed')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [expandedModel, setExpandedModel] = useState<string | null>(null)
  const [customFolders, setCustomFolders] = useState<string[]>([])

  // Auto-scan on mount
  useEffect(() => {
    handleScan()
  }, [])

  const handleScan = async () => {
    setIsScanning(true)
    try {
      const result = await startModelScan({ folders: customFolders })
      setScanResult(result)
      showToast(`Found ${result.models.length} models in ${result.scanTime}ms`, 'success')
    } catch (err) {
      showToast('Scan failed', 'error')
    } finally {
      setIsScanning(false)
    }
  }

  const handleDownload = async (model: CatalogModel) => {
    showToast(`Starting download: ${model.name}`, 'info')
    // In production, this would trigger server-side download
    try {
      const response = await fetch('/api/models/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: model.downloadUrl, name: model.name }),
      })
      if (response.ok) {
        showToast(`Download started: ${model.name}`, 'success')
      }
    } catch {
      showToast('Download failed', 'error')
    }
  }

  const filteredModels = scanResult?.models.filter(m => {
    if (selectedType !== 'all' && m.type !== selectedType) return false
    if (searchQuery && !m.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  }) || []

  const filteredCatalog = MODEL_CATALOG.filter(m => {
    if (selectedType !== 'all' && m.type !== selectedType) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return m.name.toLowerCase().includes(q) || m.family.toLowerCase().includes(q)
    }
    return true
  })

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'installed', label: 'Installed', icon: <HardDrive size={14} /> },
    { id: 'catalog', label: 'Catalog', icon: <Download size={14} /> },
    { id: 'runtimes', label: 'Runtimes', icon: <Cpu size={14} /> },
    { id: 'settings', label: 'Settings', icon: <FolderOpen size={14} /> },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-fadeIn" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-[min(1100px,95vw)] h-[min(750px,90vh)] glass-card rounded-xl shadow-panel flex flex-col animate-scaleIn overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HardDrive size={20} className="text-accent" />
            <div>
              <h2 className="text-base font-semibold text-text-primary">Model Manager</h2>
              <p className="text-xs text-text-muted mt-0.5">
                {scanResult ? `${scanResult.models.length} models found` : 'Scan for local models'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="btn btn-ghost text-xs flex items-center gap-1"
            >
              {isScanning ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {isScanning ? 'Scanning...' : 'Scan'}
            </button>
            <button onClick={onClose} className="btn p-1 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded" aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.06]">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Filters */}
        <div className="p-3 border-b border-white/[0.06] flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search models..."
              className="input w-full pl-9"
            />
          </div>
          <div className="flex gap-1">
            {['all', 'llm', 'checkpoint', 'lora', 'vae'].map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  selectedType === type
                    ? 'bg-accent/10 text-accent border border-accent/30'
                    : 'border border-white/[0.06] text-text-muted hover:bg-surface-2'
                }`}
              >
                {type === 'all' ? 'All' : type.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Installed Models Tab */}
          {activeTab === 'installed' && (
            <div>
              {isScanning ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 size={32} className="animate-spin text-accent" />
                </div>
              ) : filteredModels.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-text-muted">
                  <HardDrive size={48} className="mb-4 opacity-20" />
                  <p className="text-sm">No models found</p>
                  <p className="text-xs mt-1">Add model folders in Settings or download from Catalog</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredModels.map(model => (
                    <ModelCard
                      key={model.id}
                      model={model}
                      expanded={expandedModel === model.id}
                      onToggle={() => setExpandedModel(expandedModel === model.id ? null : model.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Catalog Tab */}
          {activeTab === 'catalog' && (
            <div className="space-y-2">
              {filteredCatalog.map(model => (
                <CatalogCard
                  key={model.id}
                  model={model}
                  onDownload={() => handleDownload(model)}
                />
              ))}
            </div>
          )}

          {/* Runtimes Tab */}
          {activeTab === 'runtimes' && (
            <div className="space-y-3">
              {scanResult?.runtimes.map(runtime => (
                <RuntimeCard key={runtime.id} runtime={runtime} />
              ))}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-text-primary mb-2">Scan Folders</h3>
                <p className="text-xs text-text-muted mb-3">Add folders where your models are stored</p>
                <div className="space-y-2">
                  {customFolders.map((folder, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={folder}
                        onChange={(e) => {
                          const newFolders = [...customFolders]
                          newFolders[i] = e.target.value
                          setCustomFolders(newFolders)
                        }}
                        className="input flex-1"
                      />
                      <button
                        onClick={() => setCustomFolders(customFolders.filter((_, j) => j !== i))}
                        className="btn btn-ghost text-xs text-danger"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setCustomFolders([...customFolders, ''])}
                    className="btn btn-ghost text-xs"
                  >
                    + Add Folder
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-accent/15 bg-accent/5">
                <h4 className="text-xs font-medium text-text-primary mb-2">Auto-Detection</h4>
                <p className="text-2xs text-text-muted">
                  Automatically scans common locations for known runtimes:
                </p>
                <ul className="mt-2 space-y-1 text-2xs text-text-muted">
                  <li>• Ollama: ~/.ollama/models</li>
                  <li>• LM Studio: ~/.lmstudio/models</li>
                  <li>• ComfyUI: ~/ComfyUI/models</li>
                  <li>• Automatic1111: ~/stable-diffusion-webui/models</li>
                  <li>• HuggingFace cache: ~/.cache/huggingface/hub</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Model Card Component
function ModelCard({ model, expanded, onToggle }: { model: ScannedModel; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-lg border border-white/[0.06] overflow-hidden">
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-2 transition-colors"
        onClick={onToggle}
      >
        <div className="flex-shrink-0">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary truncate">{model.name}</span>
            <span className={`px-1.5 py-0.5 rounded text-2xs ${
              model.type === 'llm' ? 'bg-blue-500/10 text-blue-500' :
              model.type === 'checkpoint' ? 'bg-purple-500/10 text-purple-500' :
              model.type === 'lora' ? 'bg-green-500/10 text-green-500' :
              'bg-gray-500/10 text-gray-500'
            }`}>
              {model.type.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-2xs text-text-muted">
            <span>{model.sizeFormatted}</span>
            <span>~{model.vramEstimate} MB VRAM</span>
            {model.metadata.parameters && <span>{model.metadata.parameters}</span>}
            {model.metadata.quantization && <span>{model.metadata.quantization}</span>}
          </div>
        </div>
        <div className="flex-shrink-0">
          {model.status === 'ready' ? (
            <span className="flex items-center gap-1 text-2xs text-green-500">
              <Check size={12} /> Ready
            </span>
          ) : (
            <span className="flex items-center gap-1 text-2xs text-yellow-500">
              <AlertCircle size={12} /> No runtime
            </span>
          )}
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-white/[0.06]">
          <div className="grid grid-cols-2 gap-2 text-2xs">
            <div><span className="text-text-muted">Path:</span> <span className="text-text-primary">{model.path}</span></div>
            <div><span className="text-text-muted">Format:</span> <span className="text-text-primary">{model.format}</span></div>
            {model.metadata.family && <div><span className="text-text-muted">Family:</span> <span className="text-text-primary">{model.metadata.family}</span></div>}
            <div><span className="text-text-muted">Modified:</span> <span className="text-text-primary">{new Date(model.lastModified).toLocaleDateString()}</span></div>
          </div>
        </div>
      )}
    </div>
  )
}

// Catalog Card Component
function CatalogCard({ model, onDownload }: { model: CatalogModel; onDownload: () => void }) {
  return (
    <div className="rounded-lg border border-white/[0.06] p-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">{model.name}</span>
            <span className={`px-1.5 py-0.5 rounded text-2xs ${
              model.type === 'llm' ? 'bg-blue-500/10 text-blue-500' :
              model.type === 'checkpoint' ? 'bg-purple-500/10 text-purple-500' :
              'bg-gray-500/10 text-gray-500'
            }`}>
              {model.type.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1">{model.description}</p>
          <div className="flex items-center gap-3 mt-2 text-2xs text-text-muted">
            <span>{model.sizeFormatted}</span>
            <span>~{(model.vramRequirement / 1000).toFixed(0)} GB VRAM</span>
            <span>{model.parameters}</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <a
              href={model.licenseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-2xs text-accent hover:underline flex items-center gap-1"
            >
              {model.license} <ExternalLink size={10} />
            </a>
          </div>
        </div>
        <button
          onClick={onDownload}
          className="btn btn-primary text-xs flex items-center gap-1"
        >
          <Download size={12} />
          Install
        </button>
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {model.tags.map(tag => (
          <span key={tag} className="px-1.5 py-0.5 rounded text-2xs bg-surface-2 text-text-muted">
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

// Runtime Card Component
function RuntimeCard({ runtime }: { runtime: RuntimeType }) {
  return (
    <div className="rounded-lg border border-white/[0.06] p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-accent" />
            <span className="text-sm font-medium text-text-primary">{runtime.name}</span>
          </div>
          {runtime.detectedPath && (
            <p className="text-2xs text-text-muted mt-1">{runtime.detectedPath}</p>
          )}
        </div>
        <div>
          {runtime.status === 'installed' ? (
            <span className="flex items-center gap-1 text-xs text-green-500">
              <Check size={14} /> Installed
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <AlertCircle size={14} /> Not Found
            </span>
          )}
        </div>
      </div>
    </div>
  )
}