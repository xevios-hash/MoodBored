import { v4 as uuid } from 'uuid'
import type { Project, BoardItem, Viewport } from '@/types'

export interface ProjectTemplate {
  id: string
  name: string
  description: string
  icon: string
  color: string
  create: (name: string) => Project
}

function makeItem(kind: string, props: Record<string, any>): any {
  return {
    id: uuid(),
    kind,
    pos: props.pos || { x: 100, y: 100 },
    size: props.size || { w: 300, h: 200 },
    ports: [],
    tags: [],
    purpose: '',
    importance: '',
    ...props,
  }
}

export const TEMPLATES: ProjectTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Canvas',
    description: 'Start from scratch with an empty board',
    icon: '🎨',
    color: '#e0f2fe',
    create: (name) => ({
      id: uuid(),
      name,
      viewports: [{ id: uuid(), name: 'Main Board', items: [], connections: [], messages: [], camX: 0, camY: 0, zoom: 1 }],
      components: [],
      settings: { apiKey: '', defaultModel: 'anthropic/claude-sonnet-4', jevThreshold: 0.2, theme: 'light', canvasBg: '#e0f2fe', canvasBgType: 'color', canvasBgVideo: '', customBgUrls: [] },
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    }),
  },
  {
    id: 'brand',
    name: 'Brand Identity',
    description: 'Color palette, typography, mood references, and brand direction',
    icon: '✨',
    color: '#ccfbf1',
    create: (name) => {
      const items: BoardItem[] = [
        makeItem('note', { text: 'Brand Direction', purpose: 'Define the overall brand vision', pos: { x: 100, y: 100 }, size: { w: 280, h: 120 } }),
        makeItem('palette', { label: 'Primary Palette', colors: [
          { hex: '#0d9488', label: 'Teal' },
          { hex: '#1a1a2e', label: 'Dark' },
          { hex: '#f8f9fa', label: 'Light' },
          { hex: '#6366f1', label: 'Accent' },
        ], pos: { x: 100, y: 280 }, size: { w: 320, h: 120 } }),
        makeItem('font', { fontFamily: 'Inter', sampleText: 'Brand Name', weights: [400, 600, 700], pos: { x: 460, y: 100 }, size: { w: 300, h: 160 } }),
        makeItem('note', { text: 'Typography Rules', purpose: 'Define font hierarchy', pos: { x: 460, y: 320 }, size: { w: 300, h: 120 } }),
        makeItem('swatch', { hex: '#0d9488', name: 'Primary Teal', usage: 'Buttons, links, accents', pos: { x: 800, y: 100 }, size: { w: 160, h: 180 } }),
        makeItem('note', { text: 'Brand Voice', purpose: 'How the brand communicates', pos: { x: 800, y: 340 }, size: { w: 250, h: 120 } }),
      ]
      return {
        id: uuid(), name,
        viewports: [{ id: uuid(), name: 'Brand Board', items, connections: [], messages: [], camX: 0, camY: 0, zoom: 1 }],
        components: [],
        settings: { apiKey: '', defaultModel: 'anthropic/claude-sonnet-4', jevThreshold: 0.2, theme: 'light', canvasBg: '#e0f2fe', canvasBgType: 'color', canvasBgVideo: '', customBgUrls: [] },
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }
    },
  },
  {
    id: 'interior',
    name: 'Interior Design',
    description: 'Space layout, materials, colors, and furniture references',
    icon: '🏠',
    color: '#fef3c7',
    create: (name) => {
      const items: BoardItem[] = [
        makeItem('note', { text: 'Room Vision', purpose: 'Overall feeling and function', pos: { x: 100, y: 100 }, size: { w: 280, h: 120 } }),
        makeItem('palette', { label: 'Room Colors', colors: [
          { hex: '#f5f5dc', label: 'Beige' },
          { hex: '#8b7355', label: 'Wood' },
          { hex: '#2d5016', label: 'Plant' },
          { hex: '#f0e68c', label: 'Accent' },
        ], pos: { x: 100, y: 280 }, size: { w: 320, h: 120 } }),
        makeItem('sizeguide', { width: 400, height: 300, unit: 'cm', label: 'Room Dimensions', orientation: 'landscape', pos: { x: 460, y: 100 }, size: { w: 200, h: 160 } }),
        makeItem('note', { text: 'Material Notes', purpose: 'Wood, stone, fabric choices', pos: { x: 460, y: 320 }, size: { w: 300, h: 120 } }),
        makeItem('swatch', { hex: '#8b7355', name: 'Walnut Wood', usage: 'Furniture, flooring', pos: { x: 800, y: 100 }, size: { w: 160, h: 180 } }),
        makeItem('note', { text: 'Lighting Plan', purpose: 'Natural and artificial light', pos: { x: 800, y: 340 }, size: { w: 250, h: 120 } }),
      ]
      return {
        id: uuid(), name,
        viewports: [{ id: uuid(), name: 'Room Board', items, connections: [], messages: [], camX: 0, camY: 0, zoom: 1 }],
        components: [],
        settings: { apiKey: '', defaultModel: 'anthropic/claude-sonnet-4', jevThreshold: 0.2, theme: 'light', canvasBg: '#e0f2fe', canvasBgType: 'color', canvasBgVideo: '', customBgUrls: [] },
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }
    },
  },
  {
    id: 'fashion',
    name: 'Fashion / Editorial',
    description: 'Looks, fabrics, color story, and style direction',
    icon: '👗',
    color: '#fce7f3',
    create: (name) => {
      const items: BoardItem[] = [
        makeItem('note', { text: 'Collection Theme', purpose: 'Overall aesthetic direction', pos: { x: 100, y: 100 }, size: { w: 280, h: 120 } }),
        makeItem('palette', { label: 'Season Colors', colors: [
          { hex: '#1a1a2e', label: 'Midnight' },
          { hex: '#f5e6d3', label: 'Cream' },
          { hex: '#c9a96e', label: 'Gold' },
          { hex: '#8b0000', label: 'Crimson' },
        ], pos: { x: 100, y: 280 }, size: { w: 320, h: 120 } }),
        makeItem('gradient', { label: 'Fabric Gradient', stops: [
          { position: 0, color: '#1a1a2e' },
          { position: 0.5, color: '#c9a96e' },
          { position: 1, color: '#f5e6d3' },
        ], direction: 135, pos: { x: 460, y: 100 }, size: { w: 300, h: 80 } }),
        makeItem('note', { text: 'Silhouette Notes', purpose: 'Cut and drape direction', pos: { x: 460, y: 240 }, size: { w: 300, h: 120 } }),
        makeItem('swatch', { hex: '#c9a96e', name: 'Antique Gold', usage: 'Hardware, accents, embroidery', pos: { x: 800, y: 100 }, size: { w: 160, h: 180 } }),
        makeItem('font', { fontFamily: 'Playfair Display', sampleText: 'COLLECTION', weights: [400, 700], pos: { x: 800, y: 340 }, size: { w: 250, h: 120 } }),
      ]
      return {
        id: uuid(), name,
        viewports: [{ id: uuid(), name: 'Collection Board', items, connections: [], messages: [], camX: 0, camY: 0, zoom: 1 }],
        components: [],
        settings: { apiKey: '', defaultModel: 'anthropic/claude-sonnet-4', jevThreshold: 0.2, theme: 'light', canvasBg: '#e0f2fe', canvasBgType: 'color', canvasBgVideo: '', customBgUrls: [] },
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }
    },
  },
  {
    id: 'film',
    name: 'Film / Video',
    description: 'Scenes, mood, color grading, and visual references',
    icon: '🎬',
    color: '#1e1b4b',
    create: (name) => {
      const items: BoardItem[] = [
        makeItem('note', { text: 'Film Concept', purpose: 'Story and visual direction', pos: { x: 100, y: 100 }, size: { w: 280, h: 120 } }),
        makeItem('gradient', { label: 'Color Grade', stops: [
          { position: 0, color: '#0a0a14' },
          { position: 0.3, color: '#1a1a3e' },
          { position: 0.7, color: '#c9a96e' },
          { position: 1, color: '#f5e6d3' },
        ], direction: 90, pos: { x: 100, y: 280 }, size: { w: 320, h: 80 } }),
        makeItem('note', { text: 'Scene List', purpose: 'Key scenes to shoot', pos: { x: 460, y: 100 }, size: { w: 300, h: 200 } }),
        makeItem('sizeguide', { width: 1920, height: 1080, unit: 'px', label: 'Frame Size', orientation: 'landscape', pos: { x: 460, y: 360 }, size: { w: 200, h: 160 } }),
        makeItem('palette', { label: 'Lighting Mood', colors: [
          { hex: '#0a0a14', label: 'Shadow' },
          { hex: '#c9a96e', label: 'Warm' },
          { hex: '#87ceeb', label: 'Cool' },
          { hex: '#f5f5dc', label: 'Highlight' },
        ], pos: { x: 800, y: 100 }, size: { w: 280, h: 120 } }),
        makeItem('note', { text: 'Sound Design', purpose: 'Audio atmosphere', pos: { x: 800, y: 280 }, size: { w: 250, h: 120 } }),
      ]
      return {
        id: uuid(), name,
        viewports: [{ id: uuid(), name: 'Film Board', items, connections: [], messages: [], camX: 0, camY: 0, zoom: 1 }],
        components: [],
        settings: { apiKey: '', defaultModel: 'anthropic/claude-sonnet-4', jevThreshold: 0.2, theme: 'light', canvasBg: '#e0f2fe', canvasBgType: 'color', canvasBgVideo: '', customBgUrls: [] },
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }
    },
  },
  {
    id: 'product',
    name: 'Product Design',
    description: 'Features, user flows, aesthetics, and design direction',
    icon: '📱',
    color: '#ecfdf5',
    create: (name) => {
      const items: BoardItem[] = [
        makeItem('note', { text: 'Product Vision', purpose: 'What we are building and why', pos: { x: 100, y: 100 }, size: { w: 280, h: 120 } }),
        makeItem('palette', { label: 'UI Colors', colors: [
          { hex: '#4f46e5', label: 'Primary' },
          { hex: '#10b981', label: 'Success' },
          { hex: '#f59e0b', label: 'Warning' },
          { hex: '#1f2937', label: 'Text' },
        ], pos: { x: 100, y: 280 }, size: { w: 320, h: 120 } }),
        makeItem('font', { fontFamily: 'Inter', sampleText: 'Product Name', weights: [400, 600, 700], pos: { x: 460, y: 100 }, size: { w: 300, h: 160 } }),
        makeItem('note', { text: 'Key Features', purpose: 'Core functionality list', pos: { x: 460, y: 320 }, size: { w: 300, h: 160 } }),
        makeItem('swatch', { hex: '#4f46e5', name: 'Indigo', usage: 'Primary actions, links', pos: { x: 800, y: 100 }, size: { w: 160, h: 180 } }),
        makeItem('note', { text: 'User Flows', purpose: 'Key user journeys', pos: { x: 800, y: 340 }, size: { w: 250, h: 160 } }),
      ]
      return {
        id: uuid(), name,
        viewports: [{ id: uuid(), name: 'Product Board', items, connections: [], messages: [], camX: 0, camY: 0, zoom: 1 }],
        components: [],
        settings: { apiKey: '', defaultModel: 'anthropic/claude-sonnet-4', jevThreshold: 0.2, theme: 'light', canvasBg: '#e0f2fe', canvasBgType: 'color', canvasBgVideo: '', customBgUrls: [] },
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }
    },
  },
]
