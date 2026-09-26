import { newId } from './ids';
import type { ActiveStatus, Character, Codex, LevelUpEvent, StatusType } from './types';

export const DICE = [4, 6, 8, 10, 12, 20] as const;

export const rollDie = (sides: number) => 1 + Math.floor(Math.random() * sides);

type StatusInfo = {
  label: string;
  emoji: string;
  rounds: number;
  /** Dano automático no início do turno de quem está afetado. */
  tickDie?: number;
  /** Quem está afetado perde o turno. */
  skipsTurn?: boolean;
  effect: string;
};

export const STATUS_INFO: Record<StatusType, StatusInfo> = {
  veneno: { label: 'Veneno', emoji: '🧪', rounds: 3, tickDie: 4, effect: '1d4 de dano por turno, 3 turnos' },
  queimadura: { label: 'Queimadura', emoji: '🔥', rounds: 2, tickDie: 6, effect: '1d6 de dano por turno, 2 turnos' },
  congelamento: { label: 'Congelamento', emoji: '❄️', rounds: 1, skipsTurn: true, effect: 'perde o próximo turno' },
  atordoamento: { label: 'Atordoamento', emoji: '💫', rounds: 1, skipsTurn: true, effect: 'perde o próximo turno' },
};

export const STATUS_TYPES = Object.keys(STATUS_INFO) as StatusType[];

/** Adiciona (ou renova) um status. */
export function addStatus(statuses: ActiveStatus[], type: StatusType): ActiveStatus[] {
  return [...statuses.filter((s) => s.type !== type), { type, roundsLeft: STATUS_INFO[type].rounds }];
}

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
  battles: c.battles ?? [],
  levelUps: c.levelUps ?? [],
});

/** Soma XP e cria um evento para cada nível ganho. */
export function gainXp(character: Character, amount: number): { character: Character; events: LevelUpEvent[] } {
  let { level, xp } = character;
  xp += amount;
  const events: LevelUpEvent[] = [];
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
    events.push({ id: newId(), characterId: character.id, level, resolved: false, rewards: [], createdAt: Date.now() });
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
