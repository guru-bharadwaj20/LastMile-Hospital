import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Zap } from 'lucide-react';
import HospitalMap from './components/HospitalMap';
import TrafficStream from './components/TrafficStream';
import NetworkLoadMeter from './components/NetworkLoadMeter';
import { ActiveAlertsSection, EmergencyConsoleSection, PriorityConfigurationSection } from './components/AlertPanel';
import EventLog from './components/EventLog';
import PriorityLegend from './components/PriorityLegend';
import NodeFailurePanel from './components/NodeFailurePanel';
import ComparisonView from './components/ComparisonView';
import { useNetworkSimulation } from './simulation/networkState';

/**
 * App — Main application layout for LastMile Hospital Network Triage System.
 * Layer 3: Full simulation with failure, comparison, demo mode, and polish.
 */
export default function App() {
  const { state, actions } = useNetworkSimulation();
  const [showComparison, setShowComparison] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [openPanels, setOpenPanels] = useState({
    emergency: true,
    infrastructure: false,
    eventLog: false,
    priority: false,
    alerts: false,
  });

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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
  const togglePanel = useCallback((panelKey) => {
    setOpenPanels((prev) => ({
      ...prev,
      [panelKey]: !prev[panelKey],
    }));
  }, []);

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
          </div>

          <div className="header-center">
            <div className="status-item" id="status-network">
              <span className={`status-dot ${!isNetworkActive ? 'inactive' : ''} ${state.mode === 'stressed' ? 'stressed' : ''} ${state.mode === 'critical' ? 'critical-dot' : ''}`} />
              <span>{modeLabel}</span>
            </div>
          </div>

          <div className="header-actions">
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
          </div>
        </header>

        {/* ── Main Area (65/35 Split) ──────────────────────── */}
        <main className="app-main" id="main-viewport">
          <section className="left-pane">
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
                <HospitalMap nodes={state.nodes} />
                <TrafficStream activeStreams={state.activeStreams} />
              </div>
              <PriorityLegend />
            </div>
          </section>

          <aside className="app-sidebar" id="alert-panel">
            <AccordionSection
              title="Emergency Control"
              isOpen={openPanels.emergency}
              onToggle={() => togglePanel('emergency')}
            >
              <EmergencyConsoleSection state={state} actions={actions} />
            </AccordionSection>

            <AccordionSection
              title="Infrastructure Access"
              isOpen={openPanels.infrastructure}
              onToggle={() => togglePanel('infrastructure')}
            >
              <NodeFailurePanel nodes={state.nodes} actions={actions} compact />
            </AccordionSection>

            <AccordionSection
              title="Network Event Log"
              isOpen={openPanels.eventLog}
              onToggle={() => togglePanel('eventLog')}
            >
              <div className="sidebar-event-log-wrap">
                <EventLog eventLog={state.eventLog} onShowComparison={openComparison} />
              </div>
            </AccordionSection>

            <AccordionSection
              title="Priority Configuration"
              isOpen={openPanels.priority}
              onToggle={() => togglePanel('priority')}
            >
              <PriorityConfigurationSection state={state} actions={actions} />
            </AccordionSection>

            <AccordionSection
              title="Active Alerts"
              isOpen={openPanels.alerts}
              onToggle={() => togglePanel('alerts')}
            >
              <ActiveAlertsSection state={state} />
            </AccordionSection>
          </aside>
        </main>
      </div>

      {/* ── Comparison Overlay ──────────────────────────────── */}
      <ComparisonView
        isOpen={showComparison}
        onClose={closeComparison}
        state={state}
      />
    </>
  );
}

function AccordionSection({ title, isOpen, onToggle, children }) {
  return (
    <section className="sidebar-accordion-section">
      <button className="sidebar-accordion-header" onClick={onToggle}>
        <span>{title}</span>
        <ChevronDown
          size={14}
          className={`sidebar-accordion-chevron ${isOpen ? 'open' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            className="sidebar-accordion-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="sidebar-accordion-inner">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

