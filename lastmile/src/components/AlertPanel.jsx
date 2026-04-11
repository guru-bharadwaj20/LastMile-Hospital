import { motion } from 'framer-motion';
import { AlertTriangle, Activity, Zap, Wifi, RotateCcw } from 'lucide-react';
import { MOCK_ALERTS, PRIORITY_CONFIG } from '../simulation/networkState';

/**
 * AlertPanel — Right sidebar with trigger buttons, active alerts, and priority config.
 */

const PRIORITY_COLORS = {
  1: { bg: 'rgba(255,45,45,0.15)', text: '#ff2d2d', border: 'rgba(255,45,45,0.3)' },
  2: { bg: 'rgba(255,107,45,0.15)', text: '#ff6b2d', border: 'rgba(255,107,45,0.3)' },
  3: { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
  4: { bg: 'rgba(52,211,153,0.15)', text: '#34d399', border: 'rgba(52,211,153,0.3)' },
  5: { bg: 'rgba(75,85,99,0.15)', text: '#4b5563', border: 'rgba(75,85,99,0.3)' },
};

// Trigger button configurations
const TRIGGERS = [
  {
    id: 'cardiac',
    icon: '🔴',
    label: 'Cardiac Arrest — ICU Bed 4',
    className: 'critical',
    lucideIcon: AlertTriangle,
  },
  {
    id: 'ventilator',
    icon: '🟠',
    label: 'Ventilator Alarm — ICU Bed 7',
    className: 'urgent',
    lucideIcon: Activity,
  },
  {
    id: 'crash-cart',
    icon: '🟡',
    label: 'Crash Cart — Surgery Block B',
    className: 'moderate',
    lucideIcon: Zap,
  },
  {
    id: 'stress',
    icon: '⚫',
    label: 'Simulate Network Stress',
    className: 'stress',
    lucideIcon: Wifi,
  },
  {
    id: 'reset',
    icon: '🔄',
    label: 'Reset Network',
    className: 'reset',
    lucideIcon: RotateCcw,
  },
];

export default function AlertPanel() {
  const handleTrigger = (triggerId) => {
    console.log(`[LastMile] Trigger fired: ${triggerId}`);
  };

  return (
    <div>
      {/* Section 1: Manual Trigger Buttons */}
      <div style={{ marginBottom: '24px' }}>
        <h3 className="alert-section-title">Emergency Console</h3>
        {TRIGGERS.map((trigger) => {
          const Icon = trigger.lucideIcon;
          return (
            <motion.button
              key={trigger.id}
              id={`trigger-${trigger.id}`}
              className={`trigger-btn ${trigger.className}`}
              onClick={() => handleTrigger(trigger.id)}
              whileTap={{ scale: 0.97 }}
            >
              <span className="trigger-btn-icon">{trigger.icon}</span>
              <span>{trigger.label}</span>
              <Icon
                size={14}
                style={{
                  marginLeft: 'auto',
                  opacity: 0.4,
                }}
              />
            </motion.button>
          );
        })}
      </div>

      {/* Section 2: Active Alerts */}
      <div style={{ marginBottom: '24px' }}>
        <h3 className="alert-section-title">Active Alerts</h3>
        {MOCK_ALERTS.map((alert) => {
          const colors = PRIORITY_COLORS[alert.priority];
          return (
            <motion.div
              key={alert.id}
              className="alert-item"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                borderLeft: `3px solid ${colors.text}`,
              }}
            >
              <span
                className="alert-badge"
                style={{
                  background: colors.bg,
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                }}
              >
                {alert.label}
              </span>
              <div className="alert-info">
                <div className="alert-desc">{alert.description}</div>
                <div className="alert-meta">
                  <span>{alert.elapsed} ago</span>
                  <span style={{ color: colors.text }}>
                    Delivered in {alert.deliveryMs}ms
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Section 3: Priority Config */}
      <div>
        <h3 className="alert-section-title">Priority Configuration</h3>
        <table className="priority-table">
          <tbody>
            {PRIORITY_CONFIG.map((item) => (
              <tr key={item.level}>
                <td>
                  <span
                    className="priority-dot"
                    style={{ background: item.color }}
                  />
                  <span style={{ color: 'var(--text-muted)' }}>{item.type}</span>
                </td>
                <td className="priority-level" style={{ color: item.color }}>
                  {item.level}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
