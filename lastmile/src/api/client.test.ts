import { describe, it, expect } from 'vitest';
import { parseStatus, parseEvent, resolveDataSource, DEFAULT_CONTROLLER_URL } from './client';

const validStatus = {
  version: '1.0',
  timestamp: 1700000000,
  source: 'controller',
  qosActive: true,
  connectedSwitches: [1, 2, 3],
  expectedSwitches: [1, 2, 3],
  networkLoad: 62.4,
  queues: [{ priority: 'P1', queueId: 0, dscp: 46, txBytes: 100, txPackets: 2, txErrors: 0, minShare: 35 }],
  observedShares: { P1: 70 },
};

describe('parseStatus', () => {
  it('accepts a well formed payload', () => {
    const parsed = parseStatus(validStatus);
    expect(parsed?.networkLoad).toBe(62.4);
    expect(parsed?.connectedSwitches).toEqual([1, 2, 3]);
    expect(parsed?.queues).toHaveLength(1);
  });

  it('clamps an out of range load rather than overflowing the gauge', () => {
    expect(parseStatus({ ...validStatus, networkLoad: 130 })?.networkLoad).toBe(100);
    expect(parseStatus({ ...validStatus, networkLoad: -5 })?.networkLoad).toBe(0);
  });

  it.each([
    ['null', null],
    ['a string', 'nope'],
    ['a missing load', { ...validStatus, networkLoad: undefined }],
    ['a non-numeric load', { ...validStatus, networkLoad: 'high' }],
    ['NaN', { ...validStatus, networkLoad: NaN }],
    ['missing queues', { ...validStatus, queues: undefined }],
    ['non-array switches', { ...validStatus, connectedSwitches: 3 }],
  ])('rejects %s', (_label, payload) => {
    expect(parseStatus(payload)).toBeNull();
  });

  it('drops malformed queue rows but keeps the good ones', () => {
    const parsed = parseStatus({
      ...validStatus,
      queues: [validStatus.queues[0], { priority: 5 }, null, { txBytes: 'lots' }],
    });
    expect(parsed?.queues).toHaveLength(1);
  });

  it('treats a missing qosActive as false rather than assuming enforcement', () => {
    expect(parseStatus({ ...validStatus, qosActive: undefined })?.qosActive).toBe(false);
  });

  it('defaults a missing timestamp instead of failing the whole frame', () => {
    const parsed = parseStatus({ ...validStatus, timestamp: undefined });
    expect(parsed).not.toBeNull();
    expect(Number.isFinite(parsed!.timestamp)).toBe(true);
  });
});

describe('parseEvent', () => {
  it('accepts a well formed event', () => {
    const parsed = parseEvent({
      version: '1.0', timestamp: 1, seq: 7, kind: 'infra', priority: null,
      label: 'Switch 1 connected',
    });
    expect(parsed?.label).toBe('Switch 1 connected');
    expect(parsed?.seq).toBe(7);
  });

  it('requires a label', () => {
    expect(parseEvent({ kind: 'infra' })).toBeNull();
    expect(parseEvent(null)).toBeNull();
  });

  it('defaults kind and seq', () => {
    const parsed = parseEvent({ label: 'something happened' });
    expect(parsed?.kind).toBe('infra');
    expect(parsed?.seq).toBe(0);
  });
});

describe('resolveDataSource', () => {
  it('defaults to the simulation so the deployed build needs no backend', () => {
    expect(resolveDataSource('')).toEqual({ mode: 'demo', url: DEFAULT_CONTROLLER_URL });
    expect(resolveDataSource('?foo=bar').mode).toBe('demo');
  });

  it('honours ?mode=live', () => {
    expect(resolveDataSource('?mode=live')).toEqual({
      mode: 'live', url: DEFAULT_CONTROLLER_URL,
    });
  });

  it('honours an explicit controller URL', () => {
    expect(resolveDataSource('?controller=http://10.0.0.9:8080')).toEqual({
      mode: 'live', url: 'http://10.0.0.9:8080',
    });
  });

  it('strips a trailing slash so paths do not double up', () => {
    expect(resolveDataSource('?controller=http://host:8080/').url).toBe('http://host:8080');
  });

  it('treats an explicit controller as live even without mode=live', () => {
    expect(resolveDataSource('?controller=http://host:8080').mode).toBe('live');
  });
});
