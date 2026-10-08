// AI Service Direct Integration
// Send prompts directly to Invoke AI, ComfyUI, Automatic1111, and other SD frontends

import type { BoardItem, Project } from '@/types'

// ─── Service Types ──────────────────────────────────────────────────

export type AIServiceType =
  | 'invokeai'       // Invoke AI (local)
  | 'comfyui'        // ComfyUI (local)
  | 'automatic1111'  // Automatic1111 / WebUI
  | 'flux'           // Flux directly
  | 'replicate'      // Replicate API
  | 'fal'            // fal.ai API
  | 'stability'      // Stability AI API

export interface AIServiceConfig {
  type: AIServiceType
  url: string
  apiKey?: string
  model?: string
}

export interface GenerationRequest {
  prompt: string
  negativePrompt?: string
  width?: number
  height?: number
  steps?: number
  cfgScale?: number
  seed?: number
  sampler?: string
  scheduler?: string
  batchSize?: number
  style?: string
}

export interface GenerationResponse {
  success: boolean
  images: string[]  // URLs or base64
  seed?: number
  error?: string
  jobId?: string
}

// ─── Invoke AI Integration ──────────────────────────────────────────

async function invokeAIGenerate(
  config: AIServiceConfig,
  request: GenerationRequest
): Promise<GenerationResponse> {
  try {
    // Invoke AI uses a workflow-based API
    // First, create a session
    const sessionRes = await fetch(`${config.url}/api/v1/sessions/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graph: {
          nodes: {
            main_model_loader: {
              type: 'main_model_loader',
              model: config.model || {
                model_name: 'stabilityai/stable-diffusion-xl-base-1.0',
                base_model: 'sdxl',
              },
            },
            positive_conditioning: {
              type: 'positive_conditioning',
              prompt: request.prompt,
            },
            negative_conditioning: {
              type: 'negative_conditioning',
              prompt: request.negativePrompt || 'low quality, blurry',
            },
            noise: {
              type: 'noise',
              seed: request.seed || Math.floor(Math.random() * 2 ** 32),
              width: request.width || 1024,
              height: request.height || 1024,
            },
            sampler: {
              type: 'sampler',
              steps: request.steps || 20,
              cfg_scale: request.cfgScale || 7.5,
              scheduler: request.scheduler || 'euler',
              denoising_start: 0,
              denoising_end: 1,
            },
            denoise_latents: {
              type: 'denoise_latents',
            },
            l2i: {
              type: 'l2i',
            },
            save_image: {
              type: 'save_image',
              is_intermediate: false,
            },
          },
          edges: [
            { source: { node_id: 'main_model_loader', field: 'model' }, destination: { node_id: 'denoise_latents', field: 'model' } },
            { source: { node_id: 'positive_conditioning', field: 'positive_conditioning' }, destination: { node_id: 'denoise_latents', field: 'positive_conditioning' } },
            { source: { node_id: 'negative_conditioning', field: 'negative_conditioning' }, destination: { node_id: 'denoise_latents', field: 'negative_conditioning' } },
            { source: { node_id: 'noise', field: 'noise' }, destination: { node_id: 'denoise_latents', field: 'noise' } },
            { source: { node_id: 'sampler', field: 'sampler' }, destination: { node_id: 'denoise_latents', field: 'sampler' } },
            { source: { node_id: 'denoise_latents', field: 'latents' }, destination: { node_id: 'l2i', field: 'latents' } },
            { source: { node_id: 'l2i', field: 'image' }, destination: { node_id: 'save_image', field: 'image' } },
          ],
        },
      }),
    })

    if (!sessionRes.ok) {
      throw new Error(`Failed to create session: ${sessionRes.status}`)
    }

    const session = await sessionRes.json()
    const sessionId = session.id

    // Enqueue the session
    const enqueueRes = await fetch(`${config.url}/api/v1/queue/default/enqueue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    })

    if (!enqueueRes.ok) {
      throw new Error(`Failed to enqueue: ${enqueueRes.status}`)
    }

    // Poll for completion
    let attempts = 0
    const maxAttempts = 60

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000))

      const statusRes = await fetch(`${config.url}/api/v1/queue/default/status`)
      const status = await statusRes.json()

      if (status.queue.completed > 0) {
        // Get the generated image
        const imageRes = await fetch(`${config.url}/api/v1/images/?limit=1&offset=0`)
        const images = await imageRes.json()

        if (images.items && images.items.length > 0) {
          const imageUrl = `${config.url}/api/v1/images/${images.items[0].image_name}/full`
          return {
            success: true,
            images: [imageUrl],
            seed: request.seed,
          }
        }
      }

      attempts++
    }

    throw new Error('Generation timed out')
  } catch (err) {
    return {
      success: false,
      images: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

// ─── Automatic1111 / WebUI Integration ──────────────────────────────

async function automatic1111Generate(
  config: AIServiceConfig,
  request: GenerationRequest
): Promise<GenerationResponse> {
  try {
    const res = await fetch(`${config.url}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
      },
      body: JSON.stringify({
        prompt: request.prompt,
        negative_prompt: request.negativePrompt || 'low quality, blurry',
        width: request.width || 512,
        height: request.height || 512,
        steps: request.steps || 20,
        cfg_scale: request.cfgScale || 7,
        seed: request.seed || -1,
        sampler_name: request.sampler || 'Euler a',
        batch_size: request.batchSize || 1,
      }),
    })

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`)
    }

    const data = await res.json()
    const images = data.images || []

    return {
      success: true,
      images: images.map((img: string) => `data:image/png;base64,${img}`),
      seed: data.info ? JSON.parse(data.info).seed : request.seed,
    }
  } catch (err) {
    return {
      success: false,
      images: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

// ─── ComfyUI Integration ────────────────────────────────────────────

async function comfyUIGenerate(
  config: AIServiceConfig,
  request: GenerationRequest
): Promise<GenerationResponse> {
  try {
    // ComfyUI uses a workflow-based API similar to Invoke AI
    const workflow = {
      '3': {
        class_type: 'KSampler',
        inputs: {
          seed: request.seed || Math.floor(Math.random() * 2 ** 32),
          steps: request.steps || 20,
          cfg: request.cfgScale || 7,
          sampler_name: request.sampler || 'euler',
          scheduler: request.scheduler || 'normal',
          denoise: 1,
          model: ['4', 0],
          positive: ['6', 0],
          negative: ['7', 0],
          latent_image: ['5', 0],
        },
      },
      '4': {
        class_type: 'CheckpointLoaderSimple',
        inputs: {
          ckpt_name: config.model || 'v1-5-pruned-emaonly.safetensors',
        },
      },
      '5': {
        class_type: 'EmptyLatentImage',
        inputs: {
          width: request.width || 512,
          height: request.height || 512,
          batch_size: request.batchSize || 1,
        },
      },
      '6': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: request.prompt,
          clip: ['4', 1],
        },
      },
      '7': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: request.negativePrompt || 'low quality, blurry',
          clip: ['4', 1],
        },
      },
      '8': {
        class_type: 'VAEDecode',
        inputs: {
          samples: ['3', 0],
          vae: ['4', 2],
        },
      },
      '9': {
        class_type: 'SaveImage',
        inputs: {
          filename_prefix: 'moodbored',
          images: ['8', 0],
        },
      },
    }

    // Queue the prompt
    const clientId = crypto.randomUUID()
    const queueRes = await fetch(`${config.url}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: workflow,
        client_id: clientId,
      }),
    })

    if (!queueRes.ok) {
      throw new Error(`Failed to queue: ${queueRes.status}`)
    }

    const queueData = await queueRes.json()
    const promptId = queueData.prompt_id

    // Poll for completion
    let attempts = 0
    const maxAttempts = 60

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000))

      const historyRes = await fetch(`${config.url}/history/${promptId}`)
      const history = await historyRes.json()

      if (history[promptId]) {
        const outputs = history[promptId].outputs
        const images: string[] = []

        for (const nodeId of Object.keys(outputs)) {
          const output = outputs[nodeId]
          if (output.images) {
            for (const img of output.images) {
              const imageUrl = `${config.url}/view?filename=${img.filename}&subfolder=${img.subfolder || ''}&type=${img.type || 'output'}`
              images.push(imageUrl)
            }
          }
        }

        if (images.length > 0) {
          return {
            success: true,
            images,
            seed: request.seed,
          }
        }
      }

      attempts++
    }

    throw new Error('Generation timed out')
  } catch (err) {
    return {
      success: false,
      images: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

// ─── Stability AI Integration ───────────────────────────────────────

async function stabilityAIGenerate(
  config: AIServiceConfig,
  request: GenerationRequest
): Promise<GenerationResponse> {
  try {
    const res = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        text_prompts: [
          { text: request.prompt, weight: 1 },
          ...(request.negativePrompt ? [{ text: request.negativePrompt, weight: -1 }] : []),
        ],
        cfg_scale: request.cfgScale || 7,
        width: request.width || 1024,
        height: request.height || 1024,
        steps: request.steps || 30,
        samples: request.batchSize || 1,
        seed: request.seed || 0,
      }),
    })

    if (!res.ok) {
      throw new Error(`Stability API error: ${res.status}`)
    }

    const data = await res.json()
    const images = (data.artifacts || []).map(
      (a: any) => `data:image/png;base64,${a.base64}`
    )

    return {
      success: true,
      images,
      seed: data.artifacts?.[0]?.seed,
    }
  } catch (err) {
    return {
      success: false,
      images: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

// ─── Replicate Integration ──────────────────────────────────────────

async function replicateGenerate(
  config: AIServiceConfig,
  request: GenerationRequest
): Promise<GenerationResponse> {
  try {
    const model = config.model || 'stability-ai/sdxl:latest'

    const res = await fetch(`https://api.replicate.com/v1/predictions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${config.apiKey}`,
      },
      body: JSON.stringify({
        version: model.split(':')[0],
        input: {
          prompt: request.prompt,
          negative_prompt: request.negativePrompt || 'low quality, blurry',
          width: request.width || 1024,
          height: request.height || 1024,
          num_inference_steps: request.steps || 30,
          guidance_scale: request.cfgScale || 7,
          seed: request.seed,
        },
      }),
    })

    if (!res.ok) {
      throw new Error(`Replicate API error: ${res.status}`)
    }

    const prediction = await res.json()

    // Poll for completion
    let attempts = 0
    const maxAttempts = 60

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000))

      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { 'Authorization': `Token ${config.apiKey}` },
      })

      const status = await pollRes.json()

      if (status.status === 'succeeded') {
        return {
          success: true,
          images: Array.isArray(status.output) ? status.output : [status.output],
          seed: request.seed,
        }
      }

      if (status.status === 'failed') {
        throw new Error(status.error || 'Generation failed')
      }

      attempts++
    }

    throw new Error('Generation timed out')
  } catch (err) {
    return {
      success: false,
      images: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

// ─── fal.ai Integration ─────────────────────────────────────────────

async function falGenerate(
  config: AIServiceConfig,
  request: GenerationRequest
): Promise<GenerationResponse> {
  try {
    const model = config.model || 'fal-ai/flux/schnell'

    const res = await fetch(`https://fal.run/${model}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${config.apiKey}`,
      },
      body: JSON.stringify({
        prompt: request.prompt,
        image_size: {
          width: request.width || 1024,
          height: request.height || 1024,
        },
        num_inference_steps: request.steps || 4,
        guidance_scale: request.cfgScale || 3.5,
        num_images: request.batchSize || 1,
        seed: request.seed,
      }),
    })

    if (!res.ok) {
      throw new Error(`fal.ai API error: ${res.status}`)
    }

    const data = await res.json()
    const images = (data.images || []).map((img: any) => img.url)

    return {
      success: true,
      images,
      seed: data.seed,
    }
  } catch (err) {
    return {
      success: false,
      images: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

// ─── Main Service Router ────────────────────────────────────────────

export async function generateImage(
  config: AIServiceConfig,
  request: GenerationRequest
): Promise<GenerationResponse> {
  switch (config.type) {
    case 'invokeai':
      return invokeAIGenerate(config, request)
    case 'automatic1111':
      return automatic1111Generate(config, request)
    case 'comfyui':
      return comfyUIGenerate(config, request)
    case 'stability':
      return stabilityAIGenerate(config, request)
    case 'replicate':
      return replicateGenerate(config, request)
    case 'fal':
      return falGenerate(config, request)
    default:
      return {
        success: false,
        images: [],
        error: `Unsupported service type: ${config.type}`,
      }
  }
}

// ─── Board to Prompt Conversion ─────────────────────────────────────

export function boardToPrompt(items: BoardItem[]): {
  prompt: string
  negativePrompt: string
  colors: string[]
  style: string
} {
  const notes: string[] = []
  const colors: string[] = []
  const tags: string[] = []

  for (const item of items) {
    switch (item.kind) {
      case 'note':
      case 'text':
        const text = (item as any).text || (item as any).raw || ''
        if (text.trim()) notes.push(text)
        break
      case 'palette':
        for (const c of item.colors || []) {
          colors.push(c.hex)
        }
        break
      case 'swatch':
        colors.push(item.hex)
        break
    }

    if ('tags' in item && item.tags) {
      tags.push(...(Array.isArray(item.tags) ? item.tags : [item.tags]))
    }
  }

  // Build prompt from notes
  const prompt = notes
    .join(', ')
    .replace(/\n/g, ', ')
    .slice(0, 500)

  // Add color mood
  const colorMood = colors.length > 0
    ? `, ${colors.slice(0, 4).join(' and ')} color palette`
    : ''

  // Add unique tags as style keywords
  const uniqueTags = [...new Set(tags)].slice(0, 5)
  const styleKeywords = uniqueTags.length > 0
    ? `, ${uniqueTags.join(', ')}`
    : ''

  return {
    prompt: `${prompt}${colorMood}${styleKeywords}`,
    negativePrompt: 'low quality, blurry, distorted, deformed, ugly, bad anatomy',
    colors,
    style: styleKeywords,
  }
}

// ─── Service Presets ────────────────────────────────────────────────

export const SERVICE_PRESETS: Record<AIServiceType, {
  name: string
  defaultUrl: string
  description: string
  requiresApiKey: boolean
}> = {
  invokeai: {
    name: 'Invoke AI',
    defaultUrl: 'http://localhost:9090',
    description: 'Local Stable Diffusion with professional UI',
    requiresApiKey: false,
  },
  comfyui: {
    name: 'ComfyUI',
    defaultUrl: 'http://localhost:8188',
    description: 'Node-based workflow for SD',
    requiresApiKey: false,
  },
  automatic1111: {
    name: 'Automatic1111',
    defaultUrl: 'http://localhost:7860',
    description: 'Popular SD WebUI',
    requiresApiKey: false,
  },
  stability: {
    name: 'Stability AI',
    defaultUrl: 'https://api.stability.ai',
    description: 'Cloud API for SDXL, SD3',
    requiresApiKey: true,
  },
  replicate: {
    name: 'Replicate',
    defaultUrl: 'https://api.replicate.com',
    description: 'Cloud hosting for AI models',
    requiresApiKey: true,
  },
  fal: {
    name: 'fal.ai',
    defaultUrl: 'https://fal.run',
    description: 'Fast AI model hosting',
    requiresApiKey: true,
  },
  flux: {
    name: 'Flux',
    defaultUrl: 'http://localhost:8080',
    description: 'Flux model inference',
    requiresApiKey: false,
  },
}
