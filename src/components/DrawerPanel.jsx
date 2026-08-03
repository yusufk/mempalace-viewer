export default function DrawerPanel({ drawer, onClose }) {
  const filed = drawer.filed_at ? new Date(drawer.filed_at).toLocaleString() : 'unknown'
  // source_file may be a POSIX or a Windows path depending on where it was mined.
  const title = drawer.source_file?.split(/[\\/]/).pop() || 'Drawer'

  return (
    <div className="drawer-panel">
      <div className="drawer-panel-header" title={drawer.source_file || ''}>
        <h3>{title}</h3>
        <button className="drawer-panel-close" onClick={onClose}>✕</button>
      </div>
      <div className="drawer-panel-meta">
        <span>Wing: {drawer.wing}</span>
        <span>Room: {drawer.room}</span>
        <span>Filed: {filed}</span>
        <span>By: {drawer.added_by}</span>
        {drawer.distance !== undefined && (
          <span>Match: {(1 - drawer.distance).toFixed(3)}</span>
        )}
      </div>
      <div className="drawer-panel-content">
        {drawer.content}
      </div>
    </div>
  )
}
