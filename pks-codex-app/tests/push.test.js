// Testes de quando a Cloud Function manda push. Rode com: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { codexEvents } = require('../functions/events');

const battle = (patch = {}) => ({
  id: 'b1',
  monsterId: 'm1',
  status: 'ativa',
  order: ['a', 'monstro', 'b'],
  turnIndex: 0,
  round: 1,
  ...patch,
});
const codex = (patch = {}) => ({ monsters: [{ id: 'm1', name: 'Aranha' }], battles: [], levelUps: [], ...patch });

test('avisa quando o turno passa e quando a batalha começa', () => {
  assert.deepEqual(codexEvents(codex(), codex({ battles: [battle()] })).map((e) => e.actor), ['a']);
  const events = codexEvents(codex({ battles: [battle()] }), codex({ battles: [battle({ turnIndex: 1 })] }));
  assert.equal(events.length, 1);
  assert.equal(events[0].actor, 'monstro');
  assert.equal(events[0].monsterName, 'Aranha');
});

test('não avisa se o turno não mudou ou a batalha acabou', () => {
  const same = codex({ battles: [battle({ log: [1] })] });
  assert.equal(codexEvents(codex({ battles: [battle()] }), same).length, 0);
  assert.equal(codexEvents(codex({ battles: [battle()] }), codex({ battles: [battle({ status: 'vitoria', turnIndex: 1 })] })).length, 0);
});

test('avisa o Mestre da subida de nível, agrupando várias de uma vez', () => {
  const ev = (id, characterId, level) => ({ id, characterId, level, resolved: false, rewards: [] });
  const before = codex({ levelUps: [ev('old', 'a', 2)] });
  const after = codex({ levelUps: [ev('old', 'a', 2), ev('e1', 'a', 3), ev('e2', 'a', 4), ev('e3', 'b', 2)] });
  const events = codexEvents(before, after);
  assert.deepEqual(events, [
    { kind: 'nivel', characterId: 'a', level: 4, count: 2, eventId: 'e1' },
    { kind: 'nivel', characterId: 'b', level: 2, count: 1, eventId: 'e3' },
  ]);
  assert.equal(codexEvents(after, after).length, 0);
});

test('Codex apagado não gera aviso', () => {
  assert.deepEqual(codexEvents(codex({ battles: [battle()] }), undefined), []);
});
