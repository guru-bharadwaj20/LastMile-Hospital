import { useState, useEffect, useMemo, useRef, useId } from 'react';
import { motion } from 'framer-motion';
import { X, Zap, Wifi } from 'lucide-react';

/**
 * ComparisonView — Full-screen overlay showing side-by-side comparison
 * of network performance WITH vs WITHOUT LastMile triage.
 *
 * Mounted only while open (App owns the AnimatePresence), so every figure
 * below is sampled once at open time rather than re-rolled on each of the
 * parent's twice-per-second re-renders.
 */

function AnimatedNumber({ value, duration = 1200, suffix = 'ms', color }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <span className="comparison-number" style={{ color }}>
      {display}{suffix}
    </span>
  );
}

function ComparisonBar({ value, maxValue, color, delay, dim }) {
  const widthPct = Math.min((value / maxValue) * 100, 100);
  return (
    <div className={`comparison-bar-track ${dim ? 'dim' : ''}`}>
      <motion.div
        className="comparison-bar-fill"
        initial={{ width: 0 }}
        animate={{ width: `${widthPct}%` }}
        transition={{ duration: 0.8, delay, ease: [0.4, 0, 0.2, 1] }}
        style={{ background: color, opacity: dim ? 0.5 : 1 }}
      />
    </div>
  );
}

export default function ComparisonView({ onClose, state }) {
  const closeRef = useRef(null);
  const titleId = useId();

  const lastAlert = state.activeAlerts[0];

  // Sampled once, on open. Previously these were recomputed with
  // Math.random() during every render, so the whole panel flickered and each
  // count-up restarted from zero twice a second.
  const snapshot = useMemo(() => {
    const load = Math.round(lastAlert?.networkLoadAtFire ?? state.networkLoad);
    const cardiacWith = lastAlert?.deliveredIn ?? 11;
    const cardiacWithout = lastAlert?.untriagedTime ?? 340;

    return {
      load,
      cardiacWith,
      cardiacWithout,
      multiplier: cardiacWith > 0 ? Math.round(cardiacWithout / cardiacWith) : 0,
      droppedWithout: Math.round(25 + Math.random() * 15),
      metrics: [
        {
          label: 'Cardiac Alert',
          without: cardiacWithout,
          with: cardiacWith,
          maxVal: Math.max(cardiacWithout, 500),
          tone: 'var(--p1-critical)',
        },
        {
          label: 'ICU Vitals',
          without: Math.round(180 + load * 2.5 + 15),
          with: Math.round(25 + Math.random() * 8),
          maxVal: 500,
          tone: 'var(--p2-urgent)',
        },
        {
          label: 'Admin Upload',
          without: Math.round(120 + Math.random() * 30),
          with: Math.round(180 + load * 2.8 + 10),
          maxVal: 500,
          tone: 'var(--p4-low)',
          note: 'deliberately deprioritized',
        },
      ],
    };
    // Intentionally empty: this is a one-shot sample taken when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape to dismiss, and move focus into the dialog on open.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [onClose]);

  const { load, multiplier, droppedWithout, metrics } = snapshot;

  return (
    <motion.div
      className="comparison-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClose}
    >
      <motion.div
        className="comparison-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="visually-hidden">
          Network performance with and without LastMile triage
        </h2>

        <button ref={closeRef} className="comparison-close" onClick={onClose} aria-label="Close comparison">
          <X size={18} />
        </button>

        <div className="comparison-split">
          {/* LEFT — Without LastMile */}
          <div className="comparison-side comparison-without">
            <div className="comparison-side-header">
              <Wifi size={24} className="comparison-side-icon" />
              <h3 className="comparison-side-title">WITHOUT LastMile</h3>
            </div>
            <p className="comparison-side-subtitle">Standard flat network — no prioritization</p>
            <p className="comparison-load">
              Network Load: <span className="comparison-number">{load}%</span>
            </p>

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

          <div className="comparison-divider" />

          {/* RIGHT — With LastMile */}
          <div className="comparison-side comparison-with">
            <div className="comparison-side-header">
              <Zap size={24} className="comparison-side-icon accent" />
              <h3 className="comparison-side-title accent">WITH LastMile</h3>
            </div>
            <p className="comparison-side-subtitle bright">
              Priority-aware triage — critical traffic always protected
            </p>
            <p className="comparison-load accent">
              Network Load: <span className="comparison-number">{load}%</span>
            </p>

            {metrics.map((m, i) => (
              <div key={m.label} className="comparison-metric">
                <div className="comparison-metric-label bright">
                  {m.label}
                  {m.note && <span className="comparison-metric-note"> — {m.note}</span>}
                </div>
                <div className="comparison-metric-bar-row">
                  <ComparisonBar value={m.with} maxValue={m.maxVal} color={m.tone} delay={0.4 + i * 0.15} />
                  <AnimatedNumber value={m.with} color={m.tone} duration={800 + i * 200} />
                </div>
              </div>
            ))}

            <div className="comparison-dropped">
              <span className="bright">Dropped critical packets:</span>
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

        <motion.p
          className="comparison-hero"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.6 }}
        >
          At {load}% network load, LastMile delivers cardiac alerts{' '}
          <span className="comparison-hero-multiplier">{multiplier}x</span> faster
        </motion.p>

        <p className="comparison-disclaimer">
          Figures are produced by the browser simulation model, not measured on hardware.
        </p>

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
  );
}
