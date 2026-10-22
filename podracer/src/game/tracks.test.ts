import { describe, expect, it } from 'vitest';
import { LAYOUTS, SCENERIES, sceneryForFamily, trackFor } from './tracks';
import { RANK_ORDER } from './types';

const practice = (family: number) => ({ kind: 'family' as const, activity: 'practice' as const, family });

describe('track layouts', () => {
  it('gives each rank its own layout', () => {
    const paths = RANK_ORDER.map((rank) => trackFor(practice(4), rank).layout.path);
    expect(new Set(paths).size).toBe(RANK_ORDER.length);
    for (const rank of RANK_ORDER) expect(trackFor(practice(4), rank).layout).toBe(LAYOUTS[rank]);
  });
});

describe('scenery', () => {
  it('groups families in threes', () => {
    expect(sceneryForFamily(2)).toBe(sceneryForFamily(3));
    expect(sceneryForFamily(3)).toBe(sceneryForFamily(4));
    expect(sceneryForFamily(5)).not.toBe(sceneryForFamily(4));
    expect(sceneryForFamily(11)).toBe(sceneryForFamily(12));
    expect(sceneryForFamily(12)).toBe(SCENERIES[3]);
    expect(new Set([2, 5, 8, 11].map(sceneryForFamily)).size).toBe(4);
  });
});

describe('grand prix track', () => {
  const gp = { kind: 'grandprix' as const, families: [2, 3, 4, 5] };

  it('always uses the S layout', () => {
    for (const rank of RANK_ORDER) expect(trackFor(gp, rank, () => 0.5).layout).toBe(LAYOUTS.S);
  });

  it('picks scenery from the rng', () => {
    expect(trackFor(gp, 'S', () => 0).scenery).toBe(SCENERIES[0]);
    expect(trackFor(gp, 'S', () => 0.99).scenery).toBe(SCENERIES[3]);
  });
});
