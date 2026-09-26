// Testes da sincronização com o Firestore (quais documentos gravar). Rode com: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../.test-build/sync');

const hero = (id, patch = {}) => ({ id, name: id, createdAt: 0, gold: 100, ...patch });
const codex = (id, patch = {}) => ({ id, name: id, createdAt: 0, members: [], ...patch });

test('ordem das chaves e campos undefined não contam como mudança', () => {
  assert.equal(S.stableStringify({ b: 1, a: { d: 2, c: undefined } }), S.stableStringify({ a: { d: 2 }, b: 1 }));
  assert.ok(S.sameDoc(hero('a', { codexId: undefined }), hero('a')));
});

test('diff aponta só os documentos criados, alterados e apagados', () => {
  const before = { characters: [hero('a'), hero('b')], codexes: [codex('x'), codex('y')] };
  const after = { characters: [hero('a'), hero('b', { gold: 90 }), hero('c')], codexes: [codex('x')] };
  const changes = S.diffData(before, after).map((c) => `${c.kind}/${c.id}/${c.value ? 'set' : 'del'}`);
  assert.deepEqual(changes.sort(), ['characters/b/set', 'characters/c/set', 'codexes/y/del']);
});

test('sem mudanças, nada é gravado', () => {
  const data = { characters: [hero('a')], codexes: [codex('x')] };
  assert.deepEqual(S.diffData(data, JSON.parse(JSON.stringify(data))), []);
});

test('replaceDoc troca ou remove um documento', () => {
  const data = { characters: [hero('a')], codexes: [] };
  assert.equal(S.replaceDoc(data, 'characters', 'a', hero('a', { gold: 5 })).characters[0].gold, 5);
  assert.equal(S.replaceDoc(data, 'characters', 'a', null).characters.length, 0);
});

test('withOwner só preenche o dono de documentos novos', () => {
  assert.equal(S.withOwner(hero('a'), 'eu').ownerUid, 'eu');
  assert.equal(S.withOwner(hero('a', { ownerUid: 'outro' }), 'eu').ownerUid, 'outro');
});
