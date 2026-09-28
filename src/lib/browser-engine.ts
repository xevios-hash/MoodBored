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

class TauriBrowserEngine implements BrowserEngine {
  private invoke: ((cmd: string, args?: any) => Promise<any>) | null = null

  private async getInvoke() {
    if (this.invoke) return this.invoke
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      this.invoke = invoke
      return invoke
    } catch {
      return null
    }
  }

  async createWebView(itemId: string, url: string): Promise<void> {
    const invoke = await this.getInvoke()
    if (!invoke) return
    try {
      await invoke('create_web_view', { itemId, url })
    } catch (e) {
      console.warn('[TauriBrowser] createWebView failed:', e)
    }
  }

  async navigate(itemId: string, url: string): Promise<void> {
    const invoke = await this.getInvoke()
    if (!invoke) return
    try {
      await invoke('navigate_web_view', { itemId, url })
    } catch (e) {
      console.warn('[TauriBrowser] navigate failed:', e)
    }
  }

  async goBack(itemId: string): Promise<void> {
    const invoke = await this.getInvoke()
    if (!invoke) return
    try {
      await invoke('web_view_go_back', { itemId })
    } catch (e) {
      console.warn('[TauriBrowser] goBack failed:', e)
    }
  }

  async goForward(itemId: string): Promise<void> {
    const invoke = await this.getInvoke()
    if (!invoke) return
    try {
      await invoke('web_view_go_forward', { itemId })
    } catch (e) {
      console.warn('[TauriBrowser] goForward failed:', e)
    }
  }

  async reload(itemId: string): Promise<void> {
    const invoke = await this.getInvoke()
    if (!invoke) return
    try {
      await invoke('web_view_reload', { itemId })
    } catch (e) {
      console.warn('[TauriBrowser] reload failed:', e)
    }
  }

  async close(itemId: string): Promise<void> {
    const invoke = await this.getInvoke()
    if (!invoke) return
    try {
      await invoke('close_web_view', { itemId })
    } catch (e) {
      console.warn('[TauriBrowser] close failed:', e)
    }
  }

  async getCookies(itemId: string): Promise<string> {
    const invoke = await this.getInvoke()
    if (!invoke) return ''
    try {
      return await invoke('get_web_view_cookies', { itemId }) || ''
    } catch {
      return ''
    }
  }

  async setCookies(itemId: string, cookies: string): Promise<void> {
    const invoke = await this.getInvoke()
    if (!invoke) return
    try {
      await invoke('set_web_view_cookies', { itemId, cookies })
    } catch (e) {
      console.warn('[TauriBrowser] setCookies failed:', e)
    }
  }

  async getTitle(itemId: string): Promise<string> {
    const invoke = await this.getInvoke()
    if (!invoke) return ''
    try {
      return await invoke('get_web_view_title', { itemId }) || ''
    } catch {
      return ''
    }
  }

  async getFavicon(itemId: string): Promise<string> {
    const invoke = await this.getInvoke()
    if (!invoke) return ''
    try {
      return await invoke('get_web_view_favicon', { itemId }) || ''
    } catch {
      return ''
    }
  }

  async focus(itemId: string): Promise<void> {
    const invoke = await this.getInvoke()
    if (!invoke) return
    try {
      await invoke('focus_web_view', { itemId })
    } catch (e) {
      console.warn('[TauriBrowser] focus failed:', e)
    }
  }

  async unfocus(itemId: string): Promise<void> {
    const invoke = await this.getInvoke()
    if (!invoke) return
    try {
      await invoke('unfocus_web_view', { itemId })
    } catch (e) {
      console.warn('[TauriBrowser] unfocus failed:', e)
    }
  }
}

let engine: BrowserEngine | null = null

export function getBrowserEngine(): BrowserEngine {
  if (engine) return engine
  if (isTauri()) {
    engine = new TauriBrowserEngine()
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