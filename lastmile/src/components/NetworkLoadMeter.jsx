import { MOCK_NETWORK_LOAD, MOCK_BANDWIDTH } from '../simulation/networkState';

/**
 * NetworkLoadMeter — Vertical gauge showing 0-100% network load
 * with priority bandwidth breakdown bars.
 */
export default function NetworkLoadMeter() {
  const load = MOCK_NETWORK_LOAD;

  // Determine color based on load level
  const getLoadColor = (value) => {
    if (value >= 80) return 'var(--p1-critical)';
    if (value >= 60) return 'var(--p3-moderate)';
    return 'var(--p4-low)';
  };

  const fillColor = getLoadColor(load);
  const isHighLoad = load >= 80;

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
            height: `${load}%`,
            background: `linear-gradient(to top, ${fillColor}, ${fillColor}aa)`,
            boxShadow: `0 0 8px ${fillColor}66`,
          }}
        />
        {/* Percentage number positioned directly above the fill level */}
        <div
          className="load-meter-bar-value"
          style={{
            bottom: `${load}%`,
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
        {MOCK_BANDWIDTH.map((band) => (
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
