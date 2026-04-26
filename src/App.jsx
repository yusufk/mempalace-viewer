import { useState, useEffect, useMemo } from 'react'
import Sidebar from './components/Sidebar'
import PalaceView from './components/PalaceView'
import DrawerPanel from './components/DrawerPanel'
import './App.css'

const API = 'http://localhost:3001/api'

export default function App() {
  const [structure, setStructure] = useState({})
  const [stats, setStats] = useState({ total: 0 })
  const [selected, setSelected] = useState(null)
  const [drawers, setDrawers] = useState([])
  const [activeDrawer, setActiveDrawer] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [hiddenWings, setHiddenWings] = useState(new Set())

  useEffect(() => {
    fetch(`${API}/stats`).then(r => r.json()).then(setStats)
    fetch(`${API}/structure`).then(r => r.json()).then(setStructure)
    fetch(`${API}/drawers?limit=2500`).then(r => r.json()).then(setDrawers)
  }, [])

  useEffect(() => {
    if (!selected) return
    const params = new URLSearchParams()
    if (selected.wing) params.set('wing', selected.wing)
    if (selected.room) params.set('room', selected.room)
    params.set('limit', '100')
    fetch(`${API}/drawers?${params}`).then(r => r.json()).then(setDrawers)
  }, [selected])

  const handleSearch = async (q) => {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResults(null); return }
    const res = await fetch(`${API}/search?q=${encodeURIComponent(q)}&limit=20`)
    setSearchResults(await res.json())
  }

  const toggleWing = (wing) => {
    setHiddenWings(prev => {
      const next = new Set(prev)
      next.has(wing) ? next.delete(wing) : next.add(wing)
      return next
    })
  }

  const visibleStructure = useMemo(() => {
    const s = {}
    for (const [wing, rooms] of Object.entries(structure)) {
      if (!hiddenWings.has(wing)) s[wing] = rooms
    }
    return s
  }, [structure, hiddenWings])

  const visibleDrawers = useMemo(() => {
    const source = searchResults || drawers
    return source.filter(d => !hiddenWings.has(d.wing))
  }, [searchResults, drawers, hiddenWings])

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
        onDrawerClick={setActiveDrawer}
        hiddenWings={hiddenWings}
        onToggleWing={toggleWing}
      />
      <main className={`main ${sidebarOpen ? '' : 'expanded'}`}>
        <PalaceView
          structure={visibleStructure}
          selected={selected}
          onSelect={setSelected}
          drawers={visibleDrawers}
          onDrawerClick={setActiveDrawer}
        />
      </main>
      {activeDrawer && (
        <DrawerPanel drawer={activeDrawer} onClose={() => setActiveDrawer(null)} />
      )}
    </div>
  )
}
