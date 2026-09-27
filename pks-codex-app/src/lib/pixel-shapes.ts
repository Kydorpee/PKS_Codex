/**
 * Desenhos em pixel art, compartilhados pelo app (PixelIcon) e pelo widget da tela inicial (SVG).
 * Módulo puro: não importa nada de React Native.
 */
import { colors } from './theme';

// O = contorno, F = preenchimento, H = brilho, A = emblema, . = vazio
export const SHAPES = {
  heart: [
    '.OO.OO.', //
    'OHFOFFO',
    'OFFFFFO',
    '.OFFFO.',
    '..OFO..',
    '...O...',
  ],
  drop: [
    '...O...', //
    '..OFO..',
    '.OHFFO.',
    'OHFFFFO',
    'OFFFFFO',
    '.OFFFO.',
    '..OOO..',
  ],
  bolt: [
    '...OOOO', //
    '..OHFO.',
    '.OFFO..',
    'OFFFFFO',
    'OOOFFO.',
    '..OFO..',
    '.OFO...',
    '.OO....',
  ],
  star: [
    '...O...', //
    '..OFO..',
    'OOOHFOO',
    'OFFFFFO',
    '.OFFFO.',
    'OFFOFFO',
    'OOO.OOO',
  ],
  arrow: [
    '...O....', //
    '..OFO...',
    '.OFFOOOO',
    'OFFHFFFO',
    '.OFFOOOO',
    '..OFO...',
    '...O....',
  ],
  shield: [
    'OOOOOOO', //
    'OHFAFFO',
    'OFAAAFO',
    'OFFAFFO',
    'OFFAFFO',
    '.OFFFO.',
    '..OFO..',
    '...O...',
  ],
  sword: [
    '...O...', //
    '..OHO..',
    '..OFO..',
    '..OFO..',
    '..OFO..',
    '.AAAAA.',
    '...O...',
    '...O...',
    '..AAA..',
  ],
  staff: [
    '..OOO..', //
    '.OHAAO.',
    '.OAAAO.',
    '..OFO..',
    '..OFO..',
    '..OFO..',
    '..OFO..',
    '..OFO..',
    '...O...',
  ],
  explosion: [
    'O..O..O', //
    '.OOFOO.',
    '.OFAFO.',
    'OFAHAFO',
    '.OFAFO.',
    '.OOFOO.',
    'O..O..O',
  ],
  /** Elmo de cavaleiro: botão "Personagem" da tela inicial. */
  helmet: [
    '...OOOOO...', //
    '..OHHFFFO..',
    '.OHFFFFFFO.',
    '.OFFFFFFFO.',
    '.OAAAAAAAO.',
    '.OFOOOOOFO.',
    '.OFFFFFFFO.',
    '.OFFFOFFFO.',
    '..OFFOFFO..',
    '...OOOOO...',
  ],
  /** Coroa: botão "Mestre" da tela inicial. */
  crown: [
    'O....O....O', //
    'OO..OAO..OO',
    'OFO.OFO.OFO',
    'OFFOFFFOFFO',
    'OHFFFFFFFFO',
    'OFAFFAFFAFO',
    'OFFFFFFFFFO',
    'OOOOOOOOOOO',
  ],
  coin: [
    '..OOO..', //
    '.OFFFO.',
    'OFHAAFO',
    'OFAOAFO',
    'OFAAAFO',
    '.OFFFO.',
    '..OOO..',
  ],
};

export type PixelShape = keyof typeof SHAPES;

export const PIXEL_SHAPES = Object.keys(SHAPES) as PixelShape[];

const EMPTY = '#9A948A';

export type PixelColors = { color: string; accent?: string };

/**
 * Cor de cada pixel (null = transparente). O ícone esvazia de baixo para cima conforme `pct`
 * e só fica totalmente vazio quando `pct` chega a zero.
 */
export function pixelGrid(shape: PixelShape, pct: number, { color, accent = colors.gold }: PixelColors): (string | null)[][] {
  const rows = SHAPES[shape];
  const fillRows = rows.map((row, y) => (/[FHA]/.test(row) ? y : -1)).filter((y) => y >= 0);
  const filledCount = pct <= 0 ? 0 : Math.max(1, Math.round(pct * fillRows.length));
  const firstFilled = fillRows[fillRows.length - filledCount] ?? Infinity;

  return rows.map((row, y) =>
    row.split('').map((cell) => {
      const full = y >= firstFilled;
      switch (cell) {
        case 'O':
          return colors.text;
        case 'H':
          return full ? '#FFFFFF' : EMPTY;
        case 'F':
          return full ? color : EMPTY;
        case 'A':
          return full ? accent : EMPTY;
        default:
          return null;
      }
    }),
  );
}

/** O mesmo desenho como SVG (usado no widget, que não renderiza Views). */
export function pixelSvg(shape: PixelShape, pct: number, palette: PixelColors, pixel = 4): string {
  const grid = pixelGrid(shape, pct, palette);
  const width = grid[0].length * pixel;
  const height = grid.length * pixel;
  const rects = grid
    .flatMap((row, y) =>
      row.map((fill, x) => (fill ? `<rect x="${x * pixel}" y="${y * pixel}" width="${pixel}" height="${pixel}" fill="${fill}"/>` : '')),
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${rects}</svg>`;
}
