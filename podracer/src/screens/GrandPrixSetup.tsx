import { useState } from 'react';
import { Portrait } from '../components/Portrait';
import { rivalForFamily } from '../game/characters';
import { FAMILIES, GRAND_PRIX } from '../game/config';
import { familiesAtLeast, getFamily, type SaveData } from '../game/progress';

interface Props {
  save: SaveData;
  onStart: (families: number[]) => void;
  onBack: () => void;
}

export function GrandPrixSetup({ save, onStart, onBack }: Props) {
  const [selected, setSelected] = useState<number[]>(() => familiesAtLeast(save, 'A'));
  const toggle = (f: number) =>
    setSelected((s) => (s.includes(f) ? s.filter((x) => x !== f) : [...s, f].sort((a, b) => a - b)));
  const ready = selected.length >= GRAND_PRIX.minFamilies;

  return (
    <div className="gp-setup">
      <header className="screen-header">
        <button type="button" className="btn ghost" onClick={onBack}>
          ◂ Hangar
        </button>
        <div>
          <h2>Twin Suns Grand Prix</h2>
          <p>
            Choose at least {GRAND_PRIX.minFamilies} fact families. Their rivals join the grid. Get{' '}
            {GRAND_PRIX.targetCorrect} correct answers in {GRAND_PRIX.durationMs / 1000} seconds to take the cup.
          </p>
        </div>
      </header>

      <div className="gp-grid">
        {FAMILIES.map((f) => {
          const fp = getFamily(save, f);
          const rival = rivalForFamily(f);
          const on = selected.includes(f);
          const known = fp.rank !== 'C';
          return (
            <button
              type="button"
              key={f}
              className={`gp-chip ${on ? 'on' : ''}`}
              onClick={() => toggle(f)}
              aria-pressed={on}
            >
              <Portrait className="gp-chip-portrait" design={rival.portrait} silhouette={!known} />
              <span className="gp-chip-num">×{f}</span>
              <span className={`rank-badge small rank-${fp.rank}`}>{fp.rank}</span>
              <span className="gp-chip-name">{known ? rival.name : '???'}</span>
            </button>
          );
        })}
      </div>

      <div className="gp-start">
        <span>
          {selected.length} selected{!ready && ` · pick ${GRAND_PRIX.minFamilies - selected.length} more`}
        </span>
        <button type="button" className="btn primary big" disabled={!ready} onClick={() => onStart(selected)}>
          Start Grand Prix
        </button>
      </div>
    </div>
  );
}
