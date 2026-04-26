export default function DrawerPanel({ drawer, onClose }) {
  const filed = drawer.filed_at ? new Date(drawer.filed_at).toLocaleString() : 'unknown'

  return (
    <div className="drawer-panel">
      <div className="drawer-panel-header">
        <h3>{drawer.source_file?.split('/').pop() || 'Drawer'}</h3>
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
