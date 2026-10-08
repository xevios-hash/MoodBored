// Chunking and Reassembly Mechanism
// Handles content that arrives in segments from agents
// Generic: works for any content type, not just files

export interface ChunkMetadata {
  chunkId: string
  streamId: string       // Groups chunks from same operation
  sequence: number       // 0-based order
  totalChunks: number    // -1 if unknown (streaming)
  totalBytes: number     // -1 if unknown
  contentType: string    // MIME type or semantic type
  source: string         // agent ID or origin
  created: string
}

export interface Chunk {
  metadata: ChunkMetadata
  data: string           // Base64 for binary, raw for text
  isFinal: boolean
}

export interface AssembledContent {
  streamId: string
  contentType: string
  data: string
  chunks: number
  totalBytes: number
  startedAt: string
  completedAt: string | null
  status: 'assembling' | 'complete' | 'failed' | 'expired'
}

// In-memory chunk store with automatic expiration
class ChunkStore {
  private streams: Map<string, {
    chunks: Map<number, string>
    metadata: Partial<ChunkMetadata>
    startedAt: string
    lastActivity: string
  }> = new Map()

  private readonly maxAge: number // ms
  private readonly maxStreams: number

  constructor(maxAge = 5 * 60 * 1000, maxStreams = 100) {
    this.maxAge = maxAge
    this.maxStreams = maxStreams
    this.startCleanup()
  }

  // Add a chunk to a stream
  addChunk(chunk: Chunk): AssembledContent | null {
    const { streamId, sequence } = chunk.metadata
    const { data, isFinal } = chunk
    const now = new Date().toISOString()

    let stream = this.streams.get(streamId)
    if (!stream) {
      stream = {
        chunks: new Map(),
        metadata: { ...chunk.metadata },
        startedAt: now,
        lastActivity: now,
      }
      this.streams.set(streamId, stream)

      // Evict oldest if over limit
      if (this.streams.size > this.maxStreams) {
        const oldest = this.streams.keys().next().value
        if (oldest) this.streams.delete(oldest)
      }
    }

    stream.chunks.set(sequence, data)
    stream.lastActivity = now
    stream.metadata.totalChunks = chunk.metadata.totalChunks
    stream.metadata.totalBytes = chunk.metadata.totalBytes

    // Check if complete
    if (isFinal || (stream.metadata.totalChunks > 0 && stream.chunks.size >= stream.metadata.totalChunks)) {
      return this.assemble(streamId)
    }

    return this.getStatus(streamId)
  }

  // Get status of a stream
  getStatus(streamId: string): AssembledContent | null {
    const stream = this.streams.get(streamId)
    if (!stream) return null

    return {
      streamId,
      contentType: stream.metadata.contentType || 'unknown',
      data: '', // Not assembled yet
      chunks: stream.chunks.size,
      totalBytes: stream.metadata.totalBytes || -1,
      startedAt: stream.startedAt,
      completedAt: null,
      status: 'assembling',
    }
  }

  // Assemble all chunks into final content
  assemble(streamId: string): AssembledContent | null {
    const stream = this.streams.get(streamId)
    if (!stream) return null

    // Sort chunks by sequence and concatenate
    const sortedChunks = [...stream.chunks.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, data]) => data)

    const assembled = sortedChunks.join('')
    const now = new Date().toISOString()

    // Clean up
    this.streams.delete(streamId)

    return {
      streamId,
      contentType: stream.metadata.contentType || 'unknown',
      data: assembled,
      chunks: sortedChunks.length,
      totalBytes: assembled.length,
      startedAt: stream.startedAt,
      completedAt: now,
      status: 'complete',
    }
  }

  // Check if a stream exists
  hasStream(streamId: string): boolean {
    return this.streams.has(streamId)
  }

  // Get all active streams
  getActiveStreams(): AssembledContent[] {
    const streams: AssembledContent[] = []
    for (const [streamId] of this.streams) {
      const status = this.getStatus(streamId)
      if (status) streams.push(status)
    }
    return streams
  }

  // Force expire a stream
  expire(streamId: string): boolean {
    return this.streams.delete(streamId)
  }

  // Cleanup expired streams
  private startCleanup() {
    setInterval(() => {
      const now = Date.now()
      for (const [id, stream] of this.streams) {
        const lastActivity = new Date(stream.lastActivity).getTime()
        if (now - lastActivity > this.maxAge) {
          this.streams.delete(id)
        }
      }
    }, 60000) // Check every minute
  }
}

// Singleton instance
export const chunkStore = new ChunkStore()

// Helper: Split content into chunks
export function splitIntoChunks(
  content: string,
  streamId: string,
  contentType: string,
  source: string,
  chunkSize: number = 64 * 1024 // 64KB default
): Chunk[] {
  const chunks: Chunk[] = []
  const totalChunks = Math.ceil(content.length / chunkSize)

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize, content.length)
    const data = content.slice(start, end)

    chunks.push({
      metadata: {
        chunkId: `${streamId}-${i}`,
        streamId,
        sequence: i,
        totalChunks,
        totalBytes: content.length,
        contentType,
        source,
        created: new Date().toISOString(),
      },
      data,
      isFinal: i === totalChunks - 1,
    })
  }

  return chunks
}

// Helper: Process incoming chunk and check if complete
export function processChunk(chunk: Chunk): AssembledContent | null {
  return chunkStore.addChunk(chunk)
}

// Helper: Get status of a stream
export function getStreamStatus(streamId: string): AssembledContent | null {
  return chunkStore.getStatus(streamId)
}