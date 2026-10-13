# MoodBored

Collaborative mood-board canvas where humans and LLMs brainstorm together.

## Quick reference

| Action | Command |
|--------|---------|
| Start dev server | `npm run dev` |
| Start production | `npm start` |
| Build | `npm run build` |
| MCP stdio | `npx tsx mcp/mcp-server.ts` |

## MCP connection

```json
{
  "command": "npx",
  "args": ["tsx", "/path/to/MoodBored/mcp/mcp-server.ts"]
}
```

## Tools

`get_board`, `view_images`, `discuss_items`, `add_items`, `remove_items`, `update_item`, `search_items`, `semantic_search`, `related_items`, `arrange_items`, `clear_board`

`view_images` returns board images as vision-ready pixels — use it when the
user asks about how images look. `discuss_items` selects specific items by id
and returns their full contents (text + pixels) — use it when the user asks
about particular objects; this mirrors the user's select-and-talk flow in chat.
Chat with a vision model also sees board images automatically.

## REST API

```
GET  /api/boards
POST /api/boards
POST /api/board/:id/items
GET  /api/board/:id/search?q=
GET  /api/board/:id/semantic?q=
POST /api/board/:id/arrange
```

## Workflow

User describes what they want → add items to the board. The board window
opens automatically on the first write (chromeless localhost window).
Always add items when the user describes anything. Use real Unsplash URLs for images.

## Board window

Mutating MCP tools auto-open the board in a chromeless window
(`chrome`/`edge --app=http://localhost:3000/board/<id>`, default browser as
fallback) and auto-start `server.mjs` if nothing is listening. Each tool
response includes `Board: <url>`.

| Env var | Effect |
|---------|--------|
| `MOODBORED_URL` | Board base URL (default `http://localhost:3000`) |
| `MOODBORED_BOARD_ID` | Target board (default: most recently modified) |
| `MOODBORED_BOARDS_DIR` | Boards directory (default `~/.moodbored/boards`) |
| `MOODBORED_AUTO_OPEN=0` | Disable the auto-opening window |
| `MOODBORED_NO_SERVER=1` | Never auto-start `server.mjs` |
