import { useRef, useEffect } from 'react';
import { DEPARTMENTS } from '../simulation/networkState';

/**
 * HospitalMap — SVG hospital floor plan with department rooms,
 * network nodes, and connection edges to the server room.
 */
export default function HospitalMap() {
  const svgRef = useRef(null);
  const server = DEPARTMENTS.find(d => d.isServer);
  const departments = DEPARTMENTS.filter(d => !d.isServer);

  // Compute node centers
  const getCenter = (dept) => ({
    x: dept.x + dept.w / 2,
    y: dept.y + dept.h / 2,
  });

  const serverCenter = getCenter(server);

  return (
    <div className="hospital-map-container">
      <svg
        ref={svgRef}
        className="hospital-map-svg"
        viewBox="0 0 800 420"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Background grid pattern */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(31,41,55,0.3)"
              strokeWidth="0.5"
            />
          </pattern>
          {/* Glow filters */}
          <filter id="glow-blue" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feFlood floodColor="#ff2d2d" floodOpacity="0.4" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="shadow" />
            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid background */}
        <rect width="800" height="420" fill="url(#grid)" />

        {/* Network edges — lines from each department to server */}
        {departments.map(dept => {
          const deptCenter = getCenter(dept);
          return (
            <line
              key={`edge-${dept.id}`}
              className="network-edge active"
              x1={deptCenter.x}
              y1={deptCenter.y}
              x2={serverCenter.x}
              y2={serverCenter.y}
              stroke={dept.color}
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Department rooms */}
        {DEPARTMENTS.map(dept => {
          const center = getCenter(dept);
          const isServer = dept.isServer;
          return (
            <g key={dept.id}>
              {/* Room rectangle */}
              <rect
                className="dept-rect"
                x={dept.x}
                y={dept.y}
                width={dept.w}
                height={dept.h}
                stroke={dept.color}
                strokeOpacity={isServer ? 0.6 : 0.4}
              />

              {/* Corner accents */}
              <line x1={dept.x} y1={dept.y} x2={dept.x + 12} y2={dept.y} stroke={dept.color} strokeWidth="2" />
              <line x1={dept.x} y1={dept.y} x2={dept.x} y2={dept.y + 12} stroke={dept.color} strokeWidth="2" />
              <line x1={dept.x + dept.w} y1={dept.y} x2={dept.x + dept.w - 12} y2={dept.y} stroke={dept.color} strokeWidth="2" />
              <line x1={dept.x + dept.w} y1={dept.y} x2={dept.x + dept.w} y2={dept.y + 12} stroke={dept.color} strokeWidth="2" />
              <line x1={dept.x} y1={dept.y + dept.h} x2={dept.x + 12} y2={dept.y + dept.h} stroke={dept.color} strokeWidth="2" />
              <line x1={dept.x} y1={dept.y + dept.h} x2={dept.x} y2={dept.y + dept.h - 12} stroke={dept.color} strokeWidth="2" />
              <line x1={dept.x + dept.w} y1={dept.y + dept.h} x2={dept.x + dept.w - 12} y2={dept.y + dept.h} stroke={dept.color} strokeWidth="2" />
              <line x1={dept.x + dept.w} y1={dept.y + dept.h} x2={dept.x + dept.w} y2={dept.y + dept.h - 12} stroke={dept.color} strokeWidth="2" />

              {/* Department label */}
              <text className="dept-label" x={center.x} y={center.y - (isServer ? 14 : 8)}>
                {dept.label}
              </text>
              {isServer && (
                <text className="dept-sublabel" x={center.x} y={center.y + 6}>
                  NETWORK HUB
                </text>
              )}
              {!isServer && (
                <text className="dept-sublabel" x={center.x} y={center.y + 8}>
                  P{dept.priority} TRAFFIC
                </text>
              )}

              {/* Network node */}
              <circle
                className={`network-node ${isServer ? 'server' : 'active'}`}
                cx={center.x}
                cy={center.y + (isServer ? 22 : 20)}
                r={isServer ? 14 : 8}
                fill={dept.color}
                opacity={0.8}
                filter={isServer ? 'url(#glow-blue)' : undefined}
              />
              {/* Inner dot for non-server nodes */}
              {!isServer && (
                <circle
                  cx={center.x}
                  cy={center.y + 20}
                  r={3}
                  fill={dept.color}
                  opacity={1}
                />
              )}
            </g>
          );
        })}

        {/* Status text bottom-right */}
        <text
          x="780"
          y="412"
          textAnchor="end"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '9px',
            fill: 'var(--text-dim)',
            letterSpacing: '1px',
          }}
        >
          FLOOR PLAN — BUILDING A — LEVEL 2
        </text>
      </svg>
    </div>
  );
}
