// Offline Mode Manager
// Ensures desktop builds work fully offline

export interface OfflineState {
  isOnline: boolean
  lastChecked: Date | null
  pendingSyncs: number
  offlineFeatures: string[]
  degradedFeatures: string[]
}

export type OfflineListener = (state: OfflineState) => void

class OfflineModeManager {
  private state: OfflineState = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastChecked: null,
    pendingSyncs: 0,
    offlineFeatures: [],
    degradedFeatures: [],
  }

  private listeners: Set<OfflineListener> = new Set()
  private checkInterval: NodeJS.Timeout | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.updateOnlineStatus(true))
      window.addEventListener('offline', () => this.updateOnlineStatus(false))
    }
  }

  getState(): OfflineState {
    return { ...this.state }
  }

  subscribe(listener: OfflineListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private updateOnlineStatus(isOnline: boolean): void {
    const wasOffline = !this.state.isOnline
    this.state.isOnline = isOnline
    this.state.lastChecked = new Date()

    if (isOnline && wasOffline) {
      // Back online - trigger sync
      this.onBackOnline()
    }

    this.notifyListeners()
  }

  private onBackOnline(): void {
    // In production, this would sync pending changes
    console.log('[MoodBored] Back online - syncing pending changes...')
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state)
      } catch {}
    }
  }

  // Check if a feature is available offline
  isFeatureAvailable(feature: string): boolean {
    // Local features are always available
    const localFeatures = [
      'canvas',
      'notes',
      'images',
      'connections',
      'export',
      'local-inference',
      'model-scanning',
    ]

    if (localFeatures.includes(feature)) return true

    // Cloud features require online
    const cloudFeatures = [
      'ai-chat',
      'image-generation',
      'unsplash',
      'collaboration',
      'cloud-sync',
    ]

    if (cloudFeatures.includes(feature)) return this.state.isOnline

    // Unknown features default to available
    return true
  }

  // Get feature status message
  getFeatureStatus(feature: string): { available: boolean; message?: string } {
    if (this.isFeatureAvailable(feature)) {
      return { available: true }
    }

    const messages: Record<string, string> = {
      'ai-chat': 'AI chat requires internet connection. Local models (Ollama, LM Studio) work offline.',
      'image-generation': 'Image generation requires internet or a local runtime (ComfyUI, Automatic1111).',
      'unsplash': 'Unsplash search requires internet connection.',
      'collaboration': 'Real-time collaboration requires internet connection.',
      'cloud-sync': 'Cloud sync requires internet connection.',
    }

    return {
      available: false,
      message: messages[feature] || 'This feature requires internet connection.',
    }
  }

  // Start periodic connectivity check
  startConnectivityCheck(intervalMs: number = 30000): void {
    this.stopConnectivityCheck()
    this.checkInterval = setInterval(() => {
      this.checkConnectivity()
    }, intervalMs)
  }

  stopConnectivityCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  async checkConnectivity(): Promise<boolean> {
    try {
      const response = await fetch('/api/board/health', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })
      const isOnline = response.ok
      this.updateOnlineStatus(isOnline)
      return isOnline
    } catch {
      this.updateOnlineStatus(false)
      return false
    }
  }

  // Get offline banner message
  getOfflineBanner(): { show: boolean; message: string; type: 'info' | 'warning' | 'error' } | null {
    if (this.state.isOnline) return null

    return {
      show: true,
      message: 'You\'re offline. Local features work normally. Cloud features are unavailable.',
      type: 'warning',
    }
  }

  // Get runtime-specific offline message
  getRuntimeOfflineMessage(runtime: string): string | null {
    if (this.state.isOnline) return null

    const messages: Record<string, string> = {
      'openrouter': 'OpenRouter requires internet. Use local models instead.',
      'openai': 'OpenAI requires internet. Use local models instead.',
      'anthropic': 'Anthropic requires internet. Use local models instead.',
    }

    return messages[runtime] || null
  }
}

// Singleton instance
export const offlineManager = new OfflineModeManager()

// React hook for offline state
export function useOfflineState(): OfflineState {
  // In a real React app, this would use useState + useEffect
  return offlineManager.getState()
}

// Feature availability check
export function isFeatureAvailable(feature: string): boolean {
  return offlineManager.isFeatureAvailable(feature)
}

// Get offline-aware fetch wrapper
export async function offlineAwareFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  // Check if we're online
  if (!offlineManager.getState().isOnline) {
    // For local URLs, try anyway (might be local server)
    if (url.startsWith('/') || url.startsWith('http://localhost')) {
      return fetch(url, options)
    }
    throw new Error('Offline - cannot fetch remote resource')
  }

  return fetch(url, options)
}