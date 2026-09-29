import type { BrowserHistory, WebItem } from '@/types'

const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export interface BrowserEngine {
  createWebView(itemId: string, url: string): Promise<void>
  navigate(itemId: string, url: string): Promise<void>
  goBack(itemId: string): Promise<void>
  goForward(itemId: string): Promise<void>
  reload(itemId: string): Promise<void>
  close(itemId: string): Promise<void>
  getCookies(itemId: string): Promise<string>
  setCookies(itemId: string, cookies: string): Promise<void>
  getTitle(itemId: string): Promise<string>
  getFavicon(itemId: string): Promise<string>
  focus(itemId: string): Promise<void>
  unfocus(itemId: string): Promise<void>
  // Position/size management for WebContentsView
  setBounds(itemId: string, x: number, y: number, width: number, height: number): Promise<void>
  setVisible(itemId: string, visible: boolean): Promise<void>
}

class TauriWebContentsEngine implements BrowserEngine {
  private webviews = new Map<string, any>()
  private historyMap = new Map<string, BrowserHistory>()
  private cookiesMap = new Map<string, string>()

  async createWebView(itemId: string, url: string): Promise<void> {
    try {
      const { Webview } = await import('@tauri-apps/api/webview')
      const { getCurrentWindow } = await import('@tauri-apps/api/window')

      const window = getCurrentWindow()
      const webview = new Webview(window, `web-${itemId}`, {
        url: url || 'about:blank',
        x: 0,
        y: 0,
        width: 640,
        height: 480,
      })

      this.webviews.set(itemId, webview)
      this.historyMap.set(itemId, { urls: [url], index: 0 })
      console.log(`[TauriWebContents] Created webview for ${itemId}: ${url}`)
    } catch (e) {
      console.warn('[TauriWebContents] createWebView failed:', e)
    }
  }

  async navigate(itemId: string, url: string): Promise<void> {
    try {
      const webview = this.webviews.get(itemId)
      if (webview) {
        await webview.navigate(new URL(url))
        // Update history
        const history = this.historyMap.get(itemId)
        if (history) {
          const newUrls = history.urls.slice(0, history.index + 1)
          newUrls.push(url)
          this.historyMap.set(itemId, { urls: newUrls, index: newUrls.length - 1 })
        }
      }
    } catch (e) {
      console.warn('[TauriWebContents] navigate failed:', e)
    }
  }

  async goBack(itemId: string): Promise<void> {
    try {
      const webview = this.webviews.get(itemId)
      const history = this.historyMap.get(itemId)
      if (webview && history && history.index > 0) {
        history.index--
        await webview.navigate(new URL(history.urls[history.index]))
      }
    } catch (e) {
      console.warn('[TauriWebContents] goBack failed:', e)
    }
  }

  async goForward(itemId: string): Promise<void> {
    try {
      const webview = this.webviews.get(itemId)
      const history = this.historyMap.get(itemId)
      if (webview && history && history.index < history.urls.length - 1) {
        history.index++
        await webview.navigate(new URL(history.urls[history.index]))
      }
    } catch (e) {
      console.warn('[TauriWebContents] goForward failed:', e)
    }
  }

  async reload(itemId: string): Promise<void> {
    try {
      const webview = this.webviews.get(itemId)
      if (webview) {
        await webview.reload()
      }
    } catch (e) {
      console.warn('[TauriWebContents] reload failed:', e)
    }
  }

  async close(itemId: string): Promise<void> {
    try {
      const webview = this.webviews.get(itemId)
      if (webview) {
        await webview.close()
        this.webviews.delete(itemId)
      }
      this.historyMap.delete(itemId)
      this.cookiesMap.delete(itemId)
    } catch (e) {
      console.warn('[TauriWebContents] close failed:', e)
    }
  }

  async getCookies(itemId: string): Promise<string> {
    return this.cookiesMap.get(itemId) || ''
  }

  async setCookies(itemId: string, cookies: string): Promise<void> {
    this.cookiesMap.set(itemId, cookies)
  }

  async getTitle(itemId: string): Promise<string> {
    try {
      const webview = this.webviews.get(itemId)
      if (webview) {
        return await webview.title() || ''
      }
    } catch (e) {
      console.warn('[TauriWebContents] getTitle failed:', e)
    }
    return ''
  }

  async getFavicon(itemId: string): Promise<string> {
    return ''
  }

  async focus(itemId: string): Promise<void> {
    try {
      const webview = this.webviews.get(itemId)
      if (webview) {
        await webview.setFocus(true)
      }
    } catch (e) {
      console.warn('[TauriWebContents] focus failed:', e)
    }
  }

  async unfocus(itemId: string): Promise<void> {
    try {
      const webview = this.webviews.get(itemId)
      if (webview) {
        await webview.setFocus(false)
      }
    } catch (e) {
      console.warn('[TauriWebContents] unfocus failed:', e)
    }
  }

  async setBounds(itemId: string, x: number, y: number, width: number, height: number): Promise<void> {
    try {
      const webview = this.webviews.get(itemId)
      if (webview) {
        await webview.setPosition({ x, y })
        await webview.setSize({ width, height })
      }
    } catch (e) {
      console.warn('[TauriWebContents] setBounds failed:', e)
    }
  }

  async setVisible(itemId: string, visible: boolean): Promise<void> {
    try {
      const webview = this.webviews.get(itemId)
      if (webview) {
        await webview.setVisible(visible)
      }
    } catch (e) {
      console.warn('[TauriWebContents] setVisible failed:', e)
    }
  }
}

class IFrameBrowserEngine implements BrowserEngine {
  private frames = new Map<string, HTMLIFrameElement>()
  private historyMap = new Map<string, BrowserHistory>()
  private cookiesMap = new Map<string, string>()

  async createWebView(itemId: string, url: string): Promise<void> {
    this.historyMap.set(itemId, { urls: [url], index: 0 })
  }

  async navigate(itemId: string, url: string): Promise<void> {
    const history = this.historyMap.get(itemId)
    if (history) {
      const newUrls = history.urls.slice(0, history.index + 1)
      newUrls.push(url)
      this.historyMap.set(itemId, { urls: newUrls, index: newUrls.length - 1 })
    } else {
      this.historyMap.set(itemId, { urls: [url], index: 0 })
    }
  }

  async goBack(itemId: string): Promise<void> {
    const history = this.historyMap.get(itemId)
    if (history && history.index > 0) {
      history.index--
    }
  }

  async goForward(itemId: string): Promise<void> {
    const history = this.historyMap.get(itemId)
    if (history && history.index < history.urls.length - 1) {
      history.index++
    }
  }

  async reload(_itemId: string): Promise<void> {
    // iframe reload handled by src change
  }

  async close(itemId: string): Promise<void> {
    this.frames.delete(itemId)
    this.historyMap.delete(itemId)
    this.cookiesMap.delete(itemId)
  }

  async getCookies(itemId: string): Promise<string> {
    return this.cookiesMap.get(itemId) || ''
  }

  async setCookies(itemId: string, cookies: string): Promise<void> {
    this.cookiesMap.set(itemId, cookies)
  }

  async getTitle(_itemId: string): Promise<string> {
    return ''
  }

  async getFavicon(_itemId: string): Promise<string> {
    return ''
  }

  async focus(_itemId: string): Promise<void> {}

  async unfocus(_itemId: string): Promise<void> {}

  async setBounds(_itemId: string, _x: number, _y: number, _width: number, _height: number): Promise<void> {}

  async setVisible(_itemId: string, _visible: boolean): Promise<void> {}

  getCurrentUrl(itemId: string): string {
    const history = this.historyMap.get(itemId)
    if (history && history.urls.length > 0) {
      return history.urls[history.index] || ''
    }
    return ''
  }

  getHistory(itemId: string): BrowserHistory {
    return this.historyMap.get(itemId) || { urls: [], index: 0 }
  }
}

let engine: BrowserEngine | null = null

export function getBrowserEngine(): BrowserEngine {
  if (engine) return engine
  if (isTauri()) {
    engine = new TauriWebContentsEngine()
  } else {
    engine = new IFrameBrowserEngine()
  }
  return engine
}

export function isWebUrl(text: string): boolean {
  try {
    const url = new URL(text)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return /^https?:\/\//i.test(text) || /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(text)
  }
}

export function isSearchQuery(text: string): boolean {
  return !isWebUrl(text) && text.trim().length > 0 && !text.startsWith('{') && !text.startsWith('[')
}

export function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(trimmed)) return `https://${trimmed}`
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
}

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return ''
  }
}

export function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  } catch {
    return ''
  }
}

export function searchToUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

// Check if we're running in Tauri desktop mode
export function isTauriMode(): boolean {
  return isTauri()
}

// Sites known to block iframe embedding (for web fallback)
const BLOCKED_SITES = [
  'google.com', 'www.google.com', 'accounts.google.com',
  'facebook.com', 'www.facebook.com',
  'twitter.com', 'x.com', 'www.twitter.com',
  'youtube.com', 'www.youtube.com',
  'instagram.com', 'www.instagram.com',
  'linkedin.com', 'www.linkedin.com',
  'github.com', 'www.github.com',
  'amazon.com', 'www.amazon.com',
  'netflix.com', 'www.netflix.com',
  'apple.com', 'www.apple.com',
  'microsoft.com', 'www.microsoft.com',
  'reddit.com', 'www.reddit.com',
  'stackoverflow.com', 'www.stackoverflow.com',
]

export function isLikelyBlocked(url: string): boolean {
  if (isTauri()) return false // Tauri WebViews don't have X-Frame-Options restrictions
  try {
    const domain = new URL(url).hostname
    return BLOCKED_SITES.includes(domain)
  } catch {
    return false
  }
}