import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NetworkLoadMeter from './NetworkLoadMeter';
import NodeFailurePanel from './NodeFailurePanel';
import EventLog from './EventLog';
import PriorityLegend from './PriorityLegend';
import HospitalMap from './HospitalMap';
import { PriorityConfigurationSection } from './AlertPanel';
import { createInitialState, createSimulationContext, reduce } from '../simulation';
import type { LogEntry, SimulationActions, SimulationState } from '../simulation';

const noopActions: SimulationActions = {
  triggerAlert: vi.fn(),
  simulateStress: vi.fn(),
  resetNetwork: vi.fn(),
  toggleNodeFailure: vi.fn(),
  updatePriorityConfig: vi.fn(),
};

const ctx = createSimulationContext({ random: () => 0.5, now: () => 0 });

function stateWith(...actions: Parameters<typeof reduce>[1][]): SimulationState {
  return actions.reduce((s, a) => reduce(s, a, ctx), createInitialState());
}

describe('NetworkLoadMeter', () => {
  it('exposes load as an accessible meter', () => {
    const state = { ...createInitialState(), networkLoad: 42.7 };
    render(<NetworkLoadMeter state={state} />);

    const meter = screen.getByRole('meter', { name: /network load/i });
    expect(meter).toHaveAttribute('aria-valuenow', '43');
    expect(meter).toHaveTextContent('43%');
  });

  it('clamps and renders the extremes without losing the read-out', () => {
    // Regression: the value used to sit inside a track with overflow:hidden
    // and was clipped at both 0% and 100%.
    for (const [load, shown] of [[0, '0%'], [100, '100%'], [140, '100%']] as const) {
      const { unmount } = render(
        <NetworkLoadMeter state={{ ...createInitialState(), networkLoad: load }} />,
      );
      expect(screen.getByRole('meter')).toHaveTextContent(shown);
      unmount();
    }
  });
});

describe('NodeFailurePanel', () => {
  it('lists every department with an online badge', () => {
    render(<NodeFailurePanel nodes={createInitialState().nodes} actions={noopActions} />);
    expect(screen.getAllByText('ONLINE')).toHaveLength(7);
    expect(screen.queryByText('OFFLINE')).not.toBeInTheDocument();
  });

  it('reflects an offline node and offers to restore it', () => {
    const state = stateWith({ type: 'TOGGLE_NODE', name: 'STAFF' });
    render(<NodeFailurePanel nodes={state.nodes} actions={noopActions} />);

    expect(screen.getByText('OFFLINE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /restore STAFF node/i })).toBeInTheDocument();
  });

  it('calls the action with the department it belongs to', async () => {
    const user = userEvent.setup();
    const actions = { ...noopActions, toggleNodeFailure: vi.fn() };
    render(<NodeFailurePanel nodes={createInitialState().nodes} actions={actions} />);

    await user.click(screen.getByRole('button', { name: /take offline ICU node/i }));
    expect(actions.toggleNodeFailure).toHaveBeenCalledWith('ICU');
  });
});

describe('EventLog', () => {
  const entry = (over: Partial<LogEntry>): LogEntry => ({
    id: 'e1', timestamp: '10:00:00', kind: 'traffic', priority: 'P3',
    label: 'Order System → Server', deliveredIn: 90, status: 'delivered', ...over,
  });

  it('announces new entries to assistive technology', () => {
    render(<EventLog eventLog={[entry({})]} />);
    expect(screen.getByRole('log', { name: /network events/i })).toBeInTheDocument();
  });

  it('renders infrastructure events without a traffic class', () => {
    render(<EventLog eventLog={[entry({ kind: 'infra', priority: null, label: 'NODE FAILURE — STAFF offline' })]} />);
    expect(screen.getByText('INFRA')).toBeInTheDocument();
  });

  it('labels a reference row as reference rather than dropped', () => {
    render(<EventLog eventLog={[entry({ kind: 'note', status: 'note', label: 'without triage ~340ms' })]} />);
    expect(screen.getByText('REFERENCE')).toBeInTheDocument();
    expect(screen.queryByText('✗ DROPPED')).not.toBeInTheDocument();
  });

  it('offers the comparison shortcut only on delivered P1 traffic', () => {
    const { rerender } = render(
      <EventLog eventLog={[entry({ priority: 'P1' })]} onShowComparison={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /why this matters/i })).toBeInTheDocument();

    rerender(<EventLog eventLog={[entry({ priority: 'P5' })]} onShowComparison={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /why this matters/i })).not.toBeInTheDocument();
  });
});

describe('PriorityConfigurationSection', () => {
  it('locks the P1 row instead of offering a control that does nothing', () => {
    const state = createInitialState();
    render(<PriorityConfigurationSection state={state} actions={noopActions} />);

    const rows = screen.getAllByRole('row');
    const criticalRow = rows.find(r => within(r).queryByText(/Cardiac/))!;
    expect(within(criticalRow).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(criticalRow).getByText('P1')).toBeInTheDocument();
  });

  it('reports the row id, not an array index', async () => {
    // Regression: rows were addressed positionally, which mismatched the
    // streams they were supposed to govern.
    const user = userEvent.setup();
    const actions = { ...noopActions, updatePriorityConfig: vi.fn() };
    render(<PriorityConfigurationSection state={createInitialState()} actions={actions} />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: /WiFi \/ Streaming \/ Browsers/i }),
      'P3',
    );
    expect(actions.updatePriorityConfig).toHaveBeenCalledWith('background', 'P3');
  });
});

describe('HospitalMap', () => {
  it('describes itself for assistive technology', () => {
    render(<HospitalMap nodes={createInitialState().nodes} />);
    expect(screen.getByRole('img', { name: /hospital floor plan/i })).toBeInTheDocument();
  });

  it('marks an offline department as such', () => {
    const state = stateWith({ type: 'TOGGLE_NODE', name: 'ADMIN' });
    const { container } = render(<HospitalMap nodes={state.nodes} />);
    expect(container.querySelectorAll('.dept-group.is-offline')).toHaveLength(1);
    expect(screen.getByText('OFFLINE')).toBeInTheDocument();
  });
});

describe('PriorityLegend', () => {
  it('lists all five classes plus the server', () => {
    render(<PriorityLegend />);
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });
});
