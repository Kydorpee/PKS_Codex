// Testes dos desenhos em pixel art (usados no app e no widget da tela inicial).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PIXEL_SHAPES, SHAPES, pixelGrid, pixelSvg } = require('../.test-build/pixel-shapes');

const filled = (grid, color) => grid.flat().filter((c) => c === color).length;

test('todos os desenhos são retangulares e só usam células conhecidas', () => {
  for (const shape of PIXEL_SHAPES) {
    const rows = SHAPES[shape];
    assert.ok(rows.every((r) => r.length === rows[0].length), `${shape}: linhas do mesmo tamanho`);
    assert.ok(rows.every((r) => /^[OFHA.]+$/.test(r)), `${shape}: só O, F, H, A e .`);
  }
});

test('o ícone esvazia de baixo para cima e só fica vazio em zero', () => {
  const full = filled(pixelGrid('heart', 1, { color: '#ff0000' }), '#ff0000');
  const half = filled(pixelGrid('heart', 0.5, { color: '#ff0000' }), '#ff0000');
  const tiny = filled(pixelGrid('heart', 0.01, { color: '#ff0000' }), '#ff0000');
  const none = filled(pixelGrid('heart', 0, { color: '#ff0000' }), '#ff0000');
  assert.ok(full > half && half > tiny && tiny > 0, `cheio ${full} > metade ${half} > quase vazio ${tiny} > 0`);
  assert.equal(none, 0);
  // A última linha preenchida (a de baixo) continua colorida com pouca vida.
  const grid = pixelGrid('heart', 0.01, { color: '#ff0000' });
  const lastFillRow = SHAPES.heart.map((r, y) => (r.includes('F') ? y : -1)).filter((y) => y >= 0).pop();
  assert.ok(grid[lastFillRow].includes('#ff0000'));
});

test('SVG tem o tamanho certo e um retângulo por pixel visível', () => {
  const svg = pixelSvg('coin', 1, { color: '#C99A2E', accent: '#F2D46B' }, 4);
  const rows = SHAPES.coin;
  assert.match(svg, new RegExp(`width="${rows[0].length * 4}" height="${rows.length * 4}"`));
  const visible = rows.join('').replace(/\./g, '').length;
  assert.equal((svg.match(/<rect /g) || []).length, visible);
  assert.match(svg, /#F2D46B/, 'usa a cor do emblema');
});
