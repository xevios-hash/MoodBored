// Concurrency Hardening for Multi-Agent Writes
// Handles optimistic concurrency, conflict detection, and resolution

import { v4 as uuid } from 'uuid'

// ─── Version Vector ─────────────────────────────────────────────────

export interface VersionVector {
  [agentId: string]: number
}

export interface VersionedState {
  version: VersionVector
  lastModified: string
  modifiedBy: string
  checksum: string
}

// Compare version vectors
export function compareVersions(a: VersionVector, b: VersionVector): 'before' | 'after' | 'concurrent' {
  let aBeforeB = false
  let bBeforeA = false

  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of allKeys) {
    const aVal = a[key] || 0
    const bVal = b[key] || 0
    if (aVal < bVal) aBeforeB = true
    if (bVal < aVal) bBeforeA = true
  }

  if (aBeforeB && !bBeforeA) return 'before'
  if (bBeforeA && !aBeforeB) return 'after'
  return 'concurrent'
}

// Increment version for an agent
export function incrementVersion(version: VersionVector, agentId: string): VersionVector {
  return {
    ...version,
    [agentId]: (version[agentId] || 0) + 1,
  }
}

// Merge version vectors (take max of each)
export function mergeVersions(a: VersionVector, b: VersionVector): VersionVector {
  const merged: VersionVector = {}
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of allKeys) {
    merged[key] = Math.max(a[key] || 0, b[key] || 0)
  }
  return merged
}

// ─── Operation Log ──────────────────────────────────────────────────

export interface Operation {
  id: string
  agentId: string
  agentName: string
  type: 'add' | 'update' | 'delete' | 'move' | 'batch'
  targetId?: string
  data: any
  timestamp: string
  version: VersionVector
  conflictsWith?: string[] // IDs of conflicting operations
}

class OperationLog {
  private operations: Operation[] = []
  private readonly maxOperations: number

  constructor(maxOperations = 1000) {
    this.maxOperations = maxOperations
  }

  log(op: Operation): void {
    this.operations.push(op)
    if (this.operations.length > this.maxOperations) {
      this.operations = this.operations.slice(-this.maxOperations)
    }
  }

  getRecent(count: number = 50): Operation[] {
    return this.operations.slice(-count)
  }

  getForAgent(agentId: string, count: number = 20): Operation[] {
    return this.operations
      .filter(op => op.agentId === agentId)
      .slice(-count)
  }

  getConflicts(): Operation[] {
    return this.operations.filter(op => op.conflictsWith && op.conflictsWith.length > 0)
  }

  clear(): void {
    this.operations = []
  }
}

export const operationLog = new OperationLog()

// ─── Conflict Detection ─────────────────────────────────────────────

export interface Conflict {
  id: string
  operations: Operation[]
  type: 'update-update' | 'update-delete' | 'concurrent-add' | 'version-mismatch'
  resolved: boolean
  resolution?: 'accept-latest' | 'accept-ours' | 'merge' | 'manual'
  resolvedBy?: string
  resolvedAt?: string
}

class ConflictResolver {
  private conflicts: Map<string, Conflict> = new Map()

  // Detect if two operations conflict
  detectConflict(op1: Operation, op2: Operation): Conflict | null {
    // Same target item
    if (op1.targetId && op1.targetId === op2.targetId) {
      // Both are updates
      if (op1.type === 'update' && op2.type === 'update') {
        const versionComparison = compareVersions(op1.version, op2.version)
        if (versionComparison === 'concurrent') {
          return this.createConflict('update-update', [op1, op2])
        }
      }

      // One is update, other is delete
      if ((op1.type === 'update' && op2.type === 'delete') ||
          (op1.type === 'delete' && op2.type === 'update')) {
        return this.createConflict('update-delete', [op1, op2])
      }
    }

    // Concurrent adds (could be duplicates)
    if (op1.type === 'add' && op2.type === 'add') {
      const versionComparison = compareVersions(op1.version, op2.version)
      if (versionComparison === 'concurrent') {
        // Check if they're adding similar items
        if (this.areSimilarItems(op1.data, op2.data)) {
          return this.createConflict('concurrent-add', [op1, op2])
        }
      }
    }

    return null
  }

  private createConflict(type: Conflict['type'], operations: Operation[]): Conflict {
    const conflict: Conflict = {
      id: uuid(),
      operations,
      type,
      resolved: false,
    }
    this.conflicts.set(conflict.id, conflict)
    return conflict
  }

  private areSimilarItems(a: any, b: any): boolean {
    if (a.kind !== b.kind) return false
    if (a.text && b.text && a.text === b.text) return true
    if (a.url && b.url && a.url === b.url) return true
    if (a.label && b.label && a.label === b.label) return true
    return false
  }

  // Resolve conflict with strategy
  resolve(conflictId: string, strategy: Conflict['resolution'], resolvedBy: string): boolean {
    const conflict = this.conflicts.get(conflictId)
    if (!conflict) return false

    conflict.resolved = true
    conflict.resolution = strategy
    conflict.resolvedBy = resolvedBy
    conflict.resolvedAt = new Date().toISOString()

    return true
  }

  // Auto-resolve simple conflicts
  autoResolve(conflict: Conflict): Conflict['resolution'] | null {
    switch (conflict.type) {
      case 'update-update':
        // Accept latest (by timestamp)
        return 'accept-latest'
      case 'update-delete':
        // Delete wins
        return 'accept-latest'
      case 'concurrent-add':
        // Keep both (they'll have different IDs)
        return 'accept-latest'
      default:
        return null
    }
  }

  getUnresolved(): Conflict[] {
    return [...this.conflicts.values()].filter(c => !c.resolved)
  }

  getAll(): Conflict[] {
    return [...this.conflicts.values()]
  }

  clear(): void {
    this.conflicts.clear()
  }
}

export const conflictResolver = new ConflictResolver()

// ─── Optimistic Locking ─────────────────────────────────────────────

export interface LockEntry {
  itemId: string
  agentId: string
  agentName: string
  acquiredAt: string
  expiresAt: string
  operation: string
}

class LockManager {
  private locks: Map<string, LockEntry> = new Map()
  private readonly lockTimeout: number // ms

  constructor(lockTimeout = 30000) {
    this.lockTimeout = lockTimeout
    this.startCleanup()
  }

  // Try to acquire a lock
  acquire(itemId: string, agentId: string, agentName: string, operation: string): LockEntry | null {
    const existing = this.locks.get(itemId)

    // Check if lock exists and hasn't expired
    if (existing && new Date(existing.expiresAt).getTime() > Date.now()) {
      // Lock held by different agent
      if (existing.agentId !== agentId) {
        return null
      }
      // Renew lock
      existing.expiresAt = new Date(Date.now() + this.lockTimeout).toISOString()
      return existing
    }

    // Acquire new lock
    const lock: LockEntry = {
      itemId,
      agentId,
      agentName,
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.lockTimeout).toISOString(),
      operation,
    }
    this.locks.set(itemId, lock)
    return lock
  }

  // Release a lock
  release(itemId: string, agentId: string): boolean {
    const lock = this.locks.get(itemId)
    if (!lock || lock.agentId !== agentId) return false
    this.locks.delete(itemId)
    return true
  }

  // Check if item is locked
  isLocked(itemId: string): boolean {
    const lock = this.locks.get(itemId)
    if (!lock) return false
    return new Date(lock.expiresAt).getTime() > Date.now()
  }

  // Get lock info
  getLock(itemId: string): LockEntry | null {
    const lock = this.locks.get(itemId)
    if (!lock) return null
    if (new Date(lock.expiresAt).getTime() <= Date.now()) {
      this.locks.delete(itemId)
      return null
    }
    return lock
  }

  // Get all locks
  getAllLocks(): LockEntry[] {
    const now = Date.now()
    const locks: LockEntry[] = []
    for (const [id, lock] of this.locks) {
      if (new Date(lock.expiresAt).getTime() > now) {
        locks.push(lock)
      } else {
        this.locks.delete(id)
      }
    }
    return locks
  }

  // Cleanup expired locks
  private startCleanup() {
    setInterval(() => {
      const now = Date.now()
      for (const [id, lock] of this.locks) {
        if (new Date(lock.expiresAt).getTime() <= now) {
          this.locks.delete(id)
        }
      }
    }, 10000) // Every 10 seconds
  }
}

export const lockManager = new LockManager()

// ─── Agent Registry ─────────────────────────────────────────────────

export interface AgentInfo {
  id: string
  name: string
  type: 'human' | 'llm' | 'mcp' | 'system'
  connectedAt: string
  lastActivity: string
  operationsCount: number
  currentOperation?: string
  status: 'active' | 'idle' | 'disconnected'
}

class AgentRegistry {
  private agents: Map<string, AgentInfo> = new Map()

  register(id: string, name: string, type: AgentInfo['type']): AgentInfo {
    const now = new Date().toISOString()
    const agent: AgentInfo = {
      id,
      name,
      type,
      connectedAt: now,
      lastActivity: now,
      operationsCount: 0,
      status: 'active',
    }
    this.agents.set(id, agent)
    return agent
  }

  update(id: string, updates: Partial<AgentInfo>): void {
    const agent = this.agents.get(id)
    if (agent) {
      Object.assign(agent, updates, { lastActivity: new Date().toISOString() })
    }
  }

  heartbeat(id: string): void {
    const agent = this.agents.get(id)
    if (agent) {
      agent.lastActivity = new Date().toISOString()
      agent.status = 'active'
    }
  }

  disconnect(id: string): void {
    const agent = this.agents.get(id)
    if (agent) {
      agent.status = 'disconnected'
    }
  }

  get(id: string): AgentInfo | undefined {
    return this.agents.get(id)
  }

  getAll(): AgentInfo[] {
    return [...this.agents.values()]
  }

  getActive(): AgentInfo[] {
    return [...this.agents.values()].filter(a => a.status === 'active')
  }

  remove(id: string): void {
    this.agents.delete(id)
  }

  // Mark idle agents (no activity for 5 minutes)
  markIdle() {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    for (const agent of this.agents.values()) {
      if (agent.status === 'active' && new Date(agent.lastActivity).getTime() < fiveMinutesAgo) {
        agent.status = 'idle'
      }
    }
  }
}

export const agentRegistry = new AgentRegistry()

// ─── Write Path with Concurrency Control ────────────────────────────

export interface WriteResult {
  success: boolean
  itemId?: string
  version?: VersionVector
  conflict?: Conflict
  lock?: LockEntry
  error?: string
}

export function attemptWrite(
  boardId: string,
  agentId: string,
  agentName: string,
  operation: Operation['type'],
  itemId: string | undefined,
  data: any,
  currentVersion: VersionVector
): WriteResult {
  // Try to acquire lock if updating existing item
  if (itemId && operation !== 'add') {
    const lock = lockManager.acquire(itemId, agentId, agentName, operation)
    if (!lock) {
      const existingLock = lockManager.getLock(itemId)
      return {
        success: false,
        lock: existingLock || undefined,
        error: `Item locked by ${existingLock?.agentName || 'unknown agent'}`,
      }
    }
  }

  // Create operation
  const op: Operation = {
    id: uuid(),
    agentId,
    agentName,
    type: operation,
    targetId: itemId,
    data,
    timestamp: new Date().toISOString(),
    version: incrementVersion(currentVersion, agentId),
  }

  // Check for conflicts with recent operations
  const recentOps = operationLog.getRecent(20)
  for (const recentOp of recentOps) {
    if (recentOp.agentId === agentId) continue

    const conflict = conflictResolver.detectConflict(op, recentOp)
    if (conflict) {
      // Try auto-resolve
      const resolution = conflictResolver.autoResolve(conflict)
      if (resolution) {
        conflictResolver.resolve(conflict.id, resolution, 'auto')
        op.conflictsWith = [recentOp.id]
      } else {
        // Manual resolution needed
        return {
          success: false,
          conflict,
          error: `Conflict with operation from ${recentOp.agentName}`,
        }
      }
    }
  }

  // Log the operation
  operationLog.log(op)

  // Update agent stats
  agentRegistry.update(agentId, {
    operationsCount: (agentRegistry.get(agentId)?.operationsCount || 0) + 1,
  })

  return {
    success: true,
    itemId,
    version: op.version,
  }
}