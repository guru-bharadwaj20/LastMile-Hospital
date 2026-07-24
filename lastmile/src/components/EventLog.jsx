import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PRIORITY_COLORS } from '../simulation/networkState';

const STATUS_LABEL = {
  delivered: '✓ DELIVERED',
  dropped: '✗ DROPPED',
  note: 'REFERENCE',
};

/**
 * EventLog — Scrolling real-time network event feed.
 */
export default function EventLog({ eventLog, onShowComparison }) {
  const scrollRef = useRef(null);
  const newestId = eventLog.length > 0 ? eventLog[0].id : null;

  // Keyed on the newest entry's id, not on length: the log is capped, so once
  // it reaches the cap the length stops changing and length-based auto-scroll
  // silently stops working forever.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [newestId]);

  return (
    <div className="event-log">
      <div className="event-log-header">
        <h3 className="event-log-title">Network Event Log</h3>
        <span className="event-log-count">{eventLog.length} events</span>
      </div>

      <div className="event-entry event-entry-head" aria-hidden="true">
        <span>Time</span>
        <span>Priority</span>
        <span>Description</span>
        <span className="align-right">Latency</span>
        <span className="align-right">Status</span>
      </div>

      <div
        className="event-log-entries"
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Network events"
      >
        <AnimatePresence initial={false}>
          {eventLog.map((event) => {
            const color = event.priority ? PRIORITY_COLORS[event.priority] : 'var(--text-dim)';
            const isCritical = event.priority === 'P1' && event.kind === 'traffic';
            const showComparisonBtn =
              isCritical && event.status === 'delivered' && Boolean(onShowComparison);

            return (
              <motion.div
                key={event.id}
                className={`event-entry kind-${event.kind ?? 'traffic'} ${isCritical ? 'critical-flash' : ''}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <span className="event-time">[{event.timestamp}]</span>
                <span className="event-priority" style={{ color }}>
                  {event.priority ? (
                    <>
                      <span className="event-priority-dot" style={{ background: color }} />
                      {event.priority}
                    </>
                  ) : (
                    <span className="event-priority-sys">INFRA</span>
                  )}
                </span>
                <span className={`event-desc status-${event.status}`}>
                  {event.label}
                  {showComparisonBtn && (
                    <button className="event-comparison-btn" onClick={onShowComparison}>
                      See why this matters →
                    </button>
                  )}
                </span>
                <span className={`event-latency status-${event.status}`}>
                  {event.deliveredIn != null ? `${event.deliveredIn}ms` : '—'}
                </span>
                <span className={`event-status ${event.status}`}>
                  {STATUS_LABEL[event.status] ?? event.status}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
