"""MemPalace Viewer API — serves palace data from ChromaDB."""
import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

import chromadb

PALACE_PATH = os.environ.get("PALACE_PATH", os.path.expanduser("~/.mempalace/palace"))
PORT = int(os.environ.get("API_PORT", "3001"))

client = chromadb.PersistentClient(path=PALACE_PATH)
col = client.get_collection("mempalace_drawers")


def get_structure():
    """Return wings → rooms → counts."""
    all_meta = col.get(include=["metadatas"])["metadatas"]
    tree = {}
    for m in all_meta:
        w, r = m.get("wing", "unknown"), m.get("room", "unknown")
        tree.setdefault(w, {}).setdefault(r, 0)
        tree[w][r] += 1
    return tree


def get_drawers(wing=None, room=None, limit=2500, offset=0):
    """Return drawers with content, optionally filtered."""
    where = {}
    if wing and room:
        where = {"$and": [{"wing": wing}, {"room": room}]}
    elif wing:
        where = {"wing": wing}
    elif room:
        where = {"room": room}

    result = col.get(
        where=where if where else None,
        include=["documents", "metadatas"],
        limit=limit,
        offset=offset,
    )
    drawers = []
    for i, doc in enumerate(result["documents"]):
        meta = result["metadatas"][i]
        drawers.append({"id": result["ids"][i], "content": doc, **meta})
    return drawers


def search(query, limit=10):
    """Semantic search."""
    result = col.query(query_texts=[query], n_results=limit, include=["documents", "metadatas", "distances"])
    hits = []
    for i, doc in enumerate(result["documents"][0]):
        meta = result["metadatas"][0][i]
        hits.append({
            "id": result["ids"][0][i],
            "content": doc,
            "distance": result["distances"][0][i],
            **meta,
        })
    return hits


def get_tunnels():
    """Return rooms that connect across wings."""
    from mempalace.palace_graph import find_tunnels
    return find_tunnels()


def find_similar(drawer_id, limit=8):
    """Find drawers similar to a given drawer, across different rooms."""
    source = col.get(ids=[drawer_id], include=["documents", "metadatas"])
    if not source["documents"]:
        return []
    src_meta = source["metadatas"][0]
    results = col.query(
        query_texts=[source["documents"][0]],
        n_results=limit + 20,
        include=["metadatas", "distances"],
    )
    hits = []
    for i in range(len(results["ids"][0])):
        rid = results["ids"][0][i]
        meta = results["metadatas"][0][i]
        dist = results["distances"][0][i]
        if rid == drawer_id:
            continue
        if meta["wing"] == src_meta["wing"] and meta["room"] == src_meta["room"]:
            continue
        hits.append({"id": rid, "wing": meta["wing"], "room": meta["room"], "distance": dist})
        if len(hits) >= limit:
            break
    return {"source": {"id": drawer_id, "wing": src_meta["wing"], "room": src_meta["room"]}, "similar": hits}


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        url = urlparse(self.path)
        qs = parse_qs(url.query)

        if url.path == "/api/structure":
            self._json(get_structure())
        elif url.path == "/api/drawers":
            self._json(get_drawers(
                wing=qs.get("wing", [None])[0],
                room=qs.get("room", [None])[0],
                limit=int(qs.get("limit", [50])[0]),
                offset=int(qs.get("offset", [0])[0]),
            ))
        elif url.path == "/api/search":
            q = qs.get("q", [""])[0]
            if not q:
                self._json({"error": "missing ?q="}, 400)
                return
            self._json(search(q, limit=int(qs.get("limit", [10])[0])))
        elif url.path == "/api/stats":
            self._json({"total": col.count(), "structure": get_structure()})
        elif url.path == "/api/tunnels":
            self._json(get_tunnels())
        elif url.path == "/api/similar":
            did = qs.get("id", [""])[0]
            if not did:
                self._json({"error": "missing ?id="}, 400)
                return
            self._json(find_similar(did, limit=int(qs.get("limit", [8])[0])))
        else:
            self._json({"error": "not found"}, 404)

    def log_message(self, fmt, *args):
        pass  # quiet


if __name__ == "__main__":
    print(f"MemPalace API on http://localhost:{PORT} (palace: {PALACE_PATH})")
    HTTPServer(("", PORT), Handler).serve_forever()
