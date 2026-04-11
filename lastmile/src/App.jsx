import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radio, Clock, Server } from 'lucide-react';
import HospitalMap from './components/HospitalMap';
import TrafficStream from './components/TrafficStream';
import NetworkLoadMeter from './components/NetworkLoadMeter';
import AlertPanel from './components/AlertPanel';
import EventLog from './components/EventLog';
import PriorityLegend from './components/PriorityLegend';
import { useNetworkSimulation } from './simulation/networkState';

/**
 * App — Main application layout for LastMile Hospital Network Triage System.
 * Layer 2: All components wired to live simulation state.
 */
export default function App() {
  const [clock, setClock] = useState(formatTime());
  const { state, actions } = useNetworkSimulation();

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => {
      setClock(formatTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Count active nodes
  const totalNodes = Object.keys(state.nodes).length + 1; // +1 for server
  const activeNodes = Object.values(state.nodes).filter(n => n.active).length + 1;

  // Mode-based status
  const isNetworkActive = state.mode !== 'failure';
  const modeLabel = {
    normal: 'NETWORK ACTIVE',
    stressed: 'NETWORK STRESSED',
    critical: '⚠ CRITICAL ALERT',
    failure: '✗ NODE FAILURE',
  }[state.mode] || 'NETWORK ACTIVE';

  return (
    <>
      {/* Subtle CRT scanline overlay for atmosphere */}
      <div className="scanline-overlay" />

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
            <div className="status-item" id="status-network">
              <span className={`status-dot ${!isNetworkActive ? 'inactive' : ''} ${state.mode === 'stressed' ? 'stressed' : ''} ${state.mode === 'critical' ? 'critical-dot' : ''}`} />
              <span>{modeLabel}</span>
            </div>
            <div className="status-item" id="status-mode">
              <span style={{
                fontSize: '9px',
                padding: '2px 6px',
                borderRadius: '3px',
                background: state.mode === 'normal' ? 'rgba(52,211,153,0.15)' : state.mode === 'critical' ? 'rgba(255,45,45,0.2)' : 'rgba(251,191,36,0.15)',
                color: state.mode === 'normal' ? '#34d399' : state.mode === 'critical' ? '#ff2d2d' : '#fbbf24',
                letterSpacing: '1px',
              }}>
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
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
              <HospitalMap nodes={state.nodes} mode={state.mode} />
              <TrafficStream activeStreams={state.activeStreams} mode={state.mode} />
            </div>
            <PriorityLegend />
          </div>
        </main>

        {/* ── Right Sidebar ────────────────────────────────── */}
        <aside className="app-sidebar" id="alert-panel">
          <AlertPanel state={state} actions={actions} />
        </aside>

        {/* ── Bottom Event Log ─────────────────────────────── */}
        <footer className="app-footer" id="event-log">
          <EventLog eventLog={state.eventLog} />
        </footer>
      </div>
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
