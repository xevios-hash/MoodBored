# Changelog

All notable changes to MoodBored will be documented in this file.

## [Unreleased]

### Added
- **File Nodes (IDE Layer)**: Files become first-class canvas nodes with syntax-highlighted preview, language badges, and full editor support
- **Chunking Mechanism**: Generic content chunking for large files arriving in segments from agents
- **File MCP Tools**: `read_file`, `write_file`, `list_files`, `delete_file`, `rename_file` for filesystem operations
- **Concurrency Hardening**: Version vectors, optimistic locking, and conflict detection for multi-agent writes
- **Agent Observability Dashboard**: Real-time view of connected agents, operations, and conflicts
- **14 AI Providers**: OpenRouter, OpenAI, Anthropic, Gemini, Groq, Together, Mistral, Cohere, Perplexity, Fireworks, DeepSeek, Ollama, LM Studio, Custom
- **Model Manager**: Native model scanning, catalog with HuggingFace models, runtime detection
- **Inference Orchestration**: Direct integration with llama.cpp, Ollama, LM Studio, ComfyUI, Automatic1111, Invoke AI
- **Canvas Conversations**: AI responds to notes directly on the board
- **Regions**: Colored, named boxes for organizing board areas
- **Schema Versioning**: Board format versioning with migration system
- **Offline Mode**: Full offline support for desktop builds
- **Quick Input Box**: Press `/` to create nodes with smart type detection
- **Export for AI**: Prompts for SD, Midjourney, DALL-E, video models, LLMs
- P0 security fixes (helmet, CORS, rate limiting, atomic writes)
- API proxy endpoints to keep keys server-side
- Enhanced right-click context menu with 20+ actions
- Annotation system (text, arrows, boxes, circles, highlights)
- Web node browser cards with resize and drag
- Snapshots and workspace management
- Chrome tab import
- MCP tools for AI board manipulation

### Changed
- Improved text contrast and legibility
- Simplified UI with less clutter
- Canvas takes full width by default
- Trackpad pinch-to-zoom now works

### Fixed
- Undo/redo history ordering
- Chat messages being lost
- AI tool calls producing duplicate items
- Video/GIF rendering behind canvas
- Blank card double input issue
- Export PNG crash on cross-origin images

### Security
- Removed arbitrary file write vulnerability (export_to_folder)
- API keys moved server-side
- CORS restricted to known origins
- Rate limiting on API endpoints
- Atomic file writes prevent corruption

## [1.0.0] - 2026-01-01

### Added
- Initial release
- Collaborative mood board canvas
- AI chat with tool-calling
- 12 item types
- MCP server integration
- Real-time collaboration
- Export/import functionality
