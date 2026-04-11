import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { DEPARTMENTS } from '../simulation/networkState';

/**
 * TrafficStream — D3-animated particles flowing along network edges.
 * In Layer 1, this renders a few static/slow demo particles.
 * Full dynamic behavior comes in Layer 2.
 */
export default function TrafficStream() {
  const svgRef = useRef(null);
  const server = DEPARTMENTS.find(d => d.isServer);
  const departments = DEPARTMENTS.filter(d => !d.isServer);

  const getCenter = (dept) => ({
    x: dept.x + dept.w / 2,
    y: dept.y + dept.h / 2 + 20,
  });

  const serverCenter = getCenter(server);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('.traffic-particle').remove();

    // Create particles for each department
    departments.forEach((dept) => {
      const from = getCenter(dept);
      const to = serverCenter;
      const particleCount = dept.priority <= 2 ? 3 : 2;

      for (let i = 0; i < particleCount; i++) {
        const particle = svg.append('circle')
          .attr('class', 'traffic-particle')
          .attr('r', dept.priority === 1 ? 4 : dept.priority === 2 ? 3 : 2.5)
          .attr('fill', dept.color)
          .attr('opacity', dept.priority === 1 ? 0.9 : 0.6)
          .attr('cx', from.x)
          .attr('cy', from.y);

        // Add glow for critical
        if (dept.priority === 1) {
          particle.attr('filter', 'url(#glow-red)');
        }

        const speed = 2000 + (dept.priority * 800);
        const delay = i * (speed / particleCount);

        function animate() {
          particle
            .attr('cx', from.x)
            .attr('cy', from.y)
            .attr('opacity', dept.priority === 1 ? 0.9 : 0.6)
            .transition()
            .delay(delay)
            .duration(speed)
            .ease(d3.easeLinear)
            .attr('cx', to.x)
            .attr('cy', to.y)
            .attr('opacity', 0.1)
            .on('end', animate);
        }

        animate();
      }
    });

    return () => {
      svg.selectAll('.traffic-particle').remove();
    };
  }, []);

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
      {/* Filters are defined in HospitalMap; particles overlay the map */}
      <defs>
        <filter id="glow-red-particle" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor="#ff2d2d" floodOpacity="0.5" result="color" />
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
