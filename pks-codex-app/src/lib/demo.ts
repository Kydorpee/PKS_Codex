/**
 * Dados de demonstração: personagens, um Codex completo e uma batalha em andamento,
 * para ver todas as telas sem cadastrar nada.
 */
import { setMonsterDisplay, startBattle, type Data, type Result } from './engine';
import { newCodexCode, newId } from './ids';
import { ABILITY_PRESETS, MONSTER_PRESETS, SHOP_PRESETS, abilityFromSeed, monsterFromPreset, shopFromPreset } from './presets';
import { characterDefaults } from './rules';
import { MAX_CHARACTERS, type Ability, type Character, type Codex, type CodexAbility, type Item } from './types';

const item = (name: string, quantity: number, description = ''): Item => ({ id: newId(), name, quantity, description });

const strip = ({ offeredTo: _, ...ability }: CodexAbility): Ability => ability;

export function loadDemo(data: Data): Result {
  const free = MAX_CHARACTERS - data.characters.length;
  if (free < 3) {
    return { error: `A demonstração cria 3 personagens e você só tem ${Math.max(0, free)} vaga(s). Apague alguns personagens antes.` };
  }

  const codexId = newId();
  const abilities: CodexAbility[] = ABILITY_PRESETS.map((seed) => ({ ...abilityFromSeed(seed), offeredTo: [] }));
  const byName = (name: string) => abilities.find((a) => a.name === name)!;

  const hero = (name: string, age: string, patch: Partial<Character>, owned: string[]): Character => ({
    id: newId(),
    name,
    age,
    createdAt: Date.now(),
    ...characterDefaults(),
    codexId,
    ...patch,
    abilities: owned.map((n) => strip(byName(n))),
  });

  const aria = hero(
    'Aria (demo)',
    '24',
    { level: 2, xp: 60, hp: 18, maxHp: 25, mana: 9, maxMana: 15, gold: 140, inventory: [item('Poção de cura', 2), item('Grimório antigo', 1)] },
    ['Bola de Fogo', 'Raio Gélido', 'Mísseis Mágicos'],
  );
  const bram = hero(
    'Bram (demo)',
    '31',
    { level: 2, xp: 0, hp: 9, maxHp: 30, stamina: 14, maxStamina: 16, gold: 60, inventory: [item('Espada longa', 1), item('Escudo', 1)] },
    ['Golpe Poderoso', 'Investida'],
  );
  const lia = hero(
    'Lia (demo)',
    '19',
    { hp: 4, maxHp: 20, gold: 250, inventory: [item('Arco curto', 1), item('Flechas (20)', 3), item('Tocha', 2)] },
    ['Tiro Certeiro', 'Lâmina Envenenada'],
  );
  const heroes = [aria, bram, lia];

  // Ofertas pendentes para o jogador aceitar ou recusar.
  byName('Cura').offeredTo.push(lia.id, aria.id);
  byName('Esquiva').offeredTo.push(bram.id);

  const shops = SHOP_PRESETS.map(shopFromPreset);
  shops[0].visibleTo = [bram.id, lia.id];
  shops[1].visibleTo = heroes.map((h) => h.id);
  shops[2].visibleTo = [aria.id];

  const monsters = ['goblin', 'aranha', 'troll', 'dragao'].map((key) => monsterFromPreset(MONSTER_PRESETS.find((p) => p.key === key)!));

  const codex: Codex = {
    id: codexId,
    code: newCodexCode(data.codexes.map((c) => c.code)),
    name: 'A Queda de Valdoria (demo)',
    members: [],
    description: 'Campanha de demonstração: explore monstros, lojas, habilidades e uma batalha em andamento.',
    monsters,
    shops,
    abilities,
    classes: [],
    battles: [],
    // Bram acabou de subir de nível e aguarda o evento do Mestre.
    levelUps: [{ id: newId(), characterId: bram.id, level: 2, resolved: false, rewards: [], createdAt: Date.now() }],
    startingItems: [],
    allowFreeInventory: false,
    createdAt: Date.now(),
  };

  const seeded: Data = { characters: [...data.characters, ...heroes], codexes: [...data.codexes, codex] };

  // Batalha em andamento contra a Aranha Gigante e o Goblin, na floresta à noite.
  const [goblin, spider] = monsters;
  const battle = startBattle(seeded, codexId, [spider.id, goblin.id], [aria.id, bram.id], 'floresta-noite');
  if ('error' in battle) return battle;
  const battleId = battle.data.codexes.find((c) => c.id === codexId)!.battles[0].id;
  return setMonsterDisplay(battle.data, codexId, battleId, spider.id, spider.abilities[1]?.id, 'Faminta e irritada');
}
