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
  /** Foto da habilidade (data URI pequena). */
  photoUri?: string;
};

/** Habilidade criada pelo Mestre no Codex e oferecida a personagens. */
export type CodexAbility = Ability & {
  /** Personagens que ainda precisam aceitar ou recusar a oferta. */
  offeredTo: string[];
  /** Classe dona da habilidade: quem tem a classe recebe a habilidade. Sem classe, é oferecida um a um. */
  classId?: string;
};

/** Classe criada pelo Mestre (Guerreiro, Mago...), com as habilidades dela. */
export type CodexClass = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** Personagens para quem o Mestre liberou a troca para esta classe. */
  offeredTo: string[];
};

export const costLabel = (a: Pick<Ability, 'kind' | 'cost'>) =>
  `${a.cost} ${a.kind === 'magica' ? 'mana' : 'estamina'}`;

export type Item = {
  id: string;
  name: string;
  quantity: number;
  description: string;
  /** Foto do item ou arma (data URI pequena). */
  photoUri?: string;
};

/** Montaria criada pelo Mestre, com habilidades próprias. Dada pelo Mestre ou comprada numa loja. */
export type Mount = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  photoUri?: string;
  abilities: Ability[];
};

/** Categoria de uma habilidade do personagem: da classe, geral ou de uma montaria. */
export type AbilityCategory = 'classe' | 'geral' | 'montaria';

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
  /** Classe do personagem no Codex atual. */
  classId?: string;
  /** Montarias do Codex que o personagem tem. */
  mountIds: string[];
  /** Codex dos quais já recebeu o inventário inicial (não recebe de novo ao sair e voltar). */
  startingItemsFrom?: string[];
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
  /** Eventos de nível que o jogador já limpou do bloco da ficha. */
  dismissedLevelUps?: string[];
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
  photoUri?: string;
  /** Item que é uma montaria: comprar dá a montaria em vez de um item na bolsa. */
  mountId?: string;
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

/** Dado usado e o valor que saiu, ex.: d20 → 15. */
export type DiceRoll = { sides: number; value: number };

export const diceLabel = (roll: DiceRoll) => `d${roll.sides}: ${roll.value}`;

export type Participant = {
  characterId: string;
  initiative: number;
  damageDealt: number;
  fled: boolean;
  /** Monstros que o personagem observou ("Observar"): passa a ver os detalhes deles. */
  observedIds: string[];
  /** Usou "Defender": dado da defesa, que o Mestre considera ao decidir o dano do próximo ataque (até o seu próximo turno). */
  defense?: DiceRoll;
};

export type PendingAction = {
  characterId: string;
  kind: 'fisico' | 'habilidade' | 'item' | 'fuga';
  label: string;
  abilityId?: string;
  /** Valor do dado digitado pelo jogador ao atacar. */
  dice?: number;
  /** Dado usado no ataque (20 = d20). */
  diceSides?: number;
  /** Monstro atacado (id do monstro no Codex). */
  targetId?: string;
};

/** Último status aplicado pelo sistema na batalha; gera o aviso "Alvo (status)". */
export type StatusHit = {
  id: string;
  target: string;
  type: StatusType;
  chance: number;
  roll: number;
};

export type LogTone = 'info' | 'dano' | 'cura' | 'status' | 'dado';

export type LogEntry = {
  id: string;
  text: string;
  tone: LogTone;
  /** Linha sobre um status: usa a cor dele no registro. */
  status?: StatusType;
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
  | 'floresta-noite'
  | 'mar'
  | 'mar-noite';

/**
 * Espólios dos monstros derrotados. Cada personagem vivo tem uma vez (na ordem da batalha)
 * para pegar itens e passar a vez; depois da última vez, o que sobrou é apagado.
 */
export type Loot = {
  items: Item[];
  /** Personagens com direito a pegar, na ordem da batalha. */
  order: string[];
  turnIndex: number;
  done: boolean;
};

/** Na ordem de turnos das versões antigas (um monstro por batalha), o monstro era este id. */
export const LEGACY_MONSTER_TURN = 'monstro';

/** Até quantos monstros entram numa mesma batalha. */
export const MAX_FOES = 4;

/** Monstro em combate: cada um tem vida, status, balão e turno próprios. */
export type Foe = {
  /** Id do monstro no Codex; é também o id dele na ordem de turnos. */
  monsterId: string;
  hp: number;
  maxHp: number;
  /** Status aplicados pelo sistema; o Mestre não altera. */
  statuses: ActiveStatus[];
  /** Habilidade que aparece no balão do monstro (definida pelo Mestre). */
  abilityId?: string;
  /** Condição do monstro escrita pelo Mestre (ex.: "Furioso"). */
  condition: string;
};

/** Efeito visual de um alvo na última ação (tremor, número flutuante). */
export type Hit = { targetId: string; kind: 'dano' | 'cura' | 'errou'; amount: number; defended?: boolean };

export type Battle = {
  id: string;
  status: 'ativa' | 'vitoria' | 'encerrada';
  foes: Foe[];
  /** Cenário exibido embaixo dos monstros (escolhido pelo Mestre). */
  terrain: Terrain;
  participants: Participant[];
  /** Ids de personagens e de monstros, por iniciativa. */
  order: string[];
  initiatives: Record<string, number>;
  turnIndex: number;
  round: number;
  pending?: PendingAction;
  lastStatus?: StatusHit;
  lastRoll?: { id?: string; sides: number; value: number; by: string };
  /** O que a última ação causou em cada alvo; `id` muda a cada ação, para as animações. */
  fx?: { id: string; hits: Hit[] };
  log: LogEntry[];
  xpAwarded?: Record<string, number>;
  /** Local "Espólios": itens dos monstros derrotados, pegos em turnos. */
  loot?: Loot;
  createdAt: number;
};

export type LevelUpEvent = {
  id: string;
  characterId: string;
  level: number;
  resolved: boolean;
  /** Resumo das recompensas definidas pelo Mestre. */
  rewards: string[];
  /** O Mestre limpou este evento (já concluído) do bloco de eventos. */
  hiddenForMaster?: boolean;
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
  classes: CodexClass[];
  /** Montarias criadas pelo Mestre. */
  mounts: Mount[];
  /** Classe atribuída a quem entra no Codex. */
  startingClassId?: string;
  battles: Battle[];
  levelUps: LevelUpEvent[];
  /** Itens que todo personagem recebe ao entrar no Codex. */
  startingItems: Item[];
  /** Regra do Mestre: jogadores podem adicionar itens na própria bolsa, além de comprar. */
  allowFreeInventory: boolean;
  createdAt: number;
};

export const MAX_CHARACTERS = 5;
