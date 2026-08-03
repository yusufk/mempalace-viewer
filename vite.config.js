import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The API server (api/server.py) listens on 3001 and talks to the palace —
// either a local ChromaDB dir or a remote MemPalace MCP server over an SSH
// tunnel. Proxying keeps the browser same-origin, so no CORS setup is needed.
const API_TARGET = process.env.VITE_API_TARGET || 'http://127.0.0.1:3001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
})
