import { useState, useMemo } from 'react'

export default function Sidebar({ open, onToggle, structure, stats, selected, onSelect, onSearch, searchQuery, searchResults, onDrawerClick, hidden, onToggleHidden, onShowAll, onHideAll, showConnections, onToggleConnections }) {
  const [query, setQuery] = useState(searchQuery || '')

  const handleKey = (e) => {
    if (e.key === 'Enter') onSearch(query)
  }

  // Group wings into floors of 3
  const floors = useMemo(() => {
    const wings = Object.keys(structure)
    const f = []
    for (let i = 0; i < wings.length; i += 3) {
      f.push(wings.slice(i, i + 3).map(w => ({ name: w, rooms: structure[w] })))
    }
    return f
  }, [structure])

  return (
    <>
      <aside className={`sidebar ${open ? '' : 'closed'}`}>
        <div className="sidebar-header">
          <h1>🏛 MemPalace</h1>
          <button className="sidebar-toggle-inline" onClick={onToggle}>✕</button>
          <div className="stats">{stats.total} drawers indexed</div>
        </div>
        <input
          className="search-box"
          placeholder="Search memories..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
        />

        {searchResults && searchResults.length > 0 && (
          <div className="search-results">
            <div className="search-results-header">
              {searchResults.length} results
              <button className="search-clear" onClick={() => { setQuery(''); onSearch('') }}>clear</button>
            </div>
            {searchResults.map(d => (
              <div key={d.id} className="search-result-item" onClick={() => onDrawerClick(d)}>
                <div className="search-result-meta">{d.wing} / {d.room}</div>
                <div className="search-result-text">{d.content?.slice(0, 120)}…</div>
                <div className="search-result-score">{(1 - d.distance).toFixed(2)} match</div>
              </div>
            ))}
          </div>
        )}

        <div className="bulk-actions">
          <button onClick={onShowAll}>Show all</button>
          <button onClick={onHideAll}>Hide all</button>
        </div>

        <div className="connections-toggle">
          <label className="vis-checkbox">
            <input type="checkbox" checked={showConnections} onChange={onToggleConnections} />
          </label>
          <span>Show connections on click</span>
        </div>

        <div className="floor-list">
          {floors.map((wings, fi) => (
            <div key={fi} className="floor-group">
              <div className="floor-label">Floor {fi + 1}</div>
              {wings.map(({ name: wing, rooms }) => (
                <div key={wing}>
                  <div className={`wing-item ${selected?.wing === wing && !selected?.room ? 'active' : ''}`}>
                    <label className="vis-checkbox" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={!hidden.has(wing)} onChange={() => onToggleHidden(wing)} />
                    </label>
                    <span onClick={() => onSelect({ wing, room: null })}>
                      {wing.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {Object.entries(rooms).map(([room, count]) => (
                    <div key={room} className={`room-item ${selected?.wing === wing && selected?.room === room ? 'active' : ''}`}>
                      <label className="vis-checkbox" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={!hidden.has(wing) && !hidden.has(`${wing}/${room}`)} onChange={() => onToggleHidden(`${wing}/${room}`)} />
                      </label>
                      <span onClick={() => onSelect({ wing, room })}>{room.replace(/_/g, ' ')}</span>
                      <span className="room-count">{count}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </aside>
      {!open && (
        <button className="sidebar-toggle" onClick={onToggle}>☰</button>
      )}
    </>
  )
}
