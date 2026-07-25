/**
 * types.ts — The shapes the simulation is built from.
 *
 * Several defects fixed earlier in this project were type errors in
 * disguise: a mode assigned from a hardcoded string literal that dropped
 * failure state, a config row addressed by array index rather than id, a
 * priority compared with `<=` as a string. The unions below are deliberately
 * closed so that class of mistake fails to compile.
 */

export type Priority = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

/** Display state of the network. `critical` is transient. */
export type Mode = 'normal' | 'stressed' | 'critical' | 'failure';

/** What produced a log entry. Governs how the row renders. */
export type EventKind = 'traffic' | 'system' | 'infra' | 'note';

export type EventStatus = 'delivered' | 'dropped' | 'note';

export interface Point {
  x: number;
  y: number;
}

export interface Department {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Traffic class emitted at rest. Drives room and particle colour. */
  baselinePriority?: Priority;
  /** Whether this department can originate a P1 alert. */
  alertCapable?: boolean;
  isServer?: boolean;
}

export interface Stream {
  id: string;
  from: string;
  to: string;
  priority: Priority;
  label: string;
  particleCount: number;
  speed: number;
  active: boolean;
  /** Single-shot particle emitted by a P1 alert. */
  isAlertParticle?: boolean;
}

export interface NodeState {
  active: boolean;
}

export type NodeMap = Record<string, NodeState>;

export interface LogEntry {
  id: string;
  timestamp: string;
  kind: EventKind;
  /** null for infrastructure events, which carry no traffic class. */
  priority: Priority | null;
  label: string;
  deliveredIn: number | null;
  status: EventStatus;
}

export interface Alert {
  id: string;
  priority: Priority;
  label: string;
  firedAt: number;
  deliveredIn: number;
  untriagedTime: number;
  status: EventStatus;
  /** Load sampled when the alert fired, so the comparison view is stable. */
  networkLoadAtFire: number;
}

export interface PriorityRow {
  id: string;
  type: string;
  level: Priority;
  /** Streams this row governs. Authoritative; replaced an index lookup. */
  streamIds: string[];
  /** P1 is pinned to the protected queue and cannot be reassigned. */
  locked?: boolean;
}

export interface BandwidthAllocation {
  p1: number;
  p2: number;
  p3: number;
  p4: number;
  p5: number;
}

export interface SimulationState {
  /** Carried as a float so the approach curve converges; rounded to display. */
  networkLoad: number;
  bandwidthAllocation: BandwidthAllocation;
  activeStreams: Stream[];
  nodes: NodeMap;
  activeAlerts: Alert[];
  eventLog: LogEntry[];
  mode: Mode;
  priorityConfig: PriorityRow[];
}

export type AlertType = 'cardiac' | 'ventilator' | 'crashcart';

export type Action =
  | { type: 'TICK'; elapsedSeconds: number }
  | { type: 'LOG_BASELINE' }
  | { type: 'DROP_CHECK' }
  | { type: 'SIMULATE_STRESS' }
  | { type: 'TRIGGER_ALERT'; alertType: AlertType }
  | { type: 'END_ALERT' }
  | { type: 'TOGGLE_NODE'; name: string }
  | { type: 'SET_PRIORITY'; rowId: string; level: Priority }
  | { type: 'RESET' };

export interface SimulationContext {
  random: () => number;
  now: () => number;
  nextId: (prefix?: string) => string;
  timestamp: () => string;
}

export interface SimulationActions {
  triggerAlert: (alertType: AlertType) => void;
  simulateStress: () => void;
  resetNetwork: () => void;
  toggleNodeFailure: (name: string) => void;
  updatePriorityConfig: (rowId: string, level: Priority) => void;
}
