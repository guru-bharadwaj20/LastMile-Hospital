/**
 * PriorityLegend — Horizontal strip below the map showing priority color codes.
 */
const LEGEND_ITEMS = [
  { label: 'P1 Critical', color: '#ff2d2d' },
  { label: 'P2 Urgent', color: '#ff6b2d' },
  { label: 'P3 Moderate', color: '#fbbf24' },
  { label: 'P4 Low', color: '#34d399' },
  { label: 'P5 Background', color: '#4b5563' },
  { label: 'Server', color: '#38bdf8' },
];

export default function PriorityLegend() {
  return (
    <div className="priority-legend">
      <div className="legend-title">Priority</div>
      {LEGEND_ITEMS.map((item) => (
        <div key={item.label} className="legend-item">
          <span
            className="legend-color"
            style={{
              background: item.color,
              boxShadow: `0 0 4px ${item.color}44`,
            }}
          />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
