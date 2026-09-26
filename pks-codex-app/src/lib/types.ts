/** Mágica custa mana; física custa estamina. */
export type AbilityKind = 'magica' | 'fisica';

/** Status que o sistema aplica por sorteio; o Mestre não pode alterar. */
export type StatusType = 'veneno' | 'congelamento' | 'queimadura' | 'atordoamento';

export type ActiveStatus = {
  type: StatusType;
  roundsLeft: number;
};

export type Ability = {
  id: string;
  name: string;
  description: string;
  kind: AbilityKind;
  /** Custo em mana (mágica) ou estamina (física). */
  cost: number;
  /** Dano base, ex.: "2d6 + 3". */
  baseDamage: string;
  /** Status que a habilidade pode causar no alvo. */
  status?: StatusType;
  /** Chance (0–100) de aplicar o status. */
  statusChance?: number;
};

/** Habilidade criada pelo Mestre no Codex e oferecida a personagens. */
export type CodexAbility = Ability & {
  /** Personagens que ainda precisam aceitar ou recusar a oferta. */
  offeredTo: string[];
};

export const costLabel = (a: Pick<Ability, 'kind' | 'cost'>) =>
  `${a.cost} ${a.kind === 'magica' ? 'mana' : 'estamina'}`;

export type Item = {
  id: string;
  name: string;
  quantity: number;
  description: string;
};

/** Atributo personalizável (Força, Destreza...): o jogador define na criação; o Mestre ajusta ao subir de nível. */
export type Attribute = {
  id: string;
  name: string;
  value: number;
};

export type Character = {
  id: string;
  /** Conta (Firebase) do jogador dono da ficha. Vazio até o primeiro salvamento. */
  ownerUid?: string;
  name: string;
  age: string;
  /** Raça do personagem (Humano, Elfo...), livre porque cada Codex tem as suas. */
  race: string;
  photoUri?: string;
  /** Somente leitura para o jogador: vêm de ofertas aceitas do Mestre. */
  abilities: Ability[];
  inventory: Item[];
  /** Dinheiro do jogo (moedas de ouro). */
  gold: number;
  /** Codex (campanha) em que o personagem entrou. */
  codexId?: string;
  createdAt: number;
  level: number;
  /** XP acumulado dentro do nível atual. */
  xp: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
  attributes: Attribute[];
  statuses: ActiveStatus[];
};

export type MonsterSource = 'bestiario' | 'manual';

export type Monster = {
  id: string;
  name: string;
  photoUri?: string;
  /** Emoji usado quando o monstro não tem foto (monstros do bestiário). */
  emoji?: string;
  hitPoints: number;
  armor: number;
  abilities: Ability[];
  /** Itens liberados para os jogadores quando o monstro morre. */
  loot: Item[];
  source: MonsterSource;
  defeated: boolean;
};

export type ShopItem = {
  id: string;
  name: string;
  description: string;
  price: number;
};

/** Local da campanha onde os personagens compram itens. */
export type Shop = {
  id: string;
  name: string;
  emoji: string;
  items: ShopItem[];
  /** Personagens que podem ver esta loja. */
  visibleTo: string[];
};

export type Participant = {
  characterId: string;
  initiative: number;
  damageDealt: number;
  fled: boolean;
  /** Usou "Observar": passa a ver os detalhes do monstro. */
  observed: boolean;
};

export type PendingAction = {
  characterId: string;
  kind: 'fisico' | 'habilidade' | 'item';
  label: string;
  abilityId?: string;
};

export type LogTone = 'info' | 'dano' | 'cura' | 'status' | 'dado';

export type LogEntry = {
  id: string;
  text: string;
  tone: LogTone;
};

export type Terrain =
  | 'planicie'
  | 'planicie-noite'
  | 'deserto'
  | 'deserto-noite'
  | 'gelo'
  | 'gelo-noite'
  | 'catacumbas'
  | 'floresta'
  | 'floresta-noite';

/** Na ordem de turnos, o monstro é representado por este id. */
export const MONSTER_TURN = 'monstro';

export type Battle = {
  id: string;
  monsterId: string;
  status: 'ativa' | 'vitoria' | 'encerrada';
  monsterHp: number;
  monsterMaxHp: number;
  /** Cenário exibido embaixo do monstro (escolhido pelo Mestre). */
  terrain: Terrain;
  /** Habilidade que aparece no balão do monstro (definida pelo Mestre). */
  monsterAbilityId?: string;
  /** Condição do monstro escrita pelo Mestre (ex.: "Furioso"). */
  monsterCondition: string;
  /** Status aplicados pelo sistema; o Mestre não altera. */
  monsterStatuses: ActiveStatus[];
  participants: Participant[];
  /** Ids de personagens e MONSTER_TURN, por iniciativa. */
  order: string[];
  initiatives: Record<string, number>;
  turnIndex: number;
  round: number;
  pending?: PendingAction;
  lastRoll?: { sides: number; value: number; by: string };
  log: LogEntry[];
  xpAwarded?: Record<string, number>;
  createdAt: number;
};

export type LevelUpEvent = {
  id: string;
  characterId: string;
  level: number;
  resolved: boolean;
  /** Resumo das recompensas definidas pelo Mestre. */
  rewards: string[];
  createdAt: number;
};

export type Codex = {
  id: string;
  /** Conta (Firebase) do Mestre. Vazio até o primeiro salvamento. */
  ownerUid?: string;
  /** Contas dos jogadores que entraram com o código; podem jogar as batalhas. */
  members: string[];
  /** Código curto que os jogadores digitam para entrar na campanha. */
  code: string;
  name: string;
  description: string;
  monsters: Monster[];
  shops: Shop[];
  abilities: CodexAbility[];
  battles: Battle[];
  levelUps: LevelUpEvent[];
  createdAt: number;
};

export const MAX_CHARACTERS = 5;
