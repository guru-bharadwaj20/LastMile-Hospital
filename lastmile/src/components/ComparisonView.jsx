import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Wifi } from 'lucide-react';

/**
 * ComparisonView — Full-screen overlay showing side-by-side comparison
 * of network performance WITH vs WITHOUT LastMile triage.
 */

// Animated number counter
function AnimatedNumber({ value, duration = 1200, suffix = 'ms', color }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const from = 0;
    const to = value;

    function tick() {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }

    tick();
  }, [value, duration]);

  return (
    <span style={{ color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
      {display}{suffix}
    </span>
  );
}

// Animated bar
function ComparisonBar({ value, maxValue, color, delay, dim }) {
  const widthPct = Math.min((value / maxValue) * 100, 100);
  return (
    <motion.div
      style={{
        height: '8px',
        borderRadius: '4px',
        background: dim ? 'var(--border)' : 'var(--bg-primary)',
        overflow: 'hidden',
        flex: 1,
      }}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${widthPct}%` }}
        transition={{ duration: 0.8, delay, ease: [0.4, 0, 0.2, 1] }}
        style={{
          height: '100%',
          borderRadius: '4px',
          background: color,
          opacity: dim ? 0.5 : 1,
        }}
      />
    </motion.div>
  );
}

export default function ComparisonView({ isOpen, onClose, state }) {
  if (!isOpen) return null;

  const networkLoad = state.networkLoad;
  const lastAlert = state.activeAlerts[0];

  // Use real data if available, otherwise sensible defaults
  const cardiacWith = lastAlert?.deliveredIn || 11;
  const cardiacWithout = lastAlert?.untriagedTime || 340;
  const multiplier = Math.round(cardiacWithout / cardiacWith);

  // Comparison metrics
  const metrics = [
    {
      label: 'Cardiac Alert',
      without: cardiacWithout,
      with: cardiacWith,
      maxVal: Math.max(cardiacWithout, 500),
    },
    {
      label: 'ICU Vitals',
      without: Math.round(180 + networkLoad * 2.5 + 15),
      with: Math.round(25 + Math.random() * 8),
      maxVal: 500,
    },
    {
      label: 'Admin Upload',
      without: Math.round(120 + Math.random() * 30),
      with: Math.round(180 + networkLoad * 2.8 + 10),
      maxVal: 500,
    },
  ];

  const droppedWithout = Math.round(25 + Math.random() * 15);

  return (
    <AnimatePresence>
      <motion.div
        className="comparison-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="comparison-container"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Close button */}
          <button className="comparison-close" onClick={onClose}>
            <X size={18} />
          </button>

          {/* Split screen */}
          <div className="comparison-split">
            {/* LEFT — Without LastMile */}
            <div className="comparison-side comparison-without">
              <div className="comparison-side-header">
                <Wifi size={24} style={{ opacity: 0.4 }} />
                <h2 className="comparison-side-title">WITHOUT LastMile</h2>
              </div>
              <div className="comparison-side-subtitle">Standard flat network — no prioritization</div>

              <div className="comparison-load">
                Network Load: <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{networkLoad}%</span>
              </div>

              {metrics.map((m, i) => (
                <div key={m.label} className="comparison-metric">
                  <div className="comparison-metric-label">{m.label}</div>
                  <div className="comparison-metric-bar-row">
                    <ComparisonBar value={m.without} maxValue={m.maxVal} color="var(--text-dim)" delay={0.2 + i * 0.15} dim />
                    <AnimatedNumber value={m.without} color="var(--text-muted)" duration={1000 + i * 200} />
                  </div>
                </div>
              ))}

              <div className="comparison-dropped">
                <span>Dropped critical packets:</span>
                <motion.span
                  className="comparison-dropped-value bad"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1, type: 'spring', stiffness: 400 }}
                >
                  {droppedWithout}%
                </motion.span>
              </div>
            </div>

            {/* DIVIDER */}
            <div className="comparison-divider" />

            {/* RIGHT — With LastMile */}
            <div className="comparison-side comparison-with">
              <div className="comparison-side-header">
                <Zap size={24} style={{ color: 'var(--accent-blue)' }} />
                <h2 className="comparison-side-title" style={{ color: 'var(--accent-blue)' }}>
                  WITH LastMile
                </h2>
              </div>
              <div className="comparison-side-subtitle" style={{ color: 'var(--text-muted)' }}>
                Priority-aware triage — critical traffic always protected
              </div>

              <div className="comparison-load" style={{ color: 'var(--accent-blue)' }}>
                Network Load: <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{networkLoad}%</span>
              </div>

              {metrics.map((m, i) => (
                <div key={m.label} className="comparison-metric">
                  <div className="comparison-metric-label" style={{ color: 'var(--text-primary)' }}>{m.label}</div>
                  <div className="comparison-metric-bar-row">
                    <ComparisonBar
                      value={m.with}
                      maxValue={m.maxVal}
                      color={i === 0 ? 'var(--p1-critical)' : i === 1 ? 'var(--p2-urgent)' : 'var(--p4-low)'}
                      delay={0.4 + i * 0.15}
                      dim={false}
                    />
                    <AnimatedNumber
                      value={m.with}
                      color={i === 0 ? 'var(--p1-critical)' : i === 1 ? 'var(--p2-urgent)' : 'var(--p4-low)'}
                      duration={800 + i * 200}
                    />
                  </div>
                </div>
              ))}

              <div className="comparison-dropped">
                <span style={{ color: 'var(--text-muted)' }}>Dropped critical packets:</span>
                <motion.span
                  className="comparison-dropped-value good"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1.2, type: 'spring', stiffness: 400 }}
                >
                  0%
                </motion.span>
              </div>
            </div>
          </div>

          {/* Bottom hero stat */}
          <motion.div
            className="comparison-hero"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.6 }}
          >
            At {networkLoad}% network load, LastMile delivers cardiac alerts{' '}
            <span className="comparison-hero-multiplier">{multiplier}x</span>{' '}
            faster
          </motion.div>

          {/* Close button */}
          <motion.button
            className="comparison-close-btn"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            CLOSE COMPARISON
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
