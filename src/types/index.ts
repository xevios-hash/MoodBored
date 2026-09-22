export interface Position {
  x: number
  y: number
}

export interface Size {
  w: number
  h: number
}

// ─── Node Ports (ComfyUI/Blender-style) ─────────────────────────────

export type PortType = 'data' | 'visual' | 'reference' | 'any'
export type PortDirection = 'input' | 'output'

export interface Port {
  id: string
  name: string
  type: PortType
  direction: PortDirection
}

export interface PortConnection {
  fromItemId: string
  fromPortId: string
  toItemId: string
  toPortId: string
}

// ─── Component / Template System ────────────────────────────────────

export interface ComponentDef {
  id: string
  name: string
  description: string
  items: BoardItem[]       // template items (relative positions)
  connections: PortConnection[]
  thumbnail?: string
  tags: string[]
  created: string
}

// ─── Base item interface ────────────────────────────────────────────

interface ItemBase {
  id: string
  pos: Position
  size?: Size
  ports?: Port[]
  parentId?: string
}

// ─── Item Types ─────────────────────────────────────────────────────

export interface TextItem extends ItemBase {
  kind: 'text'
  raw: string
}

export interface ImageItem extends ItemBase {
  kind: 'image'
  thumbnail: string
  fullSource: string
  description: string
  purpose: string
  importance: string
  source: string
  tags: string[]
  genPrompt?: string
}

export interface LinkItem extends ItemBase {
  kind: 'link'
  url: string
  title: string
  summary: string
  description: string
  purpose: string
  importance: string
  source: string
  tags: string[]
}

export interface NoteItem extends ItemBase {
  kind: 'note'
  text: string
  purpose: string
  importance: string
  tags: string[]
}

export interface VideoItem extends ItemBase {
  kind: 'video'
  source: string
  startTs: number
  duration: number
  subjectDesc: string
  motionDesc: string
  purpose: string
  importance: string
  sourceUrl: string
  tags: string[]
}

export interface ColorStop {
  position: number
  color: string
}

export interface PaletteColor {
  hex: string
  label: string
}

export interface PaletteItem extends ItemBase {
  kind: 'palette'
  label: string
  colors: PaletteColor[]
  purpose: string
  importance: string
  tags: string[]
}

export interface GradientItem extends ItemBase {
  kind: 'gradient'
  label: string
  stops: ColorStop[]
  direction: number
  purpose: string
  importance: string
  tags: string[]
}

export interface FontPreviewItem extends ItemBase {
  kind: 'font'
  fontFamily: string
  weights: number[]
  sampleText: string
  purpose: string
  importance: string
  tags: string[]
}

export interface ColorSwatchItem extends ItemBase {
  kind: 'swatch'
  hex: string
  name: string
  usage: string
  purpose: string
  importance: string
  tags: string[]
}

export interface SizeGuideItem extends ItemBase {
  kind: 'sizeguide'
  width: number
  height: number
  unit: string
  label: string
  orientation: 'portrait' | 'landscape' | 'square'
  purpose: string
  importance: string
  tags: string[]
}

// ─── Container / Grid Item (can hold children) ──────────────────────

export type LayoutMode = 'free' | 'grid' | 'stack-h' | 'stack-v'

export interface ContainerItem extends ItemBase {
  kind: 'container'
  label: string
  children: BoardItem[]
  layout: LayoutMode
  gridCols?: number         // for grid layout
  gap?: number              // spacing between children
  collapsed: boolean
  purpose: string
  importance: string
  tags: string[]
}

// ─── Connector (port-to-port or item-to-item) ───────────────────────

export type ConnectorOwner = 'user' | 'llm' | 'objective'

export interface ConnectorItem {
  kind: 'connector'
  id: string
  fromId: string           // item id
  fromPortId?: string      // port id (optional for legacy item-level connections)
  toId: string             // item id
  toPortId?: string        // port id
  label: string
  style: 'solid' | 'dashed' | 'arrow'
  owner: ConnectorOwner
  purpose: string
  tags: string[]
}

// ─── Union types ────────────────────────────────────────────────────

export type BoardItem =
  | TextItem
  | ImageItem
  | LinkItem
  | NoteItem
  | VideoItem
  | PaletteItem
  | GradientItem
  | FontPreviewItem
  | ColorSwatchItem
  | SizeGuideItem
  | ContainerItem
  | ConnectorItem

export type PositionedItem = Exclude<BoardItem, ConnectorItem>

// ─── Viewport / Project ─────────────────────────────────────────────

export interface Viewport {
  id: string
  name: string
  items: BoardItem[]
  connections: PortConnection[]
  messages: ChatMessage[]
  camX: number
  camY: number
  zoom: number
}

export interface Settings {
  apiKey: string
  defaultModel: string
  jevThreshold: number
  theme: 'dark' | 'light'
  canvasBg: string
  canvasBgType: 'color' | 'video'
  canvasBgVideo: string
  customBgUrls: string[]
}

export interface Project {
  id: string
  name: string
  viewports: Viewport[]
  components: ComponentDef[]
  settings: Settings
  created: string
  updated: string
}

// ─── Chat / Agent ───────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  actions?: AgentAction[]
}

export interface AgentAction {
  type: 'add_item' | 'remove_item' | 'update_item' | 'add_connection'
  item?: BoardItem
  itemId?: string
  connection?: PortConnection
}

export interface SearchResult {
  item: BoardItem
  viewportId: string
  score: number
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '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',
  defaultModel: 'anthropic/claude-sonnet-4',
  jevThreshold: 0.2,
  theme: 'light',
  canvasBg: '#e0f2fe',
  canvasBgType: 'color',
  canvasBgVideo: '',
  customBgUrls: [],
}

// ─── Default ports for item kinds ───────────────────────────────────

export function getDefaultPorts(kind: string): Port[] {
  switch (kind) {
    case 'image':
      return [
        { id: 'img-in', name: 'Reference', type: 'reference', direction: 'input' },
        { id: 'img-out', name: 'Visual', type: 'visual', direction: 'output' },
      ]
    case 'palette':
      return [
        { id: 'pal-out', name: 'Colors', type: 'data', direction: 'output' },
        { id: 'pal-in', name: 'Theme', type: 'reference', direction: 'input' },
      ]
    case 'gradient':
      return [
        { id: 'grad-out', name: 'Gradient', type: 'visual', direction: 'output' },
      ]
    case 'font':
      return [
        { id: 'font-out', name: 'Typography', type: 'data', direction: 'output' },
        { id: 'font-in', name: 'Style', type: 'reference', direction: 'input' },
      ]
    case 'swatch':
      return [
        { id: 'sw-out', name: 'Color', type: 'data', direction: 'output' },
      ]
    case 'container':
      return [
        { id: 'ctx-in', name: 'Input', type: 'any', direction: 'input' },
        { id: 'ctx-out', name: 'Output', type: 'any', direction: 'output' },
      ]
    case 'note':
      return [
        { id: 'note-in', name: 'Context', type: 'reference', direction: 'input' },
        { id: 'note-out', name: 'Idea', type: 'data', direction: 'output' },
      ]
    case 'text':
      return [
        { id: 'txt-out', name: 'Content', type: 'data', direction: 'output' },
      ]
    case 'link':
      return [
        { id: 'link-in', name: 'Context', type: 'reference', direction: 'input' },
        { id: 'link-out', name: 'Reference', type: 'reference', direction: 'output' },
      ]
    case 'video':
      return [
        { id: 'vid-in', name: 'Reference', type: 'reference', direction: 'input' },
        { id: 'vid-out', name: 'Motion', type: 'visual', direction: 'output' },
      ]
    case 'sizeguide':
      return [
        { id: 'sz-out', name: 'Dimensions', type: 'data', direction: 'output' },
      ]
    default:
      return []
  }
}
