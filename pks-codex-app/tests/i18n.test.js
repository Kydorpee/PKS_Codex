// Testes da tradução (português → inglês). Rode com: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I = require('../.test-build/i18n-core');
const { EN } = require('../.test-build/i18n-en');
const E = require('../.test-build/engine');
const R = require('../.test-build/rules');

/** Todas as chaves usadas no app: t('...') e tNow('...'). */
function appKeys() {
  const keys = new Set();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) {
        const src = fs.readFileSync(full, 'utf8');
        for (const m of src.matchAll(/\b(?:t|tNow)\(\s*'((?:[^'\\]|\\.)*)'/g)) keys.add(m[1]);
      }
    }
  };
  walk(path.join(__dirname, '..', 'src'));
  return keys;
}

test('todo texto do app tem tradução para inglês', () => {
  const missing = [...appKeys()].filter((k) => !(k in EN));
  assert.deepEqual(missing, [], `sem tradução: ${missing.join(' | ')}`);
});

test('português devolve o texto como está; inglês troca e mantém os parâmetros', () => {
  assert.equal(I.translate('pt', 'Vez de {name}', { name: 'Aria' }), 'Vez de Aria');
  assert.equal(I.translate('en', 'Vez de {name}', { name: 'Aria' }), "Aria's turn");
  assert.equal(I.translate('en', 'Seu turno!'), 'Your turn!');
  // Valores que são textos do sistema também são traduzidos.
  assert.equal(I.translate('en', '{pool} atual', { pool: 'Estamina' }), 'Current Stamina');
});

test('mensagens montadas pelo motor são reconhecidas pelo modelo', () => {
  const en = (s) => I.translateText('en', s);
  assert.equal(en('💥 Bola de Fogo de Aria causa 9 de dano em Aranha.'), "💥 Aria's Bola de Fogo deals 9 damage to Aranha.");
  assert.equal(en('💥 Golpe físico de Lia (demo) causa 3 de dano em Goblin.'), "💥 Lia (demo)'s Physical strike deals 3 damage to Goblin.");
  assert.equal(en('O valor de um d6 vai de 1 a 6.'), 'A d6 value goes from 1 to 6.');
  assert.equal(en('Estamina insuficiente.'), 'Not enough Stamina.');
  assert.equal(en('🚫 A fuga de Lia falhou: sofre 3 de dano e fica envenenado.'), "🚫 Lia's escape failed: takes 3 damage and is poisoned.");
  assert.equal(en('Vida máx. +5'), 'Max Health +5');
  assert.equal(en('Aria'), 'Aria', 'nomes ficam como estão');
  assert.equal(I.translateText('pt', 'Seu turno!'), 'Seu turno!');
});

test('toda linha do registro de uma batalha completa é traduzida', () => {
  const loot = [{ id: 'p', name: 'Poção', quantity: 1, description: '' }];
  const bite = { id: 'bite', name: 'Picada', description: '', kind: 'fisica', cost: 0, baseDamage: '1d8', status: 'veneno', statusChance: 100 };
  const fireball = { id: 'fb', name: 'Bola de Fogo', description: '', kind: 'magica', cost: 1, baseDamage: '8d6', status: 'queimadura', statusChance: 100 };
  const hero = (id, name) => ({ id, name, age: '20', createdAt: 0, codexId: 'cx', ...R.characterDefaults(), abilities: [fireball], inventory: [{ id: 'i', name: 'Poção de cura', quantity: 2, description: '' }] });
  let data = {
    characters: [hero('a', 'Aria'), hero('b', 'Bram')],
    codexes: [{ id: 'cx', code: 'X', name: 'T', description: '', shops: [], abilities: [], classes: [], mounts: [], battles: [], levelUps: [], createdAt: 0, members: [],
      monsters: [
        { id: 'aranha', name: 'Aranha', hitPoints: 12, armor: 10, source: 'manual', defeated: false, loot, abilities: [bite] },
        { id: 'lobo', name: 'Lobo', hitPoints: 5, armor: 10, source: 'manual', defeated: false, loot: [], abilities: [] },
      ] }],
  };
  const ok = (r) => ('error' in r ? assert.fail(r.error) : r.data);
  data = ok(E.startBattle(data, 'cx', ['aranha', 'lobo'], ['a', 'b'], 'mar'));
  const battle = () => data.codexes[0].battles[0];
  const roll = (value) => ({ sides: 20, value });
  data = ok(E.rollBattleDie(data, 'cx', battle().id, 20, 'Mestre'));
  for (let step = 0; step < 400 && battle().status === 'ativa'; step++) {
    const turn = E.currentTurn(battle());
    const foe = E.foeOf(battle(), turn);
    if (foe) {
      const target = ['a', 'b'].find((id) => data.characters.find((c) => c.id === id).hp > 0 && !battle().participants.find((p) => p.characterId === id).fled);
      data = ok(E.monsterAction(data, 'cx', battle().id, target ? { abilityId: foe.monsterId === 'aranha' ? 'bite' : undefined, targetId: target, roll: roll(9), damage: 0 } : { damage: 0 }));
      continue;
    }
    const kind = step % 7;
    if (kind === 0) data = ok(E.playerAction(data, 'cx', battle().id, turn, { kind: 'defender', roll: roll(12) }));
    else if (kind === 1) data = ok(E.playerAction(data, 'cx', battle().id, turn, { kind: 'observar', targetId: E.aliveFoes(battle())[0].monsterId }));
    else if (kind === 2) {
      data = ok(E.playerAction(data, 'cx', battle().id, turn, { kind: 'fugir', roll: roll(3) }));
      data = ok(E.resolveFlee(data, 'cx', battle().id, { accepted: false, damage: 1, status: 'atordoamento' }));
    } else if (kind === 3 && data.characters.find((c) => c.id === turn).inventory.length > 0) {
      data = ok(E.playerAction(data, 'cx', battle().id, turn, { kind: 'item', itemId: data.characters.find((c) => c.id === turn).inventory[0].id }));
      data = ok(E.resolveAction(data, 'cx', battle().id, { type: 'cura', amount: 2, targetIds: [turn] }));
    } else if (kind === 4) {
      data = ok(E.playerAction(data, 'cx', battle().id, turn, { kind: 'fisico', roll: roll(2), targetId: E.aliveFoes(battle())[0].monsterId }));
    } else {
      data = ok(E.playerAction(data, 'cx', battle().id, turn, { kind: 'habilidade', abilityId: 'fb', roll: roll(18), targetId: E.aliveFoes(battle())[0].monsterId }));
      data = ok(E.resolveAction(data, 'cx', battle().id, { type: 'dano', amount: 4 }));
    }
  }
  // Levantar, pular turno, espólios e XP também geram registro.
  if (battle().status === 'vitoria') {
    if (battle().loot) data = ok(E.passLoot(data, 'cx', battle().id));
    data = ok(E.awardXp(data, 'cx', battle().id, 10, 200));
  }
  assert.ok(battle().log.length > 20, 'a batalha gerou registro suficiente');

  const untranslated = battle().log.map((l) => l.text).filter((text) => I.translateText('en', text) === text);
  assert.deepEqual(untranslated, [], `sem tradução no registro:\n${untranslated.join('\n')}`);
});
