/**
 * Regras da batalha e dos eventos de nível. Funções puras: recebem os dados,
 * trabalham numa cópia e devolvem os dados novos ou uma mensagem de erro.
 */
import { newId } from './ids';
import { DICE, STATUS_INFO, addStatus, addToInventory, gainXp, rollDie, splitXp } from './rules';
import {
  MAX_FOES,
  diceLabel,
  type ActiveStatus,
  type Battle,
  type Character,
  type Codex,
  type DiceRoll,
  type Foe,
  type Hit,
  type Item,
  type LogTone,
  type Monster,
  type StatusType,
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
  /** Monstro do Codex (nome, armadura, habilidades, espólio). */
  monster: (id: string) => Monster;
  character: (id: string) => Character | undefined;
  log: (text: string, tone?: LogTone, status?: StatusType) => void;
  /** Registra o efeito visual de um alvo nesta ação. */
  hit: (hit: Hit) => void;
};

function context(draft: Data, codex: Codex, battle: Battle): Ctx {
  const fxId = newId();
  return {
    draft,
    codex,
    battle,
    monster: (id) => codex.monsters.find((m) => m.id === id) ?? fail('Monstro não encontrado.'),
    character: (id) => draft.characters.find((c) => c.id === id),
    log: (text, tone = 'info', status) => {
      battle.log.push({ id: newId(), text, tone, ...(status ? { status } : {}) });
      if (battle.log.length > 200) battle.log.shift();
    },
    hit: (hit) => {
      if (battle.fx?.id !== fxId) battle.fx = { id: fxId, hits: [] };
      battle.fx.hits.push(hit);
    },
  };
}

function withBattle(data: Data, codexId: string, battleId: string, change: (ctx: Ctx) => void): Result {
  return run(data, (draft) => {
    const codex = draft.codexes.find((c) => c.id === codexId) ?? fail('Codex não encontrado.');
    const battle = codex.battles.find((b) => b.id === battleId) ?? fail('Batalha não encontrada.');
    change(context(draft, codex, battle));
  });
}

const requireActive = (battle: Battle) => {
  if (battle.status !== 'ativa') fail('A batalha já terminou.');
};

export const currentTurn = (battle: Battle) => battle.order[battle.turnIndex];

/** O monstro com este id na batalha (também serve para saber se um turno é de monstro). */
export const foeOf = (battle: Battle, id: string | undefined) => battle.foes.find((f) => f.monsterId === id);

export const aliveFoes = (battle: Battle) => battle.foes.filter((f) => f.hp > 0);

/** Nomes dos monstros da batalha, ex.: "Goblin e Lobo". */
export function foeNames(battle: Battle, monsters: Monster[]) {
  const names = battle.foes.map((f) => monsters.find((m) => m.id === f.monsterId)?.name ?? 'Monstro');
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}` : (names[0] ?? 'Monstro');
}

/** Personagem fora da batalha (morto ou fugiu). */
export function isOut(battle: Battle, character: Character | undefined) {
  const p = battle.participants.find((x) => x.characterId === character?.id);
  return !character || !p || p.fled || character.hp <= 0;
}

/** Aplica os status no início do turno. Retorna true se o turno deve ser pulado. */
function tickStatuses(ctx: Ctx, targetId: string, name: string, statuses: ActiveStatus[], hurt: (amount: number) => void) {
  let skip = false;
  const remaining: ActiveStatus[] = [];
  for (const s of statuses) {
    const info = STATUS_INFO[s.type];
    if (info.tickDie) {
      const dmg = rollDie(info.tickDie);
      hurt(dmg);
      ctx.hit({ targetId, kind: 'dano', amount: dmg });
      ctx.log(`${info.emoji} ${name} sofre ${dmg} de dano por ${info.label.toLowerCase()}.`, 'status', s.type);
    }
    if (info.skipsTurn) {
      skip = true;
      ctx.log(`${info.emoji} ${name} está sob ${info.label.toLowerCase()} e perde o turno.`, 'status', s.type);
    }
    if (s.roundsLeft > 1) remaining.push({ ...s, roundsLeft: s.roundsLeft - 1 });
  }
  return { skip, remaining };
}

/** Um monstro chegou a 0 de vida: sai da ordem de turnos. Retorna true se era o último (vitória). */
function foeDown(ctx: Ctx, foe: Foe) {
  foe.hp = 0;
  foe.statuses = [];
  ctx.monster(foe.monsterId).defeated = true;
  ctx.log(`☠️ ${ctx.monster(foe.monsterId).name} foi derrotado!`, 'dano');
  if (aliveFoes(ctx.battle).length > 0) return false;
  victory(ctx);
  return true;
}

function victory(ctx: Ctx) {
  ctx.battle.status = 'vitoria';
  ctx.battle.pending = undefined;
  ctx.battle.participants.forEach((p) => delete p.defense);
  ctx.log(ctx.battle.foes.length > 1 ? '🏆 Todos os monstros foram derrotados!' : '🏆 Vitória!', 'cura');
  openLoot(ctx);
}

/** O espólio dos monstros vai para o local "Espólios": só personagens vivos têm vez. */
function openLoot(ctx: Ctx) {
  // Itens de mesmo nome (de monstros diferentes) viram uma pilha só.
  const items: Item[] = [];
  for (const drop of ctx.battle.foes.flatMap((f) => ctx.monster(f.monsterId).loot)) {
    if (!drop.name.trim() || drop.quantity <= 0) continue;
    const same = items.find((i) => i.name.trim().toLowerCase() === drop.name.trim().toLowerCase());
    if (same) same.quantity += drop.quantity;
    else items.push({ ...drop });
  }
  const order = ctx.battle.order.filter((id) => !foeOf(ctx.battle, id) && (ctx.character(id)?.hp ?? 0) > 0);
  if (items.length === 0 || order.length === 0) return;
  ctx.battle.loot = { items, order, turnIndex: 0, done: false };
  ctx.log(`💰 O espólio da batalha está em Espólios. Vez de ${ctx.character(order[0])?.name ?? '?'} pegar itens.`, 'cura');
}

/** Personagem da vez nos Espólios (ou nenhum, se já acabou). */
export const currentLooter = (battle: Battle) => (battle.loot && !battle.loot.done ? battle.loot.order[battle.loot.turnIndex] : undefined);

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
    const foe = foeOf(battle, actor);

    if (foe) {
      if (foe.hp <= 0) continue;
      const { skip, remaining } = tickStatuses(ctx, foe.monsterId, ctx.monster(foe.monsterId).name, foe.statuses, (n) => {
        foe.hp = Math.max(0, foe.hp - n);
      });
      foe.statuses = remaining;
      if (foe.hp <= 0) {
        if (foeDown(ctx, foe)) return;
        continue;
      }
      if (skip) continue;
      return;
    }

    const character = ctx.character(actor);
    if (!character || isOut(battle, character)) continue;
    // A defesa dura até o próximo turno do personagem.
    const p = battle.participants.find((x) => x.characterId === actor);
    if (p?.defense) delete p.defense;
    const { skip, remaining } = tickStatuses(ctx, character.id, character.name, character.statuses, (n) => {
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

/**
 * Sorteia a chance de status (d100) quando o Mestre aplica o dano. O resultado é do sistema,
 * não do Mestre; se acertar, fica em `lastStatus` para todos receberem o aviso.
 */
function tryStatus(ctx: Ctx, targetName: string, type: StatusType | undefined, chance: number | undefined, apply: () => void) {
  if (!type || !chance) return;
  const info = STATUS_INFO[type];
  const roll = rollDie(100);
  const hit = roll <= chance;
  if (hit) {
    apply();
    ctx.battle.lastStatus = { id: newId(), target: targetName, type, chance, roll };
  }
  ctx.log(
    `🎲 Sistema: chance de ${info.label.toLowerCase()} ${chance}% — rolou ${roll}. ${
      hit ? `${info.emoji} ${targetName} foi afetado!` : `${targetName} resistiu.`
    }`,
    'status',
    type,
  );
}

export function startBattle(
  data: Data,
  codexId: string,
  monsterIds: string[],
  characterIds: string[],
  terrain: Terrain,
): Result & { battleId?: string } {
  const battleId = newId();
  const result = run(data, (draft) => {
    const codex = draft.codexes.find((c) => c.id === codexId) ?? fail('Codex não encontrado.');
    const ids = [...new Set(monsterIds)];
    if (ids.length === 0) fail('Escolha pelo menos um monstro.');
    if (ids.length > MAX_FOES) fail(`No máximo ${MAX_FOES} monstros por batalha.`);
    if (characterIds.length === 0) fail('Escolha pelo menos um personagem.');
    const active = codex.battles.filter((b) => b.status === 'ativa');
    const busy = new Set(active.flatMap((b) => b.participants.map((p) => p.characterId)));
    const busyFoes = new Set(active.flatMap((b) => b.foes.map((f) => f.monsterId)));
    const monsters = ids.map((id) => {
      const m = codex.monsters.find((x) => x.id === id) ?? fail('Monstro não encontrado.');
      if (m.defeated) fail(`${m.name} já foi derrotado.`);
      if (busyFoes.has(id)) fail(`${m.name} já está em outra batalha.`);
      return m;
    });

    const initiatives: Record<string, number> = {};
    const log: string[] = [`⚔️ Batalha contra ${monsters.map((m) => m.name).join(', ')} começou!`];
    for (const id of characterIds) {
      const c = draft.characters.find((x) => x.id === id && x.codexId === codexId) ?? fail('Personagem não está no Codex.');
      if (c.hp <= 0) fail(`${c.name} está sem vida. Restaure antes da batalha.`);
      if (busy.has(id)) fail(`${c.name} já está em outra batalha.`);
      c.statuses = [];
      initiatives[id] = rollDie(20);
      log.push(`🎲 Iniciativa de ${c.name}: ${initiatives[id]}`);
    }
    for (const m of monsters) {
      initiatives[m.id] = rollDie(20);
      log.push(`🎲 Iniciativa de ${m.name}: ${initiatives[m.id]}`);
    }

    const order = Object.keys(initiatives).sort((a, b) => initiatives[b] - initiatives[a] || Math.random() - 0.5);
    const battle: Battle = {
      id: battleId,
      status: 'ativa',
      foes: monsters.map((m) => ({ monsterId: m.id, hp: m.hitPoints, maxHp: m.hitPoints, statuses: [], condition: '' })),
      terrain,
      participants: characterIds.map((characterId) => ({
        characterId,
        initiative: initiatives[characterId],
        damageDealt: 0,
        fled: false,
        observedIds: [],
      })),
      order,
      initiatives,
      turnIndex: order.length - 1,
      round: 0,
      log: log.map((text) => ({ id: newId(), text, tone: 'dado' as const })),
      createdAt: Date.now(),
    };
    codex.battles.push(battle);
    advance(context(draft, codex, battle));
  });
  return 'data' in result ? { ...result, battleId } : result;
}

export const rollBattleDie = (data: Data, codexId: string, battleId: string, sides: number, by: string) =>
  withBattle(data, codexId, battleId, (ctx) => {
    const value = rollDie(sides);
    ctx.battle.lastRoll = { id: newId(), sides, value, by };
    ctx.log(`🎲 ${by} rolou d${sides}: ${value}`, 'dado');
  });

/** Confere o dado escolhido e o valor digitado (entre 1 e o número de lados). */
function checkRoll(roll: DiceRoll | undefined, what = 'do dado') {
  if (!roll || !(roll.value >= 1)) fail(`Digite o valor ${what}.`);
  if (!(DICE as readonly number[]).includes(roll!.sides)) fail('Escolha o dado usado.');
  if (roll!.value > roll!.sides) fail(`O valor de um d${roll!.sides} vai de 1 a ${roll!.sides}.`);
  return roll!;
}

/** `targetId` é o monstro atacado/observado; com um monstro só, pode ficar vazio. `roll` é o dado usado e o valor. */
export type PlayerAction =
  | { kind: 'observar'; targetId?: string }
  | { kind: 'defender'; roll: DiceRoll }
  | { kind: 'fugir' }
  | { kind: 'fisico'; roll: DiceRoll; targetId?: string }
  | { kind: 'habilidade'; abilityId: string; roll: DiceRoll; targetId?: string }
  | { kind: 'item'; itemId: string };

/** Habilidade de ataque (tem dano base): precisa passar da armadura. As outras (cura, apoio) não. */
export const isOffensive = (ability: { baseDamage: string }) => !!ability.baseDamage.trim();

/** Monstro vivo escolhido; sem escolha, só vale quando há um único monstro vivo. */
function targetFoe(battle: Battle, targetId: string | undefined) {
  const alive = aliveFoes(battle);
  if (!targetId) return alive.length === 1 ? alive[0] : fail('Escolha o monstro alvo.');
  const foe = foeOf(battle, targetId) ?? fail('Monstro não encontrado.');
  if (foe.hp <= 0) fail('Este monstro já foi derrotado.');
  return foe;
}

export const playerAction = (data: Data, codexId: string, battleId: string, characterId: string, action: PlayerAction) =>
  withBattle(data, codexId, battleId, (ctx) => {
    const { battle } = ctx;
    requireActive(battle);
    if (currentTurn(battle) !== characterId) fail('Não é o seu turno.');
    if (battle.pending) fail('Aguarde o Mestre resolver a ação.');
    const c = ctx.character(characterId) ?? fail('Personagem não encontrado.');
    const p = battle.participants.find((x) => x.characterId === characterId)!;
    if (action.kind === 'fisico' || action.kind === 'habilidade' || action.kind === 'defender') checkRoll(action.roll);

    /** O dado do ataque precisa ser maior ou igual à armadura do alvo; se não for, erra na hora. */
    const attack = (foe: Foe, label: string, roll: DiceRoll, abilityId?: string) => {
      const m = ctx.monster(foe.monsterId);
      if (roll.value < m.armor) {
        ctx.hit({ targetId: foe.monsterId, kind: 'errou', amount: 0 });
        ctx.log(`🛡️ ${label} de ${c.name} (🎲 ${diceLabel(roll)}) não passou da armadura de ${m.name}. Errou!`);
        return advance(ctx);
      }
      battle.pending = {
        characterId,
        kind: abilityId ? 'habilidade' : 'fisico',
        label,
        dice: roll.value,
        diceSides: roll.sides,
        targetId: foe.monsterId,
        ...(abilityId ? { abilityId } : {}),
      };
      ctx.log(`🎯 ${label} de ${c.name} (🎲 ${diceLabel(roll)}) acerta ${m.name}!`);
    };

    switch (action.kind) {
      case 'observar': {
        const foe = targetFoe(battle, action.targetId);
        if (!p.observedIds.includes(foe.monsterId)) p.observedIds.push(foe.monsterId);
        ctx.log(`👁️ ${c.name} observa ${ctx.monster(foe.monsterId).name} com atenção.`);
        return advance(ctx);
      }
      case 'defender':
        p.defense = { sides: action.roll.sides, value: action.roll.value };
        ctx.log(`🛡️ ${c.name} se defende (🎲 ${diceLabel(action.roll)}).`, 'dado');
        return advance(ctx);
      case 'fugir': {
        const roll = rollDie(20);
        p.fled = roll >= 10;
        ctx.log(`🏃 ${c.name} tenta fugir (d20: ${roll}) — ${p.fled ? 'conseguiu escapar!' : 'não conseguiu.'}`, 'dado');
        return advance(ctx);
      }
      case 'fisico': {
        const foe = targetFoe(battle, action.targetId);
        ctx.log(`⚔️ ${c.name} desfere um golpe físico em ${ctx.monster(foe.monsterId).name}.`);
        return attack(foe, 'Golpe físico', action.roll);
      }
      case 'habilidade': {
        const a = c.abilities.find((x) => x.id === action.abilityId) ?? fail('Habilidade não encontrada.');
        const pool = a.kind === 'magica' ? 'mana' : 'stamina';
        if (c[pool] < a.cost) fail(`${a.kind === 'magica' ? 'Mana' : 'Estamina'} insuficiente.`);
        const foe = isOffensive(a) ? targetFoe(battle, action.targetId) : undefined;
        c[pool] -= a.cost;
        ctx.log(
          `${a.kind === 'magica' ? '✨' : '💪'} ${c.name} usa ${a.name}${foe ? ` em ${ctx.monster(foe.monsterId).name}` : ''} (−${a.cost} ${
            a.kind === 'magica' ? 'mana' : 'estamina'
          }).`,
        );
        if (foe) return attack(foe, a.name, action.roll, a.id);
        battle.pending = { characterId, kind: 'habilidade', label: a.name, abilityId: a.id, dice: action.roll.value, diceSides: action.roll.sides };
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

/**
 * No dano, `targetId` é o monstro atingido (padrão: o alvo escolhido pelo jogador).
 * Na cura, `targetIds` são personagens e/ou monstros; cada alvo recebe `amount`.
 */
export type Resolution =
  | { type: 'dano'; amount: number; targetId?: string }
  | { type: 'cura'; amount: number; targetIds: string[] }
  | { type: 'nada' };

/** O Mestre define o resultado da ação do personagem. */
export const resolveAction = (data: Data, codexId: string, battleId: string, res: Resolution) =>
  withBattle(data, codexId, battleId, (ctx) => {
    const { battle } = ctx;
    requireActive(battle);
    const pending = battle.pending ?? fail('Nenhuma ação para resolver.');
    const c = ctx.character(pending.characterId);
    const name = c?.name ?? 'Personagem';

    if (res.type === 'dano') {
      const foe = targetFoe(battle, res.targetId ?? pending.targetId);
      const m = ctx.monster(foe.monsterId);
      const dealt = Math.min(res.amount, foe.hp);
      foe.hp -= dealt;
      ctx.hit({ targetId: foe.monsterId, kind: 'dano', amount: dealt });
      const p = battle.participants.find((x) => x.characterId === pending.characterId);
      if (p) p.damageDealt += dealt;
      ctx.log(`💥 ${pending.label} de ${name} causa ${dealt} de dano em ${m.name}.`, 'dano');
      const ability = c?.abilities.find((a) => a.id === pending.abilityId);
      battle.pending = undefined;
      if (foe.hp <= 0) {
        if (foeDown(ctx, foe)) return;
      } else {
        tryStatus(ctx, m.name, ability?.status, ability?.statusChance, () => {
          foe.statuses = addStatus(foe.statuses, ability!.status!);
        });
      }
    } else if (res.type === 'cura') {
      if (res.targetIds.length === 0) fail('Escolha quem será curado.');
      if (!(res.amount >= 1)) fail('Digite quanto curar.');
      for (const targetId of new Set(res.targetIds)) {
        const foe = foeOf(battle, targetId);
        if (foe) {
          if (foe.hp <= 0) fail('Monstro derrotado não pode ser curado.');
          const healed = Math.min(res.amount, foe.maxHp - foe.hp);
          foe.hp += healed;
          ctx.hit({ targetId, kind: 'cura', amount: healed });
          ctx.log(`💚 ${pending.label} de ${name} cura ${healed} de vida de ${ctx.monster(targetId).name}.`, 'cura');
          continue;
        }
        const target = ctx.character(targetId) ?? fail('Alvo não encontrado.');
        if (isOut(battle, target)) fail(`${target.name} não está mais na batalha.`);
        const healed = Math.min(res.amount, target.maxHp - target.hp);
        target.hp += healed;
        ctx.hit({ targetId, kind: 'cura', amount: healed });
        ctx.log(`💚 ${pending.label} de ${name} cura ${healed} de vida de ${target.name}.`, 'cura');
      }
    } else {
      ctx.log(`${pending.label} de ${name} não teve efeito.`);
    }

    battle.pending = undefined;
    advance(ctx);
  });

/**
 * Turno de um monstro: o Mestre escolhe habilidade e alvo, o dado usado, o valor e o dano.
 * Se o alvo estiver defendendo, o Mestre vê o dado da defesa e digita o dano que ele recebe.
 */
export const monsterAction = (
  data: Data,
  codexId: string,
  battleId: string,
  action: { abilityId?: string; targetId?: string; roll?: DiceRoll; damage: number },
) =>
  withBattle(data, codexId, battleId, (ctx) => {
    const { battle } = ctx;
    requireActive(battle);
    const foe = foeOf(battle, currentTurn(battle)) ?? fail('Não é o turno de um monstro.');
    const monster = ctx.monster(foe.monsterId);
    const ability = monster.abilities.find((a) => a.id === action.abilityId);
    foe.abilityId = ability?.id;

    if (action.targetId) {
      const target = ctx.character(action.targetId) ?? fail('Alvo não encontrado.');
      if (isOut(battle, target)) fail(`${target.name} não está mais na batalha.`);
      const roll = checkRoll(action.roll, 'do dado do ataque');
      const p = battle.participants.find((x) => x.characterId === target.id);
      const defense = p?.defense;
      const damage = Math.max(0, action.damage);
      if (p) delete p.defense;
      target.hp = Math.max(0, target.hp - damage);
      ctx.hit({ targetId: target.id, kind: 'dano', amount: damage, defended: !!defense });
      ctx.log(
        `👹 ${monster.name} usa ${ability?.name ?? 'um ataque'} em ${target.name} (🎲 ${diceLabel(roll)})${
          defense ? ` — 🛡️ defesa ${diceLabel(defense)}` : ''
        }: ${damage} de dano.`,
        'dano',
      );
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

/** Balão de um monstro: habilidade exibida e condição escrita pelo Mestre. */
export const setMonsterDisplay = (
  data: Data,
  codexId: string,
  battleId: string,
  monsterId: string,
  abilityId: string | undefined,
  condition: string,
) =>
  withBattle(data, codexId, battleId, ({ battle }) => {
    const foe = foeOf(battle, monsterId) ?? fail('Monstro não está nesta batalha.');
    foe.abilityId = abilityId;
    foe.condition = condition;
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
    delete p.defense;
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

const requireLooter = (ctx: Ctx, characterId: string) => {
  const loot = ctx.battle.loot;
  if (!loot || loot.done) fail('Os espólios já acabaram.');
  if (currentLooter(ctx.battle) !== characterId) fail('Não é a sua vez nos Espólios.');
  return loot!;
};

/** Pega uma unidade de um item dos Espólios, na sua vez. */
export const takeLoot = (data: Data, codexId: string, battleId: string, characterId: string, itemId: string) =>
  withBattle(data, codexId, battleId, (ctx) => {
    const loot = requireLooter(ctx, characterId);
    const item = loot.items.find((i) => i.id === itemId) ?? fail('Este item já foi pego.');
    const c = ctx.character(characterId);
    if (!c || c.codexId !== codexId) fail('Personagem não está neste Codex.');
    c!.inventory = addToInventory(c!.inventory, [{ ...item, quantity: 1 }]);
    item.quantity -= 1;
    loot.items = loot.items.filter((i) => i.quantity > 0);
    ctx.log(`💰 ${c!.name} pegou ${item.name} dos Espólios.`, 'cura');
  });

/**
 * Passa a vez nos Espólios. Sem `characterId`, é o Mestre pulando a vez de quem não responde.
 * Depois da última vez, os itens que sobraram são apagados.
 */
export const passLoot = (data: Data, codexId: string, battleId: string, characterId?: string) =>
  withBattle(data, codexId, battleId, (ctx) => {
    const looter = currentLooter(ctx.battle);
    const loot = requireLooter(ctx, characterId ?? looter ?? '');
    const name = ctx.character(looter!)?.name ?? '?';
    ctx.log(characterId ? `💰 ${name} passou a vez nos Espólios.` : `⏭️ O Mestre pulou a vez de ${name} nos Espólios.`);
    // Pula quem saiu do Codex no meio do caminho.
    do loot.turnIndex += 1;
    while (loot.turnIndex < loot.order.length && ctx.character(loot.order[loot.turnIndex])?.codexId !== codexId);
    if (loot.turnIndex >= loot.order.length) {
      const left = loot.items.reduce((n, i) => n + i.quantity, 0);
      loot.items = [];
      loot.done = true;
      ctx.log(left ? `🗑️ Todos tiveram a sua vez: ${left} item(ns) que sobraram nos Espólios foram apagados.` : '💰 Os Espólios foram esvaziados.');
    } else {
      ctx.log(`💰 Vez de ${ctx.character(loot.order[loot.turnIndex])?.name ?? '?'} nos Espólios.`);
    }
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
      // Quem saiu do Codex durante a batalha não recebe (e o Mestre nem teria permissão de alterar a ficha).
      const index = ctx.draft.characters.findIndex((c) => c.id === characterId && c.codexId === codexId);
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

/** O Mestre entrega XP e itens, fora de batalha, aos personagens escolhidos. */
export const grantRewards = (data: Data, codexId: string, characterIds: string[], xp: number, items: Item[]) =>
  run(data, (draft) => {
    const codex = draft.codexes.find((c) => c.id === codexId) ?? fail('Codex não encontrado.');
    const gifts = items.filter((i) => i.name.trim() && i.quantity > 0);
    if (characterIds.length === 0) fail('Escolha ao menos um personagem.');
    if (xp <= 0 && gifts.length === 0) fail('Informe o XP ou adicione itens.');
    for (const id of characterIds) {
      const index = draft.characters.findIndex((c) => c.id === id && c.codexId === codexId);
      if (index < 0) fail('Personagem não está neste Codex.');
      let character = { ...draft.characters[index], inventory: addToInventory(draft.characters[index].inventory, gifts) };
      if (xp > 0) {
        const gained = gainXp(character, xp);
        character = gained.character;
        codex.levelUps.push(...gained.events);
      }
      draft.characters[index] = character;
    }
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
