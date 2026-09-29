// Tool definitions for OpenRouter function-calling API.
// This replaces the fragile regex-parsed JSON block approach with
// structured tool invocations that the LLM returns reliably.

export const BOARD_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'add_items',
      description: 'Add one or more items to the mood board. Items are placed on the canvas automatically with collision avoidance.',
      parameters: {
        type: 'object' as const,
        required: ['items'],
        properties: {
          items: {
            type: 'array' as const,
            description: 'Items to add to the board',
            items: {
              type: 'object' as const,
              required: ['kind'],
              properties: {
                kind: {
                  type: 'string' as const,
                  enum: ['note', 'text', 'image', 'link', 'palette', 'gradient', 'font', 'swatch', 'sizeguide', 'container', 'video', 'web'],
                  description: 'The type of item to create',
                },
                text: { type: 'string' as const, description: 'Content for notes/text items' },
                description: { type: 'string' as const, description: 'Description for images/videos' },
                url: { type: 'string' as const, description: 'URL for links or image sources' },
                source: { type: 'string' as const, description: 'Image source URL (Unsplash, etc.)' },
                label: { type: 'string' as const, description: 'Label for palettes, gradients, containers, sizeguides' },
                colors: {
                  type: 'array' as const,
                  description: 'Colors for palette items',
                  items: {
                    type: 'object' as const,
                    properties: {
                      hex: { type: 'string' as const },
                      label: { type: 'string' as const },
                    },
                  },
                },
                stops: {
                  type: 'array' as const,
                  description: 'Gradient stops',
                  items: {
                    type: 'object' as const,
                    properties: {
                      position: { type: 'number' as const },
                      color: { type: 'string' as const },
                    },
                  },
                },
                fontFamily: { type: 'string' as const, description: 'Font family name for font items' },
                hex: { type: 'string' as const, description: 'Hex color for swatch items' },
                name: { type: 'string' as const, description: 'Name for swatch items' },
                purpose: { type: 'string' as const, description: 'Why this item is on the board' },
                importance: { type: 'string' as const, description: 'How important this item is' },
                tags: { type: 'array' as const, items: { type: 'string' as const }, description: 'Tags for filtering/search' },
                size: {
                  type: 'object' as const,
                  description: 'Width and height in pixels',
                  properties: {
                    w: { type: 'number' as const },
                    h: { type: 'number' as const },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'remove_items',
      description: 'Remove items from the board by their IDs',
      parameters: {
        type: 'object' as const,
        required: ['ids'],
        properties: {
          ids: {
            type: 'array' as const,
            items: { type: 'string' as const },
            description: 'IDs of items to remove',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_item',
      description: 'Update properties of an existing item on the board',
      parameters: {
        type: 'object' as const,
        required: ['id', 'updates'],
        properties: {
          id: { type: 'string' as const, description: 'The item ID to update' },
          updates: {
            type: 'object' as const,
            description: 'Properties to update (e.g. text, purpose, tags, colors)',
            additionalProperties: true,
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_items',
      description: 'Search items on the board by text query and/or tag filter',
      parameters: {
        type: 'object' as const,
        properties: {
          query: { type: 'string' as const, description: 'Text to search for across all item fields' },
          tag: { type: 'string' as const, description: 'Tag to filter by' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'arrange_items',
      description: 'Organize all items on the board into a layout',
      parameters: {
        type: 'object' as const,
        required: ['layout'],
        properties: {
          layout: {
            type: 'string' as const,
            enum: ['grid', 'stack-h', 'stack-v', 'spiral'],
            description: 'Layout type',
          },
          cols: { type: 'number' as const, description: 'Columns for grid layout (default: 4)' },
          gap: { type: 'number' as const, description: 'Gap between items in pixels (default: 20)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'group_items',
      description: 'Group selected items into a named container',
      parameters: {
        type: 'object' as const,
        required: ['label'],
        properties: {
          label: { type: 'string' as const, description: 'Name for the container group' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'generate_image',
      description: 'Generate an image using AI and add it to the board. Use this when the user wants a custom image that doesn\'t exist on Unsplash.',
      parameters: {
        type: 'object' as const,
        required: ['prompt'],
        properties: {
          prompt: { type: 'string' as const, description: 'Detailed image generation prompt. Include style, mood, composition, lighting, and subject matter.' },
          description: { type: 'string' as const, description: 'Short description of the generated image for the board item' },
          purpose: { type: 'string' as const, description: 'Why this image is on the board' },
          tags: { type: 'array' as const, items: { type: 'string' as const }, description: 'Tags for the image' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'export_brief',
      description: 'Export the board as a structured creative brief for another LLM',
      parameters: {
        type: 'object' as const,
        properties: {
          creation_type: {
            type: 'string' as const,
            enum: ['image', 'video', 'game', 'web', '3d', 'audio', 'document', 'general'],
            description: 'What the receiving LLM should create',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'open_url',
      description: 'Open a URL as a live web page node on the board. Creates an interactive browser card that the user can navigate.',
      parameters: {
        type: 'object' as const,
        required: ['url'],
        properties: {
          url: { type: 'string' as const, description: 'The URL to open' },
          title: { type: 'string' as const, description: 'Display title for the card' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'draw_connection',
      description: 'Draw a typed connection between two items on the board. Use this to show relationships like citation, dependency, contradiction, or related content.',
      parameters: {
        type: 'object' as const,
        required: ['from_id', 'to_id', 'connection_type'],
        properties: {
          from_id: { type: 'string' as const, description: 'Source item ID' },
          to_id: { type: 'string' as const, description: 'Target item ID' },
          connection_type: {
            type: 'string' as const,
            enum: ['citation', 'dependency', 'contradiction', 'related', 'mcp', 'api', 'custom'],
            description: 'Type of connection',
          },
          label: { type: 'string' as const, description: 'Optional label for the connection' },
        },
      },
    },
  },
]

// System prompt for tool-calling mode — shorter than the JSON-block prompt
// because the tool schemas carry the item type information.
export function buildToolSystemPrompt(projectSummary: string, boardDescription: string, viewportName?: string): string {
  const vpInfo = viewportName ? `\nYou are currently working on the "${viewportName}" board.` : ''

  return `You are MoodBored's AI assistant — a creative collaborator that builds visual mood boards.
${vpInfo}
RULES:
1. Whenever the user describes ANYTHING, immediately add items using the add_items tool.
2. Always add items. Every response should place 2-8 items on the canvas.
3. Use REAL Unsplash URLs for images: source "https://images.unsplash.com/photo-XXXXXXXXX?w=800"
4. For generated images, set source to "generated" and include a detailed description.
5. Spread items across the canvas. Vary positions.
6. Use containers to organize related items. Group by theme, type, or concept.
7. If the board is empty, populate it with items matching the user's request.
8. NEVER ask clarifying questions. Choose a strong direction and add concrete items.
9. You may write a short friendly message alongside your tool calls.
10. Use open_url to open web pages as live browser cards on the board.
11. Use draw_connection to show relationships between items (citation, dependency, contradiction, related).
12. When the user asks about connections or relationships between items, draw them visually.

CURRENT BOARD:
${projectSummary}

${boardDescription}`
}

// Process tool calls from the LLM response into AgentActions
export function processToolCalls(toolCalls: any[]): { type: 'add_item' | 'remove_item' | 'update_item' | 'group_items' | 'arrange_items' | 'generate_image' | 'open_url' | 'draw_connection'; item?: any; itemId?: string; updates?: any; label?: string; layout?: string; cols?: number; gap?: number; prompt?: string; description?: string; purpose?: string; tags?: string[]; url?: string; fromId?: string; toId?: string; connectionType?: string }[] {
  const actions: any[] = []
  for (const tc of toolCalls) {
    const fn = tc.function
    if (!fn) continue
    let args: any
    try {
      args = typeof fn.arguments === 'string' ? JSON.parse(fn.arguments) : fn.arguments
    } catch {
      continue
    }

    switch (fn.name) {
      case 'add_items':
        for (const raw of (args.items || [])) {
          // Ensure item has required fields
          const item = {
            ...raw,
            id: raw.id || crypto.randomUUID(),
            pos: raw.pos || { x: 80 + Math.random() * 600, y: 80 + Math.random() * 400 },
            size: raw.size || { w: 300, h: 200 },
            tags: raw.tags || [],
          }
          actions.push({ type: 'add_item', item })
        }
        break
      case 'remove_items':
        for (const id of (args.ids || [])) {
          actions.push({ type: 'remove_item', itemId: id })
        }
        break
      case 'update_item':
        if (args.id && args.updates) {
          actions.push({ type: 'update_item', itemId: args.id, updates: args.updates })
        }
        break
      case 'group_items':
        // Group items is handled by the store
        actions.push({ type: 'group_items', label: args.label || 'Group' })
        break
      case 'arrange_items':
        actions.push({ type: 'arrange_items', layout: args.layout, cols: args.cols, gap: args.gap })
        break
      case 'generate_image':
        actions.push({ type: 'generate_image', prompt: args.prompt, description: args.description, purpose: args.purpose, tags: args.tags })
        break
      case 'open_url':
        if (args.url) {
          actions.push({ type: 'open_url', url: args.url, title: args.title })
        }
        break
      case 'draw_connection':
        if (args.from_id && args.to_id && args.connection_type) {
          actions.push({ type: 'draw_connection', fromId: args.from_id, toId: args.to_id, connectionType: args.connection_type, label: args.label })
        }
        break
    }
  }
  return actions
}