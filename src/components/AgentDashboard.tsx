// Agent Observability Dashboard
// Real-time view of connected agents and their operations

import { useState, useEffect } from 'react'
import { X, Users, Activity, AlertCircle, Check, Clock, Zap } from 'lucide-react'
import type { AgentInfo, Operation, Conflict } from '@/lib/concurrency'

interface Props {
  onClose: () => void
}

export function AgentDashboard({ onClose }: Props) {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [operations, setOperations] = useState<Operation[]>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [activeTab, setActiveTab] = useState<'agents' | 'operations' | 'conflicts'>('agents')

  // Fetch data periodically
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [agentsRes, opsRes, conflictsRes] = await Promise.all([
          fetch('/api/agents').then(r => r.json()).catch(() => ({ agents: [] })),
          fetch('/api/operations?limit=50').then(r => r.json()).catch(() => ({ operations: [] })),
          fetch('/api/conflicts').then(r => r.json()).catch(() => ({ conflicts: [] })),
        ])
        setAgents(agentsRes.agents || [])
        setOperations(opsRes.operations || [])
        setConflicts(conflictsRes.conflicts || [])
      } catch {}
    }

    fetchData()
    const interval = setInterval(fetchData, 2000)
    return () => clearInterval(interval)
  }, [])

  const tabs = [
    { id: 'agents' as const, label: 'Agents', icon: <Users size={14} />, count: agents.length },
    { id: 'operations' as const, label: 'Operations', icon: <Activity size={14} />, count: operations.length },
    { id: 'conflicts' as const, label: 'Conflicts', icon: <AlertCircle size={14} />, count: conflicts.filter(c => !c.resolved).length },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-fadeIn" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-[min(900px,95vw)] h-[min(600px,85vh)] glass-card rounded-xl shadow-panel flex flex-col animate-scaleIn overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-accent" />
            <div>
              <h2 className="text-base font-semibold text-text-primary">Agent Dashboard</h2>
              <p className="text-xs text-text-muted mt-0.5">
                {agents.filter(a => a.status === 'active').length} active agents
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn p-1 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.06]">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded text-2xs ${
                  tab.id === 'conflicts' && tab.count > 0
                    ? 'bg-red-500/10 text-red-500'
                    : 'bg-surface-2 text-text-muted'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Agents Tab */}
          {activeTab === 'agents' && (
            <div className="space-y-2">
              {agents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-text-muted">
                  <Users size={48} className="mb-4 opacity-20" />
                  <p className="text-sm">No agents connected</p>
                  <p className="text-xs mt-1">Agents will appear here when they connect via MCP or REST</p>
                </div>
              ) : (
                agents.map(agent => (
                  <AgentCard key={agent.id} agent={agent} />
                ))
              )}
            </div>
          )}

          {/* Operations Tab */}
          {activeTab === 'operations' && (
            <div className="space-y-1">
              {operations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-text-muted">
                  <Activity size={48} className="mb-4 opacity-20" />
                  <p className="text-sm">No operations yet</p>
                  <p className="text-xs mt-1">Operations will appear here as agents work</p>
                </div>
              ) : (
                operations.slice().reverse().map(op => (
                  <OperationRow key={op.id} operation={op} />
                ))
              )}
            </div>
          )}

          {/* Conflicts Tab */}
          {activeTab === 'conflicts' && (
            <div className="space-y-2">
              {conflicts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-text-muted">
                  <Check size={48} className="mb-4 opacity-20 text-green-500" />
                  <p className="text-sm">No conflicts</p>
                  <p className="text-xs mt-1">All operations are conflict-free</p>
                </div>
              ) : (
                conflicts.map(conflict => (
                  <ConflictCard key={conflict.id} conflict={conflict} />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Agent Card Component
function AgentCard({ agent }: { agent: AgentInfo }) {
  const statusColors = {
    active: 'bg-green-500',
    idle: 'bg-yellow-500',
    disconnected: 'bg-gray-400',
  }

  const typeIcons: Record<string, string> = {
    human: '👤',
    llm: '🤖',
    mcp: '🔌',
    system: '⚙️',
  }

  return (
    <div className="rounded-lg border border-white/[0.06] p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="text-lg">{typeIcons[agent.type] || '🔌'}</span>
            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface-1 ${statusColors[agent.status]}`} />
          </div>
          <div>
            <div className="text-sm font-medium text-text-primary">{agent.name}</div>
            <div className="text-2xs text-text-muted capitalize">{agent.type} · {agent.status}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-text-secondary">{agent.operationsCount} ops</div>
          <div className="text-2xs text-text-muted">
            {new Date(agent.lastActivity).toLocaleTimeString()}
          </div>
        </div>
      </div>
      {agent.currentOperation && (
        <div className="mt-2 px-2 py-1 rounded bg-accent/10 text-2xs text-accent">
          <Zap size={10} className="inline mr-1" />
          {agent.currentOperation}
        </div>
      )}
    </div>
  )
}

// Operation Row Component
function OperationRow({ operation }: { operation: Operation }) {
  const typeColors: Record<string, string> = {
    add: 'text-green-500',
    update: 'text-blue-500',
    delete: 'text-red-500',
    move: 'text-yellow-500',
    batch: 'text-purple-500',
  }

  const typeIcons: Record<string, string> = {
    add: '+',
    update: '↻',
    delete: '×',
    move: '→',
    batch: '⋯',
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors">
      <span className={`text-sm font-mono ${typeColors[operation.type]}`}>
        {typeIcons[operation.type]}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text-primary">
          <span className="font-medium">{operation.agentName}</span>
          <span className="text-text-muted mx-1">·</span>
          <span className={typeColors[operation.type]}>{operation.type}</span>
          {operation.targetId && (
            <span className="text-text-muted ml-1">({operation.targetId.slice(0, 8)}...)</span>
          )}
        </div>
      </div>
      <div className="text-2xs text-text-muted">
        {new Date(operation.timestamp).toLocaleTimeString()}
      </div>
      {operation.conflictsWith && operation.conflictsWith.length > 0 && (
        <span className="px-1.5 py-0.5 rounded text-2xs bg-red-500/10 text-red-500">
          conflict
        </span>
      )}
    </div>
  )
}

// Conflict Card Component
function ConflictCard({ conflict }: { conflict: Conflict }) {
  const typeLabels: Record<string, string> = {
    'update-update': 'Concurrent Updates',
    'update-delete': 'Update vs Delete',
    'concurrent-add': 'Concurrent Adds',
    'version-mismatch': 'Version Mismatch',
  }

  return (
    <div className={`rounded-lg border p-3 ${
      conflict.resolved
        ? 'border-green-500/20 bg-green-500/5'
        : 'border-red-500/20 bg-red-500/5'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <AlertCircle size={14} className={conflict.resolved ? 'text-green-500' : 'text-red-500'} />
          <span className="text-sm font-medium text-text-primary">
            {typeLabels[conflict.type] || conflict.type}
          </span>
        </div>
        {conflict.resolved ? (
          <span className="flex items-center gap-1 text-2xs text-green-500">
            <Check size={12} /> Resolved
          </span>
        ) : (
          <span className="text-2xs text-red-500">Unresolved</span>
        )}
      </div>
      <div className="text-2xs text-text-muted">
        {conflict.operations.length} operations involved
      </div>
      {conflict.resolved && conflict.resolution && (
        <div className="mt-1 text-2xs text-text-muted">
          Resolution: {conflict.resolution}
        </div>
      )}
    </div>
  )
}