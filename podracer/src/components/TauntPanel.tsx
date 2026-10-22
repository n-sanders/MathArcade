import type { Character } from '../game/characters';
import { Portrait, type Mood } from './Portrait';

interface Props {
  speaker: Character;
  text: string;
  mood: Mood;
  lineId: number;
}

export function TauntPanel({ speaker, text, mood, lineId }: Props) {
  return (
    <section className="taunt-panel" aria-live="polite">
      <Portrait className="taunt-portrait" design={speaker.portrait} mood={mood} title={speaker.name} />
      <div className="taunt-body">
        <div className="taunt-name">{speaker.name}</div>
        <div className="taunt-title">{speaker.title}</div>
        <p className="taunt-bubble" key={lineId}>
          {text}
        </p>
      </div>
    </section>
  );
}
