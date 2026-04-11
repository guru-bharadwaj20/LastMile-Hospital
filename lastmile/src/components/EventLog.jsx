import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PRIORITY_COLORS } from '../simulation/networkState';

/**
 * EventLog — Bottom bar with scrolling real-time network event entries.
 * Layer 3: Includes "See why this matters" button on P1 delivered entries.
 */
export default function EventLog({ eventLog, onShowComparison }) {
  const scrollRef = useRef(null);

  // Auto-scroll to top when new entry appears
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [eventLog.length]);

  return (
    <div className="event-log">
      {/* Header */}
      <div className="event-log-header">
        <h3 className="event-log-title">Network Event Log</h3>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '10px',
          color: 'var(--text-dim)',
        }}>
          {eventLog.length} events
        </span>
      </div>

      {/* Column headers */}
      <div className="event-entry" style={{
        padding: '4px 0',
        borderBottom: '1px solid var(--border)',
        margin: '0 20px',
        fontSize: '9px',
        color: 'var(--text-dim)',
        fontFamily: "'Rajdhani', sans-serif",
        fontWeight: 700,
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
        animation: 'none',
      }}>
        <span>Time</span>
        <span>Priority</span>
        <span>Description</span>
        <span style={{ textAlign: 'right' }}>Latency</span>
        <span style={{ textAlign: 'right' }}>Status</span>
      </div>

      {/* Entries */}
      <div className="event-log-entries" ref={scrollRef}>
        <AnimatePresence initial={false}>
          {eventLog.map((event) => {
            const color = PRIORITY_COLORS[event.priority] || 'var(--p5-background)';
            const isDropped = event.status === 'dropped';
            const isCritical = event.priority === 'P1';
            const showComparisonBtn = isCritical && event.status === 'delivered' && onShowComparison;

            return (
              <motion.div
                key={event.id}
                className={`event-entry ${isCritical ? 'critical-flash' : ''}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <span className="event-time">[{event.timestamp}]</span>
                <span className="event-priority" style={{ color }}>
                  <span
                    className="event-priority-dot"
                    style={{ background: color }}
                  />
                  {event.priority}
                </span>
                <span
                  className="event-desc"
                  style={isDropped ? { color: 'var(--text-dim)' } : {}}
                >
                  {event.label}
                  {showComparisonBtn && (
                    <button
                      className="event-comparison-btn"
                      onClick={onShowComparison}
                    >
                      See why this matters →
                    </button>
                  )}
                </span>
                <span
                  className="event-latency"
                  style={isDropped ? { textDecoration: 'line-through', color: 'var(--text-dim)' } : {}}
                >
                  {event.deliveredIn != null ? `${event.deliveredIn}ms` : '—'}
                </span>
                <span className={`event-status ${event.status}`}>
                  {event.status === 'delivered' ? '✓ DELIVERED' : '✗ DROPPED'}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
