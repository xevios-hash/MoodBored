// Missing Runtime Banner
// Non-blocking notice when user tries to use a feature that needs a missing runtime

import { useState, useEffect } from 'react'
import { X, Download, ExternalLink, AlertCircle } from 'lucide-react'

interface RuntimeBanner {
  id: string
  runtime: string
  feature: string
  downloadUrl: string
  message: string
}

const RUNTIME_DOWNLOADS: Record<string, { url: string; name: string }> = {
  'llama-cpp': {
    url: 'https://github.com/ggerganov/llama.cpp/releases',
    name: 'llama.cpp',
  },
  'ollama': {
    url: 'https://ollama.ai/download',
    name: 'Ollama',
  },
  'lmstudio': {
    url: 'https://lmstudio.ai/',
    name: 'LM Studio',
  },
  'comfyui': {
    url: 'https://github.com/comfyanonymous/ComfyUI',
    name: 'ComfyUI',
  },
  'automatic1111': {
    url: 'https://github.com/AUTOMATIC1111/stable-diffusion-webui',
    name: 'Automatic1111',
  },
  'invokeai': {
    url: 'https://github.com/invoke-ai/InvokeAI',
    name: 'Invoke AI',
  },
}

interface Props {
  runtime: string
  feature: string
  onDismiss: () => void
}

export function RuntimeBanner({ runtime, feature, onDismiss }: Props) {
  const [visible, setVisible] = useState(true)

  const downloadInfo = RUNTIME_DOWNLOADS[runtime]

  if (!visible || !downloadInfo) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 animate-slideUp">
      <div className="glass-card rounded-lg shadow-lg border border-yellow-500/20 p-4 max-w-md">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary">
              {downloadInfo.name} not found
            </p>
            <p className="text-xs text-text-muted mt-1">
              {feature} requires {downloadInfo.name}. Install it to use local AI features.
            </p>
            <div className="flex items-center gap-3 mt-3">
              <a
                href={downloadInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary text-xs flex items-center gap-1"
              >
                <Download size={12} />
                Download {downloadInfo.name}
                <ExternalLink size={10} />
              </a>
              <button
                onClick={() => {
                  setVisible(false)
                  onDismiss()
                }}
                className="btn btn-ghost text-xs"
              >
                Dismiss
              </button>
            </div>
          </div>
          <button
            onClick={() => {
              setVisible(false)
              onDismiss()
            }}
            className="p-1 hover:bg-surface-2 rounded transition-colors"
          >
            <X size={14} className="text-text-muted" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Hook to manage runtime banners
export function useRuntimeBanners() {
  const [banners, setBanners] = useState<RuntimeBanner[]>([])

  const showBanner = (runtime: string, feature: string) => {
    const downloadInfo = RUNTIME_DOWNLOADS[runtime]
    if (!downloadInfo) return

    const banner: RuntimeBanner = {
      id: `${runtime}-${Date.now()}`,
      runtime,
      feature,
      downloadUrl: downloadInfo.url,
      message: `${downloadInfo.name} not found — ${feature} requires it.`,
    }

    setBanners(prev => {
      // Don't show duplicate banners
      if (prev.some(b => b.runtime === runtime)) return prev
      return [...prev, banner]
    })

    // Auto-dismiss after 30 seconds
    setTimeout(() => {
      dismissBanner(banner.id)
    }, 30000)
  }

  const dismissBanner = (id: string) => {
    setBanners(prev => prev.filter(b => b.id !== id))
  }

  return { banners, showBanner, dismissBanner }
}

// Runtime availability checker
export async function checkRuntimeAvailability(runtime: string): Promise<boolean> {
  const endpoints: Record<string, string> = {
    'llama-cpp': 'http://localhost:8080/health',
    'ollama': 'http://localhost:11434/api/tags',
    'lmstudio': 'http://localhost:1234/v1/models',
    'comfyui': 'http://localhost:8188/system_stats',
    'automatic1111': 'http://localhost:7860/sdapi/v1/sd-models',
    'invokeai': 'http://localhost:9090/api/v1/app/version',
  }

  const endpoint = endpoints[runtime]
  if (!endpoint) return false

  try {
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(3000),
    })
    return response.ok
  } catch {
    return false
  }
}