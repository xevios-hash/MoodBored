// Content-shape transforms for the /api/ai/chat proxy.
// Normalized inbound format is OpenAI-style chat messages:
//   { role, content: string | [{type:'text',text} | {type:'image_url',image_url:{url}}] }
// where image_url.url is either an http(s) URL or a data: URL.

export function toText(content) {
  if (content == null) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter(p => p && p.type === 'text')
      .map(p => p.text || '')
      .join('\n')
  }
  return String(content)
}

export function parseDataUrl(url) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(url || '')
  if (!m) return null
  return {
    mimeType: m[1] || 'image/png',
    base64: m[2] ? m[3] : Buffer.from(m[3], 'utf-8').toString('base64'),
  }
}

export function imagePartsOf(content) {
  if (!Array.isArray(content)) return []
  return content.filter(p => p && p.type === 'image_url' && p.image_url?.url)
}

function anthropicImageBlock(url) {
  const data = parseDataUrl(url)
  if (data) {
    return { type: 'image', source: { type: 'base64', media_type: data.mimeType, data: data.base64 } }
  }
  return { type: 'image', source: { type: 'url', url } }
}

export function toAnthropicContent(content) {
  if (typeof content === 'string' || content == null) return content ?? ''
  if (!Array.isArray(content)) return toText(content)
  const blocks = []
  for (const part of content) {
    if (!part) continue
    if (part.type === 'text') {
      if (part.text) blocks.push({ type: 'text', text: part.text })
    } else if (part.type === 'image_url' && part.image_url?.url) {
      const block = anthropicImageBlock(part.image_url.url)
      if (block.source.type === 'base64' && block.source.data.length > 5_000_000) continue
      blocks.push(block)
    }
  }
  return blocks.length > 0 ? blocks : ''
}

export function toAnthropicMessages(messages = []) {
  const system = messages.find(m => m.role === 'system')?.content || ''
  const userMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: toAnthropicContent(m.content) }))
  return {
    messages: userMessages,
    system: toText(system),
  }
}

export function toGeminiParts(content) {
  const parts = []
  const text = toText(content)
  if (text) parts.push({ text })
  for (const part of imagePartsOf(content)) {
    const url = part.image_url.url
    const data = parseDataUrl(url)
    if (data) {
      parts.push({ inline_data: { mime_type: data.mimeType, data: data.base64 } })
    } else {
      parts.push({ file_data: { file_uri: url } })
    }
  }
  return parts
}

export function toGeminiContents(messages = []) {
  return messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: toGeminiParts(m.content),
    }))
}

export function toCohereMessage(content) {
  return toText(content)
}
