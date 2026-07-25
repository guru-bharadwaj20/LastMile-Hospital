/**
 * useControllerLink.ts — Live controller data, with the simulation as fallback.
 *
 * The dashboard runs the browser simulation by default so the deployed build
 * works with no backend. When ?mode=live is requested this hook probes the
 * controller, subscribes to its event stream, and reports what it found.
 *
 * It never silently pretends: if live data was asked for and is unavailable,
 * `state` becomes 'unavailable' and the UI says so rather than showing
 * simulated numbers under a LIVE badge.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  probeController,
  resolveDataSource,
  subscribe,
} from './client';
import type {
  ConnectionState,
  ControllerEvent,
  ControllerStatus,
  DataSourceMode,
} from './types';

const MAX_EVENTS = 50;

export interface ControllerLink {
  /** What the URL asked for. */
  requestedMode: DataSourceMode;
  /** What we actually have. */
  state: ConnectionState;
  status: ControllerStatus | null;
  events: ControllerEvent[];
  controllerUrl: string;
  /** True when live data is genuinely flowing. */
  isLive: boolean;
  retry: () => void;
}

export function useControllerLink(search = window.location.search): ControllerLink {
  const { mode, url } = useMemo(() => resolveDataSource(search), [search]);

  const [liveState, setLiveState] = useState<ConnectionState>('connecting');
  const [status, setStatus] = useState<ControllerStatus | null>(null);
  const [events, setEvents] = useState<ControllerEvent[]>([]);
  const [attempt, setAttempt] = useState(0);

  // Guards against a late probe resolving after unmount or after a retry has
  // superseded it, which would otherwise flip the badge back to connected.
  const generationRef = useRef(0);

  // Derived, not stored: in demo mode there is no connection to have a state,
  // so writing 'idle' into state from an effect would be storing something
  // already implied by `mode`.
  const state: ConnectionState = mode === 'live' ? liveState : 'idle';

  useEffect(() => {
    if (mode !== 'live') return;

    const generation = ++generationRef.current;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    probeController(url).then((reachable) => {
      if (cancelled || generation !== generationRef.current) return;

      if (!reachable) {
        setLiveState('unavailable');
        return;
      }

      setLiveState('connected');
      unsubscribe = subscribe(url, {
        onStatus: (next) => {
          if (generation === generationRef.current) setStatus(next);
        },
        onEvent: (event) => {
          if (generation !== generationRef.current) return;
          setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
        },
        onError: () => {
          if (generation === generationRef.current) setLiveState('unavailable');
        },
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [mode, url, attempt]);

  // Reset in the event handler rather than the effect: this is a user action,
  // not a render-time derivation.
  const retry = useCallback(() => {
    setLiveState('connecting');
    setAttempt((n) => n + 1);
  }, []);

  return {
    requestedMode: mode,
    state,
    status,
    events,
    controllerUrl: url,
    isLive: state === 'connected' && status !== null,
    retry,
  };
}
