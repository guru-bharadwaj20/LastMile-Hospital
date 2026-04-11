import { MOCK_EVENTS } from '../simulation/networkState';

/**
 * EventLog — Bottom bar with scrolling real-time network event entries.
 */
export default function EventLog() {
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
          {MOCK_EVENTS.length} events
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
      <div className="event-log-entries">
        {MOCK_EVENTS.map((event) => (
          <div
            key={event.id}
            className={`event-entry ${event.priority === 1 ? 'critical-flash' : ''}`}
          >
            <span className="event-time">[{event.time}]</span>
            <span className="event-priority" style={{ color: event.color }}>
              <span
                className="event-priority-dot"
                style={{ background: event.color }}
              />
              {event.priorityLabel}
            </span>
            <span
              className="event-desc"
              style={event.status === 'dropped' ? { color: 'var(--text-dim)' } : {}}
            >
              {event.description}
            </span>
            <span
              className="event-latency"
              style={event.status === 'dropped' ? { textDecoration: 'line-through', color: 'var(--text-dim)' } : {}}
            >
              {event.latency}
            </span>
            <span className={`event-status ${event.status}`}>
              {event.status === 'delivered' ? '✓ DELIVERED' : '✗ DROPPED'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
