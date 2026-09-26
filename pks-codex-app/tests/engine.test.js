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
      data = ok(E.monsterAction(data, 'cx', battle().id, { abilityId: 'bite', targetId: alive[turn % alive.length], dice: 12, damage: 2 }));
    } else {
      const ability = E.playerAction(data, 'cx', battle().id, current, { kind: 'habilidade', abilityId: 'fb', dice: 10 });
      data = 'error' in ability ? ok(E.playerAction(data, 'cx', battle().id, current, { kind: 'fisico', dice: 10 })) : ability.data;
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
  assert.ok('error' in E.playerAction(data, 'cx', battle.id, notTurn, { kind: 'fisico', dice: 10 }));
});

test('habilidade mágica gasta mana e é bloqueada sem mana suficiente', () => {
  let data = setup();
  data.characters[0].mana = 3; // Bola de Fogo custa 5
  data = ok(E.startBattle(data, 'cx', 'aranha', ['a'], 'planicie'));
  const battle = () => data.codexes[0].battles[0];
  while (E.currentTurn(battle()) !== 'a') data = ok(E.monsterAction(data, 'cx', battle().id, { damage: 0 }));
  const result = E.playerAction(data, 'cx', battle().id, 'a', { kind: 'habilidade', abilityId: 'fb', dice: 10 });
  assert.equal(result.error, 'Mana insuficiente.');
});

test('ataque exige o valor do dado e o status aplicado gera o aviso', () => {
  let data = ok(E.startBattle(setup(), 'cx', 'aranha', ['a'], 'planicie'));
  const battle = () => data.codexes[0].battles[0];
  while (E.currentTurn(battle()) !== 'a') data = ok(E.monsterAction(data, 'cx', battle().id, { damage: 0 }));
  assert.equal(E.playerAction(data, 'cx', battle().id, 'a', { kind: 'fisico', dice: 0 }).error, 'Digite o valor do dado.');
  data = ok(E.playerAction(data, 'cx', battle().id, 'a', { kind: 'habilidade', abilityId: 'fb', dice: 17 }));
  assert.equal(battle().pending.dice, 17);
  data = ok(E.resolveAction(data, 'cx', battle().id, { type: 'dano', amount: 5 }));
  assert.equal(battle().lastStatus.target, 'Aranha');
  assert.equal(battle().lastStatus.type, 'veneno');
  assert.equal(battle().lastStatus.chance, 100);
  assert.ok('error' in E.monsterAction(data, 'cx', battle().id, { targetId: 'a', damage: 3 }), 'monstro também exige o dado');
});

test('cura escolhe vários alvos, inclusive o monstro', () => {
  let data = ok(E.startBattle(setup(), 'cx', 'aranha', ['a', 'b'], 'planicie'));
  const battle = () => data.codexes[0].battles[0];
  while (E.currentTurn(battle()) === 'monstro') data = ok(E.monsterAction(data, 'cx', battle().id, { damage: 0 }));
  const actor = E.currentTurn(battle());
  data.characters.forEach((c) => (c.hp = 5));
  data.codexes[0].battles[0].monsterHp = 20;
  data = ok(E.playerAction(data, 'cx', battle().id, actor, { kind: 'fisico', dice: 8 }));
  assert.ok('error' in E.resolveAction(data, 'cx', battle().id, { type: 'cura', amount: 4, targetIds: [] }), 'exige alvo');
  data = ok(E.resolveAction(data, 'cx', battle().id, { type: 'cura', amount: 4, targetIds: ['a', 'b', 'monstro'] }));
  assert.deepEqual(data.characters.map((c) => c.hp), [9, 9]);
  assert.equal(battle().monsterHp, 24);
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

test('XP excedente não passa do nível máximo', () => {
  const hero = { ...R.characterDefaults(), id: 'h', name: 'Herói', age: 20, createdAt: 0, level: 99, xp: 0 };
  const { character, events } = R.gainXp(hero, 20000000);
  assert.equal(character.level, R.MAX_LEVEL);
  assert.equal(character.xp, R.xpToNext(R.MAX_LEVEL));
  assert.equal(events.length, 1);
  const again = R.gainXp(character, 500);
  assert.equal(again.character.level, R.MAX_LEVEL);
  assert.equal(again.character.xp, R.xpToNext(R.MAX_LEVEL));
  assert.equal(again.events.length, 0);
});

test('Mestre entrega XP e itens só aos personagens escolhidos', () => {
  const base = setup();
  base.characters[0].inventory = [{ id: 'p', name: 'Poção', quantity: 1, description: '' }];
  const data = ok(E.grantRewards(base, 'cx', ['a'], 150, [{ id: 'x', name: 'poção', quantity: 2, description: '' }]));
  const [a, b] = data.characters;
  assert.equal(a.level, 2);
  assert.equal(a.inventory.find((i) => i.name === 'Poção').quantity, 3, 'soma itens de mesmo nome');
  assert.equal(b.level, 1);
  assert.equal(b.inventory.length, 0);
  assert.equal(data.codexes[0].levelUps.length, 1);
  assert.ok('error' in E.grantRewards(base, 'cx', [], 10, []));
  assert.ok('error' in E.grantRewards(base, 'cx', ['a'], 0, []));
});

test('fuga com d20 e encerramento sem vitória', () => {
  let data = ok(E.startBattle(setup([monster('lobo', 10)]), 'cx', 'lobo', ['a'], 'planicie-noite'));
  const battle = () => data.codexes[0].battles[0];
  for (let i = 0; i < 40 && !battle().participants[0].fled; i++) {
    data =
      E.currentTurn(battle()) === 'monstro'
        ? ok(E.monsterAction(data, 'cx', battle().id, { targetId: 'a', dice: 5, damage: 0 }))
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

test('trocar de classe troca as habilidades da classe e mantém as gerais', () => {
  const codex = {
    ...setup().codexes[0],
    classes: [
      { id: 'guerreiro', name: 'Guerreiro', emoji: '⚔️', description: '', offeredTo: [] },
      { id: 'mago', name: 'Mago', emoji: '🔮', description: '', offeredTo: [] },
    ],
    startingClassId: 'mago',
    abilities: [
      { ...fireball, id: 'golpe', classId: 'guerreiro', offeredTo: [] },
      { ...fireball, id: 'raio', classId: 'mago', offeredTo: [] },
      { ...fireball, id: 'geral', offeredTo: [] },
    ],
  };
  assert.equal(R.startingClassOf(codex), 'mago');
  let c = { ...character('a', 'Aria'), abilities: [{ ...fireball, id: 'geral' }] };
  c = R.applyClass(c, codex, 'guerreiro');
  assert.deepEqual(c.abilities.map((a) => a.id).sort(), ['geral', 'golpe']);
  assert.equal(c.abilities.find((a) => a.id === 'golpe').classId, undefined, 'cópia na ficha sem dados do Codex');
  c = R.applyClass(c, codex, 'mago');
  assert.equal(c.classId, 'mago');
  assert.deepEqual(c.abilities.map((a) => a.id).sort(), ['geral', 'raio']);
  c = R.applyClass(c, codex, undefined);
  assert.deepEqual(c.abilities.map((a) => a.id), ['geral']);
});

test('espólios: vivos pegam em turnos e o que sobra é apagado', () => {
  const loot = [{ id: 'p', name: 'Poção', quantity: 2, description: '' }, { id: 'e', name: 'Espada', quantity: 1, description: '' }];
  let data = ok(E.startBattle(setup([{ ...monster('aranha', 5, []), loot }]), 'cx', 'aranha', ['a', 'b'], 'mar'));
  const battle = () => data.codexes[0].battles[0];
  data.characters[1].hp = 0; // Bram morreu: não tem vez
  data.codexes[0].battles[0].participants[1].fled = false;
  while (E.currentTurn(battle()) !== 'a') data = ok(E.monsterAction(data, 'cx', battle().id, { damage: 0 }));
  data = ok(E.playerAction(data, 'cx', battle().id, 'a', { kind: 'fisico', dice: 20 }));
  data = ok(E.resolveAction(data, 'cx', battle().id, { type: 'dano', amount: 5 }));
  assert.equal(battle().status, 'vitoria');
  assert.deepEqual(battle().loot.order, ['a']);
  assert.ok('error' in E.takeLoot(data, 'cx', battle().id, 'b', 'p'), 'morto não pega');
  data = ok(E.takeLoot(data, 'cx', battle().id, 'a', 'p'));
  assert.equal(data.characters[0].inventory.find((i) => i.name === 'Poção').quantity, 1);
  assert.equal(battle().loot.items.find((i) => i.id === 'p').quantity, 1);
  data = ok(E.passLoot(data, 'cx', battle().id, 'a'));
  assert.equal(battle().loot.done, true);
  assert.deepEqual(battle().loot.items, [], 'sobras apagadas');
});
