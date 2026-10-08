// Inference Orchestrator
// MoodBored orchestrates external runtimes rather than embedding inference engines

import type { ScannedModel } from './modelScanner'

export interface InferenceRequest {
  id: string
  type: 'text' | 'image' | 'video' | 'audio'
  model: string
  input: Record<string, any>
  options?: {
    stream?: boolean
    timeout?: number
    priority?: 'low' | 'normal' | 'high'
  }
}

export interface InferenceResponse {
  id: string
  success: boolean
  output: any
  metrics?: {
    duration: number // ms
    tokensPerSecond?: number
    vramUsed?: number // MB
  }
  error?: string
}

export interface RuntimeConfig {
  id: string
  name: string
  type: 'llm' | 'image' | 'video' | 'audio'
  endpoint: string
  healthCheck: string
  modelsEndpoint: string
  generateEndpoint: string
  headers?: Record<string, string>
}

// Runtime configurations
const RUNTIME_CONFIGS: Record<string, RuntimeConfig> = {
  'llama-cpp': {
    id: 'llama-cpp',
    name: 'llama.cpp',
    type: 'llm',
    endpoint: 'http://localhost:8080',
    healthCheck: '/health',
    modelsEndpoint: '/v1/models',
    generateEndpoint: '/completion',
  },
  'ollama': {
    id: 'ollama',
    name: 'Ollama',
    type: 'llm',
    endpoint: 'http://localhost:11434',
    healthCheck: '/api/tags',
    modelsEndpoint: '/api/tags',
    generateEndpoint: '/api/generate',
  },
  'lmstudio': {
    id: 'lmstudio',
    name: 'LM Studio',
    type: 'llm',
    endpoint: 'http://localhost:1234',
    healthCheck: '/v1/models',
    modelsEndpoint: '/v1/models',
    generateEndpoint: '/v1/chat/completions',
  },
  'comfyui': {
    id: 'comfyui',
    name: 'ComfyUI',
    type: 'image',
    endpoint: 'http://localhost:8188',
    healthCheck: '/system_stats',
    modelsEndpoint: '/object_info/CheckpointLoaderSimple',
    generateEndpoint: '/prompt',
  },
  'automatic1111': {
    id: 'automatic1111',
    name: 'Automatic1111',
    type: 'image',
    endpoint: 'http://localhost:7860',
    healthCheck: '/sdapi/v1/sd-models',
    modelsEndpoint: '/sdapi/v1/sd-models',
    generateEndpoint: '/sdapi/v1/txt2img',
  },
  'invokeai': {
    id: 'invokeai',
    name: 'Invoke AI',
    type: 'image',
    endpoint: 'http://localhost:9090',
    healthCheck: '/api/v1/app/version',
    modelsEndpoint: '/api/v1/models/',
    generateEndpoint: '/api/v1/sessions/',
  },
}

export class InferenceOrchestrator {
  private runtimes: Map<string, RuntimeConfig> = new Map()
  private activeRuntimes: Map<string, boolean> = new Map()

  constructor() {
    // Register default runtimes
    for (const [id, config] of Object.entries(RUNTIME_CONFIGS)) {
      this.runtimes.set(id, config)
    }
  }

  // Register a custom runtime
  registerRuntime(config: RuntimeConfig): void {
    this.runtimes.set(config.id, config)
  }

  // Check if a runtime is available
  async checkRuntime(runtimeId: string): Promise<boolean> {
    const config = this.runtimes.get(runtimeId)
    if (!config) return false

    try {
      const response = await fetch(`${config.endpoint}${config.healthCheck}`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      })
      const available = response.ok
      this.activeRuntimes.set(runtimeId, available)
      return available
    } catch {
      this.activeRuntimes.set(runtimeId, false)
      return false
    }
  }

  // List available models from a runtime
  async listModels(runtimeId: string): Promise<any[]> {
    const config = this.runtimes.get(runtimeId)
    if (!config) return []

    try {
      const response = await fetch(`${config.endpoint}${config.modelsEndpoint}`)
      if (!response.ok) return []

      const data = await response.json()

      // Parse models based on runtime
      switch (runtimeId) {
        case 'llama-cpp':
          return (data.data || []).map((m: any) => ({ id: m.id, name: m.id }))
        case 'ollama':
          return (data.models || []).map((m: any) => ({ id: m.name, name: m.name, size: m.size }))
        case 'lmstudio':
          return (data.data || []).map((m: any) => ({ id: m.id, name: m.id }))
        case 'comfyui':
          // ComfyUI returns complex object info
          const checkpoints = data.CheckpointLoaderSimple?.input?.required?.ckpt_name
          return checkpoints ? checkpoints[0].map((name: string) => ({ id: name, name })) : []
        case 'automatic1111':
          return (data || []).map((m: any) => ({ id: m.title, name: m.model_name }))
        case 'invokeai':
          return (data || []).map((m: any) => ({ id: m.id, name: m.name, type: m.type }))
        default:
          return []
      }
    } catch {
      return []
    }
  }

  // Run inference
  async infer(request: InferenceRequest): Promise<InferenceResponse> {
    const startTime = Date.now()

    // Find appropriate runtime
    const runtime = this.findRuntimeForRequest(request)
    if (!runtime) {
      return {
        id: request.id,
        success: false,
        output: null,
        error: `No runtime available for ${request.type} inference`,
      }
    }

    try {
      const result = await this.executeOnRuntime(runtime, request)
      return {
        id: request.id,
        success: true,
        output: result,
        metrics: {
          duration: Date.now() - startTime,
        },
      }
    } catch (err) {
      return {
        id: request.id,
        success: false,
        output: null,
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  }

  private findRuntimeForRequest(request: InferenceRequest): RuntimeConfig | null {
    // For LLM requests, prefer llama.cpp > ollama > lmstudio
    if (request.type === 'text') {
      const preferred = ['llama-cpp', 'ollama', 'lmstudio']
      for (const id of preferred) {
        const config = this.runtimes.get(id)
        if (config && this.activeRuntimes.get(id)) {
          return config
        }
      }
    }

    // For image requests, prefer comfyui > automatic1111 > invokeai
    if (request.type === 'image') {
      const preferred = ['comfyui', 'automatic1111', 'invokeai']
      for (const id of preferred) {
        const config = this.runtimes.get(id)
        if (config && this.activeRuntimes.get(id)) {
          return config
        }
      }
    }

    return null
  }

  private async executeOnRuntime(runtime: RuntimeConfig, request: InferenceRequest): Promise<any> {
    switch (runtime.id) {
      case 'llama-cpp':
        return this.executeLlamaCpp(runtime, request)
      case 'ollama':
        return this.executeOllama(runtime, request)
      case 'lmstudio':
        return this.executeLMStudio(runtime, request)
      case 'comfyui':
        return this.executeComfyUI(runtime, request)
      case 'automatic1111':
        return this.executeAutomatic1111(runtime, request)
      case 'invokeai':
        return this.executeInvokeAI(runtime, request)
      default:
        throw new Error(`Unknown runtime: ${runtime.id}`)
    }
  }

  private async executeLlamaCpp(runtime: RuntimeConfig, request: InferenceRequest): Promise<any> {
    const response = await fetch(`${runtime.endpoint}/completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: request.input.prompt,
        n_predict: request.input.max_tokens || 512,
        temperature: request.input.temperature || 0.7,
        stream: false,
      }),
    })

    if (!response.ok) throw new Error(`llama.cpp error: ${response.status}`)
    const data = await response.json()
    return { text: data.content }
  }

  private async executeOllama(runtime: RuntimeConfig, request: InferenceRequest): Promise<any> {
    const response = await fetch(`${runtime.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        prompt: request.input.prompt,
        stream: false,
        options: {
          temperature: request.input.temperature || 0.7,
          num_predict: request.input.max_tokens || 512,
        },
      }),
    })

    if (!response.ok) throw new Error(`Ollama error: ${response.status}`)
    const data = await response.json()
    return { text: data.response }
  }

  private async executeLMStudio(runtime: RuntimeConfig, request: InferenceRequest): Promise<any> {
    const response = await fetch(`${runtime.endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        messages: request.input.messages || [{ role: 'user', content: request.input.prompt }],
        temperature: request.input.temperature || 0.7,
        max_tokens: request.input.max_tokens || 512,
      }),
    })

    if (!response.ok) throw new Error(`LM Studio error: ${response.status}`)
    const data = await response.json()
    return { text: data.choices[0]?.message?.content || '' }
  }

  private async executeComfyUI(runtime: RuntimeConfig, request: InferenceRequest): Promise<any> {
    // ComfyUI uses a workflow-based API
    const workflow = {
      '3': {
        class_type: 'KSampler',
        inputs: {
          seed: Math.floor(Math.random() * 2 ** 32),
          steps: request.input.steps || 20,
          cfg: request.input.cfg_scale || 7,
          sampler_name: 'euler',
          scheduler: 'normal',
          denoise: 1,
          model: ['4', 0],
          positive: ['6', 0],
          negative: ['7', 0],
          latent_image: ['5', 0],
        },
      },
      '4': {
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: request.model },
      },
      '5': {
        class_type: 'EmptyLatentImage',
        inputs: {
          width: request.input.width || 512,
          height: request.input.height || 512,
          batch_size: 1,
        },
      },
      '6': {
        class_type: 'CLIPTextEncode',
        inputs: { text: request.input.prompt, clip: ['4', 1] },
      },
      '7': {
        class_type: 'CLIPTextEncode',
        inputs: { text: request.input.negative_prompt || '', clip: ['4', 1] },
      },
      '8': {
        class_type: 'VAEDecode',
        inputs: { samples: ['3', 0], vae: ['4', 2] },
      },
      '9': {
        class_type: 'SaveImage',
        inputs: { filename_prefix: 'moodbored', images: ['8', 0] },
      },
    }

    // Queue the workflow
    const queueResponse = await fetch(`${runtime.endpoint}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
    })

    if (!queueResponse.ok) throw new Error(`ComfyUI error: ${queueResponse.status}`)
    const { prompt_id } = await queueResponse.json()

    // Poll for completion
    let attempts = 0
    while (attempts < 60) {
      await new Promise(resolve => setTimeout(resolve, 1000))

      const historyResponse = await fetch(`${runtime.endpoint}/history/${prompt_id}`)
      const history = await historyResponse.json()

      if (history[prompt_id]) {
        const outputs = history[prompt_id].outputs
        for (const nodeId of Object.keys(outputs)) {
          if (outputs[nodeId].images) {
            const image = outputs[nodeId].images[0]
            return {
              imageUrl: `${runtime.endpoint}/view?filename=${image.filename}&subfolder=${image.subfolder || ''}&type=output`,
            }
          }
        }
      }
      attempts++
    }

    throw new Error('ComfyUI timeout')
  }

  private async executeAutomatic1111(runtime: RuntimeConfig, request: InferenceRequest): Promise<any> {
    const response = await fetch(`${runtime.endpoint}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: request.input.prompt,
        negative_prompt: request.input.negative_prompt || '',
        width: request.input.width || 512,
        height: request.input.height || 512,
        steps: request.input.steps || 20,
        cfg_scale: request.input.cfg_scale || 7,
      }),
    })

    if (!response.ok) throw new Error(`Automatic1111 error: ${response.status}`)
    const data = await response.json()
    return { imageUrl: `data:image/png;base64,${data.images[0]}` }
  }

  private async executeInvokeAI(runtime: RuntimeConfig, request: InferenceRequest): Promise<any> {
    // Invoke AI uses sessions
    const sessionResponse = await fetch(`${runtime.endpoint}/api/v1/sessions/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graph: {
          nodes: {
            positive: { type: 'positive_conditioning', prompt: request.input.prompt },
            negative: { type: 'negative_conditioning', prompt: request.input.negative_prompt || '' },
          },
        },
      }),
    })

    if (!sessionResponse.ok) throw new Error(`Invoke AI error: ${sessionResponse.status}`)
    const session = await sessionResponse.json()

    // Queue the session
    await fetch(`${runtime.endpoint}/api/v1/queue/default/enqueue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.id }),
    })

    // Poll for completion
    let attempts = 0
    while (attempts < 60) {
      await new Promise(resolve => setTimeout(resolve, 1000))

      const imagesResponse = await fetch(`${runtime.endpoint}/api/v1/images/?limit=1`)
      const images = await imagesResponse.json()

      if (images.items && images.items.length > 0) {
        return {
          imageUrl: `${runtime.endpoint}/api/v1/images/${images.items[0].image_name}/full`,
        }
      }
      attempts++
    }

    throw new Error('Invoke AI timeout')
  }
}

// Singleton instance
export const orchestrator = new InferenceOrchestrator()

// Helper function for quick inference
export async function runInference(
  type: 'text' | 'image',
  model: string,
  input: Record<string, any>
): Promise<InferenceResponse> {
  return orchestrator.infer({
    id: crypto.randomUUID(),
    type,
    model,
    input,
  })
}