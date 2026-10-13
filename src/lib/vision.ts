import type { BoardItem, ImageItem } from '@/types'

export interface VisionImage {
  id: string
  url: string
  description: string
}

export interface TextPart {
  type: 'text'
  text: string
}

export interface ImagePart {
  type: 'image_url'
  image_url: { url: string; detail?: 'low' | 'high' | 'auto' }
}

export type MessageContent = string | (TextPart | ImagePart)[]

const VISION_MODEL_PATTERNS = [
  /gpt-4o/i, /gpt-4\.1/i, /gpt-4-turbo/i, /gpt-4-v/i, /o1/i, /o3/i, /o4/i,
  /claude-3/i, /claude-sonnet/i, /claude-opus/i, /claude-haiku/i,
  /gemini/i, /llava/i, /moondream/i, /qwen.*vl/i, /qwen2-vl/i, /qwen2\.5-vl/i,
  /llama3\.2-vision/i, /llama-vision/i, /pixtral/i, /mistral-small.*vision/i,
  /glm-4v/i, /glm-4\.1v/i, /internvl/i, /cogvlm/i, /minicpm-v/i, /phi-3\.5-vision/i,
  /phi-4-multimodal/i, /deepseek-vl/i, /grok.*vision/i, /multimodal/i, /vision/i,
]

export function isVisionModel(model: string): boolean {
  if (!model) return false
  return VISION_MODEL_PATTERNS.some(p => p.test(model))
}

export function imageItemUrl(item: ImageItem | any): string {
  const url = item?.fullSource || item?.thumbnail || item?.source || ''
  return typeof url === 'string' ? url : ''
}

export function isVisionUsable(url: string): boolean {
  return !!url && !url.startsWith('blob:') && (
    url.startsWith('data:image') || url.startsWith('http://') || url.startsWith('https://')
  )
}

export function collectVisionImages(
  items: BoardItem[],
  selectedIds?: Set<string> | string[],
  limit = 6,
): VisionImage[] {
  const selected = selectedIds
    ? (selectedIds instanceof Set ? selectedIds : new Set(selectedIds))
    : null
  const images = items.filter(i => i.kind === 'image') as ImageItem[]
  const preferred = selected ? images.filter(i => selected.has(i.id)) : []
  const pool = preferred.length > 0 ? preferred : images
  const out: VisionImage[] = []
  for (const item of pool) {
    const url = imageItemUrl(item)
    if (!isVisionUsable(url)) continue
    out.push({ id: item.id, url, description: item.description || 'image on board' })
    if (out.length >= limit) break
  }
  return out
}

export function buildImageContentParts(images: VisionImage[]): ImagePart[] {
  return images.map(img => ({
    type: 'image_url' as const,
    image_url: { url: img.url, detail: 'auto' as const },
  }))
}

export function describeVisionImages(images: VisionImage[]): string {
  return images.map((img, i) => `Image ${i + 1} [${img.id}]: ${img.description}`).join('\n')
}
