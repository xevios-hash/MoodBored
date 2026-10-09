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

**Desktop (Windows/macOS/Linux):**
```bash
npm run tauri build
```

**AI Bridge (for web access to local models):**
```bash
node scripts/ai-bridge.js    # runs on port 3001
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

### 🎨 Canvas & Items

#### 13 Item Types
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
| `file` | File on disk with syntax-highlighted preview and editor |

#### Canvas Features
- Infinite pan/zoom with smooth gestures (Ctrl+scroll to zoom)
- Lasso selection, alignment snapping, multi-select
- Viewport culling for performance (handles 500+ items)
- Video/YouTube background support
- **Regions** — colored, named boxes for organizing board areas
- **Containers** — group items into folders
- **Connections** — typed lines between items (citation, dependency, contradiction, related)

### 🤖 AI Features

#### 14 AI Providers
| Provider | Env Variable | Models |
|----------|--------------|--------|
| OpenRouter | `OPENROUTER_API_KEY` | 100+ models |
| OpenAI | `OPENAI_API_KEY` | GPT-4, GPT-4o, GPT-3.5 |
| Anthropic | `ANTHROPIC_API_KEY` | Claude 3.5, 3 Opus, 3 Haiku |
| Google Gemini | `GEMINI_API_KEY` | Gemini Pro, 1.5 Pro/Flash |
| Groq | `GROQ_API_KEY` | Llama 3, Mixtral |
| Together AI | `TOGETHER_API_KEY` | Llama, Mixtral, CodeLlama |
| Mistral AI | `MISTRAL_API_KEY` | Mistral Large/Medium/Small |
| Cohere | `COHERE_API_KEY` | Command R+, Command R |
| Perplexity | `PERPLEXITY_API_KEY` | Sonar models |
| Fireworks AI | `FIREWORKS_API_KEY` | Llama, Mixtral |
| DeepSeek | `DEEPSEEK_API_KEY` | DeepSeek Chat, Coder |
| Ollama | *(local)* | llama3, mistral, codellama |
| LM Studio | *(local)* | Any local model |
| Custom | `CUSTOM_AI_URL` | Any OpenAI-compatible |

#### AI Capabilities
- **Canvas conversations** — click a note, press Space, AI responds with connected nodes
- **Quick input** — press `/` to create nodes with smart type detection
- **Multi-agent mode** — 6 specialist roles (Color, Typography, Layout, Content, Visual, Orchestrator)
- **Semantic search** — find items by meaning
- **Related items** — find complementary items
- **Image generation** — via server proxy (API keys stay server-side)

### 💻 IDE & File System

#### File Nodes
- **Files become canvas nodes** — syntax-highlighted preview, language badge, file size
- **Monaco Editor** — full VS Code editor with syntax highlighting
- **Double-click to edit** — opens Monaco Editor for any file node
- **Bidirectional sync** — changes on disk update canvas, changes in editor update disk

#### Workspace
- **Auto-created** at `~/MoodBored-Workspace`
- **Folder structure** — containers represent folders
- **Git integration** — status, commit, log via API

#### File Tools (for AI agents)
- `create_file` — Create files on disk
- `read_file` — Read file contents
- `update_file` — Modify existing files
- `list_files` — Browse workspace directory
- `git_commit` — Commit changes to version control

### 🎓 Education Mode

#### Slideshow Presentation
- **Full-screen slideshow** with AI narration (Web Speech API)
- **Interactive quizzes** — multiple choice, true/false, fill-in-blank
- **Progress tracking** — scores, completion, resume where you left off

#### AI Lesson Generation
- **"Teach me about X"** — AI creates complete lessons with slides
- **Grade-level adaptation** — K-2, 3-5, 6-8, 9-12, Adult
- **Auto-generated narration** — spoken slides with adjustable speed

### 🎨 Regions & Organization

- **Regions** — colored, named boxes for organizing board areas
- **Arrange tools** — grid, stack, spiral layouts via right-click menu
- **Presentation mode** — convert boards to slideshows with narration
- **Export for AI** — prompts for SD, Midjourney, DALL-E, video models, LLMs

### 🔧 Model Management

- **Native model scanner** — auto-detects models in common locations
- **Model catalog** — browse and download popular models from HuggingFace
- **Runtime detection** — finds llama.cpp, Ollama, LM Studio, ComfyUI, Automatic1111, Invoke AI
- **VRAM estimation** — estimates memory requirements for each model
- **Model Manager UI** — installed models, catalog, runtimes, settings

### 🚀 Inference Orchestration

- **Local runtime support** — llama.cpp, Ollama, LM Studio, ComfyUI, Automatic1111, Invoke AI
- **Unified API** — same interface for local and cloud models
- **Automatic fallback** — tries local runtimes first, then cloud
- **Direct generation** — send prompts to image generation services

### 📤 Export & Presentation

- **Export for AI** — prompts for Stable Diffusion, Midjourney, DALL-E, video models, LLMs
- **Presentation mode** — convert boards to slideshows with narration
- **Lesson generation** — create educational content via API/MCP
- **Creative brief export** — Markdown, JSON, XML formats

### 🔒 Security & Reliability

- **Helmet** — security headers
- **CORS** — restricted to known origins
- **Rate limiting** — 100 req/15min API
- **API keys server-side** — All provider keys configured via env vars, never sent to browser
- **Atomic file writes** — no data corruption
- **Schema versioning** — board format versioning with migrations
- **Offline mode** — full offline support for desktop builds

### 🤝 Collaboration

- Share boards via links with view/edit roles
- Real-time presence with cursor tracking
- Real-time edit sync between collaborators
- No sign-up required for viewers

## MCP Server

- **20 tools** for AI agents
- Stdio transport (Claude Desktop, Cursor) + SSE transport (OpenCode, web IDEs)
- `/.well-known/mcp.json` discovery endpoint

### MCP Tools
```
get_board, add_items, remove_items, update_item, search_items,
semantic_search, related_items, arrange_items, clear_board,
open_url, draw_connection, create_snapshot, list_snapshots,
summarize_across, generate_lesson, read_file, write_file,
list_files, delete_file, rename_file
```

## REST API

```
POST   /api/board/:id/items              — add items
DELETE /api/board/:id/items              — remove items
PATCH  /api/board/:id/items/:itemId      — update item
GET    /api/board/:id/search?q=&tag=     — text search
GET    /api/board/:id/semantic?q=        — semantic search
POST   /api/board/:id/arrange            — layout arrangement
GET    /api/board/:id/brief              — creative brief export
POST   /api/board/:id/lesson             — generate lesson
GET    /api/board/:id/lesson             — get lesson data
POST   /api/ai/chat                      — AI chat (multi-provider)
GET    /api/ai/providers                 — list available providers
GET    /api/ai/models/:provider          — scan provider models
GET    /api/ai/status/:provider          — check provider status
POST   /api/scan/models                  — scan local filesystem
GET    /api/scan/auto                    — auto-scan common locations
POST   /api/ai/generate-image            — image generation (proxied)
GET    /api/unsplash/search?q=           — image search (proxied)
GET    /api/agents                       — list connected agents
POST   /api/agents/register              — register agent
GET    /api/operations                   — view operation history
GET    /api/conflicts                    — view conflicts
POST   /api/files/write                  — write file to workspace
GET    /api/files/read                   — read file from workspace
GET    /api/files/list                   — list files in workspace
DELETE /api/files/delete                  — delete file
POST   /api/files/rename                 — rename file
GET    /api/workspace                    — get workspace info
GET    /api/git/status                   — git status
POST   /api/git/commit                   — commit changes
GET    /api/git/log                      — commit history
```

## Keyboard Shortcuts

Press `?` for in-app help.

| Key | Action | Key | Action |
|-----|--------|-----|--------|
| `N` | New note | `P` | New palette |
| `T` | New text | `G` | New gradient |
| `I` | New image | `F` | New font |
| `L` | New link | `V` | New video |
| `/` | Quick input | `Space` | AI respond to note |
| `Ctrl+K` | Search | `Ctrl+Z` | Undo |
| `Ctrl+A` | Select all | `Ctrl+Shift+Z` | Redo |
| `Ctrl+C` | Copy | `Ctrl+D` | Duplicate |
| `Ctrl+V` | Paste | `0` | Reset zoom |
| `Delete` | Delete selected | `Escape` | Cancel/deselect |
| Double-click | Create blank card | Right-click | Context menu |
| `Alt+Drag` | Annotate | `?` | Show help |

## Platform

- **Web** — any browser
- **Windows** — Tauri desktop app (auto-starts server)
- **macOS** — Tauri desktop app
- **Linux** — Tauri desktop app
- **PWA** — installable, works offline
- **Railway** — Express server + MCP SSE
- **Code splitting** — vendor/store/UI chunks
- **Compression** — gzip/brotli

## License

Apache 2.0