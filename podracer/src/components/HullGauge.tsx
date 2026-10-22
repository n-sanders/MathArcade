import { useEffect, useRef, useState } from 'react';
import { HULL } from '../game/config';

export function HullGauge({ hull }: { hull: number }) {
  const prev = useRef(hull);
  const [hitKey, setHitKey] = useState(0);

  useEffect(() => {
    if (hull < prev.current) setHitKey((k) => k + 1);
    prev.current = hull;
  }, [hull]);

  const pct = Math.round((hull / HULL.max) * 100);
  const state = pct > 66 ? 'solid' : pct > 33 ? 'damaged' : 'critical';
  const label = state === 'solid' ? 'Hull solid' : state === 'damaged' ? 'Hull damaged' : 'Hull critical!';
  const segments = 10;

  return (
    <section className={`hull-gauge ${state} ${hitKey > 0 ? 'hit' : ''}`} key={hitKey} aria-label="Pod hull integrity">
      <header>
        <span className="hud-label">Pod Hull</span>
        <span className="hull-pct">{pct}%</span>
      </header>
      <div className="hull-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        {Array.from({ length: segments }, (_, i) => (
          <span key={i} className={i < Math.ceil((pct / 100) * segments) ? 'seg on' : 'seg'} />
        ))}
      </div>
      <footer>{label}</footer>
    </section>
  );
}
