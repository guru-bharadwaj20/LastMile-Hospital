import { PRIORITY_COLORS, SERVER_COLOR } from '../simulation';
import { cssVars } from '../lib/cssVars';

/**
 * PriorityLegend — Horizontal strip below the map showing priority colour
 * codes. Colours come from the same table the map and particles use, so the
 * legend cannot drift out of sync with what is rendered.
 */
const LEGEND_ITEMS = [
  { label: 'P1 Critical',   color: PRIORITY_COLORS.P1 },
  { label: 'P2 Urgent',     color: PRIORITY_COLORS.P2 },
  { label: 'P3 Moderate',   color: PRIORITY_COLORS.P3 },
  { label: 'P4 Low',        color: PRIORITY_COLORS.P4 },
  { label: 'P5 Background', color: PRIORITY_COLORS.P5 },
  { label: 'Server',        color: SERVER_COLOR },
];

export default function PriorityLegend() {
  return (
    <div className="priority-legend">
      <div className="legend-title">Priority</div>
      <ul className="legend-items-row">
        {LEGEND_ITEMS.map((item) => (
          <li key={item.label} className="legend-item" style={cssVars({ '--tone': item.color })}>
            <span className="legend-color" />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
