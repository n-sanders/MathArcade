import type { PortraitDesign } from '../game/characters';

export type Mood = 'smug' | 'angry' | 'shocked' | 'happy';

interface Props {
  design: PortraitDesign;
  mood?: Mood;
  silhouette?: boolean;
  className?: string;
  title?: string;
}

/** Procedural alien/droid racer portrait in a 120×120 box. */
export function Portrait({ design, mood = 'smug', silhouette = false, className, title }: Props) {
  const d = design;
  const gradientId = `portrait-bg-${design.backdrop.slice(1)}${silhouette ? '-s' : ''}`;
  return (
    <svg className={className} viewBox="0 0 120 120" role="img" aria-label={title ?? 'Racer portrait'}>
      <defs>
        <radialGradient id={gradientId} cx="50%" cy="35%" r="75%">
          <stop offset="0%" stopColor={silhouette ? '#3a2c22' : design.backdrop} />
          <stop offset="100%" stopColor="#0d0907" />
        </radialGradient>
      </defs>
      <rect width="120" height="120" fill={`url(#${gradientId})`} />
      <g style={silhouette ? { filter: 'brightness(0.12)' } : undefined}>
        <path d="M 14 120 C 18 96 38 88 60 88 C 82 88 102 96 106 120 Z" fill={d.suit} />
        <path d="M 46 90 L 60 104 L 74 90" stroke={d.gearColor} strokeWidth={3} fill="none" />
        {design.kind === 'droid' ? <DroidHead d={d} mood={mood} /> : <AlienHead d={d} mood={mood} />}
      </g>
      {silhouette && (
        <text x="60" y="70" textAnchor="middle" fontSize="34" fontWeight="800" fill="#e8893a" opacity={0.85}>
          ?
        </text>
      )}
    </svg>
  );
}

function headPath(shape: PortraitDesign['head']): string {
  switch (shape) {
    case 'long':
      return 'M 60 12 C 84 12 86 44 84 64 C 82 86 72 96 60 96 C 48 96 38 86 36 64 C 34 44 36 12 60 12 Z';
    case 'wide':
      return 'M 60 30 C 92 30 100 48 98 64 C 96 82 80 92 60 92 C 40 92 24 82 22 64 C 20 48 28 30 60 30 Z';
    case 'pointed':
      return 'M 60 14 C 84 28 90 58 82 78 C 76 92 66 96 60 96 C 54 96 44 92 38 78 C 30 58 36 28 60 14 Z';
    case 'round':
    default:
      return 'M 60 24 C 86 24 92 44 92 60 C 92 80 78 94 60 94 C 42 94 28 80 28 60 C 28 44 34 24 60 24 Z';
  }
}

function eyePositions(count: PortraitDesign['eyes'], head: PortraitDesign['head']): [number, number, number][] {
  const y = head === 'long' ? 52 : head === 'wide' ? 58 : 56;
  switch (count) {
    case 1:
      return [[60, y, 9]];
    case 3:
      return [
        [46, y, 6],
        [74, y, 6],
        [60, y - 13, 5],
      ];
    case 4:
      return [
        [48, y - 6, 4.8],
        [72, y - 6, 4.8],
        [50, y + 6, 4],
        [70, y + 6, 4],
      ];
    case 2:
    default:
      return [
        [47, y, 7],
        [73, y, 7],
      ];
  }
}

function AlienHead({ d, mood }: { d: PortraitDesign; mood: Mood }) {
  const eyes = eyePositions(d.eyes, d.head);
  const eyeY = eyes[0][1];
  const mouthY = d.head === 'long' ? 80 : 78;
  const pupilScale = mood === 'shocked' ? 0.35 : 0.55;

  return (
    <g>
      <Feature d={d} behind />
      <path d={headPath(d.head)} fill={d.skin} stroke={d.skinShade} strokeWidth={2} />
      <path d="M 40 78 C 48 88 72 88 80 78" fill="none" stroke={d.skinShade} strokeWidth={3} opacity={0.35} />
      <Feature d={d} />

      {d.gear === 'helmet' && (
        <path d="M 28 52 C 28 20 92 20 92 52 L 86 50 C 82 30 38 30 34 50 Z" fill={d.gearColor} stroke="#0008" strokeWidth={1.5} />
      )}

      {eyes.map(([x, y, r], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx={r} ry={r * 0.85} fill="#fbf6e9" />
          <circle cx={x + (mood === 'smug' ? 1.2 : 0)} cy={y} r={r * pupilScale} fill={d.eyeColor} />
          <circle cx={x + (mood === 'smug' ? 1.2 : 0)} cy={y} r={r * pupilScale * 0.5} fill="#111" />
          {mood === 'smug' && <path d={`M ${x - r} ${y - r * 0.3} L ${x + r} ${y - r * 0.3}`} stroke={d.skin} strokeWidth={r * 0.9} />}
        </g>
      ))}

      {mood === 'angry' &&
        eyes.slice(0, 2).map(([x, y, r], i) => (
          <path
            key={`brow-${i}`}
            d={i === 0 ? `M ${x - r} ${y - r - 4} L ${x + r} ${y - r + 1}` : `M ${x - r} ${y - r + 1} L ${x + r} ${y - r - 4}`}
            stroke="#1b120c"
            strokeWidth={3}
            strokeLinecap="round"
          />
        ))}

      {d.gear === 'goggles' && (
        <g>
          <path d={`M 30 ${eyeY - 18} L 90 ${eyeY - 18}`} stroke="#2a1e15" strokeWidth={5} />
          <circle cx={47} cy={eyeY - 18} r={7} fill="#a6e3ff" stroke={d.gearColor} strokeWidth={3} opacity={0.95} />
          <circle cx={73} cy={eyeY - 18} r={7} fill="#a6e3ff" stroke={d.gearColor} strokeWidth={3} opacity={0.95} />
        </g>
      )}
      {d.gear === 'visor' && (
        <rect x={34} y={eyeY - 9} width={52} height={18} rx={9} fill={d.gearColor} opacity={0.35} stroke={d.gearColor} strokeWidth={1.5} />
      )}

      <Mouth mood={mood} y={mouthY} />
    </g>
  );
}

function Mouth({ mood, y }: { mood: Mood; y: number }) {
  switch (mood) {
    case 'shocked':
      return <ellipse cx={60} cy={y} rx={5} ry={6} fill="#2a120c" />;
    case 'angry':
      return <path d={`M 50 ${y + 3} C 55 ${y - 3} 65 ${y - 3} 70 ${y + 3}`} stroke="#2a120c" strokeWidth={3} fill="none" strokeLinecap="round" />;
    case 'happy':
      return <path d={`M 48 ${y - 3} C 54 ${y + 7} 66 ${y + 7} 72 ${y - 3}`} stroke="#2a120c" strokeWidth={3} fill="none" strokeLinecap="round" />;
    case 'smug':
    default:
      return <path d={`M 50 ${y} C 58 ${y + 3} 66 ${y + 1} 72 ${y - 5}`} stroke="#2a120c" strokeWidth={3} fill="none" strokeLinecap="round" />;
  }
}

function Feature({ d, behind = false }: { d: PortraitDesign; behind?: boolean }) {
  const shade = d.skinShade;
  switch (d.feature) {
    case 'ears':
      return behind ? (
        <g fill={d.skin} stroke={shade} strokeWidth={2}>
          <path d="M 32 50 C 6 38 4 58 10 66 C 18 72 28 66 32 62 Z" />
          <path d="M 88 50 C 114 38 116 58 110 66 C 102 72 92 66 88 62 Z" />
        </g>
      ) : null;
    case 'horns':
      return behind ? (
        <g fill="#efe3c8" stroke="#8b7a5a" strokeWidth={1.5}>
          <path d="M 40 36 C 30 22 28 10 34 2 C 36 14 44 24 50 30 Z" />
          <path d="M 80 36 C 90 22 92 10 86 2 C 84 14 76 24 70 30 Z" />
        </g>
      ) : null;
    case 'tendrils':
      return behind ? (
        <g fill={d.skin} stroke={shade} strokeWidth={2}>
          <path d="M 40 70 C 30 90 26 104 34 116 C 40 104 44 90 50 80 Z" />
          <path d="M 80 70 C 90 90 94 104 86 116 C 80 104 76 90 70 80 Z" />
        </g>
      ) : null;
    case 'crest':
      return behind ? (
        <path d="M 50 26 C 52 8 60 0 64 2 C 62 10 66 18 72 26 Z" fill={shade} stroke="#0006" strokeWidth={1.5} />
      ) : null;
    case 'antennae':
      return behind ? (
        <g stroke={shade} strokeWidth={2.5} fill={d.eyeColor}>
          <path d="M 50 26 C 46 14 40 8 34 6" fill="none" />
          <path d="M 70 26 C 74 14 80 8 86 6" fill="none" />
          <circle cx={34} cy={6} r={4} />
          <circle cx={86} cy={6} r={4} />
        </g>
      ) : null;
    case 'fins':
      return behind ? (
        <g fill={shade} stroke="#0006" strokeWidth={1.5}>
          <path d="M 30 48 L 8 36 L 14 60 L 30 66 Z" />
          <path d="M 90 48 L 112 36 L 106 60 L 90 66 Z" />
        </g>
      ) : null;
    case 'tusks':
      return behind ? null : (
        <g fill="#f4ecd8" stroke="#8b7a5a" strokeWidth={1.2}>
          <path d="M 46 80 C 42 70 40 62 44 58 C 46 66 50 72 52 78 Z" />
          <path d="M 74 80 C 78 70 80 62 76 58 C 74 66 70 72 68 78 Z" />
        </g>
      );
    case 'none':
    default:
      return null;
  }
}

function DroidHead({ d, mood }: { d: PortraitDesign; mood: Mood }) {
  return (
    <g>
      <path d="M 60 24 L 60 8" stroke="#555" strokeWidth={2.5} />
      <circle cx={60} cy={7} r={4} fill={d.gearColor} className="droid-blink" />
      <rect x={30} y={24} width={60} height={60} rx={14} fill={d.skin} stroke={d.skinShade} strokeWidth={2.5} />
      <rect x={30} y={44} width={60} height={4} fill={d.gearColor} />
      {[44, 76].map((x) => (
        <g key={x}>
          <circle cx={x} cy={58} r={10} fill="#2a2420" stroke="#555" strokeWidth={2} />
          <circle cx={x} cy={58} r={mood === 'shocked' ? 6 : 4.5} fill={d.eyeColor} />
        </g>
      ))}
      <g stroke="#2a2420" strokeWidth={2}>
        {[48, 54, 60, 66, 72].map((x) => (
          <path key={x} d={`M ${x} 72 L ${x} ${mood === 'happy' ? 80 : 78}`} />
        ))}
      </g>
    </g>
  );
}
