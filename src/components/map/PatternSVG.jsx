import React from 'react';

const PATTERN_PATHS = {
  zigzag: {
    pts: [[10,50],[25,20],[40,50],[55,20],[70,50],[85,20],[100,50]],
    drawLine: true,
  },
  x: {
    pts: [[10,10],[90,90],[10,90],[90,10]],
    drawLine: 'x',
  },
  radial: {
    pts: [[50,50],[50,15],[83,33],[83,67],[50,85],[17,67],[17,33]],
    drawLine: 'radial',
  },
  grille: {
    pts: [[20,20],[50,20],[80,20],[20,50],[50,50],[80,50],[20,80],[50,80],[80,80]],
    drawLine: false,
  },
  diagonal: {
    pts: [[10,90],[30,70],[50,50],[70,30],[90,10]],
    drawLine: true,
  },
  transect: {
    pts: [[10,50],[30,50],[50,50],[70,50],[90,50],[50,15],[50,35],[50,65],[50,85]],
    drawLine: false,
  },
};

export default function PatternSVG({ type, color = '#4a7c2f', size = 90 }) {
  const config = PATTERN_PATHS[type] || PATTERN_PATHS.zigzag;
  const { pts, drawLine } = config;

  const renderLines = () => {
    if (!drawLine) return null;
    if (drawLine === 'x') {
      return (
        <>
          <line x1={pts[0][0]} y1={pts[0][1]} x2={pts[1][0]} y2={pts[1][1]}
            stroke={color} strokeWidth="1.5" strokeDasharray="5,3" opacity="0.7" />
          <line x1={pts[2][0]} y1={pts[2][1]} x2={pts[3][0]} y2={pts[3][1]}
            stroke={color} strokeWidth="1.5" strokeDasharray="5,3" opacity="0.7" />
        </>
      );
    }
    if (drawLine === 'radial') {
      return pts.slice(1).map((p, i) => (
        <line key={i} x1={50} y1={50} x2={p[0]} y2={p[1]}
          stroke={color} strokeWidth="1.2" strokeDasharray="4,3" opacity="0.6" />
      ));
    }
    // zigzag / diagonal — polyline
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
    return <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="5,3" opacity="0.7" />;
  };

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100" height="100" rx="8" fill={color} fillOpacity="0.07" />
      {renderLines()}
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === 0 && type === 'radial' ? 5 : 4}
          fill={color} opacity={i === 0 && type === 'radial' ? 1 : 0.85} />
      ))}
    </svg>
  );
}
