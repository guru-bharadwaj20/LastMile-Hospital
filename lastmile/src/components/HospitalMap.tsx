import {
  DEPARTMENTS,
  DEPARTMENT_NODES,
  SERVER,
  MAP_VIEWBOX,
  departmentColor,
  getRoomCenter,
  getNodeCenter,
} from '../simulation';
import type { NodeMap } from '../simulation';

/**
 * HospitalMap — SVG hospital floor plan with department rooms,
 * network nodes, and connection edges to the server room.
 *
 * Shares MAP_VIEWBOX and the geometry helpers with TrafficStream so the
 * particle layer stays registered to the nodes at every viewport size.
 */
interface HospitalMapProps {
  nodes: NodeMap;
}

export default function HospitalMap({ nodes }: HospitalMapProps) {
  const serverNode = getNodeCenter(SERVER);

  return (
    <div className="hospital-map-container">
      <svg
        className="hospital-map-svg"
        viewBox={MAP_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Hospital floor plan showing department network nodes and their links to the central server"
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(31,41,55,0.3)"
              strokeWidth="0.5"
            />
          </pattern>
          <filter id="glow-blue" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width="800" height="450" fill="url(#grid)" />

        {/* Network edges — node circle to node circle, so the traffic
            particles in the overlay travel exactly along these lines. */}
        {DEPARTMENT_NODES.map(dept => {
          const from = getNodeCenter(dept);
          const isActive = nodes[dept.label] ? nodes[dept.label].active : true;
          return (
            <line
              key={`edge-${dept.id}`}
              className={`network-edge ${isActive ? 'active' : 'inactive'}`}
              x1={from.x}
              y1={from.y}
              x2={serverNode.x}
              y2={serverNode.y}
              stroke={isActive ? departmentColor(dept) : 'var(--text-dim)'}
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Department rooms */}
        {DEPARTMENTS.map(dept => {
          const center = getRoomCenter(dept);
          const node = getNodeCenter(dept);
          const isServer = Boolean(dept.isServer);
          const isActive = isServer ? true : (nodes[dept.label] ? nodes[dept.label].active : true);
          const color = departmentColor(dept);
          const strokeColor = isActive ? color : 'var(--text-dim)';
          const corners = [
            [dept.x, dept.y, 12, 0], [dept.x, dept.y, 0, 12],
            [dept.x + dept.w, dept.y, -12, 0], [dept.x + dept.w, dept.y, 0, 12],
            [dept.x, dept.y + dept.h, 12, 0], [dept.x, dept.y + dept.h, 0, -12],
            [dept.x + dept.w, dept.y + dept.h, -12, 0], [dept.x + dept.w, dept.y + dept.h, 0, -12],
          ];

          return (
            <g key={dept.id} className={`dept-group ${isActive ? 'is-online' : 'is-offline'}`}>
              <rect
                className="dept-rect"
                x={dept.x}
                y={dept.y}
                width={dept.w}
                height={dept.h}
                stroke={strokeColor}
                strokeOpacity={isServer ? 0.6 : isActive ? 0.4 : 0.15}
              />

              {corners.map(([x, y, dx, dy], i) => (
                <line
                  key={i}
                  x1={x} y1={y} x2={x + dx} y2={y + dy}
                  stroke={strokeColor}
                  strokeWidth="2"
                />
              ))}

              <text className="dept-label" x={center.x} y={center.y - (isServer ? 14 : 8)}>
                {dept.label}
              </text>

              {isServer ? (
                <text className="dept-sublabel" x={center.x} y={center.y + 6}>
                  NETWORK HUB
                </text>
              ) : (
                <text className="dept-sublabel" x={center.x} y={center.y + 8}>
                  {isActive ? `${dept.baselinePriority} BASELINE` : 'OFFLINE'}
                </text>
              )}

              {/* P1 capability marker for departments that originate alerts */}
              {!isServer && dept.alertCapable && isActive && (
                <text className="dept-alert-capable" x={dept.x + dept.w - 8} y={dept.y + 16}>
                  P1
                </text>
              )}

              <circle
                className={`network-node ${isServer ? 'server' : isActive ? 'active' : 'dead'}`}
                cx={node.x}
                cy={node.y}
                r={isServer ? 14 : 8}
                fill={isActive ? color : 'var(--text-dim)'}
                opacity={isActive ? 0.8 : 0.3}
                filter={isServer ? 'url(#glow-blue)' : undefined}
              />
              {!isServer && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={3}
                  fill={isActive ? color : 'var(--text-dim)'}
                  opacity={isActive ? 1 : 0.3}
                />
              )}
            </g>
          );
        })}

        <text className="map-footer-label" x="400" y="440">
          FLOOR PLAN — BUILDING A — LEVEL 2
        </text>
      </svg>
    </div>
  );
}
