import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import {
  DEPARTMENTS,
  SERVER,
  MAP_VIEWBOX,
  PRIORITY_COLORS,
  PRIORITY_RANK,
  departmentColor,
  getNodeCenter,
} from '../simulation';

// Module scope: derived once from a static table, so the effect below needs
// no dependency on it and cannot go stale.
const DEPT_BY_LABEL = new Map(DEPARTMENTS.map(d => [d.label, d]));
const SERVER_NODE = getNodeCenter(SERVER);

/**
 * A stream is restarted only when something that affects its animation
 * changes. Without this, either every state tick restarts every particle,
 * or property changes are silently ignored.
 */
function signatureOf(stream) {
  return [
    stream.from,
    stream.priority,
    stream.particleCount,
    stream.speed,
    stream.isAlertParticle ? 'alert' : 'loop',
  ].join('|');
}

function radiusFor(stream) {
  if (stream.isAlertParticle) return 6;
  const rank = PRIORITY_RANK[stream.priority] ?? 5;
  if (rank === 1) return 4;
  if (rank === 2) return 3.5;
  return 2.5;
}

function opacityFor(stream) {
  if (stream.isAlertParticle) return 1;
  return (PRIORITY_RANK[stream.priority] ?? 5) <= 2 ? 0.85 : 0.6;
}

/**
 * TrafficStream — D3-animated particles flowing along network edges.
 *
 * Each stream owns a <g> group, which is how it is torn down. That avoids
 * building CSS class selectors out of generated ids entirely.
 */
export default function TrafficStream({ activeStreams }) {
  const svgRef = useRef(null);
  const runningRef = useRef(new Map()); // id -> { token, group, signature }

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const running = runningRef.current;

    const wanted = new Map(
      activeStreams.filter(s => s.active && DEPT_BY_LABEL.has(s.from)).map(s => [s.id, s]),
    );

    const stop = (id, entry) => {
      entry.token.cancelled = true;
      entry.group.selectAll('circle').interrupt();
      entry.group.remove();
      running.delete(id);
    };

    // Tear down streams that stopped, or whose definition changed.
    for (const [id, entry] of [...running]) {
      const next = wanted.get(id);
      if (!next || signatureOf(next) !== entry.signature) stop(id, entry);
    }

    // Start streams that are newly active.
    for (const [id, stream] of wanted) {
      if (running.has(id)) continue;

      const dept = DEPT_BY_LABEL.get(stream.from);
      const from = getNodeCenter(dept);
      const to = SERVER_NODE;
      const color = PRIORITY_COLORS[stream.priority] || departmentColor(dept);
      const token = { cancelled: false };
      const group = svg.append('g');

      running.set(id, { token, group, signature: signatureOf(stream) });

      const radius = radiusFor(stream);
      const opacity = opacityFor(stream);

      for (let i = 0; i < stream.particleCount; i++) {
        const particle = group
          .append('circle')
          .attr('class', 'traffic-particle')
          .attr('r', radius)
          .attr('fill', color)
          .attr('opacity', opacity)
          .attr('cx', from.x)
          .attr('cy', from.y);

        if (stream.isAlertParticle) particle.attr('filter', 'url(#glow-p1)');

        const delay = i * (stream.speed / stream.particleCount);

        if (stream.isAlertParticle) {
          // Single shot: fires once, then removes itself.
          particle
            .transition()
            .delay(delay)
            .duration(stream.speed)
            .ease(d3.easeQuadIn)
            .attr('cx', to.x)
            .attr('cy', to.y)
            .attr('r', 2)
            .on('end', function () {
              d3.select(this).remove();
            });
        } else {
          const loop = () => {
            if (token.cancelled) return;
            particle
              .attr('cx', from.x)
              .attr('cy', from.y)
              .attr('opacity', opacity)
              .transition()
              .duration(stream.speed)
              .ease(d3.easeLinear)
              .attr('cx', to.x)
              .attr('cy', to.y)
              .attr('opacity', 0.1)
              .on('end', loop);
          };
          // Stagger the initial launch instead of delaying every lap.
          if (delay === 0) {
            loop();
          } else {
            particle
              .transition()
              .delay(delay)
              .duration(0)
              .on('end', loop);
          }
        }
      }
    }
  }, [activeStreams]);

  // Unmount only. Deliberately separate from the effect above: doing this
  // teardown on every dependency change would wipe and restart every
  // particle each time any part of the simulation state ticked.
  useEffect(() => {
    const running = runningRef.current;
    return () => {
      for (const entry of running.values()) {
        entry.token.cancelled = true;
        entry.group.selectAll('circle').interrupt();
      }
      running.clear();
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      className="traffic-stream-svg"
      viewBox={MAP_VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        <filter id="glow-p1" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feFlood floodColor="#ff2d2d" floodOpacity="0.6" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="shadow" />
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}
