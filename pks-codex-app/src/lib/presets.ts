import { newId } from './ids';
import type { Ability, AbilityKind, Item, Monster, Shop, ShopItem, StatusType } from './types';

type AbilitySeed = [
  name: string,
  description: string,
  baseDamage?: string,
  kind?: AbilityKind,
  cost?: number,
  status?: StatusType,
  statusChance?: number,
];
type ItemSeed = [name: string, quantity: number, description: string];
type ShopItemSeed = [name: string, price: number, description: string];

type MonsterPreset = {
  key: string;
  name: string;
  emoji: string;
  hitPoints: number;
  armor: number;
  abilities: AbilitySeed[];
  loot: ItemSeed[];
};

type ShopPreset = {
  key: string;
  name: string;
  emoji: string;
  items: ShopItemSeed[];
};

/** Monstros gerados previamente por IA, prontos para adicionar a um Codex. */
export const MONSTER_PRESETS: MonsterPreset[] = [
  {
    key: 'goblin',
    name: 'Goblin Saqueador',
    emoji: '👺',
    hitPoints: 7,
    armor: 13,
    abilities: [
      ['Fuga Ágil', 'Pode recuar ou se esconder como ação bônus.'],
      ['Adaga Enferrujada', 'Ataque corpo a corpo perfurante.', '1d6 + 2', 'fisica', 1],
    ],
    loot: [
      ['Moedas de cobre', 12, 'Um punhado de moedas sujas.'],
      ['Adaga enferrujada', 1, 'Ainda corta, mas não muito bem.'],
    ],
  },
  {
    key: 'lobo',
    name: 'Lobo das Sombras',
    emoji: '🐺',
    hitPoints: 15,
    armor: 13,
    abilities: [
      ['Faro Aguçado', 'Vantagem em testes de percepção por olfato.'],
      ['Tática de Matilha', 'Vantagem no ataque se um aliado estiver perto do alvo.'],
      ['Mordida', 'Alvo pode ser derrubado.', '2d4 + 2', 'fisica', 1],
    ],
    loot: [['Pele de lobo sombrio', 1, 'Pode ser vendida ou virar uma capa.']],
  },
  {
    key: 'esqueleto',
    name: 'Esqueleto Guerreiro',
    emoji: '💀',
    hitPoints: 13,
    armor: 14,
    abilities: [
      ['Morto-vivo', 'Imune a veneno e exaustão.'],
      ['Espada Curta', 'Golpe cortante.', '1d6 + 2', 'fisica', 1],
    ],
    loot: [
      ['Espada curta antiga', 1, 'Lâmina gasta com runas apagadas.'],
      ['Pó de osso', 2, 'Ingrediente para poções e rituais.'],
    ],
  },
  {
    key: 'orc',
    name: 'Orc Berserker',
    emoji: '👹',
    hitPoints: 30,
    armor: 13,
    abilities: [
      ['Fúria', 'Ao ficar com metade da vida, causa +2 de dano por ataque.'],
      ['Machado Grande', 'Golpe cortante pesado.', '1d12 + 3', 'fisica', 2],
    ],
    loot: [
      ['Machado grande', 1, 'Pesado, mas devastador.'],
      ['Moedas de prata', 8, 'Saque de alguma vila.'],
    ],
  },
  {
    key: 'aranha',
    name: 'Aranha Gigante',
    emoji: '🕷️',
    hitPoints: 26,
    armor: 14,
    abilities: [
      ['Teia', 'Prende o alvo; teste de Força CD 12 para escapar.'],
      ['Picada Venenosa', 'Perfurante com veneno.', '1d8 + 3', 'fisica', 2, 'veneno', 50],
      ['Escalar Paredes', 'Anda por paredes e tetos sem teste.'],
    ],
    loot: [
      ['Glândula de veneno', 1, 'Usada para envenenar lâminas.'],
      ['Seda de aranha', 3, 'Corda leve e resistente.'],
    ],
  },
  {
    key: 'troll',
    name: 'Troll da Ponte',
    emoji: '🧌',
    hitPoints: 84,
    armor: 15,
    abilities: [
      ['Regeneração', 'Recupera 10 PV por turno, exceto se sofrer dano de fogo ou ácido.'],
      ['Garras', 'Dois ataques por turno.', '2d6 + 4', 'fisica', 2],
    ],
    loot: [
      ['Sangue de troll', 1, 'Ingrediente raro para poções de cura.'],
      ['Bolsa de ouro', 1, 'Pedágio cobrado de viajantes: 50 moedas de ouro.'],
    ],
  },
  {
    key: 'mimico',
    name: 'Mímico',
    emoji: '🧰',
    hitPoints: 58,
    armor: 12,
    abilities: [
      ['Disfarce', 'Parece um baú comum até atacar.'],
      ['Adesivo', 'Quem tocar nele fica grudado.'],
      ['Pseudópode', 'Golpe de concussão.', '1d8 + 3', 'fisica', 1],
    ],
    loot: [
      ['Gema brilhante', 2, 'Estava presa dentro da criatura.'],
      ['Poção misteriosa', 1, 'Rótulo ilegível.'],
    ],
  },
  {
    key: 'dragao',
    name: 'Dragão Vermelho Jovem',
    emoji: '🐉',
    hitPoints: 178,
    armor: 18,
    abilities: [
      ['Sopro de Fogo', 'Cone de 9 m; Destreza CD 17 reduz à metade.', '16d6', 'magica', 10, 'queimadura', 60],
      ['Voo', 'Voa 24 m por turno.'],
      ['Presença Aterradora', 'Criaturas próximas testam Sabedoria ou ficam amedrontadas.'],
    ],
    loot: [
      ['Escama de dragão', 5, 'Material para armadura lendária.'],
      ['Tesouro do covil', 1, '500 moedas de ouro e joias.'],
      ['Dente de dragão', 1, 'Troféu valioso.'],
    ],
  },
];

/** Sugestões de habilidades que o Mestre pode adicionar ao Codex e editar. */
export const ABILITY_PRESETS: AbilitySeed[] = [
  ['Bola de Fogo', 'Explosão de fogo em uma área de 6 m.', '8d6', 'magica', 5, 'queimadura', 30],
  ['Raio Gélido', 'Raio de gelo que pode congelar o alvo.', '1d8', 'magica', 1, 'congelamento', 25],
  ['Cura', 'Recupera pontos de vida de um aliado (cura em vez de dano).', '1d8 + 3', 'magica', 3],
  ['Mísseis Mágicos', 'Três dardos de energia que nunca erram.', '3 × (1d4 + 1)', 'magica', 2],
  ['Golpe Poderoso', 'Ataque corpo a corpo com força total.', '2d8', 'fisica', 3, 'atordoamento', 15],
  ['Investida', 'Avança 6 m e ataca; pode derrubar o alvo.', '1d10', 'fisica', 2],
  ['Tiro Certeiro', 'Disparo à distância com vantagem.', '1d8 + 2', 'fisica', 2],
  ['Lâmina Envenenada', 'Corte que pode envenenar o alvo.', '1d6', 'fisica', 2, 'veneno', 40],
  ['Esquiva', 'Ataques contra você têm desvantagem até o próximo turno.', '0', 'fisica', 1],
];

/** Lojas prontas que o Mestre pode adicionar e depois editar. */
export const SHOP_PRESETS: ShopPreset[] = [
  {
    key: 'armas',
    name: 'Loja de Armas',
    emoji: '⚔️',
    items: [
      ['Adaga', 2, '1d4 perfurante, leve e arremessável.'],
      ['Espada curta', 10, '1d6 perfurante.'],
      ['Espada longa', 15, '1d8 cortante.'],
      ['Arco curto', 25, '1d6 perfurante, alcance 24 m.'],
      ['Flechas (20)', 1, 'Munição para arco.'],
      ['Escudo', 10, '+2 de armadura.'],
    ],
  },
  {
    key: 'geral',
    name: 'Loja Geral',
    emoji: '🏪',
    items: [
      ['Corda (15 m)', 1, 'Corda de cânhamo.'],
      ['Tocha', 1, 'Ilumina por 1 hora.'],
      ['Ração de viagem', 1, 'Comida para um dia.'],
      ['Saco de dormir', 1, 'Para descansar na estrada.'],
      ['Mochila', 2, 'Carrega seus pertences.'],
    ],
  },
  {
    key: 'pocoes',
    name: 'Loja de Poções',
    emoji: '🧪',
    items: [
      ['Poção de cura', 50, 'Recupera 2d4 + 2 PV.'],
      ['Poção de cura maior', 150, 'Recupera 4d4 + 4 PV.'],
      ['Antídoto', 25, 'Remove um veneno.'],
      ['Poção de força', 100, '+2 em Força por 1 hora.'],
    ],
  },
];

export const abilityFromSeed = ([name, description, baseDamage = '', kind = 'fisica', cost = 0, status, statusChance]: AbilitySeed): Ability => ({
  id: newId(),
  name,
  description,
  baseDamage,
  kind,
  cost,
  status,
  statusChance: status ? statusChance ?? 0 : undefined,
});

const abilitiesFrom = (seeds: AbilitySeed[]): Ability[] => seeds.map(abilityFromSeed);

const itemsFrom = (seeds: ItemSeed[]): Item[] =>
  seeds.map(([name, quantity, description]) => ({ id: newId(), name, quantity, description }));

const shopItemsFrom = (seeds: ShopItemSeed[]): ShopItem[] =>
  seeds.map(([name, price, description]) => ({ id: newId(), name, price, description }));

export function monsterFromPreset(preset: MonsterPreset): Monster {
  return {
    id: newId(),
    name: preset.name,
    emoji: preset.emoji,
    hitPoints: preset.hitPoints,
    armor: preset.armor,
    abilities: abilitiesFrom(preset.abilities),
    loot: itemsFrom(preset.loot),
    source: 'bestiario',
    defeated: false,
  };
}

export function shopFromPreset(preset: ShopPreset): Shop {
  return {
    id: newId(),
    name: preset.name,
    emoji: preset.emoji,
    items: shopItemsFrom(preset.items),
    visibleTo: [],
  };
}
