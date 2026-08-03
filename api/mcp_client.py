"""Minimal MCP client (Streamable HTTP transport) — talks to a MemPalace MCP server.

Only what the viewer needs: initialize, tools/list, tools/call.
Thread-safe: one session, one lock, auto re-initialize if the session dies.
"""
import json
import threading
import urllib.error
import urllib.request

PROTOCOL_VERSION = "2025-06-18"


class MCPError(RuntimeError):
    pass


class MCPClient:
    def __init__(self, url, timeout=120):
        self.url = url
        self.timeout = timeout
        self._lock = threading.Lock()
        self._session = None
        self._id = 0
        self.server_info = {}

    # ── transport ──────────────────────────────────────────────────────────
    def _post(self, body, notify=False):
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "MCP-Protocol-Version": PROTOCOL_VERSION,
        }
        if self._session:
            headers["Mcp-Session-Id"] = self._session
        req = urllib.request.Request(
            self.url, data=json.dumps(body).encode("utf-8"), headers=headers, method="POST"
        )
        resp = urllib.request.urlopen(req, timeout=self.timeout)
        sid = resp.headers.get("Mcp-Session-Id")
        if sid:
            self._session = sid
        raw = resp.read().decode("utf-8", "replace")
        if notify:
            return None
        if "text/event-stream" in (resp.headers.get("Content-Type") or ""):
            for line in raw.splitlines():
                if line.startswith("data:"):
                    return json.loads(line[5:].strip())
            raise MCPError("no data frame in SSE response")
        if not raw:
            raise MCPError("empty response")
        return json.loads(raw)

    def _rpc(self, method, params=None, notify=False):
        body = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            body["params"] = params
        if not notify:
            self._id += 1
            body["id"] = self._id
        msg = self._post(body, notify=notify)
        if notify:
            return None
        if "error" in msg:
            err = msg["error"]
            raise MCPError(f"{err.get('code')}: {err.get('message')}")
        return msg.get("result", {})

    def _initialize(self):
        self._session = None
        result = self._rpc(
            "initialize",
            {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": {"name": "mempalace-viewer", "version": "1.0"},
            },
        )
        self.server_info = result.get("serverInfo", {})
        self._rpc("notifications/initialized", {}, notify=True)
        return result

    def _ensure_session(self):
        if self._session is None:
            self._initialize()

    # ── public API ─────────────────────────────────────────────────────────
    def call(self, tool, arguments=None):
        """Call an MCP tool, return its parsed payload."""
        with self._lock:
            self._ensure_session()
            try:
                result = self._rpc("tools/call", {"name": tool, "arguments": arguments or {}})
            except (urllib.error.HTTPError, MCPError):
                # Stale session (server restarted / session expired) — retry once.
                self._initialize()
                result = self._rpc("tools/call", {"name": tool, "arguments": arguments or {}})

        if result.get("isError"):
            raise MCPError(_text_of(result) or f"{tool} failed")
        if result.get("structuredContent") is not None:
            return result["structuredContent"]
        text = _text_of(result)
        if text is None:
            return result
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return text

    def ping(self):
        with self._lock:
            self._initialize()
        return self.server_info


def _text_of(result):
    for block in result.get("content", []):
        if block.get("type") == "text":
            return block.get("text")
    return None
