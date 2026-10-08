// Native Model Scanner
// Scans local filesystem for AI models and runtimes

export interface ScannedModel {
  id: string
  name: string
  path: string
  type: 'llm' | 'checkpoint' | 'lora' | 'vae' | 'controlnet' | 'embedding' | 'video' | 'unknown'
  format: 'gguf' | 'safetensors' | 'bin' | 'pt' | 'pth' | 'onnx' | 'other'
  size: number // bytes
  sizeFormatted: string
  vramEstimate: number // MB
  runtime: RuntimeType | null
  status: 'ready' | 'missing_runtime' | 'downloading' | 'error'
  metadata: {
    family?: string // e.g., "llama", "mistral", "sdxl"
    quantization?: string // e.g., "Q4_K_M", "fp16"
    parameters?: string // e.g., "7B", "13B"
    license?: string
  }
  lastModified: string
  addedAt: string
}

export interface RuntimeType {
  id: string
  name: string
  binary: string
  defaultPath: string
  detectedPath: string | null
  version: string | null
  status: 'installed' | 'not_found' | 'running'
}

export interface ScanConfig {
  folders: string[]
  autoDetect: boolean
  scanDepth: number // max directory depth
  minFileSize: number // bytes, ignore small files
}

export interface ScanResult {
  models: ScannedModel[]
  runtimes: RuntimeType[]
  scanTime: number // ms
  foldersScanned: number
  errors: string[]
}

// Known runtime configurations
const RUNTIME_CONFIGS: Record<string, Omit<RuntimeType, 'detectedPath' | 'version' | 'status'>> = {
  'llama-cpp': {
    id: 'llama-cpp',
    name: 'llama.cpp',
    binary: 'llama-server',
    defaultPath: 'C:\\llama.cpp',
  },
  'ollama': {
    id: 'ollama',
    name: 'Ollama',
    binary: 'ollama',
    defaultPath: '~/.ollama',
  },
  'lmstudio': {
    id: 'lmstudio',
    name: 'LM Studio',
    binary: 'LM Studio',
    defaultPath: '~/.lmstudio',
  },
  'comfyui': {
    id: 'comfyui',
    name: 'ComfyUI',
    binary: 'main.py',
    defaultPath: '~/ComfyUI',
  },
  'automatic1111': {
    id: 'automatic1111',
    name: 'Automatic1111',
    binary: 'webui.py',
    defaultPath: '~/stable-diffusion-webui',
  },
  'invokeai': {
    id: 'invokeai',
    name: 'Invoke AI',
    binary: 'invoke.py',
    defaultPath: '~/invokeai',
  },
}

// File patterns for model detection
const MODEL_PATTERNS = {
  llm: {
    extensions: ['.gguf', '.ggml', '.bin'],
    namePatterns: [
      /llama/i, /mistral/i, /phi/i, /gemma/i, /qwen/i, /falcon/i,
      /mpt/i, /starcoder/i, /codellama/i, /deepseek/i, /yi-chat/i,
      /vicuna/i, /alpaca/i, /wizard/i, /orca/i, /nous/i,
    ],
    quantizationPattern: /[QF]\d[_\w]*|fp16|fp32|bf16|int4|int8/,
    sizeRanges: {
      '1B': [0.5e9, 2e9],
      '3B': [1.5e9, 5e9],
      '7B': [3e9, 10e9],
      '13B': [7e9, 20e9],
      '30B': [15e9, 40e9],
      '65B': [35e9, 80e9],
      '70B': [35e9, 80e9],
    },
  },
  checkpoint: {
    extensions: ['.safetensors', '.ckpt', '.pt', '.pth', '.bin'],
    namePatterns: [
      /sd[_-]?v?[\d.]+/i, /sdxl/i, /stable.?diffusion/i,
      /dreamshaper/i, /deliberate/i, /realistic/i, /anime/i,
      /flux/i, /sd3/i, /cascade/i,
    ],
    sizeRanges: {
      'sd15': [1.5e9, 3e9],
      'sdxl': [5e9, 8e9],
      'flux': [10e9, 25e9],
      'sd3': [5e9, 10e9],
    },
  },
  lora: {
    extensions: ['.safetensors', '.pt'],
    namePatterns: [/lora/i, /lycoris/i, /loha/i, /lokr/i],
    sizeRanges: {
      'small': [1e6, 50e6],
      'medium': [50e6, 200e6],
      'large': [200e6, 1e9],
    },
  },
  vae: {
    extensions: ['.safetensors', '.pt', '.pth', '.bin'],
    namePatterns: [/vae/i, /autoencoder/i],
    sizeRanges: {
      'sd15': [200e6, 400e6],
      'sdxl': [200e6, 500e6],
    },
  },
  controlnet: {
    extensions: ['.safetensors', '.pth'],
    namePatterns: [/controlnet/i, /control[_-]?net/i, /canny/i, /depth/i, /pose/i],
    sizeRanges: {
      'sd15': [1e9, 3e9],
      'sdxl': [2e9, 5e9],
    },
  },
  embedding: {
    extensions: ['.safetensors', '.pt', '.pth', '.bin'],
    namePatterns: [/embed/i, /text.?encoder/i, /clip/i, /t5/i],
    sizeRanges: {
      'clip': [200e6, 1e9],
      't5': [1e9, 10e9],
    },
  },
  video: {
    extensions: ['.safetensors', '.pth', '.pt'],
    namePatterns: [/video/i, /animate/i, /svd/i, /stable.?video/i, /cogvideo/i],
    sizeRanges: {
      'svd': [5e9, 15e9],
      'animatediff': [1e9, 5e9],
    },
  },
}

// Common scan locations by platform
const COMMON_LOCATIONS: Record<string, string[]> = {
  win32: [
    'C:\\Users\\{user}\\AppData\\Local\\Ollama\\.ollama\\models',
    'C:\\Users\\{user}\\.lmstudio\\models',
    'C:\\Users\\{user}\\.cache\\huggingface\\hub',
    'C:\\Users\\{user}\\AppData\\Local\\Programs\\ComfyUI\\models',
    'C:\\Users\\{user}\\stable-diffusion-webui\\models',
    'C:\\Users\\{user}\\invokeai\\models',
    'C:\\AI\\models',
    'D:\\AI\\models',
    'C:\\llama.cpp\\models',
  ],
  darwin: [
    '~/.ollama/models',
    '~/.lmstudio/models',
    '~/.cache/huggingface/hub',
    '~/ComfyUI/models',
    '~/stable-diffusion-webui/models',
    '~/invokeai/models',
    '/opt/homebrew/share/ollama',
    '~/AI/models',
  ],
  linux: [
    '~/.ollama/models',
    '~/.lmstudio/models',
    '~/.cache/huggingface/hub',
    '~/ComfyUI/models',
    '~/stable-diffusion-webui/models',
    '~/invokeai/models',
    '/usr/share/ollama',
    '~/AI/models',
  ],
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function estimateVRAM(sizeBytes: number, format: string, type: string): number {
  // Rough VRAM estimates in MB
  if (format === 'gguf') {
    // GGUF files are already quantized, size is roughly VRAM needed
    return Math.ceil(sizeBytes / (1024 * 1024) * 1.1) // 10% overhead
  }
  if (format === 'safetensors') {
    if (type === 'checkpoint') {
      // SD checkpoints: ~size * 1.5 for inference
      return Math.ceil(sizeBytes / (1024 * 1024) * 1.5)
    }
    if (type === 'lora') {
      // LoRAs are loaded alongside checkpoint
      return Math.ceil(sizeBytes / (1024 * 1024))
    }
  }
  // Default: assume 1:1
  return Math.ceil(sizeBytes / (1024 * 1024))
}

function detectModelType(filename: string, sizeBytes: number): {
  type: ScannedModel['type']
  format: ScannedModel['format']
  metadata: ScannedModel['metadata']
} {
  const lower = filename.toLowerCase()
  const ext = lower.substring(lower.lastIndexOf('.'))

  // Detect format
  let format: ScannedModel['format'] = 'other'
  if (ext === '.gguf' || ext === '.ggml') format = 'gguf'
  else if (ext === '.safetensors') format = 'safetensors'
  else if (ext === '.bin' || ext === '.pt' || ext === '.pth') format = 'bin'
  else if (ext === '.onnx') format = 'onnx'

  // Detect type by filename patterns
  for (const [type, config] of Object.entries(MODEL_PATTERNS)) {
    if (!config.extensions.includes(ext)) continue

    for (const pattern of config.namePatterns) {
      if (pattern.test(lower)) {
        const metadata: ScannedModel['metadata'] = {}

        // Extract quantization
        const quantMatch = lower.match(/[QF]\d[_\w]*/i)
        if (quantMatch) metadata.quantization = quantMatch[0].toUpperCase()

        // Extract parameter count
        const paramMatch = lower.match(/(\d+\.?\d*)[bB]/)
        if (paramMatch) metadata.parameters = paramMatch[0].toUpperCase()

        // Extract family
        const familyPatterns: Record<string, RegExp> = {
          llama: /llama/i,
          mistral: /mistral/i,
          phi: /phi/i,
          gemma: /gemma/i,
          qwen: /qwen/i,
          sdxl: /sdxl/i,
          flux: /flux/i,
          sd: /sd[_-]?v?[\d.]+/i,
        }
        for (const [family, pattern] of Object.entries(familyPatterns)) {
          if (pattern.test(lower)) {
            metadata.family = family
            break
          }
        }

        return {
          type: type as ScannedModel['type'],
          format,
          metadata,
        }
      }
    }
  }

  // Fallback: detect by extension and size
  if (format === 'gguf') {
    return { type: 'llm', format, metadata: {} }
  }
  if (format === 'safetensors' && sizeBytes > 1e9) {
    return { type: 'checkpoint', format, metadata: {} }
  }

  return { type: 'unknown', format, metadata: {} }
}

export class ModelScanner {
  private config: ScanConfig

  constructor(config: Partial<ScanConfig> = {}) {
    this.config = {
      folders: config.folders || [],
      autoDetect: config.autoDetect !== false,
      scanDepth: config.scanDepth || 4,
      minFileSize: config.minFileSize || 10 * 1024 * 1024, // 10MB minimum
    }
  }

  async scan(): Promise<ScanResult> {
    const startTime = Date.now()
    const models: ScannedModel[] = []
    const runtimes: RuntimeType[] = []
    const errors: string[] = []
    let foldersScanned = 0

    // Detect runtimes
    for (const [id, config] of Object.entries(RUNTIME_CONFIGS)) {
      const runtime = await this.detectRuntime(config)
      runtimes.push(runtime)
    }

    // Get folders to scan
    const folders = this.getScanFolders()

    // Scan each folder
    for (const folder of folders) {
      try {
        const scanned = await this.scanFolder(folder, 0)
        models.push(...scanned)
        foldersScanned++
      } catch (err) {
        errors.push(`Failed to scan ${folder}: ${err}`)
      }
    }

    // Deduplicate by path
    const uniqueModels = this.deduplicateModels(models)

    // Match models to runtimes
    for (const model of uniqueModels) {
      model.runtime = this.findRuntimeForModel(model, runtimes)
      model.status = model.runtime ? 'ready' : 'missing_runtime'
    }

    return {
      models: uniqueModels,
      runtimes,
      scanTime: Date.now() - startTime,
      foldersScanned,
      errors,
    }
  }

  private getScanFolders(): string[] {
    const folders: string[] = [...this.config.folders]

    if (this.config.autoDetect) {
      const platform = process.platform as keyof typeof COMMON_LOCATIONS
      const common = COMMON_LOCATIONS[platform] || COMMON_LOCATIONS.linux

      // Replace {user} placeholder
      const homeDir = this.getHomeDir()
      for (const folder of common) {
        folders.push(folder.replace('{user}', homeDir))
      }
    }

    return [...new Set(folders)]
  }

  private getHomeDir(): string {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.USERPROFILE || process.env.HOME || ''
    }
    return ''
  }

  private async detectRuntime(config: Omit<RuntimeType, 'detectedPath' | 'version' | 'status'>): Promise<RuntimeType> {
    const runtime: RuntimeType = {
      ...config,
      detectedPath: null,
      version: null,
      status: 'not_found',
    }

    // Check common paths
    const paths = [
      config.defaultPath,
      `${this.getHomeDir()}\\${config.binary}`,
      `${this.getHomeDir()}/.local/bin/${config.binary}`,
    ]

    for (const path of paths) {
      try {
        // In a real implementation, check if file exists
        // For now, return not_found
      } catch {}
    }

    return runtime
  }

  private async scanFolder(folder: string, depth: number): Promise<ScannedModel[]> {
    if (depth > this.config.scanDepth) return []

    const models: ScannedModel[] = []

    // This would use fs.readdir in Node.js
    // For browser environment, we'll use the server API
    try {
      const response = await fetch('/api/scan/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder, depth, minSize: this.config.minFileSize }),
      })

      if (response.ok) {
        const data = await response.json()
        return data.models || []
      }
    } catch (err) {
      // Fallback: return empty
    }

    return models
  }

  private deduplicateModels(models: ScannedModel[]): ScannedModel[] {
    const seen = new Map<string, ScannedModel>()
    for (const model of models) {
      const key = model.path
      if (!seen.has(key)) {
        seen.set(key, model)
      }
    }
    return Array.from(seen.values())
  }

  private findRuntimeForModel(model: ScannedModel, runtimes: RuntimeType[]): RuntimeType | null {
    // LLM models need llama.cpp or ollama
    if (model.type === 'llm') {
      const llamaCpp = runtimes.find(r => r.id === 'llama-cpp' && r.status === 'installed')
      const ollama = runtimes.find(r => r.id === 'ollama' && r.status === 'installed')
      return llamaCpp || ollama || null
    }

    // SD models need ComfyUI or Automatic1111
    if (['checkpoint', 'lora', 'vae', 'controlnet'].includes(model.type)) {
      const comfyui = runtimes.find(r => r.id === 'comfyui' && r.status === 'installed')
      const a1111 = runtimes.find(r => r.id === 'automatic1111' && r.status === 'installed')
      return comfyui || a1111 || null
    }

    return null
  }
}

// Model catalog for downloading
export interface CatalogModel {
  id: string
  name: string
  type: ScannedModel['type']
  family: string
  parameters: string
  size: number
  sizeFormatted: string
  vramRequirement: number
  downloadUrl: string
  huggingfaceUrl: string
  license: string
  licenseUrl: string
  description: string
  tags: string[]
  quantizations: string[]
  previewImages?: string[]
}

// Popular models catalog (would be fetched from API in production)
export const MODEL_CATALOG: CatalogModel[] = [
  // LLM Models
  {
    id: 'llama-3.1-8b-instruct-q4',
    name: 'Llama 3.1 8B Instruct',
    type: 'llm',
    family: 'llama',
    parameters: '8B',
    size: 4.7e9,
    sizeFormatted: '4.7 GB',
    vramRequirement: 5000,
    downloadUrl: 'https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
    huggingfaceUrl: 'https://huggingface.co/meta-llama/Meta-Llama-3.1-8B-Instruct',
    license: 'Llama 3.1 Community License',
    licenseUrl: 'https://huggingface.co/meta-llama/Meta-Llama-3.1-8B-Instruct/license',
    description: 'Meta\'s latest 8B parameter model, optimized for chat and instruction following',
    tags: ['chat', 'instruct', 'general'],
    quantizations: ['Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0'],
  },
  {
    id: 'mistral-7b-instruct-q4',
    name: 'Mistral 7B Instruct v0.3',
    type: 'llm',
    family: 'mistral',
    parameters: '7B',
    size: 4.1e9,
    sizeFormatted: '4.1 GB',
    vramRequirement: 4500,
    downloadUrl: 'https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf',
    huggingfaceUrl: 'https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.3',
    license: 'Apache 2.0',
    licenseUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
    description: 'Fast, high-quality 7B model from Mistral AI',
    tags: ['chat', 'instruct', 'fast'],
    quantizations: ['Q4_K_M', 'Q5_K_M', 'Q6_K'],
  },
  {
    id: 'phi-3-mini-4k-q4',
    name: 'Phi-3 Mini 4K Instruct',
    type: 'llm',
    family: 'phi',
    parameters: '3.8B',
    size: 2.2e9,
    sizeFormatted: '2.2 GB',
    vramRequirement: 2500,
    downloadUrl: 'https://huggingface.co/bartowski/Phi-3.1-mini-4k-instruct-GGUF/resolve/main/Phi-3.1-mini-4k-instruct-Q4_K_M.gguf',
    huggingfaceUrl: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct',
    license: 'MIT',
    licenseUrl: 'https://opensource.org/licenses/MIT',
    description: 'Microsoft\'s small but powerful 3.8B model',
    tags: ['chat', 'instruct', 'small', 'fast'],
    quantizations: ['Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0'],
  },
  // SD Checkpoints
  {
    id: 'sdxl-base-1.0',
    name: 'Stable Diffusion XL Base 1.0',
    type: 'checkpoint',
    family: 'sdxl',
    parameters: '3.5B',
    size: 6.9e9,
    sizeFormatted: '6.9 GB',
    vramRequirement: 8000,
    downloadUrl: 'https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors',
    huggingfaceUrl: 'https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0',
    license: 'CreativeML Open RAIL++-M',
    licenseUrl: 'https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/blob/main/LICENSE',
    description: 'Stability AI\'s flagship SDXL model for high-quality image generation',
    tags: ['image', 'general', 'high-quality'],
    quantizations: ['fp16', 'fp32'],
  },
  {
    id: 'flux-1-dev',
    name: 'FLUX.1 Dev',
    type: 'checkpoint',
    family: 'flux',
    parameters: '12B',
    size: 23.8e9,
    sizeFormatted: '23.8 GB',
    vramRequirement: 24000,
    downloadUrl: 'https://huggingface.co/black-forest-labs/FLUX.1-dev/resolve/main/flux1-dev.safetensors',
    huggingfaceUrl: 'https://huggingface.co/black-forest-labs/FLUX.1-dev',
    license: 'FLUX.1 Non-Commercial License',
    licenseUrl: 'https://huggingface.co/black-forest-labs/FLUX.1-dev/blob/main/LICENSE.md',
    description: 'Black Forest Labs\' state-of-the-art image generation model',
    tags: ['image', 'state-of-the-art', 'high-vram'],
    quantizations: ['fp16', 'fp8'],
  },
]

// Server-side model scanning endpoint
export async function scanModelsOnServer(folder: string, depth: number, minSize: number): Promise<ScannedModel[]> {
  // This would call the server API
  try {
    const response = await fetch('/api/scan/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, depth, minSize }),
    })
    if (response.ok) {
      const data = await response.json()
      return data.models || []
    }
  } catch {}
  return []
}

// Client-side scan trigger
export async function startModelScan(config?: Partial<ScanConfig>): Promise<ScanResult> {
  const scanner = new ModelScanner(config)
  return scanner.scan()
}