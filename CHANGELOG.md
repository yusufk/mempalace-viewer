# Changelog
All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]
### Added

- **MCP backend.** `api/server.py` can now read the palace from a MemPalace MCP
  server over HTTP instead of a local ChromaDB directory. Select it with
  `PALACE_BACKEND=mcp` (the new default) and point `MEMPALACE_MCP` at the
  endpoint — `http://127.0.0.1:9000/mcp` by default, which is what an SSH
  tunnel to the palace host forwards. Nothing has to be installed or changed on
  the remote host.
- `api/mcp_client.py` — minimal MCP client for the Streamable HTTP transport:
  session handshake, SSE frame parsing, and a re-initialize-and-retry when the
  server restarts and the session id goes stale.
- `GET /api/health` — reports the active backend, the endpoint, the connected
  MCP server's name and version, and the cache size. Distinguishes a dead
  tunnel from an empty palace in one request.
- `GET /api/drawer?id=` — one drawer with its full content. List responses only
  carry a ~200 character preview, so the panel fetches the full text on click.
- `GET /api/similar?id=` and `GET /api/refresh` on the MCP backend; `/api/refresh`
  forces a drawer cache reload.
- `src/api.js` — single place where the API base is resolved. Defaults to `/api`
  through the Vite proxy; override with `VITE_API_URL`.
- Vite dev proxy: `/api` → `http://127.0.0.1:3001` (`VITE_API_TARGET` to change
  it). The browser stays same-origin, so no CORS configuration is needed.
- Error and loading banners over the 3D view. An unreachable API now says so
  instead of showing an empty black canvas.
- `scripts/start-api.bat` — starts the API server on Windows with the MCP
  backend preconfigured.
- `public/fonts/JetBrainsMono-Regular.ttf` (SIL Open Font License, included as
  `OFL.txt`), used for all 3D labels.

### Fixed

- **The 3D scene rendered nothing and nothing was clickable when the jsDelivr
  CDN was unreachable.** `drei`'s `<Text>` has no font of its own, so
  troika-three-text resolved one from
  `cdn.jsdelivr.net/gh/lojjic/unicode-font-resolver`. When that host times out,
  typesetting rejects inside the worker, the scene never builds, and the only
  console output is an unattributed `TypeError: Failed to fetch` — there are no
  meshes to click because there are no meshes. Every label now uses the bundled
  JetBrains Mono, which also covers Cyrillic and Greek, so the unicode fallback
  resolver never reaches for the network either.
- Search results are joinable back to real drawers again. `mempalace_search`
  returns no drawer id, so hits are rejoined via `(wing, room, created_at)`;
  without an id they had no 3D position and no connections.
- Chunks of one drawer no longer appear as separate results. Search and
  similarity responses are deduplicated by drawer id, keeping the closest
  match — previously the same drawer repeated and React saw duplicate keys.
- `DrawerPanel` derives its title from Windows paths as well as POSIX ones
  (`split(/[\\/]/)`), and shows the full path as a tooltip.
- ESLint no longer reports `'process' is not defined` in `vite.config.js`;
  config files are now linted with Node globals.

### Changed

- The frontend no longer hardcodes `http://localhost:3001/api`.
- The whole drawer list is cached in memory on the MCP backend (`CACHE_TTL`,
  300s by default) because `mempalace_list_drawers` pages at 100 per call.
- `/api/stats` reports both `total` (raw records, chunks included — what
  `mempalace_status` counts) and `listed` (parent drawers actually rendered).
  These legitimately differ.
- The `local` ChromaDB backend is unchanged in behaviour and still available via
  `PALACE_BACKEND=local`.
- `troika-three-text` is now a direct dependency; it was previously only
  reachable transitively through `@react-three/drei`.
- README documents both backends, the tunnel setup, every environment variable,
  and the CDN font trap.
