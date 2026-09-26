import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Terrain } from '@/lib/types';

export const TERRAINS: { key: Terrain; label: string }[] = [
  { key: 'planicie', label: 'Planície' },
  { key: 'planicie-noite', label: 'Planície (noite)' },
  { key: 'deserto', label: 'Deserto' },
  { key: 'deserto-noite', label: 'Deserto (noite)' },
  { key: 'gelo', label: 'Gelo' },
  { key: 'gelo-noite', label: 'Gelo (noite)' },
  { key: 'catacumbas', label: 'Catacumbas' },
  { key: 'floresta', label: 'Floresta' },
  { key: 'floresta-noite', label: 'Floresta (noite)' },
];

const W = 32;
const H = 14;
const HORIZON = 9;

type Palette = {
  sky: [string, string];
  ground: [string, string];
  feature: string;
  featureDark: string;
  accent: string;
};

const PALETTES: Record<Terrain, Palette> = {
  planicie: { sky: ['#5FB4E8', '#9AD4F2'], ground: ['#5BA84A', '#4A9140'], feature: '#3E7F35', featureDark: '#2F6628', accent: '#F7D94C' },
  'planicie-noite': { sky: ['#0E1430', '#1B2448'], ground: ['#2E5A2A', '#264C23'], feature: '#1F4020', featureDark: '#163016', accent: '#EDEBD0' },
  deserto: { sky: ['#F0A860', '#F6CF8A'], ground: ['#E3B563', '#D8A855'], feature: '#C9964A', featureDark: '#4E8A3A', accent: '#FFF1A8' },
  'deserto-noite': { sky: ['#1E1433', '#35264F'], ground: ['#8A6A45', '#7C5E3C'], feature: '#6E5236', featureDark: '#2F4F2A', accent: '#EDEBD0' },
  gelo: { sky: ['#A8D8F0', '#D4EEFA'], ground: ['#F2F8FC', '#DCEBF5'], feature: '#A9D4EC', featureDark: '#7FB6D6', accent: '#FFF6C0' },
  'gelo-noite': { sky: ['#07101F', '#0F1E33'], ground: ['#8FA8C0', '#7F98B0'], feature: '#5E7F9C', featureDark: '#4A6A86', accent: '#4FE0A0' },
  catacumbas: { sky: ['#3B3530', '#2C2724'], ground: ['#4A423B', '#3F3832'], feature: '#1A1614', featureDark: '#6B4A2B', accent: '#F29B38' },
  floresta: { sky: ['#7CC6E6', '#AEDCF0'], ground: ['#4C7A36', '#42702E'], feature: '#3F8A3A', featureDark: '#2F6B2F', accent: '#E86A5A' },
  'floresta-noite': { sky: ['#0A121C', '#101A26'], ground: ['#1E3318', '#182B14'], feature: '#1F4A26', featureDark: '#173A1E', accent: '#E8F07A' },
};

/** Pseudo-aleatório determinístico: o cenário é sempre o mesmo. */
const hash = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

function buildScene(terrain: Terrain): string[][] {
  const p = PALETTES[terrain];
  const night = terrain.endsWith('noite');
  const grid: string[][] = Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) => {
      if (y >= HORIZON) return hash(x, y) < 0.25 ? p.ground[1] : p.ground[0];
      return y < HORIZON / 2 ? p.sky[0] : p.sky[1];
    }),
  );
  const set = (x: number, y: number, color: string) => {
    if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = color;
  };

  if (terrain === 'catacumbas') {
    // Parede de tijolos com arco escuro e duas tochas.
    for (let y = 0; y < HORIZON; y++) {
      for (let x = 0; x < W; x++) {
        const mortar = y % 3 === 2 || (x + (Math.floor(y / 3) % 2) * 3) % 6 === 0;
        grid[y][x] = mortar ? p.sky[1] : hash(x, y) < 0.2 ? '#46403A' : p.sky[0];
      }
    }
    for (let y = 2; y < HORIZON; y++) for (let x = 12; x < 20; x++) if (y > 2 || (x > 12 && x < 19)) set(x, y, p.feature);
    for (const tx of [6, 25]) {
      set(tx, 5, p.featureDark);
      set(tx, 6, p.featureDark);
      set(tx, 4, p.accent);
      set(tx, 3, '#FFD86B');
    }
    for (let x = 0; x < W; x++) if (hash(x, 99) < 0.12) set(x, HORIZON + 1 + Math.floor(hash(x, 7) * 3), '#D8D0C0');
    return grid;
  }

  // Sol ou lua, e estrelas à noite.
  const [cx, cy] = [25, 1];
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) set(cx + dx, cy + dy, night ? '#EDEBD0' : '#FFE066');
  if (night) {
    for (let y = 0; y < HORIZON - 2; y++) for (let x = 0; x < W; x++) if (hash(x, y) < 0.04) set(x, y, '#FFFFFF');
  } else if (!terrain.startsWith('deserto')) {
    for (const [x0, y0] of [[4, 2], [15, 1]]) for (let dx = 0; dx < 4; dx++) set(x0 + dx, y0, '#FFFFFF');
  }

  if (terrain.startsWith('planicie')) {
    for (let x = 0; x < W; x++) {
      const h = Math.round(1 + Math.sin(x / 3.5) * 1.2);
      for (let k = 1; k <= h; k++) set(x, HORIZON - k, p.feature);
    }
    for (const bx of [5, 18, 28]) {
      set(bx, HORIZON, p.featureDark);
      set(bx + 1, HORIZON, p.featureDark);
    }
    for (const fx of [9, 22]) set(fx, HORIZON + 2, p.accent);
  }

  if (terrain.startsWith('deserto')) {
    for (let x = 0; x < W; x++) {
      const h = Math.round(1.5 + Math.sin(x / 4) * 1.5);
      for (let k = 1; k <= h; k++) set(x, HORIZON - k, p.feature);
    }
    for (const cxx of [7, 23]) {
      for (let y = HORIZON - 4; y <= HORIZON; y++) set(cxx, y, p.featureDark);
      set(cxx - 1, HORIZON - 2, p.featureDark);
      set(cxx - 1, HORIZON - 3, p.featureDark);
      set(cxx + 1, HORIZON - 3, p.featureDark);
      set(cxx + 1, HORIZON - 4, p.featureDark);
    }
  }

  if (terrain.startsWith('gelo')) {
    if (night) for (let x = 0; x < W; x++) set(x, 3 + Math.round(Math.sin(x / 3) * 1), p.accent);
    for (const [px, h] of [[3, 4], [10, 6], [17, 3], [24, 5], [30, 4]]) {
      for (let k = 0; k < h; k++) {
        const width = Math.floor((h - k) / 2);
        for (let dx = -width; dx <= width; dx++) set(px + dx, HORIZON - 1 - k, k === h - 1 ? '#FFFFFF' : dx < 0 ? p.featureDark : p.feature);
      }
    }
  }

  if (terrain.startsWith('floresta')) {
    const trunk = night ? '#3A2A1B' : '#6B4A2B';
    for (const tx of [2, 8, 14, 20, 26, 31]) {
      set(tx, HORIZON - 1, trunk);
      set(tx, HORIZON - 2, trunk);
      for (let k = 0; k < 5; k++) {
        const width = k < 2 ? 2 : k < 4 ? 1 : 0;
        for (let dx = -width; dx <= width; dx++) set(tx + dx, HORIZON - 3 - k, dx < 0 || k === 0 ? p.featureDark : p.feature);
      }
    }
    if (night) for (const [fx, fy] of [[5, 7], [12, 10], [18, 6], [24, 11], [29, 8]]) set(fx, fy, p.accent);
  }

  return grid;
}

/** Cenário de batalha em pixel art, desenhado com Views (linhas compactadas por cor). */
export const PixelScene = memo(function PixelScene({ terrain }: { terrain: Terrain }) {
  const rows = useMemo(() => {
    return buildScene(terrain).map((row) => {
      const runs: { color: string; length: number }[] = [];
      for (const color of row) {
        const last = runs[runs.length - 1];
        if (last && last.color === color) last.length += 1;
        else runs.push({ color, length: 1 });
      }
      return runs;
    });
  }, [terrain]);

  return (
    <View style={styles.scene} accessibilityRole="image" accessibilityLabel={TERRAINS.find((t) => t.key === terrain)?.label}>
      {rows.map((runs, y) => (
        <View key={y} style={styles.row}>
          {runs.map((run, i) => (
            <View key={i} style={{ flex: run.length, backgroundColor: run.color }} />
          ))}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  scene: { width: '100%', aspectRatio: W / H, overflow: 'hidden' },
  row: { flex: 1, flexDirection: 'row' },
});
