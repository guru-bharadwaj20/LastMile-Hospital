import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Activity, Zap, Wifi, RotateCcw } from 'lucide-react';

/**
 * AlertPanel — Right sidebar with trigger buttons, active alerts, and priority config.
 * Layer 2: Wired to live simulation actions and state.
 */

const PRIORITY_COLORS_MAP = {
  P1: { bg: 'rgba(255,45,45,0.15)', text: '#ff2d2d', border: 'rgba(255,45,45,0.3)' },
  P2: { bg: 'rgba(255,107,45,0.15)', text: '#ff6b2d', border: 'rgba(255,107,45,0.3)' },
  P3: { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
  P4: { bg: 'rgba(52,211,153,0.15)', text: '#34d399', border: 'rgba(52,211,153,0.3)' },
  P5: { bg: 'rgba(75,85,99,0.15)', text: '#4b5563', border: 'rgba(75,85,99,0.3)' },
};

// Trigger button configurations
const TRIGGERS = [
  {
    id: 'cardiac',
    icon: '🔴',
    label: 'Cardiac Arrest — ICU Bed 4',
    className: 'critical',
    lucideIcon: AlertTriangle,
    action: 'triggerAlert',
    param: 'cardiac',
  },
  {
    id: 'ventilator',
    icon: '🟠',
    label: 'Ventilator Alarm — ICU Bed 7',
    className: 'urgent',
    lucideIcon: Activity,
    action: 'triggerAlert',
    param: 'ventilator',
  },
  {
    id: 'crash-cart',
    icon: '🟡',
    label: 'Crash Cart — Surgery Block B',
    className: 'moderate',
    lucideIcon: Zap,
    action: 'triggerAlert',
    param: 'crashcart',
  },
  {
    id: 'stress',
    icon: '⚫',
    label: 'Simulate Network Stress',
    className: 'stress',
    lucideIcon: Wifi,
    action: 'simulateStress',
  },
  {
    id: 'reset',
    icon: '🔄',
    label: 'Reset Network',
    className: 'reset',
    lucideIcon: RotateCcw,
    action: 'resetNetwork',
  },
];

const PRIORITY_LEVELS = ['P1', 'P2', 'P3', 'P4', 'P5'];

export default function AlertPanel({ state, actions }) {
  const handleTrigger = (trigger) => {
    if (trigger.action === 'triggerAlert') {
      actions.triggerAlert(trigger.param);
    } else if (trigger.action === 'simulateStress') {
      actions.simulateStress();
    } else if (trigger.action === 'resetNetwork') {
      actions.resetNetwork();
    }
  };

  return (
    <div>
      {/* Section 1: Manual Trigger Buttons */}
      <div style={{ marginBottom: '24px' }}>
        <h3 className="alert-section-title">Emergency Console</h3>
        {TRIGGERS.map((trigger) => {
          const Icon = trigger.lucideIcon;
          const isDisabled =
            (trigger.action === 'simulateStress' && (state.mode === 'stressed' || state.mode === 'critical'));
          return (
            <motion.button
              key={trigger.id}
              id={`trigger-${trigger.id}`}
              className={`trigger-btn ${trigger.className}`}
              onClick={() => handleTrigger(trigger)}
              whileTap={{ scale: 0.97 }}
              disabled={isDisabled}
              style={isDisabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
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
        <AnimatePresence>
          {state.activeAlerts.length === 0 && (
            <div style={{
              fontSize: '10px',
              color: 'var(--text-dim)',
              textAlign: 'center',
              padding: '12px',
              letterSpacing: '1px',
            }}>
              NO ACTIVE ALERTS
            </div>
          )}
          {state.activeAlerts.map((alert) => (
            <AlertItem key={alert.id} alert={alert} />
          ))}
        </AnimatePresence>
      </div>

      {/* Section 3: Priority Config */}
      <div>
        <h3 className="alert-section-title">Priority Configuration</h3>
        <table className="priority-table">
          <tbody>
            {state.priorityConfig.map((item, index) => (
              <tr key={index}>
                <td>
                  <span
                    className="priority-dot"
                    style={{ background: item.color }}
                  />
                  <span style={{ color: 'var(--text-muted)' }}>{item.type}</span>
                </td>
                <td className="priority-level">
                  <select
                    className="priority-select"
                    value={item.level}
                    onChange={(e) => actions.updatePriorityConfig(index, e.target.value)}
                    style={{
                      background: 'var(--bg-primary)',
                      color: item.color,
                      border: `1px solid ${item.color}44`,
                      borderRadius: '3px',
                      padding: '2px 4px',
                      fontFamily: "'Rajdhani', sans-serif",
                      fontWeight: 700,
                      fontSize: '11px',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    {PRIORITY_LEVELS.map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * AlertItem — Single active alert with live elapsed timer.
 */
function AlertItem({ alert }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - alert.firedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [alert.firedAt]);

  const formatElapsed = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return mins > 0 ? `${mins}m ${secs.toString().padStart(2, '0')}s` : `${secs}s`;
  };

  const colors = PRIORITY_COLORS_MAP[alert.priority] || PRIORITY_COLORS_MAP.P1;

  return (
    <motion.div
      className="alert-item"
      initial={{ opacity: 0, y: 10, x: -5 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: -10 }}
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
        {alert.priority}
      </span>
      <div className="alert-info">
        <div className="alert-desc">{alert.label}</div>
        <div className="alert-meta">
          <span>{formatElapsed(elapsed)} ago</span>
          <span style={{ color: colors.text, fontWeight: 700 }}>
            Delivered in {alert.deliveredIn}ms
          </span>
        </div>
        {alert.untriagedTime && (
          <div style={{
            marginTop: '3px',
            fontSize: '9px',
            color: 'var(--text-dim)',
            fontStyle: 'italic',
          }}>
            Without triage: ~{alert.untriagedTime}ms
          </div>
        )}
      </div>
    </motion.div>
  );
}
