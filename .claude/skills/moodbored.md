# MoodBored — Visual Mood Board for Creative Teams

## What it is

MoodBored is a collaborative mood-board canvas where humans and LLMs brainstorm together visually. It runs as a local dev server (`npm run dev`) or production server (`npm start`) and exposes an MCP server and REST API so any LLM can read, write, and arrange items on the board.

## When to use it

Use MoodBored when the user asks to:
- Create a mood board, brand board, or visual reference collection
- Explore color palettes, typography, or design direction visually
- Organize images, notes, fonts, and references on a canvas
- Generate a creative brief for another LLM to produce images/video/web
- Collaborate on visual ideas

## How to start it

```bash
cd /Users/x.hyperdex/OpenCodeApps/MoodBored
npm run dev        # starts at http://localhost:1420
# or
npm run build && npm start   # production at http://localhost:3000
```

## MCP connection (stdio, for this IDE)

The MCP server is at `mcp/mcp-server.ts`. Connect via stdio:

```json
{
  "command": "npx",
  "args": ["tsx", "/Users/x.hyperdex/OpenCodeApps/MoodBored/mcp/mcp-server.ts"]
}
```

If you know which board to target, pass an env var:
```json
{
  "command": "npx",
  "args": ["tsx", "/Users/x.hyperdex/OpenCodeApps/MoodBored/mcp/mcp-server.ts"],
  "env": { "MOODBORED_BOARD_ID": "<board-id>" }
}
```

Without a board ID, the server picks the most recently modified board.

## Board window (auto-open)

The first mutating MCP tool call opens the board in a chromeless window
(`chrome`/`edge --app=http://localhost:3000/board/<id>`, default browser as
fallback) and starts `server.mjs` if nothing is listening. Every mutating
tool response ends with `Board: <url>`. An already-open window live-updates
via SSE.

Env vars: `MOODBORED_URL` (base URL, default `http://localhost:3000`),
`MOODBORED_AUTO_OPEN=0` (disable window), `MOODBORED_NO_SERVER=1` (never
auto-start the server), `MOODBORED_BOARD_ID`, `MOODBORED_BOARDS_DIR`.

## MCP tools available

| Tool | What it does |
|------|-------------|
| `get_board` | Read the full board — items, palette, typography, layout, relationships |
| `view_images` | See board images as pixels (vision-ready blocks) so you can talk about how they look |
| `discuss_items` | Select items by id and get their full contents (text + pixels) to talk about them |
| `add_items` | Add items (notes, images, palettes, gradients, fonts, links, videos, containers, swatches, sizeguides) |
| `remove_items` | Delete items by ID |
| `update_item` | Edit any item's properties |
| `search_items` | Text + tag search across items |
| `semantic_search` | Meaning-based search ("warm coastal vibes" matches "golden sand") |
| `related_items` | Find items that complement a given item |
| `arrange_items` | Organize into grid, horizontal stack, vertical stack, or spiral |
| `clear_board` | Remove all items |

## REST API (for scripts, curl, external tools)

Base URL: `http://localhost:3000` (or your deployed URL)

```
GET    /api/boards                              — list all boards
POST   /api/boards                              — create {name}
GET    /api/board/:id                           — read full board
POST   /api/board/:id/items                     — add items [{kind, text, ...}]
DELETE /api/board/:id/items                     — remove {ids: [...]}
DELETE /api/board/:id/items/all                 — clear all
PATCH  /api/board/:id/items/:itemId             — update item properties
GET    /api/board/:id/search?q=&tag=&kind=      — text search
GET    /api/board/:id/semantic?q=               — semantic search
GET    /api/board/:id/items/:itemId/related     — related items
POST   /api/board/:id/arrange                   — {layout: "grid", cols: 4, gap: 20}
GET    /api/board/:id/brief?format=markdown     — creative brief
```

## Item kinds

| Kind | Key fields |
|------|-----------|
| `note` | `text`, `purpose`, `importance`, `tags` |
| `text` | `raw` |
| `image` | `description`, `source` (URL), `purpose`, `tags` |
| `link` | `url`, `title`, `summary`, `description` |
| `palette` | `label`, `colors: [{hex, label}]` |
| `gradient` | `label`, `stops: [{position, color}]`, `direction` |
| `font` | `fontFamily`, `weights`, `sampleText` |
| `swatch` | `hex`, `name`, `usage` |
| `sizeguide` | `width`, `height`, `unit`, `label` |
| `container` | `label`, `children`, `layout` (free/grid/stack-h/stack-v) |
| `video` | `subjectDesc`, `motionDesc`, `sourceUrl` |

All items accept `pos: {x, y}`, `size: {w, h}`, `purpose`, `importance`, `tags`.

## Common workflows

### Create a new board and populate it
```
1. POST /api/boards — get board ID
2. POST /api/board/{id}/items — add items in bulk
3. The board window opens automatically; report the `Board:` URL from the tool response
```

### Add items to an existing board via MCP
```
Use add_items tool with one or more items.
Items auto-position with collision avoidance.
```

### Search the board
```
search_items — exact text/tag match
semantic_search — meaning-based ("warm tones" matches "amber", "sunset")
```

### Export a creative brief
```
GET /api/board/:id/brief?format=markdown|json
GET /api/board/:id/context?ids=&topic=  — full contents of selected items (select-and-talk)
```

## Board data lives at

- Local: `~/.moodbored/boards/<id>.json`
- Web: Supabase (if configured)
- MCP server reads/writes the same files as the Express server

## Important notes

- The LLM should always add items when the user describes anything — don't just chat, populate the board.
- Use real Unsplash URLs for images: `https://images.unsplash.com/photo-XXXXX?w=800`
- The canvas auto-positions items with collision avoidance — no need to manually set x/y unless the user wants specific placement.
- Every item should have a `purpose` field explaining why it's on the board.
