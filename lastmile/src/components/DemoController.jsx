import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * DemoController — Floating demo mode controller.
 * Runs a scripted sequence of actions for hands-free presentation.
 */

const DEMO_SCRIPT = [
  { delay: 0,     action: 'reset',           label: 'Network reset to baseline' },
  { delay: 2000,  action: 'stress',          label: 'Simulating shift change traffic spike' },
  { delay: 5000,  action: 'alert_cardiac',   label: 'Cardiac arrest — ICU Bed 4' },
  { delay: 7000,  action: 'comparison',      label: 'Showing performance comparison' },
  { delay: 12000, action: 'closeComparison', label: 'Closing comparison' },
  { delay: 13000, action: 'killNode',        node: 'RADIOLOGY', label: 'Simulating node failure — Radiology' },
  { delay: 16000, action: 'alert_ventilator', label: 'Ventilator alarm during failure' },
  { delay: 19000, action: 'restoreNode',     node: 'RADIOLOGY', label: 'Restoring failed node' },
  { delay: 22000, action: 'reset',           label: 'Network stabilizing' },
];

const TOTAL_DURATION = 24000; // Slightly longer than last step for settling

export default function DemoController({ actions, onShowComparison, onCloseComparison }) {
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [currentCaption, setCurrentCaption] = useState('');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(-1);
  const timeoutsRef = useRef([]);
  const startTimeRef = useRef(null);
  const progressIntervalRef = useRef(null);

  const stopDemo = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setIsRunning(false);
    setCurrentCaption('');
    setProgress(0);
    setCurrentStep(-1);
  }, []);

  const runDemo = useCallback(() => {
    stopDemo();
    setIsRunning(true);
    setIsComplete(false);
    startTimeRef.current = Date.now();

    // Progress bar update
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setProgress(Math.min((elapsed / TOTAL_DURATION) * 100, 100));
    }, 100);

    // Schedule each demo step
    DEMO_SCRIPT.forEach((step, index) => {
      const t = setTimeout(() => {
        setCurrentCaption(step.label);
        setCurrentStep(index);

        switch (step.action) {
          case 'reset':
            actions.resetNetwork();
            break;
          case 'stress':
            actions.simulateStress();
            break;
          case 'alert_cardiac':
            actions.triggerAlert('cardiac');
            break;
          case 'alert_ventilator':
            actions.triggerAlert('ventilator');
            break;
          case 'comparison':
            onShowComparison();
            break;
          case 'closeComparison':
            onCloseComparison();
            break;
          case 'killNode':
            actions.toggleNodeFailure(step.node);
            break;
          case 'restoreNode':
            actions.toggleNodeFailure(step.node);
            break;
          default:
            break;
        }
      }, step.delay);

      timeoutsRef.current.push(t);
    });

    // End demo
    const endTimeout = setTimeout(() => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setProgress(100);
      setIsRunning(false);
      setIsComplete(true);
      setCurrentCaption('Demo complete — try it yourself');
      // Fade out the complete message after 5s
      setTimeout(() => {
        setIsComplete(false);
        setCurrentCaption('');
      }, 5000);
    }, TOTAL_DURATION);

    timeoutsRef.current.push(endTimeout);
  }, [actions, onShowComparison, onCloseComparison, stopDemo]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  return (
    <>
      {/* Progress bar at top of screen */}
      <AnimatePresence>
        {isRunning && (
          <motion.div
            className="demo-progress-bar"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            <div
              className="demo-progress-fill"
              style={{ width: `${progress}%` }}
            />
            <div className="demo-progress-steps">
              {DEMO_SCRIPT.map((step, i) => (
                <div
                  key={i}
                  className={`demo-progress-step ${i <= currentStep ? 'active' : ''}`}
                  style={{ left: `${(step.delay / TOTAL_DURATION) * 100}%` }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Caption */}
      <AnimatePresence mode="wait">
        {(isRunning || isComplete) && currentCaption && (
          <motion.div
            key={currentCaption}
            className="demo-caption"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <span className="demo-caption-icon">{isComplete ? '✓' : '▸'}</span>
            {currentCaption}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating control button */}
      <div className="demo-controller">
        {isRunning ? (
          <motion.button
            className="demo-btn demo-btn-stop"
            onClick={stopDemo}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <span>⏹</span> STOP DEMO
          </motion.button>
        ) : (
          <motion.button
            className="demo-btn demo-btn-run"
            onClick={runDemo}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <span>▶</span> RUN DEMO
          </motion.button>
        )}
      </div>
    </>
  );
}
