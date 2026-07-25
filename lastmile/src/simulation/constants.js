/**
 * constants.js — Static description of the simulated hospital network.
 *
 * Pure data and pure geometry helpers. No state, no React, no time.
 */

// ── Priority Colours ───────────────────────────────────────────
export const PRIORITY_COLORS = {
  P1: '#ff2d2d',
  P2: '#ff6b2d',
  P3: '#fbbf24',
  P4: '#34d399',
  P5: '#4b5563',
};

export const SERVER_COLOR = '#38bdf8';

/** Numeric rank for ordering comparisons. P1 is the most urgent. */
export const PRIORITY_RANK = { P1: 1, P2: 2, P3: 3, P4: 4, P5: 5 };

export const PRIORITY_LEVELS = ['P1', 'P2', 'P3', 'P4', 'P5'];

// ── Shared Map Geometry ────────────────────────────────────────
// HospitalMap and TrafficStream render as two stacked SVGs over the same
// box. They must therefore declare an identical viewBox, or the browser
// scales them differently and the particles drift off the nodes.
export const MAP_VIEWBOX = '0 0 800 450';

/** Offset from a room's centre down to its network node circle. */
const NODE_DY = { department: 20, server: 22 };

// ── Department Definitions ─────────────────────────────────────
// `baselinePriority` is the traffic class a department emits at rest, and it
// drives both the room colour and the particle colour, so the two can never
// disagree. `alertCapable` marks departments that can originate a P1 alert.
export const DEPARTMENTS = [
  { id: 'icu',       label: 'ICU',       baselinePriority: 'P2', alertCapable: true,  x: 80,  y: 20,  w: 160, h: 90 },
  { id: 'emergency', label: 'ER',        baselinePriority: 'P2', alertCapable: true,  x: 320, y: 20,  w: 160, h: 90 },
  { id: 'surgery',   label: 'SURGERY',   baselinePriority: 'P2', alertCapable: true,  x: 560, y: 20,  w: 160, h: 90 },
  { id: 'radiology', label: 'RADIOLOGY', baselinePriority: 'P3', alertCapable: false, x: 80,  y: 160, w: 160, h: 90 },
  { id: 'pharmacy',  label: 'PHARMACY',  baselinePriority: 'P3', alertCapable: false, x: 560, y: 160, w: 160, h: 90 },
  { id: 'admin',     label: 'ADMIN',     baselinePriority: 'P4', alertCapable: false, x: 80,  y: 300, w: 160, h: 90 },
  { id: 'staff',     label: 'STAFF',     baselinePriority: 'P5', alertCapable: false, x: 560, y: 300, w: 160, h: 90 },
  { id: 'server',    label: 'SERVER',    isServer: true,                               x: 300, y: 155, w: 200, h: 100 },
];

export const SERVER = DEPARTMENTS.find(d => d.isServer);
export const DEPARTMENT_NODES = DEPARTMENTS.filter(d => !d.isServer);

/** Colour for a department, derived from its priority so nothing can drift. */
export function departmentColor(dept) {
  return dept.isServer ? SERVER_COLOR : PRIORITY_COLORS[dept.baselinePriority];
}

/** Centre of a department's room rectangle. */
export function getRoomCenter(dept) {
  return { x: dept.x + dept.w / 2, y: dept.y + dept.h / 2 };
}

/** Centre of a department's network node circle. Traffic flows between these. */
export function getNodeCenter(dept) {
  return {
    x: dept.x + dept.w / 2,
    y: dept.y + dept.h / 2 + (dept.isServer ? NODE_DY.server : NODE_DY.department),
  };
}

// ── Timing ─────────────────────────────────────────────────────
export const SPEED = { fast: 400, medium: 800, slow: 1400 };

export const TIMING = {
  /** Load oscillator period, ms. */
  tickInterval: 500,
  /** Congestion drop check period, ms. */
  dropInterval: 1000,
  /** Baseline traffic log entries appear somewhere in this range, ms. */
  baselineLogMin: 3000,
  baselineLogMax: 6000,
  /** How long a P1 alert holds the network in critical mode, ms. */
  alertHoldMs: 800,
};

// ── Latency Model ──────────────────────────────────────────────
// Illustrative constants, not measurements. See "Simulation Parameters" in
// the root README for the reasoning and the caveat.
export const LATENCY = {
  base: { P1: 8, P2: 25, P3: 80, P4: 180, P5: 250 },
  loadFactor: 2.8,
  jitter: 10,
  untriagedBase: 180,
  untriagedLoadFactor: 3.2,
  untriagedJitter: 40,
};

// ── Load Model ─────────────────────────────────────────────────
export const LOAD = {
  initial: 42,
  normalCentre: 45,
  normalAmplitude: 5,
  normalPeriodS: 20,
  stressedCentre: 88,
  stressedAmplitude: 4,
  stressedPeriodS: 8,
  criticalTarget: 95,
  /** Exponential approach factor applied each tick. */
  smoothing: 0.15,
};

export const BANDWIDTH = {
  idle:     { p1: 0,  p2: 0,  p3: 0,  p4: 0,  p5: 0 },
  normal:   { p1: 25, p2: 20, p3: 25, p4: 18, p5: 12 },
  congested:{ p1: 35, p2: 25, p3: 20, p4: 12, p5: 8 },
};

// ── Limits ─────────────────────────────────────────────────────
export const MAX_LOG = 50;
export const MAX_ALERTS = 12;

/** Probability that a given P5 stream loses a packet on each drop check. */
export const P5_DROP_CHANCE = 0.4;

// ── Priority Config (sidebar table) ────────────────────────────
// `streamIds` is the authoritative link between a config row and the streams
// it governs. Every non-alert stream appears in exactly one row.
export const DEFAULT_PRIORITY_CONFIG = [
  { id: 'critical',   type: 'Cardiac / Code Blue Alerts',   level: 'P1', streamIds: [], locked: true },
  { id: 'vitals',     type: 'Vitals / Monitoring',          level: 'P2', streamIds: ['stream-icu', 'stream-er', 'stream-surgery'] },
  { id: 'clinical',   type: 'Imaging / Lab / Pharmacy',     level: 'P3', streamIds: ['stream-radiology', 'stream-pharmacy'] },
  { id: 'admin',      type: 'Admin / Reports / Bulk',       level: 'P4', streamIds: ['stream-admin', 'stress-radiology', 'stress-admin'] },
  { id: 'background', type: 'WiFi / Streaming / Browsers',  level: 'P5', streamIds: ['stream-staff', 'stress-staff'] },
];

// ── Traffic Streams ────────────────────────────────────────────
export function createBaselineStreams() {
  return [
    { id: 'stream-icu',       from: 'ICU',       to: 'SERVER', priority: 'P2', label: 'ICU Vitals',         particleCount: 4, speed: SPEED.fast,   active: true },
    { id: 'stream-er',        from: 'ER',        to: 'SERVER', priority: 'P2', label: 'Triage Data',        particleCount: 3, speed: SPEED.fast,   active: true },
    { id: 'stream-surgery',   from: 'SURGERY',   to: 'SERVER', priority: 'P2', label: 'Surgery Monitoring', particleCount: 3, speed: SPEED.fast,   active: true },
    { id: 'stream-radiology', from: 'RADIOLOGY', to: 'SERVER', priority: 'P3', label: 'Imaging Metadata',   particleCount: 2, speed: SPEED.medium, active: true },
    { id: 'stream-pharmacy',  from: 'PHARMACY',  to: 'SERVER', priority: 'P3', label: 'Order System',       particleCount: 2, speed: SPEED.medium, active: true },
    { id: 'stream-admin',     from: 'ADMIN',     to: 'SERVER', priority: 'P4', label: 'File Uploads',       particleCount: 2, speed: SPEED.slow,   active: true },
    { id: 'stream-staff',     from: 'STAFF',     to: 'SERVER', priority: 'P5', label: 'WiFi/Streaming',     particleCount: 3, speed: SPEED.medium, active: true },
  ];
}

export function createStressStreams() {
  return [
    { id: 'stress-radiology', from: 'RADIOLOGY', to: 'SERVER', priority: 'P4', label: 'Bulk Image Transfer', particleCount: 3, speed: SPEED.slow,   active: true },
    { id: 'stress-admin',     from: 'ADMIN',     to: 'SERVER', priority: 'P4', label: 'Admin Backup',        particleCount: 3, speed: SPEED.slow,   active: true },
    { id: 'stress-staff',     from: 'STAFF',     to: 'SERVER', priority: 'P5', label: 'HD Video Stream',     particleCount: 4, speed: SPEED.medium, active: true },
  ];
}

// ── Alert Definitions ──────────────────────────────────────────
export const ALERT_MAP = {
  cardiac:    { from: 'ICU',     label: 'Cardiac Arrest — ICU Bed 4',     priority: 'P1' },
  ventilator: { from: 'ICU',     label: 'Ventilator Alarm — ICU Bed 7',   priority: 'P1' },
  crashcart:  { from: 'SURGERY', label: 'Crash Cart Request — Surgery B', priority: 'P1' },
};
