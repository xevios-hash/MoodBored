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

`get_board`, `add_items`, `remove_items`, `update_item`, `search_items`, `semantic_search`, `related_items`, `arrange_items`, `clear_board`

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

User describes what they want → add items to the board → tell user the URL.
Always add items when the user describes anything. Use real Unsplash URLs for images.
