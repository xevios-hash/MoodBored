import { useStore } from '@/stores/useStore'
import { X, Eye, EyeOff, Shield, RefreshCw, Check, AlertCircle, Loader2 } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { resetJevCounter, fetchAvailableProviders, getModelsForProvider, type AIProvider, type ProviderInfo } from '@/lib/api'
import { showToast } from '@/lib/toasts'

interface ModelState {
  loading: boolean
  models: { id: string; name: string; loaded?: boolean }[]
  connected: boolean
  error?: string
}

export function SettingsModal({ embed, onClose }: { embed?: boolean; onClose?: () => void }) {
  const settings = useStore((s) => s.project.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const toggleSettings = useStore((s) => s.toggleSettings)
  const [showApiKey, setShowApiKey] = useState(false)
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [modelState, setModelState] = useState<ModelState>({ loading: false, models: [], connected: false })
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle')

  const handleClose = onClose || toggleSettings

  useEffect(() => {
    fetchAvailableProviders().then(setProviders)
  }, [])

  // Fetch models from local provider
  const fetchModels = useCallback(async () => {
    const provider = settings.provider || 'openrouter'
    const isLocal = ['lmstudio', 'ollama', 'automatic1111', 'comfyui', 'invokeai'].includes(provider)

    if (!isLocal) {
      setModelState({ loading: false, models: [], connected: false })
      return
    }

    setModelState(prev => ({ ...prev, loading: true }))
    setConnectionStatus('checking')

    try {
      const urlParam = provider === 'lmstudio' ? settings.lmstudioUrl :
                       provider === 'ollama' ? settings.ollamaUrl :
                       provider === 'custom' ? settings.customAiUrl : ''

      const res = await fetch(`/api/ai/models/${provider}${urlParam ? `?url=${encodeURIComponent(urlParam)}` : ''}`)
      const data = await res.json()

      if (data.connected) {
        setModelState({ loading: false, models: data.models || [], connected: true })
        setConnectionStatus('connected')
        showToast(`Connected to ${provider} — ${data.models?.length || 0} models found`, 'success')
      } else {
        setModelState({ loading: false, models: [], connected: false, error: data.error })
        setConnectionStatus('error')
      }
    } catch (err) {
      setModelState({ loading: false, models: [], connected: false, error: 'Connection failed' })
      setConnectionStatus('error')
    }
  }, [settings.provider, settings.lmstudioUrl, settings.ollamaUrl, settings.customAiUrl])

  // Auto-fetch models when provider changes
  useEffect(() => {
    const provider = settings.provider || 'openrouter'
    const isLocal = ['lmstudio', 'ollama', 'automatic1111', 'comfyui', 'invokeai'].includes(provider)
    if (isLocal) {
      fetchModels()
    } else {
      setModelState({ loading: false, models: [], connected: false })
      setConnectionStatus('idle')
    }
  }, [settings.provider, settings.lmstudioUrl, settings.ollamaUrl])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-fadeIn"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="w-[min(480px,90vw)] glass-card rounded-xl shadow-panel overflow-hidden animate-scaleIn">
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">{embed ? 'Board Settings' : 'Settings'}</h2>
          <button
            onClick={handleClose}
            className="btn p-1 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded"
            aria-label="Close settings"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-5 max-h-[60vh] overflow-y-auto">
          {!embed && (<>
          <Section title="AI Provider">
            <div className="p-3 rounded-lg border border-accent/15 bg-accent/5">
              <p className="text-xs text-text-secondary mb-3">
                Select your AI provider and model. API keys are configured server-side and never exposed to the browser.
              </p>

              {/* Provider Selection */}
              <div className="mb-3">
                <label className="text-xs text-text-muted block mb-1">Provider</label>
                <div className="flex gap-2">
                  <select
                    value={settings.provider || 'openrouter'}
                    onChange={(e) => {
                      const provider = e.target.value as AIProvider
                      const models = getModelsForProvider(provider)
                      updateSettings({ provider, defaultModel: models[0] || '' })
                    }}
                    className="input flex-1"
                  >
                    <optgroup label="Cloud Providers">
                      <option value="openrouter">OpenRouter (100+ models)</option>
                      <option value="openai">OpenAI (GPT-4, GPT-4o)</option>
                      <option value="anthropic">Anthropic (Claude)</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="groq">Groq (Ultra-fast)</option>
                      <option value="together">Together AI</option>
                      <option value="mistral">Mistral AI</option>
                      <option value="cohere">Cohere</option>
                      <option value="perplexity">Perplexity</option>
                      <option value="fireworks">Fireworks AI</option>
                      <option value="deepseek">DeepSeek</option>
                    </optgroup>
                    <optgroup label="Local Providers">
                      <option value="ollama">Ollama (Local)</option>
                      <option value="lmstudio">LM Studio (Local)</option>
                      <option value="automatic1111">Automatic1111</option>
                      <option value="comfyui">ComfyUI</option>
                      <option value="invokeai">Invoke AI</option>
                      <option value="custom">Custom Endpoint</option>
                    </optgroup>
                  </select>

                  {/* Connection Status Indicator */}
                  <div className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs border ${
                    connectionStatus === 'connected' ? 'bg-green-500/10 border-green-500/30 text-green-500' :
                    connectionStatus === 'checking' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500' :
                    connectionStatus === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-500' :
                    'bg-surface-2 border-white/[0.06] text-text-muted'
                  }`}>
                    {connectionStatus === 'connected' && <Check size={12} />}
                    {connectionStatus === 'checking' && <Loader2 size={12} className="animate-spin" />}
                    {connectionStatus === 'error' && <AlertCircle size={12} />}
                    {connectionStatus === 'idle' && <div className="w-2 h-2 rounded-full bg-gray-400" />}
                    <span className="hidden sm:inline">
                      {connectionStatus === 'connected' ? 'Connected' :
                       connectionStatus === 'checking' ? 'Checking...' :
                       connectionStatus === 'error' ? 'Disconnected' : 'Not connected'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Model Selection */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-text-muted">Model</label>
                  {modelState.connected && (
                    <button
                      onClick={fetchModels}
                      className="text-2xs text-accent hover:underline flex items-center gap-1"
                    >
                      <RefreshCw size={10} /> Scan models
                    </button>
                  )}
                </div>
                <select
                  value={settings.defaultModel}
                  onChange={(e) => updateSettings({ defaultModel: e.target.value })}
                  className="input w-full"
                >
                  {/* Show fetched models if available, otherwise show presets */}
                  {modelState.models.length > 0 ? (
                    modelState.models.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name}{model.loaded ? ' (loaded)' : ''}
                      </option>
                    ))
                  ) : (
                    getModelsForProvider((settings.provider || 'openrouter') as AIProvider).map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))
                  )}
                </select>
                {modelState.loading && (
                  <p className="text-2xs text-text-muted mt-1 flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin" /> Scanning for models...
                  </p>
                )}
                {modelState.connected && modelState.models.length === 0 && !modelState.loading && (
                  <p className="text-2xs text-yellow-500 mt-1">No models found. Load a model in {settings.provider}.</p>
                )}
              </div>

              {/* API Key for Cloud Providers */}
              {['openrouter', 'openai', 'anthropic', 'gemini', 'groq', 'together', 'mistral', 'cohere', 'perplexity', 'fireworks', 'deepseek'].includes(settings.provider || 'openrouter') && (
                <div className="mb-3 p-3 rounded-lg border border-accent/15 bg-accent/5">
                  <label className="text-xs text-text-muted block mb-1">API Key</label>
                  <input
                    type="password"
                    value={settings.apiKey || ''}
                    onChange={(e) => updateSettings({ apiKey: e.target.value })}
                    placeholder={`Enter your ${settings.provider || 'OpenRouter'} API key`}
                    className="input w-full"
                  />
                  <p className="text-2xs text-text-muted mt-1">
                    {settings.provider === 'openrouter' && 'Get your key at openrouter.ai/keys'}
                    {settings.provider === 'openai' && 'Get your key at platform.openai.com/api-keys'}
                    {settings.provider === 'anthropic' && 'Get your key at console.anthropic.com'}
                    {settings.provider === 'gemini' && 'Get your key at aistudio.google.com/apikey'}
                    {settings.provider === 'groq' && 'Get your key at console.groq.com/keys'}
                    {settings.provider === 'together' && 'Get your key at api.together.xyz'}
                    {settings.provider === 'mistral' && 'Get your key at console.mistral.ai'}
                    {settings.provider === 'cohere' && 'Get your key at dashboard.cohere.com'}
                    {settings.provider === 'perplexity' && 'Get your key at perplexity.ai/settings/api'}
                    {settings.provider === 'fireworks' && 'Get your key at fireworks.ai/account/api-keys'}
                    {settings.provider === 'deepseek' && 'Get your key at platform.deepseek.com'}
                  </p>
                </div>
              )}

              {/* Local Provider Configuration */}
              {(settings.provider || 'openrouter') === 'ollama' && (
                <div className="mb-3 p-3 rounded-lg border border-accent/15 bg-accent/5">
                  <label className="text-xs text-text-muted block mb-1">Ollama URL</label>
                  <input
                    type="text"
                    value={settings.ollamaUrl || 'http://localhost:11434'}
                    onChange={(e) => updateSettings({ ollamaUrl: e.target.value })}
                    placeholder="http://localhost:11434"
                    className="input w-full"
                  />
                  <p className="text-2xs text-text-muted mt-1">Default: http://localhost:11434</p>
                </div>
              )}

              {(settings.provider || 'openrouter') === 'lmstudio' && (
                <div className="mb-3 p-3 rounded-lg border border-accent/15 bg-accent/5">
                  <label className="text-xs text-text-muted block mb-1">LM Studio URL</label>
                  <input
                    type="text"
                    value={settings.lmstudioUrl || 'http://localhost:1234'}
                    onChange={(e) => updateSettings({ lmstudioUrl: e.target.value })}
                    placeholder="http://localhost:1234"
                    className="input w-full"
                  />
                  <p className="text-2xs text-text-muted mt-1">Default: http://localhost:1234 (LM Studio local server)</p>
                </div>
              )}

              {(settings.provider || 'openrouter') === 'custom' && (
                <div className="mb-3 p-3 rounded-lg border border-accent/15 bg-accent/5 space-y-3">
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Custom Endpoint URL</label>
                    <input
                      type="text"
                      value={settings.customAiUrl || ''}
                      onChange={(e) => updateSettings({ customAiUrl: e.target.value })}
                      placeholder="http://localhost:8080/v1/chat/completions"
                      className="input w-full"
                    />
                    <p className="text-2xs text-text-muted mt-1">Any OpenAI-compatible endpoint (vLLM, text-generation-webui, etc.)</p>
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">API Key (optional)</label>
                    <input
                      type="password"
                      value={settings.customAiKey || ''}
                      onChange={(e) => updateSettings({ customAiKey: e.target.value })}
                      placeholder="Leave empty if no auth required"
                      className="input w-full"
                    />
                  </div>
                </div>
              )}

              {/* Available Providers Status */}
              <div className="mt-3">
                <label className="text-xs text-text-muted block mb-2">Provider Status</label>
                <div className="space-y-1">
                  {providers.filter(p => !p.local).map(p => (
                    <div key={p.name} className="flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full ${p.available ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <span className="text-text-secondary capitalize">{p.name}</span>
                      {!p.available && p.envKey && (
                        <span className="text-text-muted">({p.envKey})</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Local Providers Info */}
                <div className="mt-3 p-3 rounded-lg border border-accent/15 bg-accent/5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">💻</span>
                    <span className="text-xs font-medium text-text-primary">Local Providers</span>
                  </div>
                  <p className="text-2xs text-text-muted mb-2">
                    LM Studio, Ollama, and Custom endpoints require running MoodBored locally.
                  </p>
                  <div className="space-y-1">
                    {providers.filter(p => p.local).map(p => (
                      <div key={p.name} className="flex items-center gap-2 text-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                        <span className="text-text-secondary capitalize">{p.name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 p-2 rounded bg-surface-0 text-2xs font-mono text-text-muted">
                    npm run dev
                  </div>
                  <p className="text-2xs text-text-muted mt-1">
                    Or use the AI Bridge for web access
                  </p>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Agent — Jev Quality Gate">
            <div className="p-3 rounded-lg border border-accent/15 bg-accent/5">
              <div className="flex items-center gap-2 mb-2">
                <Shield size={16} className="text-[#6a5aae]" />
                <span className="text-sm font-medium text-text-primary">Jev Quality Control</span>
              </div>
              <p className="text-xs text-text-muted mb-3">
                Every batch of items proposed by the LLM is scored by Jev for theme coherence and aesthetic fit.
                Items below the threshold are rejected and the LLM is asked to refine.
              </p>
              <div>
                <label className="text-xs text-text-muted block mb-1">
                  Coherence Threshold: {(settings.jevThreshold * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.jevThreshold}
                  onChange={(e) => updateSettings({ jevThreshold: Number(e.target.value) })}
                  className="w-full accent-accent"
                  aria-label="Jev coherence threshold"
                />
                <div className="flex justify-between text-2xs text-text-muted mt-1">
                  <span>Creative (0%)</span>
                  <span>Balanced (50%)</span>
                  <span>Strict (100%)</span>
                </div>
              </div>
              <button
                onClick={() => { resetJevCounter(); showToast('Jev call counter reset.', 'info') }}
                className="btn btn-ghost text-xs mt-2 w-full"
              >
                Reset Call Counter (50 max per session)
              </button>
            </div>
          </Section>

          <Section title="Multi-Agent Mode">
            <div className="p-3 rounded-lg border border-accent/15 bg-accent/5">
              <p className="text-xs text-text-muted mb-2">
                Enable multiple specialized AI agents (Color Theorist, Typographer, Spatial Designer, etc.)
                working together on your board. Default is single-agent mode.
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.multiAgent || false}
                  onChange={(e) => updateSettings({ multiAgent: e.target.checked })}
                  className="accent-accent"
                />
                <span className="text-sm text-text-primary">Enable multi-agent mode</span>
              </label>
            </div>
          </Section>

          <Section title="MCP Server (connect to Claude Desktop, Cursor, etc.)">
            <div className="p-3 rounded-lg border border-accent/15 bg-accent/5">
              <p className="text-xs text-text-muted mb-2">
                MoodBored exposes an MCP server that lets other LLMs read and write to your board.
                Add the config below to Claude Desktop or any MCP client to connect.
              </p>
              <p className="text-2xs text-text-muted mb-1">Board state is stored in:</p>
              <code className="text-2xs bg-surface-0 rounded p-1 block mb-2 text-text-secondary break-all">~/.moodbored/boards/</code>
              <p className="text-2xs text-text-muted mb-1">MCP server location:</p>
              <code className="text-2xs bg-surface-0 rounded p-1 block mb-2 text-text-secondary break-all">mcp/mcp-server.ts (in your MoodBored project folder)</code>
              <button
                onClick={() => {
                  const config = JSON.stringify({
                    mcpServers: {
                      moodbored: {
                        command: 'npx',
                        args: ['tsx', '/path/to/MoodBored/mcp/mcp-server.ts'],
                      },
                    },
                  }, null, 2)
                  navigator.clipboard.writeText(config)
                  showToast('MCP config copied — update /path/to/MoodBored to your actual project path', 'info')
                }}
                className="btn btn-ghost text-xs mt-1 w-full"
              >
                Copy Claude Desktop Config
              </button>
              <p className="text-2xs text-text-muted mt-2">To use: update the path in the copied config to your actual MoodBored project folder, then paste into Claude Desktop settings.</p>
            </div>
          </Section>
          </>)}

          <Section title="Appearance">
            {/* Theme toggle */}
            <div>
              <label className="text-xs text-text-muted block mb-2">Theme</label>
              <div className="flex gap-2">
                <button
                  onClick={() => updateSettings({ theme: 'light' })}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-fast border ${
                    settings.theme === 'light'
                      ? 'bg-white border-accent text-[#6a5aae]'
                      : 'bg-surface-2 border-surface-4 text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Light
                </button>
                <button
                  onClick={() => updateSettings({ theme: 'dark' })}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-fast border ${
                    settings.theme === 'dark'
                      ? 'bg-surface-2 border-accent text-[#6a5aae]'
                      : 'bg-surface-2 border-surface-4 text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Dark
                </button>
              </div>
            </div>

            {/* Canvas background type */}
            <div>
              <label className="text-xs text-text-muted block mb-2">Canvas Background</label>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => updateSettings({ canvasBgType: 'color' })}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-fast border ${
                    (settings.canvasBgType || 'color') === 'color'
                      ? 'bg-[#8b7dc8] text-white border-accent'
                      : 'bg-surface-2 border-surface-4 text-text-secondary'
                  }`}
                >
                  Color
                </button>
                <button
                  onClick={() => updateSettings({ canvasBgType: 'video', canvasBgVideo: settings.canvasBgVideo || '/sky-day.mp4' })}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-fast border ${
                    settings.canvasBgType === 'video'
                      ? 'bg-[#8b7dc8] text-white border-accent'
                      : 'bg-surface-2 border-surface-4 text-text-secondary'
                  }`}
                >
                  Video
                </button>
              </div>

              {/* Color options */}
              {(settings.canvasBgType || 'color') === 'color' && (
                <div className="flex gap-2">
                  {settings.theme === 'light'
                    ? ['#e0f2fe', '#e8f4f8', '#f0f9ff', '#dbeafe', '#eff6ff'].map((color) => (
                        <button
                          key={color}
                          onClick={() => updateSettings({ canvasBg: color })}
                          className={`w-9 h-9 rounded-lg border-2 transition-fast hover:scale-105 ${
                            settings.canvasBg === color ? 'border-accent ring-1 ring-accent' : 'border-surface-4'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))
                    : ['#0a1628', '#0d1b2a', '#1a1a2e', '#0f172a', '#1e293b'].map((color) => (
                        <button
                          key={color}
                          onClick={() => updateSettings({ canvasBg: color })}
                          className={`w-9 h-9 rounded-lg border-2 transition-fast hover:scale-105 ${
                            settings.canvasBg === color ? 'border-accent ring-1 ring-accent' : 'border-surface-4'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))
                  }
                </div>
              )}

              {/* Video options */}
              {settings.canvasBgType === 'video' && (
                <div className="space-y-2">
                  {/* Built-in presets */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { url: '/sky-day.mp4', label: 'Daytime Sky' },
                      { url: '/videos/tropical-jungle.mp4', label: 'Tropical Jungle' },
                      { url: '/videos/luminous-particles.mp4', label: 'Luminous Particles' },
                      { url: '/videos/geometric-vj.mp4', label: 'Geometric VJ' },
                      { url: '/videos/light-waves.mp4', label: 'Light Waves' },
                      { url: '/videos/black-white-maze.mp4', label: 'B&W Maze' },
                      { url: '/videos/fractal-animation.mp4', label: 'Fractal Animation' },
                      { url: '/videos/cg-vj-loop.mp4', label: 'CG VJ Loop' },
                      { url: '/videos/red-spheres-tunnel.mp4', label: 'Red Spheres' },
                      { url: '/videos/organic-formations.mp4', label: 'Organic Forms' },
                      { url: '/videos/neon-space.mp4', label: 'Neon Space' },
                      { url: '/videos/blue-digital-tunnel.mp4', label: 'Blue Tunnel' },
                    ].map((bg) => (
                      <button
                        key={bg.url}
                        onClick={() => updateSettings({ canvasBgVideo: bg.url })}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-fast border ${
                          settings.canvasBgVideo === bg.url
                            ? 'bg-[#8b7dc8] text-white border-accent'
                            : 'bg-surface-2 border-surface-4 text-text-secondary'
                        }`}
                      >
                        {bg.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom backgrounds with rename/delete */}
                  {(settings.customBgUrls || []).length > 0 && (
                    <div className="space-y-1">
                      <label className="text-2xs text-text-muted">Custom backgrounds</label>
                      {(settings.customBgUrls || []).map((url, i) => {
                        const labels = settings.customBgLabels || {}
                        const label = labels[url] || `Custom ${i + 1}`
                        return (
                          <div key={url} className="flex items-center gap-2">
                            <button
                              onClick={() => updateSettings({ canvasBgVideo: url })}
                              className={`flex-1 px-3 py-1.5 rounded text-xs text-left truncate transition-fast border ${
                                settings.canvasBgVideo === url
                                  ? 'bg-[#8b7dc8] text-white border-accent'
                                  : 'bg-surface-2 border-surface-4 text-text-secondary hover:border-accent'
                              }`}
                            >
                              {label}
                            </button>
                            <button
                              className="btn btn-ghost text-2xs p-1"
                              title="Rename"
                              onClick={() => {
                                const newName = prompt('Rename background:', label)
                                if (newName && newName.trim()) {
                                  updateSettings({ customBgLabels: { ...labels, [url]: newName.trim() } })
                                }
                              }}
                            >✏️</button>
                            <button
                              className="btn btn-ghost text-2xs p-1 text-danger"
                              title="Remove"
                              onClick={() => {
                                const remaining = (settings.customBgUrls || []).filter(u => u !== url)
                                const newLabels = { ...labels }
                                delete newLabels[url]
                                updateSettings({
                                  customBgUrls: remaining,
                                  customBgLabels: newLabels,
                                  canvasBgVideo: settings.canvasBgVideo === url ? '/sky-day.mp4' : settings.canvasBgVideo,
                                })
                              }}
                            >×</button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Custom URL input */}
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="YouTube or .mp4 URL"
                      className="input flex-1 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.currentTarget.value) {
                          const url = e.currentTarget.value.trim()
                          if (!url) return
                          const existing = settings.customBgUrls || []
                          if (existing.includes(url)) { e.currentTarget.value = ''; return }
                          updateSettings({ customBgUrls: [...existing, url], canvasBgVideo: url })
                          e.currentTarget.value = ''
                        }
                      }}
                    />
                    <button
                      className="btn btn-ghost text-xs"
                      onClick={(e) => {
                        const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement
                        if (input?.value) {
                          const url = input.value.trim()
                          if (!url) return
                          const existing = settings.customBgUrls || []
                          if (!existing.includes(url)) {
                            updateSettings({ customBgUrls: [...existing, url], canvasBgVideo: url })
                          } else {
                            updateSettings({ canvasBgVideo: url })
                          }
                          input.value = ''
                        }
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Video Credits */}
          <Section title="Video Credits">
            <div className="p-3 rounded-lg border border-accent/15 bg-accent/5">
              <p className="text-xs text-text-secondary mb-2">
                Video backgrounds are provided by Pexels under the Pexels License (free for personal and commercial use).
              </p>
              <div className="space-y-1 text-2xs text-text-muted">
                <p>• <strong>Tropical Jungle</strong> — Pexels</p>
                <p>• <strong>Luminous Particles</strong> — Pexels</p>
                <p>• <strong>Geometric VJ</strong> — Pexels</p>
                <p>• <strong>Light Waves</strong> — Pexels</p>
                <p>• <strong>Black & White Maze</strong> — Pexels</p>
                <p>• <strong>Fractal Animation</strong> — Pexels</p>
                <p>• <strong>CG VJ Loop</strong> — Pexels</p>
                <p>• <strong>Red Spheres Tunnel</strong> — Pexels</p>
                <p>• <strong>Organic Formations</strong> — Pexels</p>
                <p>• <strong>Neon Space</strong> — Pexels</p>
                <p>• <strong>Blue Digital Tunnel</strong> — Pexels</p>
                <p>• <strong>Daytime Sky</strong> — MoodBored (Original)</p>
              </div>
              <p className="text-2xs text-text-muted mt-2">
                <a href="https://www.pexels.com/license/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  Pexels License
                </a> — Free for personal and commercial use, no attribution required.
              </p>
            </div>
          </Section>
        </div>

        <div className="p-4 border-t border-white/[0.06] flex justify-end">
          <button onClick={handleClose} className="btn btn-primary" aria-label="Close settings">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="text-xs text-text-muted block mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input w-full"
      />
    </div>
  )
}
