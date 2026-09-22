# MoodBored

A collaborative mood-board workspace where humans and LLMs brainstorm together visually.

## Quick Start

```bash
# Install dependencies
npm install

# Run web dev server
npm run dev
```

## Architecture

- **Bend 2 core** (`bend/`): Data model, laws, proofs, search logic
- **TypeScript frontend** (`src/`): React app with infinite canvas, chat, search
- **Tauri** (`src-tauri/`): macOS desktop wrapper
- **iOS** (`ios/`): Native iOS app with WKWebView

## Build Targets

### Web (any browser, including Windows)

```bash
npm run build          # outputs to dist/
npm run preview        # preview production build
```

### macOS Desktop (Tauri)

```bash
npx tauri build        # produces .app and .dmg
# Output: src-tauri/target/release/bundle/macos/MoodBored.app
# Output: src-tauri/target/release/bundle/dmg/MoodBored_1.0.0_aarch64.dmg
```

### iOS

```bash
# Build for simulator
xcodebuild -project ios/MoodBored.xcodeproj -scheme MoodBored \
  -destination 'platform=iOS Simulator,name=iPhone 17' build

# Build for device
xcodebuild -project ios/MoodBored.xcodeproj -scheme MoodBored \
  -destination 'generic/platform=iOS' build
```

## Bend 2 Core

The pure data model, laws, and proofs live in `bend/`.

```bash
# Check model
bend bend/model.bend

# Run proofs (must print "All terms check.")
bend bend/PROOF.bend

# Check search module
bend bend/search.bend
```

### Laws (invariants)

Every law in `LAWS.bend` must be proven in `PROOF.bend`. Run `bend PROOF.bend` after every change.

| Law | Description |
|-----|-------------|
| `media_has_metadata` | Image/Link/Video items carry description, purpose, source |
| `id_is_deterministic` | `Item.id` returns the same value for the same item |
| `pos_is_stable` | `Item.pos` returns the same position for the same item |
| `search_text_total` | `Item.search_text` always terminates |
| `tags_total` | `Item.tags` always terminates |

## Features

- Infinite canvas with pan/zoom, drag-and-drop, multi-select
- Chat panel with LLM streaming (OpenRouter)
- AI can add items to canvas via structured JSON actions
- Full-text search across all item fields + tag filters
- Item inspector with editable metadata
- Export/import as JSON (round-trippable)
- Multiple projects with viewports
- Settings for API keys, models, themes
- Dark-mode-first UI

## Configuration

Open Settings (gear icon) to configure:
- **OpenRouter API Key**: Required for chat/agent features
- **Default Model**: LLM model for chat (default: `anthropic/claude-sonnet-4`)
- **Jev Threshold**: Coherence threshold for agent loop (0-1)
- **Canvas Background**: Dark theme presets

## Project JSON Format

```json
{
  "id": "uuid",
  "name": "My Board",
  "viewports": [
    {
      "id": "uuid",
      "name": "Main",
      "items": [
        {
          "kind": "note",
          "id": "uuid",
          "text": "Hello world",
          "purpose": "Greeting",
          "importance": "First item",
          "tags": ["intro"],
          "pos": { "x": 100, "y": 200 }
        }
      ],
      "camX": 0,
      "camY": 0,
      "zoom": 1
    }
  ],
  "settings": {
    "apiKey": "",
    "defaultModel": "anthropic/claude-sonnet-4",
    "jevThreshold": 0.7,
    "theme": "dark",
    "canvasBg": "#0a0a0f"
  },
  "created": "2026-01-01T00:00:00.000Z",
  "updated": "2026-01-01T00:00:00.000Z"
}
```

## Item Types

| Kind | Required Fields |
|------|----------------|
| `text` | `raw`, `pos`, `size` |
| `image` | `description`, `purpose`, `importance`, `source`, `tags`, `pos`, `size` |
| `link` | `url`, `description`, `purpose`, `importance`, `source`, `tags`, `pos` |
| `note` | `text`, `purpose`, `importance`, `tags`, `pos` |
| `video` | `subjectDesc`, `motionDesc`, `purpose`, `importance`, `sourceUrl`, `tags`, `pos`, `size` |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl/Cmd+K` | Open search |
| `Ctrl/Cmd+A` | Select all items |
| `Delete/Backspace` | Delete selected items |
| `Shift+Click` | Toggle item selection |
| `Alt+Drag` | Pan canvas |
| `Scroll` | Zoom in/out |

## License

MIT
