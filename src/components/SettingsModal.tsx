import { useStore } from '@/stores/useStore'
import { X, Eye, EyeOff, Shield } from 'lucide-react'
import { useState } from 'react'
import { resetJevCounter } from '@/lib/api'
import { showToast } from '@/lib/toasts'

export function SettingsModal() {
  const settings = useStore((s) => s.project.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const toggleSettings = useStore((s) => s.toggleSettings)
  const [showApiKey, setShowApiKey] = useState(false)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-fadeIn"
      onClick={(e) => e.target === e.currentTarget && toggleSettings()}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="w-[min(480px,90vw)] glass-card rounded-xl shadow-panel overflow-hidden animate-scaleIn">
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">Settings</h2>
          <button
            onClick={toggleSettings}
            className="btn p-1 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded"
            aria-label="Close settings"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-5 max-h-[60vh] overflow-y-auto">
          <Section title="API Configuration">
            <div>
              <label className="text-xs text-text-muted block mb-1">OpenRouter API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={settings.apiKey}
                  onChange={(e) => updateSettings({ apiKey: e.target.value })}
                  placeholder="sk-or-..."
                  className="input w-full pr-10"
                  aria-label="OpenRouter API key"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-fast"
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-2xs text-text-muted mt-1">
                Get your key at{' '}
                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  openrouter.ai/keys
                </a>
              </p>
            </div>
            <Field
              label="Default Model"
              value={settings.defaultModel}
              onChange={(v) => updateSettings({ defaultModel: v })}
              placeholder="anthropic/claude-sonnet-4"
            />
          </Section>

          <Section title="Agent — Jev Quality Gate">
            <div className="p-3 bg-accent/5 rounded-lg border border-accent/10">
              <div className="flex items-center gap-2 mb-2">
                <Shield size={16} className="text-accent" />
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
            <div className="p-3 bg-accent/5 rounded-lg border border-accent/10">
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
            <div className="p-3 bg-accent/5 rounded-lg border border-accent/10">
              <p className="text-xs text-text-muted mb-2">
                MoodBored exposes an MCP server that lets other LLMs read and write to your board.
                Add the config below to Claude Desktop or any MCP client to connect.
              </p>
              <p className="text-2xs text-text-muted mb-1">Board state is synced to:</p>
              <code className="text-2xs bg-surface-0 rounded p-1 block mb-2 text-text-secondary break-all">~/Library/Application Support/MoodBored/board.json</code>
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

          <Section title="Appearance">
            {/* Theme toggle */}
            <div>
              <label className="text-xs text-text-muted block mb-2">Theme</label>
              <div className="flex gap-2">
                <button
                  onClick={() => updateSettings({ theme: 'light' })}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-fast border ${
                    settings.theme === 'light'
                      ? 'bg-white border-accent text-accent'
                      : 'bg-surface-2 border-surface-4 text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Light
                </button>
                <button
                  onClick={() => updateSettings({ theme: 'dark' })}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-fast border ${
                    settings.theme === 'dark'
                      ? 'bg-surface-2 border-accent text-accent'
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
                      ? 'bg-accent text-white border-accent'
                      : 'bg-surface-2 border-surface-4 text-text-secondary'
                  }`}
                >
                  Color
                </button>
                <button
                  onClick={() => updateSettings({ canvasBgType: 'video' })}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-fast border ${
                    settings.canvasBgType === 'video'
                      ? 'bg-accent text-white border-accent'
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
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { url: '/sky-day.mp4', label: 'Daytime Sky' },
                      { url: '/sky-night.mp4', label: 'Starry Night' },
                      { url: '/bg-ocean.mp4', label: 'Deep Blue' },
                      { url: '/bg-sunset.mp4', label: 'Golden Hour' },
                      ...((settings.customBgUrls || []).map((u, i) => ({ url: u, label: `Custom ${i + 1}` }))),
                    ].map((bg) => (
                      <button
                        key={bg.url}
                        onClick={() => updateSettings({ canvasBgVideo: bg.url })}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-fast border ${
                          settings.canvasBgVideo === bg.url
                            ? 'bg-accent text-white border-accent'
                            : 'bg-surface-2 border-surface-4 text-text-secondary'
                        }`}
                      >
                        {bg.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom URL input */}
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="YouTube or .mp4 URL"
                      className="input flex-1 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.currentTarget.value) {
                          const url = e.currentTarget.value
                          updateSettings({ customBgUrls: [...(settings.customBgUrls || []), url], canvasBgVideo: url })
                          e.currentTarget.value = ''
                        }
                      }}
                    />
                    <button
                      className="btn btn-ghost text-xs"
                      onClick={(e) => {
                        const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement
                        if (input?.value) {
                          updateSettings({ customBgUrls: [...(settings.customBgUrls || []), input.value], canvasBgVideo: input.value })
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
        </div>

        <div className="p-4 border-t border-white/[0.06] flex justify-end">
          <button onClick={toggleSettings} className="btn btn-primary" aria-label="Close settings">
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
