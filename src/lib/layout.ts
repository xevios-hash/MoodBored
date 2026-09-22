import type { BoardItem, Position, Size, ConnectorItem } from '@/types'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function getItemRect(item: BoardItem): Rect | null {
  if (item.kind === 'connector') return null
  return {
    x: item.pos.x,
    y: item.pos.y,
    w: item.size?.w ?? 250,
    h: item.size?.h ?? 150,
  }
}

function overlaps(a: Rect, b: Rect, padding = 20): boolean {
  return !(
    a.x + a.w + padding < b.x ||
    b.x + b.w + padding < a.x ||
    a.y + a.h + padding < b.y ||
    b.y + b.h + padding < a.y
  )
}

export function findFreePosition(
  item: BoardItem,
  existingItems: BoardItem[],
  preferredPos?: Position,
): Position {
  if (item.kind === 'connector') return { x: 0, y: 0 }

  const w = item.size?.w ?? 250
  const h = item.size?.h ?? 150
  const base = preferredPos || item.pos

  const rects = existingItems
    .filter((i) => i.kind !== 'connector')
    .map(getItemRect)
    .filter(Boolean) as Rect[]

  const candidate: Rect = { x: base.x, y: base.y, w, h }
  const hasCollision = rects.some((r) => overlaps(candidate, r))
  if (!hasCollision) return base

  // Spiral outward to find free position
  const step = 40
  const maxRadius = 2000
  for (let radius = step; radius < maxRadius; radius += step) {
    const directions: Position[] = [
      { x: base.x + radius, y: base.y },
      { x: base.x - radius, y: base.y },
      { x: base.x, y: base.y + radius },
      { x: base.x, y: base.y - radius },
      { x: base.x + radius, y: base.y + radius },
      { x: base.x - radius, y: base.y - radius },
      { x: base.x + radius, y: base.y - radius },
      { x: base.x - radius, y: base.y + radius },
    ]

    for (const pos of directions) {
      const test: Rect = { x: pos.x, y: pos.y, w, h }
      if (!rects.some((r) => overlaps(test, r))) {
        return pos
      }
    }
  }

  // Fallback: offset down
  return { x: base.x, y: base.y + 400 }
}

export function getConnectorEndpoints(
  connector: ConnectorItem,
  items: BoardItem[],
): { from: Position; to: Position } | null {
  const fromItem = items.find((i) => i.id === connector.fromId)
  const toItem = items.find((i) => i.id === connector.toId)
  if (!fromItem || !toItem) return null
  if (fromItem.kind === 'connector' || toItem.kind === 'connector') return null

  const fromRect = getItemRect(fromItem)
  const toRect = getItemRect(toItem)
  if (!fromRect || !toRect) return null

  return {
    from: {
      x: fromRect.x + fromRect.w / 2,
      y: fromRect.y + fromRect.h / 2,
    },
    to: {
      x: toRect.x + toRect.w / 2,
      y: toRect.y + toRect.h / 2,
    },
  }
}

export function getItemCenter(item: BoardItem): Position | null {
  if (item.kind === 'connector') return null
  const rect = getItemRect(item)
  if (!rect) return null
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
}

export function hitTestItem(items: BoardItem[], wx: number, wy: number): BoardItem | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    if (item.kind === 'connector') continue
    const rect = getItemRect(item)
    if (!rect) continue
    if (wx >= rect.x && wx <= rect.x + rect.w && wy >= rect.y && wy <= rect.y + rect.h) {
      return item
    }
  }
  return null
}
