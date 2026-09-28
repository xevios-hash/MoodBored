import type { ChromeTab, BoardItem } from '@/types'
import { getDomain, getFaviconUrl } from '@/lib/browser-engine'
import { v4 as uuid } from 'uuid'

export async function getChromeTabs(): Promise<ChromeTab[]> {
  // Try native Chrome DevTools Protocol via Tauri
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const tabs = await invoke<ChromeTab[]>('get_chrome_tabs')
      if (tabs && tabs.length > 0) return tabs
    } catch (e) {
      console.warn('[ChromeImport] Tauri native failed:', e)
    }
  }

  // Try Chrome extension bridge
  try {
    const tabs = await getTabsViaExtension()
    if (tabs && tabs.length > 0) return tabs
  } catch (e) {
    console.warn('[ChromeImport] Extension bridge failed:', e)
  }

  // Fallback: read from clipboard or manual input
  return []
}

async function getTabsViaExtension(): Promise<ChromeTab[]> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timeout')), 3000)

    window.addEventListener('message', function handler(e: MessageEvent) {
      if (e.data?.type === 'moodbored:chrome-tabs') {
        clearTimeout(timeout)
        window.removeEventListener('message', handler)
        resolve(e.data.tabs || [])
      }
    })

    window.postMessage({ type: 'moodbored:request-chrome-tabs' }, '*')
  })
}

export function groupTabsByDomain(tabs: ChromeTab[]): Map<string, ChromeTab[]> {
  const groups = new Map<string, ChromeTab[]>()
  for (const tab of tabs) {
    const domain = getDomain(tab.url) || 'other'
    const list = groups.get(domain) || []
    list.push(tab)
    groups.set(domain, list)
  }
  return groups
}

export function tabsToBoardItems(tabs: ChromeTab[], startX = 50, startY = 50): BoardItem[] {
  const grouped = groupTabsByDomain(tabs)
  const items: BoardItem[] = []
  let x = startX
  let y = startY
  const colWidth = 320
  const rowHeight = 220
  const maxCols = Math.ceil(Math.sqrt(tabs.length))

  let col = 0
  for (const [domain, domainTabs] of grouped) {
    for (const tab of domainTabs) {
      items.push({
        kind: 'web',
        id: uuid(),
        url: tab.url,
        title: tab.title,
        favicon: tab.favIconUrl || getFaviconUrl(tab.url),
        cardType: 'web',
        isLoading: false,
        isFocused: false,
        history: { urls: [tab.url], index: 0 },
        cookies: '',
        purpose: `Imported from Chrome`,
        importance: tab.pinned ? 'Pinned tab' : 'Open tab',
        tags: [`domain:${domain}`, tab.pinned ? 'pinned' : 'open'],
        pos: { x, y },
        size: { w: 300, h: 200 },
      } as any)
      x += colWidth + 20
      col++
      if (col >= maxCols) {
        col = 0
        x = startX
        y += rowHeight + 20
      }
    }
  }

  return items
}

export function generateImportSummary(tabs: ChromeTab[]): string {
  const grouped = groupTabsByDomain(tabs)
  const lines: string[] = [
    `## Chrome Import Summary`,
    '',
    `**${tabs.length} tabs** from **${grouped.size} domains**`,
    '',
  ]

  for (const [domain, domainTabs] of grouped) {
    lines.push(`### ${domain} (${domainTabs.length})`)
    for (const tab of domainTabs) {
      lines.push(`- [${tab.title}](${tab.url})${tab.pinned ? ' 📌' : ''}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}