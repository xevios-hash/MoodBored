import { useState, useRef, useEffect, useMemo } from 'react'
import { useStore } from '@/stores/useStore'
import {
  streamChat, parseActionsIncremental, buildSystemPrompt,
  summarizeProject, describeBoard, resetJevCounter,
  gateItems, getAgentDiagnostics, resetAgentDiagnostics, agentDiagnostics,
  type ParsedActions,
} from '@/lib/api'
import { Send, Trash2, StopCircle, AlertCircle, MessageSquare } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import type { ChatMessage, AgentAction } from '@/types'
import { showToast } from '@/lib/toasts'

function cleanContent(content: string): string {
  let cleaned = content.replace(/```json\s*[\s\S]*?```/g, '')
  cleaned = cleaned.replace(/```JSON\s*[\s\S]*?```/g, '')
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')
  return cleaned.trim()
}

export function ChatPanel() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const isStreaming = useStore((s) => s.isStreaming)
  const setStreaming = useStore((s) => s.setStreaming)
  const executeActions = useStore((s) => s.executeActions)
  const toggleSettings = useStore((s) => s.toggleSettings)
  const project = useStore((s) => s.project)
  const settings = project.settings
  const activeViewportId = useStore((s) => s.activeViewportId)
  const activeViewport = project.viewports.find(v => v.id === activeViewportId) ?? project.viewports[0]
  const allItems = activeViewport?.items ?? []
  const messages = activeViewport?.messages ?? []

  const saveMessages = (newMessages: ChatMessage[]) => {
    useStore.setState((s) => ({
      project: {
        ...s.project,
        viewports: s.project.viewports.map(v =>
          v.id === s.activeViewportId ? { ...v, messages: newMessages } : v
        ),
      },
    }))
  }

  const addMessage = (msg: ChatMessage) => { saveMessages([...messages, msg]) }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isStreaming) return
    if (!settings.apiKey) {
      addMessage({ id: uuid(), role: 'system', content: 'Please set your OpenRouter API key in Settings first.', timestamp: new Date().toISOString() })
      return
    }

    addMessage({ id: uuid(), role: 'user', content: text, timestamp: new Date().toISOString() })
    setInput('')
    resetAgentDiagnostics()
    await requestCompletion([], 1)
  }

  // One streaming request; when Jev rejects the proposed batch we retry
  // once with the feedback injected as a corrective system note.
  const requestCompletion = async (
    correctiveNotes: string[],
    retriesLeft: number,
  ) => {
    setStreaming(true)

    const systemPrompt = buildSystemPrompt(
      summarizeProject(allItemsItemsForPrompt()),
      describeBoard(allItemsItemsForPrompt()),
      activeViewport?.name,
    )
    const currentMessages = useStore.getState().project.viewports
      .find(v => v.id === activeViewportId)?.messages ?? []
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...currentMessages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content })),
      ...(correctiveNotes.length > 0
        ? [{ role: 'system', content: 'Refine your last proposal.\n' + correctiveNotes.join('\n') } as { role: string; content: string }]
        : []),
    ]

    let fullResponse = ''
    let consumedLength = 0
    const pendingActions: AgentAction[] = []
    const assistantMsg: ChatMessage = { id: uuid(), role: 'assistant', content: '', timestamp: new Date().toISOString(), actions: [] }
    addMessage(assistantMsg)

    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      await streamChat(
        apiMessages, settings.apiKey, settings.defaultModel,
        (chunk) => {
          agentDiagnostics.chunksSeen++
          fullResponse += chunk
          const result = parseActionsIncremental(fullResponse, consumedLength)
          consumedLength = result.consumedLength
          // During streaming we only record actions — they are gated and
          // executed when the response completes (fewer Jev calls, one
          // coherent batch).
          pendingActions.push(...result.actions)
          // Read current messages from store (not stale closure)
          const currentMessages = useStore.getState().project.viewports
            .find(v => v.id === activeViewportId)?.messages ?? []
          const updated = currentMessages.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: fullResponse, actions: [...(m.actions || []), ...result.actions] } : m
          )
          if (!updated.some(m => m.id === assistantMsg.id)) updated.push({ ...assistantMsg, content: fullResponse })
          saveMessages(updated)
        },
        async () => {
          // Final pass — catch any remaining blocks
          const finalResult = parseActionsIncremental(fullResponse, consumedLength)
          const allActions = [...pendingActions, ...finalResult.actions]
          agentDiagnostics.actionsParsed = allActions.length

          await gateAndExecute(allActions, retriesLeft, assistantMsg)
          setStreaming(false)
        },
        (err) => {
          agentDiagnostics.lastError = err
          // Read current messages from store
          const currentMessages = useStore.getState().project.viewports
            .find(v => v.id === activeViewportId)?.messages ?? []
          const updated = currentMessages.map((m) => m.id === assistantMsg.id ? { ...m, content: `Error: ${err}` } : m)
          saveMessages(updated)
          setStreaming(false)
        },
        abortController.signal,
      )
    } catch (err) {
      addMessage({ id: uuid(), role: 'system', content: `Stream error: ${err instanceof Error ? err.message : 'Unknown'}`, timestamp: new Date().toISOString() })
      setStreaming(false)
    } finally {
      abortRef.current = null
    }
  }

  // snapshot the CURRENT items of the active viewport (post previous turns)
  const allItemsItemsForPrompt = () => currentViewportItems()
  const currentViewportItems = () =>
    useStore.getState().project.viewports.find(v => v.id === useStore.getState().activeViewportId)?.items ?? []

  // Jev gate — runs once per completed response against the whole batch.
  const gateAndExecute = async (actions: AgentAction[], retriesLeft: number, assistantMsg: ChatMessage) => {
    if (actions.length === 0) {
      console.info('[MoodBored] diagnostics — no actions parsed:', getAgentDiagnostics().timeline)
      return
    }
    const proposals = actions.map((a: any) => ({
      kind: a.item?.kind ?? 'unknown',
      description: a.item?.description ?? a.item?.text ?? a.item?.subjectDesc ?? a.item?.label ?? a.item?.url ?? '',
    }))
    const result = await gateItems(describeBoard(currentViewportItems()), proposals, settings.apiKey, settings.jevThreshold)
    if (result.accepted) {
      executeActions(actions)
      const msg = `Jev gate passed (${(result.score * 100).toFixed(0)}%) — executing batch. ${result.reasoning}`
      addMessage({ id: uuid(), role: 'system', content: msg, timestamp: new Date().toISOString() })
      showToast(`Added ${actions.length} item${actions.length > 1 ? 's' : ''}`, 'success')
    } else if (retriesLeft > 0) {
      addMessage({ id: uuid(), role: 'system', content: `Jev gate rejected (score ${(result.score * 100).toFixed(0)}% vs threshold ${(settings.jevThreshold * 100).toFixed(0)}%) — asking AI to refine. ${result.reasoning}`, timestamp: new Date().toISOString() })
      await requestCompletion([`Previous proposal scored ${(result.score * 100).toFixed(0)}%. Reasoning: ${result.reasoning}. Rework the JSON block with more on-theme, less redundant items.`], retriesLeft - 1)
    } else {
      addMessage({ id: uuid(), role: 'system', content: `Jev gate rejected again (final score ${(result.score * 100).toFixed(0)}%): ${result.reasoning}`, timestamp: new Date().toISOString() })
      showToast('Items rejected by quality gate', 'info')
    }
  }

  const handleClear = () => {
    if (messages.length === 0) return
    if (confirm('Clear all chat messages?')) { saveMessages([]); resetJevCounter(); showToast('Chat cleared', 'info') }
  }

  return (
    <div className="h-full glass-panel border-l border-surface-4 flex flex-col">
      <div className="p-3 border-b border-surface-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Chat</h2>
        <button onClick={handleClear} className="btn p-1 text-text-muted hover:text-danger hover:bg-danger-light rounded">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-text-muted text-sm mt-8 animate-fadeIn">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-surface-2 flex items-center justify-center">
              <MessageSquare size={20} className="text-accent" />
            </div>
            <p className="mb-2 font-medium text-text-primary">Start a conversation</p>
            <p className="text-xs">Describe what you want on your mood board.</p>
          </div>
        )}
        {messages.map((msg) => {
          const isSystem = msg.role === 'system'
          return (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
              <div className={`${isSystem ? 'w-full text-center text-xs px-3 py-1.5 rounded-lg bg-surface-2 text-text-muted' : `chat-bubble ${msg.content.startsWith('Error:') ? 'error' : msg.role}`}`}>
                <div className="whitespace-pre-wrap">{cleanContent(msg.content)}</div>
                {msg.actions && msg.actions.length > 0 && !isSystem && (
                  <div className="mt-2 px-2 py-1 rounded text-xs bg-accent/10">
                    <span className="text-accent">+{msg.actions.length} item{msg.actions.length > 1 ? 's' : ''} added</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {isStreaming && (
          <div className="flex justify-start animate-fadeIn">
            <div className="bg-surface-2 rounded-2xl px-4 py-2 flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                ))}
              </div>
              <span className="text-xs text-text-muted">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-surface-4">
        {!settings.apiKey && (
          <div className="mb-2 p-2 bg-danger-light rounded-lg flex items-center gap-2 text-xs text-danger cursor-pointer" onClick={toggleSettings}>
            <AlertCircle size={14} />
            <span>API key required. Click to open Settings.</span>
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Describe what to add..."
            disabled={isStreaming}
            className="input flex-1 resize-none"
            rows={2}
          />
          <button onClick={isStreaming ? () => { abortRef.current?.abort(); setStreaming(false) } : handleSend} className={`btn self-end ${isStreaming ? 'btn-danger' : 'btn-primary'}`}>
            {isStreaming ? <StopCircle size={16} /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  )
}
