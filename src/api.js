// API base. Dev: goes through the Vite proxy (`/api` → 127.0.0.1:3001), so no
// CORS and no hardcoded host. Override with VITE_API_URL for a remote API.
const BASE = import.meta.env.VITE_API_URL || '/api'

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = (await res.json()).error || detail
    } catch { /* non-JSON error body */ }
    throw new Error(`${path}: ${detail}`)
  }
  return res.json()
}

export const api = {
  base: BASE,
  health: () => get('/health'),
  stats: () => get('/stats'),
  structure: () => get('/structure'),
  drawers: (limit = 2500) => get(`/drawers?limit=${limit}`),
  drawer: (id) => get(`/drawer?id=${encodeURIComponent(id)}`),
  tunnels: () => get('/tunnels'),
  search: (q, limit = 20) => get(`/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  similar: (id, limit = 8) => get(`/similar?id=${encodeURIComponent(id)}&limit=${limit}`),
}
