import type { BoardItem } from '@/types'
import { imageItemUrl, isVisionUsable, type VisionImage } from './vision'

export interface SelectionContext {
  ids: string[]
  items: BoardItem[]
  label: string
  text: string
  images: VisionImage[]
}

function short(s: string | undefined, max = 400): string {
  if (!s) return ''
  return s.length > max ? `${s.slice(0, max)}...` : s
}

export function describeItemFull(item: any): string {
  const tags = (item.tags || []).length > 0 ? ` [${(item.tags || []).join(', ')}]` : ''
  switch (item.kind) {
    case 'note':
      return `note: "${short(item.text)}"${item.purpose ? ` purpose=${short(item.purpose, 120)}` : ''}${tags}`
    case 'text':
      return `text: "${short(item.raw)}"${tags}`
    case 'image':
      return `image: ${short(item.description, 200)}${item.source ? ` source=${short(item.source, 120)}` : ''}${imageItemUrl(item) ? ` url=${short(imageItemUrl(item), 160)}` : ''}${tags}`
    case 'link':
      return `link: ${short(item.title, 120)} ${short(item.url, 160)}${item.description ? ` — ${short(item.description, 200)}` : ''}${tags}`
    case 'video':
      return `video: ${short(item.subjectDesc, 200)}${item.sourceUrl || item.source ? ` url=${short(item.sourceUrl || item.source, 160)}` : ''}${tags}`
    case 'web':
      return `web: ${short(item.title, 120)} ${short(item.url, 160)}${tags}`
    case 'palette':
      return `palette: "${short(item.label, 120)}" colors=${(item.colors || []).map((c: any) => `${c.hex}${c.label ? `(${c.label})` : ''}`).join(', ')}${tags}`
    case 'gradient':
      return `gradient: "${short(item.label, 120)}" ${item.direction ?? 90}deg ${(item.stops || []).map((s: any) => `${s.color}@${s.position}`).join(' -> ')}${tags}`
    case 'font':
      return `font: ${item.fontFamily}${item.weights ? ` weights=${item.weights.join(',')}` : ''}${item.sampleText ? ` sample="${short(item.sampleText, 120)}"` : ''}${tags}`
    case 'swatch':
      return `swatch: ${item.hex} ${short(item.name, 80)}${item.usage ? ` usage=${short(item.usage, 120)}` : ''}${tags}`
    case 'sizeguide':
      return `sizeguide: ${item.width}x${item.height}${item.unit || 'px'} (${item.orientation || 'landscape'})${item.label ? ` "${short(item.label, 80)}"` : ''}${tags}`
    case 'container':
      return `container: "${short(item.label, 120)}" layout=${item.layout} children=${(item.children || []).length}${tags}`
    case 'file':
      return `file: ${short(item.fileName, 80)} (${item.language}) ${item.filePath || ''}`
    case 'connector':
      return `connector: ${item.fromId} -> ${item.toId} "${short(item.label, 80)}"`
    default:
      return `${item.kind}: ${short(item.text || item.raw || item.description || item.label || item.title || item.url || '')}${tags}`
  }
}

export function buildSelectionContext(
  items: BoardItem[],
  selectedIds?: Set<string> | string[] | null,
): SelectionContext {
  const selected = selectedIds
    ? (selectedIds instanceof Set ? selectedIds : new Set(selectedIds))
    : new Set<string>()
  const picked = items.filter(i => selected.has(i.id))
  const images: VisionImage[] = []
  for (const item of picked) {
    if ((item as any).kind !== 'image') continue
    const url = imageItemUrl(item)
    if (!isVisionUsable(url)) continue
    images.push({ id: item.id, url, description: (item as any).description || 'image on board' })
    if (images.length >= 8) break
  }
  const kinds: Record<string, number> = {}
  for (const item of picked) kinds[item.kind] = (kinds[item.kind] || 0) + 1
  const kindLabel = Object.entries(kinds).map(([k, v]) => `${v} ${k}${v > 1 ? 's' : ''}`).join(', ')
  return {
    ids: picked.map(i => i.id),
    items: picked,
    label: picked.length === 0 ? '' : `${picked.length} item${picked.length > 1 ? 's' : ''} — ${kindLabel}`,
    text: picked.map(i => `- [${i.id}] ${describeItemFull(i)}`).join('\n'),
    images,
  }
}
