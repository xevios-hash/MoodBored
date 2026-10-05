import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import { repositionItem, agentDiagnostics } from '@/lib/api'
import { showToast } from '@/lib/toasts'
import type {
  Project,
  Viewport,
  BoardItem,
  Settings,
  ChatMessage,
  AgentAction,
  Position,
  ComponentDef,
  PortConnection,
  ContainerItem,
  LayoutMode,
  WebItem,
  CardType,
  TypedConnection,
  ConnectionType,
  SnapshotMeta,
  WorkspaceMeta,
  BrowserHistory,
  Annotation,
  AnnotationTool,
} from '@/types'

interface CanvasState {
  panX: number
  panY: number
  zoom: number
}

interface AppState {
  // Project
  project: Project
  activeViewportId: string

  // UI
  chatOpen: boolean
  settingsOpen: boolean
  inspectorOpen: boolean
  searchOpen: boolean
  sidebarOpen: boolean
  searchQuery: string
  searchTag: string

  // Canvas
  canvas: CanvasState
  selectedIds: Set<string>
  expandedItemId: string | null
  hoveredPortId: string | null
  connectingFrom: { itemId: string; portId: string } | null
  setExpandedItem: (id: string | null) => void

  // Browser / Spatial Tabs
  focusedWebNodeId: string | null
  webNodes: Map<string, WebItem>
  focusWebNode: (id: string | null) => void
  navigateWebNode: (id: string, url: string) => void
  webNodeGoBack: (id: string) => void
  webNodeGoForward: (id: string) => void
  webNodeReload: (id: string) => void
  closeWebNode: (id: string) => void
  updateWebNode: (id: string, updates: Partial<WebItem>) => void

  // Education / Lesson Mode
  lessonMode: boolean
  currentLesson: any | null // Lesson type
  lessonSlideIndex: number
  enterLessonMode: (lesson: any) => void
  exitLessonMode: () => void
  setLessonSlide: (index: number) => void

  // Typed Connections
  typedConnections: TypedConnection[]
  addTypedConnection: (conn: TypedConnection) => void
  removeTypedConnection: (fromId: string, toId: string) => void
  updateTypedConnection: (fromId: string, toId: string, updates: Partial<TypedConnection>) => void

  // Snapshots
  snapshots: SnapshotMeta[]
  loadSnapshots: () => Promise<void>
  createSnapshot: (name: string, description?: string) => Promise<void>
  restoreSnapshot: (id: string) => Promise<void>
  deleteSnapshot: (id: string) => Promise<void>
  forkSnapshot: (id: string, name?: string) => Promise<void>

  // Workspaces
  workspaces: WorkspaceMeta[]
  loadWorkspaces: () => Promise<void>
  saveWorkspace: (name: string, description?: string) => Promise<void>
  restoreWorkspace: (id: string) => Promise<void>
  deleteWorkspace: (id: string) => Promise<void>
  togglePinWorkspace: (id: string) => Promise<void>

  // Annotations
  annotations: Annotation[]
  activeAnnotationTool: AnnotationTool
  selectedAnnotationId: string | null
  setAnnotationTool: (tool: AnnotationTool) => void
  addAnnotation: (annotation: Annotation) => void
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void
  removeAnnotation: (id: string) => void
  selectAnnotation: (id: string | null) => void

  // History (undo/redo)
  history: Project[]
  historyIndex: number
  pushHistory: () => void
  undo: () => void
  redo: () => void

  // Clipboard
  clipboard: BoardItem[]
  copySelected: () => void
  paste: (offset?: Position) => void

  // Chat
  messages: ChatMessage[]
  isStreaming: boolean

  // Actions - Project
  setProject: (p: Project) => void
  updateProjectName: (name: string) => void
  addViewport: () => void
  removeViewport: (id: string) => void
  setActiveViewport: (id: string) => void
  renameViewport: (id: string, name: string) => void

  // Actions - Items
  addItem: (item: BoardItem) => void
  removeItem: (id: string) => void
  removeItems: (ids: string[]) => void
  updateItem: (id: string, updates: Record<string, any>) => void
  updateItemNoHistory: (id: string, updates: Record<string, any>) => void
  moveItem: (id: string, pos: Position) => void

  // Actions - Organization
  arrangeGrid: (cols: number, gap: number) => void
  arrangeStack: (direction: 'h' | 'v', gap: number) => void
  arrangeSpiral: (gap: number) => void
  sortByProperty: (property: string, direction: 'asc' | 'desc') => void
  groupSelected: (label: string) => void
  toggleContainer: (id: string) => void
  autoOrganize: () => void

  // Actions - Containers
  addItemToContainer: (containerId: string, item: BoardItem) => void
  removeItemFromContainer: (containerId: string, itemId: string) => void

  // Actions - Connections
  addConnection: (conn: PortConnection) => void
  removeConnection: (fromItemId: string, fromPortId: string, toItemId: string, toPortId: string) => void
  startConnect: (itemId: string, portId: string) => void
  endConnect: () => void

  // Actions - Components
  saveAsComponent: (name: string, description: string, itemIds: string[]) => void
  removeComponent: (id: string) => void
  instantiateComponent: (componentId: string, pos: Position) => void

  // Actions - Canvas
  setPan: (x: number, y: number) => void
  setZoom: (zoom: number) => void
  zoomAt: (cx: number, cy: number, delta: number) => void

  // Actions - Selection
  selectItem: (id: string) => void
  toggleSelect: (id: string) => void
  clearSelection: () => void
  selectAll: () => void

  // Actions - UI
  toggleChat: () => void
  toggleSettings: () => void
  toggleInspector: () => void
  toggleSearch: () => void
  toggleSidebar: () => void
  setSearchQuery: (q: string) => void
  setSearchTag: (t: string) => void

  // Actions - Chat
  addMessage: (msg: ChatMessage) => void
  clearMessages: () => void
  setStreaming: (v: boolean) => void

  // Actions - Settings
  updateSettings: (s: Partial<Settings>) => void

  // Actions - Agent
  executeActions: (actions: AgentAction[]) => void

  // Actions - Import/Export
  exportProject: () => string
  exportProjectSummary: () => string
  exportForAI: () => Promise<void>
  importProject: (json: string) => boolean
  importChromeTabs: (tabs: { title: string; url: string; favIconUrl?: string; pinned: boolean }[]) => void

  // Actions - Blank Card
  createBlankCard: (pos: Position) => string
  morphCard: (id: string, cardType: CardType, data?: Record<string, any>) => void
}

const defaultViewport: Viewport = {
  id: uuid(),
  name: 'Main Board',
  items: [],
  connections: [],
  typedConnections: [],
  messages: [],
  camX: 0,
  camY: 0,
  zoom: 1,
}

const defaultProject: Project = {
  id: uuid(),
  name: 'Untitled Project',
  viewports: [defaultViewport],
  components: [],
  snapshots: [],
  annotations: [],
  settings: {
    apiKey: '',
    defaultModel: 'anthropic/claude-sonnet-4',
    jevThreshold: 0.2,
    multiAgent: false,
    theme: 'light',
    canvasBg: '#e0f2fe',
    canvasBgType: 'color',
    canvasBgVideo: '',
    customBgUrls: [],
    customBgLabels: {},
  },
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
  project: defaultProject,
  activeViewportId: defaultViewport.id,

  chatOpen: false,
  settingsOpen: false,
  inspectorOpen: false,
  searchOpen: false,
  sidebarOpen: false,
  searchQuery: '',
  searchTag: '',

  canvas: { panX: 0, panY: 0, zoom: 1 },
  selectedIds: new Set<string>(),
  expandedItemId: null,
  hoveredPortId: null,
  connectingFrom: null,

  // History — snapshots are recorded AFTER each mutation,
  // so history[historyIndex] always equals the current project state.
  history: [defaultProject],
  historyIndex: 0,
  clipboard: [],

  messages: [],
  isStreaming: false,

  // Browser / Spatial Tabs
  focusedWebNodeId: null,
  webNodes: new Map<string, WebItem>(),

  // Education / Lesson Mode
  lessonMode: false,
  currentLesson: null,
  lessonSlideIndex: 0,

  // Typed Connections
  typedConnections: [],

  // Snapshots & Workspaces
  snapshots: [],
  workspaces: [],

  // Annotations
  annotations: [],
  activeAnnotationTool: 'select',
  selectedAnnotationId: null,

  // Project
  setProject: (p) => {
    if (!p.viewports || p.viewports.length === 0) {
      p = { ...p, viewports: [{ id: crypto.randomUUID(), name: 'Main Board', items: [], connections: [], typedConnections: [], messages: [], camX: 0, camY: 0, zoom: 1 }] }
    }
    set({ project: p, activeViewportId: p.viewports[0].id, history: [JSON.parse(JSON.stringify(p))], historyIndex: 0 })
  },
  updateProjectName: (name) =>
    set((s) => ({
      project: { ...s.project, name, updated: new Date().toISOString() },
    })),

  addViewport: () => {
    const vp: Viewport = {
      id: uuid(),
      name: `Board ${get().project.viewports.length + 1}`,
      items: [],
      connections: [],
      typedConnections: [],
      messages: [],
      camX: 0,
      camY: 0,
      zoom: 1,
    }
    set((s) => ({
      project: {
        ...s.project,
        viewports: [...s.project.viewports, vp],
        updated: new Date().toISOString(),
      },
      activeViewportId: vp.id,
    }))
    get().pushHistory()
  },

  removeViewport: (id) =>
    set((s) => {
      const vps = s.project.viewports.filter((v) => v.id !== id)
      if (vps.length === 0) return s
      return {
        project: { ...s.project, viewports: vps, updated: new Date().toISOString() },
        activeViewportId: s.activeViewportId === id ? vps[0].id : s.activeViewportId,
      }
    }),

  setActiveViewport: (id) => set({ activeViewportId: id }),

  renameViewport: (id, name) =>
    set((s) => ({
      project: {
        ...s.project,
        viewports: s.project.viewports.map((v) => (v.id === id ? { ...v, name } : v)),
        updated: new Date().toISOString(),
      },
    })),

  // Items
  addItem: (item) => {
    set((s) => {
      const vpItems = s.project.viewports.find((v) => v.id === s.activeViewportId)?.items ?? []
      const repositioned = item.kind === 'connector' ? item : repositionItem(item, vpItems)
      return {
        project: {
          ...s.project,
          viewports: s.project.viewports.map((v) =>
            v.id === s.activeViewportId ? { ...v, items: [...v.items, repositioned] } : v
          ),
          updated: new Date().toISOString(),
        },
      }
    })
    get().pushHistory()
  },

  removeItem: (id) => {
    set((s) => ({
      project: {
        ...s.project,
        viewports: s.project.viewports.map((v) => ({
          ...v,
          items: v.items.filter((i) => i.id !== id),
          connections: v.connections.filter(
            (c) => c.fromItemId !== id && c.toItemId !== id
          ),
          typedConnections: (v.typedConnections || []).filter(
            (c) => c.fromItemId !== id && c.toItemId !== id
          ),
        })),
        updated: new Date().toISOString(),
      },
      selectedIds: new Set([...s.selectedIds].filter((i) => i !== id)),
    }))
    get().pushHistory()
  },

  removeItems: (ids) => {
    if (ids.length === 0) return
    set((s) => {
      const idSet = new Set(ids)
      return {
        project: {
          ...s.project,
          viewports: s.project.viewports.map((v) => ({
            ...v,
            items: v.items.filter((i) => !idSet.has(i.id)),
            connections: v.connections.filter(
              (c) => !idSet.has(c.fromItemId) && !idSet.has(c.toItemId)
            ),
            typedConnections: (v.typedConnections || []).filter(
              (c) => !idSet.has(c.fromItemId) && !idSet.has(c.toItemId)
            ),
          })),
          updated: new Date().toISOString(),
        },
        selectedIds: new Set(),
      }
    })
    get().pushHistory()
  },

  updateItem: (id, updates) => {
    set((s) => ({
      project: {
        ...s.project,
        viewports: s.project.viewports.map((v) => ({
          ...v,
          items: v.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
        })),
        updated: new Date().toISOString(),
      },
    }))
    get().pushHistory()
  },

  updateItemNoHistory: (id, updates) =>
    set((s) => ({
      project: {
        ...s.project,
        viewports: s.project.viewports.map((v) => ({
          ...v,
          items: v.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
        })),
        updated: new Date().toISOString(),
      },
    })),

  moveItem: (id, pos) => {
    // Don't push history for every move - only on drag start
    set((s) => ({
      project: {
        ...s.project,
        viewports: s.project.viewports.map((v) => ({
          ...v,
          items: v.items.map((i) => (i.id === id ? { ...i, pos } : i)),
        })),
      },
    }))
  },

  // Organization
  arrangeGrid: (cols, gap) => {
    set((s) => ({
      project: {
        ...s.project,
        viewports: s.project.viewports.map((v) => {
          if (v.id !== s.activeViewportId) return v
          const positioned = v.items.filter(i => i.kind !== 'connector' && 'pos' in i)
          const others = v.items.filter(i => i.kind === 'connector' || !('pos' in i))
          const cellW = 300
          const cellH = 200
          const arranged = positioned.map((item: any, idx) => ({
            ...item,
            pos: {
              x: 50 + (idx % cols) * (cellW + gap),
              y: 50 + Math.floor(idx / cols) * (cellH + gap),
            },
          }))
          return { ...v, items: [...arranged, ...others] }
        }),
        updated: new Date().toISOString(),
      },
    }))
    get().pushHistory()
  },

  arrangeStack: (direction, gap) => {
    set((s) => ({
      project: {
        ...s.project,
        viewports: s.project.viewports.map((v) => {
          if (v.id !== s.activeViewportId) return v
          const positioned = v.items.filter(i => i.kind !== 'connector' && 'pos' in i)
          const others = v.items.filter(i => i.kind === 'connector' || !('pos' in i))
          let offset = 50
          const arranged = positioned.map((item: any) => {
            const w = item.size?.w ?? 250
            const h = item.size?.h ?? 150
            const pos = direction === 'h'
              ? { x: offset, y: 50 }
              : { x: 50, y: offset }
            offset += (direction === 'h' ? w : h) + gap
            return { ...item, pos }
          })
          return { ...v, items: [...arranged, ...others] }
        }),
        updated: new Date().toISOString(),
      },
    }))
    get().pushHistory()
  },

  arrangeSpiral: (gap) => {
    set((s) => ({
      project: {
        ...s.project,
        viewports: s.project.viewports.map((v) => {
          if (v.id !== s.activeViewportId) return v
          const positioned = v.items.filter(i => i.kind !== 'connector' && 'pos' in i)
          const others = v.items.filter(i => i.kind === 'connector' || !('pos' in i))
          const arranged = positioned.map((item: any, idx) => {
            const angle = idx * 0.8
            const radius = 150 + idx * gap * 0.3
            return {
              ...item,
              pos: {
                x: 400 + Math.cos(angle) * radius,
                y: 300 + Math.sin(angle) * radius,
              },
            }
          })
          return { ...v, items: [...arranged, ...others] }
        }),
        updated: new Date().toISOString(),
      },
    }))
    get().pushHistory()
  },

  sortByProperty: (property, direction) => {
    set((s) => ({
      project: {
        ...s.project,
        viewports: s.project.viewports.map((v) => {
          if (v.id !== s.activeViewportId) return v
          const positioned = v.items.filter(i => i.kind !== 'connector' && 'pos' in i)
          const others = v.items.filter(i => i.kind === 'connector' || !('pos' in i))
          const sorted = [...positioned].sort((a: any, b: any) => {
            const va = a[property] ?? ''
            const vb = b[property] ?? ''
            const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb
            return direction === 'asc' ? cmp : -cmp
          })
          let offset = 50
          const arranged = sorted.map((item: any) => {
            const pos = { x: offset, y: 50 }
            offset += (item.size?.w ?? 250) + 20
            return { ...item, pos }
          })
          return { ...v, items: [...arranged, ...others] }
        }),
        updated: new Date().toISOString(),
      },
    }))
    get().pushHistory()
  },

  groupSelected: (label) =>
    set((s) => {
      const vp = s.project.viewports.find(v => v.id === s.activeViewportId)
      if (!vp) return s
      const selected = vp.items.filter(i => s.selectedIds.has(i.id) && i.kind !== 'connector' && 'pos' in i)
      if (selected.length < 2) return s

      const minX = Math.min(...selected.map((i: any) => i.pos.x))
      const minY = Math.min(...selected.map((i: any) => i.pos.y))
      const maxX = Math.max(...selected.map((i: any) => i.pos.x + (i.size?.w ?? 250)))
      const maxY = Math.max(...selected.map((i: any) => i.pos.y + (i.size?.h ?? 150)))

      const container = {
        kind: 'container' as const,
        id: crypto.randomUUID(),
        label,
        children: selected.map((i: any) => ({ ...i, pos: { x: i.pos.x - minX, y: i.pos.y - minY } })),
        layout: 'free' as const,
        gap: 8,
        collapsed: false,
        purpose: 'Grouped items',
        importance: 'User-created group',
        tags: ['group'],
        pos: { x: minX, y: minY },
        size: { w: maxX - minX + 40, h: maxY - minY + 60 },
      }

      const remaining = vp.items.filter(i => !s.selectedIds.has(i.id))
      return {
        project: {
          ...s.project,
          viewports: s.project.viewports.map(v =>
            v.id === s.activeViewportId
              ? { ...v, items: [...remaining, container] }
              : v
          ),
          updated: new Date().toISOString(),
        },
        selectedIds: new Set([container.id]),
      }
    }),

  toggleContainer: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        viewports: s.project.viewports.map((v) => ({
          ...v,
          items: v.items.map((i) =>
            i.id === id && i.kind === 'container'
              ? { ...i, collapsed: !(i as any).collapsed }
              : i
          ),
        })),
        updated: new Date().toISOString(),
      },
    })),

  autoOrganize: () => {
    const state = get()
    const vp = state.project.viewports.find(v => v.id === state.activeViewportId)
    if (!vp) return

    // Group items by kind
    const byKind = new Map<string, BoardItem[]>()
    for (const item of vp.items) {
      if (item.kind === 'connector') continue
      const list = byKind.get(item.kind) || []
      list.push(item)
      byKind.set(item.kind, list)
    }

    // Create containers for each kind with 3+ items
    const newItems: BoardItem[] = []
    const processed = new Set<string>()

    for (const [kind, items] of byKind) {
      if (items.length >= 3) {
        const minX = Math.min(...items.map((i: any) => i.pos?.x ?? 0))
        const minY = Math.min(...items.map((i: any) => i.pos?.y ?? 0))
        const maxX = Math.max(...items.map((i: any) => (i.pos?.x ?? 0) + (i.size?.w ?? 250)))
        const maxY = Math.max(...items.map((i: any) => (i.pos?.y ?? 0) + (i.size?.h ?? 150)))

        const container = {
          kind: 'container' as const,
          id: crypto.randomUUID(),
          label: `${kind.charAt(0).toUpperCase() + kind.slice(1)}s`,
          children: items.map((i: any) => ({ ...i, pos: { x: i.pos.x - minX, y: i.pos.y - minY } })),
          layout: 'free' as const,
          gap: 8,
          collapsed: false,
          purpose: `Auto-organized ${kind} items`,
          importance: 'Auto-generated group',
          tags: ['auto-organized', kind],
          pos: { x: minX, y: minY },
          size: { w: maxX - minX + 40, h: maxY - minY + 60 },
        }
        newItems.push(container)
        for (const item of items) processed.add(item.id)
      } else {
        for (const item of items) newItems.push(item)
      }
    }

    // Add unprocessed items (connectors)
    for (const item of vp.items) {
      if (!processed.has(item.id)) newItems.push(item)
    }

    set((s) => ({
      project: {
        ...s.project,
        viewports: s.project.viewports.map(v =>
          v.id === s.activeViewportId ? { ...v, items: newItems } : v
        ),
        updated: new Date().toISOString(),
      },
    }))
    state.pushHistory()
  },

  // Clipboard — snapshots are recorded AFTER each mutation,
  // so history[historyIndex] always equals the current project state.
  // Push history BEFORE mutation to save pre-mutation state
  pushHistory: () =>
    set((s) => {
      const newHistory = s.history.slice(0, s.historyIndex + 1)
      newHistory.push(JSON.parse(JSON.stringify(s.project)))
      if (newHistory.length > 50) newHistory.shift()
      return { history: newHistory, historyIndex: newHistory.length - 1 }
    }),

  undo: () =>
    set((s) => {
      if (s.historyIndex <= 0) return s
      const newIndex = s.historyIndex - 1
      return {
        project: JSON.parse(JSON.stringify(s.history[newIndex])),
        historyIndex: newIndex,
        selectedIds: new Set(),
      }
    }),

  redo: () =>
    set((s) => {
      if (s.historyIndex >= s.history.length - 1) return s
      const newIndex = s.historyIndex + 1
      return {
        project: JSON.parse(JSON.stringify(s.history[newIndex])),
        historyIndex: newIndex,
        selectedIds: new Set(),
      }
    }),

  copySelected: () =>
    set((s) => {
      const vp = s.project.viewports.find(v => v.id === s.activeViewportId)
      if (!vp) return s
      const items = vp.items.filter(i => s.selectedIds.has(i.id) && i.kind !== 'connector')
      return { clipboard: JSON.parse(JSON.stringify(items)) }
    }),

  paste: (offset) => {
    set((s) => {
      if (s.clipboard.length === 0) return s
      const vp = s.project.viewports.find(v => v.id === s.activeViewportId)
      if (!vp) return s
      const dx = offset?.x ?? 30
      const dy = offset?.y ?? 30
      const newItems = s.clipboard.map((item: any) => {
        const newId = crypto.randomUUID()
        if ('pos' in item) {
          return { ...item, id: newId, pos: { x: item.pos.x + dx, y: item.pos.y + dy } }
        }
        return { ...item, id: newId }
      })
      const newSelectedIds = new Set(newItems.map((i: any) => i.id))
      return {
        project: {
          ...s.project,
          viewports: s.project.viewports.map(v =>
            v.id === s.activeViewportId
              ? { ...v, items: [...v.items, ...newItems] }
              : v
          ),
          updated: new Date().toISOString(),
        },
        selectedIds: newSelectedIds,
      }
    })
    get().pushHistory()
  },

  // Containers
  addItemToContainer: (containerId, item) =>
    set((s) => ({
      project: {
        ...s.project,
        viewports: s.project.viewports.map((v) => ({
          ...v,
          items: v.items.map((i) => {
            if (i.id === containerId && i.kind === 'container') {
              return { ...i, children: [...i.children, { ...item, parentId: containerId }] }
            }
            return i
          }),
        })),
        updated: new Date().toISOString(),
      },
    })),

  removeItemFromContainer: (containerId, itemId) =>
    set((s) => ({
      project: {
        ...s.project,
        viewports: s.project.viewports.map((v) => ({
          ...v,
          items: v.items.map((i) => {
            if (i.id === containerId && i.kind === 'container') {
              return { ...i, children: i.children.filter((c) => c.id !== itemId) }
            }
            return i
          }),
        })),
        updated: new Date().toISOString(),
      },
    })),

  // Connections — pushes history
  addConnection: (conn) => {
    set((s) => ({
      project: {
        ...s.project,
        viewports: s.project.viewports.map((v) =>
          v.id === s.activeViewportId ? { ...v, connections: [...v.connections, conn] } : v
        ),
        updated: new Date().toISOString(),
      },
    }))
    get().pushHistory()
  },

  removeConnection: (fromItemId, fromPortId, toItemId, toPortId) =>
    set((s) => ({
      project: {
        ...s.project,
        viewports: s.project.viewports.map((v) => ({
          ...v,
          connections: v.connections.filter(
            (c) =>
              !(
                c.fromItemId === fromItemId &&
                c.fromPortId === fromPortId &&
                c.toItemId === toItemId &&
                c.toPortId === toPortId
              )
          ),
        })),
        updated: new Date().toISOString(),
      },
    })),

  startConnect: (itemId, portId) => set({ connectingFrom: { itemId, portId } }),
  endConnect: () => set({ connectingFrom: null }),
  setExpandedItem: (id) => set({ expandedItemId: id }),

  // Components
  saveAsComponent: (name, description, itemIds) =>
    set((s) => {
      const vp = s.project.viewports.find((v) => v.id === s.activeViewportId)
      if (!vp) return s
      const items = vp.items.filter((i) => itemIds.includes(i.id))
      const connections = vp.connections.filter(
        (c) => itemIds.includes(c.fromItemId) && itemIds.includes(c.toItemId)
      )
      // Normalize positions relative to top-left
      const minX = Math.min(...items.filter((i) => 'pos' in i).map((i: any) => i.pos.x))
      const minY = Math.min(...items.filter((i) => 'pos' in i).map((i: any) => i.pos.y))
      const normalizedItems = items.map((i: any) => {
        if ('pos' in i) {
          return { ...i, pos: { x: i.pos.x - minX, y: i.pos.y - minY }, id: uuid() }
        }
        return { ...i, id: uuid() }
      }) as BoardItem[]

      const comp: ComponentDef = {
        id: uuid(),
        name,
        description,
        items: normalizedItems,
        connections,
        tags: [],
        created: new Date().toISOString(),
      }
      return {
        project: {
          ...s.project,
          components: [...s.project.components, comp],
          updated: new Date().toISOString(),
        },
      }
    }),

  removeComponent: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        components: s.project.components.filter((c) => c.id !== id),
        updated: new Date().toISOString(),
      },
    })),

  instantiateComponent: (componentId, pos) => {
    const state = get()
    const comp = state.project.components.find((c) => c.id === componentId)
    if (!comp) return

    // Create new items with offset positions and new IDs
    const idMap = new Map<string, string>()
    const newItems: BoardItem[] = comp.items.map((item: any) => {
      const newId = uuid()
      idMap.set(item.id, newId)
      if ('pos' in item) {
        return { ...item, id: newId, pos: { x: pos.x + item.pos.x, y: pos.y + item.pos.y } }
      }
      return { ...item, id: newId }
    })

    // Remap connections
    const newConnections: PortConnection[] = comp.connections.map((c) => ({
      fromItemId: idMap.get(c.fromItemId) || c.fromItemId,
      fromPortId: c.fromPortId,
      toItemId: idMap.get(c.toItemId) || c.toItemId,
      toPortId: c.toPortId,
    }))

    set((s) => ({
      project: {
        ...s.project,
        viewports: s.project.viewports.map((v) =>
          v.id === s.activeViewportId
            ? { ...v, items: [...v.items, ...newItems], connections: [...v.connections, ...newConnections] }
            : v
        ),
        updated: new Date().toISOString(),
      },
    }))
    state.pushHistory()
  },

  // Canvas
  setPan: (x, y) => set((s) => ({ canvas: { ...s.canvas, panX: x, panY: y } })),
  setZoom: (zoom) => set((s) => ({ canvas: { ...s.canvas, zoom: Math.max(0.1, Math.min(5, zoom)) } })),
  zoomAt: (cx, cy, delta) =>
    set((s) => {
      const factor = delta > 0 ? 0.9 : 1.1
      const newZoom = Math.max(0.1, Math.min(5, s.canvas.zoom * factor))
      const scale = newZoom / s.canvas.zoom
      return {
        canvas: {
          zoom: newZoom,
          panX: cx - (cx - s.canvas.panX) * scale,
          panY: cy - (cy - s.canvas.panY) * scale,
        },
      }
    }),

  // Selection
  selectItem: (id) => set({ selectedIds: new Set([id]) }),
  toggleSelect: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedIds: next }
    }),
  clearSelection: () => set({ selectedIds: new Set() }),
  selectAll: () =>
    set((s) => {
      const vp = s.project.viewports.find((v) => v.id === s.activeViewportId)
      return { selectedIds: new Set(vp?.items.map((i) => i.id) ?? []) }
    }),

  // UI
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  toggleSearch: () => set((s) => ({ searchOpen: !s.searchOpen })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchTag: (t) => set({ searchTag: t }),

  // Chat (kept for compatibility; ChatPanel writes messages per viewport)
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  clearMessages: () => set({ messages: [] }),
  setStreaming: (v) => set({ isStreaming: v }),

  // Browser / Spatial Tab Actions
  focusWebNode: (id) => set({ focusedWebNodeId: id }),

  // Education / Lesson Mode Actions
  enterLessonMode: (lesson) => set({ lessonMode: true, currentLesson: lesson, lessonSlideIndex: 0 }),
  exitLessonMode: () => set({ lessonMode: false, currentLesson: null, lessonSlideIndex: 0 }),
  setLessonSlide: (index) => set({ lessonSlideIndex: index }),

  navigateWebNode: (id, url) =>
    set((s) => {
      const vp = s.project.viewports.find(v => v.id === s.activeViewportId)
      if (!vp) return s
      const item = vp.items.find(i => i.id === id && i.kind === 'web')
      if (!item || item.kind !== 'web') return s
      const webItem = item as WebItem
      const newUrls = webItem.history.urls.slice(0, webItem.history.index + 1)
      newUrls.push(url)
      const newHistory: BrowserHistory = { urls: newUrls, index: newUrls.length - 1 }
      return {
        project: {
          ...s.project,
          viewports: s.project.viewports.map(v => ({
            ...v,
            items: v.items.map(i =>
              i.id === id ? { ...i, url, history: newHistory, isLoading: true } : i
            ),
          })),
          updated: new Date().toISOString(),
        },
      }
    }),

  webNodeGoBack: (id) =>
    set((s) => {
      const vp = s.project.viewports.find(v => v.id === s.activeViewportId)
      if (!vp) return s
      const item = vp.items.find(i => i.id === id && i.kind === 'web') as WebItem | undefined
      if (!item || item.history.index <= 0) return s
      const newIndex = item.history.index - 1
      const newUrl = item.history.urls[newIndex]
      return {
        project: {
          ...s.project,
          viewports: s.project.viewports.map(v => ({
            ...v,
            items: v.items.map(i =>
              i.id === id ? { ...i, url: newUrl, history: { ...item.history, index: newIndex }, isLoading: true } : i
            ),
          })),
          updated: new Date().toISOString(),
        },
      }
    }),

  webNodeGoForward: (id) =>
    set((s) => {
      const vp = s.project.viewports.find(v => v.id === s.activeViewportId)
      if (!vp) return s
      const item = vp.items.find(i => i.id === id && i.kind === 'web') as WebItem | undefined
      if (!item || item.history.index >= item.history.urls.length - 1) return s
      const newIndex = item.history.index + 1
      const newUrl = item.history.urls[newIndex]
      return {
        project: {
          ...s.project,
          viewports: s.project.viewports.map(v => ({
            ...v,
            items: v.items.map(i =>
              i.id === id ? { ...i, url: newUrl, history: { ...item.history, index: newIndex }, isLoading: true } : i
            ),
          })),
          updated: new Date().toISOString(),
        },
      }
    }),

  webNodeReload: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        viewports: s.project.viewports.map(v => ({
          ...v,
          items: v.items.map(i =>
            i.id === id && i.kind === 'web' ? { ...i, isLoading: true } : i
          ),
        })),
      },
    })),

  closeWebNode: (id) =>
    set((s) => ({
      focusedWebNodeId: s.focusedWebNodeId === id ? null : s.focusedWebNodeId,
      project: {
        ...s.project,
        viewports: s.project.viewports.map(v => ({
          ...v,
          items: v.items.filter(i => i.id !== id),
        })),
        updated: new Date().toISOString(),
      },
    })),

  updateWebNode: (id, updates) =>
    set((s) => ({
      project: {
        ...s.project,
        viewports: s.project.viewports.map(v => ({
          ...v,
          items: v.items.map(i =>
            i.id === id && i.kind === 'web' ? { ...i, ...updates } : i
          ),
        })),
        updated: new Date().toISOString(),
      },
    })),

  // Typed Connection Actions
  addTypedConnection: (conn) => {
    set((s) => ({
      project: {
        ...s.project,
        viewports: s.project.viewports.map(v =>
          v.id === s.activeViewportId
            ? { ...v, typedConnections: [...(v.typedConnections || []), conn] }
            : v
        ),
        updated: new Date().toISOString(),
      },
    }))
    get().pushHistory()
  },

  removeTypedConnection: (fromId, toId) =>
    set((s) => ({
      project: {
        ...s.project,
        viewports: s.project.viewports.map(v => ({
          ...v,
          typedConnections: (v.typedConnections || []).filter(
            c => !(c.fromItemId === fromId && c.toItemId === toId)
          ),
        })),
        updated: new Date().toISOString(),
      },
    })),

  updateTypedConnection: (fromId, toId, updates) =>
    set((s) => ({
      project: {
        ...s.project,
        viewports: s.project.viewports.map(v => ({
          ...v,
          typedConnections: (v.typedConnections || []).map(c =>
            c.fromItemId === fromId && c.toItemId === toId ? { ...c, ...updates } : c
          ),
        })),
        updated: new Date().toISOString(),
      },
    })),

  // Snapshot Actions
  loadSnapshots: async () => {
    try {
      const { listSnapshots } = await import('@/lib/snapshot')
      const snapshots = await listSnapshots()
      set({ snapshots })
    } catch (e) {
      console.warn('[MoodBored] loadSnapshots failed:', e)
    }
  },

  createSnapshot: async (name, description = '') => {
    try {
      const { createSnapshot: create } = await import('@/lib/snapshot')
      const state = get()
      await create(state.project, name, description)
      await state.loadSnapshots()
      showToast(`Snapshot "${name}" created`, 'success')
    } catch (e) {
      console.warn('[MoodBored] createSnapshot failed:', e)
      showToast('Failed to create snapshot', 'error')
    }
  },

  restoreSnapshot: async (id) => {
    try {
      const { restoreSnapshot: restore } = await import('@/lib/snapshot')
      const project = await restore(id)
      if (project) {
        get().setProject(project)
        showToast('Snapshot restored', 'success')
      }
    } catch (e) {
      console.warn('[MoodBored] restoreSnapshot failed:', e)
      showToast('Failed to restore snapshot', 'error')
    }
  },

  deleteSnapshot: async (id) => {
    try {
      const { deleteSnapshot: del } = await import('@/lib/snapshot')
      await del(id)
      await get().loadSnapshots()
      showToast('Snapshot deleted', 'success')
    } catch (e) {
      console.warn('[MoodBored] deleteSnapshot failed:', e)
    }
  },

  forkSnapshot: async (id, name) => {
    try {
      const { forkFromSnapshot } = await import('@/lib/snapshot')
      const project = await forkFromSnapshot(id, name)
      if (project) {
        get().setProject(project)
        showToast('Board forked from snapshot', 'success')
      }
    } catch (e) {
      console.warn('[MoodBored] forkSnapshot failed:', e)
      showToast('Failed to fork snapshot', 'error')
    }
  },

  // Workspace Actions
  loadWorkspaces: async () => {
    try {
      const { listWorkspaces } = await import('@/lib/workspace')
      const workspaces = await listWorkspaces()
      set({ workspaces })
    } catch (e) {
      console.warn('[MoodBored] loadWorkspaces failed:', e)
    }
  },

  saveWorkspace: async (name, description = '') => {
    try {
      const { saveWorkspace: save } = await import('@/lib/workspace')
      const state = get()
      await save(state.project, name, description)
      await state.loadWorkspaces()
      showToast(`Workspace "${name}" saved`, 'success')
    } catch (e) {
      console.warn('[MoodBored] saveWorkspace failed:', e)
      showToast('Failed to save workspace', 'error')
    }
  },

  restoreWorkspace: async (id) => {
    try {
      const { restoreWorkspace: restore } = await import('@/lib/workspace')
      const project = await restore(id)
      if (project) {
        get().setProject(project)
        showToast('Workspace restored', 'success')
      }
    } catch (e) {
      console.warn('[MoodBored] restoreWorkspace failed:', e)
      showToast('Failed to restore workspace', 'error')
    }
  },

  deleteWorkspace: async (id) => {
    try {
      const { deleteWorkspace: del } = await import('@/lib/workspace')
      await del(id)
      await get().loadWorkspaces()
      showToast('Workspace deleted', 'success')
    } catch (e) {
      console.warn('[MoodBored] deleteWorkspace failed:', e)
    }
  },

  togglePinWorkspace: async (id) => {
    try {
      const { togglePin } = await import('@/lib/workspace')
      await togglePin(id)
      await get().loadWorkspaces()
    } catch (e) {
      console.warn('[MoodBored] togglePinWorkspace failed:', e)
    }
  },

  // Annotation Actions
  setAnnotationTool: (tool) => set({ activeAnnotationTool: tool, selectedAnnotationId: null }),

  addAnnotation: (annotation) => {
    get().pushHistory()
    set((s) => ({
      project: {
        ...s.project,
        annotations: [...(s.project.annotations || []), annotation],
        updated: new Date().toISOString(),
      },
    }))
  },

  updateAnnotation: (id, updates) =>
    set((s) => ({
      project: {
        ...s.project,
        annotations: (s.project.annotations || []).map(a => a.id === id ? { ...a, ...updates } as Annotation : a),
        updated: new Date().toISOString(),
      },
    })),

  removeAnnotation: (id) => {
    get().pushHistory()
    set((s) => ({
      project: {
        ...s.project,
        annotations: (s.project.annotations || []).filter(a => a.id !== id),
        updated: new Date().toISOString(),
      },
      selectedAnnotationId: s.selectedAnnotationId === id ? null : s.selectedAnnotationId,
    }))
  },

  selectAnnotation: (id) => set({ selectedAnnotationId: id }),

  // Settings
  updateSettings: (updates) =>
    set((s) => {
      const newSettings = { ...s.project.settings, ...updates }

      // Auto-switch canvas background when theme changes
      if (updates.theme && updates.theme !== s.project.settings.theme) {
        if (updates.theme === 'light' && s.project.settings.canvasBg.startsWith('#0')) {
          newSettings.canvasBg = '#e0f2fe'
        } else if (updates.theme === 'dark' && s.project.settings.canvasBg.startsWith('#e')) {
          newSettings.canvasBg = '#0a1628'
        }
      }

      return {
        project: {
          ...s.project,
          settings: newSettings,
          updated: new Date().toISOString(),
        },
      }
    }),

  // Agent
  executeActions: (actions) => {
    const { addItem, removeItem, updateItem, addConnection, addTypedConnection, navigateWebNode } = get()
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'add_item':
            if (action.item) addItem(action.item)
            break
          case 'remove_item':
            if (action.itemId) removeItem(action.itemId)
            break
          case 'update_item':
            if (action.itemId && action.item) updateItem(action.itemId, action.item)
            break
          case 'add_connection':
            if (action.connection) addConnection(action.connection)
            break
          case 'open_url':
            if (action.url) {
              const state = get()
              const cx = -state.canvas.panX / state.canvas.zoom + 400
              const cy = -state.canvas.panY / state.canvas.zoom + 300
              const webItem: WebItem = {
                kind: 'web',
                id: crypto.randomUUID(),
                url: action.url,
                title: action.url,
                favicon: '',
                cardType: 'web',
                isLoading: true,
                isFocused: false,
                history: { urls: [action.url], index: 0 },
                cookies: '',
                purpose: 'Opened by AI',
                importance: 'AI reference',
                tags: ['ai-opened'],
                pos: { x: cx, y: cy },
                size: { w: 640, h: 480 },
              }
              addItem(webItem)
            }
            break
          case 'draw_connection':
            if (action.itemId && action.connection) {
              addTypedConnection({
                ...action.connection,
                connectionType: action.connectionType || 'related',
                label: '',
                owner: 'llm',
                created: new Date().toISOString(),
              })
            }
            break
        }
        agentDiagnostics.actionsExecuted++
      } catch (err) {
        agentDiagnostics.lastError = `${action.type} on ${action.itemId ?? action.item?.id}: ${err instanceof Error ? err.message : err}`
        console.warn('[MoodBored] executeActions failed:', agentDiagnostics.lastError)
      }
    }
  },

  // Export/Import
  exportProject: () => {
    const { project } = get()
    // Strip API key from export
    const exportData = {
      ...project,
      settings: { ...project.settings, apiKey: '' }
    }
    return JSON.stringify(exportData, null, 2)
  },

  importChromeTabs: async (tabs: any[]) => {
    const { tabsToBoardItems } = await import('@/lib/chrome-import')
    const items = tabsToBoardItems(tabs as any)
    set((s) => {
      const vp = s.project.viewports.find(v => v.id === s.activeViewportId)
      if (!vp) return s
      return {
        project: {
          ...s.project,
          viewports: s.project.viewports.map(v =>
            v.id === s.activeViewportId
              ? { ...v, items: [...v.items, ...items] }
              : v
          ),
          updated: new Date().toISOString(),
        },
      }
    })
    get().pushHistory()
    showToast(`Imported ${tabs.length} Chrome tabs`, 'success')
  },

  createBlankCard: (pos) => {
    const id = crypto.randomUUID()
    const webItem: WebItem = {
      kind: 'web',
      id,
      url: '',
      title: '',
      favicon: '',
      cardType: 'blank',
      isLoading: false,
      isFocused: false,
      history: { urls: [], index: -1 },
      cookies: '',
      purpose: '',
      importance: '',
      tags: [],
      pos,
      size: { w: 640, h: 480 },
    }
    get().addItem(webItem)
    return id
  },

  morphCard: (id, cardType, data = {}) => {
    const state = get()
    const vp = state.project.viewports.find(v => v.id === state.activeViewportId)
    const item = vp?.items.find(i => i.id === id)
    if (!item) return

    // If morphing to note, convert to old-style note item
    if (cardType === 'note') {
      const pos = 'pos' in item ? item.pos : { x: 100, y: 100 }
      const noteItem = {
        kind: 'note' as const,
        id: crypto.randomUUID(),
        text: data.content || '',
        purpose: '',
        importance: '',
        tags: [],
        pos,
      }
      // Replace the web item with a note item
      set((s) => ({
        project: {
          ...s.project,
          viewports: s.project.viewports.map(v => ({
            ...v,
            items: v.items.map(i => i.id === id ? noteItem : i),
          })),
          updated: new Date().toISOString(),
        },
      }))
      get().pushHistory()
      return
    }

    // For web/search/image/ai, keep as web item
    set((s) => ({
      project: {
        ...s.project,
        viewports: s.project.viewports.map(v => ({
          ...v,
          items: v.items.map(i => {
            if (i.id !== id || i.kind !== 'web') return i
            const web = i as WebItem
            switch (cardType) {
              case 'web':
                return {
                  ...web,
                  cardType: 'web',
                  url: data.url || web.url,
                  title: data.title || web.title,
                  favicon: data.favicon || web.favicon,
                  isLoading: true,
                  history: { urls: [data.url || web.url], index: 0 },
                }
              case 'search':
                return {
                  ...web,
                  cardType: 'search',
                  searchText: data.searchText || web.searchText || '',
                  url: `https://www.google.com/search?q=${encodeURIComponent(data.searchText || web.searchText || '')}`,
                  isLoading: true,
                  history: { urls: [`https://www.google.com/search?q=${encodeURIComponent(data.searchText || web.searchText || '')}`], index: 0 },
                }
              case 'image':
                return {
                  ...web,
                  cardType: 'image',
                  url: data.url || web.url,
                  title: data.title || 'Image',
                }
              case 'ai':
                return {
                  ...web,
                  cardType: 'ai',
                  content: data.content || web.content || '',
                  title: data.title || 'AI Response',
                }
              default:
                return { ...web, cardType }
            }
          }),
        })),
        updated: new Date().toISOString(),
      },
    }))
    get().pushHistory()
  },

  exportProjectSummary: () => {
    const { project } = get()
    const lines: string[] = [
      `# ${project.name}`,
      '',
      `Created: ${new Date(project.created).toLocaleDateString()}`,
      `Updated: ${new Date(project.updated).toLocaleDateString()}`,
      '',
    ]

    for (const vp of project.viewports) {
      lines.push(`## ${vp.name}`)
      lines.push('')

      const items = vp.items.filter((i) => i.kind !== 'connector')
      for (const item of items) {
        switch (item.kind) {
          case 'note':
            lines.push(`- **Note**: ${item.text}`)
            if (item.purpose) lines.push(`  Purpose: ${item.purpose}`)
            break
          case 'text':
            lines.push(`- **Text**: ${item.raw}`)
            break
          case 'image':
            lines.push(`- **Image**: ${item.description}`)
            if (item.source) lines.push(`  Source: ${item.source}`)
            break
          case 'link':
            lines.push(`- **Link**: ${item.title || item.url}`)
            if (item.summary) lines.push(`  ${item.summary}`)
            break
          case 'video':
            lines.push(`- **Video**: ${item.subjectDesc}`)
            break
          case 'palette':
            lines.push(`- **Palette**: ${item.label} (${item.colors.map(c => c.hex).join(', ')})`)
            break
          case 'gradient':
            lines.push(`- **Gradient**: ${item.label}`)
            break
          case 'font':
            lines.push(`- **Font**: ${item.fontFamily} - "${item.sampleText}"`)
            break
          case 'swatch':
            lines.push(`- **Color**: ${item.hex} ${item.name} - ${item.usage}`)
            break
          case 'sizeguide':
            lines.push(`- **Size**: ${item.label} ${item.width}x${item.height}${item.unit}`)
            break
          case 'container':
            lines.push(`- **Container**: ${item.label} (${item.children.length} items)`)
            break
        }
        if ('tags' in item && item.tags && item.tags.length > 0) {
          lines.push(`  Tags: ${item.tags.join(', ')}`)
        }
        lines.push('')
      }

      const connectors = vp.items.filter((i) => i.kind === 'connector')
      if (connectors.length > 0) {
        lines.push('### Connections')
        for (const conn of connectors) {
          if (conn.kind === 'connector') {
            lines.push(`- ${conn.fromId} → ${conn.toId}: ${conn.label || 'linked'} (${conn.owner})`)
          }
        }
        lines.push('')
      }
    }

    return lines.join('\n')
  },

  exportForAI: async () => {
    const { project } = get()
    const { exportForAI, downloadExportBundle } = await import('@/lib/export')
    const canvasEl = document.querySelector('canvas')
    const bundle = await exportForAI(project, canvasEl)
    downloadExportBundle(bundle, project.name)
  },

  importProject: (json: string) => {
    // Never trust imported JSON — validate shape before it reaches the canvas.
    const isFiniteRecord = (v: any) =>
      v && typeof v === 'object' && !Array.isArray(v) &&
      typeof v.x === 'number' && Number.isFinite(v.x) &&
      typeof v.y === 'number' && Number.isFinite(v.y)
    const validKind = new Set([
      'text', 'image', 'link', 'note', 'video', 'palette', 'gradient',
      'font', 'swatch', 'sizeguide', 'container', 'connector', 'web',
    ])
    try {
      const parsed = JSON.parse(json) as Project
      if (!parsed || !parsed.id || !parsed.name || !Array.isArray(parsed.viewports)) return false
      if (parsed.viewports.length === 0) return false
      for (const vp of parsed.viewports) {
        if (!vp.id) vp.id = crypto.randomUUID()
        if (!Array.isArray(vp.items)) vp.items = []
        if (!Array.isArray(vp.connections)) vp.connections = []
        if (!Array.isArray(vp.typedConnections)) vp.typedConnections = []
        if (!Array.isArray(vp.messages)) vp.messages = []
        if (typeof vp.camX !== 'number' || !Number.isFinite(vp.camX)) vp.camX = 0
        if (typeof vp.camY !== 'number' || !Number.isFinite(vp.camY)) vp.camY = 0
        if (typeof vp.zoom !== 'number' || !Number.isFinite(vp.zoom)) vp.zoom = 1
        // Drop items that can't be rendered instead of crashing the canvas
        vp.items = vp.items.filter((i: any) => {
          if (!i || typeof i.id !== 'string' || !validKind.has(i.kind)) return false
          if (i.kind === 'connector') return true
          if (!isFiniteRecord(i.pos)) i.pos = { x: 80, y: 80 }
          return true
        })
        vp.connections = vp.connections.filter((c: any) =>
          c && typeof c.fromItemId === 'string' && typeof c.toItemId === 'string' &&
          typeof c.fromPortId === 'string' && typeof c.toPortId === 'string'
        )
      }
      if (!parsed.components) parsed.components = []
      if (!parsed.snapshots) parsed.snapshots = []
      // Backfill settings if missing or partial
      const defaultSettings = {
        apiKey: '',
        defaultModel: 'anthropic/claude-sonnet-4',
        jevThreshold: 0.2,
        multiAgent: false,
        theme: 'light' as const,
        canvasBg: '#e0f2fe',
        canvasBgType: 'color' as const,
        canvasBgVideo: '',
        customBgUrls: [],
        customBgLabels: {},
      }
      parsed.settings = { ...defaultSettings, ...(parsed.settings || {}) }
      // Never carry an API key from import
      parsed.settings.apiKey = ''
      // Imported settings are untrusted — never carry an API key
      if (parsed.settings) parsed.settings.apiKey = ''
      const activeId = parsed.viewports[0].id!
      set({ project: parsed, activeViewportId: activeId, history: [JSON.parse(JSON.stringify(parsed))], historyIndex: 0 })
      showToast('Project imported', 'success')
      return true
    } catch {
      return false
    }
  },
} as AppState),
    {
      name: 'moodbored-storage',
      partialize: (state) => ({
        activeViewportId: state.activeViewportId,
        // NOTE: project data is intentionally NOT persisted to localStorage
        // (5MB quota crash risk) — see the IndexedDB autosave subscription below
      }),
    }
  )
)

// ─── IndexedDB autosave (source of truth for project data) ──────────
let saveTimer: ReturnType<typeof setTimeout> | null = null

useStore.subscribe((s, prev) => {
  if (s.project === prev.project) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    try {
      const { updateProject } = await import('@/lib/storage')
      await updateProject(useStore.getState().project.id, useStore.getState().project)
    } catch (err) {
      console.warn('[MoodBored] Autosave to IndexedDB failed:', err)
    }
  }, 500)
})
