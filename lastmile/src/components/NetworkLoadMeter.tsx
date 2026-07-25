import { PRIORITY_COLORS } from '../simulation';
import type { BandwidthAllocation, Priority, SimulationState } from '../simulation';
import { cssVars } from '../lib/cssVars';

const TICKS = [100, 80, 60, 40, 20, 0];

const BANDS: { level: Priority; key: keyof BandwidthAllocation }[] = [
  { level: 'P1', key: 'p1' },
  { level: 'P2', key: 'p2' },
  { level: 'P3', key: 'p3' },
  { level: 'P4', key: 'p4' },
  { level: 'P5', key: 'p5' },
];

function loadColor(value: number): string {
  if (value >= 80) return 'var(--p1-critical)';
  if (value >= 60) return 'var(--p3-moderate)';
  return 'var(--p4-low)';
}

/**
 * NetworkLoadMeter — Vertical gauge showing 0-100% network load
 * with priority bandwidth breakdown bars.
 */
interface NetworkLoadMeterProps {
  state: SimulationState;
}

export default function NetworkLoadMeter({ state }: NetworkLoadMeterProps) {
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
      <div className="load-meter-gauge" style={cssVars({ '--tone': fillColor, '--level': clamped / 100 })}>
        <div className={`load-meter-bar-track ${isHighLoad ? 'high' : ''}`}>
          <div className="load-meter-bar-fill" />
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
        style={cssVars({ '--tone': fillColor })}
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
          <div
            key={level}
            className="priority-bar-row"
            style={cssVars({ '--tone': PRIORITY_COLORS[level], '--share': `${bw[key]}%` })}
          >
            <div className="priority-bar-dot" />
            <div className="priority-bar-track">
              <div className="priority-bar-fill" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
