// Testes das regras de batalha, XP e nível. Rode com: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../.test-build/engine');
const R = require('../.test-build/rules');

const fireball = {
  id: 'fb',
  name: 'Bola de Fogo',
  description: '',
  kind: 'magica',
  cost: 5,
  baseDamage: '8d6',
  status: 'veneno',
  statusChance: 100,
};

const character = (id, name) => ({
  id,
  name,
  age: '20',
  createdAt: 0,
  codexId: 'cx',
  ...R.characterDefaults(),
  abilities: [fireball],
});

const monster = (id, hitPoints, abilities = []) => ({
  id,
  name: id === 'aranha' ? 'Aranha' : 'Lobo',
  hitPoints,
  armor: 12,
  source: 'manual',
  defeated: false,
  loot: [],
  abilities,
});

const bite = {
  id: 'bite',
  name: 'Picada',
  description: '',
  kind: 'fisica',
  cost: 0,
  baseDamage: '1d8',
  status: 'congelamento',
  statusChance: 100,
};

function setup(monsters = [monster('aranha', 30, [bite])]) {
  return {
    characters: [character('a', 'Aria'), character('b', 'Bram')],
    codexes: [
      {
        id: 'cx',
        code: 'ABCDEF',
        name: 'Teste',
        description: '',
        shops: [],
        abilities: [{ id: 'cura', name: 'Cura', description: '', kind: 'magica', cost: 1, baseDamage: '', offeredTo: [] }],
        battles: [],
        levelUps: [],
        createdAt: 0,
        monsters,
      },
    ],
  };
}

/** Aplica uma regra e falha o teste se ela devolver erro. */
function ok(result) {
  if ('error' in result) assert.fail(result.error);
  return result.data;
}

/** Joga a batalha até o fim: o monstro alterna o alvo, Aria usa magia, Bram golpeia. */
function playToVictory(data, battleIndex = 0) {
  const battle = () => data.codexes[0].battles[battleIndex];
  const hp = (id) => data.characters.find((c) => c.id === id).hp;
  for (let turn = 0; turn < 60 && battle().status === 'ativa'; turn++) {
    const current = E.currentTurn(battle());
    if (current === 'monstro') {
      const alive = ['a', 'b'].filter((id) => hp(id) > 0);
      data = ok(E.monsterAction(data, 'cx', battle().id, { abilityId: 'bite', targetId: alive[turn % alive.length], damage: 2 }));
    } else {
      const ability = E.playerAction(data, 'cx', battle().id, current, { kind: 'habilidade', abilityId: 'fb' });
      data = 'error' in ability ? ok(E.playerAction(data, 'cx', battle().id, current, { kind: 'fisico' })) : ability.data;
      data = ok(E.resolveAction(data, 'cx', battle().id, { type: 'dano', amount: current === 'a' ? 9 : 3 }));
    }
  }
  return data;
}

test('iniciativa define a ordem e começa na rodada 1', () => {
  const data = ok(E.startBattle(setup(), 'cx', 'aranha', ['a', 'b'], 'gelo-noite'));
  const battle = data.codexes[0].battles[0];
  assert.equal(battle.round, 1);
  assert.equal(battle.order.length, 3);
  for (let i = 1; i < battle.order.length; i++) {
    assert.ok(battle.initiatives[battle.order[i - 1]] >= battle.initiatives[battle.order[i]], 'ordem decrescente de iniciativa');
  }
  assert.equal(battle.terrain, 'gelo-noite');
});

test('jogador não pode agir fora do seu turno', () => {
  const data = ok(E.startBattle(setup(), 'cx', 'aranha', ['a', 'b'], 'planicie'));
  const battle = data.codexes[0].battles[0];
  const notTurn = ['a', 'b'].find((id) => id !== E.currentTurn(battle));
  assert.ok('error' in E.playerAction(data, 'cx', battle.id, notTurn, { kind: 'fisico' }));
});

test('habilidade mágica gasta mana e é bloqueada sem mana suficiente', () => {
  let data = setup();
  data.characters[0].mana = 3; // Bola de Fogo custa 5
  data = ok(E.startBattle(data, 'cx', 'aranha', ['a'], 'planicie'));
  const battle = () => data.codexes[0].battles[0];
  while (E.currentTurn(battle()) !== 'a') data = ok(E.monsterAction(data, 'cx', battle().id, { damage: 0 }));
  const result = E.playerAction(data, 'cx', battle().id, 'a', { kind: 'habilidade', abilityId: 'fb' });
  assert.equal(result.error, 'Mana insuficiente.');
});

test('batalha completa: vitória, status sorteados e monstro derrotado', () => {
  const data = playToVictory(ok(E.startBattle(setup(), 'cx', 'aranha', ['a', 'b'], 'floresta')));
  const battle = data.codexes[0].battles[0];
  assert.equal(battle.status, 'vitoria');
  assert.equal(battle.monsterHp, 0);
  assert.equal(data.codexes[0].monsters[0].defeated, true);
  const log = battle.log.map((l) => l.text).join('\n');
  assert.match(log, /chance de veneno 100%/, 'sistema sorteia o veneno');
  assert.match(log, /chance de congelamento 100%/, 'sistema sorteia o congelamento');
  assert.match(log, /perde o turno/, 'congelado perde o turno');
});

test('XP proporcional ao dano, sem distribuir duas vezes', () => {
  let data = playToVictory(ok(E.startBattle(setup(), 'cx', 'aranha', ['a', 'b'], 'deserto')));
  const battle = () => data.codexes[0].battles[0];
  data = ok(E.awardXp(data, 'cx', battle().id, 40, 150));
  const [pa, pb] = battle().participants;
  const top = pa.damageDealt >= pb.damageDealt ? pa : pb;
  assert.equal(battle().xpAwarded[top.characterId], 150, 'quem causou mais dano recebe o máximo');
  assert.ok('error' in E.awardXp(data, 'cx', battle().id, 1, 2));
});

test('mortos e quem fugiu recebem o XP mínimo', () => {
  const split = R.splitXp(
    [
      { characterId: 'x', damageDealt: 30, out: false },
      { characterId: 'y', damageDealt: 10, out: false },
      { characterId: 'z', damageDealt: 50, out: true },
    ],
    10,
    100,
  );
  assert.deepEqual(split, { x: 100, y: 40, z: 10 });
});

test('subir de nível cria evento e o Mestre define as recompensas', () => {
  let data = playToVictory(ok(E.startBattle(setup(), 'cx', 'aranha', ['a', 'b'], 'catacumbas')));
  data = ok(E.awardXp(data, 'cx', data.codexes[0].battles[0].id, 120, 150));
  const event = data.codexes[0].levelUps[0];
  assert.ok(event, 'evento de nível criado');
  const hero = () => data.characters.find((c) => c.id === event.characterId);
  const maxHpBefore = hero().maxHp;
  data = ok(
    E.resolveLevelUp(data, 'cx', event.id, {
      maxHp: 5,
      maxMana: 0,
      maxStamina: 0,
      attributes: { [hero().attributes[0].id]: 2 },
      newAttributes: [{ name: 'Carisma', value: 3 }],
      offerAbilityIds: ['cura'],
      note: 'Poder!',
    }),
  );
  assert.equal(hero().maxHp, maxHpBefore + 5);
  assert.ok(hero().attributes.some((a) => a.name === 'Carisma'));
  assert.ok(data.codexes[0].abilities[0].offeredTo.includes(event.characterId), 'habilidade oferecida');
  assert.equal(data.codexes[0].levelUps[0].resolved, true);
});

test('fuga com d20 e encerramento sem vitória', () => {
  let data = ok(E.startBattle(setup([monster('lobo', 10)]), 'cx', 'lobo', ['a'], 'planicie-noite'));
  const battle = () => data.codexes[0].battles[0];
  for (let i = 0; i < 40 && !battle().participants[0].fled; i++) {
    data =
      E.currentTurn(battle()) === 'monstro'
        ? ok(E.monsterAction(data, 'cx', battle().id, { targetId: 'a', damage: 0 }))
        : ok(E.playerAction(data, 'cx', battle().id, 'a', { kind: 'fugir' }));
  }
  assert.equal(battle().participants[0].fled, true);
  data = ok(E.endBattle(data, 'cx', battle().id));
  assert.equal(battle().status, 'encerrada');
});

test('demonstração cria personagens, Codex completo e batalha em andamento', () => {
  const { loadDemo } = require('../.test-build/demo');
  const data = ok(loadDemo({ characters: [], codexes: [] }));
  assert.equal(data.characters.length, 3);
  const codex = data.codexes[0];
  assert.equal(codex.monsters.length, 4);
  assert.equal(codex.shops.length, 3);
  assert.equal(codex.battles[0].status, 'ativa');
  assert.equal(codex.battles[0].terrain, 'floresta-noite');
  assert.ok(codex.abilities.some((a) => a.offeredTo.length > 0), 'há ofertas pendentes');
  assert.equal(codex.levelUps.filter((e) => !e.resolved).length, 1);
  assert.ok(data.characters.every((c) => c.codexId === codex.id));
  // Personagens possuem cópias das habilidades do Codex (mesmo id), para edições do Mestre propagarem.
  assert.ok(data.characters.every((c) => c.abilities.every((a) => codex.abilities.some((x) => x.id === a.id))));
});

test('demonstração não passa do limite de 5 personagens', () => {
  const { loadDemo } = require('../.test-build/demo');
  const full = { characters: [1, 2, 3].map((i) => character(`p${i}`, `P${i}`)), codexes: [] };
  assert.ok('error' in loadDemo(full));
});
