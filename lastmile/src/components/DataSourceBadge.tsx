import { Activity, CloudOff, FlaskConical, Loader } from 'lucide-react';
import type { ControllerLink } from '../api/useControllerLink';

/**
 * DataSourceBadge — States plainly where the numbers on screen come from.
 *
 * The single most important honesty affordance in the UI. Simulated figures
 * shown without qualification are how this project's original performance
 * claims became misleading, so the source is always on screen and a failed
 * live connection is reported rather than quietly papered over with
 * simulation data.
 */
export default function DataSourceBadge({ link }: { link: ControllerLink }) {
  if (link.requestedMode === 'demo') {
    return (
      <div className="source-badge demo" title="Figures come from the in-browser simulation model">
        <FlaskConical size={11} aria-hidden="true" />
        <span>SIMULATION</span>
      </div>
    );
  }

  if (link.state === 'connecting') {
    return (
      <div className="source-badge connecting">
        <Loader size={11} className="spin" aria-hidden="true" />
        <span>CONNECTING…</span>
      </div>
    );
  }

  if (link.state === 'unavailable') {
    return (
      <div className="source-badge unavailable" role="alert">
        <CloudOff size={11} aria-hidden="true" />
        <span>CONTROLLER UNREACHABLE — SHOWING SIMULATION</span>
        <button className="source-badge-retry" onClick={link.retry}>RETRY</button>
      </div>
    );
  }

  const switches = link.status?.connectedSwitches.length ?? 0;
  const expected = link.status?.expectedSwitches.length ?? 0;

  return (
    <div
      className="source-badge live"
      title={`Live counters from the Ryu controller at ${link.controllerUrl}`}
    >
      <Activity size={11} aria-hidden="true" />
      <span>LIVE — {switches}/{expected} SWITCHES</span>
      {link.status && !link.status.qosActive && (
        <span className="source-badge-warn">QUEUES NOT APPLIED</span>
      )}
    </div>
  );
}
