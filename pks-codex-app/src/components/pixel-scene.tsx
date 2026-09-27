import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';
import type { Terrain } from '@/lib/types';
import { useT } from '@/lib/i18n';

/** Lugares do cenário; cada um tem versão de dia e (quase todos) de noite. */
export const PLACES: { key: string; label: string; emoji: string; night: boolean }[] = [
  { key: 'planicie', label: 'Planície', emoji: '🌾', night: true },
  { key: 'floresta', label: 'Floresta', emoji: '🌲', night: true },
  { key: 'deserto', label: 'Deserto', emoji: '🏜️', night: true },
  { key: 'gelo', label: 'Gelo', emoji: '❄️', night: true },
  { key: 'mar', label: 'Mar', emoji: '🌊', night: true },
  { key: 'catacumbas', label: 'Catacumbas', emoji: '💀', night: false },
];

export const TERRAINS: { key: Terrain; label: string }[] = PLACES.flatMap((p) => [
  { key: p.key as Terrain, label: p.label },
  ...(p.night ? [{ key: `${p.key}-noite` as Terrain, label: `${p.label} (noite)` }] : []),
]);

const W = 64;
const H = 28;
const HORIZON = 17;

type Grid = string[][];

/** Pseudo-aleatório determinístico: o cenário é sempre o mesmo. */
const hash = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

/** Mistura duas cores hex (t = 0 → a, t = 1 → b). */
function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

function makeGrid(fill: string): Grid {
  return Array.from({ length: H }, () => Array.from({ length: W }, () => fill));
}

function painter(grid: Grid) {
  const set = (x: number, y: number, color: string) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = color;
  };
  const rect = (x0: number, y0: number, w: number, h: number, color: string) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, color);
  };
  const disc = (cx: number, cy: number, r: number, color: string) => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) set(cx + x, cy + y, color);
  };
  return { set, rect, disc };
}

/** Céu em faixas de cor, com uma linha pontilhada entre elas (degradê em pixel art). */
function sky(grid: Grid, top: string, bottom: string, rows = HORIZON) {
  const bands = 5;
  const bandOf = (y: number) => Math.min(bands - 1, Math.floor((y / rows) * bands));
  for (let y = 0; y < rows; y++) {
    const band = bandOf(y);
    const next = bandOf(y + 1);
    for (let x = 0; x < W; x++) {
      // Última linha da faixa: xadrez com a cor da próxima.
      const b = next !== band && (x + y) % 2 === 0 ? next : band;
      grid[y][x] = mix(top, bottom, b / (bands - 1));
    }
  }
}

/** Silhueta de morros: altura por coluna a partir de senos. */
function ridge(grid: Grid, base: number, amp: number, freq: number, phase: number, color: string, top?: string) {
  const { set } = painter(grid);
  for (let x = 0; x < W; x++) {
    const h = Math.round(amp * (0.6 * Math.sin(x * freq + phase) + 0.4 * Math.sin(x * freq * 2.3 + phase * 1.7)) + amp);
    for (let y = base - h; y <= base; y++) set(x, y, y === base - h && top ? top : color);
  }
}

function stars(grid: Grid, rows: number) {
  const { set } = painter(grid);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < W; x++) {
      const r = hash(x, y);
      if (r < 0.025) set(x, y, '#FFFFFF');
      else if (r < 0.04) set(x, y, '#9FB4E8');
    }
}

function sun(grid: Grid, cx: number, cy: number) {
  const { disc } = painter(grid);
  disc(cx, cy, 5, mix('#FFE066', grid[cy][cx], 0.55));
  disc(cx, cy, 4, '#FFE88A');
  disc(cx, cy, 3, '#FFF3B8');
}

function moon(grid: Grid, cx: number, cy: number, shadow: string) {
  const { disc, set } = painter(grid);
  disc(cx, cy, 4, mix('#EDEBD0', shadow, 0.75));
  disc(cx, cy, 3, '#EDEBD0');
  disc(cx + 2, cy - 1, 2, shadow);
  set(cx - 1, cy + 1, '#C9C6A8');
  set(cx - 2, cy - 1, '#C9C6A8');
}

function cloud(grid: Grid, x0: number, y0: number, size: number) {
  const { rect } = painter(grid);
  rect(x0 + 1, y0, size - 2, 1, '#FFFFFF');
  rect(x0, y0 + 1, size, 1, '#FFFFFF');
  rect(x0 + 2, y0 - 1, Math.max(2, size - 6), 1, '#FFFFFF');
  rect(x0 + 1, y0 + 2, size - 2, 1, '#DDEBF5');
}

/** Chão com duas cores e um pouco de textura. */
function ground(grid: Grid, from: number, a: string, b: string, speck: string, density = 0.08) {
  for (let y = from; y < H; y++)
    for (let x = 0; x < W; x++) {
      const t = (y - from) / (H - from);
      const r = hash(x, y);
      grid[y][x] = r < density ? speck : t > 0.5 ? b : a;
    }
}

function tree(grid: Grid, x: number, baseY: number, height: number, leaf: string, leafDark: string, trunk: string) {
  const { set } = painter(grid);
  set(x, baseY, trunk);
  set(x, baseY - 1, trunk);
  for (let k = 0; k < height; k++) {
    const w = Math.floor((height - k) / 2) + (k % 3 === 0 ? 1 : 0);
    for (let dx = -w; dx <= w; dx++) set(x + dx, baseY - 2 - k, dx < 0 || (k % 3 === 0 && dx === w) ? leafDark : leaf);
  }
}

function plains(grid: Grid, night: boolean) {
  const { set } = painter(grid);
  sky(grid, night ? '#0A1030' : '#3F9BE0', night ? '#26315E' : '#B6E2F7');
  if (night) {
    stars(grid, HORIZON - 5);
    moon(grid, 50, 5, '#1A2248');
  } else {
    sun(grid, 51, 5);
    cloud(grid, 6, 4, 10);
    cloud(grid, 28, 2, 8);
  }
  ground(grid, HORIZON, night ? '#1F4421' : '#5BAE45', night ? '#193A1B' : '#4C9A3B', night ? '#2D5A2E' : '#7CCB5F');
  ridge(grid, HORIZON, 3, 0.09, 1, night ? '#24452E' : '#7FB86A');
  ridge(grid, HORIZON + 1, 2, 0.16, 4, night ? '#1C3A1E' : '#4F9A3E', night ? '#2A5230' : '#6CC056');
  // Caminho de terra.
  for (let y = HORIZON + 2; y < H; y++) {
    const cx = 30 + Math.round((y - HORIZON) * 0.8 + Math.sin(y) * 1);
    const w = 1 + Math.floor((y - HORIZON) / 3);
    for (let dx = -w; dx <= w; dx++) set(cx + dx, y, night ? '#4E3E2A' : '#C8A36A');
  }
  const flowers = night ? ['#EDEBD0', '#B8C4F0'] : ['#F7D94C', '#F08BB0', '#FFFFFF'];
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(hash(i, 3) * W);
    const y = HORIZON + 3 + Math.floor(hash(i, 5) * (H - HORIZON - 4));
    if (Math.abs(x - 34) < 5) continue;
    set(x, y, flowers[i % flowers.length]);
    set(x, y + 1, night ? '#163016' : '#3E7F35');
  }
}

function forest(grid: Grid, night: boolean) {
  const { set } = painter(grid);
  sky(grid, night ? '#050B14' : '#6EC0E6', night ? '#142234' : '#CDEBF7');
  if (night) {
    stars(grid, 8);
    moon(grid, 12, 4, '#081220');
  } else {
    sun(grid, 12, 4);
    cloud(grid, 38, 3, 9);
  }
  // Camada de trás (mais clara, mistura com o céu) e da frente.
  ground(grid, HORIZON, night ? '#1A2E15' : '#467A32', night ? '#142511' : '#3C6B2A', night ? '#23401D' : '#5A9A3F', 0.1);
  const farLeaf = night ? '#12301C' : '#5E9E6A';
  for (let x = 1; x < W; x += 5) tree(grid, x, HORIZON, 6 + Math.floor(hash(x, 1) * 3), farLeaf, night ? '#0E2616' : '#4E8A5A', farLeaf);
  const trunk = night ? '#3A2A1B' : '#6B4A2B';
  for (const [x, h] of [[4, 10], [15, 12], [27, 9], [40, 11], [52, 13], [61, 9]] as const) {
    tree(grid, x, HORIZON + 3, h, night ? '#1F4A26' : '#2F8A3A', night ? '#173A1E' : '#1F6B2F', trunk);
  }
  // Arbustos e cogumelos.
  for (const bx of [9, 22, 34, 47, 57]) {
    for (let dx = -2; dx <= 2; dx++) set(bx + dx, H - 3, night ? '#1B3F20' : '#3A9A44');
    for (let dx = -1; dx <= 1; dx++) set(bx + dx, H - 4, night ? '#1B3F20' : '#3A9A44');
  }
  for (const mx of [19, 44]) {
    set(mx, H - 2, '#EDE3CF');
    set(mx, H - 3, '#D9483B');
    set(mx - 1, H - 3, '#D9483B');
    set(mx + 1, H - 3, '#D9483B');
  }
  if (night) for (let i = 0; i < 12; i++) set(Math.floor(hash(i, 8) * W), 8 + Math.floor(hash(i, 9) * 16), i % 2 ? '#E8F07A' : '#C8F05A');
}

function desert(grid: Grid, night: boolean) {
  const { set } = painter(grid);
  sky(grid, night ? '#140C28' : '#E8884A', night ? '#3E2A58' : '#F9D98E');
  if (night) {
    stars(grid, HORIZON - 4);
    moon(grid, 48, 5, '#1C1236');
  } else {
    sun(grid, 48, 6);
  }
  // Pirâmide distante.
  const pyr = night ? '#3A2C3E' : '#D7A060';
  for (let k = 0; k < 7; k++) for (let dx = -k; dx <= k; dx++) set(16 + dx, HORIZON - 7 + k, dx < 0 ? pyr : mix(pyr, '#000000', 0.18));
  ground(grid, HORIZON, night ? '#7C5E3C' : '#E0AE5E', night ? '#6E5236' : '#D29E50', night ? '#8E6E4A' : '#F2CB82', 0.06);
  ridge(grid, HORIZON, 3, 0.07, 2, night ? '#6A5040' : '#E6B566', night ? '#8A6A50' : '#F4D08A');
  ridge(grid, HORIZON + 3, 2, 0.12, 0.5, night ? '#7A5E42' : '#DDA656', night ? '#9A7A58' : '#F0C678');
  const cactus = night ? '#2F4F2A' : '#3E8A3A';
  const cactusLight = night ? '#3E6436' : '#5DB054';
  for (const cx of [8, 40, 57]) {
    for (let y = H - 11; y <= H - 3; y++) {
      set(cx, y, cactus);
      set(cx + 1, y, cactusLight);
    }
    for (let y = H - 8; y <= H - 6; y++) set(cx - 2, y, cactus);
    set(cx - 1, H - 6, cactus);
    for (let y = H - 10; y <= H - 7; y++) set(cx + 3, y, cactusLight);
    set(cx + 2, H - 7, cactusLight);
  }
  for (const [x, y] of [[26, H - 3], [48, H - 5]] as const) {
    set(x, y, night ? '#6A6A6A' : '#A8A098');
    set(x + 1, y, night ? '#5A5A5A' : '#8E867E');
  }
}

function ice(grid: Grid, night: boolean) {
  const { set } = painter(grid);
  sky(grid, night ? '#040A18' : '#86C6EC', night ? '#10203A' : '#E0F2FC');
  if (night) {
    stars(grid, HORIZON - 3);
    // Aurora em duas cores.
    for (let x = 0; x < W; x++) {
      const y = 4 + Math.round(Math.sin(x / 6) * 2 + Math.sin(x / 2.5) * 0.6);
      set(x, y, '#4FE0A0');
      set(x, y + 1, x % 2 ? '#2FA07A' : '#4FE0A0');
      if (x % 3 === 0) set(x, y - 1, '#8A7AF0');
    }
  } else {
    sun(grid, 10, 4);
    cloud(grid, 40, 3, 11);
  }
  for (const [px, h] of [[6, 9], [20, 13], [34, 8], [46, 12], [60, 10]] as const) {
    for (let k = 0; k < h; k++) {
      const w = Math.floor((h - k) * 0.8);
      for (let dx = -w; dx <= w; dx++) {
        const snow = k >= h - 3 || (k >= h - 5 && hash(px + dx, k) < 0.5);
        set(px + dx, HORIZON - k, snow ? (dx < 0 ? '#DDEBF5' : '#FFFFFF') : dx < 0 ? (night ? '#3E5A76' : '#6F9DC0') : night ? '#56789A' : '#94BEDC');
      }
    }
  }
  ground(grid, HORIZON + 1, night ? '#8FA8C0' : '#EEF6FC', night ? '#7F98B0' : '#D6E8F4', night ? '#A8C0D8' : '#FFFFFF', 0.07);
  // Rachaduras e brilho no gelo.
  for (let x = 6; x < 22; x++) set(x, HORIZON + 5 + Math.round(Math.sin(x / 2)), night ? '#6A86A2' : '#A9D4EC');
  for (let x = 38; x < 56; x++) set(x, H - 4 + Math.round(Math.sin(x / 3)), night ? '#6A86A2' : '#A9D4EC');
  for (const [x, y] of [[30, HORIZON + 3], [50, HORIZON + 6], [12, H - 3]] as const) {
    set(x, y, '#FFFFFF');
    set(x - 1, y, night ? '#BFD8F0' : '#E6F4FF');
    set(x + 1, y, night ? '#BFD8F0' : '#E6F4FF');
  }
}

function sea(grid: Grid, night: boolean) {
  const { set, rect } = painter(grid);
  const seaTop = HORIZON - 3;
  sky(grid, night ? '#060C22' : '#4AA6E8', night ? '#1E2E5A' : '#BFE6FA', seaTop);
  if (night) {
    stars(grid, seaTop - 3);
    moon(grid, 44, 4, '#0A1430');
  } else {
    sun(grid, 44, 5);
    cloud(grid, 6, 3, 10);
    cloud(grid, 24, 5, 7);
  }
  // Mar: faixas cada vez mais escuras, cristas de onda e reflexo do sol/lua.
  const deep = night ? '#0C1C3E' : '#1E6FB0';
  const shallow = night ? '#16305E' : '#3C9AD8';
  const beach = HORIZON + 5;
  for (let y = seaTop; y < beach; y++) {
    const t = (y - seaTop) / (beach - seaTop);
    for (let x = 0; x < W; x++) grid[y][x] = mix(shallow, deep, t < 0.5 ? 0 : 1);
    for (let x = 0; x < W; x++) if ((x + y * 5) % 11 === 0) for (let k = 0; k < 3; k++) set(x + k, y, night ? '#3A5A90' : '#8FD0F4');
  }
  for (let y = seaTop; y < beach; y++) {
    const w = 1 + Math.floor((y - seaTop) / 2);
    for (let dx = -w; dx <= w; dx++) if ((dx + y) % 2 === 0) set(44 + dx, y, night ? '#C8C6A8' : '#FFF3B8');
  }
  // Ilha com coqueiro e um barco ao longe.
  rect(10, seaTop - 1, 9, 1, night ? '#5A4A30' : '#E8CF8A');
  rect(12, seaTop - 2, 5, 1, night ? '#5A4A30' : '#E8CF8A');
  for (let k = 0; k < 5; k++) set(14 + (k > 2 ? 1 : 0), seaTop - 3 - k, night ? '#3A2A1B' : '#8A6A3A');
  for (const [dx, dy] of [[-3, 1], [-2, 0], [-1, 0], [1, 0], [2, 0], [3, 1], [0, -1], [-1, 1], [1, 1]] as const) {
    set(15 + dx, seaTop - 8 + dy, night ? '#1F4020' : '#3E9A3E');
  }
  const sail = night ? '#B8B4A0' : '#FFFFFF';
  rect(30, seaTop + 1, 6, 1, night ? '#2A1E14' : '#6B4A2B');
  rect(31, seaTop + 2, 4, 1, night ? '#2A1E14' : '#6B4A2B');
  for (let k = 0; k < 4; k++) for (let dx = 0; dx <= 3 - k; dx++) set(33 + dx - 1, seaTop - k, sail);
  // Espuma e praia.
  for (let x = 0; x < W; x++) {
    const foam = beach + Math.round(Math.sin(x / 3) * 0.8);
    set(x, foam, '#FFFFFF');
    if (x % 2) set(x, foam - 1, night ? '#5A7AB0' : '#BFE6FA');
    for (let y = foam + 1; y < H; y++) grid[y][x] = hash(x, y) < 0.08 ? (night ? '#6E6048' : '#F4DCA0') : night ? '#5E5038' : '#E8C880';
  }
  for (const [x, y] of [[8, H - 2], [26, H - 3], [52, H - 2]] as const) {
    set(x, y, '#F2A0A0');
    set(x + 1, y, '#E88A8A');
  }
  set(40, H - 3, '#E86A3A');
  set(39, H - 2, '#E86A3A');
  set(41, H - 2, '#E86A3A');
}

function catacombs(grid: Grid) {
  const { set, rect } = painter(grid);
  // Parede de tijolos com sombra.
  for (let y = 0; y < HORIZON + 2; y++)
    for (let x = 0; x < W; x++) {
      const row = Math.floor(y / 3);
      const mortar = y % 3 === 2 || (x + (row % 2) * 4) % 8 === 0;
      const shade = hash(Math.floor((x + (row % 2) * 4) / 8), row);
      grid[y][x] = mortar ? '#221E1B' : shade < 0.3 ? '#4A423B' : shade < 0.7 ? '#3F3832' : '#554C44';
      if (!mortar && y % 3 === 0 && hash(x, y) < 0.4) grid[y][x] = mix(grid[y][x], '#FFFFFF', 0.08);
    }
  // Arco escuro com degradê.
  for (let y = 3; y < HORIZON + 2; y++)
    for (let x = 22; x < 42; x++) {
      const dx = (x - 31.5) / 10;
      const dy = (y - 10) / 7;
      if (y >= 10 || dx * dx + dy * dy <= 1) grid[y][x] = mix('#0A0808', '#1E1916', Math.max(0, 1 - Math.abs(dx) * 1.2) * 0.6);
    }
  for (let x = 21; x < 43; x += 1) if (x === 21 || x === 42) for (let y = 10; y < HORIZON + 2; y++) set(x, y, '#6B6258');
  // Tochas com brilho.
  for (const tx of [10, 53]) {
    for (let y = 6; y < 13; y++) for (let x = tx - 4; x <= tx + 4; x++) grid[y][x] = mix(grid[y][x], '#F29B38', 0.14);
    rect(tx, 9, 1, 4, '#6B4A2B');
    rect(tx - 1, 9, 3, 1, '#4A3220');
    set(tx, 8, '#F25C1E');
    set(tx - 1, 7, '#F29B38');
    set(tx, 7, '#FFD86B');
    set(tx + 1, 7, '#F29B38');
    set(tx, 6, '#FFD86B');
    set(tx, 5, '#FFF3B8');
  }
  // Chão de lajotas com ossos e caveira.
  for (let y = HORIZON + 2; y < H; y++)
    for (let x = 0; x < W; x++) {
      const seam = (y - HORIZON) % 4 === 0 || (x + ((y - HORIZON) >> 2) * 5) % 10 === 0;
      grid[y][x] = seam ? '#2A2420' : hash(x >> 2, y >> 2) < 0.5 ? '#4A423B' : '#433B35';
    }
  for (const [x, y] of [[8, H - 4], [48, H - 3]] as const) {
    rect(x, y, 4, 1, '#D8D0C0');
    set(x - 1, y - 1, '#D8D0C0');
    set(x + 4, y + 1, '#D8D0C0');
  }
  rect(56, H - 6, 3, 2, '#E6DECE');
  set(56, H - 6, '#1A1614');
  set(58, H - 6, '#1A1614');
  rect(57, H - 4, 1, 1, '#E6DECE');
}

function buildScene(terrain: Terrain): Grid {
  const grid = makeGrid('#000000');
  const night = terrain.endsWith('noite');
  const place = terrain.replace('-noite', '');
  if (place === 'planicie') plains(grid, night);
  else if (place === 'floresta') forest(grid, night);
  else if (place === 'deserto') desert(grid, night);
  else if (place === 'gelo') ice(grid, night);
  else if (place === 'mar') sea(grid, night);
  else catacombs(grid);
  return grid;
}

/**
 * Cenário de batalha em pixel art, desenhado com Views (linhas compactadas por cor).
 * `thumb` desenha na metade da resolução, para miniaturas leves.
 */
export const PixelScene = memo(function PixelScene({ terrain, thumb }: { terrain: Terrain; thumb?: boolean }) {
  const rows = useMemo(() => {
    const grid = buildScene(terrain);
    const sampled = thumb ? grid.filter((_, y) => y % 2 === 0).map((row) => row.filter((_, x) => x % 2 === 0)) : grid;
    return sampled.map((row) => {
      const runs: { color: string; length: number }[] = [];
      for (const color of row) {
        const last = runs[runs.length - 1];
        if (last && last.color === color) last.length += 1;
        else runs.push({ color, length: 1 });
      }
      return runs;
    });
  }, [terrain, thumb]);

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

/** Escolha do cenário: miniaturas de cada lugar e um botão Dia/Noite. */
export function TerrainPicker({ value, onChange }: { value: Terrain; onChange: (t: Terrain) => void }) {
  const { t } = useT();
  const night = value.endsWith('noite');
  const place = value.replace('-noite', '');
  const pick = (key: string, wantNight: boolean) => {
    const p = PLACES.find((x) => x.key === key)!;
    onChange((wantNight && p.night ? `${key}-noite` : key) as Terrain);
  };
  const hasNight = PLACES.find((p) => p.key === place)?.night ?? false;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.dayNight}>
        {[false, true].map((n) => (
          <Pressable
            key={String(n)}
            accessibilityRole="radio"
            accessibilityState={{ selected: night === n, disabled: n && !hasNight }}
            disabled={n && !hasNight}
            onPress={() => pick(place, n)}
            style={[styles.dayNightButton, night === n && styles.dayNightActive, n && !hasNight && { opacity: 0.4 }]}
          >
            <Text style={styles.dayNightText}>{n ? `🌙 ${t('Noite')}` : `☀️ ${t('Dia')}`}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.grid}>
        {PLACES.map((p) => {
          const active = p.key === place;
          return (
            <Pressable
              key={p.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(p.label)}
              onPress={() => pick(p.key, night)}
              style={[styles.cell, active && styles.cellActive]}
            >
              <PixelScene terrain={(night && p.night ? `${p.key}-noite` : p.key) as Terrain} thumb />
              <Text style={styles.cellLabel} numberOfLines={1}>
                {p.emoji} {t(p.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { width: '100%', aspectRatio: W / H, overflow: 'hidden' },
  row: { flex: 1, flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: {
    width: '31%',
    flexGrow: 1,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  cellActive: { borderColor: colors.gold, borderWidth: 3 },
  cellLabel: { color: colors.text, fontSize: 12, fontWeight: '700', textAlign: 'center', paddingVertical: 4 },
  dayNight: { flexDirection: 'row', gap: spacing.sm },
  dayNightButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  dayNightActive: { backgroundColor: colors.gold, borderColor: colors.goldDim },
  dayNightText: { color: colors.text, fontWeight: '700' },
});
