import { newId } from './ids';
import {
  LEGACY_MONSTER_TURN,
  costLabel,
  type Ability,
  type AbilityKind,
  type ActionStatDef,
  type ActiveStatus,
  type Attribute,
  type BaseStatDef,
  type Battle,
  type Character,
  type CharacterSheet,
  type Codex,
  type CodexAbility,
  type Foe,
  type Item,
  type LevelUpEvent,
  type Participant,
  type ResourceDef,
  type ResourceKey,
  type StatusType,
} from './types';

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
    if (existing) {
      existing.quantity += item.quantity;
      if (!existing.photoUri && item.photoUri) existing.photoUri = item.photoUri;
    } else result.push({ ...item, id: newId() });
  }
  return result;
}

/** Nível máximo que um personagem pode alcançar. */
export const MAX_LEVEL = 100;

/** XP necessário para sair do nível atual. */
export const xpToNext = (level: number) => level * 100;

export const DEFAULT_ATTRIBUTES = ['Força', 'Agilidade', 'Inteligência'];

/** Valor de um status base deixado em branco pelo Mestre. */
export const DEFAULT_STAT = 10;

/** Campos de cada barra na ficha e o máximo usado quando o Mestre deixa o valor em branco. */
export const RESOURCE_FIELDS: Record<ResourceKey, { current: 'hp' | 'mana' | 'stamina'; max: 'maxHp' | 'maxMana' | 'maxStamina'; fallback: number }> = {
  hp: { current: 'hp', max: 'maxHp', fallback: 20 },
  mana: { current: 'mana', max: 'maxMana', fallback: 10 },
  stamina: { current: 'stamina', max: 'maxStamina', fallback: 10 },
};

export const RESOURCE_KEYS = Object.keys(RESOURCE_FIELDS) as ResourceKey[];

export const DEFAULT_RESOURCES: ResourceDef[] = [
  { key: 'hp', enabled: true, name: 'Vida', color: '#8A1519', icon: 'heart', editable: false },
  { key: 'mana', enabled: true, name: 'Mana', color: '#2D5C9A', icon: 'drop', editable: false },
  { key: 'stamina', enabled: true, name: 'Estamina', color: '#A8651A', icon: 'bolt', editable: false },
];

/** Ficha sugerida para um Codex novo; o Mestre edita tudo. */
export function defaultSheet(): CharacterSheet {
  const forca = newId();
  const movimento = newId();
  return {
    resources: DEFAULT_RESOURCES.map((r) => ({ ...r })),
    baseStats: [
      { id: forca, name: 'Força', abbr: 'FA', editable: false },
      { id: movimento, name: 'Movimento', abbr: 'MV', editable: false },
      { id: newId(), name: 'Inteligência', abbr: 'INT', editable: false },
    ],
    actionStats: [
      { id: newId(), name: 'Poder de ataque', abbr: 'PA', terms: [{ op: '+', statId: forca }, { op: '+', statId: movimento }] },
    ],
  };
}

/** As três barras do Codex, na ordem vida → mana → estamina (a vida sempre ligada). */
export function resourcesOf(codex: Partial<Pick<Codex, 'sheet'>> | undefined): ResourceDef[] {
  return RESOURCE_KEYS.map((key) => {
    const def = codex?.sheet?.resources?.find((r) => r.key === key) ?? DEFAULT_RESOURCES.find((r) => r.key === key)!;
    return key === 'hp' ? { ...def, enabled: true } : def;
  });
}

/** Barras ligadas no Codex. */
export const enabledResources = (codex: Partial<Pick<Codex, 'sheet'>> | undefined) => resourcesOf(codex).filter((r) => r.enabled);

/** Barra que paga a habilidade (mana para mágica, estamina para física); sem barra ligada, a habilidade não custa. */
export function abilityPool(codex: Partial<Pick<Codex, 'sheet'>> | undefined, kind: AbilityKind): ResourceDef | undefined {
  const def = resourcesOf(codex).find((r) => r.key === (kind === 'magica' ? 'mana' : 'stamina'));
  return def?.enabled ? def : undefined;
}

/** O personagem tem o bastante na barra para pagar a habilidade. */
export function canPay(character: Character, codex: Partial<Pick<Codex, 'sheet'>> | undefined, ability: Pick<Ability, 'kind' | 'cost'>) {
  const pool = abilityPool(codex, ability.kind);
  return !pool || character[RESOURCE_FIELDS[pool.key].current] >= ability.cost;
}

/** Custo da habilidade com o nome da barra do Codex (ex.: "5 mana"), ou "Sem custo" se a barra estiver desligada. */
export function abilityCost(ability: Pick<Ability, 'kind' | 'cost'>, codex: Partial<Pick<Codex, 'sheet'>> | undefined) {
  const pool = abilityPool(codex, ability.kind);
  return pool ? costLabel(ability, pool.name) : 'Sem custo';
}

export const baseStatValue = (character: Character, def: BaseStatDef) =>
  character.attributes.find((a) => a.id === def.id)?.value ?? def.base ?? DEFAULT_STAT;

/** Calcula a fórmula da esquerda para a direita (arredonda para baixo; divisão por zero dá zero). */
export function evaluateFormula(def: ActionStatDef, valueOf: (statId: string) => number): number {
  let total = 0;
  def.terms.forEach((term, i) => {
    const v = term.statId ? valueOf(term.statId) : (term.value ?? 0);
    if (i === 0) total = v;
    else if (term.op === '+') total += v;
    else if (term.op === '-') total -= v;
    else if (term.op === '×') total *= v;
    else total = v === 0 ? 0 : total / v;
  });
  return Math.floor(total);
}

/** Valor de um status de ação para o personagem. */
export function actionStatValue(character: Character, codex: Pick<Codex, 'sheet'>, def: ActionStatDef): number {
  const stats = codex.sheet.baseStats;
  return evaluateFormula(def, (id) => {
    const stat = stats.find((s) => s.id === id);
    return stat ? baseStatValue(character, stat) : 0;
  });
}

/** Texto da fórmula com as siglas, ex.: "FA + MV". */
export function formulaText(def: ActionStatDef, stats: BaseStatDef[]): string {
  return def.terms
    .map((term, i) => {
      const stat = stats.find((s) => s.id === term.statId);
      const part = term.statId ? stat?.abbr || stat?.name || '?' : String(term.value ?? 0);
      return i === 0 ? part : `${term.op} ${part}`;
    })
    .join(' ');
}

/** Atributos extras (dados ao subir de nível) que não são status base do Codex. */
export const extraAttributes = (character: Character, codex: Pick<Codex, 'sheet'> | undefined): Attribute[] =>
  character.attributes.filter((a) => !codex?.sheet.baseStats.some((s) => s.id === a.id));

/**
 * O que só existe dentro de um Codex (itens, moedas, atributos, classe, habilidades, nível).
 * Fora de um Codex o personagem fica só com a aparência e a história.
 */
export function withoutCodex(c: Character): Character {
  return {
    ...c,
    codexId: undefined,
    classId: undefined,
    abilities: [],
    inventory: [],
    mountIds: [],
    gold: 0,
    level: 1,
    xp: 0,
    hp: 0,
    maxHp: 0,
    mana: 0,
    maxMana: 0,
    stamina: 0,
    maxStamina: 0,
    attributes: [],
    statuses: [],
    dismissedLevelUps: [],
  };
}

/** Personagem entrando no Codex: recebe a ficha do Mestre (barras, status base, moedas, itens e classe inicial). */
export function enterCodex(c: Character, codex: Codex): Character {
  const bars: Partial<Character> = {};
  for (const r of resourcesOf(codex)) {
    const { current, max, fallback } = RESOURCE_FIELDS[r.key];
    const value = r.enabled ? (r.base ?? fallback) : 0;
    bars[current] = value;
    bars[max] = value;
  }
  const entered: Character = {
    ...withoutCodex(c),
    ...bars,
    codexId: codex.id,
    gold: codex.startingGold ?? 0,
    inventory: addToInventory([], codex.startingItems),
    attributes: codex.sheet.baseStats.map((s) => ({ id: s.id, name: s.name, value: s.base ?? DEFAULT_STAT })),
  };
  return applyClass(entered, codex, startingClassOf(codex));
}

/**
 * O Mestre mudou a ficha do Codex: status base novos entram na ficha de quem já está nele
 * e os apagados saem. Barras desligadas zeram; barras religadas voltam ao valor inicial.
 */
export function applySheet(c: Character, before: CharacterSheet, after: CharacterSheet): Character {
  const removed = new Set(before.baseStats.filter((s) => !after.baseStats.some((x) => x.id === s.id)).map((s) => s.id));
  const attributes = c.attributes.filter((a) => !removed.has(a.id));
  for (const s of after.baseStats) {
    const existing = attributes.find((a) => a.id === s.id);
    if (existing) existing.name = s.name;
    else attributes.push({ id: s.id, name: s.name, value: s.base ?? DEFAULT_STAT });
  }
  const next: Character = { ...c, attributes: attributes.map((a) => ({ ...a })) };
  const was = resourcesOf({ sheet: before });
  for (const r of resourcesOf({ sheet: after })) {
    const { current, max, fallback } = RESOURCE_FIELDS[r.key];
    const enabledBefore = was.find((x) => x.key === r.key)?.enabled;
    if (!r.enabled) {
      next[current] = 0;
      next[max] = 0;
    } else if (!enabledBefore) {
      next[current] = r.base ?? fallback;
      next[max] = r.base ?? fallback;
    }
  }
  return next;
}

export function characterDefaults(): Omit<Character, 'id' | 'name' | 'age' | 'createdAt'> {
  return {
    race: '',
    abilities: [],
    inventory: [],
    mountIds: [],
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

/** Batalha salva nas versões com um monstro só (campos `monster*` e o turno "monstro"). */
type LegacyBattle = Omit<Battle, 'foes' | 'participants'> & {
  foes?: Foe[];
  participants: (Omit<Participant, 'observedIds'> & { observedIds?: string[]; observed?: boolean })[];
  monsterId?: string;
  monsterHp?: number;
  monsterMaxHp?: number;
  monsterAbilityId?: string;
  monsterCondition?: string;
  monsterStatuses?: ActiveStatus[];
};

/** Converte batalhas antigas (um monstro) para a lista de monstros. */
export function normalizeBattle(b: Battle): Battle {
  const legacy = b as LegacyBattle;
  if (legacy.foes) return b;
  const { monsterId = '', monsterHp = 0, monsterMaxHp = 0, monsterAbilityId, monsterCondition, monsterStatuses, ...rest } = legacy;
  const rename = (id: string) => (id === LEGACY_MONSTER_TURN ? monsterId : id);
  return {
    ...rest,
    foes: [
      {
        monsterId,
        hp: monsterHp,
        maxHp: monsterMaxHp,
        statuses: monsterStatuses ?? [],
        condition: monsterCondition ?? '',
        ...(monsterAbilityId ? { abilityId: monsterAbilityId } : {}),
      },
    ],
    order: rest.order.map(rename),
    initiatives: Object.fromEntries(Object.entries(rest.initiatives).map(([id, n]) => [rename(id), n])),
    participants: rest.participants.map(({ observed, observedIds, ...p }) => ({
      ...p,
      observedIds: observedIds ?? (observed ? [monsterId] : []),
    })),
    ...(rest.pending ? { pending: { ...rest.pending, targetId: rest.pending.targetId ?? monsterId } } : {}),
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
  mounts: c.mounts ?? [],
  battles: (c.battles ?? []).map(normalizeBattle),
  levelUps: c.levelUps ?? [],
  startingItems: c.startingItems ?? [],
  allowFreeInventory: c.allowFreeInventory ?? false,
  // Codex antigos já liberavam a edição pelos status marcados.
  allowStatEdit: c.allowStatEdit ?? true,
  // Codex antigos: as três barras de sempre; os atributos que cada personagem já tinha aparecem como extras.
  sheet: {
    resources: resourcesOf(c),
    baseStats: c.sheet?.baseStats ?? [],
    actionStats: (c.sheet?.actionStats ?? []).map((a) => ({ ...a, terms: a.terms ?? [] })),
  },
  currencyName: c.currencyName || 'Ouro',
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

/** Montarias do Codex que o personagem tem. */
export const mountsOf = (character: Character, codex: Codex | undefined) =>
  codex ? codex.mounts.filter((m) => character.mountIds.includes(m.id)) : [];

/**
 * Habilidades do personagem separadas por categoria. As de classe e gerais ficam na ficha
 * (cópias das do Codex); as de montaria vêm das montarias que ele tem.
 */
export function abilityGroups(character: Character, codex: Codex | undefined) {
  const classIds = new Set(codex?.abilities.filter((a) => a.classId).map((a) => a.id));
  return {
    classe: character.abilities.filter((a) => classIds.has(a.id)),
    geral: character.abilities.filter((a) => !classIds.has(a.id)),
    montaria: mountsOf(character, codex).map((mount) => ({ mount, abilities: mount.abilities })),
  };
}

/** Procura uma habilidade do personagem, inclusive as das montarias dele. */
export const findAbility = (character: Character | undefined, codex: Codex | undefined, abilityId: string | undefined) =>
  !character || !abilityId
    ? undefined
    : (character.abilities.find((a) => a.id === abilityId) ??
      mountsOf(character, codex).flatMap((m) => m.abilities).find((a) => a.id === abilityId));

/** Classe dada a quem entra no Codex: a inicial escolhida pelo Mestre (ou nenhuma). */
export const startingClassOf = (codex: Codex) => codex.classes.find((k) => k.id === codex.startingClassId)?.id;
