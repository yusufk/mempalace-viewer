"""MemPalace Viewer API.

Two backends, same REST contract:

  mcp    (default) — talks to a MemPalace MCP server over HTTP. Works against a
                     remote palace through an SSH tunnel; nothing is installed
                     on this machine except Python.
  local            — opens the ChromaDB palace directory directly (requires
                     `chromadb` and a palace on this filesystem).

Env vars:
  PALACE_BACKEND   mcp | local          (default: mcp)
  MEMPALACE_MCP    MCP endpoint URL     (default: http://127.0.0.1:9000/mcp)
  PALACE_PATH      local palace dir     (default: ~/.mempalace/palace)
  API_PORT         listen port          (default: 3001)
"""
import json
import os
import sys
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

BACKEND = os.environ.get("PALACE_BACKEND", "mcp").lower()
MCP_URL = os.environ.get("MEMPALACE_MCP", "http://127.0.0.1:9000/mcp")
PALACE_PATH = os.environ.get("PALACE_PATH", os.path.expanduser("~/.mempalace/palace"))
PORT = int(os.environ.get("API_PORT", "3001"))
CACHE_TTL = int(os.environ.get("CACHE_TTL", "300"))

# MCP search caps the query at 250 chars.
QUERY_MAX = 250


# ── MCP backend ───────────────────────────────────────────────────────────────
class MCPBackend:
    """Maps MCP tools onto the viewer's REST shapes.

    The drawer list is cached wholesale: `mempalace_list_drawers` pages at 100
    per call, so a few thousand drawers cost a handful of seconds — worth it to
    make search results joinable back to drawer ids.
    """

    name = "mcp"
    PAGE = 100

    def __init__(self, url):
        from mcp_client import MCPClient

        self.mcp = MCPClient(url)
        self.url = url
        self._lock = threading.Lock()
        self._cache = None  # {"drawers": [...], "index": {...}, "ts": float}

    # -- cache ----------------------------------------------------------------
    def _load_all(self):
        drawers, offset, total = [], 0, None
        while True:
            page = self.mcp.call("mempalace_list_drawers", {"limit": self.PAGE, "offset": offset})
            items = page.get("drawers", []) if isinstance(page, dict) else []
            if not items:
                break
            for raw in items:
                drawers.append(_norm_drawer(raw))
            offset += len(items)
            total = page.get("total", total)
            if total is not None and offset >= total:
                break
            if len(items) < self.PAGE:
                break

        # (wing, room, filed_at) → id — lets search hits reuse real drawer ids.
        index, by_id = {}, {}
        for d in drawers:
            by_id[d["id"]] = d
            filed = d.get("filed_at")
            if filed:
                index.setdefault((d["wing"], d["room"], filed), d["id"])
        return {"drawers": drawers, "index": index, "by_id": by_id, "ts": time.time()}

    def _all(self):
        with self._lock:
            if self._cache is None or (time.time() - self._cache["ts"]) > CACHE_TTL:
                self._cache = self._load_all()
            return self._cache

    def refresh(self):
        with self._lock:
            self._cache = self._load_all()
            return len(self._cache["drawers"])

    # -- endpoints ------------------------------------------------------------
    def stats(self):
        status = self.mcp.call("mempalace_status")
        structure = self.structure()
        total = status.get("total_drawers") if isinstance(status, dict) else None
        cached = self._all()["drawers"]
        return {
            "total": total if total is not None else len(cached),
            "listed": len(cached),  # parents only — chunks collapse into one drawer
            "structure": structure,
            "wings": status.get("wings", {}) if isinstance(status, dict) else {},
        }

    def structure(self):
        tax = self.mcp.call("mempalace_get_taxonomy")
        if isinstance(tax, dict) and "taxonomy" in tax:
            return tax["taxonomy"]
        return tax if isinstance(tax, dict) else {}

    def drawers(self, wing=None, room=None, limit=500, offset=0):
        items = self._all()["drawers"]
        if wing:
            items = [d for d in items if d["wing"] == wing]
        if room:
            items = [d for d in items if d["room"] == room]
        return items[offset: offset + limit]

    def drawer(self, drawer_id):
        raw = self.mcp.call("mempalace_get_drawer", {"drawer_id": drawer_id})
        if not isinstance(raw, dict) or raw.get("error"):
            return None
        meta = raw.get("metadata") or {}
        return {
            "id": raw.get("drawer_id", drawer_id),
            "wing": raw.get("wing") or meta.get("wing", "unknown"),
            "room": raw.get("room") or meta.get("room", "unknown"),
            "content": raw.get("content", ""),
            **{k: v for k, v in meta.items() if k not in ("wing", "room")},
        }

    def search(self, query, limit=10):
        res = self.mcp.call(
            "mempalace_search", {"query": query[:QUERY_MAX], "limit": max(1, min(limit, 100))}
        )
        results = res.get("results", []) if isinstance(res, dict) else []
        return _dedupe([self._hit(h, i) for i, h in enumerate(results)])

    def similar(self, drawer_id, limit=8):
        src = self.drawer(drawer_id)
        if not src:
            return {"source": None, "similar": []}
        query = " ".join((src.get("content") or "").split())[:QUERY_MAX]
        if not query:
            return {"source": {"id": drawer_id, "wing": src["wing"], "room": src["room"]}, "similar": []}

        res = self.mcp.call(
            "mempalace_search", {"query": query, "limit": min(limit + 20, 100)}
        )
        results = res.get("results", []) if isinstance(res, dict) else []
        candidates = []
        for i, h in enumerate(results):
            hit = self._hit(h, i)
            if hit["id"] == drawer_id:
                continue
            if hit["wing"] == src["wing"] and hit["room"] == src["room"]:
                continue
            candidates.append(
                {"id": hit["id"], "wing": hit["wing"], "room": hit["room"], "distance": hit["distance"]}
            )
        # Chunks of one drawer collapse to the same parent id — keep the closest.
        hits = _dedupe(candidates)[:limit]
        return {"source": {"id": drawer_id, "wing": src["wing"], "room": src["room"]}, "similar": hits}

    def tunnels(self):
        res = self.mcp.call("mempalace_list_tunnels")
        items = res if isinstance(res, list) else res.get("tunnels", []) if isinstance(res, dict) else []
        out = []
        for t in items:
            out.append({
                "id": t.get("id", ""),
                "label": t.get("label", ""),
                "source": t.get("source") or {"wing": t.get("source_wing", ""), "room": t.get("source_room", "")},
                "target": t.get("target") or {"wing": t.get("target_wing", ""), "room": t.get("target_room", "")},
            })
        return out

    def health(self):
        info = self.mcp.ping()
        cache = self._cache
        return {
            "backend": "mcp",
            "endpoint": self.url,
            "server": info,
            "cached_drawers": len(cache["drawers"]) if cache else 0,
        }

    # -- helpers --------------------------------------------------------------
    def _hit(self, h, i):
        """MCP search hits carry no drawer id — rejoin one via (wing, room, created_at)."""
        wing = h.get("wing", "unknown")
        room = h.get("room", "unknown")
        created = h.get("created_at") or h.get("authored_at")
        cache = self._all()
        did = cache["index"].get((wing, room, created))
        snippet = h.get("text", "")
        parent = cache["by_id"].get(did) if did else None
        content = (parent or {}).get("content") or snippet
        return {
            "id": did or f"hit_{wing}_{room}_{i}",
            "wing": wing,
            "room": room,
            "content": content,
            "preview": bool(parent),  # parent preview — /api/drawer has the full text
            "snippet": snippet,
            "distance": h.get("distance", h.get("effective_distance", 1.0)),
            "similarity": h.get("similarity"),
            "source_file": h.get("source_file", ""),
            "filed_at": created,
            "resolved": bool(did),
        }


# ── local ChromaDB backend ────────────────────────────────────────────────────
class LocalBackend:
    name = "local"

    def __init__(self, path):
        import chromadb

        self.client = chromadb.PersistentClient(path=path)
        self.col = self.client.get_collection("mempalace_drawers")
        self.path = path
        self._structure = {"data": None, "ts": 0}

    def structure(self):
        now = time.time()
        if self._structure["data"] and (now - self._structure["ts"]) < CACHE_TTL:
            return self._structure["data"]
        tree, offset, batch_size = {}, 0, 5000
        while True:
            batch = self.col.get(include=["metadatas"], limit=batch_size, offset=offset)
            metas = batch["metadatas"]
            if not metas:
                break
            for m in metas:
                w, r = m.get("wing", "unknown"), m.get("room", "unknown")
                tree.setdefault(w, {}).setdefault(r, 0)
                tree[w][r] += 1
            if len(metas) < batch_size:
                break
            offset += batch_size
        self._structure = {"data": tree, "ts": now}
        return tree

    def stats(self):
        return {"total": self.col.count(), "structure": self.structure()}

    def drawers(self, wing=None, room=None, limit=500, offset=0):
        where = {}
        if wing and room:
            where = {"$and": [{"wing": wing}, {"room": room}]}
        elif wing:
            where = {"wing": wing}
        elif room:
            where = {"room": room}
        result = self.col.get(
            where=where or None, include=["documents", "metadatas"], limit=limit, offset=offset
        )
        return [
            {"id": result["ids"][i], "content": doc, **result["metadatas"][i]}
            for i, doc in enumerate(result["documents"])
        ]

    def drawer(self, drawer_id):
        result = self.col.get(ids=[drawer_id], include=["documents", "metadatas"])
        if not result["documents"]:
            return None
        return {"id": drawer_id, "content": result["documents"][0], **result["metadatas"][0]}

    def search(self, query, limit=10):
        result = self.col.query(
            query_texts=[query], n_results=limit, include=["documents", "metadatas", "distances"]
        )
        return [
            {
                "id": result["ids"][0][i],
                "content": doc,
                "distance": result["distances"][0][i],
                **result["metadatas"][0][i],
            }
            for i, doc in enumerate(result["documents"][0])
        ]

    def similar(self, drawer_id, limit=8):
        source = self.col.get(ids=[drawer_id], include=["documents", "metadatas"])
        if not source["documents"]:
            return {"source": None, "similar": []}
        src_meta = source["metadatas"][0]
        result = self.col.query(
            query_texts=[source["documents"][0]],
            n_results=limit + 20,
            include=["metadatas", "distances"],
        )
        hits = []
        for i, rid in enumerate(result["ids"][0]):
            meta = result["metadatas"][0][i]
            if not meta or rid == drawer_id:
                continue
            if meta.get("wing") == src_meta.get("wing") and meta.get("room") == src_meta.get("room"):
                continue
            hits.append({
                "id": rid,
                "wing": meta.get("wing", "?"),
                "room": meta.get("room", "?"),
                "distance": result["distances"][0][i],
            })
            if len(hits) >= limit:
                break
        return {
            "source": {"id": drawer_id, "wing": src_meta.get("wing"), "room": src_meta.get("room")},
            "similar": hits,
        }

    def tunnels(self):
        try:
            closets = self.client.get_collection("mempalace_closets")
            results = closets.get(where={"type": "tunnel"}, include=["metadatas"])
        except Exception:
            return []
        return [
            {
                "id": results["ids"][i],
                "label": meta.get("label", ""),
                "source": {"wing": meta.get("source_wing", ""), "room": meta.get("source_room", "")},
                "target": {"wing": meta.get("target_wing", ""), "room": meta.get("target_room", "")},
            }
            for i, meta in enumerate(results["metadatas"])
        ]

    def refresh(self):
        self._structure = {"data": None, "ts": 0}
        return self.col.count()

    def health(self):
        return {"backend": "local", "palace": self.path, "total": self.col.count()}


def _dedupe(hits):
    """One entry per drawer id, keeping the closest match. Order preserved."""
    best = {}
    for h in hits:
        prev = best.get(h["id"])
        if prev is None or h.get("distance", 1.0) < prev.get("distance", 1.0):
            best[h["id"]] = h
    seen, out = set(), []
    for h in hits:
        if h["id"] in seen:
            continue
        seen.add(h["id"])
        out.append(best[h["id"]])
    return out


def _norm_drawer(raw):
    """list_drawers item → viewer drawer shape (content is a ~200 char preview)."""
    meta = raw.get("metadata") or {}
    d = {
        "id": raw.get("drawer_id", ""),
        "wing": raw.get("wing") or meta.get("wing", "unknown"),
        "room": raw.get("room") or meta.get("room", "unknown"),
        "content": raw.get("content_preview", ""),
        "preview": True,
    }
    for k, v in meta.items():
        if k in ("wing", "room") or k in d:
            continue
        d[k] = v
    if raw.get("chunks"):
        d["chunks"] = raw["chunks"]
    return d


# ── HTTP layer ────────────────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    backend = None

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, data, status=200):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self._cors()
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        url = urlparse(self.path)
        qs = parse_qs(url.query)
        arg = lambda k, default=None: qs.get(k, [default])[0]

        try:
            if url.path == "/api/health":
                self._json(self.backend.health())
            elif url.path == "/api/structure":
                self._json(self.backend.structure())
            elif url.path == "/api/stats":
                self._json(self.backend.stats())
            elif url.path == "/api/drawers":
                self._json(self.backend.drawers(
                    wing=arg("wing"),
                    room=arg("room"),
                    limit=int(arg("limit", "50")),
                    offset=int(arg("offset", "0")),
                ))
            elif url.path == "/api/drawer":
                did = arg("id", "")
                if not did:
                    self._json({"error": "missing ?id="}, 400)
                    return
                drawer = self.backend.drawer(did)
                self._json(drawer if drawer else {"error": "not found"}, 200 if drawer else 404)
            elif url.path == "/api/search":
                q = arg("q", "")
                if not q:
                    self._json({"error": "missing ?q="}, 400)
                    return
                self._json(self.backend.search(q, limit=int(arg("limit", "10"))))
            elif url.path == "/api/similar":
                did = arg("id", "")
                if not did:
                    self._json({"error": "missing ?id="}, 400)
                    return
                self._json(self.backend.similar(did, limit=int(arg("limit", "8"))))
            elif url.path == "/api/tunnels":
                self._json(self.backend.tunnels())
            elif url.path == "/api/refresh":
                self._json({"refreshed": self.backend.refresh()})
            else:
                self._json({"error": "not found"}, 404)
        except Exception as exc:
            traceback.print_exc()
            self._json({"error": f"{type(exc).__name__}: {exc}"}, 502)

    def log_message(self, fmt, *args):
        pass  # quiet


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


def build_backend():
    if BACKEND == "local":
        return LocalBackend(PALACE_PATH)
    if BACKEND != "mcp":
        raise SystemExit(f"unknown PALACE_BACKEND={BACKEND!r} (expected 'mcp' or 'local')")
    backend = MCPBackend(MCP_URL)
    info = backend.mcp.ping()
    print(f"  connected: {info.get('name', '?')} v{info.get('version', '?')} @ {MCP_URL}")
    return backend


if __name__ == "__main__":
    print(f"MemPalace API — backend={BACKEND}")
    Handler.backend = build_backend()

    # Warm the drawer cache off the request path.
    threading.Thread(
        target=lambda: print(f"  cache warm: {Handler.backend.refresh()} drawers"), daemon=True
    ).start()

    print(f"  listening on http://127.0.0.1:{PORT}")
    ThreadedHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
