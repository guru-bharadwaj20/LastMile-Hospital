/**
 * useNetworkSimulation.ts — React adapter over the pure engine.
 *
 * This module owns everything the engine deliberately does not: timers, the
 * wall clock, and React state. All decisions live in engine.ts.
 */
import { useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
import { TIMING } from './constants';
import { createInitialState, createSimulationContext, reduce } from './engine';
import type { Action, AlertType, Priority, SimulationActions, SimulationState } from './types';

export interface UseNetworkSimulationOptions {
  random?: () => number;
  now?: () => number;
}

export interface UseNetworkSimulationResult {
  state: SimulationState;
  actions: SimulationActions;
}

export function useNetworkSimulation(
  options: UseNetworkSimulationOptions = {},
): UseNetworkSimulationResult {
  // One context per mounted hook. Tests can inject deterministic sources.
  const ctx = useMemo(
    () => createSimulationContext(options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [state, rawDispatch] = useReducer(
    (s: SimulationState, action: Action) => reduce(s, action, ctx),
    undefined,
    createInitialState,
  );

  const startTimeRef = useRef<number>(0);
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const baselineTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Stable dispatch identity for the callbacks below.
  const dispatch = useCallback((action: Action) => rawDispatch(action), []);

  // ── Load oscillation ────────────────────────────────────────
  useEffect(() => {
    // Seeded here rather than during render so render stays pure.
    startTimeRef.current = ctx.now();

    const interval = setInterval(() => {
      dispatch({
        type: 'TICK',
        elapsedSeconds: (ctx.now() - startTimeRef.current) / 1000,
      });
    }, TIMING.tickInterval);

    return () => clearInterval(interval);
  }, [ctx, dispatch]);

  // ── Baseline traffic log ────────────────────────────────────
  useEffect(() => {
    const schedule = () => {
      const span = TIMING.baselineLogMax - TIMING.baselineLogMin;
      const delay = TIMING.baselineLogMin + ctx.random() * span;
      baselineTimeoutRef.current = setTimeout(() => {
        dispatch({ type: 'LOG_BASELINE' });
        schedule();
      }, delay);
    };

    schedule();
    return () => clearTimeout(baselineTimeoutRef.current);
  }, [ctx, dispatch]);

  // ── Congestion drop check ───────────────────────────────────
  useEffect(() => {
    const interval = setInterval(
      () => dispatch({ type: 'DROP_CHECK' }),
      TIMING.dropInterval,
    );
    return () => clearInterval(interval);
  }, [dispatch]);

  // ── Actions ─────────────────────────────────────────────────
  const triggerAlert = useCallback((alertType: AlertType) => {
    dispatch({ type: 'TRIGGER_ALERT', alertType });

    clearTimeout(alertTimeoutRef.current);
    alertTimeoutRef.current = setTimeout(
      () => dispatch({ type: 'END_ALERT' }),
      TIMING.alertHoldMs,
    );
  }, [dispatch]);

  const simulateStress = useCallback(
    () => dispatch({ type: 'SIMULATE_STRESS' }), [dispatch]);

  const resetNetwork = useCallback(() => {
    clearTimeout(alertTimeoutRef.current);
    startTimeRef.current = ctx.now();
    dispatch({ type: 'RESET' });
  }, [ctx, dispatch]);

  const toggleNodeFailure = useCallback(
    (name: string) => dispatch({ type: 'TOGGLE_NODE', name }), [dispatch]);

  const updatePriorityConfig = useCallback(
    (rowId: string, level: Priority) => dispatch({ type: 'SET_PRIORITY', rowId, level }),
    [dispatch]);

  // ── Cleanup ─────────────────────────────────────────────────
  useEffect(() => () => {
    clearTimeout(alertTimeoutRef.current);
    clearTimeout(baselineTimeoutRef.current);
  }, []);

  const actions = useMemo<SimulationActions>(() => ({
    triggerAlert,
    simulateStress,
    resetNetwork,
    toggleNodeFailure,
    updatePriorityConfig,
  }), [triggerAlert, simulateStress, resetNetwork, toggleNodeFailure, updatePriorityConfig]);

  return { state, actions };
}
