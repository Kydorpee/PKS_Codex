/**
 * Regras da batalha e dos eventos de nível. Funções puras: recebem os dados,
 * trabalham numa cópia e devolvem os dados novos ou uma mensagem de erro.
 */
import { newId } from './ids';
import { STATUS_INFO, addStatus, gainXp, rollDie, splitXp } from './rules';
import {
  MONSTER_TURN,
  type ActiveStatus,
  type Battle,
  type Character,
  type Codex,
  type LogTone,
  type Monster,
  type Terrain,
} from './types';

export type Data = { characters: Character[]; codexes: Codex[] };
export type Result = { data: Data } | { error: string };

class RuleError extends Error {}
const fail = (message: string): never => {
  throw new RuleError(message);
};

function run(data: Data, change: (draft: Data) => void): Result {
  const draft: Data = JSON.parse(JSON.stringify(data));
  try {
    change(draft);
    return { data: draft };
  } catch (e) {
    if (e instanceof RuleError) return { error: e.message };
    throw e;
  }
}

type Ctx = {
  draft: Data;
  codex: Codex;
  battle: Battle;
  monster: Monster;
  character: (id: string) => Character | undefined;
  log: (text: string, tone?: LogTone) => void;
};

function withBattle(data: Data, codexId: string, battleId: string, change: (ctx: Ctx) => void): Result {
  return run(data, (draft) => {
    const codex = draft.codexes.find((c) => c.id === codexId) ?? fail('Codex não encontrado.');
    const battle = codex.battles.find((b) => b.id === battleId) ?? fail('Batalha não encontrada.');
    const monster = codex.monsters.find((m) => m.id === battle.monsterId) ?? fail('Monstro não encontrado.');
    change({
      draft,
      codex,
      battle,
      monster,
      character: (id) => draft.characters.find((c) => c.id === id),
      log: (text, tone = 'info') => {
        battle.log.push({ id: newId(), text, tone });
        if (battle.log.length > 200) battle.log.shift();
      },
    });
  });
}

const requireActive = (battle: Battle) => {
  if (battle.status !== 'ativa') fail('A batalha já terminou.');
};

export const currentTurn = (battle: Battle) => battle.order[battle.turnIndex];

/** Personagem fora da batalha (morto ou fugiu). */
export function isOut(battle: Battle, character: Character | undefined) {
  const p = battle.participants.find((x) => x.characterId === character?.id);
  return !character || !p || p.fled || character.hp <= 0;
}

/** Aplica os status no início do turno. Retorna true se o turno deve ser pulado. */
function tickStatuses(ctx: Ctx, name: string, statuses: ActiveStatus[], hurt: (amount: number) => void) {
  let skip = false;
  const remaining: ActiveStatus[] = [];
  for (const s of statuses) {
    const info = STATUS_INFO[s.type];
    if (info.tickDie) {
      const dmg = rollDie(info.tickDie);
      hurt(dmg);
      ctx.log(`${info.emoji} ${name} sofre ${dmg} de dano por ${info.label.toLowerCase()}.`, 'status');
    }
    if (info.skipsTurn) {
      skip = true;
      ctx.log(`${info.emoji} ${name} está sob ${info.label.toLowerCase()} e perde o turno.`, 'status');
    }
    if (s.roundsLeft > 1) remaining.push({ ...s, roundsLeft: s.roundsLeft - 1 });
  }
  return { skip, remaining };
}

function victory(ctx: Ctx) {
  ctx.battle.monsterHp = 0;
  ctx.battle.status = 'vitoria';
  ctx.battle.pending = undefined;
  ctx.battle.monsterStatuses = [];
  ctx.monster.defeated = true;
  ctx.log(`☠️ ${ctx.monster.name} foi derrotado!`, 'dano');
}

/** Passa para o próximo turno válido, aplicando status de início de turno. */
function advance(ctx: Ctx) {
  const { battle } = ctx;
  for (let guard = 0; guard < battle.order.length * 4; guard++) {
    battle.turnIndex += 1;
    if (battle.turnIndex >= battle.order.length) {
      battle.turnIndex = 0;
      battle.round += 1;
      ctx.log(`— Rodada ${battle.round} —`);
    }
    const actor = currentTurn(battle);

    if (actor === MONSTER_TURN) {
      const { skip, remaining } = tickStatuses(ctx, ctx.monster.name, battle.monsterStatuses, (n) => {
        battle.monsterHp = Math.max(0, battle.monsterHp - n);
      });
      battle.monsterStatuses = remaining;
      if (battle.monsterHp <= 0) return victory(ctx);
      if (skip) continue;
      return;
    }

    const character = ctx.character(actor);
    if (!character || isOut(battle, character)) continue;
    const { skip, remaining } = tickStatuses(ctx, character.name, character.statuses, (n) => {
      character.hp = Math.max(0, character.hp - n);
    });
    character.statuses = remaining;
    if (character.hp <= 0) {
      ctx.log(`☠️ ${character.name} caiu em batalha.`, 'dano');
      continue;
    }
    if (skip) continue;
    return;
  }
}

/** Sorteia a chance de status (d100). O resultado é do sistema, não do Mestre. */
function tryStatus(ctx: Ctx, targetName: string, type: string | undefined, chance: number | undefined, apply: () => void) {
  if (!type || !chance) return;
  const info = STATUS_INFO[type as keyof typeof STATUS_INFO];
  const roll = rollDie(100);
  const hit = roll <= chance;
  if (hit) apply();
  ctx.log(
    `🎲 Sistema: chance de ${info.label.toLowerCase()} ${chance}% — rolou ${roll}. ${
      hit ? `${info.emoji} ${targetName} foi afetado!` : `${targetName} resistiu.`
    }`,
    'status',
  );
}

export function startBattle(
  data: Data,
  codexId: string,
  monsterId: string,
  characterIds: string[],
  terrain: Terrain,
): Result & { battleId?: string } {
  const battleId = newId();
  const result = run(data, (draft) => {
    const codex = draft.codexes.find((c) => c.id === codexId) ?? fail('Codex não encontrado.');
    const monster = codex.monsters.find((m) => m.id === monsterId) ?? fail('Monstro não encontrado.');
    if (monster.defeated) fail('Este monstro já foi derrotado.');
    if (characterIds.length === 0) fail('Escolha pelo menos um personagem.');
    const busy = new Set(codex.battles.filter((b) => b.status === 'ativa').flatMap((b) => b.participants.map((p) => p.characterId)));

    const initiatives: Record<string, number> = { [MONSTER_TURN]: rollDie(20) };
    const log: string[] = [`⚔️ Batalha contra ${monster.name} começou!`];
    for (const id of characterIds) {
      const c = draft.characters.find((x) => x.id === id && x.codexId === codexId) ?? fail('Personagem não está no Codex.');
      if (c.hp <= 0) fail(`${c.name} está sem vida. Restaure antes da batalha.`);
      if (busy.has(id)) fail(`${c.name} já está em outra batalha.`);
      c.statuses = [];
      initiatives[id] = rollDie(20);
      log.push(`🎲 Iniciativa de ${c.name}: ${initiatives[id]}`);
    }
    log.push(`🎲 Iniciativa de ${monster.name}: ${initiatives[MONSTER_TURN]}`);

    const order = Object.keys(initiatives).sort((a, b) => initiatives[b] - initiatives[a] || Math.random() - 0.5);
    const battle: Battle = {
      id: battleId,
      monsterId,
      status: 'ativa',
      monsterHp: monster.hitPoints,
      monsterMaxHp: monster.hitPoints,
      terrain,
      monsterCondition: '',
      monsterStatuses: [],
      participants: characterIds.map((characterId) => ({
        characterId,
        initiative: initiatives[characterId],
        damageDealt: 0,
        fled: false,
        observed: false,
      })),
      order,
      initiatives,
      turnIndex: order.length - 1,
      round: 0,
      log: log.map((text) => ({ id: newId(), text, tone: 'dado' as const })),
      createdAt: Date.now(),
    };
    codex.battles.push(battle);
    advance({
      draft,
      codex,
      battle,
      monster,
      character: (id) => draft.characters.find((c) => c.id === id),
      log: (text, tone = 'info') => battle.log.push({ id: newId(), text, tone }),
    });
  });
  return 'data' in result ? { ...result, battleId } : result;
}

export const rollBattleDie = (data: Data, codexId: string, battleId: string, sides: number, by: string) =>
  withBattle(data, codexId, battleId, (ctx) => {
    const value = rollDie(sides);
    ctx.battle.lastRoll = { sides, value, by };
    ctx.log(`🎲 ${by} rolou d${sides}: ${value}`, 'dado');
  });

export type PlayerAction =
  | { kind: 'observar' }
  | { kind: 'fugir' }
  | { kind: 'fisico' }
  | { kind: 'habilidade'; abilityId: string }
  | { kind: 'item'; itemId: string };

export const playerAction = (data: Data, codexId: string, battleId: string, characterId: string, action: PlayerAction) =>
  withBattle(data, codexId, battleId, (ctx) => {
    const { battle } = ctx;
    requireActive(battle);
    if (currentTurn(battle) !== characterId) fail('Não é o seu turno.');
    if (battle.pending) fail('Aguarde o Mestre resolver a ação.');
    const c = ctx.character(characterId) ?? fail('Personagem não encontrado.');
    const p = battle.participants.find((x) => x.characterId === characterId)!;

    switch (action.kind) {
      case 'observar':
        p.observed = true;
        ctx.log(`👁️ ${c.name} observa ${ctx.monster.name} com atenção.`);
        return advance(ctx);
      case 'fugir': {
        const roll = rollDie(20);
        p.fled = roll >= 10;
        ctx.log(`🏃 ${c.name} tenta fugir (d20: ${roll}) — ${p.fled ? 'conseguiu escapar!' : 'não conseguiu.'}`, 'dado');
        return advance(ctx);
      }
      case 'fisico':
        battle.pending = { characterId, kind: 'fisico', label: 'Golpe físico' };
        ctx.log(`⚔️ ${c.name} desfere um golpe físico.`);
        return;
      case 'habilidade': {
        const a = c.abilities.find((x) => x.id === action.abilityId) ?? fail('Habilidade não encontrada.');
        const pool = a.kind === 'magica' ? 'mana' : 'stamina';
        if (c[pool] < a.cost) fail(`${a.kind === 'magica' ? 'Mana' : 'Estamina'} insuficiente.`);
        c[pool] -= a.cost;
        battle.pending = { characterId, kind: 'habilidade', label: a.name, abilityId: a.id };
        ctx.log(`${a.kind === 'magica' ? '✨' : '💪'} ${c.name} usa ${a.name} (−${a.cost} ${a.kind === 'magica' ? 'mana' : 'estamina'}).`);
        return;
      }
      case 'item': {
        const item = c.inventory.find((x) => x.id === action.itemId) ?? fail('Item não encontrado.');
        item.quantity -= 1;
        c.inventory = c.inventory.filter((x) => x.quantity > 0);
        battle.pending = { characterId, kind: 'item', label: `Usa ${item.name}` };
        ctx.log(`🎒 ${c.name} usa ${item.name}.`);
        return;
      }
    }
  });

export type Resolution = { type: 'dano'; amount: number } | { type: 'cura'; amount: number; targetId: string } | { type: 'nada' };

/** O Mestre define o resultado da ação do personagem. */
export const resolveAction = (data: Data, codexId: string, battleId: string, res: Resolution) =>
  withBattle(data, codexId, battleId, (ctx) => {
    const { battle } = ctx;
    requireActive(battle);
    const pending = battle.pending ?? fail('Nenhuma ação para resolver.');
    const c = ctx.character(pending.characterId);
    const name = c?.name ?? 'Personagem';

    if (res.type === 'dano') {
      const dealt = Math.min(res.amount, battle.monsterHp);
      battle.monsterHp -= dealt;
      const p = battle.participants.find((x) => x.characterId === pending.characterId);
      if (p) p.damageDealt += dealt;
      ctx.log(`💥 ${pending.label} de ${name} causa ${dealt} de dano em ${ctx.monster.name}.`, 'dano');
      const ability = c?.abilities.find((a) => a.id === pending.abilityId);
      if (battle.monsterHp > 0) {
        tryStatus(ctx, ctx.monster.name, ability?.status, ability?.statusChance, () => {
          battle.monsterStatuses = addStatus(battle.monsterStatuses, ability!.status!);
        });
      }
    } else if (res.type === 'cura') {
      const target = ctx.character(res.targetId) ?? fail('Alvo não encontrado.');
      const healed = Math.min(res.amount, target.maxHp - target.hp);
      target.hp += healed;
      ctx.log(`💚 ${pending.label} de ${name} cura ${healed} de vida de ${target.name}.`, 'cura');
    } else {
      ctx.log(`${pending.label} de ${name} não teve efeito.`);
    }

    battle.pending = undefined;
    if (battle.monsterHp <= 0) victory(ctx);
    else advance(ctx);
  });

/** Turno do monstro: o Mestre escolhe habilidade, alvo e dano. */
export const monsterAction = (
  data: Data,
  codexId: string,
  battleId: string,
  action: { abilityId?: string; targetId?: string; damage: number },
) =>
  withBattle(data, codexId, battleId, (ctx) => {
    const { battle, monster } = ctx;
    requireActive(battle);
    if (currentTurn(battle) !== MONSTER_TURN) fail('Não é o turno do monstro.');
    const ability = monster.abilities.find((a) => a.id === action.abilityId);
    battle.monsterAbilityId = ability?.id;

    if (action.targetId) {
      const target = ctx.character(action.targetId) ?? fail('Alvo não encontrado.');
      if (isOut(battle, target)) fail(`${target.name} não está mais na batalha.`);
      target.hp = Math.max(0, target.hp - action.damage);
      ctx.log(`👹 ${monster.name} usa ${ability?.name ?? 'um ataque'} em ${target.name}: ${action.damage} de dano.`, 'dano');
      if (target.hp > 0) {
        tryStatus(ctx, target.name, ability?.status, ability?.statusChance, () => {
          target.statuses = addStatus(target.statuses, ability!.status!);
        });
      } else {
        ctx.log(`☠️ ${target.name} caiu em batalha.`, 'dano');
      }
    } else {
      ctx.log(`👹 ${monster.name} usa ${ability?.name ?? 'seu turno'}.`);
    }
    advance(ctx);
  });

/** Balão do monstro: habilidade exibida e condição escrita pelo Mestre. */
export const setMonsterDisplay = (data: Data, codexId: string, battleId: string, abilityId: string | undefined, condition: string) =>
  withBattle(data, codexId, battleId, ({ battle }) => {
    battle.monsterAbilityId = abilityId;
    battle.monsterCondition = condition;
  });

export const setTerrain = (data: Data, codexId: string, battleId: string, terrain: Terrain) =>
  withBattle(data, codexId, battleId, ({ battle }) => {
    battle.terrain = terrain;
  });

export const skipTurn = (data: Data, codexId: string, battleId: string) =>
  withBattle(data, codexId, battleId, (ctx) => {
    requireActive(ctx.battle);
    ctx.battle.pending = undefined;
    ctx.log('⏭️ O Mestre pulou o turno.');
    advance(ctx);
  });

const clearStatuses = (ctx: Ctx) =>
  ctx.battle.participants.forEach((p) => {
    const c = ctx.character(p.characterId);
    if (c) c.statuses = [];
  });

export const endBattle = (data: Data, codexId: string, battleId: string) =>
  withBattle(data, codexId, battleId, (ctx) => {
    requireActive(ctx.battle);
    ctx.battle.status = 'encerrada';
    ctx.battle.pending = undefined;
    clearStatuses(ctx);
    ctx.log('🏳️ O Mestre encerrou a batalha.');
  });

/** Distribui XP após a vitória, conforme o dano causado. */
export const awardXp = (data: Data, codexId: string, battleId: string, min: number, max: number) =>
  withBattle(data, codexId, battleId, (ctx) => {
    const { battle, codex } = ctx;
    if (battle.status !== 'vitoria') fail('O monstro ainda não foi derrotado.');
    if (battle.xpAwarded) fail('O XP desta batalha já foi distribuído.');
    if (max < min) fail('O XP máximo deve ser maior ou igual ao mínimo.');

    const split = splitXp(
      battle.participants.map((p) => ({
        characterId: p.characterId,
        damageDealt: p.damageDealt,
        out: isOut(battle, ctx.character(p.characterId)),
      })),
      min,
      max,
    );
    for (const [characterId, amount] of Object.entries(split)) {
      const index = ctx.draft.characters.findIndex((c) => c.id === characterId);
      if (index < 0) continue;
      const { character, events } = gainXp(ctx.draft.characters[index], amount);
      ctx.draft.characters[index] = character;
      codex.levelUps.push(...events);
      ctx.log(`⭐ ${character.name} recebeu ${amount} XP.`, 'cura');
      for (const e of events) ctx.log(`🆙 ${character.name} subiu para o nível ${e.level}!`, 'cura');
    }
    battle.xpAwarded = split;
    clearStatuses(ctx);
  });

export type LevelUpReward = {
  maxHp: number;
  maxMana: number;
  maxStamina: number;
  /** Variação por atributo (id → quantidade). */
  attributes: Record<string, number>;
  newAttributes: { name: string; value: number }[];
  offerAbilityIds: string[];
  note: string;
};

/** O Mestre define as recompensas de uma subida de nível. */
export const resolveLevelUp = (data: Data, codexId: string, eventId: string, reward: LevelUpReward) =>
  run(data, (draft) => {
    const codex = draft.codexes.find((c) => c.id === codexId) ?? fail('Codex não encontrado.');
    const event = codex.levelUps.find((e) => e.id === eventId) ?? fail('Evento não encontrado.');
    if (event.resolved) fail('Este evento já foi concluído.');
    const c = draft.characters.find((x) => x.id === event.characterId) ?? fail('Personagem não encontrado.');
    const rewards: string[] = [];

    const bars = [
      ['maxHp', 'hp', 'Vida'],
      ['maxMana', 'mana', 'Mana'],
      ['maxStamina', 'stamina', 'Estamina'],
    ] as const;
    for (const [maxKey, key, label] of bars) {
      const delta = reward[maxKey];
      if (!delta) continue;
      c[maxKey] = Math.max(1, c[maxKey] + delta);
      c[key] = Math.min(c[maxKey], Math.max(0, c[key] + delta));
      rewards.push(`${label} máx. ${delta > 0 ? '+' : ''}${delta}`);
    }
    for (const attr of c.attributes) {
      const delta = reward.attributes[attr.id];
      if (!delta) continue;
      attr.value += delta;
      rewards.push(`${attr.name} ${delta > 0 ? '+' : ''}${delta}`);
    }
    for (const a of reward.newAttributes) {
      if (!a.name.trim()) continue;
      c.attributes.push({ id: newId(), name: a.name.trim(), value: a.value });
      rewards.push(`Novo atributo: ${a.name.trim()} ${a.value}`);
    }
    for (const abilityId of reward.offerAbilityIds) {
      const ability = codex.abilities.find((a) => a.id === abilityId);
      if (!ability || c.abilities.some((a) => a.id === abilityId) || ability.offeredTo.includes(c.id)) continue;
      ability.offeredTo.push(c.id);
      rewards.push(`Habilidade liberada: ${ability.name}`);
    }
    if (reward.note.trim()) rewards.push(reward.note.trim());

    event.resolved = true;
    event.rewards = rewards.length ? rewards : ['Sem recompensas extras.'];
  });
