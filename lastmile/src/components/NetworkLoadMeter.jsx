import { PRIORITY_COLORS } from '../simulation';

const TICKS = [100, 80, 60, 40, 20, 0];

const BANDS = [
  { level: 'P1', key: 'p1' },
  { level: 'P2', key: 'p2' },
  { level: 'P3', key: 'p3' },
  { level: 'P4', key: 'p4' },
  { level: 'P5', key: 'p5' },
];

function loadColor(value) {
  if (value >= 80) return 'var(--p1-critical)';
  if (value >= 60) return 'var(--p3-moderate)';
  return 'var(--p4-low)';
}

/**
 * NetworkLoadMeter — Vertical gauge showing 0-100% network load
 * with priority bandwidth breakdown bars.
 */
export default function NetworkLoadMeter({ state }) {
  // networkLoad is carried as a float so the approach curve converges;
  // it is rounded only for display.
  const load = Math.round(state.networkLoad);
  const clamped = Math.max(0, Math.min(load, 100));
  const bw = state.bandwidthAllocation;

  const fillColor = loadColor(clamped);
  const isHighLoad = clamped >= 80;

  return (
    <div className="load-meter">
      <div className="load-meter-title">NETWORK LOAD</div>

      {/* Gauge and its scale share a grid row, so the tick labels line up
          with the track instead of stacking underneath it. */}
      <div className="load-meter-gauge">
        <div className={`load-meter-bar-track ${isHighLoad ? 'high' : ''}`}>
          <div
            className="load-meter-bar-fill"
            style={{
              transform: `scaleY(${clamped / 100})`,
              background: fillColor,
              boxShadow: `0 0 8px ${fillColor}66`,
            }}
          />
        </div>

        <div className="load-meter-ticks" aria-hidden="true">
          {TICKS.map(t => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>

      {/* Read-out sits below the gauge, where it can never be clipped by the
          track's overflow at 0% or 100%. */}
      <div
        className="load-meter-readout"
        style={{ color: fillColor }}
        role="meter"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Network load"
      >
        {clamped}%
      </div>

      <div className="load-meter-breakdown">
        <div className="load-meter-breakdown-title">BW SHARE</div>
        {BANDS.map(({ level, key }) => (
          <div key={level} className="priority-bar-row">
            <div className="priority-bar-dot" style={{ background: PRIORITY_COLORS[level] }} />
            <div className="priority-bar-track">
              <div
                className="priority-bar-fill"
                style={{ width: `${bw[key]}%`, background: PRIORITY_COLORS[level] }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
