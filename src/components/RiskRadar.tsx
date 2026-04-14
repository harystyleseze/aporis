'use client';

import type { RadarScores } from '@/types';

interface Props {
  scores: RadarScores;
  overall: 'low' | 'medium' | 'high';
  size?: number;
}

const AXES = [
  { key: 'tvlDepth' as const, label: 'TVL' },
  { key: 'apyStability' as const, label: 'Stability' },
  { key: 'protocolTrust' as const, label: 'Trust' },
  { key: 'liquidityAccess' as const, label: 'Liquidity' },
  { key: 'yieldSustain' as const, label: 'Sustain.' },
];

const RISK_COLORS = {
  low: { fill: 'rgba(0,255,136,0.15)', stroke: '#00ff88', text: '#00ff88' },
  medium: { fill: 'rgba(255,159,28,0.15)', stroke: '#ff9f1c', text: '#ff9f1c' },
  high: { fill: 'rgba(255,51,102,0.15)', stroke: '#ff3366', text: '#ff3366' },
};

function polarToXY(angle: number, radius: number, cx: number, cy: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

export function RiskRadar({ scores, overall, size = 200 }: Props) {
  const colors = RISK_COLORS[overall];

  // Use a larger internal viewBox with padding so labels don't clip
  const pad = 40;
  const vb = size + pad * 2;
  const cx = vb / 2;
  const cy = vb / 2;
  const maxR = size * 0.32;

  const rings = [0.25, 0.5, 0.75, 1.0];

  const dataPoints = AXES.map((axis, i) => {
    const angle = (360 / AXES.length) * i;
    const value = scores[axis.key] / 100;
    return polarToXY(angle, maxR * value, cx, cy);
  });
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  const avgScore = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / 5);

  return (
    <div className="flex flex-col items-center w-full">
      <svg
        viewBox={`0 0 ${vb} ${vb}`}
        className="w-full max-w-[240px] h-auto"
      >
        <defs>
          <filter id="radar-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid rings */}
        {rings.map(r => (
          <polygon
            key={r}
            points={AXES.map((_, i) => {
              const p = polarToXY((360 / AXES.length) * i, maxR * r, cx, cy);
              return `${p.x},${p.y}`;
            }).join(' ')}
            fill="none"
            stroke="#1a2240"
            strokeWidth="0.5"
          />
        ))}

        {/* Axis lines */}
        {AXES.map((_, i) => {
          const p = polarToXY((360 / AXES.length) * i, maxR, cx, cy);
          return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#1a2240" strokeWidth="0.5" />;
        })}

        {/* Data polygon */}
        <path
          d={dataPath}
          fill={colors.fill}
          stroke={colors.stroke}
          strokeWidth="1.5"
          filter="url(#radar-glow)"
          style={{ transition: 'all 0.5s ease' }}
        />

        {/* Data points */}
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={colors.stroke} opacity="0.8" />
        ))}

        {/* Axis labels — positioned well outside the chart with room to breathe */}
        {AXES.map((axis, i) => {
          const p = polarToXY((360 / AXES.length) * i, maxR + 22, cx, cy);
          return (
            <text
              key={axis.key}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#e0e6f0"
              opacity="0.4"
              fontSize="10"
              fontFamily="var(--font-geist-mono), monospace"
            >
              {axis.label}
            </text>
          );
        })}

        {/* Center score */}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fill={colors.text}
          fontSize="20"
          fontWeight="bold"
          fontFamily="var(--font-geist-mono), monospace"
        >
          {avgScore}
        </text>
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          fill={colors.text}
          opacity="0.6"
          fontSize="9"
          fontFamily="var(--font-geist-mono), monospace"
        >
          {overall.toUpperCase()} RISK
        </text>
      </svg>
    </div>
  );
}
