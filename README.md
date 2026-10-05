<p align="center">
  <img src="public/logo-hero.png" width="200" alt="MoodBored" />
</p>

<h1 align="center">MoodBored</h1>

<p align="center">
  <strong>Visual mood-board workspace where humans and LLMs brainstorm together.</strong><br/>
  <em>Any LLM. Any IDE. One canvas.</em>
</p>

<p align="center">
  <a href="https://moodbored-production.up.railway.app">Live Demo</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#mcp--rest-api">API</a> ·
  <a href="#features">Features</a> ·
  <a href="#screenshots">Screenshots</a>
</p>

---

## What is MoodBored?

MoodBored is a collaborative canvas for creative direction — mood boards, brand exploration, design systems, and reference gathering. Any LLM can read, write, and arrange items via MCP or REST API. No sign-up required.

**Try it live:** [moodbored-production.up.railway.app](https://moodbored-production.up.railway.app)

## Install & Run

```bash
git clone https://github.com/xevios-hash/MoodBored.git
cd MoodBored
npm install
npm run dev
```

**Production:**
```bash
npm run build && npm start    # serves at http://localhost:3000
```

**macOS desktop:**
```bash
npx tauri build
```

## Screenshots

<p align="center">
  <img src="public/screenshot-board-day.png" width="800" alt="MoodBored canvas with daylight video background" /><br/>
  <em>Canvas with video background — images, palettes, gradients, fonts, and notes</em>
</p>

<p align="center">
  <img src="public/screenshot-mcp.png" width="800" alt="MoodBored MCP connection page" /><br/>
  <em>MCP connection info page — copy-paste configs for any IDE</em>
</p>

## Features

### 📚 Education Mode (Living Textbook)

Transform MoodBored into an interactive learning platform with AI-powered lessons.

#### Slideshow Presentation
- **Full-screen slideshow** with AI narration (Web Speech API)
- **Interactive quizzes** — multiple choice, true/false, fill-in-blank
- **Project submissions** — write, upload files, or link to external work
- **Progress tracking** — scores, completion, resume where you left off

#### AI Lesson Generation
- **"Teach me about X"** — AI creates complete lessons with slides
- **Grade-level adaptation** — K-2, 3-5, 6-8, 9-12, Adult
- **Auto-generated narration** — spoken slides with adjustable speed
- **Quiz questions** — with answers and explanations

#### Nonlinear Learning Paths
- **Visual path editor** — connect slides with arrows
- **Branching choices** — "Want to learn about X or Y?"
- **Free exploration** — browse any slide in any order
- **Prerequisites** — lock/unlock slides based on progress

#### Project-Based Learning
- **8 project templates** — from drawing to research essays
- **Rubric-based grading** — criteria, points, feedback
- **Teacher dashboard** — monitor student progress
- **Submission system** — write, upload, or link projects

#### Accessibility
- **Grade-school themes** — larger fonts, bright colors for K-2
- **Screen reader support** — ARIA labels, announcements
- **Keyboard navigation** — full keyboard accessibility
- **High contrast mode** — respects user preferences

**Keyboard shortcuts in Lesson Mode:**
| Key | Action |
|-----|--------|
| `← →` | Navigate slides |
| `S` | Score tracking |
| `E` | Free exploration |
| `P` | Path editor |
| `T` | Slide thumbnails |
| `F` | Fullscreen |
| `Esc` | Close |

### Annotations & Drawing
- **Annotate websites** — draw on web pages with text, arrows, boxes, circles, highlights
- **Hold Alt + draw** — annotate without blocking website interaction
- **Free-floating annotations** — text and shapes on the canvas background
- **Color picker** — 9 colors, adjustable stroke width
- **Persistent annotations** — saved with your board

### Spatial Browser Workspace

#### Browser Engine Layer
- **Live web pages on canvas** — each node hosts an embedded browser view
- **Tab lifecycle** — create, focus, navigate, reload, close web nodes
- **Fullscreen focus** — double-click to focus; Esc to return to board
- **Interactive websites** — hover over cards to click, scroll, type
- **Resizable cards** — drag edges/corners to resize web cards

#### Spatial Tab Management
- **Board IS the tab manager** — no native tab strip; nodes are tabs
- **Typed connections** — draw lines between nodes (citation, dependency, contradiction, related)
- **Drag cards** — grab the URL bar to move cards around

#### Blank-Card-First, Multimodal Creation
- **Double-click empty canvas** — creates a blank card with centered input
- **Type-to-act** — URL loads site, question runs search, text becomes note
- **Card morphing** — text determines card type automatically

#### Forward/Back and History
- **Per-card browser history** — back/forward controls on each web card
- **Board-level undo** — Cmd+Z for every action (add, move, connect, delete)
- **Batch operations** — multi-delete with single undo

#### Snapshots & Workspaces
- **Named snapshots** — save checkpoints of board state
- **Fork from snapshot** — create parallel copies for exploration
- **Named workspaces** — save and restore complete boards
- **Pin important workspaces** — keep frequent ones at top

#### AI Co-Pilot
- **AI opens URLs** — model creates web cards from links
- **AI draws connections** — typed connections between items
- **AI adds items** — natural language to board items
- **Shared visual context** — model sees node contents and connections

#### Import from Chrome
- **One-click import** — Chrome tabs become nodes on the board
- **Domain grouping** — tabs laid out by domain

### Enhanced Right-Click Menu
- **Add items** — 10 types in grid layout
- **Copy/Paste/Duplicate** with keyboard shortcuts
- **Layer order** — Bring Front/Forward/Backward/Back
- **Group Selected** — organize items into containers
- **Lock Position** — prevent accidental moves
- **Add Annotation** — switch to annotation mode
- **Connect to...** — draw typed connections
- **Export as PNG / Copy as JSON**
- **Fit All to View** — zoom to fit all items

### Canvas
- Infinite pan/zoom with smooth gestures (Ctrl+scroll to zoom)
- Lasso selection, alignment snapping, multi-select
- Viewport culling for performance (handles 500+ items)
- Video/YouTube background support

### 12 Item Types
| Kind | Description |
|------|-------------|
| `note` | Text thoughts, quotes, keywords |
| `text` | Raw content snippet |
| `image` | Visual reference (Unsplash, URLs, uploads) |
| `link` | Reference URL with title and summary |
| `palette` | Color palette with hex codes |
| `gradient` | Gradient preview with stops and direction |
| `font` | Typography preview with sample text |
| `swatch` | Single color with usage notes |
| `sizeguide` | Dimensions and orientation reference |
| `video` | Video reference with subject and motion description |
| `container` | Group of items with layout modes (free/grid/stack) |
| `web` | Live web page with browser controls and navigation history |

### AI
- LLM chat with tool-calling (OpenRouter) — structured function invocations
- Image generation via server proxy (API keys stay server-side)
- Multi-agent mode (6 specialist roles)
- Semantic search — find items by meaning
- Related items — find complementary items

### Content Creation
- **Unsplash search** — built-in image browser (via server proxy)
- **Color picker** — HSL sliders, harmony generators
- **Export for Creation** — 8 creation types, 3 formats (Markdown, JSON, XML)

### MCP Server
- 14 tools: `get_board`, `add_items`, `remove_items`, `update_item`, `search_items`, `semantic_search`, `related_items`, `arrange_items`, `clear_board`, `open_url`, `draw_connection`, `create_snapshot`, `list_snapshots`, `summarize_across`
- Stdio transport (Claude Desktop, Cursor) + SSE transport (OpenCode, web IDEs)
- `/.well-known/mcp.json` discovery endpoint

### REST API
```
POST   /api/board/:id/items              — add items
DELETE /api/board/:id/items              — remove items
PATCH  /api/board/:id/items/:itemId      — update item
GET    /api/board/:id/search?q=&tag=     — text search
GET    /api/board/:id/semantic?q=        — semantic search
POST   /api/board/:id/arrange            — layout arrangement
GET    /api/board/:id/brief              — creative brief export
POST   /api/ai/chat                      — AI chat (proxied)
POST   /api/ai/generate-image            — image generation (proxied)
GET    /api/unsplash/search?q=           — image search (proxied)
```

### Collaboration
- Share boards via links with view/edit roles
- Real-time presence with cursor tracking
- Real-time edit sync between collaborators
- No sign-up required for viewers

### Security & Reliability
- **Helmet** — security headers
- **CORS** — restricted to known origins
- **Rate limiting** — 100 req/15min API
- **API keys server-side** — OpenRouter/Unsplash keys configured via `OPENROUTER_API_KEY` and `UNSPLASH_ACCESS_KEY` env vars, never sent to browser
- **Board API auth** — `BOARD_API_TOKEN` required for mutating endpoints (POST/PUT/DELETE)
- **Atomic file writes** — no data corruption
- **Error handling** — graceful failure recovery
- **Request logging** — morgan HTTP logs

### Platform
- Web (any browser)
- macOS desktop (Tauri)
- PWA (installable, works offline)
- Railway deployment (Express server + MCP SSE)
- Code splitting (vendor/store/UI chunks)
- Compression (gzip/brotli)

## Keyboard Shortcuts

Press `?` for in-app help.

| Key | Action | Key | Action |
|-----|--------|-----|--------|
| `N` | New note | `P` | New palette |
| `T` | New text | `G` | New gradient |
| `I` | New image | `F` | New font |
| `L` | New link | `V` | New video |
| `Ctrl+K` | Search | `Ctrl+Z` | Undo |
| `Ctrl+A` | Select all | `Ctrl+Shift+Z` | Redo |
| `Ctrl+C` | Copy | `Ctrl+D` | Duplicate |
| `Ctrl+V` | Paste | `0` | Reset zoom |
| `Delete` | Delete selected | `Escape` | Cancel/deselect |
| Double-click | Create blank card | Right-click | Context menu |
| `Alt+Drag` | Annotate | `?` | Show help |

## License

Apache 2.0