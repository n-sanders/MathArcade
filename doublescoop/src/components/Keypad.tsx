import { useEffect, useState } from 'react';

export interface Reveal {
  correct: number;
  given: number | null;
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
