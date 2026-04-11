import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Server, Zap } from 'lucide-react';
import HospitalMap from './components/HospitalMap';
import TrafficStream from './components/TrafficStream';
import NetworkLoadMeter from './components/NetworkLoadMeter';
import AlertPanel from './components/AlertPanel';
import EventLog from './components/EventLog';
import PriorityLegend from './components/PriorityLegend';
import NodeFailurePanel from './components/NodeFailurePanel';
import ComparisonView from './components/ComparisonView';
import DemoController from './components/DemoController';
import { useNetworkSimulation, DEPARTMENTS } from './simulation/networkState';

/**
 * App — Main application layout for LastMile Hospital Network Triage System.
 * Layer 3: Full simulation with failure, comparison, demo mode, and polish.
 */
export default function App() {
  const [clock, setClock] = useState(formatTime());
  const { state, actions } = useNetworkSimulation();
  const [showComparison, setShowComparison] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => {
      setClock(formatTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Count active nodes
  const totalNodes = Object.keys(state.nodes).length + 1; // +1 for server
  const activeNodes = Object.values(state.nodes).filter(n => n.active).length + 1;

  // Check for critical node offline (ICU or ER)
  const criticalOfflineNodes = Object.entries(state.nodes)
    .filter(([name, node]) => !node.active && (name === 'ICU' || name === 'ER'))
    .map(([name]) => name);

  // Mode-based status
  const isNetworkActive = state.mode !== 'failure';
  const modeLabel = {
    normal: 'NETWORK ACTIVE',
    stressed: 'NETWORK STRESSED',
    critical: '⚠ CRITICAL ALERT',
    failure: '✗ NODE FAILURE',
  }[state.mode] || 'NETWORK ACTIVE';

  const openComparison = useCallback(() => setShowComparison(true), []);
  const closeComparison = useCallback(() => setShowComparison(false), []);

  // Mobile message
  if (isMobile) {
    return (
      <div className="mobile-message">
        <div className="mobile-message-icon">🏥</div>
        <h1 className="mobile-message-title">LASTMILE</h1>
        <p className="mobile-message-text">
          LastMile is optimized for desktop presentation.<br />
          Please open on a laptop.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Subtle CRT scanline overlay for atmosphere */}
      <div className="scanline-overlay" />
      {/* CRT vignette overlay */}
      <div className="vignette-overlay" />

      <div className="app-layout">
        {/* ── Header ───────────────────────────────────────── */}
        <header className="app-header" id="app-header">
          <div className="header-brand">
            <motion.h1
              className="header-logo"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              LASTMILE
            </motion.h1>
            <span className="header-tagline">Hospital Network Triage System</span>
          </div>

          <div className="header-status">
            {/* Show Comparison Button */}
            <motion.button
              className="header-comparison-btn"
              onClick={openComparison}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              id="show-comparison"
            >
              <Zap size={12} />
              <span>SHOW COMPARISON</span>
            </motion.button>

            <div className="status-item" id="status-network">
              <span className={`status-dot ${!isNetworkActive ? 'inactive' : ''} ${state.mode === 'stressed' ? 'stressed' : ''} ${state.mode === 'critical' ? 'critical-dot' : ''}`} />
              <span>{modeLabel}</span>
            </div>
            <div className="status-item" id="status-mode">
              <span className={`mode-badge mode-${state.mode}`}>
                {state.mode.toUpperCase()}
              </span>
            </div>
            <div className="status-item" id="status-clock">
              <Clock size={13} style={{ opacity: 0.5 }} />
              <span>{clock}</span>
            </div>
            <div className="status-item" id="status-nodes">
              <Server size={13} style={{ opacity: 0.5 }} />
              <span>NODES: {activeNodes}/{totalNodes}</span>
            </div>
          </div>
        </header>

        {/* ── Main Area (Map + Load Meter) ─────────────────── */}
        <main className="app-main" id="main-viewport">
          <NetworkLoadMeter state={state} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Critical node warning banner */}
            <AnimatePresence>
              {criticalOfflineNodes.length > 0 && (
                <motion.div
                  className="critical-warning-banner"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  ⚠ CRITICAL NODE OFFLINE — P1 traffic from {criticalOfflineNodes.join(', ')} unroutable
                </motion.div>
              )}
            </AnimatePresence>
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
              <HospitalMap nodes={state.nodes} mode={state.mode} />
              <TrafficStream activeStreams={state.activeStreams} mode={state.mode} />
            </div>
            <PriorityLegend />
          </div>
        </main>

        {/* ── Right Sidebar ────────────────────────────────── */}
        <aside className="app-sidebar" id="alert-panel">
          <AlertPanel state={state} actions={actions} onShowComparison={openComparison} />
          <NodeFailurePanel nodes={state.nodes} actions={actions} />
        </aside>

        {/* ── Bottom Event Log ─────────────────────────────── */}
        <footer className="app-footer" id="event-log">
          <EventLog eventLog={state.eventLog} onShowComparison={openComparison} />
        </footer>
      </div>

      {/* ── Comparison Overlay ──────────────────────────────── */}
      <ComparisonView
        isOpen={showComparison}
        onClose={closeComparison}
        state={state}
      />

      {/* ── Demo Controller ────────────────────────────────── */}
      <DemoController
        actions={actions}
        onShowComparison={openComparison}
        onCloseComparison={closeComparison}
      />
    </>
  );
}

function formatTime() {
  const now = new Date();
  return now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
