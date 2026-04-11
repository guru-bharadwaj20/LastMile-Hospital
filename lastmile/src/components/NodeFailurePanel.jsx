import { motion } from 'framer-motion';
import { DEPARTMENTS } from '../simulation/networkState';

/**
 * NodeFailurePanel — Infrastructure failure simulation panel.
 * Displays all department nodes with KILL/RESTORE controls.
 */
const departments = DEPARTMENTS.filter(d => !d.isServer);

export default function NodeFailurePanel({ nodes, actions }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 className="alert-section-title" style={{ color: 'var(--p1-critical)' }}>
        Infrastructure Failure
      </h3>
      <div className="node-failure-list">
        {departments.map(dept => {
          const nodeState = nodes[dept.label];
          const isActive = nodeState ? nodeState.active : true;

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
                    background: isActive ? dept.color : 'var(--text-dim)',
                    boxShadow: isActive ? `0 0 6px ${dept.color}66` : 'none',
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
              >
                {isActive ? 'KILL NODE' : 'RESTORE'}
              </motion.button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
