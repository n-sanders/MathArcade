import { FAMILIES } from './config';
import type { Launch, Rank, Rng } from './types';

export interface TrackLayout {
  rank: Rank;
  name: string;
  /** Closed SVG path in an 800×340 viewBox, kept below the 34px sky band. Length 0 is the start/finish line. */
  path: string;
}

export type SceneryId = 'desert' | 'ice' | 'jungle' | 'volcanic';

export interface Scenery {
  id: SceneryId;
  name: string;
  sky: [string, string];
  ground: [string, string];
  trackEdge: string;
  trackSurface: string;
  trackInner: string;
  centerLine: string;
}

export interface Track {
  id: string;
  name: string;
  layout: TrackLayout;
  scenery: Scenery;
}

export const LAYOUTS: Record<Rank, TrackLayout> = {
  C: {
    rank: 'C',
    name: 'Oval',
    path: 'M 140 180 C 140 90 260 70 400 70 C 540 70 660 90 660 180 C 660 270 540 290 400 290 C 260 290 140 270 140 180 Z',
  },
  B: {
    rank: 'B',
    name: 'Hairpin',
    path: 'M 120 180 C 110 80 240 60 380 66 C 520 72 690 60 700 150 C 710 230 640 262 580 250 C 520 238 520 160 470 160 C 420 160 430 270 330 284 C 220 298 128 270 120 180 Z',
  },
  A: {
    rank: 'A',
    name: 'Chicanes',
    path: 'M 100 190 C 90 90 170 60 240 90 C 300 116 330 60 400 60 C 470 60 500 116 560 90 C 630 60 710 90 700 190 C 692 270 630 300 560 270 C 500 244 470 300 400 300 C 330 300 300 244 240 270 C 170 300 108 270 100 190 Z',
  },
  S: {
    rank: 'S',
    name: 'Figure-Eight',
    path: 'M 90 185 C 100 330 320 290 400 185 C 480 80 700 40 710 185 C 700 330 480 290 400 185 C 320 80 100 40 90 185 Z',
  },
};

export const SCENERIES: readonly Scenery[] = [
  {
    id: 'desert',
    name: 'Kessari Canyon',
    sky: ['#2b1d3a', '#e0794a'],
    ground: ['#e3a35f', '#b86f38'],
    trackEdge: '#5b3a22',
    trackSurface: '#c98d55',
    trackInner: '#dcaa72',
    centerLine: '#f6e2c0',
  },
  {
    id: 'ice',
    name: 'Frostspire',
    sky: ['#0e1a3a', '#7fb4e0'],
    ground: ['#e6f0f8', '#a9c4dc'],
    trackEdge: '#3f5874',
    trackSurface: '#8fabc8',
    trackInner: '#a9c2da',
    centerLine: '#f4fbff',
  },
  {
    id: 'jungle',
    name: 'Verdant Wilds',
    sky: ['#10261c', '#6fae6a'],
    ground: ['#4f8a3c', '#2f5e26'],
    trackEdge: '#2a1e12',
    trackSurface: '#8a6a42',
    trackInner: '#a5835a',
    centerLine: '#f1e3c2',
  },
  {
    id: 'volcanic',
    name: 'Cinder Peaks',
    sky: ['#1a0a0a', '#c0392b'],
    ground: ['#3b2a2a', '#1f1515'],
    trackEdge: '#120a08',
    trackSurface: '#5a4640',
    trackInner: '#776058',
    centerLine: '#ffb36b',
  },
];

/** Families share scenery in groups of three: 2–4, 5–7, 8–10, 11–12. */
export function sceneryForFamily(family: number): Scenery {
  const index = Math.max(0, FAMILIES.indexOf(family));
  return SCENERIES[Math.min(SCENERIES.length - 1, Math.floor(index / 3))];
}

export function trackFor(launch: Launch, rank: Rank, rng: Rng = Math.random): Track {
  if (launch.kind === 'grandprix') {
    const layout = LAYOUTS.S;
    const scenery = SCENERIES[Math.floor(rng() * SCENERIES.length) % SCENERIES.length];
    return { id: `${scenery.id}-gp`, name: `${scenery.name} Grand Prix`, layout, scenery };
  }
  const layout = LAYOUTS[rank];
  const scenery = sceneryForFamily(launch.family);
  return { id: `${scenery.id}-${layout.rank}`, name: `${scenery.name} ${layout.name}`, layout, scenery };
}
