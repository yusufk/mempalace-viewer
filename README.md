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
┌─────────────┐     ┌──────────────┐     ┌──────────────────────┐
│  React +    │────▶│  API Server  │────▶│  mcp   → MemPalace   │
│  Three.js   │     │  (Python)    │     │          MCP server  │
│  Frontend   │◀────│  port 3001   │◀────│  local → ChromaDB    │
└─────────────┘     └──────────────┘     └──────────────────────┘
```

- **Frontend**: React + [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) + [@react-three/drei](https://github.com/pmndrs/drei)
- **API**: Python HTTP server with two interchangeable backends
- **Data**: a MemPalace palace, local or remote

### Backends

| `PALACE_BACKEND` | Talks to                         | Use when                                                                                                  |
|------------------|----------------------------------|-----------------------------------------------------------------------------------------------------------|
| `mcp` (default)  | A MemPalace MCP server over HTTP | The palace lives on another machine, reached through an SSH tunnel. Nothing but Python is needed locally. |
| `local`          | The ChromaDB palace directory    | The palace is on this filesystem and `chromadb` is installed.                                             |

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Python](https://python.org/) 3.10+ (`chromadb` only for the `local` backend)
- A mined MemPalace — local, or an MCP server you can reach

## Quick Start — remote palace over SSH (default)

The palace runs on a server; only its MCP port is forwarded.

```bash
# 1. Tunnel the MCP port. Keep this window open.
ssh -N -L 9000:127.0.0.1:9000 user@your-server

# 2. API server — connects to http://127.0.0.1:9000/mcp
python api/server.py          # Windows: scripts\start-api.bat

# 3. Dev server
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to the API server, so the
browser stays same-origin and no CORS setup is needed.

## Quick Start — local palace

```bash
PALACE_BACKEND=local PALACE_PATH=~/.mempalace/palace python api/server.py
npm run dev
```

## Configuration

| Variable          | Default                     | Meaning                                       |
|-------------------|-----------------------------|-----------------------------------------------|
| `PALACE_BACKEND`  | `mcp`                       | `mcp` or `local`                              |
| `MEMPALACE_MCP`   | `http://127.0.0.1:9000/mcp` | MCP endpoint (`mcp` backend)                  |
| `PALACE_PATH`     | `~/.mempalace/palace`       | Palace directory (`local` backend)            |
| `API_PORT`        | `3001`                      | API listen port                               |
| `CACHE_TTL`       | `300`                       | Seconds before the drawer cache is re-fetched |
| `VITE_API_TARGET` | `http://127.0.0.1:3001`     | Proxy target for `npm run dev`                |
| `VITE_API_URL`    | `/api`                      | Bypass the proxy and call an API directly     |

Start with `GET /api/health` — it reports the backend, the endpoint and the
connected MCP server version. That is the fastest way to tell a dead tunnel
apart from an empty palace.

## API Endpoints

| Endpoint                                      | Description                                     |
|-----------------------------------------------|-------------------------------------------------|
| `GET /api/health`                             | Backend, endpoint, connected server, cache size |
| `GET /api/stats`                              | Drawer count + wing/room structure              |
| `GET /api/structure`                          | Wing → room → count tree                        |
| `GET /api/drawers?wing=&room=&limit=&offset=` | List drawers (content is a preview)             |
| `GET /api/drawer?id=`                         | One drawer with its full content                |
| `GET /api/search?q=&limit=`                   | Semantic search across all memories             |
| `GET /api/similar?id=&limit=`                 | Drawers similar to one drawer, other rooms only |
| `GET /api/tunnels`                            | Explicit cross-wing tunnels                     |
| `GET /api/refresh`                            | Force a drawer cache reload                     |

## Notes on the MCP backend

- `mempalace_list_drawers` pages at 100 per call, so the whole drawer list is
  cached in memory (`CACHE_TTL`) and search hits are rejoined to real drawer ids
  via `(wing, room, filed_at)`.
- Drawer counts differ by design: `stats.total` counts raw records including
  chunks, `stats.listed` counts the parent drawers actually rendered.
- List responses carry a ~200 char preview; the full text is fetched per drawer
  when you click one.

## Offline / blocked networks

3D labels use a bundled copy of JetBrains Mono (`public/fonts/`). Without an
explicit font, troika-three-text resolves one from the jsDelivr CDN — and if
that host is unreachable, typesetting fails and the entire scene renders
nothing at all, with no error in the console.

## License

MIT
