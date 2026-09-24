import { useState, useRef, useEffect, useMemo } from 'react'
import { useStore } from '@/stores/useStore'
import {
  streamChat, streamChatWithTools, parseActionsIncremental, buildSystemPrompt,
  summarizeProject, describeBoard, resetJevCounter,
  getAgentDiagnostics, resetAgentDiagnostics, agentDiagnostics,
} from '@/lib/api'
import { BOARD_TOOLS, processToolCalls, buildToolSystemPrompt } from '@/lib/tools'
import { getAgentsForTask, buildMultiAgentSystemPrompt } from '@/lib/agents'
import { Send, Trash2, StopCircle, AlertCircle, MessageSquare, Activity } from 'lucide-react'
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

  // One streaming request; supports both tool-calling and regex-parsed modes.
  // Tool-calling is more reliable — the LLM returns structured function calls
  // instead of hoping JSON blocks appear in the text.
  const requestCompletion = async (
    correctiveNotes: string[],
    retriesLeft: number,
    allowFormatRetry: boolean = true,
  ) => {
    setStreaming(true)

    const items = allItemsItemsForPrompt()
    const summary = summarizeProject(items)
    const boardDesc = describeBoard(items)
    const useToolCalling = BOARD_TOOLS.length > 0

    // Multi-agent mode: detect which specialists are needed based on the user's message
    const currentMessagesForPrompt = useStore.getState().project.viewports
      .find(v => v.id === activeViewportId)?.messages ?? []
    const lastUserMsg = [...currentMessagesForPrompt].reverse().find(m => m.role === 'user')
    const userMessage = correctiveNotes.length > 0 ? correctiveNotes.join(' ') : lastUserMsg?.content || ''
    const isMultiAgent = settings.multiAgent && useToolCalling

    const systemPrompt = isMultiAgent
      ? buildMultiAgentSystemPrompt(getAgentsForTask(userMessage), summary, boardDesc, activeViewport?.name)
      : useToolCalling
        ? buildToolSystemPrompt(summary, boardDesc, activeViewport?.name)
        : buildSystemPrompt(summary, boardDesc, activeViewport?.name)

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
    const pendingActions: AgentAction[] = []
    const assistantMsg: ChatMessage = { id: uuid(), role: 'assistant', content: '', timestamp: new Date().toISOString(), actions: [] }
    addMessage(assistantMsg)

    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      if (useToolCalling) {
        // ─── Tool-calling mode ──────────────────────────────────────
        await streamChatWithTools(
          apiMessages as any, settings.apiKey, settings.defaultModel, BOARD_TOOLS,
          (chunk) => {
            agentDiagnostics.chunksSeen++
            fullResponse += chunk
            const currentMessages = useStore.getState().project.viewports
              .find(v => v.id === activeViewportId)?.messages ?? []
            const updated = currentMessages.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: fullResponse } : m
            )
            if (!updated.some(m => m.id === assistantMsg.id)) updated.push({ ...assistantMsg, content: fullResponse })
            saveMessages(updated)
          },
          (toolCalls) => {
            // Execute tool calls and return results
            const actions = processToolCalls(toolCalls)
            const results: { tool_call_id: string; content: string }[] = []

            for (const action of actions) {
              try {
                if (action.type === 'add_item' && action.item) {
                  pendingActions.push({ type: 'add_item', item: action.item })
                  results.push({ tool_call_id: toolCalls[0]?.id || '', content: `Added ${action.item.kind} item` })
                } else if (action.type === 'remove_item' && action.itemId) {
                  pendingActions.push({ type: 'remove_item', itemId: action.itemId })
                  results.push({ tool_call_id: toolCalls[0]?.id || '', content: `Removed item ${action.itemId}` })
                } else if (action.type === 'update_item' && action.itemId) {
                  pendingActions.push({ type: 'update_item', itemId: action.itemId, item: action.updates })
                  results.push({ tool_call_id: toolCalls[0]?.id || '', content: `Updated item ${action.itemId}` })
                } else if (action.type === 'group_items') {
                  useStore.getState().groupSelected(action.label || 'Group')
                  results.push({ tool_call_id: toolCalls[0]?.id || '', content: `Grouped items into "${action.label}"` })
                } else if (action.type === 'arrange_items') {
                  const s = useStore.getState()
                  if (action.layout === 'grid') s.arrangeGrid(action.cols || 4, action.gap || 20)
                  else if (action.layout === 'stack-h') s.arrangeStack('h', action.gap || 20)
                  else if (action.layout === 'stack-v') s.arrangeStack('v', action.gap || 20)
                  else if (action.layout === 'spiral') s.arrangeSpiral(action.gap || 30)
                  results.push({ tool_call_id: toolCalls[0]?.id || '', content: `Arranged items in ${action.layout} layout` })
                } else {
                  results.push({ tool_call_id: toolCalls[0]?.id || '', content: 'Unknown action' })
                }
              } catch (err) {
                results.push({ tool_call_id: toolCalls[0]?.id || '', content: `Error: ${err}` })
              }
            }

            // Execute accumulated add/remove/update actions
            if (pendingActions.length > 0) {
              executeActions(pendingActions)
              agentDiagnostics.actionsExecuted += pendingActions.length
            }

            return results
          },
          () => {
            if (pendingActions.length > 0) {
              addMessage({ id: uuid(), role: 'system', content: `[debug] executed ${pendingActions.length} actions. Items on board: ${currentViewportItems().length}`, timestamp: new Date().toISOString() })
              showToast(`Added ${pendingActions.length} item${pendingActions.length > 1 ? 's' : ''}`, 'success')
            }
            setStreaming(false)
          },
          (err) => {
            agentDiagnostics.lastError = err
            const currentMessages = useStore.getState().project.viewports
              .find(v => v.id === activeViewportId)?.messages ?? []
            const updated = currentMessages.map((m) => m.id === assistantMsg.id ? { ...m, content: `Error: ${err}` } : m)
            saveMessages(updated)
            setStreaming(false)
          },
          abortController.signal,
        )
      } else {
        // ─── Regex-parsed mode (legacy fallback) ────────────────────
        await streamChat(
          apiMessages, settings.apiKey, settings.defaultModel,
          (chunk) => {
            agentDiagnostics.chunksSeen++
            fullResponse += chunk
            const result = parseActionsIncremental(fullResponse, 0)
            pendingActions.push(...result.actions)
            const currentMessages = useStore.getState().project.viewports
              .find(v => v.id === activeViewportId)?.messages ?? []
            const updated = currentMessages.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: fullResponse, actions: [...(m.actions || []), ...result.actions] } : m
            )
            if (!updated.some(m => m.id === assistantMsg.id)) updated.push({ ...assistantMsg, content: fullResponse })
            saveMessages(updated)
          },
          async () => {
            const finalResult = parseActionsIncremental(fullResponse, 0)
            const allActions = [...pendingActions, ...finalResult.actions]
            agentDiagnostics.actionsParsed = allActions.length
            await gateAndExecute(allActions, retriesLeft, assistantMsg, allowFormatRetry)
            setStreaming(false)
          },
          (err) => {
            agentDiagnostics.lastError = err
            const currentMessages = useStore.getState().project.viewports
              .find(v => v.id === activeViewportId)?.messages ?? []
            const updated = currentMessages.map((m) => m.id === assistantMsg.id ? { ...m, content: `Error: ${err}` } : m)
            saveMessages(updated)
            setStreaming(false)
          },
          abortController.signal,
        )
      }
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

  // Agent execution — runs once per completed response against the whole batch.
  // Jev gate is disabled until proven stable; direct execution for debugging.
  const gateAndExecute = async (actions: AgentAction[], retriesLeft: number, assistantMsg: ChatMessage, allowFormatRetry: boolean = true) => {
    addMessage({ id: uuid(), role: 'system', content: `[debug] actions parsed: ${actions.length}`, timestamp: new Date().toISOString() })

    if (actions.length === 0) {
      // Model drifted into prose without emitting json blocks — retry once.
      if (retriesLeft > 0 && allowFormatRetry) {
        addMessage({ id: uuid(), role: 'system', content: 'No items parsed — asking AI to reformat as json blocks.', timestamp: new Date().toISOString() })
        await requestCompletion(['Your previous response contained NO ```json blocks, so nothing was added to the board. Re-emit ALL items now as one or more ```json blocks per the ITEM TYPES spec. Do not write markdown lists or headings; put that content inside the json objects.'], retriesLeft, false)
        return
      }
      showToast('No items returned — try rephrasing', 'info')
      return
    }

    // Direct execution — no Jev gate in the way while we debug
    executeActions(actions)
    addMessage({ id: uuid(), role: 'system', content: `[debug] executed ${actions.length} actions. Items on board: ${currentViewportItems().length}`, timestamp: new Date().toISOString() })
    showToast(`Added ${actions.length} item${actions.length > 1 ? 's' : ''}`, 'success')
  }

  const handleClear = () => {
    if (messages.length === 0) return
    if (confirm('Clear all chat messages?')) { saveMessages([]); resetJevCounter(); showToast('Chat cleared', 'info') }
  }

  const showDiagnostics = () => {
    const d = getAgentDiagnostics()
    const summary = `chunks ${d.chunksSeen} · blocks ${d.jsonBlockMatches} · parsed ${d.actionsParsed} · executed ${d.actionsExecuted}${d.lastError ? ` · last error: ${d.lastError}` : ''}\n\n${d.timeline.slice(-6).join('\n')}`
    showToast(summary || 'No agent activity yet', d.lastError ? 'error' : 'info', 8000)
  }

  return (
    <div className="h-full glass-panel border-l border-surface-4 flex flex-col">
      <div className="p-3 border-b border-surface-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Chat</h2>
        <div className="flex items-center gap-1">
          <button onClick={showDiagnostics} className="text-text-muted hover:text-text-primary p-1" aria-label="Show agent diagnostics" title="Pipeline diagnostics">
            <Activity size={14} />
          </button>
          <button onClick={handleClear} className="btn p-1 text-text-muted hover:text-danger hover:bg-danger-light rounded" aria-label="Clear chat">
            <Trash2 size={14} />
          </button>
        </div>
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
