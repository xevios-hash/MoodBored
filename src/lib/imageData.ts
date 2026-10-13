const MAX_INLINE_BYTES = 4_500_000
const MAX_DIM = 1600

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Failed to read blob'))
    reader.readAsDataURL(blob)
  })
}

export async function imageToDataUrl(blob: Blob): Promise<string> {
  const direct = await blobToDataUrl(blob)
  if (blob.size <= MAX_INLINE_BYTES && direct.length <= MAX_INLINE_BYTES * 1.4) return direct
  try {
    const bitmap = await createImageBitmap(blob)
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return direct
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const down = canvas.toDataURL('image/jpeg', 0.85)
    return down.length < direct.length ? down : direct
  } catch {
    return direct
  }
}
