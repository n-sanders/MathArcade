import { rivalForFamily } from '../game/characters';
import { GRAND_PRIX, PRACTICE_ROUNDS_TO_GRADUATE } from '../game/config';
import type { FamilyActivity, Launch } from '../game/types';

export function activityLabel(activity: FamilyActivity, family: number): string {
  switch (activity) {
    case 'practice':
      return 'Practice Laps';
    case 'review':
      return 'Review Round';
    case 'graduation':
      return 'Graduation Check';
    case 'rival':
      return `Race ${rivalForFamily(family).name}`;
  }
}

export function launchTitle(launch: Launch): { title: string; subtitle: string } {
  if (launch.kind === 'grandprix') {
    return {
      title: 'Grand Prix',
      subtitle: `${GRAND_PRIX.targetCorrect} correct in ${GRAND_PRIX.durationMs / 1000} seconds · ×${launch.families.join(', ×')}`,
    };
  }
  const { activity, family } = launch;
  const subtitles: Record<FamilyActivity, string> = {
    practice: `×${family} · practice laps — hope you don’t crash!`,
    review: `×${family} · one review round, then retry the check`,
    graduation: `×${family} · beat the clock with every answer right`,
    rival: `×${family} · first across the line wins`,
  };
  return { title: activityLabel(activity, family), subtitle: subtitles[activity] };
}

export function activityHint(activity: FamilyActivity, practiceRounds: number): string {
  switch (activity) {
    case 'practice':
      return `Practice laps ${practiceRounds}/${PRACTICE_ROUNDS_TO_GRADUATE}`;
    case 'review':
      return 'Review round needed';
    case 'graduation':
      return 'Graduation check ready!';
    case 'rival':
      return '';
  }
}

export function formatTime(ms: number): string {
  const total = Math.max(0, ms) / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
