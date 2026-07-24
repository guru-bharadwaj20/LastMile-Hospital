/**
 * networkState.js — Network Simulation Engine
 *
 * Exports useNetworkSimulation() — the custom React hook that drives
 * all UI state in the LastMile Hospital Network Triage System.
 * No backend required — everything runs in the browser.
 *
 * The latency numbers this produces are model constants, not measurements.
 * See "Simulation Parameters" in the root README.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

// ── Priority Colors ────────────────────────────────────────────
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

// ── Speed Constants (ms) ───────────────────────────────────────
const SPEED = { fast: 400, medium: 800, slow: 1400 };

// ── Priority Config (for sidebar table) ────────────────────────
// `streamIds` is the authoritative link between a config row and the streams
// it governs. Every non-alert stream appears in exactly one row.
export const DEFAULT_PRIORITY_CONFIG = [
  {
    id: 'critical',
    type: 'Cardiac / Code Blue Alerts',
    level: 'P1',
    streamIds: [],
    locked: true,
  },
  {
    id: 'vitals',
    type: 'Vitals / Monitoring',
    level: 'P2',
    streamIds: ['stream-icu', 'stream-er', 'stream-surgery'],
  },
  {
    id: 'clinical',
    type: 'Imaging / Lab / Pharmacy',
    level: 'P3',
    streamIds: ['stream-radiology', 'stream-pharmacy'],
  },
  {
    id: 'admin',
    type: 'Admin / Reports / Bulk',
    level: 'P4',
    streamIds: ['stream-admin', 'stress-radiology', 'stress-admin'],
  },
  {
    id: 'background',
    type: 'WiFi / Streaming / Browsers',
    level: 'P5',
    streamIds: ['stream-staff', 'stress-staff'],
  },
];

// ── Baseline Traffic Streams ───────────────────────────────────
function createBaselineStreams() {
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

// ── Stress-injected streams ────────────────────────────────────
function createStressStreams() {
  return [
    { id: 'stress-radiology', from: 'RADIOLOGY', to: 'SERVER', priority: 'P4', label: 'Bulk Image Transfer', particleCount: 3, speed: SPEED.slow,   active: true },
    { id: 'stress-admin',     from: 'ADMIN',     to: 'SERVER', priority: 'P4', label: 'Admin Backup',        particleCount: 3, speed: SPEED.slow,   active: true },
    { id: 'stress-staff',     from: 'STAFF',     to: 'SERVER', priority: 'P5', label: 'HD Video Stream',     particleCount: 4, speed: SPEED.medium, active: true },
  ];
}

// ── Delivery Time Calculation ──────────────────────────────────
export function calculateDeliveryTime(priority, networkLoad) {
  const base = { P1: 8, P2: 25, P3: 80, P4: 180, P5: 250 };
  const loadPenalty = networkLoad * 2.8;
  const jitter = Math.random() * 10;

  if (priority === 'P1') {
    // P1 rides a protected queue, so its latency is load independent.
    return Math.round(base.P1 + jitter);
  }

  return Math.round(base[priority] + loadPenalty + jitter);
}

export function calculateUntriagedTime(networkLoad) {
  return Math.round(180 + (networkLoad * 3.2) + Math.random() * 40);
}

// ── Helpers ────────────────────────────────────────────────────
let idCounter = 0;
function uid(prefix = 'id') {
  return `${prefix}-${++idCounter}-${Date.now().toString(36)}`;
}

function formatTime() {
  const now = new Date();
  return now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const MAX_LOG = 50;
const MAX_ALERTS = 12;

function pushLog(log, entry) {
  return [entry, ...log].slice(0, MAX_LOG);
}

/**
 * A stream can only carry traffic if its source department is online.
 * Applied after every mutation so no code path can resurrect a stream
 * belonging to a node that is still dark.
 */
function withNodeAvailability(streams, nodes) {
  return streams.map(s => {
    const node = nodes[s.from];
    const permitted = node ? node.active : true;
    if (!permitted && s.active) return { ...s, active: false };
    return s;
  });
}

/** Whether the stress scenario is currently engaged. */
function isStressEngaged(streams) {
  return streams.some(s => s.id.startsWith('stress-'));
}

/**
 * The steady-state mode implied by the current nodes and streams.
 * `critical` is transient and applied explicitly by triggerAlert, so it is
 * never returned here.
 *
 * Note that `mode` is a display concern only. Congestion is derived from the
 * streams themselves, because a department going offline must not be allowed
 * to mask the fact that the network is still under stress.
 */
function baseMode(nodes, streams) {
  const anyOffline = Object.values(nodes).some(n => !n.active);
  if (anyOffline) return 'failure';
  return isStressEngaged(streams) ? 'stressed' : 'normal';
}

// ── Alert type → department mapping ────────────────────────────
const ALERT_MAP = {
  cardiac:    { from: 'ICU',     label: 'Cardiac Arrest — ICU Bed 4',      priority: 'P1' },
  ventilator: { from: 'ICU',     label: 'Ventilator Alarm — ICU Bed 7',    priority: 'P1' },
  crashcart:  { from: 'SURGERY', label: 'Crash Cart Request — Surgery B',  priority: 'P1' },
};

// ── Initial State Factory ──────────────────────────────────────
function createInitialState() {
  const nodes = {};
  DEPARTMENT_NODES.forEach(d => {
    nodes[d.label] = { active: true };
  });

  return {
    networkLoad: 42,
    bandwidthAllocation: { p1: 25, p2: 20, p3: 25, p4: 18, p5: 12 },
    activeStreams: createBaselineStreams(),
    nodes,
    activeAlerts: [],
    eventLog: [],
    mode: 'normal',
    priorityConfig: DEFAULT_PRIORITY_CONFIG.map(c => ({ ...c })),
  };
}

// ═══════════════════════════════════════════════════════════════
//  useNetworkSimulation — The Simulation Hook
// ═══════════════════════════════════════════════════════════════
export function useNetworkSimulation() {
  const [state, setState] = useState(createInitialState);
  const startTimeRef = useRef(null);
  const criticalTimeoutRef = useRef(null);
  const baselineLogIntervalRef = useRef(null);

  // ── Network Load Oscillation (every 500ms) ──────────────────
  useEffect(() => {
    // Seeded here rather than in useRef(Date.now()) so that render stays pure.
    startTimeRef.current = Date.now();

    const interval = setInterval(() => {
      setState(prev => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const total = Object.keys(prev.nodes).length;
        const online = Object.values(prev.nodes).filter(n => n.active).length;
        const activeRatio = total > 0 ? online / total : 0;

        // Congestion is read from the streams, not from `mode`. Reading it
        // from mode would mean that taking any single department offline
        // (mode -> 'failure') silently cancelled the stress scenario.
        const stressed = isStressEngaged(prev.activeStreams);

        // Offered load is proportional to how many departments are still
        // generating traffic. Taking one department offline removes its
        // share, rather than collapsing the whole network.
        let baseTarget;
        if (prev.mode === 'critical') {
          baseTarget = 95;
        } else if (stressed) {
          baseTarget = 88 + 4 * Math.sin((2 * Math.PI * elapsed) / 8);
        } else {
          baseTarget = 45 + 5 * Math.sin((2 * Math.PI * elapsed) / 20);
        }
        const targetLoad = baseTarget * activeRatio;

        // Kept as a float so the exponential approach actually converges;
        // rounding here would stall one point short of the target forever.
        const newLoad = prev.networkLoad + (targetLoad - prev.networkLoad) * 0.15;

        let bw;
        if (online === 0) {
          bw = { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0 };
        } else if (stressed || prev.mode === 'critical') {
          bw = { p1: 35, p2: 25, p3: 20, p4: 12, p5: 8 };
        } else {
          bw = { p1: 25, p2: 20, p3: 25, p4: 18, p5: 12 };
        }

        return { ...prev, networkLoad: newLoad, bandwidthAllocation: bw };
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // ── Baseline Traffic Log Generation (every 3–6s) ────────────
  useEffect(() => {
    function scheduleNext() {
      const delay = 3000 + Math.random() * 3000;
      baselineLogIntervalRef.current = setTimeout(() => {
        setState(prev => {
          const active = prev.activeStreams.filter(s => s.active && !s.isAlertParticle);
          if (active.length === 0) return prev;
          const stream = active[Math.floor(Math.random() * active.length)];
          const deliveryTime = calculateDeliveryTime(stream.priority, prev.networkLoad);

          return {
            ...prev,
            eventLog: pushLog(prev.eventLog, {
              id: uid('evt'),
              kind: 'traffic',
              timestamp: formatTime(),
              priority: stream.priority,
              label: `${stream.label} → Server`,
              deliveredIn: deliveryTime,
              status: 'delivered',
            }),
          };
        });
        scheduleNext();
      }, delay);
    }

    scheduleNext();
    return () => {
      if (baselineLogIntervalRef.current) clearTimeout(baselineLogIntervalRef.current);
    };
  }, []);

  // ── Stress Mode: P5 Packet Drops (check every 1s) ───────────
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => {
        const congested = isStressEngaged(prev.activeStreams) || prev.mode === 'critical';
        if (!congested) return prev;

        const p5Streams = prev.activeStreams.filter(s => s.priority === 'P5' && s.active);
        if (p5Streams.length === 0) return prev;

        let newLog = prev.eventLog;
        p5Streams.forEach(stream => {
          if (Math.random() < 0.4) {
            newLog = pushLog(newLog, {
              id: uid('drop'),
              kind: 'traffic',
              timestamp: formatTime(),
              priority: 'P5',
              label: `${stream.label} packet dropped — congestion`,
              deliveredIn: null,
              status: 'dropped',
            });
          }
        });

        if (newLog === prev.eventLog) return prev;
        return { ...prev, eventLog: newLog };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // ── Action: Simulate Stress ──────────────────────────────────
  const simulateStress = useCallback(() => {
    setState(prev => {
      if (prev.activeStreams.some(s => s.id.startsWith('stress-'))) return prev;

      // Halve P4/P5 particle counts to show degradation.
      const degraded = prev.activeStreams.map(s => {
        if (s.priority === 'P4' || s.priority === 'P5') {
          return { ...s, particleCount: Math.max(1, Math.floor(s.particleCount / 2)) };
        }
        return s;
      });

      const merged = withNodeAvailability(
        [...degraded, ...createStressStreams()],
        prev.nodes,
      );

      return {
        ...prev,
        mode: baseMode(prev.nodes, merged),
        activeStreams: merged,
        eventLog: pushLog(prev.eventLog, {
          id: uid('evt'),
          kind: 'system',
          timestamp: formatTime(),
          priority: 'P5',
          label: 'Network stress simulation activated — P4/P5 degraded',
          deliveredIn: null,
          status: 'dropped',
        }),
      };
    });
  }, []);

  // ── Action: Trigger Alert ────────────────────────────────────
  const triggerAlert = useCallback((type) => {
    const alertDef = ALERT_MAP[type];
    if (!alertDef) return;

    const alertId = uid('alert');

    setState(prev => {
      // An alert cannot originate from a department that is offline.
      const source = prev.nodes[alertDef.from];
      if (source && !source.active) {
        return {
          ...prev,
          eventLog: pushLog(prev.eventLog, {
            id: uid('evt'),
            kind: 'system',
            timestamp: formatTime(),
            priority: 'P1',
            label: `${alertDef.label} — UNROUTABLE, ${alertDef.from} offline`,
            deliveredIn: null,
            status: 'dropped',
          }),
        };
      }

      const deliveryTime = calculateDeliveryTime('P1', prev.networkLoad);
      const untriagedTime = calculateUntriagedTime(prev.networkLoad);

      const alertStream = {
        id: `alert-stream-${alertId}`,
        from: alertDef.from,
        to: 'SERVER',
        priority: 'P1',
        label: alertDef.label,
        particleCount: 1,
        speed: SPEED.fast,
        active: true,
        isAlertParticle: true,
      };

      // Suspend all P4/P5 traffic for the duration of the alert.
      const suspended = prev.activeStreams.map(s =>
        (s.priority === 'P4' || s.priority === 'P5') ? { ...s, active: false } : s,
      );

      const alert = {
        id: alertId,
        priority: 'P1',
        label: alertDef.label,
        firedAt: Date.now(),
        deliveredIn: deliveryTime,
        untriagedTime,
        status: 'delivered',
        // Snapshot of load at fire time, so the comparison view has a stable
        // basis instead of re-reading a value that changes twice a second.
        networkLoadAtFire: prev.networkLoad,
      };

      let log = pushLog(prev.eventLog, {
        id: uid('evt'),
        kind: 'traffic',
        timestamp: formatTime(),
        priority: 'P1',
        label: `${alertDef.label} → Server`,
        deliveredIn: deliveryTime,
        status: 'delivered',
      });
      log = pushLog(log, {
        id: uid('evt'),
        kind: 'note',
        timestamp: formatTime(),
        priority: 'P1',
        label: `Same alert without triage would take ~${untriagedTime}ms`,
        deliveredIn: untriagedTime,
        status: 'note',
      });

      return {
        ...prev,
        mode: 'critical',
        activeStreams: withNodeAvailability([...suspended, alertStream], prev.nodes),
        activeAlerts: [alert, ...prev.activeAlerts].slice(0, MAX_ALERTS),
        eventLog: log,
      };
    });

    // After 800ms: drop the alert particle and resume background traffic.
    if (criticalTimeoutRef.current) clearTimeout(criticalTimeoutRef.current);
    criticalTimeoutRef.current = setTimeout(() => {
      setState(prev => {
        const resumed = prev.activeStreams
          .filter(s => !s.isAlertParticle)
          .map(s => (s.priority === 'P4' || s.priority === 'P5') ? { ...s, active: true } : s);

        // Clamp against node availability so departments killed before or
        // during the alert stay dark.
        const streams = withNodeAvailability(resumed, prev.nodes);

        return {
          ...prev,
          mode: baseMode(prev.nodes, streams),
          activeStreams: streams,
        };
      });
    }, 800);
  }, []);

  // ── Action: Reset Network ────────────────────────────────────
  const resetNetwork = useCallback(() => {
    if (criticalTimeoutRef.current) clearTimeout(criticalTimeoutRef.current);
    startTimeRef.current = Date.now();

    setState(prev => ({
      ...createInitialState(),
      eventLog: pushLog(prev.eventLog, {
        id: uid('evt'),
        kind: 'system',
        timestamp: formatTime(),
        priority: 'P4',
        label: 'Network reset to normal operation',
        deliveredIn: null,
        status: 'delivered',
      }),
    }));
  }, []);

  // ── Action: Toggle Node Failure ───────────────────────────────
  const toggleNodeFailure = useCallback((name) => {
    setState(prev => {
      const node = prev.nodes[name];
      if (!node) return prev;

      const newActive = !node.active;
      const nodes = { ...prev.nodes, [name]: { ...node, active: newActive } };

      const streams = withNodeAvailability(
        prev.activeStreams.map(s => (s.from === name ? { ...s, active: newActive } : s)),
        nodes,
      );

      return {
        ...prev,
        mode: baseMode(nodes, streams),
        nodes,
        activeStreams: streams,
        eventLog: pushLog(prev.eventLog, {
          id: uid('evt'),
          kind: 'infra',
          timestamp: formatTime(),
          priority: null,
          label: newActive
            ? `NODE RESTORED — ${name} back online, streams resuming`
            : `NODE FAILURE — ${name} offline, streams suspended`,
          deliveredIn: null,
          status: newActive ? 'delivered' : 'dropped',
        }),
      };
    });
  }, []);

  // ── Action: Update Priority Config ───────────────────────────
  const updatePriorityConfig = useCallback((rowId, newLevel) => {
    setState(prev => {
      const row = prev.priorityConfig.find(c => c.id === rowId);
      if (!row || row.locked) return prev;

      const priorityConfig = prev.priorityConfig.map(c =>
        c.id === rowId ? { ...c, level: newLevel } : c,
      );

      const affected = new Set(row.streamIds);
      const activeStreams = prev.activeStreams.map(s =>
        affected.has(s.id) ? { ...s, priority: newLevel } : s,
      );

      return { ...prev, priorityConfig, activeStreams };
    });
  }, []);

  // ── Cleanup ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (criticalTimeoutRef.current) clearTimeout(criticalTimeoutRef.current);
      if (baselineLogIntervalRef.current) clearTimeout(baselineLogIntervalRef.current);
    };
  }, []);

  return {
    state,
    actions: {
      triggerAlert,
      simulateStress,
      resetNetwork,
      toggleNodeFailure,
      updatePriorityConfig,
    },
  };
}
