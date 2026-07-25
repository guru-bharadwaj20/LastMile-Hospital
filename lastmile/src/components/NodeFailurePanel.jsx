import { motion } from 'framer-motion';
import { DEPARTMENT_NODES, departmentColor } from '../simulation';

/**
 * NodeFailurePanel — Infrastructure failure simulation panel.
 * Displays all department nodes with KILL/RESTORE controls.
 */
export default function NodeFailurePanel({ nodes, actions }) {
  return (
    <div className="node-failure-list">
      {DEPARTMENT_NODES.map(dept => {
        const isActive = nodes[dept.label] ? nodes[dept.label].active : true;
        const color = departmentColor(dept);

        return (
          <motion.div
            key={dept.id}
            className="node-failure-row"
            layout
            transition={{ duration: 0.2 }}
          >
            <div className="node-failure-info">
              <span
                className="node-failure-dot"
                style={{
                  background: isActive ? color : 'var(--text-dim)',
                  boxShadow: isActive ? `0 0 6px ${color}66` : 'none',
                }}
              />
              <span className="node-failure-name">{dept.label}</span>
              <motion.span
                className={`node-failure-badge ${isActive ? 'online' : 'offline'}`}
                key={isActive ? 'online' : 'offline'}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              >
                {isActive ? 'ONLINE' : 'OFFLINE'}
              </motion.span>
            </div>
            <motion.button
              className={`node-failure-btn ${isActive ? 'kill' : 'restore'}`}
              onClick={() => actions.toggleNodeFailure(dept.label)}
              whileTap={{ scale: 0.93 }}
              whileHover={{ scale: 1.02 }}
              aria-label={`${isActive ? 'Take offline' : 'Restore'} ${dept.label} node`}
            >
              {isActive ? 'KILL NODE' : 'RESTORE'}
            </motion.button>
          </motion.div>
        );
      })}
    </div>
  );
}
