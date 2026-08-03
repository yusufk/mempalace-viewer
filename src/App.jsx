import { useState, useEffect, useMemo, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import PalaceView from './components/PalaceView'
import DrawerPanel from './components/DrawerPanel'
import { api } from './api'
import './App.css'

export default function App() {
  const [structure, setStructure] = useState({})
  const [stats, setStats] = useState({ total: 0 })
  const [selected, setSelected] = useState(null)
  const [drawers, setDrawers] = useState([])
  const [activeDrawer, setActiveDrawer] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [hidden, setHidden] = useState(new Set())
  const [connections, setConnections] = useState(null) // { source, similar }
  const [showConnections, setShowConnections] = useState(true)
  const [tunnels, setTunnels] = useState([])
  const [showTunnels, setShowTunnels] = useState(true)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [s, struct, ds] = await Promise.all([api.stats(), api.structure(), api.drawers(2500)])
        if (cancelled) return
        setStats(s)
        setStructure(struct)
        setDrawers(ds)
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
      // Tunnels are optional — a palace with none is normal.
      try {
        const t = await api.tunnels()
        if (!cancelled) setTunnels(Array.isArray(t) ? t : [])
      } catch { if (!cancelled) setTunnels([]) }
    })()
    return () => { cancelled = true }
  }, [])

  // Selection is now camera-only — drawers stay loaded via visibility toggles

  const handleSearch = async (q) => {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResults(null); return }
    try {
      setSearchResults(await api.search(q, 20))
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleDrawerClick = useCallback(async (drawer) => {
    setActiveDrawer(drawer)
    // Navigate camera to the drawer's room
    setSelected({ wing: drawer.wing, room: drawer.room })
    if (!drawer.id) return
    // The list only carries a preview — pull the full text for the panel.
    if (drawer.preview || !drawer.content) {
      try {
        const full = await api.drawer(drawer.id)
        setActiveDrawer(prev => (prev?.id === drawer.id ? { ...prev, ...full, preview: false } : prev))
      } catch { /* keep the preview */ }
    }
    if (showConnections) {
      try {
        setConnections(await api.similar(drawer.id, 8))
      } catch { setConnections(null) }
    }
  }, [showConnections])

  const toggleHidden = (key) => {
    setHidden(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const isHidden = (wing, room) => {
    if (hidden.has(wing)) return true
    if (room && hidden.has(`${wing}/${room}`)) return true
    return false
  }

  const visibleStructure = useMemo(() => {
    const s = {}
    for (const [wing, rooms] of Object.entries(structure)) {
      if (hidden.has(wing)) continue
      const visRooms = {}
      for (const [room, count] of Object.entries(rooms)) {
        if (!hidden.has(`${wing}/${room}`)) visRooms[room] = count
      }
      if (Object.keys(visRooms).length > 0) s[wing] = visRooms
    }
    return s
  }, [structure, hidden])

  const visibleDrawers = useMemo(() => {
    const source = searchResults || drawers
    return source.filter(d => !isHidden(d.wing, d.room))
  }, [searchResults, drawers, hidden])

  return (
    <div className="app">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        structure={structure}
        stats={stats}
        selected={selected}
        onSelect={setSelected}
        onSearch={handleSearch}
        searchQuery={searchQuery}
        searchResults={searchResults}
        onDrawerClick={handleDrawerClick}
        hidden={hidden}
        onToggleHidden={toggleHidden}
        onShowAll={() => setHidden(new Set())}
        onHideAll={() => {
          const all = new Set()
          for (const wing of Object.keys(structure)) all.add(wing)
          setHidden(all)
        }}
        showConnections={showConnections}
        onToggleConnections={() => { setShowConnections(v => !v); if (showConnections) setConnections(null) }}
        showTunnels={showTunnels}
        onToggleTunnels={() => setShowTunnels(v => !v)}
        tunnelCount={tunnels.length}
      />
      <main className={`main ${sidebarOpen ? '' : 'expanded'}`}>
        {error && (
          <div className="api-error">
            <strong>API unreachable</strong>
            <span>{error}</span>
            <span className="api-error-hint">
              Is the tunnel up and <code>python api/server.py</code> running on {api.base}?
            </span>
          </div>
        )}
        {loading && !error && <div className="api-loading">loading palace…</div>}
        <PalaceView
          structure={visibleStructure}
          selected={selected}
          onSelect={setSelected}
          drawers={visibleDrawers}
          onDrawerClick={handleDrawerClick}
          connections={showConnections ? connections : null}
          tunnels={showTunnels ? tunnels : []}
        />
      </main>
      {activeDrawer && (
        <DrawerPanel drawer={activeDrawer} onClose={() => { setActiveDrawer(null) }} />
      )}
    </div>
  )
}
