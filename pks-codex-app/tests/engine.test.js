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
    if (E.foeOf(battle(), current)) {
      const alive = ['a', 'b'].filter((id) => hp(id) > 0);
      data = ok(E.monsterAction(data, 'cx', battle().id, { abilityId: 'bite', targetId: alive[turn % alive.length], roll: { sides: 20, value: 12 }, damage: 2 }));
    } else {
      const ability = E.playerAction(data, 'cx', battle().id, current, { kind: 'habilidade', abilityId: 'fb', roll: { sides: 20, value: 15 } });
      data = 'error' in ability ? ok(E.playerAction(data, 'cx', battle().id, current, { kind: 'fisico', roll: { sides: 20, value: 15 } })) : ability.data;
      data = ok(E.resolveAction(data, 'cx', battle().id, { type: 'dano', amount: current === 'a' ? 9 : 3 }));
    }
  }
  return data;
}

test('iniciativa define a ordem e começa na rodada 1', () => {
  const data = ok(E.startBattle(setup(), 'cx', ['aranha'], ['a', 'b'], 'gelo-noite'));
  const battle = data.codexes[0].battles[0];
  assert.equal(battle.round, 1);
  assert.equal(battle.order.length, 3);
  for (let i = 1; i < battle.order.length; i++) {
    assert.ok(battle.initiatives[battle.order[i - 1]] >= battle.initiatives[battle.order[i]], 'ordem decrescente de iniciativa');
  }
  assert.equal(battle.terrain, 'gelo-noite');
});

test('jogador não pode agir fora do seu turno', () => {
  const data = ok(E.startBattle(setup(), 'cx', ['aranha'], ['a', 'b'], 'planicie'));
  const battle = data.codexes[0].battles[0];
  const notTurn = ['a', 'b'].find((id) => id !== E.currentTurn(battle));
  assert.ok('error' in E.playerAction(data, 'cx', battle.id, notTurn, { kind: 'fisico', roll: { sides: 20, value: 10 } }));
});

test('habilidade mágica gasta mana e é bloqueada sem mana suficiente', () => {
  let data = setup();
  data.characters[0].mana = 3; // Bola de Fogo custa 5
  data = ok(E.startBattle(data, 'cx', ['aranha'], ['a'], 'planicie'));
  const battle = () => data.codexes[0].battles[0];
  while (E.currentTurn(battle()) !== 'a') data = ok(E.monsterAction(data, 'cx', battle().id, { damage: 0 }));
  const result = E.playerAction(data, 'cx', battle().id, 'a', { kind: 'habilidade', abilityId: 'fb', roll: { sides: 20, value: 10 } });
  assert.equal(result.error, 'Mana insuficiente.');
});

test('ataque exige o valor do dado e o status aplicado gera o aviso', () => {
  let data = ok(E.startBattle(setup(), 'cx', ['aranha'], ['a'], 'planicie'));
  const battle = () => data.codexes[0].battles[0];
  while (E.currentTurn(battle()) !== 'a') data = ok(E.monsterAction(data, 'cx', battle().id, { damage: 0 }));
  assert.equal(E.playerAction(data, 'cx', battle().id, 'a', { kind: 'fisico', roll: { sides: 20, value: 0 } }).error, 'Digite o valor do dado.');
  data = ok(E.playerAction(data, 'cx', battle().id, 'a', { kind: 'habilidade', abilityId: 'fb', roll: { sides: 20, value: 17 } }));
  assert.equal(battle().pending.dice, 17);
  assert.equal(battle().pending.diceSides, 20);
  data = ok(E.resolveAction(data, 'cx', battle().id, { type: 'dano', amount: 5 }));
  assert.equal(battle().lastStatus.target, 'Aranha');
  assert.equal(battle().lastStatus.type, 'veneno');
  assert.equal(battle().lastStatus.chance, 100);
  assert.ok('error' in E.monsterAction(data, 'cx', battle().id, { targetId: 'a', damage: 3 }), 'monstro também exige o dado');
});

test('cura escolhe vários alvos, inclusive o monstro', () => {
  let data = ok(E.startBattle(setup(), 'cx', ['aranha'], ['a', 'b'], 'planicie'));
  const battle = () => data.codexes[0].battles[0];
  while (E.foeOf(battle(), E.currentTurn(battle()))) data = ok(E.monsterAction(data, 'cx', battle().id, { damage: 0 }));
  const actor = E.currentTurn(battle());
  data.characters.forEach((c) => (c.hp = 5));
  data.codexes[0].battles[0].foes[0].hp = 20;
  data = ok(E.playerAction(data, 'cx', battle().id, actor, { kind: 'fisico', roll: { sides: 20, value: 15 } }));
  assert.ok('error' in E.resolveAction(data, 'cx', battle().id, { type: 'cura', amount: 4, targetIds: [] }), 'exige alvo');
  data = ok(E.resolveAction(data, 'cx', battle().id, { type: 'cura', amount: 4, targetIds: ['a', 'b', 'aranha'] }));
  assert.deepEqual(data.characters.map((c) => c.hp), [9, 9]);
  assert.equal(battle().foes[0].hp, 24);
});

test('batalha completa: vitória, status sorteados e monstro derrotado', () => {
  const data = playToVictory(ok(E.startBattle(setup(), 'cx', ['aranha'], ['a', 'b'], 'floresta')));
  const battle = data.codexes[0].battles[0];
  assert.equal(battle.status, 'vitoria');
  assert.equal(battle.foes[0].hp, 0);
  assert.equal(data.codexes[0].monsters[0].defeated, true);
  const log = battle.log.map((l) => l.text).join('\n');
  assert.match(log, /chance de veneno 100%/, 'sistema sorteia o veneno');
  assert.match(log, /chance de congelamento 100%/, 'sistema sorteia o congelamento');
  assert.match(log, /perde o turno/, 'congelado perde o turno');
});

test('XP proporcional ao dano, sem distribuir duas vezes', () => {
  let data = playToVictory(ok(E.startBattle(setup(), 'cx', ['aranha'], ['a', 'b'], 'deserto')));
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
  let data = playToVictory(ok(E.startBattle(setup(), 'cx', ['aranha'], ['a', 'b'], 'catacumbas')));
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

test('fuga: o jogador rola o dado e o Mestre aceita ou recusa (com dano, status ou só passando a vez)', () => {
  let data = ok(E.startBattle(setup([monster('lobo', 10)]), 'cx', ['lobo'], ['a', 'b'], 'planicie-noite'));
  const battle = () => data.codexes[0].battles[0];
  const hero = (id) => data.characters.find((c) => c.id === id);
  /** Passa turnos (monstro sem ação) até a vez de `id`. */
  const until = (id) => {
    while (E.currentTurn(battle()) !== id) {
      data = E.foeOf(battle(), E.currentTurn(battle()))
        ? ok(E.monsterAction(data, 'cx', battle().id, { damage: 0 }))
        : ok(E.skipTurn(data, 'cx', battle().id));
    }
  };

  until('a');
  assert.equal(E.playerAction(data, 'cx', battle().id, 'a', { kind: 'fugir', roll: { sides: 20, value: 0 } }).error, 'Digite o valor do dado.');
  data = ok(E.playerAction(data, 'cx', battle().id, 'a', { kind: 'fugir', roll: { sides: 20, value: 12 } }));
  assert.deepEqual([battle().pending.kind, battle().pending.dice, battle().pending.diceSides], ['fuga', 12, 20]);
  assert.ok('error' in E.resolveAction(data, 'cx', battle().id, { type: 'nada' }), 'fuga só se resolve pela decisão de fuga');

  // Recusada com dano e status.
  const hp = hero('a').hp;
  data = ok(E.resolveFlee(data, 'cx', battle().id, { accepted: false, damage: 3, status: 'veneno' }));
  assert.equal(hero('a').hp, hp - 3);
  assert.equal(hero('a').statuses[0].type, 'veneno');
  assert.equal(battle().participants[0].fled, false);
  assert.equal(battle().pending, undefined);
  assert.notEqual(E.currentTurn(battle()), 'a', 'passou a vez');
  assert.match(battle().log.map((l) => l.text).join(' | '), /fuga de Aria falhou: sofre 3 de dano e fica envenenado/);

  // Recusada sem nada: só passa a vez.
  until('b');
  data = ok(E.playerAction(data, 'cx', battle().id, 'b', { kind: 'fugir', roll: { sides: 6, value: 2 } }));
  const hpB = hero('b').hp;
  data = ok(E.resolveFlee(data, 'cx', battle().id, { accepted: false }));
  assert.equal(hero('b').hp, hpB);
  assert.match(battle().log.map((l) => l.text).join(' | '), /fuga de Bram falhou e perde a vez/);

  // Aceita: sai da batalha e não joga mais.
  until('a');
  data = ok(E.playerAction(data, 'cx', battle().id, 'a', { kind: 'fugir', roll: { sides: 20, value: 18 } }));
  data = ok(E.resolveFlee(data, 'cx', battle().id, { accepted: true }));
  assert.equal(battle().participants[0].fled, true);
  assert.deepEqual(hero('a').statuses, [], 'sai sem os status');
  for (let i = 0; i < 6; i++) {
    assert.notEqual(E.currentTurn(battle()), 'a', 'quem fugiu não tem mais turno');
    data = E.foeOf(battle(), E.currentTurn(battle()))
      ? ok(E.monsterAction(data, 'cx', battle().id, { damage: 0 }))
      : ok(E.skipTurn(data, 'cx', battle().id));
  }
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
  let data = ok(E.startBattle(setup([{ ...monster('aranha', 5, []), loot }]), 'cx', ['aranha'], ['a', 'b'], 'mar'));
  const battle = () => data.codexes[0].battles[0];
  data.characters[1].hp = 0; // Bram morreu: não tem vez
  data.codexes[0].battles[0].participants[1].fled = false;
  while (E.currentTurn(battle()) !== 'a') {
    data = E.foeOf(battle(), E.currentTurn(battle()))
      ? ok(E.monsterAction(data, 'cx', battle().id, { damage: 0 }))
      : ok(E.skipTurn(data, 'cx', battle().id)); // a vez já era de Bram quando ele caiu
  }
  data = ok(E.playerAction(data, 'cx', battle().id, 'a', { kind: 'fisico', roll: { sides: 20, value: 20 } }));
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

/** Joga os turnos dos monstros (sem dano) até chegar a vez de `id`. */
function untilTurn(data, id) {
  const battle = () => data.codexes[0].battles[0];
  while (E.currentTurn(battle()) !== id) {
    if (!E.foeOf(battle(), E.currentTurn(battle()))) assert.fail('turno inesperado de outro personagem');
    data = ok(E.monsterAction(data, 'cx', battle().id, { damage: 0 }));
  }
  return data;
}

test('dado abaixo da armadura erra na hora; habilidade de cura não depende da armadura', () => {
  let data = ok(E.startBattle(setup(), 'cx', ['aranha'], ['a'], 'planicie'));
  const battle = () => data.codexes[0].battles[0];
  data = untilTurn(data, 'a');
  const mana = data.characters[0].mana;
  data = ok(E.playerAction(data, 'cx', battle().id, 'a', { kind: 'habilidade', abilityId: 'fb', roll: { sides: 20, value: 11 } })); // armadura 12
  assert.equal(battle().pending, undefined, 'errou: não vai para o Mestre');
  assert.equal(data.characters[0].mana, mana - 5, 'o custo é gasto mesmo errando');
  assert.deepEqual(battle().fx.hits[0], { targetId: 'aranha', kind: 'errou', amount: 0 });
  assert.match(battle().log.map((l) => l.text).join('\n'), /Errou!/);

  data.characters[0].abilities.push({ ...fireball, id: 'cura', name: 'Cura', baseDamage: '', status: undefined });
  data = untilTurn(data, 'a');
  data = ok(E.playerAction(data, 'cx', battle().id, 'a', { kind: 'habilidade', abilityId: 'cura', roll: { sides: 20, value: 1 } }));
  assert.equal(battle().pending.abilityId, 'cura', 'cura vai para o Mestre mesmo com dado baixo');
});

test('defender rola um dado; o Mestre vê a defesa e decide o dano recebido', () => {
  let data = ok(E.startBattle(setup([monster('lobo', 30)]), 'cx', ['lobo'], ['a'], 'planicie'));
  const battle = () => data.codexes[0].battles[0];
  data = untilTurn(data, 'a');
  assert.equal(E.playerAction(data, 'cx', battle().id, 'a', { kind: 'defender', roll: { sides: 6, value: 0 } }).error, 'Digite o valor do dado.');
  assert.equal(E.playerAction(data, 'cx', battle().id, 'a', { kind: 'defender', roll: { sides: 6, value: 9 } }).error, 'O valor de um d6 vai de 1 a 6.');
  assert.equal(E.playerAction(data, 'cx', battle().id, 'a', { kind: 'defender', roll: { sides: 7, value: 3 } }).error, 'Escolha o dado usado.');
  data = ok(E.playerAction(data, 'cx', battle().id, 'a', { kind: 'defender', roll: { sides: 20, value: 14 } }));
  assert.deepEqual(battle().participants[0].defense, { sides: 20, value: 14 });
  const hp = data.characters[0].hp;
  data = ok(E.monsterAction(data, 'cx', battle().id, { targetId: 'a', roll: { sides: 12, value: 9 }, damage: 2 }));
  assert.equal(data.characters[0].hp, hp - 2, 'o dano é o que o Mestre decidiu');
  assert.equal(battle().fx.hits[0].defended, true);
  assert.ok(battle().log.some((l) => /d12: 9.*defesa d20: 14.*2 de dano/.test(l.text)), 'registro mostra ataque, defesa e dano');
  assert.equal(battle().participants[0].defense, undefined, 'a defesa vale para um ataque');

  data = ok(E.playerAction(data, 'cx', battle().id, 'a', { kind: 'defender', roll: { sides: 20, value: 5 } }));
  data = ok(E.monsterAction(data, 'cx', battle().id, { damage: 0 }));
  assert.equal(E.currentTurn(battle()), 'a');
  assert.equal(battle().participants[0].defense, undefined, 'acaba no início do próprio turno');
});

test('vários monstros: cada um tem turno e vida; a vitória vem quando todos caem', () => {
  const loot = (name) => [{ id: name, name, quantity: 1, description: '' }];
  let data = setup([{ ...monster('aranha', 6, [bite]), loot: loot('Seda') }, { ...monster('lobo', 4), loot: loot('Pele') }]);
  data = ok(E.startBattle(data, 'cx', ['aranha', 'lobo'], ['a'], 'floresta'));
  const battle = () => data.codexes[0].battles[0];
  assert.equal(battle().order.length, 3);
  assert.deepEqual(battle().foes.map((f) => f.hp), [6, 4]);
  assert.ok('error' in E.startBattle(data, 'cx', ['lobo'], ['b'], 'mar'), 'monstro ocupado em outra batalha');

  data = untilTurn(data, 'a');
  assert.equal(E.playerAction(data, 'cx', battle().id, 'a', { kind: 'fisico', roll: { sides: 20, value: 15 } }).error, 'Escolha o monstro alvo.');
  data = ok(E.playerAction(data, 'cx', battle().id, 'a', { kind: 'fisico', roll: { sides: 20, value: 15 }, targetId: 'lobo' }));
  assert.equal(battle().pending.targetId, 'lobo');
  data = ok(E.resolveAction(data, 'cx', battle().id, { type: 'dano', amount: 99 }));
  assert.equal(battle().foes[1].hp, 0);
  assert.equal(battle().participants[0].damageDealt, 4, 'dano limitado à vida do monstro');
  assert.equal(data.codexes[0].monsters[1].defeated, true);
  assert.equal(battle().status, 'ativa', 'ainda falta a aranha');

  data = untilTurn(data, 'a');
  assert.ok(!battle().order.some((id, i) => i === battle().turnIndex && id === 'lobo'), 'lobo derrotado não joga');
  data = ok(E.playerAction(data, 'cx', battle().id, 'a', { kind: 'fisico', roll: { sides: 20, value: 15 } }));
  assert.equal(battle().pending.targetId, 'aranha', 'com um só vivo, o alvo é automático');
  data = ok(E.resolveAction(data, 'cx', battle().id, { type: 'dano', amount: 6 }));
  assert.equal(battle().status, 'vitoria');
  assert.deepEqual(battle().loot.items.map((i) => i.name).sort(), ['Pele', 'Seda'], 'espólio de todos os monstros');
});

test('observar revela só o monstro escolhido', () => {
  let data = ok(E.startBattle(setup([monster('aranha', 6), monster('lobo', 4)]), 'cx', ['aranha', 'lobo'], ['a'], 'gelo'));
  const battle = () => data.codexes[0].battles[0];
  data = untilTurn(data, 'a');
  data = ok(E.playerAction(data, 'cx', battle().id, 'a', { kind: 'observar', targetId: 'lobo' }));
  assert.deepEqual(battle().participants[0].observedIds, ['lobo']);
});

test('batalha salva no formato antigo (um monstro) é convertida', () => {
  const old = {
    id: 'b1',
    monsterId: 'aranha',
    status: 'ativa',
    monsterHp: 12,
    monsterMaxHp: 30,
    terrain: 'mar',
    monsterAbilityId: 'bite',
    monsterCondition: 'Furiosa',
    monsterStatuses: [{ type: 'veneno', roundsLeft: 2 }],
    participants: [{ characterId: 'a', initiative: 5, damageDealt: 3, fled: false, observed: true }],
    order: ['monstro', 'a'],
    initiatives: { monstro: 14, a: 5 },
    turnIndex: 0,
    round: 2,
    log: [],
    createdAt: 0,
  };
  const codex = R.normalizeCodex({ ...setup().codexes[0], battles: [old] });
  const b = codex.battles[0];
  assert.deepEqual(b.foes, [
    { monsterId: 'aranha', hp: 12, maxHp: 30, statuses: [{ type: 'veneno', roundsLeft: 2 }], condition: 'Furiosa', abilityId: 'bite' },
  ]);
  assert.deepEqual(b.order, ['aranha', 'a']);
  assert.deepEqual(b.initiatives, { aranha: 14, a: 5 });
  assert.deepEqual(b.participants[0].observedIds, ['aranha']);
  assert.equal('monsterHp' in b, false);
  assert.equal(R.normalizeBattle(b), b, 'já convertida fica igual');
  // E a batalha continua jogável.
  let data = { ...setup(), codexes: [codex] };
  data = ok(E.monsterAction(data, 'cx', 'b1', { targetId: 'a', roll: { sides: 20, value: 10 }, damage: 2 }));
  assert.equal(E.currentTurn(data.codexes[0].battles[0]), 'a');
});

test('habilidades por categoria: classe, geral e montaria; a de montaria funciona na batalha', () => {
  const data0 = setup([monster('lobo', 30)]);
  const codex = data0.codexes[0];
  codex.classes = [{ id: 'mago', name: 'Mago', emoji: '🔮', description: '', offeredTo: [] }];
  codex.abilities.push({ ...fireball, id: 'fb', classId: 'mago', offeredTo: [] });
  codex.mounts = [{ id: 'cavalo', name: 'Cavalo', emoji: '🐎', description: '', abilities: [{ ...fireball, id: 'coice', name: 'Coice', kind: 'fisica', cost: 1, status: undefined }] }];
  const aria = data0.characters[0];
  aria.abilities = [{ ...fireball, id: 'fb' }, { ...fireball, id: 'geral', name: 'Geral' }];
  aria.mountIds = ['cavalo'];
  const groups = R.abilityGroups(aria, codex);
  assert.deepEqual(groups.classe.map((a) => a.id), ['fb']);
  assert.deepEqual(groups.geral.map((a) => a.id), ['geral']);
  assert.deepEqual(groups.montaria.map((g) => [g.mount.id, g.abilities.map((a) => a.id)]), [['cavalo', ['coice']]]);

  let data = ok(E.startBattle(data0, 'cx', ['lobo'], ['a'], 'planicie'));
  const battle = () => data.codexes[0].battles[0];
  data = untilTurn(data, 'a');
  const stamina = data.characters[0].stamina;
  data = ok(E.playerAction(data, 'cx', battle().id, 'a', { kind: 'habilidade', abilityId: 'coice', roll: { sides: 20, value: 15 } }));
  assert.equal(battle().pending.abilityId, 'coice');
  assert.equal(data.characters[0].stamina, stamina - 1, 'gasta o custo da habilidade da montaria');
  data.characters[0].mountIds = [];
  data = ok(E.resolveAction(data, 'cx', battle().id, { type: 'dano', amount: 4 }));
  data = untilTurn(data, 'a');
  assert.equal(
    E.playerAction(data, 'cx', battle().id, 'a', { kind: 'habilidade', abilityId: 'coice', roll: { sides: 20, value: 15 } }).error,
    'Habilidade não encontrada.',
    'sem a montaria, sem a habilidade',
  );
});

test('personagem caído: a cura escolhida pelo Mestre levanta, e o Mestre pode levantar com a vida que quiser', () => {
  let data = ok(E.startBattle(setup([monster('lobo', 30)]), 'cx', ['lobo'], ['a', 'b'], 'planicie'));
  const battle = () => data.codexes[0].battles[0];
  const hero = (id) => data.characters.find((c) => c.id === id);
  const until = (id) => {
    while (E.currentTurn(battle()) !== id) {
      data = E.foeOf(battle(), E.currentTurn(battle()))
        ? ok(E.monsterAction(data, 'cx', battle().id, { damage: 0 }))
        : ok(E.skipTurn(data, 'cx', battle().id));
    }
  };
  until('a');
  data.characters[1].hp = 0; // Bram caiu
  data.characters[1].statuses = [{ type: 'veneno', roundsLeft: 2 }];
  assert.ok('error' in E.reviveCharacter(data, 'cx', battle().id, 'a', 5), 'quem está de pé não é levantado');

  // Aria usa uma cura e o Mestre escolhe Bram, caído.
  data.characters[0].abilities.push({ ...fireball, id: 'cura', name: 'Cura', baseDamage: '', status: undefined, cost: 0 });
  data = ok(E.playerAction(data, 'cx', battle().id, 'a', { kind: 'habilidade', abilityId: 'cura', roll: { sides: 20, value: 3 } }));
  data = ok(E.resolveAction(data, 'cx', battle().id, { type: 'cura', amount: 6, targetIds: ['b'] }));
  assert.equal(hero('b').hp, 6);
  assert.deepEqual(hero('b').statuses, [], 'levanta sem os status');
  assert.match(battle().log.map((l) => l.text).join(' | '), /levanta Bram com 6 de vida/);

  // O Mestre levanta direto, limitado à vida máxima.
  data.characters[1].hp = 0;
  assert.equal(E.reviveCharacter(data, 'cx', battle().id, 'b', 0).error, 'Digite quanta vida ele recupera.');
  data = ok(E.reviveCharacter(data, 'cx', battle().id, 'b', 999));
  assert.equal(hero('b').hp, hero('b').maxHp);
  until('b'); // de pé, volta a ter turno
  assert.equal(E.currentTurn(battle()), 'b');

  // Quem fugiu não pode ser levantado.
  data.characters[1].hp = 0;
  data.codexes[0].battles[0].participants[1].fled = true;
  assert.ok('error' in E.reviveCharacter(data, 'cx', battle().id, 'b', 5));
});

test('entrar no Codex dá a ficha do Mestre; sair apaga tudo menos aparência e história', () => {
  const sheet = {
    resources: [
      { key: 'hp', enabled: true, name: 'Vida', abbr: 'PV', color: '#000', icon: 'heart', base: 30, editable: false },
      { key: 'mana', enabled: false, name: 'Mana', abbr: 'PM', color: '#000', icon: 'drop', editable: false },
      { key: 'stamina', enabled: true, name: 'Fôlego', abbr: 'FO', color: '#000', icon: 'bolt', editable: true },
    ],
    baseStats: [
      { id: 'fa', name: 'Força', abbr: 'FA', base: 4, editable: false },
      { id: 'mv', name: 'Movimento', abbr: 'MV', editable: true },
    ],
    actionStats: [{ id: 'pa', name: 'Poder de ataque', abbr: 'PA', terms: [{ op: '+', statId: 'fa' }, { op: '+', statId: 'mv' }, { op: '×', value: 2 }] }],
  };
  const codex = R.normalizeCodex({
    ...setup().codexes[0],
    sheet,
    currencyName: 'Créditos',
    startingGold: 25,
    startingItems: [{ id: 'p', name: 'Poção', quantity: 2, description: '' }],
    classes: [{ id: 'mago', name: 'Mago', emoji: '🔮', description: '', offeredTo: [] }],
  });
  const outside = R.withoutCodex({ ...character('a', 'Aria'), story: 'Veio do norte.', race: 'Elfo' });
  assert.equal(outside.attributes.length, 0);
  assert.equal(outside.gold, 0);

  const inside = R.enterCodex(outside, codex);
  assert.equal(inside.codexId, 'cx');
  assert.equal(inside.maxHp, 30);
  assert.equal(inside.maxMana, 0, 'barra desligada fica zerada');
  assert.equal(inside.maxStamina, 10, 'valor vazio usa o padrão');
  assert.equal(inside.gold, 25);
  assert.equal(inside.inventory[0].quantity, 2);
  assert.equal(inside.classId, undefined, 'sem classe inicial escolhida, entra sem classe');
  assert.deepEqual(inside.attributes.map((a) => a.value), [4, 10]);
  assert.equal(R.actionStatValue(inside, codex, sheet.actionStats[0]), 28, '(4 + 10) × 2');
  assert.equal(R.formulaText(sheet.actionStats[0], sheet.baseStats), 'FA + MV × 2');

  const left = R.withoutCodex(inside);
  assert.equal(left.story, 'Veio do norte.');
  assert.equal(left.race, 'Elfo');
  assert.equal(left.inventory.length + left.abilities.length + left.attributes.length + left.gold, 0);
});

test('habilidade não custa nada quando o Mestre desliga a barra que a paga', () => {
  let data = setup();
  data.codexes[0] = R.normalizeCodex(data.codexes[0]);
  data.codexes[0].sheet.resources = data.codexes[0].sheet.resources.map((r) => (r.key === 'mana' ? { ...r, enabled: false } : r));
  data.characters[0].mana = 0;
  data = ok(E.startBattle(data, 'cx', ['aranha'], ['a', 'b'], 'mar'));
  const battle = data.codexes[0].battles[0];
  const turn = E.currentTurn(battle);
  const result = E.playerAction(data, 'cx', battle.id, turn, { kind: 'habilidade', abilityId: 'fb', roll: { sides: 20, value: 18 }, targetId: 'aranha' });
  assert.ok(!('error' in result), 'sem mana, mas a mana está desligada');
});
