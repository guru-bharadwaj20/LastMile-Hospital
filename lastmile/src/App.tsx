import { useState, useCallback, useId } from 'react';
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
import { useNetworkSimulation } from './simulation';

/**
 * App — Main application layout for LastMile Hospital Network Triage System.
 */
export default function App() {
  const { state, actions } = useNetworkSimulation();
  const [showComparison, setShowComparison] = useState(false);
  const [openPanels, setOpenPanels] = useState({
    emergency: true,
    infrastructure: false,
    eventLog: false,
    priority: false,
    alerts: false,
  });

  const offlineNodes = Object.entries(state.nodes)
    .filter(([, node]) => !node.active)
    .map(([name]) => name);

  const criticalOfflineNodes = offlineNodes.filter(n => n === 'ICU' || n === 'ER');

  // The header reflects severity honestly: one department offline is a
  // degraded network, not a downed one.
  const modeLabel = {
    normal: 'NETWORK ACTIVE',
    stressed: 'NETWORK STRESSED',
    critical: '⚠ CRITICAL ALERT',
    failure: `⚠ DEGRADED — ${offlineNodes.length} OFFLINE`,
  }[state.mode] ?? 'NETWORK ACTIVE';

  const openComparison = useCallback(() => setShowComparison(true), []);
  const closeComparison = useCallback(() => setShowComparison(false), []);
  const togglePanel = useCallback((panelKey: keyof typeof openPanels) => {
    setOpenPanels((prev) => ({ ...prev, [panelKey]: !prev[panelKey] }));
  }, []);

  return (
    <>
      <div className="scanline-overlay" aria-hidden="true" />
      <div className="vignette-overlay" aria-hidden="true" />

      <div className="app-layout">
        <header className="app-header">
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
            <div className="status-item" role="status">
              <span className={`status-dot mode-${state.mode}`} />
              <span>{modeLabel}</span>
            </div>
          </div>

          <div className="header-actions">
            <motion.button
              className="header-comparison-btn"
              onClick={openComparison}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Zap size={12} aria-hidden="true" />
              <span>SHOW COMPARISON</span>
            </motion.button>
          </div>
        </header>

        <main className="app-main">
          <section className="left-pane">
            <NetworkLoadMeter state={state} />
            <div className="map-column">
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

              <div className="map-stage">
                <HospitalMap nodes={state.nodes} />
                <TrafficStream activeStreams={state.activeStreams} />
              </div>

              <PriorityLegend />
            </div>
          </section>

          <aside className="app-sidebar">
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
              <NodeFailurePanel nodes={state.nodes} actions={actions} />
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

      {/* AnimatePresence must live here, outside the component it animates.
          Previously it sat inside ComparisonView, which returned null when
          closed, so it unmounted before it could ever play an exit. */}
      <AnimatePresence>
        {showComparison && (
          <ComparisonView key="comparison" onClose={closeComparison} state={state} />
        )}
      </AnimatePresence>
    </>
  );
}

interface AccordionSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function AccordionSection({ title, isOpen, onToggle, children }: AccordionSectionProps) {
  const panelId = useId();

  return (
    <section className="sidebar-accordion-section">
      <h2 className="sidebar-accordion-heading">
        <button
          className="sidebar-accordion-header"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
        >
          <span>{title}</span>
          <ChevronDown
            size={14}
            className={`sidebar-accordion-chevron ${isOpen ? 'open' : ''}`}
            aria-hidden="true"
          />
        </button>
      </h2>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={panelId}
            className="sidebar-accordion-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="sidebar-accordion-inner">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
