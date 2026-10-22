import { Fragment, useEffect, useState } from 'react';
import { skipCountRow } from '../game/facts';

export interface Reveal {
  correct: number;
  given: number;
}

function boxClass(value: number, reveal: Reveal | null): string {
  if (!reveal) return '';
  if (value === reveal.correct) return 'reveal-correct';
  if (value === reveal.given) return 'reveal-wrong';
  return '';
}

/** Skip-count chart with a visual split between ×5 and ×6. */
export function NumberLine({
  family,
  onPick,
  disabled,
  reveal,
}: {
  family: number;
  onPick: (value: number) => void;
  disabled: boolean;
  reveal: Reveal | null;
}) {
  const row = skipCountRow(family);
  return (
    <div className="number-line" role="group" aria-label={`Skip-count chart for ${family}`}>
      {row.map((value, i) => {
        const anchor = i === 4 || i === 9;
        return (
          <Fragment key={value}>
            {i === 5 && <span className="number-line-split" aria-hidden />}
            <button
              type="button"
              className={`nl-box ${anchor ? 'anchor' : ''} ${boxClass(value, reveal)}`}
              onClick={() => onPick(value)}
              disabled={disabled}
            >
              {value}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

export function ChoicePad({
  choices,
  onPick,
  disabled,
  reveal,
}: {
  choices: number[];
  onPick: (value: number) => void;
  disabled: boolean;
  reveal: Reveal | null;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const idx = Number(e.key) - 1;
      if (!disabled && idx >= 0 && idx < choices.length) onPick(choices[idx]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choices, disabled, onPick]);

  return (
    <div className="choice-pad" role="group" aria-label="Answer choices">
      {choices.map((value, i) => (
        <button
          type="button"
          key={`${value}-${i}`}
          className={`choice ${boxClass(value, reveal)}`}
          onClick={() => onPick(value)}
          disabled={disabled}
        >
          <span className="choice-key">{i + 1}</span>
          {value}
        </button>
      ))}
    </div>
  );
}

export function Keypad({
  onSubmit,
  disabled,
  reveal,
  resetKey,
}: {
  onSubmit: (value: number) => void;
  disabled: boolean;
  reveal: Reveal | null;
  resetKey: number;
}) {
  const [entry, setEntry] = useState('');

  useEffect(() => setEntry(''), [resetKey]);

  const press = (key: string) => {
    if (disabled) return;
    if (key === 'back') setEntry((e) => e.slice(0, -1));
    else if (key === 'enter') {
      if (entry) onSubmit(Number(entry));
    } else setEntry((e) => (e.length >= 3 ? e : e + key));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Enter would also "click" whichever keypad button last had focus, typing a stray digit.
      if (e.key === 'Enter') e.preventDefault();
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Enter') press('enter');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const display = reveal ? String(reveal.correct) : entry || '\u00a0';

  return (
    <div className="keypad">
      <div className={`keypad-display ${reveal ? 'reveal-correct' : ''}`} aria-live="polite">
        {display}
      </div>
      <div className="keypad-keys">
        {['7', '8', '9', '4', '5', '6', '1', '2', '3', 'back', '0', 'enter'].map((k) => (
          <button
            type="button"
            key={k}
            className={`key key-${k}`}
            onClick={() => press(k)}
            disabled={disabled}
            aria-label={k === 'back' ? 'Delete' : k === 'enter' ? 'Submit' : k}
          >
            {k === 'back' ? '⌫' : k === 'enter' ? 'GO' : k}
          </button>
        ))}
      </div>
    </div>
  );
}
