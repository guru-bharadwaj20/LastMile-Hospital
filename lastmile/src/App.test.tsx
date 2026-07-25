import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

/** Drive the viewport width jsdom reports. */
function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true });
  window.dispatchEvent(new Event('resize'));
}

describe('App', () => {
  beforeEach(() => setViewport(1440));
  afterEach(() => vi.useRealTimers());

  it('renders the dashboard shell', () => {
    render(<App />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'LASTMILE' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('NETWORK ACTIVE');
  });

  it('renders at phone width instead of refusing to load', () => {
    // Regression: anything under 1024px used to be replaced wholesale by a
    // "Please open on a laptop" splash.
    setViewport(390);
    render(<App />);

    expect(screen.getByRole('heading', { name: 'LASTMILE' })).toBeInTheDocument();
    expect(screen.queryByText(/open on a laptop/i)).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: /hospital floor plan/i })).toBeInTheDocument();
  });

  it('exposes sidebar panels as labelled accordions', async () => {
    const user = userEvent.setup();
    render(<App />);

    const infra = screen.getByRole('button', { name: /Infrastructure Access/i });
    expect(infra).toHaveAttribute('aria-expanded', 'false');

    await user.click(infra);
    expect(infra).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('button', { name: /take offline/i }).length).toBeGreaterThan(0);
  });

  it('reports degraded rather than total failure when one node is killed', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Infrastructure Access/i }));
    await user.click(screen.getByRole('button', { name: /take offline ADMIN node/i }));

    expect(screen.getByRole('status')).toHaveTextContent('DEGRADED — 1 OFFLINE');
  });

  it('warns when a P1-capable department goes dark', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Infrastructure Access/i }));
    await user.click(screen.getByRole('button', { name: /take offline ICU node/i }));

    expect(await screen.findByText(/CRITICAL NODE OFFLINE/i)).toBeInTheDocument();
  });

  describe('comparison dialog', () => {
    it('opens as a modal dialog and closes on Escape', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: /SHOW COMPARISON/i }));

      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAccessibleName(/with and without LastMile triage/i);

      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('closes from the dismiss button', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: /SHOW COMPARISON/i }));
      // Exact name: the icon button is "Close comparison", the footer button
      // is "CLOSE COMPARISON", and a case-insensitive regex matches both.
      await user.click(await screen.findByRole('button', { name: 'Close comparison' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('holds its figures steady while the simulation ticks underneath', async () => {
      // Regression: metrics were recomputed with Math.random() during render,
      // and the parent re-renders twice a second, so every number in the
      // dialog changed continuously and each count-up restarted from zero.
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: /SHOW COMPARISON/i }));
      await screen.findByRole('dialog');

      const hero = () => screen.getByText(/delivers cardiac alerts/i).textContent;
      const before = hero();

      // Real timers: the load oscillator fires every 500ms, so this spans
      // several ticks and several parent re-renders.
      await new Promise(resolve => setTimeout(resolve, 1600));

      expect(hero()).toBe(before);
    });

    it('states that the figures come from the simulation model', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: /SHOW COMPARISON/i }));
      expect(
        await screen.findByText(/produced by the browser simulation model, not measured/i),
      ).toBeInTheDocument();
    });
  });

  it('disables the stress trigger once stress is engaged', async () => {
    const user = userEvent.setup();
    render(<App />);

    const stress = screen.getByRole('button', { name: /Simulate Network Stress/i });
    expect(stress).toBeEnabled();

    await user.click(stress);
    expect(stress).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('NETWORK STRESSED');
  });

  it('returns to normal after a reset', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Simulate Network Stress/i }));
    expect(screen.getByRole('status')).toHaveTextContent('NETWORK STRESSED');

    await user.click(screen.getByRole('button', { name: /Reset Network/i }));
    expect(screen.getByRole('status')).toHaveTextContent('NETWORK ACTIVE');
  });
});
