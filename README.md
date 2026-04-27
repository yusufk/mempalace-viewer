# MemPalace Viewer

A 3D blueprint-style viewer for [MemPalace](https://github.com/milla-jovovich/mempalace) — the AI memory system that mines projects and conversations into a searchable palace.

![MemPalace Viewer](https://raw.githubusercontent.com/yusufk/mempalace-viewer/main/screenshot.png?v=3)

## Features

- **3D mansion layout** — wings, rooms, hallways, and curved staircases rendered as wireframe blueprints
- **Multi-floor** — every 3 wings get their own floor, connected by staircases
- **Interactive drawers** — click any memory cube to read its content in a side panel
- **Semantic search** — search memories and see results listed in the sidebar + highlighted in 3D
- **Visibility toggles** — show/hide wings and rooms with checkboxes
- **Blueprint aesthetic** — dark background, cyan wireframes, fog, grid floor

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  React +    │────▶│  API Server  │────▶│  ChromaDB Palace │
│  Three.js   │     │  (Python)    │     │  (~/.mempalace/) │
│  Frontend   │◀────│  port 3001   │◀────│                  │
└─────────────┘     └──────────────┘     └──────────────────┘
```

- **Frontend**: React + [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) + [@react-three/drei](https://github.com/pmndrs/drei)
- **API**: Simple Python HTTP server that reads from the ChromaDB palace
- **Data**: MemPalace ChromaDB database (created by `mempalace mine`)

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Python](https://python.org/) 3.10+ with `mempalace` installed (`pip install mempalace`)
- A mined MemPalace at `~/.mempalace/palace/`

## Quick Start

```bash
# Install dependencies
npm install

# Start the API server (reads from ~/.mempalace/palace)
python api/server.py &

# Start the dev server
npm run dev
```

Open http://localhost:5173

## Configuration

The API server reads from `~/.mempalace/palace` by default. Override with environment variables:

```bash
PALACE_PATH=/path/to/palace API_PORT=3001 python api/server.py
```

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/stats` | Total drawer count + wing/room structure |
| `GET /api/structure` | Wing → room → count tree |
| `GET /api/drawers?wing=&room=&limit=` | List drawers, optionally filtered |
| `GET /api/search?q=&limit=` | Semantic search across all memories |

## License

MIT
