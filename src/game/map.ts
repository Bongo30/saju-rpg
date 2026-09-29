/**
 * 동방 청림 첫 지역 맵 (Kenney Tiny Town 16px 타일 번호).
 * 화면에는 2배로 키워 한 칸 = 32px 로 그린다.
 */
export const TILE = 16;
export const SCALE = 2;
export const CELL = TILE * SCALE;
export const MAP_W = 30;
export const MAP_H = 64;

export const VILLAGE_END = 18;
export const GATE_ROW = 47;
export const WORLD_PX_W = MAP_W * CELL;
export const WORLD_PX_H = MAP_H * CELL;

const GRASS = 0;
const GRASS2 = 1;
const FLOWER = 2;
const DIRT = 25;
const DIRT_VARIANTS = [25, 25, 25, 40, 41, 42];

export const TREE_TILES = [4, 16, 28, 3, 15, 27, 5];
export const FENCE_H = 81;
/** 부딪히는 오브젝트 타일 */
export const SOLID_TILES = new Set([
  4, 16, 28, 3, 15, 27, 5, 44, 45, 46, 80, 81, 82, 56, 58, 59, 47, 71, 83, 104, 94, 57, 106, 107,
  48, 49, 50, 60, 61, 62, 51, 55, 63, 67, 52, 53, 54, 64, 65, 66, 72, 73, 74, 75, 76, 77, 78, 79, 84, 85, 86, 87, 88, 89, 90, 91,
]);

export interface Building {
  id: string;
  label: string;
  col: number;
  row: number;
  tiles: number[][];
}

export const BUILDINGS: Building[] = [
  {
    id: 'chiefHouse',
    label: '촌장 댁',
    col: 12,
    row: 2,
    tiles: [
      [52, 53, 53, 53, 54],
      [64, 65, 65, 65, 66],
      [72, 84, 85, 84, 75],
    ],
  },
  {
    id: 'general',
    label: '잡화점',
    col: 3,
    row: 6,
    tiles: [
      [48, 49, 49, 50],
      [60, 61, 61, 62],
      [72, 85, 73, 84],
    ],
  },
  {
    id: 'weapon',
    label: '대장간',
    col: 23,
    row: 6,
    tiles: [
      [52, 53, 53, 54],
      [64, 65, 65, 66],
      [76, 89, 77, 88],
    ],
  },
  {
    id: 'cloth',
    label: '포목점',
    col: 3,
    row: 12,
    tiles: [
      [48, 49, 49, 50],
      [60, 61, 61, 62],
      [76, 88, 89, 77],
    ],
  },
];

export interface NpcSpot {
  id: string;
  frame: number;
  col: number;
  row: number;
  title?: string;
  shop?: 'general' | 'weapon' | 'cloth';
  wander?: boolean;
}

/** NPC 그림은 Kenney Tiny Dungeon 16px 프레임 번호 */
export const NPCS: NpcSpot[] = [
  { id: 'chief', frame: 111, col: 15, row: 6, title: '새싹마을 촌장' },
  { id: 'grocer', frame: 100, col: 4.5, row: 10, title: '잡화점', shop: 'general' },
  { id: 'smith', frame: 86, col: 24.5, row: 10, title: '무기점', shop: 'weapon' },
  { id: 'tailor', frame: 99, col: 5.5, row: 16, title: '포목점 (옷가게)', shop: 'cloth' },
  { id: 'cheongsol', frame: 112, col: 21, row: 15, title: '떠돌이 검객' },
  { id: 'kid', frame: 85, col: 18, row: 12, title: '마을 아이', wander: true },
  { id: 'guard', frame: 96, col: 11.5, row: 46, title: '숲 입구 수문장' },
];

export const SIGNS: Array<{ col: number; row: number; label: string }> = [
  { col: 7, row: 9, label: '잡화점' },
  { col: 22, row: 9, label: '대장간' },
  { col: 7, row: 15, label: '포목점' },
  { col: 17, row: 5, label: '촌장 댁' },
  { col: 16, row: 19, label: '↓ 들판' },
  { col: 17, row: 46, label: '신단수 숲' },
];

export const PLAYER_SPAWN = { col: 15.5, row: 8.5 };
export const BOSS_SPOT = { col: 15, row: 56.5 };

export interface SpawnPoint {
  species: string;
  col: number;
  row: number;
}

export const SPAWNS: SpawnPoint[] = [
  { species: 'dokkaebi', col: 10, row: 22 },
  { species: 'dokkaebi', col: 19, row: 23 },
  { species: 'dokkaebi', col: 13, row: 26 },
  { species: 'dokkaebi', col: 22, row: 27 },
  { species: 'snake', col: 5, row: 29 },
  { species: 'toad', col: 7, row: 32 },
  { species: 'snake', col: 9, row: 35 },
  { species: 'toad', col: 4, row: 36 },
  { species: 'woodpecker', col: 24, row: 31 },
  { species: 'woodpecker', col: 21, row: 35 },
  { species: 'woodpecker', col: 25, row: 38 },
  { species: 'boar', col: 13, row: 38 },
  { species: 'boar', col: 18, row: 40 },
  { species: 'boar', col: 11, row: 43 },
  { species: 'boar', col: 20, row: 44 },
];

export interface Region {
  name: string;
  fromRow: number;
  toRow: number;
}

export const REGIONS: Region[] = [
  { name: '동방 청림 · 새싹마을', fromRow: 0, toRow: VILLAGE_END },
  { name: '새싹마을 남쪽 들판', fromRow: VILLAGE_END + 1, toRow: GATE_ROW },
  { name: '신단수 숲', fromRow: GATE_ROW + 1, toRow: MAP_H - 1 },
];

export function regionAt(row: number): Region {
  return REGIONS.find((r) => row >= r.fromRow && row <= r.toRow) ?? REGIONS[0];
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export interface MapData {
  ground: number[][];
  objects: number[][];
  /** 숲 입구 문 칸 (봉인이 풀리면 치운다) */
  gateCells: Array<[number, number]>;
}

export function buildMap(): MapData {
  const rand = rng(20260928);
  const ground: number[][] = [];
  const objects: number[][] = [];
  for (let r = 0; r < MAP_H; r++) {
    ground.push(new Array(MAP_W).fill(GRASS));
    objects.push(new Array(MAP_W).fill(-1));
  }
  const setObj = (c: number, r: number, t: number) => {
    if (r >= 0 && r < MAP_H && c >= 0 && c < MAP_W) objects[r][c] = t;
  };
  const isFree = (c: number, r: number) => objects[r]?.[c] === -1 && ground[r]?.[c] !== DIRT;

  // 풀 무늬
  for (let r = 0; r < MAP_H; r++) {
    for (let c = 0; c < MAP_W; c++) {
      const x = rand();
      if (x < 0.18) ground[r][c] = GRASS2;
      else if (x < 0.22 && r < GATE_ROW) ground[r][c] = FLOWER;
    }
  }

  // 길: 마을 가로길, 남북 큰길
  const road = (c: number, r: number) => {
    if (r >= 0 && r < MAP_H && c >= 0 && c < MAP_W) ground[r][c] = DIRT_VARIANTS[Math.floor(rand() * DIRT_VARIANTS.length)];
  };
  for (let r = 5; r <= 58; r++) {
    road(14, r);
    road(15, r);
  }
  for (let c = 3; c <= 27; c++) {
    road(c, 10);
    road(c, 11);
  }
  for (let r = 11; r <= 16; r++) road(8, r);
  for (let c = 4; c <= 8; c++) road(c, 16);
  for (let r = 11; r <= 15; r++) road(21, r);

  // 건물
  for (const b of BUILDINGS) {
    b.tiles.forEach((row, dr) => row.forEach((t, dc) => setObj(b.col + dc, b.row + dr, t)));
  }
  // 소품
  setObj(18, 7, 104); // 우물
  setObj(10, 4, 94); // 벌통
  setObj(27, 13, 57); // 수레
  setObj(19, 14, 106);
  for (const s of SIGNS) setObj(s.col, s.row, 83);

  // 마을 둘레 나무와 울타리
  for (let c = 0; c < MAP_W; c++) {
    setObj(c, 0, TREE_TILES[c % 3]);
  }
  for (let r = 0; r < MAP_H; r++) {
    setObj(0, r, TREE_TILES[r % 3]);
    setObj(MAP_W - 1, r, TREE_TILES[(r + 1) % 3]);
  }
  for (let c = 1; c < MAP_W - 1; c++) {
    if (c >= 13 && c <= 16) continue;
    setObj(c, VILLAGE_END, c === 1 ? 80 : c === MAP_W - 2 ? 82 : c === 12 ? 82 : c === 17 ? 80 : FENCE_H);
  }

  // 들판의 나무 무리
  const clusters: Array<[number, number]> = [
    [4, 21], [24, 22], [8, 25], [27, 26], [3, 33], [25, 29], [22, 33], [27, 36], [6, 40], [24, 42], [3, 45], [9, 30],
  ];
  for (const [cc, cr] of clusters) {
    for (let k = 0; k < 5; k++) {
      const c = cc + Math.floor(rand() * 3) - 1;
      const r = cr + Math.floor(rand() * 3) - 1;
      if (isFree(c, r)) setObj(c, r, TREE_TILES[Math.floor(rand() * 3)]);
    }
  }
  for (let k = 0; k < 40; k++) {
    const c = 1 + Math.floor(rand() * (MAP_W - 2));
    const r = VILLAGE_END + 2 + Math.floor(rand() * (GATE_ROW - VILLAGE_END - 3));
    if (isFree(c, r) && Math.abs(c - 14.5) > 2) setObj(c, r, rand() < 0.5 ? 29 : 17);
  }

  // 숲 입구 울타리와 문
  const gateCells: Array<[number, number]> = [];
  for (let c = 1; c < MAP_W - 1; c++) {
    if (c >= 13 && c <= 16) {
      gateCells.push([c, GATE_ROW]);
      continue;
    }
    setObj(c, GATE_ROW, FENCE_H);
  }

  // 신단수 숲: 빽빽한 나무 사이로 공터
  for (let r = GATE_ROW + 1; r < MAP_H; r++) {
    for (let c = 1; c < MAP_W - 1; c++) {
      const dx = (c - 15) / 7.5;
      const dy = (r - 56) / 6;
      const inClearing = dx * dx + dy * dy < 1;
      const onPath = (c === 14 || c === 15) && r < 53;
      if (!inClearing && !onPath && rand() < 0.62) setObj(c, r, TREE_TILES[Math.floor(rand() * 3)]);
    }
  }
  for (let c = 0; c < MAP_W; c++) setObj(c, MAP_H - 1, TREE_TILES[c % 3]);
  // 보스 자리는 비운다
  for (let r = 54; r <= 59; r++) for (let c = 13; c <= 17; c++) setObj(c, r, -1);

  return { ground, objects, gateCells };
}

/** 미니맵 한 칸의 색 */
export function minimapColor(ground: number, obj: number): string {
  if (obj >= 0) {
    if (TREE_TILES.includes(obj)) return '#2f6b35';
    if ([52, 53, 54, 64, 65, 66].includes(obj)) return '#c0513a';
    if ([48, 49, 50, 60, 61, 62].includes(obj)) return '#5a6a8a';
    if (obj >= 72 && obj <= 91) return '#a2764a';
    if ([44, 45, 46, 80, 81, 82].includes(obj)) return '#8a5a33';
    if (obj === 29 || obj === 17) return '#6fbf5a';
    return '#7a6a55';
  }
  if (DIRT_VARIANTS.includes(ground)) return '#d9a066';
  return '#79c05a';
}
