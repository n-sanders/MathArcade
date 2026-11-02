import type { Rank, RoundMode } from '../game/types';

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function roundTitle(rank: Rank, mode: RoundMode): string {
  return mode === 'test' ? `Rank ${rank} Rank-up Test` : `Rank ${rank} Round`;
}

export const RANK_BLURBS: Record<Rank, string> = {
  C: 'Pure doubles, 1 + 1 to 10 + 10',
  B: 'Doubles and near doubles, one apart (6 + 7)',
  A: 'Doubles and near doubles, one or two apart (6 + 8)',
  S: 'The full mix against a 6-second timer',
};
