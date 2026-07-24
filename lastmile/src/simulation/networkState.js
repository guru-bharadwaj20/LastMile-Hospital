/**
 * networkState.js — Layer 2: Network Simulation Engine
 *
 * Exports useNetworkSimulation() — the custom React hook that drives
 * all UI state in the LastMile Hospital Network Triage System.
 * No backend required — everything runs in the browser.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

// ── Department Definitions ─────────────────────────────────────
export const DEPARTMENTS = [
  { id: 'icu',       label: 'ICU',        priority: 1, color: '#ff2d2d', x: 80,  y: 20,  w: 160, h: 90 },
  { id: 'emergency', label: 'ER',         priority: 1, color: '#ff6b2d', x: 320, y: 20,  w: 160, h: 90 },
  { id: 'surgery',   label: 'SURGERY',    priority: 2, color: '#ff6b2d', x: 560, y: 20,  w: 160, h: 90 },
  { id: 'radiology', label: 'RADIOLOGY',  priority: 3, color: '#fbbf24', x: 80,  y: 160, w: 160, h: 90 },
  { id: 'pharmacy',  label: 'PHARMACY',   priority: 4, color: '#34d399', x: 560, y: 160, w: 160, h: 90 },
  { id: 'admin',     label: 'ADMIN',      priority: 5, color: '#4b5563', x: 80,  y: 300, w: 160, h: 90 },
  { id: 'staff',     label: 'STAFF',      priority: 5, color: '#4b5563', x: 560, y: 300, w: 160, h: 90 },
  { id: 'server',    label: 'SERVER',     priority: 0, color: '#38bdf8', x: 300, y: 155, w: 200, h: 100, isServer: true },
];

// ── Priority Colors ────────────────────────────────────────────
export const PRIORITY_COLORS = {
  P1: '#ff2d2d',
  P2: '#ff6b2d',
  P3: '#fbbf24',
  P4: '#34d399',
  P5: '#4b5563',
};

// ── Speed Constants (ms) ───────────────────────────────────────
const SPEED = { fast: 400, medium: 800, slow: 1400 };

// ── Priority Config (for sidebar table) ────────────────────────
export const DEFAULT_PRIORITY_CONFIG = [
  { type: 'Cardiac / Code Blue Alerts',  level: 'P1', color: '#ff2d2d' },
  { type: 'Ventilator / Vitals Alarms',  level: 'P2', color: '#ff6b2d' },
  { type: 'Lab Results / Imaging',       level: 'P3', color: '#fbbf24' },
  { type: 'Admin / Reports',             level: 'P4', color: '#34d399' },
  { type: 'WiFi / Streaming / Browsers', level: 'P5', color: '#4b5563' },
];

// ── Baseline Traffic Streams ───────────────────────────────────
function createBaselineStreams() {
  return [
    { id: 'stream-icu',       from: 'ICU',       to: 'SERVER', priority: 'P2', label: 'ICU Vitals',         particleCount: 4, speed: SPEED.fast,   active: true },
    { id: 'stream-er',        from: 'ER',        to: 'SERVER', priority: 'P2', label: 'Triage Data',        particleCount: 3, speed: SPEED.fast,   active: true },
    { id: 'stream-surgery',   from: 'SURGERY',   to: 'SERVER', priority: 'P2', label: 'Surgery Monitoring', particleCount: 3, speed: SPEED.fast,   active: true },
    { id: 'stream-radiology', from: 'RADIOLOGY', to: 'SERVER', priority: 'P4', label: 'Image Transfers',    particleCount: 2, speed: SPEED.slow,   active: true },
    { id: 'stream-pharmacy',  from: 'PHARMACY',  to: 'SERVER', priority: 'P3', label: 'Order System',       particleCount: 2, speed: SPEED.medium, active: true },
    { id: 'stream-admin',     from: 'ADMIN',     to: 'SERVER', priority: 'P4', label: 'File Uploads',       particleCount: 2, speed: SPEED.slow,   active: true },
    { id: 'stream-staff',     from: 'STAFF',     to: 'SERVER', priority: 'P5', label: 'WiFi/Streaming',     particleCount: 3, speed: SPEED.medium, active: true },
  ];
}

// ── Stress-injected streams ────────────────────────────────────
function createStressStreams() {
  return [
    { id: 'stress-radiology', from: 'RADIOLOGY', to: 'SERVER', priority: 'P4', label: 'Bulk Transfer',     particleCount: 3, speed: SPEED.slow,   active: true },
    { id: 'stress-admin',     from: 'ADMIN',     to: 'SERVER', priority: 'P4', label: 'Admin Backup',      particleCount: 3, speed: SPEED.slow,   active: true },
    { id: 'stress-staff',     from: 'STAFF',     to: 'SERVER', priority: 'P5', label: 'HD Video Stream',   particleCount: 4, speed: SPEED.medium, active: true },
  ];
}

// ── Delivery Time Calculation ──────────────────────────────────
function calculateDeliveryTime(priority, networkLoad) {
  const base = { P1: 8, P2: 25, P3: 80, P4: 180, P5: 250 };
  const loadPenalty = networkLoad * 2.8;
  const jitter = Math.random() * 10;

  if (priority === 'P1') {
    // P1 bypasses load — always fast regardless
    return Math.round(base.P1 + jitter);
  }

  return Math.round(base[priority] + loadPenalty + jitter);
}

function calculateUntriagedTime(networkLoad) {
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

// ── Alert type → department mapping ────────────────────────────
const ALERT_MAP = {
  cardiac:    { from: 'ICU',     label: 'Cardiac Arrest — ICU Bed 4',      priority: 'P1' },
  ventilator: { from: 'ICU',     label: 'Ventilator Alarm — ICU Bed 7',    priority: 'P1' },
  crashcart:  { from: 'SURGERY', label: 'Crash Cart Request — Surgery B',  priority: 'P1' },
};

// ── Initial State Factory ──────────────────────────────────────
function createInitialState() {
  const nodes = {};
  DEPARTMENTS.filter(d => !d.isServer).forEach(d => {
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
        const totalNodeCount = Object.keys(prev.nodes).length;
        const activeNodeCount = Object.values(prev.nodes).filter(n => n.active).length;
        const activeRatio = totalNodeCount > 0 ? activeNodeCount / totalNodeCount : 0;
        let targetLoad;

        if (activeNodeCount === 0) {
          // No departments online means no traffic can be generated.
          targetLoad = 0;
        } else if (prev.mode === 'normal') {
          // Sine wave oscillation: 40–50%, period ~20s
          targetLoad = 45 + 5 * Math.sin((2 * Math.PI * elapsed) / 20);
        } else if (prev.mode === 'stressed') {
          // Hold at 85–92%
          targetLoad = 88 + 4 * Math.sin((2 * Math.PI * elapsed) / 8);
        } else if (prev.mode === 'critical') {
          // Keep critical alerts visually high while nodes are online.
          targetLoad = 95;
        } else if (prev.mode === 'failure') {
          // Degrade load based on how many nodes are still online.
          targetLoad = Math.max(8, Math.round(30 * activeRatio));
        } else {
          targetLoad = prev.networkLoad;
        }

        // Smooth approach
        const newLoad = Math.round(prev.networkLoad + (targetLoad - prev.networkLoad) * 0.15);

        // Update bandwidth allocation based on mode
        let bw;
        if (activeNodeCount === 0) {
          bw = { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0 };
        } else if (prev.mode === 'stressed' || prev.mode === 'critical') {
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
          // Pick a random active stream
          const active = prev.activeStreams.filter(s => s.active && !s.id.startsWith('alert-'));
          if (active.length === 0) return prev;
          const stream = active[Math.floor(Math.random() * active.length)];
          const deliveryTime = calculateDeliveryTime(stream.priority, prev.networkLoad);

          const entry = {
            id: uid('evt'),
            timestamp: formatTime(),
            priority: stream.priority,
            label: `${stream.label} → Server`,
            deliveredIn: deliveryTime,
            status: 'delivered',
          };

          const newLog = [entry, ...prev.eventLog].slice(0, 50);
          return { ...prev, eventLog: newLog };
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
        if (prev.mode !== 'stressed' && prev.mode !== 'critical') return prev;

        const p5Streams = prev.activeStreams.filter(s => s.priority === 'P5' && s.active);
        if (p5Streams.length === 0) return prev;

        let newLog = [...prev.eventLog];
        p5Streams.forEach(stream => {
          if (Math.random() < 0.4) {
            newLog = [{
              id: uid('drop'),
              timestamp: formatTime(),
              priority: 'P5',
              label: `${stream.label} packet dropped — congestion`,
              deliveredIn: null,
              status: 'dropped',
            }, ...newLog].slice(0, 50);
          }
        });

        return { ...prev, eventLog: newLog };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // ── Action: Simulate Stress ──────────────────────────────────
  const simulateStress = useCallback(() => {
    setState(prev => {
      if (prev.mode === 'stressed') return prev;

      const stressStreams = createStressStreams();
      // Halve P4/P5 particle counts
      const updatedStreams = prev.activeStreams.map(s => {
        if (s.priority === 'P4' || s.priority === 'P5') {
          return { ...s, particleCount: Math.max(1, Math.floor(s.particleCount / 2)) };
        }
        return s;
      });

      const newLog = [{
        id: uid('evt'),
        timestamp: formatTime(),
        priority: 'P5',
        label: 'Network stress simulation activated — P4/P5 degraded',
        deliveredIn: null,
        status: 'dropped',
      }, ...prev.eventLog].slice(0, 50);

      return {
        ...prev,
        mode: 'stressed',
        activeStreams: [...updatedStreams, ...stressStreams],
        eventLog: newLog,
      };
    });

    // Ramp load to 85–92% over 3 seconds (handled by oscillation loop)
  }, []);

  // ── Action: Trigger Alert ────────────────────────────────────
  const triggerAlert = useCallback((type) => {
    const alertDef = ALERT_MAP[type];
    if (!alertDef) return;

    const alertId = uid('alert');

    setState(prev => {
      const deliveryTime = calculateDeliveryTime('P1', prev.networkLoad);
      const untriagedTime = calculateUntriagedTime(prev.networkLoad);

      // Create P1 alert stream (single shot)
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

      // Suspend ALL P4/P5 streams
      const updatedStreams = prev.activeStreams.map(s => {
        if (s.priority === 'P4' || s.priority === 'P5') {
          return { ...s, active: false };
        }
        return s;
      });

      const alert = {
        id: alertId,
        priority: 'P1',
        label: alertDef.label,
        firedAt: Date.now(),
        deliveredIn: deliveryTime,
        untriagedTime: untriagedTime,
        status: 'delivered',
      };

      const logEntry = {
        id: uid('evt'),
        timestamp: formatTime(),
        priority: 'P1',
        label: `${alertDef.label} → Server`,
        deliveredIn: deliveryTime,
        status: 'delivered',
      };

      const comparisonEntry = {
        id: uid('evt'),
        timestamp: formatTime(),
        priority: 'P5',
        label: `Without triage: ~${untriagedTime}ms (comparison)`,
        deliveredIn: untriagedTime,
        status: 'dropped',
      };

      const newLog = [comparisonEntry, logEntry, ...prev.eventLog].slice(0, 50);

      return {
        ...prev,
        mode: 'critical',
        networkLoad: 95,
        activeStreams: [...updatedStreams, alertStream],
        activeAlerts: [alert, ...prev.activeAlerts],
        eventLog: newLog,
      };
    });

    // After 800ms: resume P4/P5, drop back to 80%, remove alert stream
    if (criticalTimeoutRef.current) clearTimeout(criticalTimeoutRef.current);
    criticalTimeoutRef.current = setTimeout(() => {
      setState(prev => {
        const updatedStreams = prev.activeStreams
          .filter(s => !s.isAlertParticle) // remove alert particles
          .map(s => {
            if (s.priority === 'P4' || s.priority === 'P5') {
              return { ...s, active: true };
            }
            return s;
          });

        // Determine what mode to return to
        const hasStressStreams = updatedStreams.some(s => s.id.startsWith('stress-'));
        const returnMode = hasStressStreams ? 'stressed' : 'normal';

        return {
          ...prev,
          mode: returnMode,
          networkLoad: hasStressStreams ? 80 : prev.networkLoad,
          activeStreams: updatedStreams,
        };
      });
    }, 800);
  }, []);

  // ── Action: Reset Network ────────────────────────────────────
  const resetNetwork = useCallback(() => {
    if (criticalTimeoutRef.current) clearTimeout(criticalTimeoutRef.current);

    setState(prev => ({
      ...createInitialState(),
      eventLog: [{
        id: uid('evt'),
        timestamp: formatTime(),
        priority: 'P4',
        label: 'Network reset to normal operation',
        deliveredIn: null,
        status: 'delivered',
      }, ...prev.eventLog].slice(0, 50),
    }));
  }, []);

  // ── Action: Toggle Node Failure ───────────────────────────────
  const toggleNodeFailure = useCallback((name) => {
    setState(prev => {
      const node = prev.nodes[name];
      if (!node) return prev;

      const newActive = !node.active;
      const newNodes = { ...prev.nodes, [name]: { ...node, active: newActive } };

      // Suspend/resume streams from that department
      const updatedStreams = prev.activeStreams.map(s => {
        if (s.from === name) {
          return { ...s, active: newActive };
        }
        return s;
      });

      const logEntry = {
        id: uid('evt'),
        timestamp: formatTime(),
        priority: newActive ? 'P4' : 'P1',
        label: newActive
          ? `✓ NODE RESTORED  ${name} back online — streams resuming`
          : `⚠ NODE FAILURE  ${name} offline — stream suspended — 0 packets routable`,
        deliveredIn: null,
        status: newActive ? 'delivered' : 'dropped',
      };

      // Determine mode: if restoring and no other nodes are offline, return to normal/stressed
      let newMode;
      if (newActive) {
        const anyOtherOffline = Object.entries(newNodes).some(([n, s]) => n !== name && !s.active);
        if (anyOtherOffline) {
          newMode = 'failure';
        } else {
          const hasStress = updatedStreams.some(s => s.id.startsWith('stress-'));
          newMode = hasStress ? 'stressed' : 'normal';
        }
      } else {
        newMode = 'failure';
      }

      return {
        ...prev,
        mode: newMode,
        nodes: newNodes,
        activeStreams: updatedStreams,
        eventLog: [logEntry, ...prev.eventLog].slice(0, 50),
      };
    });
  }, []);

  // ── Action: Update Priority Config ───────────────────────────
  const updatePriorityConfig = useCallback((index, newLevel) => {
    setState(prev => {
      const newConfig = [...prev.priorityConfig];
      newConfig[index] = { ...newConfig[index], level: newLevel, color: PRIORITY_COLORS[newLevel] };

      // Update corresponding stream priorities
      const typeToStreamMap = {
        0: ['stream-icu'],       // Cardiac / Code Blue
        1: ['stream-er', 'stream-surgery'], // Ventilator / Vitals
        2: ['stream-radiology'], // Lab Results / Imaging
        3: ['stream-admin'],     // Admin / Reports
        4: ['stream-staff'],     // WiFi / Streaming
      };

      const affectedIds = typeToStreamMap[index] || [];
      const updatedStreams = prev.activeStreams.map(s => {
        if (affectedIds.includes(s.id)) {
          return { ...s, priority: newLevel };
        }
        return s;
      });

      return { ...prev, priorityConfig: newConfig, activeStreams: updatedStreams };
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
