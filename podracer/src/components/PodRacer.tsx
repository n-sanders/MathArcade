import type { ReactElement } from 'react';
import type { PodDesign } from '../game/characters';

/**
 * Top-down pod racer drawn facing +x: two engines out front, tethered by cables to a small
 * cockpit carriage behind, with an energy binder arcing between the engines.
 * Coordinates are in "pod units" centred near the origin (roughly x -60..60, y -30..30).
 */
export function PodRacerShape({ design, animated = true }: { design: PodDesign; animated?: boolean }) {
  const L = design.engineLength;
  const W = design.engineWidth;
  const spread = W * 0.9 + 7;
  const engineX = -6;
  const cockpitX = -40;
  const binderX = engineX + L * 0.72;

  const zigzag: string[] = [];
  const top = -spread + W / 2;
  const bottom = spread - W / 2;
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const y = top + ((bottom - top) * i) / steps;
    const x = binderX + (i % 2 === 0 ? -1.6 : 1.6);
    zigzag.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }

  return (
    <g className={animated ? 'pod pod-animated' : 'pod'}>
      {[-1, 1].map((side) => (
        <g key={`cables-${side}`} stroke="#2a211b" strokeWidth={0.9} fill="none" opacity={0.9}>
          <path d={`M ${cockpitX + 9} ${side * 2} Q ${(cockpitX + engineX) / 2} ${side * spread * 0.3} ${engineX + 1} ${side * (spread - 1.5)}`} />
          <path d={`M ${cockpitX + 9} ${side * 3.5} Q ${(cockpitX + engineX) / 2} ${side * spread * 0.75} ${engineX + 1} ${side * (spread + 1.5)}`} />
        </g>
      ))}

      {[-1, 1].map((side) => (
        <ellipse
          key={`flame-${side}`}
          className="pod-flame"
          cx={engineX - 4}
          cy={side * spread}
          rx={6}
          ry={W * 0.32}
          fill={design.flame}
          opacity={0.85}
        />
      ))}

      {[-1, 1].map((side) => (
        <Engine key={`engine-${side}`} design={design} x={engineX} cy={side * spread} length={L} width={W} side={side} />
      ))}

      <path
        className="pod-binder"
        d={zigzag.join(' ')}
        stroke={design.binder}
        strokeWidth={1.4}
        fill="none"
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 2px ${design.binder})` }}
      />

      <Cockpit design={design} x={cockpitX} />
    </g>
  );
}

function Engine({
  design,
  x,
  cy,
  length: L,
  width: W,
  side,
}: {
  design: PodDesign;
  x: number;
  cy: number;
  length: number;
  width: number;
  side: number;
}) {
  const top = cy - W / 2;
  const stroke = '#1d1712';
  let body: ReactElement;
  switch (design.engineShape) {
    case 'wedge':
      body = (
        <polygon
          points={`${x},${top} ${x + L * 0.68},${top} ${x + L},${cy - W * 0.18} ${x + L},${cy + W * 0.18} ${x + L * 0.68},${top + W} ${x},${top + W}`}
          fill={design.primary}
          stroke={stroke}
          strokeWidth={0.8}
        />
      );
      break;
    case 'split':
      body = (
        <g fill={design.primary} stroke={stroke} strokeWidth={0.8}>
          <rect x={x} y={top} width={L * 0.62} height={W} rx={W * 0.3} />
          <rect x={x + L * 0.55} y={top} width={L * 0.45} height={W * 0.4} rx={W * 0.2} />
          <rect x={x + L * 0.55} y={top + W * 0.6} width={L * 0.45} height={W * 0.4} rx={W * 0.2} />
        </g>
      );
      break;
    case 'twin':
      body = (
        <g fill={design.primary} stroke={stroke} strokeWidth={0.8}>
          <rect x={x} y={top} width={L} height={W * 0.46} rx={W * 0.23} />
          <rect x={x + L * 0.08} y={top + W * 0.54} width={L * 0.92} height={W * 0.46} rx={W * 0.23} />
        </g>
      );
      break;
    case 'finned': {
      const finY = side < 0 ? top : top + W;
      const finDir = side < 0 ? -1 : 1;
      body = (
        <g stroke={stroke} strokeWidth={0.8}>
          <polygon
            points={`${x + L * 0.05},${finY} ${x - 2},${finY + finDir * W * 0.7} ${x + L * 0.32},${finY}`}
            fill={design.secondary}
          />
          <rect x={x} y={top} width={L} height={W} rx={W / 2} fill={design.primary} />
        </g>
      );
      break;
    }
    case 'round':
    default:
      body = <rect x={x} y={top} width={L} height={W} rx={W / 2} fill={design.primary} stroke={stroke} strokeWidth={0.8} />;
  }

  return (
    <g>
      {body}
      <rect x={x + L * 0.28} y={top + 0.6} width={3.2} height={W - 1.2} fill={design.secondary} opacity={0.95} />
      <rect x={x + L * 0.4} y={top + 0.6} width={1.6} height={W - 1.2} fill={design.secondary} opacity={0.7} />
      {design.engineShape !== 'split' && design.engineShape !== 'twin' && (
        <ellipse cx={x + L - W * 0.28} cy={cy} rx={W * 0.16} ry={W * 0.3} fill="#16110d" opacity={0.85} />
      )}
    </g>
  );
}

function Cockpit({ design, x }: { design: PodDesign; x: number }) {
  const stroke = '#1d1712';
  switch (design.cockpit) {
    case 'dart':
      return (
        <g>
          <polygon points={`${x - 12},-7 ${x + 12},0 ${x - 12},7 ${x - 8},0`} fill={design.primary} stroke={stroke} strokeWidth={0.8} />
          <ellipse cx={x - 1} cy={0} rx={4.5} ry={2.4} fill={design.canopy} />
        </g>
      );
    case 'disc':
      return (
        <g>
          <circle cx={x} cy={0} r={8.5} fill={design.primary} stroke={stroke} strokeWidth={0.8} />
          <circle cx={x} cy={0} r={4.5} fill={design.canopy} />
          <circle cx={x} cy={0} r={8.5} fill="none" stroke={design.secondary} strokeWidth={1.2} strokeDasharray="3 3" />
        </g>
      );
    case 'tub':
      return (
        <g>
          <rect x={x - 11} y={-7.5} width={20} height={15} rx={4} fill={design.primary} stroke={stroke} strokeWidth={0.8} />
          <rect x={x - 6} y={-4} width={10} height={8} rx={3} fill={design.canopy} />
          <rect x={x + 7} y={-6} width={2} height={12} fill={design.secondary} />
        </g>
      );
    case 'pod':
    default:
      return (
        <g>
          <ellipse cx={x} cy={0} rx={12} ry={7.5} fill={design.primary} stroke={stroke} strokeWidth={0.8} />
          <ellipse cx={x + 2} cy={0} rx={5.5} ry={3.6} fill={design.canopy} />
          <path d={`M ${x - 10} -3 L ${x - 4} -3 M ${x - 10} 3 L ${x - 4} 3`} stroke={design.secondary} strokeWidth={1.2} />
        </g>
      );
  }
}

export function PodRacer({
  design,
  className,
  title,
  animated = true,
}: {
  design: PodDesign;
  className?: string;
  title?: string;
  animated?: boolean;
}) {
  return (
    <svg className={className} viewBox="-58 -30 116 60" role="img" aria-label={title ?? 'Pod racer'}>
      <PodRacerShape design={design} animated={animated} />
    </svg>
  );
}
