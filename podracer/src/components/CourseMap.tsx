import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { PodDesign } from '../game/characters';
import type { SceneryId, Track } from '../game/tracks';
import { PodRacerShape } from './PodRacer';

export interface MapRacer {
  id: string;
  label: string;
  /** 0..1 across the whole race (all laps). */
  progress: number;
  design: PodDesign;
  isPlayer?: boolean;
}

interface Props {
  track: Track;
  racers: MapRacer[];
  laps: number;
  overlay?: ReactNode;
}

interface Point {
  x: number;
  y: number;
}

const SAMPLES = 480;

/** Eases each racer's displayed position toward its target so answer-driven jumps glide. */
function useSmoothed(targets: Record<string, number>): Record<string, number> {
  const [values, setValues] = useState(targets);
  const targetRef = useRef(targets);
  targetRef.current = targets;

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setValues((prev) => {
        let changed = false;
        const next: Record<string, number> = {};
        for (const [id, target] of Object.entries(targetRef.current)) {
          const p = prev[id] ?? target;
          const diff = target - p;
          const v = Math.abs(diff) < 0.0004 ? target : p + diff * Math.min(1, dt * 5);
          if (v !== p || !(id in prev)) changed = true;
          next[id] = v;
        }
        return changed ? next : prev;
      });
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  return values;
}

function SceneryBackdrop({ id }: { id: SceneryId }) {
  switch (id) {
    case 'desert':
      return (
        <>
          <circle cx="690" cy="20" r="12" fill="#ffe7a8" opacity={0.9} />
          <circle cx="722" cy="26" r="7" fill="#ffd27a" opacity={0.85} />
          <path d="M 0 34 L 60 18 L 110 30 L 170 12 L 240 34 Z" fill="#7a4428" opacity={0.85} />
          <path d="M 420 34 L 470 22 L 520 34 Z M 560 34 L 610 14 L 660 34 Z" fill="#6a3a24" opacity={0.85} />
          <g opacity={0.35} fill="#7a4a28">
            <ellipse cx="420" cy="180" rx="70" ry="30" />
            <ellipse cx="250" cy="185" rx="40" ry="18" />
            <ellipse cx="560" cy="175" rx="38" ry="16" />
            <ellipse cx="60" cy="300" rx="50" ry="14" />
            <ellipse cx="760" cy="300" rx="40" ry="14" />
          </g>
          <g fill="#5e3820" opacity={0.6}>
            <polygon points="404,168 420,150 440,152 452,170" />
            <polygon points="236,180 246,166 262,170 268,184" />
            <circle cx="40" cy="80" r="5" />
            <circle cx="760" cy="120" r="6" />
            <circle cx="780" cy="200" r="4" />
          </g>
        </>
      );
    case 'ice':
      return (
        <>
          <circle cx="110" cy="17" r="10" fill="#eef6ff" opacity={0.9} />
          <circle cx="114" cy="14" r="9" fill="#9cc4ea" opacity={0.5} />
          <path d="M 300 34 L 350 10 L 400 34 Z M 380 34 L 440 4 L 500 34 Z M 640 34 L 690 14 L 740 34 Z" fill="#5b7898" opacity={0.85} />
          <path d="M 340 15 L 350 10 L 360 15 Z M 428 10 L 440 4 L 452 10 Z M 680 18 L 690 14 L 700 18 Z" fill="#f4fbff" />
          <g opacity={0.45} fill="#c4d8ea">
            <ellipse cx="400" cy="180" rx="70" ry="26" />
            <ellipse cx="60" cy="300" rx="50" ry="14" />
            <ellipse cx="750" cy="290" rx="45" ry="14" />
          </g>
          <g stroke="#ffffff" strokeWidth={2} strokeLinecap="round" opacity={0.8}>
            {[
              [40, 90],
              [760, 130],
              [770, 220],
              [400, 180],
              [30, 240],
            ].map(([x, y]) => (
              <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
                <line x1={-7} y1={0} x2={7} y2={0} />
                <line x1={-3.5} y1={-6} x2={3.5} y2={6} />
                <line x1={-3.5} y1={6} x2={3.5} y2={-6} />
              </g>
            ))}
          </g>
        </>
      );
    case 'jungle':
      return (
        <>
          <circle cx="700" cy="18" r="11" fill="#fff2b0" opacity={0.85} />
          <path d="M 0 34 Q 40 8 80 34 Q 120 6 170 34 Q 220 12 260 34 Z M 500 34 Q 550 10 600 34 Q 640 14 680 34 Z" fill="#1f4a22" opacity={0.9} />
          <g fill="#244f1f" opacity={0.75}>
            {[
              [40, 90, 20],
              [765, 130, 22],
              [30, 250, 18],
              [770, 230, 16],
              [400, 185, 26],
              [260, 180, 14],
              [560, 180, 14],
            ].map(([x, y, r]) => (
              <g key={`${x}-${y}`}>
                <circle cx={x} cy={y} r={r} />
                <circle cx={x - r * 0.7} cy={y + r * 0.3} r={r * 0.7} />
                <circle cx={x + r * 0.7} cy={y + r * 0.3} r={r * 0.7} />
              </g>
            ))}
          </g>
          <g fill="none" stroke="#3d7a2c" strokeWidth={2.5} opacity={0.7}>
            <path d="M 0 320 C 60 300 100 330 160 312" />
            <path d="M 640 322 C 700 300 740 330 800 310" />
          </g>
        </>
      );
    case 'volcanic':
      return (
        <>
          <path d="M 60 34 L 130 8 L 150 8 L 220 34 Z M 520 34 L 600 4 L 622 4 L 700 34 Z" fill="#2a1410" />
          <path d="M 134 8 L 146 8 L 142 0 Z M 605 4 L 617 4 L 611 0 Z" fill="#ff7a2a" />
          <g fill="#ff6a1f" opacity={0.75}>
            <ellipse cx="400" cy="183" rx="50" ry="18" />
            <ellipse cx="60" cy="300" rx="40" ry="12" />
            <ellipse cx="750" cy="295" rx="36" ry="11" />
          </g>
          <g fill="#ffc04a" opacity={0.6}>
            <ellipse cx="400" cy="183" rx="26" ry="8" />
            <ellipse cx="60" cy="300" rx="18" ry="5" />
          </g>
          <g fill="#140c0a" opacity={0.8}>
            <polygon points="30,100 44,78 58,100" />
            <polygon points="750,140 764,114 778,140" />
            <polygon points="760,230 772,212 784,230" />
            <circle cx="30" cy="220" r="5" />
          </g>
        </>
      );
  }
}

export function CourseMap({ track, racers, laps, overlay }: Props) {
  const { scenery } = track;
  const path = track.layout.path;
  const pathRef = useRef<SVGPathElement>(null);
  const [points, setPoints] = useState<Point[]>([]);

  useLayoutEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const length = path.getTotalLength();
    const pts: Point[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const p = path.getPointAtLength((length * i) / SAMPLES);
      pts.push({ x: p.x, y: p.y });
    }
    setPoints(pts);
  }, [path]);

  const targets: Record<string, number> = {};
  for (const r of racers) targets[r.id] = r.progress;
  const smoothed = useSmoothed(targets);

  function poseAt(lapFraction: number) {
    const f = ((lapFraction % 1) + 1) % 1;
    const pos = f * SAMPLES;
    const i = Math.floor(pos);
    const t = pos - i;
    const a = points[i];
    const b = points[Math.min(SAMPLES, i + 1)];
    const ahead = points[Math.min(SAMPLES, i + 3)] ?? b;
    const behind = points[Math.max(0, i - 2)] ?? a;
    const angle = (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle };
  }

  const start = points.length ? poseAt(0) : null;
  const ordered = [...racers].sort((a, b) => Number(!!a.isPlayer) - Number(!!b.isPlayer));
  const laneOffsets = [0, 9, -9, 15, -15, 4, -4, 12, -12];
  const showRivalLabels = racers.length <= 3;

  return (
    <div className="course-map">
      <svg viewBox="0 0 800 340" role="img" aria-label={`${track.name} course map`}>
        <defs>
          <linearGradient id={`sky-${track.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={scenery.sky[0]} />
            <stop offset="100%" stopColor={scenery.sky[1]} />
          </linearGradient>
          <linearGradient id={`ground-${track.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={scenery.ground[0]} />
            <stop offset="100%" stopColor={scenery.ground[1]} />
          </linearGradient>
          <pattern id="checker" width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="#f5f0e6" />
            <rect width="3" height="3" fill="#1a1a1a" />
            <rect x="3" y="3" width="3" height="3" fill="#1a1a1a" />
          </pattern>
        </defs>

        <rect width="800" height="340" fill={`url(#ground-${track.id})`} />
        <rect width="800" height="34" fill={`url(#sky-${track.id})`} />
        <SceneryBackdrop id={scenery.id} />

        <path d={path} fill="none" stroke={scenery.trackEdge} strokeWidth={40} strokeLinejoin="round" />
        <path d={path} fill="none" stroke={scenery.trackSurface} strokeWidth={32} strokeLinejoin="round" />
        <path d={path} fill="none" stroke={scenery.trackInner} strokeWidth={22} strokeLinejoin="round" opacity={0.6} />
        <path
          ref={pathRef}
          d={path}
          fill="none"
          stroke={scenery.centerLine}
          strokeWidth={1.5}
          strokeDasharray="8 12"
          opacity={0.8}
        />

        {start && (
          <g transform={`translate(${start.x} ${start.y}) rotate(${start.angle})`}>
            <rect x={-3} y={-18} width={6} height={36} fill="url(#checker)" />
            <rect x={-14} y={-32} width={4} height={14} fill="#3a2a1e" />
            <rect x={-18} y={-38} width={16} height={8} fill="#e8893a" />
          </g>
        )}

        {points.length > 0 &&
          ordered.map((r, index) => {
            const overall = Math.max(0, Math.min(1, smoothed[r.id] ?? r.progress));
            const pose = poseAt(overall * laps);
            const lane = laneOffsets[index % laneOffsets.length];
            const rad = ((pose.angle + 90) * Math.PI) / 180;
            const x = pose.x + Math.cos(rad) * lane;
            const y = pose.y + Math.sin(rad) * lane;
            return (
              <g key={r.id} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} className={r.isPlayer ? 'map-racer player' : 'map-racer'}>
                {r.isPlayer && <circle r={22} fill="none" stroke="#66e0ff" strokeWidth={2} className="player-ring" />}
                <g transform={`rotate(${pose.angle.toFixed(1)}) scale(0.55)`}>
                  <PodRacerShape design={r.design} />
                </g>
                {(r.isPlayer || showRivalLabels) && (
                  <g transform="translate(0 -27)">
                    <rect x={-r.label.length * 3.4 - 5} y={-8} width={r.label.length * 6.8 + 10} height={13} rx={6} fill={r.isPlayer ? '#0f3c4a' : '#2a1a12'} opacity={0.9} />
                    <text textAnchor="middle" y={2} fontSize={10} fontWeight={700} fill={r.isPlayer ? '#9ef0ff' : '#f5d9b0'}>
                      {r.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
      </svg>
      {overlay && <div className="course-overlay">{overlay}</div>}
      <div className="course-name">{track.name}</div>
    </div>
  );
}
