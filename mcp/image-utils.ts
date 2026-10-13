export interface VisionImageData {
  data: string // base64, no data: prefix
  mimeType: string
}

const MAX_BYTES = 4_500_000
const TIMEOUT_MS = 10000

function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length > 3 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes.length > 5 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif'
  if (bytes.length > 11 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp'
  return null
}

function mimeFromUrl(url: string): string | null {
  const m = /\.(png|jpe?g|gif|webp|bmp|avif)(\?|#|$)/i.exec(url)
  return m ? `image/${m[1].toLowerCase().replace('jpg', 'jpeg')}` : null
}

export function parseDataImageUrl(url: string): VisionImageData | null {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(url || '')
  if (!m) return null
  const mimeType = m[1] || 'image/png'
  if (!mimeType.startsWith('image/')) return null
  const data = m[2] ? m[3] : Buffer.from(m[3], 'utf-8').toString('base64')
  if (!data || data.length > MAX_BYTES * 1.4) return null
  return { data, mimeType }
}

export async function fetchImageForVision(ref: string): Promise<VisionImageData | null> {
  if (!ref) return null
  try {
    if (ref.startsWith('data:')) return parseDataImageUrl(ref)
    if (!/^https?:\/\//i.test(ref)) return null // blob:/file: not reachable from the MCP process

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const res = await fetch(ref, { signal: ctrl.signal, redirect: 'follow' })
    clearTimeout(timer)
    if (!res.ok) return null

    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim()
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0 || buf.length > MAX_BYTES) return null

    const mimeType = (contentType.startsWith('image/') ? contentType : null) || sniffMime(buf) || mimeFromUrl(ref)
    if (!mimeType || !mimeType.startsWith('image/')) return null
    return { data: buf.toString('base64'), mimeType }
  } catch {
    return null
  }
}

// Board image items carry their render URL in fullSource/thumbnail/source.
export function imageRefOf(item: any): string {
  const url = item?.fullSource || item?.thumbnail || item?.source || ''
  return typeof url === 'string' ? url : ''
}
