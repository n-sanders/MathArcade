export type EngineShape = 'round' | 'wedge' | 'split' | 'finned' | 'twin';
export type CockpitShape = 'pod' | 'dart' | 'disc' | 'tub';

export interface PodDesign {
  primary: string;
  secondary: string;
  canopy: string;
  binder: string;
  flame: string;
  engineShape: EngineShape;
  /** Engine length in pod units (roughly 36–58). */
  engineLength: number;
  /** Engine diameter in pod units (roughly 8–13). */
  engineWidth: number;
  cockpit: CockpitShape;
}

export type HeadShape = 'round' | 'long' | 'wide' | 'pointed';
export type HeadFeature = 'horns' | 'ears' | 'tendrils' | 'crest' | 'antennae' | 'tusks' | 'fins' | 'none';
export type Gear = 'goggles' | 'helmet' | 'visor' | 'none';

export interface PortraitDesign {
  kind: 'alien' | 'droid';
  skin: string;
  skinShade: string;
  head: HeadShape;
  eyes: 1 | 2 | 3 | 4;
  eyeColor: string;
  feature: HeadFeature;
  gear: Gear;
  gearColor: string;
  suit: string;
  backdrop: string;
}

export type LineKey =
  | 'intro'
  | 'playerMiss'
  | 'rivalAhead'
  | 'playerAhead'
  | 'finalStretch'
  | 'rivalWins'
  | 'playerWins'
  | 'playerCrash'
  | 'streak'
  | 'lowHull'
  | 'failed'
  | 'timeout'
  | 'checkIntro';

export type Lines = Partial<Record<LineKey, string[]>>;

export interface Character {
  id: string;
  name: string;
  title: string;
  species: string;
  blurb: string;
  portrait: PortraitDesign;
  lines: Lines;
}

export interface Rival extends Character {
  family: number;
  pod: PodDesign;
}

const RIVAL_FALLBACK_LINES: Lines = {
  playerCrash: ['Ha! Better call your pit crew.', 'Smoke and sparks! That one’s mine.'],
  timeout: ['Clock’s run dry, rookie.'],
  rivalWins: ['Better luck next heat!'],
  playerWins: ['Grr... next time, rookie.'],
};

export const RIVALS: readonly Rival[] = [
  {
    id: 'zib-varrow',
    family: 2,
    name: 'Zib Varrow',
    title: 'The Scrap Comet',
    species: 'Kessari tinkerer',
    blurb: 'Builds a new pod out of junk every season. Counts everything in pairs.',
    portrait: {
      kind: 'alien',
      skin: '#9fc27a',
      skinShade: '#6f9550',
      head: 'round',
      eyes: 2,
      eyeColor: '#ffd23f',
      feature: 'ears',
      gear: 'goggles',
      gearColor: '#c4672d',
      suit: '#5a4632',
      backdrop: '#2f6b6b',
    },
    pod: {
      primary: '#d9732f',
      secondary: '#2a9d8f',
      canopy: '#a8f0ff',
      binder: '#7ff3ff',
      flame: '#ffb347',
      engineShape: 'round',
      engineLength: 38,
      engineWidth: 10,
      cockpit: 'tub',
    },
    lines: {
      intro: ['Two by two, I’ll leave you in my dust!', 'Hope your pod holds together better than mine!'],
      playerMiss: ['Whoops! Even my junk pod knows that one.', 'Count by twos, rookie!'],
      rivalAhead: ['See ya at the finish!', 'My bolts are rattling with joy!'],
      playerAhead: ['Hey! Who tuned your engines?', 'Not fair, I lost a bolt back there!'],
      finalStretch: ['Finish line’s close, I can smell the fuel!'],
      rivalWins: ['Scrap Comet wins again!'],
      playerWins: ['Okay, okay... you’re fast. Rematch?'],
    },
  },
  {
    id: 'ognar-tull',
    family: 3,
    name: 'Ognar Tull',
    title: 'The Grinding Boulder',
    species: 'Grath brute',
    blurb: 'Huge, slow to start, impossible to push around. Thinks in threes.',
    portrait: {
      kind: 'alien',
      skin: '#8a9a7b',
      skinShade: '#5f6e52',
      head: 'wide',
      eyes: 2,
      eyeColor: '#ff7b39',
      feature: 'tusks',
      gear: 'helmet',
      gearColor: '#c9a227',
      suit: '#3c3a2e',
      backdrop: '#5a4a2a',
    },
    pod: {
      primary: '#3f5e3a',
      secondary: '#e3b23c',
      canopy: '#ffe9a8',
      binder: '#ffd166',
      flame: '#ff7f3f',
      engineShape: 'wedge',
      engineLength: 44,
      engineWidth: 13,
      cockpit: 'tub',
    },
    lines: {
      intro: ['Ognar crush the course. Three, six, NINE!', 'Little pod. Big Ognar.'],
      playerMiss: ['Hrrm. Wrong. Ognar laugh.', 'Ognar knows threes. You?'],
      rivalAhead: ['Boulder rolls on!', 'Ognar in front. Ognar happy.'],
      playerAhead: ['Hrrk! Too quick!', 'Ognar... will catch up. Slowly.'],
      finalStretch: ['Almost there. Ognar smash finish line.'],
      rivalWins: ['OGNAR WINS! Ognar get snack.'],
      playerWins: ['You... strong at threes. Ognar respect.'],
    },
  },
  {
    id: 'pellix-durn',
    family: 4,
    name: 'Pellix Durn',
    title: 'Four-Eyed Flash',
    species: 'Quadrinn scout',
    blurb: 'Four eyes, four engines’ worth of speed, and four excuses for every loss.',
    portrait: {
      kind: 'alien',
      skin: '#6fa8dc',
      skinShade: '#4a7fb0',
      head: 'long',
      eyes: 4,
      eyeColor: '#f6f7d7',
      feature: 'antennae',
      gear: 'none',
      gearColor: '#ffffff',
      suit: '#24324a',
      backdrop: '#3d2c5c',
    },
    pod: {
      primary: '#e8eef5',
      secondary: '#3a7bd5',
      canopy: '#9ad1ff',
      binder: '#b3e5ff',
      flame: '#7fb7ff',
      engineShape: 'twin',
      engineLength: 46,
      engineWidth: 11,
      cockpit: 'pod',
    },
    lines: {
      intro: ['I see every turn four times. You see one.', 'Four, eight, twelve — gone!'],
      playerMiss: ['All four of my eyes saw that mistake.', 'Tsk. Four times wrong.'],
      rivalAhead: ['Watching you shrink in my mirrors!', 'Quadruple lead!'],
      playerAhead: ['Impossible! I checked four times!', 'Must be a glare on my eyes...'],
      finalStretch: ['I can see the flag — all four of them!'],
      rivalWins: ['Four-Eyed Flash takes it!'],
      playerWins: ['My antennae must be bent. Again!'],
    },
  },
  {
    id: 'vasha-krell',
    family: 5,
    name: 'Vasha Krell',
    title: 'Queen of the Canyon',
    species: 'Sirellan noble',
    blurb: 'Graceful, precise, and very, very proud. Never misses a five.',
    portrait: {
      kind: 'alien',
      skin: '#b48ad9',
      skinShade: '#8a60b5',
      head: 'pointed',
      eyes: 2,
      eyeColor: '#7fffd4',
      feature: 'crest',
      gear: 'visor',
      gearColor: '#ffd700',
      suit: '#4b2a63',
      backdrop: '#6b2f4a',
    },
    pod: {
      primary: '#6a3d9a',
      secondary: '#f2c14e',
      canopy: '#ffd6f6',
      binder: '#ff9cf1',
      flame: '#ffcf5c',
      engineShape: 'finned',
      engineLength: 50,
      engineWidth: 10,
      cockpit: 'dart',
    },
    lines: {
      intro: ['Fives are elegant, darling. Like me.', 'Try to keep up. Or don’t.'],
      playerMiss: ['How clumsy.', 'A queen never misses a five.'],
      rivalAhead: ['The canyon bows to me.', 'Enjoy the view of my exhaust.'],
      playerAhead: ['How dare you pass a queen!', 'Hmph. A lucky gust.'],
      finalStretch: ['My crown awaits at the finish.'],
      rivalWins: ['As expected. Royalty wins.'],
      playerWins: ['...Fine. You may have this one.'],
    },
  },
  {
    id: 'gorrum-thade',
    family: 6,
    name: 'Gorrum Thade',
    title: 'The Iron Hauler',
    species: 'Draxian freighter jockey',
    blurb: 'Used to haul cargo. Now hauls trophies. His engines look like barrels.',
    portrait: {
      kind: 'alien',
      skin: '#c96a5b',
      skinShade: '#9a4a3e',
      head: 'wide',
      eyes: 2,
      eyeColor: '#fff3b0',
      feature: 'horns',
      gear: 'goggles',
      gearColor: '#555b66',
      suit: '#2e2e33',
      backdrop: '#4a3b2a',
    },
    pod: {
      primary: '#8c2f2f',
      secondary: '#cfcfcf',
      canopy: '#ffd8a8',
      binder: '#ffa94d',
      flame: '#ff6b3d',
      engineShape: 'split',
      engineLength: 48,
      engineWidth: 12,
      cockpit: 'tub',
    },
    lines: {
      intro: ['Six barrels of thrust, rookie.', 'I’ve hauled heavier loads than you.'],
      playerMiss: ['Dropped your cargo there.', 'Sixes are heavy, huh?'],
      rivalAhead: ['Hauling ahead!', 'Iron Hauler leads the convoy.'],
      playerAhead: ['Hey! No passing on the hauler lane!', 'Burned my brakes on that one.'],
      finalStretch: ['Delivery’s almost done!'],
      rivalWins: ['Package delivered: one trophy.'],
      playerWins: ['You out-hauled the Hauler. Huh.'],
    },
  },
  {
    id: 'skeeto-malvane',
    family: 7,
    name: 'Skeeto Malvane',
    title: 'Lucky Seven',
    species: 'Twi-tendriled Ryxx',
    blurb: 'Swears sevens are lucky. Swears a lot of things, actually.',
    portrait: {
      kind: 'alien',
      skin: '#5fbf77',
      skinShade: '#3e9455',
      head: 'round',
      eyes: 3,
      eyeColor: '#ffef5a',
      feature: 'tendrils',
      gear: 'visor',
      gearColor: '#ff5fa2',
      suit: '#2b3d2f',
      backdrop: '#20475a',
    },
    pod: {
      primary: '#2bb673',
      secondary: '#1b1b3a',
      canopy: '#d1ffe0',
      binder: '#9bff8a',
      flame: '#c6ff6b',
      engineShape: 'round',
      engineLength: 54,
      engineWidth: 9,
      cockpit: 'pod',
    },
    lines: {
      intro: ['Sevens are lucky — for ME!', 'Seven, fourteen, twenty-one... bye!'],
      playerMiss: ['Ooh, unlucky!', 'Sevens bite back, huh?'],
      rivalAhead: ['Luck’s on my side!', 'Seven laps of luck!'],
      playerAhead: ['My luck ran out?!', 'Who stole my lucky charm?'],
      finalStretch: ['Lucky finish incoming!'],
      rivalWins: ['Told you. Lucky Seven!'],
      playerWins: ['That wasn’t luck... that was skill. Ugh.'],
    },
  },
  {
    id: 'ixa-venthrook',
    family: 8,
    name: 'Ixa Venthrook',
    title: 'Octo-Spark',
    species: 'Mon-Thalan engineer',
    blurb: 'Rewires her pod mid-race. The sparks are part of the charm.',
    portrait: {
      kind: 'alien',
      skin: '#4fc3c7',
      skinShade: '#2f969a',
      head: 'round',
      eyes: 2,
      eyeColor: '#ffffff',
      feature: 'fins',
      gear: 'helmet',
      gearColor: '#ff8c42',
      suit: '#1f3b4d',
      backdrop: '#2b2b55',
    },
    pod: {
      primary: '#1f8a9e',
      secondary: '#ff8c42',
      canopy: '#ffe3c2',
      binder: '#5ef2ff',
      flame: '#66d9ff',
      engineShape: 'finned',
      engineLength: 44,
      engineWidth: 11,
      cockpit: 'disc',
    },
    lines: {
      intro: ['Eight circuits charged. Let’s spark!', 'Hope you like the smell of ozone.'],
      playerMiss: ['Short circuit!', 'Bzzt! Wrong wire.'],
      rivalAhead: ['Overclocked and out front!', 'Sparks flying — from my exhaust!'],
      playerAhead: ['My coupling must be loose!', 'Rerouting power... hang on!'],
      finalStretch: ['Full charge to the finish!'],
      rivalWins: ['Octo-Spark, fully charged champion!'],
      playerWins: ['You out-wired me. Impressive.'],
    },
  },
  {
    id: 'baron-dhuul',
    family: 9,
    name: 'Baron Dhuul',
    title: 'The Ninth Shadow',
    species: 'Nightborn Varrak',
    blurb: 'Races at dusk in a pod black as a moonless sky. Rarely smiles.',
    portrait: {
      kind: 'alien',
      skin: '#6b6f80',
      skinShade: '#474a58',
      head: 'long',
      eyes: 2,
      eyeColor: '#ff3b3b',
      feature: 'crest',
      gear: 'goggles',
      gearColor: '#2a2a2a',
      suit: '#151515',
      backdrop: '#3a1d1d',
    },
    pod: {
      primary: '#22222a',
      secondary: '#c0392b',
      canopy: '#ff9f9f',
      binder: '#ff4d4d',
      flame: '#ff5733',
      engineShape: 'wedge',
      engineLength: 56,
      engineWidth: 10,
      cockpit: 'dart',
    },
    lines: {
      intro: ['Nines hide in the shadows. So do I.', 'You will not see me pass you.'],
      playerMiss: ['The shadows saw that.', 'Darkness takes another point.'],
      rivalAhead: ['Lost in my shadow.', 'Silence. Then speed.'],
      playerAhead: ['...Interesting.', 'You found the light. For now.'],
      finalStretch: ['Night falls on the finish line.'],
      rivalWins: ['The Shadow claims the flag.'],
      playerWins: ['You... have earned the Baron’s attention.'],
    },
  },
  {
    id: 'rheddo-kai',
    family: 10,
    name: 'Rheddo Kai',
    title: 'Double-Zero',
    species: 'Bothrin showboat',
    blurb: 'Loves crowds, loves cameras, loves anything ending in zero.',
    portrait: {
      kind: 'alien',
      skin: '#e9c46a',
      skinShade: '#c49a3c',
      head: 'round',
      eyes: 2,
      eyeColor: '#264653',
      feature: 'ears',
      gear: 'helmet',
      gearColor: '#e63946',
      suit: '#1d3557',
      backdrop: '#7a3e1d',
    },
    pod: {
      primary: '#e63946',
      secondary: '#f1faee',
      canopy: '#a8dadc',
      binder: '#ffe66d',
      flame: '#ffd166',
      engineShape: 'round',
      engineLength: 42,
      engineWidth: 12,
      cockpit: 'disc',
    },
    lines: {
      intro: ['Ten! Twenty! Thirty! The crowd loves me!', 'Smile for the holo-cams, rookie!'],
      playerMiss: ['Just add a zero, friend!', 'Ooh, the crowd groaned at that one.'],
      rivalAhead: ['Wave to my fans!', 'Perfect ten!'],
      playerAhead: ['Hey, you’re blocking my good side!', 'The cameras were on ME!'],
      finalStretch: ['Cue the fireworks!'],
      rivalWins: ['Double-Zero, number one!'],
      playerWins: ['Fine, YOU get the autographs today.'],
    },
  },
  {
    id: 'quill-sarrabok',
    family: 11,
    name: 'Quill Sarrabok',
    title: 'The Needle',
    species: 'Tessarine pilot',
    blurb: 'Threads gaps nobody else can fit through. Very thin pod, very long engines.',
    portrait: {
      kind: 'alien',
      skin: '#f28fb3',
      skinShade: '#c96489',
      head: 'pointed',
      eyes: 2,
      eyeColor: '#2b2d42',
      feature: 'antennae',
      gear: 'visor',
      gearColor: '#00d2ff',
      suit: '#3a1f3d',
      backdrop: '#1f4d3a',
    },
    pod: {
      primary: '#f7f7f7',
      secondary: '#d6336c',
      canopy: '#ffd1e3',
      binder: '#ff8fc7',
      flame: '#ff9ecf',
      engineShape: 'split',
      engineLength: 58,
      engineWidth: 8,
      cockpit: 'dart',
    },
    lines: {
      intro: ['Elevens look like twins. So do my engines.', 'I fit through gaps you can’t even see.'],
      playerMiss: ['Missed the gap!', 'So close... and so wrong.'],
      rivalAhead: ['Threaded the needle!', 'Slipped right past you.'],
      playerAhead: ['How did you fit through there?!', 'My stitches are coming loose!'],
      finalStretch: ['One last gap to thread!'],
      rivalWins: ['The Needle pierces the finish!'],
      playerWins: ['You threaded it better. Hmph.'],
    },
  },
  {
    id: 'maxxa-zor',
    family: 12,
    name: 'Maxxa Zor',
    title: 'The Undying Champion',
    species: 'Ancient Zoravani',
    blurb: 'Has won the dozen-lap classic more times than anyone remembers. Hard to impress.',
    portrait: {
      kind: 'alien',
      skin: '#d4a373',
      skinShade: '#a97c50',
      head: 'wide',
      eyes: 3,
      eyeColor: '#80ffdb',
      feature: 'horns',
      gear: 'none',
      gearColor: '#ffd700',
      suit: '#5c3d1e',
      backdrop: '#2d1f4a',
    },
    pod: {
      primary: '#d4af37',
      secondary: '#f8f4e3',
      canopy: '#ffffff',
      binder: '#fff3a3',
      flame: '#fff07a',
      engineShape: 'finned',
      engineLength: 52,
      engineWidth: 13,
      cockpit: 'pod',
    },
    lines: {
      intro: ['A dozen titles. Make it thirteen.', 'Twelve is the champion’s number, youngling.'],
      playerMiss: ['A champion would not miss that.', 'Patience. Learn your twelves.'],
      rivalAhead: ['As it has always been.', 'The champion leads.'],
      playerAhead: ['Ah. A worthy challenger at last.', 'You remind me of myself, long ago.'],
      finalStretch: ['The finish line remembers my name.'],
      rivalWins: ['The Undying Champion endures.'],
      playerWins: ['A new champion rises... for today.'],
    },
  },
].map((r) => ({ ...r, lines: { ...RIVAL_FALLBACK_LINES, ...r.lines } }) as Rival);

export const PIT_BOSS: Character = {
  id: 'gizz-9',
  name: 'Gizz-9',
  title: 'Pit Droid Crew Chief',
  species: 'Pit droid',
  blurb: 'Keeps your pod in one piece during practice laps.',
  portrait: {
    kind: 'droid',
    skin: '#c9b79c',
    skinShade: '#8f7f68',
    head: 'round',
    eyes: 2,
    eyeColor: '#66e0ff',
    feature: 'antennae',
    gear: 'none',
    gearColor: '#e8893a',
    suit: '#6b5a45',
    backdrop: '#2f4a5a',
  },
  lines: {
    intro: [
      'Practice laps! Find the answer on the chart and tap it.',
      'Easy on the throttle. Skip-count along the chart!',
      'No rivals today — just you and the track. Don’t crash!',
    ],
    playerMiss: [
      'Easy! Count along the chart from the start.',
      'Ouch, that scraped the hull! Look at the glowing box.',
      'The line in the middle is ×5 — start from there!',
    ],
    streak: ['Smooth flying!', 'Hull’s patching up nicely!', 'That’s the rhythm, keep it up!'],
    lowHull: ['Hull is smoking! Slow down and count carefully.', 'One more scrape and we crash! Careful!'],
    playerWins: ['Practice laps complete! Nice flying.', 'Pod’s still in one piece. Great work!'],
    playerCrash: ['Crash! Don’t worry — I’ll bolt it back together.', 'Kaboom! Let’s patch up and try again.'],
    failed: ['So close! One review round and you can try again.'],
    timeout: ['Out of time! Review round, then try again.'],
    checkIntro: [
      'Graduation check! Every answer right before the clock runs out.',
      'This is the big one. Steady hands — no mistakes!',
    ],
  },
};

export const PLAYER_POD: PodDesign = {
  primary: '#e8893a',
  secondary: '#f2e3c6',
  canopy: '#9ef0ff',
  binder: '#66e0ff',
  flame: '#7fd8ff',
  engineShape: 'round',
  engineLength: 46,
  engineWidth: 11,
  cockpit: 'pod',
};

export function rivalForFamily(family: number): Rival {
  const rival = RIVALS.find((r) => r.family === family);
  if (!rival) throw new Error(`No rival for family ${family}`);
  return rival;
}

export function rivalById(id: string): Rival {
  const rival = RIVALS.find((r) => r.id === id);
  if (!rival) throw new Error(`No rival with id ${id}`);
  return rival;
}
