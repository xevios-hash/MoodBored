# MoodBored

A collaborative mood-board workspace where humans and LLMs brainstorm together visually.

MoodBored is a visual canvas for creative direction — mood boards, brand exploration, design systems, and reference gathering. It integrates with any LLM via MCP so your AI can read, write, and arrange items on the board as naturally as you can.

## Quick Start

```bash
# Install and run
npm install
npm run dev          # opens at http://localhost:5173

# Production build
npm run build        # outputs to dist/

# macOS desktop (Tauri)
npx tauri build      # produces .app and .dmg

# Start the server (serves frontend + MCP endpoints)
npm start            # http://localhost:3000
```

## What It Does

**Canvas** — Infinite canvas with pan/zoom, drag-and-drop, multi-select, lasso selection, alignment snapping, layers panel, minimap. 11 item types: notes, text, images, links, palettes, gradients, fonts, swatches, size guides, videos, containers.

**AI Chat** — Talk to an LLM that adds items to your board in real-time via OpenRouter. Supports tool-calling (structured function invocations) with a fallback to regex-parsed JSON blocks. Multi-agent mode available (toggle in Settings).

**MCP Server** — Any LLM tool (Claude Desktop, Cursor, OpenCode, Grok Code) can drive the board via MCP. 7 tools: `get_board`, `add_items`, `remove_items`, `update_item`, `search_items`, `arrange_items`, `clear_board`. Stdio transport for desktop clients, SSE transport for web-based clients.

**Export for Creation** — Select items on the board, export a structured creative brief for another LLM to produce images, videos, games, websites, 3D scenes, audio, or documents.

**Collaboration** — Share boards via links with view/edit roles. Real-time presence with cursor tracking. No sign-up required for viewers.

## Architecture

```
src/                    React frontend (canvas, chat, inspector, etc.)
src/lib/                Core logic (API, tools, sync, storage, export)
mcp/mcp-server.ts       MCP server (stdio transport)
server.mjs              Express server (static files + MCP SSE + board API)
src-tauri/              Tauri desktop wrapper (macOS)
bend/                   Formal verification (data model, laws, proofs)
```

## MCP Integration

MoodBored exposes an MCP server so any LLM can interact with your board.

**Claude Desktop / Cursor** (stdio):
```json
{
  "mcpServers": {
    "moodbored": {
      "command": "npx",
      "args": ["tsx", "/path/to/MoodBored/mcp/mcp-server.ts"],
      "env": { "MOODBORED_BOARD_ID": "your-board-id" }
    }
  }
}
```

**OpenCode / Web IDEs** (SSE):
```
http://localhost:3000/mcp/sse?board=your-board-id
```

**Connection info page**: `http://localhost:3000/mcp`

**Discovery**: `http://localhost:3000/.well-known/mcp.json`

## Embed Mode

Open any board URL to get a canvas-only view (no chat, no sidebar):
```
http://localhost:3000/board/{board-id}
http://localhost:3000/board/{board-id}?embed=1&theme=dark
http://localhost:3000/board/{board-id}?readonly=1
```

PostMessage API for parent-frame control:
```js
window.postMessage({ type: 'addItems', items: [...] }, '*')
window.postMessage({ type: 'setTheme', theme: 'dark' }, '*')
```

## Configuration

Open Settings (gear icon) to configure:
- **Canvas background** — solid color presets or video backgrounds (YouTube URLs supported)
- **Theme** — light / dark
- **Multi-agent mode** — toggle multiple specialized AI agents (off by default)
- **Jev quality gate** — coherence threshold for agent proposals

API key and model selection are only shown in the full app (not in embed mode).

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `N` / `T` / `I` / `L` / `P` / `G` / `F` / `V` | Create note/text/image/link/palette/font/video |
| `Ctrl+K` | Search |
| `Ctrl+A` | Select all |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo |
| `Ctrl+C` / `Ctrl+V` | Copy / paste |
| `+` / `-` / `0` | Zoom in / out / reset |
| `Delete` | Delete selected |
| `Escape` | Cancel / deselect |
| Double-click empty | Create note |
| Right-click | Context menu (all item types) |

## Item Types

| Kind | Description |
|------|-------------|
| `note` | Text thoughts, quotes, keywords |
| `text` | Raw content snippet |
| `image` | Visual reference (supports Unsplash URLs) |
| `link` | Reference URL with title and summary |
| `palette` | Color palette with hex codes |
| `gradient` | Gradient preview with stops and direction |
| `font` | Typography preview with sample text |
| `swatch` | Single color with usage notes |
| `sizeguide` | Dimensions and orientation reference |
| `video` | Video reference with subject and motion description |
| `container` | Group of items with layout modes (free/grid/stack) |
| `connector` | Line between items |

## Build Targets

| Target | Command | Output |
|--------|---------|--------|
| Web | `npm run build` | `dist/` |
| macOS | `npx tauri build` | `.app` + `.dmg` |
| Server | `npm start` | `http://localhost:3000` |

## License

MIT