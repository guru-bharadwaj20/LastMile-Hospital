import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { DEPARTMENTS, PRIORITY_COLORS } from '../simulation/networkState';

/**
 * TrafficStream — D3-animated particles flowing along network edges.
 * Consumes activeStreams from the simulation hook.
 */
export default function TrafficStream({ activeStreams }) {
  const svgRef = useRef(null);
  const animationRef = useRef({}); // track running animations by stream id

  const server = DEPARTMENTS.find(d => d.isServer);
  const deptMap = {};
  DEPARTMENTS.forEach(d => {
    deptMap[d.label] = d;
  });

  const getCenter = (dept) => ({
    x: dept.x + dept.w / 2,
    y: dept.y + dept.h / 2 + 20,
  });

  const serverCenter = getCenter(server);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    // Track which streams are currently animated
    const currentAnimations = animationRef.current;
    const activeIds = new Set(activeStreams.filter(s => s.active).map(s => s.id));

    // Remove animations for streams that are no longer active
    Object.keys(currentAnimations).forEach(id => {
      if (!activeIds.has(id)) {
        svg.selectAll(`.particle-${CSS.escape(id)}`).interrupt().remove();
        delete currentAnimations[id];
      }
    });

    // Add/update animations for active streams
    activeStreams.forEach(stream => {
      if (!stream.active) return;
      const dept = deptMap[stream.from];
      if (!dept) return;

      // Skip if already animating this stream
      if (currentAnimations[stream.id]) return;

      const from = getCenter(dept);
      const to = serverCenter;
      const color = PRIORITY_COLORS[stream.priority] || dept.color;
      const isP1Alert = stream.isAlertParticle;

      currentAnimations[stream.id] = true;

      for (let i = 0; i < stream.particleCount; i++) {
        const radius = isP1Alert ? 6 : stream.priority === 'P1' ? 4 : stream.priority === 'P2' ? 3.5 : 2.5;
        const opacity = isP1Alert ? 1 : stream.priority <= 'P2' ? 0.85 : 0.6;

        const particle = svg.append('circle')
          .attr('class', `traffic-particle particle-${stream.id}`)
          .attr('r', radius)
          .attr('fill', color)
          .attr('opacity', opacity)
          .attr('cx', from.x)
          .attr('cy', from.y);

        // P1 alert particles get extra glow
        if (isP1Alert) {
          particle.attr('filter', 'url(#glow-p1)');
        }

        const delay = i * (stream.speed / stream.particleCount);

        if (isP1Alert) {
          // Single-shot for alert particles
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
          // Looping for normal streams
          function animate() {
            particle
              .attr('cx', from.x)
              .attr('cy', from.y)
              .attr('opacity', opacity)
              .transition()
              .delay(delay)
              .duration(stream.speed)
              .ease(d3.easeLinear)
              .attr('cx', to.x)
              .attr('cy', to.y)
              .attr('opacity', 0.1)
              .on('end', function () {
                // Check if still active
                if (!currentAnimations[stream.id]) {
                  d3.select(this).remove();
                  return;
                }
                animate();
              });
          }
          animate();
        }
      }
    });

    // Cleanup on unmount
    return () => {
      svg.selectAll('.traffic-particle').interrupt().remove();
      animationRef.current = {};
    };
  }, [activeStreams]);

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
      viewBox="0 0 800 420"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* Glow filter for P1 alert particles */}
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
