/**
 * NetworkLoadMeter — Vertical gauge showing 0-100% network load
 * with priority bandwidth breakdown bars.
 * Layer 2: Wired to live simulation state.
 */
export default function NetworkLoadMeter({ state }) {
  const load = state.networkLoad;
  const bw = state.bandwidthAllocation;

  // Determine color based on load level
  const getLoadColor = (value) => {
    if (value >= 80) return 'var(--p1-critical)';
    if (value >= 60) return 'var(--p3-moderate)';
    return 'var(--p4-low)';
  };

  const fillColor = getLoadColor(load);
  const isHighLoad = load >= 80;

  const bandwidthBars = [
    { level: 'P1', color: '#ff2d2d', share: bw.p1 },
    { level: 'P2', color: '#ff6b2d', share: bw.p2 },
    { level: 'P3', color: '#fbbf24', share: bw.p3 },
    { level: 'P4', color: '#34d399', share: bw.p4 },
    { level: 'P5', color: '#4b5563', share: bw.p5 },
  ];

  return (
    <div className="load-meter">
      {/* "NETWORK LOAD" label at top */}
      <div className="load-meter-title">NETWORK LOAD</div>

      {/* Vertical bar gauge with percentage inside */}
      <div
        className="load-meter-bar-track"
        style={isHighLoad ? { animation: 'gauge-pulse 2s ease-in-out infinite' } : {}}
      >
        {/* Fill bar */}
        <div
          className="load-meter-bar-fill"
          style={{
            transform: `scaleY(${Math.max(0, Math.min(load, 100)) / 100})`,
            background: fillColor,
            boxShadow: `0 0 8px ${fillColor}66`,
          }}
        />
        {/* Percentage number positioned directly above the fill level */}
        <div
          className="load-meter-bar-value"
          style={{
            bottom: `calc(${Math.max(0, Math.min(load, 100))}% - 2px)`,
            color: fillColor,
          }}
        >
          {load}%
        </div>
      </div>

      {/* Tick marks alongside gauge */}
      <div className="load-meter-ticks">
        <span>100</span>
        <span>80</span>
        <span>60</span>
        <span>40</span>
        <span>20</span>
        <span>0</span>
      </div>

      {/* Priority bandwidth breakdown bars */}
      <div className="load-meter-breakdown">
        <div className="load-meter-breakdown-title">BW SHARE</div>
        {bandwidthBars.map((band) => (
          <div key={band.level} className="priority-bar-row">
            <div className="priority-bar-dot" style={{ background: band.color }} />
            <div className="priority-bar-track">
              <div
                className="priority-bar-fill"
                style={{
                  width: `${band.share}%`,
                  background: band.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
