import { useState } from 'react'

export default function Sidebar({ open, onToggle, structure, stats, selected, onSelect, onSearch, searchQuery, searchResults, onDrawerClick, hidden, onToggleHidden }) {
  const [query, setQuery] = useState(searchQuery || '')

  const handleKey = (e) => {
    if (e.key === 'Enter') onSearch(query)
  }

  return (
    <>
      <button className="sidebar-toggle" onClick={onToggle}>
        {open ? '✕' : '☰'}
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

        <div className="wing-list">
          {Object.entries(structure).map(([wing, rooms]) => (
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
                <div
                  key={room}
                  className={`room-item ${selected?.wing === wing && selected?.room === room ? 'active' : ''}`}
                >
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
      </aside>
    </>
  )
}
