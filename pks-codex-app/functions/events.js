/**
 * Descobre o que mudou num Codex e merece notificação push. Função pura (testada em tests/push.test.js).
 */
/** Turno do monstro nas batalhas antigas (um monstro por batalha). */
const LEGACY_MONSTER_TURN = 'monstro';

const turnKey = (b) => `${b.round}:${b.turnIndex}:${b.order[b.turnIndex]}`;

/**
 * @returns {Array<
 *   | { kind: 'turno', battleId: string, actor: string, monster: boolean, monsterName: string, round: number }
 *   | { kind: 'nivel', characterId: string, level: number, count: number, eventId: string }
 * >}
 */
function codexEvents(before, after) {
  if (!after) return [];
  const events = [];

  const previous = new Map((before?.battles ?? []).map((b) => [b.id, b]));
  for (const battle of after.battles ?? []) {
    if (battle.status !== 'ativa' || !battle.order?.length) continue;
    const prev = previous.get(battle.id);
    if (prev && prev.status === 'ativa' && turnKey(prev) === turnKey(battle)) continue;
    const nameOf = (id) => (after.monsters ?? []).find((m) => m.id === id)?.name ?? 'Monstro';
    // Batalhas novas têm a lista `foes`; as antigas, um `monsterId` e o turno "monstro".
    const foeIds = battle.foes ? battle.foes.map((f) => f.monsterId) : [battle.monsterId];
    const actor = battle.order[battle.turnIndex];
    const monster = actor === LEGACY_MONSTER_TURN || (!!battle.foes && foeIds.includes(actor));
    events.push({
      kind: 'turno',
      battleId: battle.id,
      actor,
      monster,
      // No turno de um monstro, o nome dele; no de um personagem, contra quem ele luta.
      monsterName: monster && actor !== LEGACY_MONSTER_TURN ? nameOf(actor) : foeIds.map(nameOf).join(', '),
      round: battle.round,
    });
  }

  // Várias subidas de uma vez (muito XP) viram um único aviso, com o nível final.
  const known = new Set((before?.levelUps ?? []).map((e) => e.id));
  const byCharacter = new Map();
  for (const e of after.levelUps ?? []) {
    if (known.has(e.id) || e.resolved) continue;
    const group = byCharacter.get(e.characterId);
    if (!group) byCharacter.set(e.characterId, { kind: 'nivel', characterId: e.characterId, level: e.level, count: 1, eventId: e.id });
    else {
      group.count += 1;
      group.level = Math.max(group.level, e.level);
    }
  }
  events.push(...byCharacter.values());
  return events;
}

module.exports = { codexEvents };
