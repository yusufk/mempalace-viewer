import { useState } from 'react'

export default function Sidebar({ open, onToggle, structure, stats, selected, onSelect, onSearch, searchQuery }) {
  const [query, setQuery] = useState(searchQuery || '')

  const handleKey = (e) => {
    if (e.key === 'Enter') onSearch(query)
  }

  return (
    <>
      <button className="sidebar-toggle" onClick={onToggle}>
        {open ? '◀' : '▶'}
      </button>
      <aside className={`sidebar ${open ? '' : 'closed'}`}>
        <div className="sidebar-header">
          <h1>🏛 MemPalace</h1>
          <div className="stats">{stats.total} drawers indexed</div>
        </div>
        <input
          className="search-box"
          placeholder="Search memories..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
        />
        <div className="wing-list">
          {Object.entries(structure).map(([wing, rooms]) => (
            <div key={wing}>
              <div
                className={`wing-item ${selected?.wing === wing && !selected?.room ? 'active' : ''}`}
                onClick={() => onSelect({ wing, room: null })}
              >
                {wing.replace(/_/g, ' ')}
              </div>
              {Object.entries(rooms).map(([room, count]) => (
                <div
                  key={room}
                  className={`room-item ${selected?.wing === wing && selected?.room === room ? 'active' : ''}`}
                  onClick={() => onSelect({ wing, room })}
                >
                  <span>{room.replace(/_/g, ' ')}</span>
                  <span className="room-count">{count}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </aside>
    </>
  )
}
