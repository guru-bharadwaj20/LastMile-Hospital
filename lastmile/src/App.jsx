import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radio, Clock, Server } from 'lucide-react';
import HospitalMap from './components/HospitalMap';
import TrafficStream from './components/TrafficStream';
import NetworkLoadMeter from './components/NetworkLoadMeter';
import AlertPanel from './components/AlertPanel';
import EventLog from './components/EventLog';
import PriorityLegend from './components/PriorityLegend';

/**
 * App — Main application layout for LastMile Hospital Network Triage System.
 * Layer 1: Static UI scaffold with mock data.
 */
export default function App() {
  const [clock, setClock] = useState(formatTime());

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => {
      setClock(formatTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
              <span className="status-dot" />
              <span>NETWORK ACTIVE</span>
            </div>
            <div className="status-item" id="status-clock">
              <Clock size={13} style={{ opacity: 0.5 }} />
              <span>{clock}</span>
            </div>
            <div className="status-item" id="status-nodes">
              <Server size={13} style={{ opacity: 0.5 }} />
              <span>NODES: 8/8</span>
            </div>
          </div>
        </header>

        {/* ── Main Area (Map + Load Meter) ─────────────────── */}
        <main className="app-main" id="main-viewport">
          <NetworkLoadMeter />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
              <HospitalMap />
              <TrafficStream />
            </div>
            <PriorityLegend />
          </div>
        </main>

        {/* ── Right Sidebar ────────────────────────────────── */}
        <aside className="app-sidebar" id="alert-panel">
          <AlertPanel />
        </aside>

        {/* ── Bottom Event Log ─────────────────────────────── */}
        <footer className="app-footer" id="event-log">
          <EventLog />
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
