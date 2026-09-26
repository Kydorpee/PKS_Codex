import { newId } from './ids';
import type { Ability, ActiveStatus, Character, Codex, CodexAbility, Item, LevelUpEvent, StatusType } from './types';

export const DICE = [4, 6, 8, 10, 12, 20] as const;

export const rollDie = (sides: number) => 1 + Math.floor(Math.random() * sides);

type StatusInfo = {
  label: string;
  /** Como o alvo fica, ex.: "envenenado". */
  condition: string;
  /** Cor do texto do status (legível sobre o pergaminho). */
  color: string;
  emoji: string;
  rounds: number;
  /** Dano automático no início do turno de quem está afetado. */
  tickDie?: number;
  /** Quem está afetado perde o turno. */
  skipsTurn?: boolean;
  effect: string;
};

export const STATUS_INFO: Record<StatusType, StatusInfo> = {
  veneno: { label: 'Veneno', condition: 'envenenado', color: '#7B2FBE', emoji: '🧪', rounds: 3, tickDie: 4, effect: '1d4 de dano por turno, 3 turnos' },
  queimadura: { label: 'Queimadura', condition: 'queimado', color: '#C62828', emoji: '🔥', rounds: 2, tickDie: 6, effect: '1d6 de dano por turno, 2 turnos' },
  congelamento: { label: 'Congelamento', condition: 'congelado', color: '#1565C0', emoji: '❄️', rounds: 1, skipsTurn: true, effect: 'perde o próximo turno' },
  atordoamento: { label: 'Atordoamento', condition: 'atordoado', color: '#B8860B', emoji: '💫', rounds: 1, skipsTurn: true, effect: 'perde o próximo turno' },
};

export const STATUS_TYPES = Object.keys(STATUS_INFO) as StatusType[];

/** Adiciona (ou renova) um status. */
export function addStatus(statuses: ActiveStatus[], type: StatusType): ActiveStatus[] {
  return [...statuses.filter((s) => s.type !== type), { type, roundsLeft: STATUS_INFO[type].rounds }];
}

/** Soma itens com o mesmo nome em vez de duplicar a entrada no inventário. */
export function addToInventory(inventory: Item[], items: Item[]): Item[] {
  const result = inventory.map((item) => ({ ...item }));
  for (const item of items) {
    if (!item.name.trim() || item.quantity <= 0) continue;
    const existing = result.find((i) => i.name.trim().toLowerCase() === item.name.trim().toLowerCase());
    if (existing) existing.quantity += item.quantity;
    else result.push({ ...item, id: newId() });
  }
  return result;
}

/** Nível máximo que um personagem pode alcançar. */
export const MAX_LEVEL = 100;

/** XP necessário para sair do nível atual. */
export const xpToNext = (level: number) => level * 100;

export const DEFAULT_ATTRIBUTES = ['Força', 'Agilidade', 'Inteligência'];

export function characterDefaults(): Omit<Character, 'id' | 'name' | 'age' | 'createdAt'> {
  return {
    race: '',
    abilities: [],
    inventory: [],
    gold: 100,
    level: 1,
    xp: 0,
    hp: 20,
    maxHp: 20,
    mana: 10,
    maxMana: 10,
    stamina: 10,
    maxStamina: 10,
    attributes: DEFAULT_ATTRIBUTES.map((name) => ({ id: newId(), name, value: 10 })),
    statuses: [],
  };
}

/** Preenche campos que não existiam em versões anteriores dos dados salvos. */
export const normalizeCharacter = (c: Character): Character => ({ ...characterDefaults(), ...c });

export const normalizeCodex = (c: Codex): Codex => ({
  ...c,
  members: c.members ?? [],
  monsters: c.monsters ?? [],
  shops: c.shops ?? [],
  abilities: (c.abilities ?? []).map((a) => ({ ...a, offeredTo: a.offeredTo ?? [] })),
  classes: (c.classes ?? []).map((k) => ({ ...k, offeredTo: k.offeredTo ?? [] })),
  battles: c.battles ?? [],
  levelUps: c.levelUps ?? [],
  startingItems: c.startingItems ?? [],
  allowFreeInventory: c.allowFreeInventory ?? false,
});

/**
 * Soma XP e cria um evento para cada nível ganho. Ao chegar no nível máximo,
 * o XP excedente é descartado e a barra fica travada no máximo.
 */
export function gainXp(character: Character, amount: number): { character: Character; events: LevelUpEvent[] } {
  let { level, xp } = character;
  xp += amount;
  const events: LevelUpEvent[] = [];
  while (level < MAX_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
    events.push({ id: newId(), characterId: character.id, level, resolved: false, rewards: [], createdAt: Date.now() });
  }
  if (level >= MAX_LEVEL) {
    level = MAX_LEVEL;
    xp = Math.min(xp, xpToNext(MAX_LEVEL));
  }
  return { character: { ...character, level, xp }, events };
}

/**
 * XP proporcional ao dano: quem causou mais dano recebe o máximo, quem não causou
 * dano recebe o mínimo. Mortos e quem fugiu recebem o mínimo.
 */
export function splitXp(
  participants: { characterId: string; damageDealt: number; out: boolean }[],
  min: number,
  max: number,
): Record<string, number> {
  const top = Math.max(0, ...participants.filter((p) => !p.out).map((p) => p.damageDealt));
  const result: Record<string, number> = {};
  for (const p of participants) {
    result[p.characterId] = p.out || top === 0 ? min : Math.round(min + ((max - min) * p.damageDealt) / top);
  }
  return result;
}

/** A cópia da habilidade na ficha (sem os dados de oferta do Codex). */
export const toCharacterAbility = ({ offeredTo: _o, classId: _c, ...ability }: CodexAbility): Ability => ability;

/**
 * Troca a classe do personagem: tira as habilidades da classe antiga e entrega as da nova.
 * Habilidades gerais (sem classe) ficam como estão.
 */
export function applyClass(character: Character, codex: Codex, classId: string | undefined): Character {
  const old = new Set(codex.abilities.filter((a) => a.classId && a.classId === character.classId).map((a) => a.id));
  const kept = character.abilities.filter((a) => !old.has(a.id));
  const added = classId
    ? codex.abilities.filter((a) => a.classId === classId && !kept.some((k) => k.id === a.id)).map(toCharacterAbility)
    : [];
  return { ...character, classId, abilities: [...kept, ...added] };
}

/** Classe dada a quem entra no Codex: a inicial escolhida pelo Mestre, ou a primeira criada. */
export const startingClassOf = (codex: Codex) =>
  codex.classes.find((k) => k.id === codex.startingClassId)?.id ?? codex.classes[0]?.id;
