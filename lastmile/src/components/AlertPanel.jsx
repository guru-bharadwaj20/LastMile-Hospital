import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Activity, Zap, Wifi, RotateCcw, Lock } from 'lucide-react';
import { PRIORITY_COLORS } from '../simulation/networkState';

/**
 * AlertPanel — Sidebar sections: emergency console, active alerts,
 * and priority configuration.
 */

const TRIGGERS = [
  { id: 'cardiac',    label: 'Cardiac Arrest — ICU Bed 4',      className: 'critical', icon: AlertTriangle, action: 'triggerAlert',  param: 'cardiac' },
  { id: 'ventilator', label: 'Ventilator Alarm — ICU Bed 7',    className: 'urgent',   icon: Activity,      action: 'triggerAlert',  param: 'ventilator' },
  { id: 'crash-cart', label: 'Crash Cart — Surgery Block B',    className: 'moderate', icon: Zap,           action: 'triggerAlert',  param: 'crashcart' },
  { id: 'stress',     label: 'Simulate Network Stress',         className: 'stress',   icon: Wifi,          action: 'simulateStress' },
  { id: 'reset',      label: 'Reset Network',                   className: 'reset',    icon: RotateCcw,     action: 'resetNetwork' },
];

const PRIORITY_LEVELS = ['P1', 'P2', 'P3', 'P4', 'P5'];

export function EmergencyConsoleSection({ state, actions }) {
  const isStressed = state.activeStreams.some(s => s.id.startsWith('stress-'));

  return (
    <div>
      {TRIGGERS.map((trigger) => {
        const Icon = trigger.icon;
        const isDisabled = trigger.action === 'simulateStress' && isStressed;

        return (
          <motion.button
            key={trigger.id}
            id={`trigger-${trigger.id}`}
            className={`trigger-btn ${trigger.className}`}
            onClick={() => {
              if (trigger.action === 'triggerAlert') actions.triggerAlert(trigger.param);
              else if (trigger.action === 'simulateStress') actions.simulateStress();
              else if (trigger.action === 'resetNetwork') actions.resetNetwork();
            }}
            whileTap={{ scale: 0.97 }}
            disabled={isDisabled}
          >
            <Icon size={14} className="trigger-btn-icon" aria-hidden="true" />
            <span>{trigger.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function ActiveAlertsSection({ state }) {
  if (state.activeAlerts.length === 0) {
    return <p className="panel-empty">NO ACTIVE ALERTS</p>;
  }

  return (
    <div>
      <AnimatePresence initial={false}>
        {state.activeAlerts.map((alert) => (
          <AlertItem key={alert.id} alert={alert} />
        ))}
      </AnimatePresence>
    </div>
  );
}

export function PriorityConfigurationSection({ state, actions }) {
  return (
    <table className="priority-table">
      <caption className="visually-hidden">Traffic class to priority level mapping</caption>
      <tbody>
        {state.priorityConfig.map((item) => {
          const color = PRIORITY_COLORS[item.level];
          return (
            <tr key={item.id}>
              <td>
                <span className="priority-dot" style={{ background: color }} />
                <span className="priority-type">{item.type}</span>
              </td>
              <td className="priority-level">
                {item.locked ? (
                  <span
                    className="priority-locked"
                    style={{ color }}
                    title="P1 alerts always use the protected queue and cannot be reassigned"
                  >
                    <Lock size={9} aria-hidden="true" />
                    {item.level}
                  </span>
                ) : (
                  <select
                    className="priority-select"
                    value={item.level}
                    aria-label={`Priority level for ${item.type}`}
                    onChange={(e) => actions.updatePriorityConfig(item.id, e.target.value)}
                    style={{ color, borderColor: `${color}44` }}
                  >
                    {PRIORITY_LEVELS.map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * AlertItem — Single active alert with live elapsed timer.
 */
function AlertItem({ alert }) {
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - alert.firedAt) / 1000));

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

  const color = PRIORITY_COLORS[alert.priority] ?? PRIORITY_COLORS.P1;

  return (
    <motion.div
      className="alert-item"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      style={{ borderLeftColor: color }}
    >
      <span className="alert-badge" style={{ color, borderColor: `${color}4d`, background: `${color}26` }}>
        {alert.priority}
      </span>
      <div className="alert-info">
        <div className="alert-desc">{alert.label}</div>
        <div className="alert-meta">
          <span>{formatElapsed(elapsed)} ago</span>
          <span className="alert-delivered" style={{ color }}>
            Delivered in {alert.deliveredIn}ms
          </span>
        </div>
        {alert.untriagedTime != null && (
          <div className="alert-untriaged">Without triage: ~{alert.untriagedTime}ms</div>
        )}
      </div>
    </motion.div>
  );
}
