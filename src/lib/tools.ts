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
  {
    type: 'function' as const,
    function: {
      name: 'clear_board',
      description: 'Remove all items from the board. Use this when the user wants to start fresh or clear the canvas.',
      parameters: {
        type: 'object' as const,
        properties: {},
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_snapshot',
      description: 'Save a named snapshot of the current board state. Use for versioning, checkpoints, or creating branches.',
      parameters: {
        type: 'object' as const,
        required: ['name'],
        properties: {
          name: { type: 'string' as const, description: 'Snapshot name' },
          description: { type: 'string' as const, description: 'What this snapshot captures' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'generate_lesson',
      description: 'Generate an interactive educational lesson with slides, narration, and quizzes. Use when the user wants to learn about a topic.',
      parameters: {
        type: 'object' as const,
        required: ['topic'],
        properties: {
          topic: { type: 'string' as const, description: 'Topic to teach' },
          grade_level: {
            type: 'string' as const,
            enum: ['K-2', '3-5', '6-8', '9-12', 'adult'],
            description: 'Target grade level',
          },
          slide_count: { type: 'number' as const, description: 'Number of slides (default: 8)' },
          include_quizzes: { type: 'boolean' as const, description: 'Include quiz questions' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'summarize_across',
      description: 'Summarize content across multiple items on the board. Use to find themes, patterns, or create narratives.',
      parameters: {
        type: 'object' as const,
        properties: {
          item_ids: { type: 'array' as const, items: { type: 'string' as const }, description: 'Specific item IDs to summarize' },
          focus: { type: 'string' as const, description: 'What to focus on (e.g., "color themes", "key decisions")' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_semantic',
      description: 'Search items by meaning, not just keywords. Finds conceptually related items even if they use different words.',
      parameters: {
        type: 'object' as const,
        required: ['query'],
        properties: {
          query: { type: 'string' as const, description: 'What to search for (by meaning)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'find_related',
      description: 'Find items semantically related to a given item. Use to discover connections and build relationships.',
      parameters: {
        type: 'object' as const,
        required: ['item_id'],
        properties: {
          item_id: { type: 'string' as const, description: 'ID of the item to find relations for' },
        },
      },
    },
  },
  // ─── File Tools (IDE Features) ──────────────────────────────────
  {
    type: 'function' as const,
    function: {
      name: 'create_file',
      description: 'Create a new file on disk and add it as a node on the canvas. Use this when the user asks to create, write, or generate code/files.',
      parameters: {
        type: 'object' as const,
        required: ['path', 'content'],
        properties: {
          path: { type: 'string' as const, description: 'File path relative to workspace (e.g., "src/components/Button.tsx")' },
          content: { type: 'string' as const, description: 'The file content' },
          language: { type: 'string' as const, description: 'Programming language for syntax highlighting (auto-detected from extension if omitted)' },
          description: { type: 'string' as const, description: 'Brief description of what the file does' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_file',
      description: 'Read a file from the workspace. Use this when the user asks to see, show, or read file contents.',
      parameters: {
        type: 'object' as const,
        required: ['path'],
        properties: {
          path: { type: 'string' as const, description: 'File path relative to workspace' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_file',
      description: 'Update an existing file. Use this when the user asks to modify, edit, or change code in a file.',
      parameters: {
        type: 'object' as const,
        required: ['path', 'content'],
        properties: {
          path: { type: 'string' as const, description: 'File path relative to workspace' },
          content: { type: 'string' as const, description: 'New complete file content' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_files',
      description: 'List files in the workspace. Use this when the user asks what files exist or to explore the project structure.',
      parameters: {
        type: 'object' as const,
        properties: {
          path: { type: 'string' as const, description: 'Directory path relative to workspace (defaults to root)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'git_commit',
      description: 'Commit changes to git. Use this when the user asks to save, commit, or checkpoint their work.',
      parameters: {
        type: 'object' as const,
        required: ['message'],
        properties: {
          message: { type: 'string' as const, description: 'Commit message' },
          paths: { type: 'array' as const, items: { type: 'string' as const }, description: 'Specific file paths to commit (all changes if omitted)' },
        },
      },
    },
  },
]

// System prompt for tool-calling mode — comprehensive coverage of all agent capabilities.
export function buildToolSystemPrompt(projectSummary: string, boardDescription: string, viewportName?: string): string {
  const vpInfo = viewportName ? `\nYou are currently working on the "${viewportName}" board.` : ''

  return `You are MoodBored's AI — a creative collaborator, visual designer, and coding IDE combined. You work on an infinite canvas where users build mood boards, design systems, and code projects.

${vpInfo}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR TOOLKIT (15 tools)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 CANVAS TOOLS — Build and manage visual mood boards
  add_items        Add notes, text, images, links, palettes, gradients, fonts,
                   swatches, size guides, videos, containers, web pages
  remove_items     Delete items by ID
  update_item      Modify any item's properties
  search_items     Find items by text or tag
  arrange_items    Auto-layout: grid, stack-h, stack-v, spiral
  group_items      Group items into a named container
  generate_image   Create custom AI images (when Unsplash isn't enough)
  open_url         Open web pages as live interactive browser cards
  draw_connection  Draw typed connections between items
  export_brief     Export board as structured creative brief

💻 FILE TOOLS — Full coding IDE in your workspace
  create_file      Create files (code, configs, docs, anything)
  read_file        Read file contents
  update_file      Modify existing files
  list_files       Browse workspace directory
  git_commit       Commit changes to version control

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITEM TYPES (13 kinds)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  note        Text thoughts, quotes, keywords
  text        Raw content snippet
  image       Visual reference (Unsplash URL, generated, or uploaded)
  link        Reference URL with title and summary
  palette     Color palette with hex codes
  gradient    Gradient preview with stops and direction
  font        Typography preview with sample text
  swatch      Single color with usage notes
  sizeguide   Dimensions and orientation reference
  video       Video reference with subject and motion
  container   Group of items (free/grid/stack-h/stack-v layout)
  web         Live web page with browser controls

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONNECTION TYPES (7 kinds)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  citation       Source/reference relationship
  dependency     A requires/depends on B
  contradiction  Items conflict or disagree
  related        General association
  mcp            MCP tool connection
  api            API integration
  custom         User-defined relationship

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATIVE DIRECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When the user describes ANYTHING creative:
1. IMMEDIATELY add items — never ask questions first
2. Place 2-8 items per response — build momentum
3. Use REAL Unsplash URLs: https://images.unsplash.com/photo-XXXXXXXXX?w=800
4. For custom images: source="generated" + detailed description
5. Vary positions — spread across the canvas
6. Use containers to group related items by theme
7. Draw connections to show relationships visually
8. Choose strong creative direction — commit to it

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CODE & FILES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When the user asks to create/write/generate code or files:
1. Use create_file with proper file extensions
2. Include complete, runnable code (not snippets)
3. Add file headers/comments explaining purpose
4. Follow language conventions and best practices
5. Create supporting files when needed (e.g., index.html + style.css + app.js)

When the user asks to modify/edit/update code:
1. Read the file first if you need context (read_file)
2. Use update_file with the COMPLETE new content
3. Maintain existing code style

When the user asks to save/commit:
1. Use git_commit with a descriptive message

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WEB & RESEARCH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When the user mentions websites or URLs:
1. Use open_url to create live browser cards
2. Add link items for reference URLs
3. Use draw_connection to relate web content to other items

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ORGANIZATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When the board gets messy:
1. Use arrange_items for auto-layout (grid/stack/spiral)
2. Use group_items to create containers
3. Use draw_connection to show relationships
4. Use search_items to find what's on the board

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Be creative and decisive — pick a direction and run with it
- Use emojis in note text for visual interest
- Write concise, punchy copy (not verbose paragraphs)
- Think like a designer: color, typography, composition matter
- Think like a developer: clean code, proper structure, documentation
- NEVER ask clarifying questions — make strong choices

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CURRENT BOARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${projectSummary}

${boardDescription}`
}

// Process tool calls from the LLM response into AgentActions
// Returns actions grouped by originating tool call ID
export function processToolCalls(toolCalls: any[]): { toolCallId: string; actions: any[] }[] {
  const result: { toolCallId: string; actions: any[] }[] = []
  
  for (const tc of toolCalls) {
    const fn = tc.function
    if (!fn) continue
    let args: any
    try {
      args = typeof fn.arguments === 'string' ? JSON.parse(fn.arguments) : fn.arguments
    } catch {
      continue
    }

    const actions: any[] = []

    switch (fn.name) {
      case 'add_items':
        for (const raw of (args.items || [])) {
          // Ensure item has required fields including image sources
          const item = {
            ...raw,
            id: raw.id || crypto.randomUUID(),
            pos: raw.pos || { x: 80 + Math.random() * 600, y: 80 + Math.random() * 400 },
            size: raw.size || { w: 300, h: 200 },
            tags: raw.tags || [],
            // Map image source fields correctly
            ...(raw.kind === 'image' ? {
              thumbnail: raw.source || raw.url || raw.thumbnail || '',
              fullSource: raw.source || raw.url || raw.fullSource || '',
            } : {}),
            ...(raw.kind === 'video' ? {
              source: raw.source || raw.url || '',
              sourceUrl: raw.source || raw.url || '',
            } : {}),
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
      case 'search_items':
        // Handle search - return results
        actions.push({ type: 'search_items', query: args.query, tag: args.tag })
        break
      case 'export_brief':
        actions.push({ type: 'export_brief', creation_type: args.creation_type })
        break
      // ─── File Tools ─────────────────────────────────────────────
      case 'create_file':
        if (args.path && args.content) {
          actions.push({
            type: 'create_file',
            path: args.path,
            content: args.content,
            language: args.language,
            description: args.description,
          })
        }
        break
      case 'read_file':
        if (args.path) {
          actions.push({ type: 'read_file', path: args.path })
        }
        break
      case 'update_file':
        if (args.path && args.content) {
          actions.push({ type: 'update_file', path: args.path, content: args.content })
        }
        break
      case 'list_files':
        actions.push({ type: 'list_files', path: args.path })
        break
      case 'clear_board':
        actions.push({ type: 'clear_board' })
        break
      case 'create_snapshot':
        if (args.name) {
          actions.push({ type: 'create_snapshot', name: args.name, description: args.description })
        }
        break
      case 'generate_lesson':
        if (args.topic) {
          actions.push({ type: 'generate_lesson', topic: args.topic, gradeLevel: args.grade_level, slideCount: args.slide_count, includeQuizzes: args.include_quizzes })
        }
        break
      case 'summarize_across':
        actions.push({ type: 'summarize_across', itemIds: args.item_ids, focus: args.focus })
        break
      case 'search_semantic':
        if (args.query) {
          actions.push({ type: 'search_semantic', query: args.query })
        }
        break
      case 'find_related':
        if (args.item_id) {
          actions.push({ type: 'find_related', itemId: args.item_id })
        }
        break
      case 'git_commit':
        if (args.message) {
          actions.push({ type: 'git_commit', message: args.message, paths: args.paths })
        }
        break
    }

    result.push({ toolCallId: tc.id, actions })
  }
  
  return result
}