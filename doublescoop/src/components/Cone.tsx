import type { CSSProperties } from 'react';

export type Flavor = 'strawberry' | 'mint' | 'vanilla' | 'blueberry' | 'lemon' | 'chocolate' | 'lavender' | 'peach';

export const FLAVORS: readonly Flavor[] = [
  'strawberry',
  'mint',
  'vanilla',
  'blueberry',
  'lemon',
  'chocolate',
  'lavender',
  'peach',
];

/** A random flavor that differs from the scoop it lands on. */
export function pickFlavor(stack: readonly Flavor[]): Flavor {
  const below = stack[stack.length - 1];
  const options = FLAVORS.filter((f) => f !== below);
  return options[Math.floor(Math.random() * options.length)];
}

export type ConeState = 'idle' | 'finish' | 'topple';

/** Vertical layout of the stack, in px from the bottom of the cone wrapper. */
const CONE_HEIGHT = 150;
const SCOOP_STEP = 58;
const SCOOP_SEAT = CONE_HEIGHT - 34;

const SPRINKLES = [
  { x: 22, y: 30, r: 20, c: '#ff7aa8' },
  { x: 40, y: 16, r: -35, c: '#7ad7ff' },
  { x: 58, y: 26, r: 60, c: '#ffd166' },
  { x: 74, y: 14, r: -10, c: '#9be08f' },
  { x: 30, y: 46, r: 80, c: '#c79bff' },
  { x: 66, y: 44, r: -55, c: '#ff9f6b' },
  { x: 50, y: 38, r: 15, c: '#ff7aa8' },
  { x: 84, y: 34, r: 40, c: '#7ad7ff' },
];

function tumbleStyle(i: number): CSSProperties {
  const side = i % 2 === 0 ? 1 : -1;
  return {
    '--dx': `${side * (50 + i * 34)}px`,
    '--dy': `${260 + i * 50}px`,
    '--rot': `${side * (90 + i * 60)}deg`,
    '--delay': `${0.18 + i * 0.05}s`,
  } as CSSProperties;
}

export function Cone({ scoops, state }: { scoops: readonly Flavor[]; state: ConeState }) {
  const topY = SCOOP_SEAT + Math.max(0, scoops.length - 1) * SCOOP_STEP;
  return (
    <div className={`cone-wrap state-${state}`} aria-label={`Cone with ${scoops.length} scoops`}>
      <div className="cone-body">
        {scoops.map((flavor, i) => (
          <div className="scoop-slot" key={i} style={{ bottom: SCOOP_SEAT + i * SCOOP_STEP, zIndex: 2 + i }}>
            <div className={`scoop flavor-${flavor}`} style={tumbleStyle(i)}>
              <span className="scoop-drip" />
              {state === 'finish' && i === scoops.length - 1 && (
                <span className="sprinkles" aria-hidden>
                  {SPRINKLES.map((s, k) => (
                    <i
                      key={k}
                      style={{
                        left: `${s.x}%`,
                        top: `${s.y}%`,
                        background: s.c,
                        transform: `rotate(${s.r}deg)`,
                        animationDelay: `${0.25 + k * 0.04}s`,
                      }}
                    />
                  ))}
                </span>
              )}
            </div>
          </div>
        ))}
        {state === 'finish' && <div className="cherry" style={{ bottom: topY + 84, zIndex: 20 }} aria-hidden />}
        <div className="cone" aria-hidden>
          <div className="cone-rim" />
        </div>
      </div>
    </div>
  );
}

export function MiniCone({ flavor }: { flavor: Flavor }) {
  return (
    <span className="mini-cone" aria-hidden>
      <span className={`mini-scoop flavor-${flavor}`} />
      <span className="mini-cherry" />
      <span className="mini-wafer" />
    </span>
  );
}

const CONFETTI_COLORS = ['#ff9ec4', '#9fe7cf', '#ffe08a', '#b9c6ff', '#ffb38a', '#d8b4ff'];

/** Fixed-but-varied burst so re-renders don't reshuffle the pieces mid-animation. */
const CONFETTI = Array.from({ length: 34 }, (_, i) => {
  const angle = (i / 34) * Math.PI * 2 + (i % 3) * 0.3;
  const dist = 140 + ((i * 53) % 120);
  return {
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist - 60,
    r: (i * 97) % 360,
    c: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    round: i % 4 === 0,
  };
});

export function Confetti() {
  return (
    <div className="confetti" aria-hidden>
      {CONFETTI.map((p, i) => (
        <i
          key={i}
          className={p.round ? 'dot' : ''}
          style={{ '--x': `${p.x}px`, '--y': `${p.y}px`, '--r': `${p.r}deg`, background: p.c } as CSSProperties}
        />
      ))}
    </div>
  );
}
