import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BattleLog, DicePanel, MonsterPanel, ParticipantList, TurnOrder } from './battle';
import { LootPanel } from './loot-panel';
import { CharacterBars } from './character-stats';
import { CostIcon, DamageStat, IconStat, StarIcon } from './monster-stats';
import { TerrainPicker } from './pixel-scene';
import { Button, Card, Muted, SectionHeader, text } from './ui';
import {
  awardXp,
  currentTurn,
  endBattle,
  isOut,
  monsterAction,
  playerAction,
  resolveAction,
  rollBattleDie,
  setMonsterDisplay,
  setTerrain,
  skipTurn,
  type Data,
  type PlayerAction,
  type Result,
} from '@/lib/engine';
import { STATUS_INFO } from '@/lib/rules';
import { useStore } from '@/lib/store';
import { colors, radius, spacing } from '@/lib/theme';
import { MONSTER_TURN, costLabel, type Ability, type Battle, type Character, type Codex, type Monster } from '@/lib/types';

const toInt = (v: string) => Math.max(0, parseInt(v.replace(/\D/g, ''), 10) || 0);

/**
 * A batalha inteira (dado, monstro, turnos, ações, participantes e registro), sem a moldura da tela.
 * Usada na rota da batalha e nas abas "Batalha" da ficha do personagem e do painel do Codex.
 * Sem `characterId`, mostra a visão do Mestre.
 */
export function BattleView({ codexId, battleId, characterId }: { codexId: string; battleId: string; characterId?: string }) {
  const { codexes, characters, act } = useStore();
  const codex = codexes.find((c) => c.id === codexId);
  const battle = codex?.battles.find((b) => b.id === battleId);
  const monster = codex?.monsters.find((m) => m.id === battle?.monsterId);

  if (!codex || !battle || !monster) return <Muted>Batalha não encontrada.</Muted>;

  const isMaster = !characterId;
  const viewer = characters.find((c) => c.id === characterId);
  const turn = currentTurn(battle);
  const run = (rule: (d: Data) => Result) => {
    const error = act(rule);
    if (error) Alert.alert('Ação inválida', error);
  };

  const canRoll = battle.status === 'ativa' && (isMaster || turn === characterId);
  const participant = battle.participants.find((p) => p.characterId === characterId);

  return (
    <>
      <DicePanel
        lastRoll={battle.lastRoll}
        canRoll={canRoll}
        onRoll={(sides) => run((d) => rollBattleDie(d, codex.id, battle.id, sides, isMaster ? 'Mestre' : (viewer?.name ?? '?')))}
      />

      <MonsterPanel monster={monster} battle={battle} reveal={isMaster || !!participant?.observed} />

      <Muted>Rodada {battle.round}</Muted>
      <TurnOrder battle={battle} monster={monster} characters={characters} />

      {battle.status === 'ativa' &&
        (isMaster ? (
          <MasterPanel codex={codex} battle={battle} monster={monster} characters={characters} run={run} />
        ) : viewer ? (
          <PlayerPanel codex={codex} battle={battle} viewer={viewer} characters={characters} run={run} />
        ) : null)}

      {battle.status === 'vitoria' && (
        <VictoryPanel codex={codex} battle={battle} characters={characters} isMaster={isMaster} run={run} />
      )}
      {battle.loot && <LootPanel codex={codex} battle={battle} characterId={characterId} />}
      {battle.status === 'encerrada' && (
        <Card>
          <Text style={text.strong}>🏳️ Batalha encerrada pelo Mestre.</Text>
        </Card>
      )}

      <SectionHeader title="Participantes" />
      <ParticipantList battle={battle} characters={characters} />

      <SectionHeader title="Registro" />
      <BattleLog battle={battle} />
    </>
  );
}

type PanelProps = {
  codex: Codex;
  battle: Battle;
  characters: Character[];
  run: (rule: (d: Data) => Result) => void;
};

function PlayerPanel({ codex, battle, viewer, characters, run }: PanelProps & { viewer: Character }) {
  const [menu, setMenu] = useState<'raiz' | 'atacar' | 'habilidade' | 'item'>('raiz');
  const [dice, setDice] = useState('');
  const turn = currentTurn(battle);
  const participant = battle.participants.find((p) => p.characterId === viewer.id);

  if (!participant) return <Muted>Você não participa desta batalha.</Muted>;
  if (participant.fled) return <Card><Text style={text.strong}>🏃 Você fugiu da batalha.</Text></Card>;
  if (viewer.hp <= 0) return <Card><Text style={text.strong}>☠️ Você caiu em batalha.</Text></Card>;

  if (battle.pending?.characterId === viewer.id) {
    return (
      <Card style={styles.turnCard}>
        <Text style={text.strong}>⏳ {battle.pending.label}</Text>
        <Muted>Aguardando o Mestre definir o resultado. Use o dado acima se o Mestre pedir.</Muted>
      </Card>
    );
  }

  if (turn !== viewer.id) {
    const who = turn === MONSTER_TURN ? 'do monstro' : `de ${characters.find((c) => c.id === turn)?.name ?? '?'}`;
    return (
      <Card>
        <Text style={text.strong}>Turno {who}</Text>
        <Muted>Aguarde a sua vez.</Muted>
      </Card>
    );
  }

  const act = (action: PlayerAction) => {
    run((d) => playerAction(d, codex.id, battle.id, viewer.id, action));
    setMenu('raiz');
    setDice('');
  };
  const diceValue = toInt(dice);

  return (
    <Card style={styles.turnCard}>
      <Text style={text.accentStrong}>⭐ Seu turno!</Text>
      <CharacterBars character={viewer} />
      {menu === 'raiz' && (
        <View style={styles.actions}>
          <Button title="⚔️ Atacar" onPress={() => setMenu('atacar')} />
          <Button variant="secondary" title="👁️ Observar" onPress={() => act({ kind: 'observar' })} />
          <Button variant="secondary" title="🏃 Fugir (d20 ≥ 10)" onPress={() => act({ kind: 'fugir' })} />
        </View>
      )}
      {(menu === 'atacar' || menu === 'habilidade') && (
        <View style={{ gap: 2 }}>
          <Muted>🎲 Valor do dado do ataque</Muted>
          <NumberInput value={dice} onChange={setDice} placeholder="Ex.: 15" />
          <Muted>Role o seu dado (ou o virtual acima) e digite o valor. O Mestre define o dano.</Muted>
        </View>
      )}
      {menu === 'atacar' && (
        <View style={styles.actions}>
          <Button title="👊 Golpe físico" disabled={!diceValue} onPress={() => act({ kind: 'fisico', dice: diceValue })} />
          <Button variant="secondary" icon={<CostIcon kind="magica" />} title="Habilidade" onPress={() => setMenu('habilidade')} />
          <Button variant="secondary" title="🎒 Usar item" onPress={() => setMenu('item')} />
          <Button variant="ghost" title="Voltar" onPress={() => setMenu('raiz')} />
        </View>
      )}
      {menu === 'habilidade' && (
        <View style={styles.actions}>
          {viewer.abilities.length === 0 && <Muted>Você ainda não tem habilidades.</Muted>}
          {viewer.abilities.map((a) => {
            const pool = a.kind === 'magica' ? viewer.mana : viewer.stamina;
            return (
              <Button
                key={a.id}
                variant="secondary"
                disabled={pool < a.cost || !diceValue}
                icon={<CostIcon kind={a.kind} />}
                title={`${a.name} · ${costLabel(a)}${a.status ? ` · ${STATUS_INFO[a.status].emoji}` : ''}`}
                onPress={() => act({ kind: 'habilidade', abilityId: a.id, dice: diceValue })}
              />
            );
          })}
          <Button variant="ghost" title="Voltar" onPress={() => setMenu('atacar')} />
        </View>
      )}
      {menu === 'item' && (
        <View style={styles.actions}>
          {viewer.inventory.length === 0 && <Muted>A bolsa está vazia.</Muted>}
          {viewer.inventory.map((i) => (
            <Button key={i.id} variant="secondary" title={`${i.name} (x${i.quantity})`} onPress={() => act({ kind: 'item', itemId: i.id })} />
          ))}
          <Button variant="ghost" title="Voltar" onPress={() => setMenu('atacar')} />
        </View>
      )}
    </Card>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

function NumberInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <TextInput
      style={styles.input}
      keyboardType="number-pad"
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      value={value}
      onChangeText={(v) => onChange(v.replace(/\D/g, ''))}
    />
  );
}

/** Chance de status informada ao Mestre antes de aplicar o dano; o sorteio é do sistema. */
function StatusChance({ ability, target }: { ability?: Ability; target: string }) {
  if (!ability?.status || !ability.statusChance) return null;
  const info = STATUS_INFO[ability.status];
  return (
    <View style={[styles.chance, { borderColor: info.color }]}>
      <Text style={[text.strong, { color: info.color }]}>
        {info.emoji} {ability.statusChance}% de chance de deixar {target} {info.condition}
      </Text>
      <Muted>Ao aplicar o dano, o sistema sorteia o status ({info.effect}).</Muted>
    </View>
  );
}

function MasterPanel({ codex, battle, monster, characters, run }: PanelProps & { monster: Monster }) {
  const turn = currentTurn(battle);
  const alive = battle.participants
    .map((p) => characters.find((c) => c.id === p.characterId))
    .filter((c): c is Character => !!c && !isOut(battle, c));

  const [amount, setAmount] = useState('');
  const [dice, setDice] = useState('');
  // Cura: aberta pelo botão "Curar"; alvos (personagens e/ou o monstro) e quanto curar.
  const [healing, setHealing] = useState(false);
  const [healIds, setHealIds] = useState<string[]>([]);
  const [healAmount, setHealAmount] = useState('');
  const [abilityId, setAbilityId] = useState<string | undefined>(battle.monsterAbilityId);
  const [targetId, setTargetId] = useState<string | undefined>();
  const [condition, setCondition] = useState(battle.monsterCondition);

  const pending = battle.pending;
  const pendingCharacter = characters.find((c) => c.id === pending?.characterId);
  const pendingAbility = pendingCharacter?.abilities.find((a) => a.id === pending?.abilityId);
  const monsterAbility = monster.abilities.find((a) => a.id === abilityId);

  const resolve = (res: Parameters<typeof resolveAction>[3]) => {
    run((d) => resolveAction(d, codex.id, battle.id, res));
    setAmount('');
    setHealing(false);
    setHealIds([]);
    setHealAmount('');
  };
  const toggleHeal = (id: string) => setHealIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const confirmEnd = () =>
    Alert.alert('Encerrar batalha?', 'Ninguém recebe XP se a batalha for encerrada sem vitória.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Encerrar', style: 'destructive', onPress: () => run((d) => endBattle(d, codex.id, battle.id)) },
    ]);

  return (
    <>
      {pending ? (
        <Card style={styles.turnCard}>
          <Text style={text.strong}>
            {pendingCharacter?.name}: {pending.label}
          </Text>
          {pending.dice !== undefined && <Text style={text.accentStrong}>🎲 Dado do jogador: {pending.dice}</Text>}
          {pendingAbility && <DamageStat damage={pendingAbility.baseDamage} />}
          <StatusChance ability={pendingAbility} target={monster.name} />
          {healing ? (
            <View style={styles.actions}>
              <Text style={text.strong}>💚 Quem deve ser curado?</Text>
              <View style={styles.wrap}>
                {alive.map((c) => (
                  <Chip key={c.id} label={`${c.name} ❤️${c.hp}/${c.maxHp}`} active={healIds.includes(c.id)} onPress={() => toggleHeal(c.id)} />
                ))}
                <Chip
                  label={`👹 ${monster.name} ❤️${battle.monsterHp}/${battle.monsterMaxHp}`}
                  active={healIds.includes(MONSTER_TURN)}
                  onPress={() => toggleHeal(MONSTER_TURN)}
                />
              </View>
              <Muted>Quanto curar (cada alvo escolhido recebe este valor)</Muted>
              <NumberInput value={healAmount} onChange={setHealAmount} placeholder="Cura" />
              <Button
                title={`💚 Curar ${healIds.length || ''} alvo(s)`}
                disabled={healIds.length === 0 || !toInt(healAmount)}
                onPress={() => resolve({ type: 'cura', amount: toInt(healAmount), targetIds: healIds })}
              />
              <Button variant="ghost" title="Voltar para o dano" onPress={() => setHealing(false)} />
            </View>
          ) : (
            <>
              <Muted>Digite o dano gerado pelo ataque.</Muted>
              <NumberInput value={amount} onChange={setAmount} placeholder="Dano" />
              <Button title="💥 Causar dano no monstro" disabled={!amount} onPress={() => resolve({ type: 'dano', amount: toInt(amount) })} />
              <Button variant="secondary" title="💚 Curar" onPress={() => setHealing(true)} />
            </>
          )}
          <Button variant="ghost" title="Sem efeito" onPress={() => resolve({ type: 'nada' })} />
        </Card>
      ) : turn === MONSTER_TURN ? (
        <Card style={styles.turnCard}>
          <Text style={text.accentStrong}>👹 Turno do monstro</Text>
          <Muted>Habilidade</Muted>
          <View style={styles.wrap}>
            <Chip label="Ataque simples" active={!abilityId} onPress={() => setAbilityId(undefined)} />
            {monster.abilities.map((a) => (
              <Chip key={a.id} label={`${a.name}${a.status ? ` ${STATUS_INFO[a.status].emoji}` : ''}`} active={abilityId === a.id} onPress={() => setAbilityId(a.id)} />
            ))}
          </View>
          {monsterAbility && <DamageStat damage={monsterAbility.baseDamage} />}
          <Muted>Alvo</Muted>
          <View style={styles.wrap}>
            <Chip label="Nenhum" active={!targetId} onPress={() => setTargetId(undefined)} />
            {alive.map((c) => (
              <Chip key={c.id} label={`${c.name} ❤️${c.hp}`} active={targetId === c.id} onPress={() => setTargetId(c.id)} />
            ))}
          </View>
          {targetId && (
            <>
              <StatusChance ability={monsterAbility} target={alive.find((c) => c.id === targetId)?.name ?? 'o alvo'} />
              <View style={styles.inline}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Muted>🎲 Valor do dado</Muted>
                  <NumberInput value={dice} onChange={setDice} placeholder="Ex.: 15" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Muted>💥 Dano gerado</Muted>
                  <NumberInput value={amount} onChange={setAmount} placeholder="Dano" />
                </View>
              </View>
            </>
          )}
          <Button
            title={targetId ? '💥 Aplicar dano' : 'Executar turno do monstro'}
            disabled={!!targetId && (!toInt(dice) || !amount)}
            onPress={() => {
              run((d) => monsterAction(d, codex.id, battle.id, { abilityId, targetId, dice: toInt(dice), damage: toInt(amount) }));
              setAmount('');
              setDice('');
              setTargetId(undefined);
            }}
          />
        </Card>
      ) : (
        <Card>
          <Text style={text.strong}>Aguardando {characters.find((c) => c.id === turn)?.name ?? '?'} escolher a ação.</Text>
          <View style={styles.wrap}>
            <Button
              small
              variant="secondary"
              title="Abrir visão do jogador"
              onPress={() => router.push({ pathname: '/batalha/[id]', params: { id: battle.id, codexId: codex.id, characterId: turn } })}
            />
            <Button small variant="secondary" title="⏭️ Pular turno" onPress={() => run((d) => skipTurn(d, codex.id, battle.id))} />
          </View>
        </Card>
      )}

      <Card>
        <Text style={text.strong}>🗨️ Balão do monstro</Text>
        <View style={styles.wrap}>
          <Chip label="Nenhuma" active={!battle.monsterAbilityId} onPress={() => run((d) => setMonsterDisplay(d, codex.id, battle.id, undefined, condition))} />
          {monster.abilities.map((a) => (
            <Chip
              key={a.id}
              label={a.name}
              active={battle.monsterAbilityId === a.id}
              onPress={() => run((d) => setMonsterDisplay(d, codex.id, battle.id, a.id, condition))}
            />
          ))}
        </View>
        <View style={styles.inline}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Condição (ex.: Furioso, Ferido)"
            placeholderTextColor={colors.textMuted}
            value={condition}
            onChangeText={setCondition}
          />
          <Button
            small
            title="Atualizar"
            onPress={() => run((d) => setMonsterDisplay(d, codex.id, battle.id, battle.monsterAbilityId, condition.trim()))}
          />
        </View>
        <Muted>Status como veneno e congelamento são sorteados pelo sistema e não podem ser alterados.</Muted>
      </Card>

      <Card>
        <Text style={text.strong}>🗺️ Cenário</Text>
        <TerrainPicker value={battle.terrain} onChange={(t) => run((d) => setTerrain(d, codex.id, battle.id, t))} />
      </Card>

      <Button variant="danger" title="Encerrar batalha sem vitória" onPress={confirmEnd} />
    </>
  );
}

function VictoryPanel({
  codex,
  battle,
  characters,
  isMaster,
  run,
}: PanelProps & { isMaster: boolean }) {
  const [min, setMin] = useState('10');
  const [max, setMax] = useState('50');

  if (battle.xpAwarded) {
    return (
      <Card style={styles.turnCard}>
        <Text style={text.accentStrong}>🏆 Vitória! XP distribuído</Text>
        {Object.entries(battle.xpAwarded).map(([cid, xp]) => (
          <IconStat key={cid} icon={<StarIcon />}>
            <Text style={text.body}>
              {characters.find((c) => c.id === cid)?.name ?? '?'}: {xp} XP
            </Text>
          </IconStat>
        ))}
      </Card>
    );
  }

  if (!isMaster) {
    return (
      <Card style={styles.turnCard}>
        <Text style={text.accentStrong}>🏆 Vitória!</Text>
        <Muted>Aguardando o Mestre distribuir o XP.</Muted>
      </Card>
    );
  }

  return (
    <Card style={styles.turnCard}>
      <Text style={text.accentStrong}>🏆 Vitória! Distribuir XP</Text>
      <Muted>
        O XP é dividido conforme o dano causado: quem causou mais dano recebe o máximo. Personagens mortos ou que fugiram recebem o
        mínimo.
      </Muted>
      <View style={styles.inline}>
        <View style={{ flex: 1, gap: 2 }}>
          <Muted>XP mínimo</Muted>
          <NumberInput value={min} onChange={setMin} placeholder="Mínimo" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Muted>XP máximo</Muted>
          <NumberInput value={max} onChange={setMax} placeholder="Máximo" />
        </View>
      </View>
      <Button icon={<StarIcon />} title="Distribuir XP" onPress={() => run((d) => awardXp(d, codex.id, battle.id, toInt(min), toInt(max)))} />
    </Card>
  );
}

const styles = StyleSheet.create({
  turnCard: { borderColor: colors.primary, borderWidth: 2 },
  actions: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chance: {
    gap: 2,
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: radius.sm,
    padding: spacing.sm,
    backgroundColor: colors.surfaceRaised,
  },
  inline: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: { borderColor: colors.goldDim, backgroundColor: colors.gold },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
