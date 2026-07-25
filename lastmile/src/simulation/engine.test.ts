import { describe, it, expect } from 'vitest';
import {
  activeRatio,
  baseMode,
  calculateDeliveryTime,
  calculateUntriagedTime,
  createInitialState,
  createSimulationContext,
  isStressEngaged,
  reduce,
  targetLoad,
  withNodeAvailability,
} from './engine';
import { DEFAULT_PRIORITY_CONFIG, DEPARTMENT_NODES, LOAD, MAX_LOG } from './constants';
import type { Action, SimulationState, Stream } from './types';

/** Deterministic context: fixed RNG and a frozen clock. */
function ctx(random = 0.5) {
  return createSimulationContext({ random: () => random, now: () => 1_700_000_000_000 });
}

/** Apply a sequence of actions to a fresh state. */
function run(actions: Action[], initial?: SimulationState): SimulationState {
  const c = ctx();
  return actions.reduce((s, a) => reduce(s, a, c), initial ?? createInitialState());
}

const streamsFrom = (s: SimulationState, dept: string) =>
  s.activeStreams.filter(x => x.from === dept);

describe('createInitialState', () => {
  it('brings every department online', () => {
    const s = createInitialState();
    expect(Object.keys(s.nodes)).toHaveLength(DEPARTMENT_NODES.length);
    expect(Object.values(s.nodes).every(n => n.active)).toBe(true);
  });

  it('starts in normal mode with no alerts or events', () => {
    const s = createInitialState();
    expect(s.mode).toBe('normal');
    expect(s.activeAlerts).toEqual([]);
    expect(s.eventLog).toEqual([]);
  });
});

describe('priority model consistency', () => {
  it('gives every baseline stream a source department that exists', () => {
    const labels = new Set(DEPARTMENT_NODES.map(d => d.label));
    for (const stream of createInitialState().activeStreams) {
      expect(labels.has(stream.from)).toBe(true);
    }
  });

  it('matches each stream priority to its department baseline', () => {
    // Regression: RADIOLOGY was declared P3 but emitted a P4 stream, and
    // PHARMACY was P4 emitting P3, so rooms were labelled with one class and
    // shot out particles of another.
    const byLabel = new Map(DEPARTMENT_NODES.map(d => [d.label, d]));
    for (const stream of createInitialState().activeStreams) {
      expect(stream.priority).toBe(byLabel.get(stream.from)?.baselinePriority);
    }
  });

  it('assigns every non-alert stream to exactly one config row', () => {
    // Regression: the old index-based map left stream-pharmacy in no row and
    // never remapped the stress streams.
    const configured = DEFAULT_PRIORITY_CONFIG.flatMap(r => r.streamIds);
    expect(new Set(configured).size).toBe(configured.length);

    const stressed = run([{ type: 'SIMULATE_STRESS' }]);
    const ids = stressed.activeStreams.filter(s => !s.isAlertParticle).map(s => s.id);
    for (const id of ids) expect(configured).toContain(id);
  });
});

describe('latency model', () => {
  it('holds P1 latency independent of network load', () => {
    const low = calculateDeliveryTime('P1', 10, () => 0);
    const high = calculateDeliveryTime('P1', 95, () => 0);
    expect(low).toBe(high);
  });

  it('degrades lower priorities as load rises', () => {
    const low = calculateDeliveryTime('P4', 10, () => 0);
    const high = calculateDeliveryTime('P4', 95, () => 0);
    expect(high).toBeGreaterThan(low);
  });

  it('orders baseline latency by priority', () => {
    const at = (p: 'P1' | 'P2' | 'P3' | 'P4' | 'P5') => calculateDeliveryTime(p, 0, () => 0);
    expect(at('P1')).toBeLessThan(at('P2'));
    expect(at('P2')).toBeLessThan(at('P3'));
    expect(at('P3')).toBeLessThan(at('P4'));
    expect(at('P4')).toBeLessThan(at('P5'));
  });

  it('makes untriaged delivery slower than triaged P1', () => {
    expect(calculateUntriagedTime(90, () => 0)).toBeGreaterThan(
      calculateDeliveryTime('P1', 90, () => 0),
    );
  });
});

describe('node availability', () => {
  it('suspends only the streams of the node taken offline', () => {
    const s = run([{ type: 'TOGGLE_NODE', name: 'STAFF' }]);
    expect(streamsFrom(s, 'STAFF').every(x => !x.active)).toBe(true);
    expect(streamsFrom(s, 'ICU').every(x => x.active)).toBe(true);
  });

  it('restores them when the node comes back', () => {
    const s = run([
      { type: 'TOGGLE_NODE', name: 'STAFF' },
      { type: 'TOGGLE_NODE', name: 'STAFF' },
    ]);
    expect(streamsFrom(s, 'STAFF').every(x => x.active)).toBe(true);
    expect(s.mode).toBe('normal');
  });

  it('never leaves a stream active while its source is offline', () => {
    const nodes = { ICU: { active: false } };
    const streams: Stream[] = [
      { id: 'a', from: 'ICU', to: 'SERVER', priority: 'P2', label: 'x', particleCount: 1, speed: 100, active: true },
    ];
    expect(withNodeAvailability(streams, nodes)[0].active).toBe(false);
  });
});

describe('alerts', () => {
  it('suspends P4 and P5 traffic while a P1 alert is in flight', () => {
    const s = run([{ type: 'TRIGGER_ALERT', alertType: 'cardiac' }]);
    const background = s.activeStreams.filter(
      x => (x.priority === 'P4' || x.priority === 'P5') && !x.isAlertParticle,
    );
    expect(background.every(x => !x.active)).toBe(true);
    expect(s.mode).toBe('critical');
  });

  it('does not resurrect streams of an offline node when the alert ends', () => {
    // Regression: END_ALERT unconditionally reactivated every P4/P5 stream,
    // so firing an alert brought traffic back from departments the user had
    // explicitly killed.
    const s = run([
      { type: 'TOGGLE_NODE', name: 'STAFF' },
      { type: 'TRIGGER_ALERT', alertType: 'cardiac' },
      { type: 'END_ALERT' },
    ]);
    expect(streamsFrom(s, 'STAFF').every(x => !x.active)).toBe(true);
  });

  it('keeps failure mode after an alert ends while a node is still down', () => {
    // Regression: the alert timeout hardcoded its return mode, so the header
    // claimed NETWORK ACTIVE while ICU was dark.
    const s = run([
      { type: 'TOGGLE_NODE', name: 'ICU' },
      { type: 'TRIGGER_ALERT', alertType: 'crashcart' },
      { type: 'END_ALERT' },
    ]);
    expect(s.mode).toBe('failure');
  });

  it('refuses an alert from an offline department', () => {
    const s = run([
      { type: 'TOGGLE_NODE', name: 'ICU' },
      { type: 'TRIGGER_ALERT', alertType: 'cardiac' },
    ]);
    expect(s.activeAlerts).toHaveLength(0);
    expect(s.eventLog[0].label).toContain('UNROUTABLE');
    expect(s.eventLog[0].status).toBe('dropped');
  });

  it('records the load at fire time so the comparison view is stable', () => {
    const s = run([{ type: 'TRIGGER_ALERT', alertType: 'cardiac' }]);
    expect(s.activeAlerts[0].networkLoadAtFire).toBe(LOAD.initial);
  });

  it('caps the number of retained alerts', () => {
    const many: Action[] = Array.from({ length: 30 }, () => ({
      type: 'TRIGGER_ALERT' as const, alertType: 'cardiac' as const,
    }));
    expect(run(many).activeAlerts.length).toBeLessThanOrEqual(12);
  });
});

describe('stress scenario', () => {
  it('adds stress streams and enters stressed mode', () => {
    const s = run([{ type: 'SIMULATE_STRESS' }]);
    expect(isStressEngaged(s.activeStreams)).toBe(true);
    expect(s.mode).toBe('stressed');
  });

  it('is idempotent', () => {
    const once = run([{ type: 'SIMULATE_STRESS' }]);
    const twice = run([{ type: 'SIMULATE_STRESS' }, { type: 'SIMULATE_STRESS' }]);
    expect(twice.activeStreams).toHaveLength(once.activeStreams.length);
  });

  it('does not activate stress streams for an offline department', () => {
    const s = run([
      { type: 'TOGGLE_NODE', name: 'STAFF' },
      { type: 'SIMULATE_STRESS' },
    ]);
    expect(streamsFrom(s, 'STAFF').every(x => !x.active)).toBe(true);
  });

  it('stays congested when a department goes offline mid-stress', () => {
    // Regression: congestion was read from `mode`, so any node failure
    // (mode -> 'failure') silently cancelled the stress scenario.
    const s = run([
      { type: 'SIMULATE_STRESS' },
      { type: 'TOGGLE_NODE', name: 'ADMIN' },
    ]);
    expect(s.mode).toBe('failure');
    expect(isStressEngaged(s.activeStreams)).toBe(true);
    expect(targetLoad(s, 0)).toBeGreaterThan(LOAD.normalCentre);
  });
});

describe('load model', () => {
  it('scales offered load with the fraction of departments online', () => {
    const full = createInitialState();
    const degraded = run([{ type: 'TOGGLE_NODE', name: 'ADMIN' }]);
    expect(targetLoad(degraded, 0)).toBeLessThan(targetLoad(full, 0));
    expect(activeRatio(degraded.nodes)).toBeCloseTo(6 / 7, 5);
  });

  it('falls to zero only when every department is offline', () => {
    const all = DEPARTMENT_NODES.map(d => ({ type: 'TOGGLE_NODE' as const, name: d.label }));
    const s = run(all);
    expect(targetLoad(s, 0)).toBe(0);
  });

  it('converges to its target rather than stalling short', () => {
    // Regression: rounding each step meant a delta below ~3.3 rounded to
    // zero movement, parking the gauge a point below target forever.
    let s = createInitialState();
    const c = ctx();
    for (let i = 0; i < 400; i++) s = reduce(s, { type: 'TICK', elapsedSeconds: 0 }, c);
    expect(s.networkLoad).toBeCloseTo(targetLoad(s, 0), 4);
  });
});

describe('priority configuration', () => {
  it('repoints exactly the streams a row governs', () => {
    const s = run([{ type: 'SET_PRIORITY', rowId: 'background', level: 'P1' }]);
    expect(s.activeStreams.find(x => x.id === 'stream-staff')?.priority).toBe('P1');
    expect(s.activeStreams.find(x => x.id === 'stream-icu')?.priority).toBe('P2');
  });

  it('refuses to change the locked P1 row', () => {
    const s = run([{ type: 'SET_PRIORITY', rowId: 'critical', level: 'P5' }]);
    expect(s.priorityConfig.find(r => r.id === 'critical')?.level).toBe('P1');
  });

  it('ignores an unknown row', () => {
    const before = createInitialState();
    const after = run([{ type: 'SET_PRIORITY', rowId: 'nope', level: 'P3' }], before);
    expect(after).toBe(before);
  });
});

describe('event log', () => {
  it('caps retained entries', () => {
    const many: Action[] = Array.from({ length: MAX_LOG + 25 }, () => ({
      type: 'TOGGLE_NODE' as const, name: 'STAFF',
    }));
    expect(run(many).eventLog).toHaveLength(MAX_LOG);
  });

  it('tags infrastructure events distinctly from traffic', () => {
    // Regression: node failures were logged as P1 traffic and the "without
    // triage" note as a dropped P5 packet, inflating the drop count.
    const s = run([{ type: 'TOGGLE_NODE', name: 'STAFF' }]);
    expect(s.eventLog[0].kind).toBe('infra');
    expect(s.eventLog[0].priority).toBeNull();
  });

  it('records the untriaged comparison as a note, not a dropped packet', () => {
    const s = run([{ type: 'TRIGGER_ALERT', alertType: 'cardiac' }]);
    const note = s.eventLog.find(e => e.kind === 'note');
    expect(note?.status).toBe('note');
  });

  it('emits newest first', () => {
    const s = run([
      { type: 'TOGGLE_NODE', name: 'STAFF' },
      { type: 'TOGGLE_NODE', name: 'ADMIN' },
    ]);
    expect(s.eventLog[0].label).toContain('ADMIN');
  });
});

describe('reset', () => {
  it('returns the network to its initial condition but keeps history', () => {
    const s = run([
      { type: 'SIMULATE_STRESS' },
      { type: 'TOGGLE_NODE', name: 'ICU' },
      { type: 'RESET' },
    ]);
    expect(s.mode).toBe('normal');
    expect(isStressEngaged(s.activeStreams)).toBe(false);
    expect(Object.values(s.nodes).every(n => n.active)).toBe(true);
    expect(s.eventLog.length).toBeGreaterThan(0);
  });
});

describe('baseMode', () => {
  it('reports failure whenever any department is offline', () => {
    expect(baseMode({ A: { active: true }, B: { active: false } }, [])).toBe('failure');
  });

  it('reports normal when all are online and no stress is engaged', () => {
    expect(baseMode({ A: { active: true } }, [])).toBe('normal');
  });
});
