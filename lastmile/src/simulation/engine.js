/**
 * engine.js — Pure simulation core.
 *
 * A reducer plus its helpers. No React, no timers, no direct access to
 * Math.random or Date.now: every source of nondeterminism arrives through an
 * injected context, which is what makes the whole engine testable.
 *
 *   const ctx = createSimulationContext({ random: () => 0.5, now: () => 0 });
 *   let state = createInitialState();
 *   state = reduce(state, { type: 'TOGGLE_NODE', name: 'ICU' }, ctx);
 */
import {
  ALERT_MAP,
  BANDWIDTH,
  DEFAULT_PRIORITY_CONFIG,
  DEPARTMENT_NODES,
  LATENCY,
  LOAD,
  MAX_ALERTS,
  MAX_LOG,
  P5_DROP_CHANCE,
  SPEED,
  createBaselineStreams,
  createStressStreams,
} from './constants';

// ── Injected Context ───────────────────────────────────────────

/**
 * Bundles every nondeterministic dependency the reducer needs.
 * Tests pass stubs; the app passes the real thing.
 */
export function createSimulationContext({
  random = Math.random,
  now = () => Date.now(),
} = {}) {
  let counter = 0;
  return {
    random,
    now,
    nextId(prefix = 'id') {
      counter += 1;
      return `${prefix}-${counter}-${now().toString(36)}`;
    },
    timestamp() {
      return new Date(now()).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    },
  };
}

// ── Derivations ────────────────────────────────────────────────

/** Whether the stress scenario is currently engaged. */
export function isStressEngaged(streams) {
  return streams.some(s => s.id.startsWith('stress-'));
}

/** Names of every department currently offline. */
export function offlineNodeNames(nodes) {
  return Object.entries(nodes).filter(([, n]) => !n.active).map(([name]) => name);
}

/** Fraction of departments still generating traffic, 0..1. */
export function activeRatio(nodes) {
  const total = Object.keys(nodes).length;
  if (total === 0) return 0;
  return Object.values(nodes).filter(n => n.active).length / total;
}

/**
 * The steady-state mode implied by the current nodes and streams.
 * `critical` is transient and applied explicitly by TRIGGER_ALERT, so it is
 * never returned here.
 *
 * `mode` is a display concern only. Congestion is derived from the streams
 * themselves, because a department going offline must not be allowed to mask
 * the fact that the network is still under stress.
 */
export function baseMode(nodes, streams) {
  if (offlineNodeNames(nodes).length > 0) return 'failure';
  return isStressEngaged(streams) ? 'stressed' : 'normal';
}

/**
 * A stream can only carry traffic if its source department is online.
 * Applied after every mutation so no code path can resurrect a stream
 * belonging to a node that is still dark.
 */
export function withNodeAvailability(streams, nodes) {
  return streams.map(s => {
    const node = nodes[s.from];
    const permitted = node ? node.active : true;
    return (!permitted && s.active) ? { ...s, active: false } : s;
  });
}

// ── Latency Model ──────────────────────────────────────────────

export function calculateDeliveryTime(priority, networkLoad, random = Math.random) {
  const jitter = random() * LATENCY.jitter;
  // P1 rides a protected queue, so its latency is load independent.
  if (priority === 'P1') return Math.round(LATENCY.base.P1 + jitter);
  return Math.round(LATENCY.base[priority] + networkLoad * LATENCY.loadFactor + jitter);
}

export function calculateUntriagedTime(networkLoad, random = Math.random) {
  return Math.round(
    LATENCY.untriagedBase
    + networkLoad * LATENCY.untriagedLoadFactor
    + random() * LATENCY.untriagedJitter,
  );
}

/** Load the network is being driven toward, given mode and offline count. */
export function targetLoad(state, elapsedSeconds) {
  const stressed = isStressEngaged(state.activeStreams);

  let base;
  if (state.mode === 'critical') {
    base = LOAD.criticalTarget;
  } else if (stressed) {
    base = LOAD.stressedCentre
      + LOAD.stressedAmplitude * Math.sin((2 * Math.PI * elapsedSeconds) / LOAD.stressedPeriodS);
  } else {
    base = LOAD.normalCentre
      + LOAD.normalAmplitude * Math.sin((2 * Math.PI * elapsedSeconds) / LOAD.normalPeriodS);
  }

  // Offered load is proportional to how many departments are still
  // generating traffic, so taking one offline removes its share rather than
  // collapsing the whole network.
  return base * activeRatio(state.nodes);
}

// ── Log Helpers ────────────────────────────────────────────────

function pushLog(log, entry) {
  return [entry, ...log].slice(0, MAX_LOG);
}

function makeEntry(ctx, fields) {
  return { id: ctx.nextId('evt'), timestamp: ctx.timestamp(), ...fields };
}

// ── Initial State ──────────────────────────────────────────────

export function createInitialState() {
  const nodes = {};
  DEPARTMENT_NODES.forEach(d => {
    nodes[d.label] = { active: true };
  });

  return {
    networkLoad: LOAD.initial,
    bandwidthAllocation: { ...BANDWIDTH.normal },
    activeStreams: createBaselineStreams(),
    nodes,
    activeAlerts: [],
    eventLog: [],
    mode: 'normal',
    priorityConfig: DEFAULT_PRIORITY_CONFIG.map(c => ({ ...c })),
  };
}

// ── Reducer ────────────────────────────────────────────────────

/**
 * @param {object} state
 * @param {object} action
 * @param {ReturnType<typeof createSimulationContext>} ctx
 */
export function reduce(state, action, ctx) {
  switch (action.type) {

    // Load oscillation. `elapsedSeconds` is supplied by the caller so the
    // reducer never reads the clock itself.
    case 'TICK': {
      const target = targetLoad(state, action.elapsedSeconds);

      // Kept as a float so the exponential approach actually converges;
      // rounding here would stall one point short of the target forever.
      const networkLoad = state.networkLoad + (target - state.networkLoad) * LOAD.smoothing;

      const online = Object.values(state.nodes).filter(n => n.active).length;
      const congested = isStressEngaged(state.activeStreams) || state.mode === 'critical';

      let bandwidthAllocation;
      if (online === 0) bandwidthAllocation = BANDWIDTH.idle;
      else if (congested) bandwidthAllocation = BANDWIDTH.congested;
      else bandwidthAllocation = BANDWIDTH.normal;

      return { ...state, networkLoad, bandwidthAllocation };
    }

    // One delivery event for a randomly chosen active stream.
    case 'LOG_BASELINE': {
      const candidates = state.activeStreams.filter(s => s.active && !s.isAlertParticle);
      if (candidates.length === 0) return state;

      const stream = candidates[Math.floor(ctx.random() * candidates.length)];
      return {
        ...state,
        eventLog: pushLog(state.eventLog, makeEntry(ctx, {
          kind: 'traffic',
          priority: stream.priority,
          label: `${stream.label} → Server`,
          deliveredIn: calculateDeliveryTime(stream.priority, state.networkLoad, ctx.random),
          status: 'delivered',
        })),
      };
    }

    // Probabilistic P5 loss while congested.
    case 'DROP_CHECK': {
      const congested = isStressEngaged(state.activeStreams) || state.mode === 'critical';
      if (!congested) return state;

      const p5 = state.activeStreams.filter(s => s.priority === 'P5' && s.active);
      if (p5.length === 0) return state;

      let log = state.eventLog;
      p5.forEach(stream => {
        if (ctx.random() < P5_DROP_CHANCE) {
          log = pushLog(log, makeEntry(ctx, {
            kind: 'traffic',
            priority: 'P5',
            label: `${stream.label} packet dropped — congestion`,
            deliveredIn: null,
            status: 'dropped',
          }));
        }
      });

      return log === state.eventLog ? state : { ...state, eventLog: log };
    }

    case 'SIMULATE_STRESS': {
      if (isStressEngaged(state.activeStreams)) return state;

      // Halve P4/P5 particle counts to show degradation.
      const degraded = state.activeStreams.map(s =>
        (s.priority === 'P4' || s.priority === 'P5')
          ? { ...s, particleCount: Math.max(1, Math.floor(s.particleCount / 2)) }
          : s,
      );

      const activeStreams = withNodeAvailability(
        [...degraded, ...createStressStreams()],
        state.nodes,
      );

      return {
        ...state,
        mode: baseMode(state.nodes, activeStreams),
        activeStreams,
        eventLog: pushLog(state.eventLog, makeEntry(ctx, {
          kind: 'system',
          priority: 'P5',
          label: 'Network stress simulation activated — P4/P5 degraded',
          deliveredIn: null,
          status: 'dropped',
        })),
      };
    }

    case 'TRIGGER_ALERT': {
      const def = ALERT_MAP[action.alertType];
      if (!def) return state;

      // An alert cannot originate from a department that is offline.
      const source = state.nodes[def.from];
      if (source && !source.active) {
        return {
          ...state,
          eventLog: pushLog(state.eventLog, makeEntry(ctx, {
            kind: 'system',
            priority: 'P1',
            label: `${def.label} — UNROUTABLE, ${def.from} offline`,
            deliveredIn: null,
            status: 'dropped',
          })),
        };
      }

      const alertId = ctx.nextId('alert');
      const deliveredIn = calculateDeliveryTime('P1', state.networkLoad, ctx.random);
      const untriagedTime = calculateUntriagedTime(state.networkLoad, ctx.random);

      const alertStream = {
        id: `alert-stream-${alertId}`,
        from: def.from,
        to: 'SERVER',
        priority: 'P1',
        label: def.label,
        particleCount: 1,
        speed: SPEED.fast,
        active: true,
        isAlertParticle: true,
      };

      // Suspend all P4/P5 traffic for the duration of the alert.
      const suspended = state.activeStreams.map(s =>
        (s.priority === 'P4' || s.priority === 'P5') ? { ...s, active: false } : s,
      );

      let eventLog = pushLog(state.eventLog, makeEntry(ctx, {
        kind: 'traffic',
        priority: 'P1',
        label: `${def.label} → Server`,
        deliveredIn,
        status: 'delivered',
      }));
      eventLog = pushLog(eventLog, makeEntry(ctx, {
        kind: 'note',
        priority: 'P1',
        label: `Same alert without triage would take ~${untriagedTime}ms`,
        deliveredIn: untriagedTime,
        status: 'note',
      }));

      const alert = {
        id: alertId,
        priority: 'P1',
        label: def.label,
        firedAt: ctx.now(),
        deliveredIn,
        untriagedTime,
        status: 'delivered',
        // Snapshot of load at fire time, so the comparison view has a stable
        // basis instead of re-reading a value that changes twice a second.
        networkLoadAtFire: state.networkLoad,
      };

      return {
        ...state,
        mode: 'critical',
        activeStreams: withNodeAvailability([...suspended, alertStream], state.nodes),
        activeAlerts: [alert, ...state.activeAlerts].slice(0, MAX_ALERTS),
        eventLog,
      };
    }

    // Alert window closes: drop the alert particle, resume background traffic.
    case 'END_ALERT': {
      const resumed = state.activeStreams
        .filter(s => !s.isAlertParticle)
        .map(s => (s.priority === 'P4' || s.priority === 'P5') ? { ...s, active: true } : s);

      // Clamp against node availability so departments killed before or
      // during the alert stay dark.
      const activeStreams = withNodeAvailability(resumed, state.nodes);

      return { ...state, mode: baseMode(state.nodes, activeStreams), activeStreams };
    }

    case 'TOGGLE_NODE': {
      const node = state.nodes[action.name];
      if (!node) return state;

      const active = !node.active;
      const nodes = { ...state.nodes, [action.name]: { ...node, active } };
      const activeStreams = withNodeAvailability(
        state.activeStreams.map(s => (s.from === action.name ? { ...s, active } : s)),
        nodes,
      );

      return {
        ...state,
        mode: baseMode(nodes, activeStreams),
        nodes,
        activeStreams,
        eventLog: pushLog(state.eventLog, makeEntry(ctx, {
          kind: 'infra',
          priority: null,
          label: active
            ? `NODE RESTORED — ${action.name} back online, streams resuming`
            : `NODE FAILURE — ${action.name} offline, streams suspended`,
          deliveredIn: null,
          status: active ? 'delivered' : 'dropped',
        })),
      };
    }

    case 'SET_PRIORITY': {
      const row = state.priorityConfig.find(c => c.id === action.rowId);
      if (!row || row.locked) return state;

      const priorityConfig = state.priorityConfig.map(c =>
        c.id === action.rowId ? { ...c, level: action.level } : c,
      );
      const affected = new Set(row.streamIds);
      const activeStreams = state.activeStreams.map(s =>
        affected.has(s.id) ? { ...s, priority: action.level } : s,
      );

      return { ...state, priorityConfig, activeStreams };
    }

    case 'RESET': {
      return {
        ...createInitialState(),
        eventLog: pushLog(state.eventLog, makeEntry(ctx, {
          kind: 'system',
          priority: 'P4',
          label: 'Network reset to normal operation',
          deliveredIn: null,
          status: 'delivered',
        })),
      };
    }

    default:
      return state;
  }
}
