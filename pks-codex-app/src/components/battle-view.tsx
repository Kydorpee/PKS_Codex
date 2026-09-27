import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BattleLog, DicePanel, MonsterPanel, ParticipantList, TurnOrder } from './battle';
import { Pulse } from './battle-fx';
import { LootPanel } from './loot-panel';
import { CharacterBars } from './character-stats';
import { CostIcon, DamageStat, IconStat, StarIcon } from './monster-stats';
import { TerrainPicker } from './pixel-scene';
import { Button, Card, Muted, SectionHeader, text } from './ui';
import {
  aliveFoes,
  awardXp,
  currentTurn,
  endBattle,
  foeOf,
  isOffensive,
  isOut,
  monsterAction,
  playerAction,
  resolveAction,
  resolveFlee,
  reviveCharacter,
  rollBattleDie,
  setMonsterDisplay,
  setTerrain,
  skipTurn,
  type Data,
  type PlayerAction,
  type Result,
} from '@/lib/engine';
import { abilityGroups, DICE, findAbility, STATUS_INFO, STATUS_TYPES } from '@/lib/rules';
import { useT } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { colors, radius, spacing } from '@/lib/theme';
import { costLabel, diceLabel, type Ability, type Battle, type Character, type Codex, type AbilityCategory, type DiceRoll, type Foe, type StatusType } from '@/lib/types';

const toInt = (v: string) => Math.max(0, parseInt(v.replace(/\D/g, ''), 10) || 0);

/**
 * A batalha inteira (dado, monstros, turnos, ações, participantes e registro), sem a moldura da tela.
 * Usada na rota da batalha e nas abas "Batalha" da ficha do personagem e do painel do Codex.
 * Sem `characterId`, mostra a visão do Mestre.
 */
export function BattleView({ codexId, battleId, characterId }: { codexId: string; battleId: string; characterId?: string }) {
  const { t, tx } = useT();
  const { codexes, characters, act } = useStore();
  const codex = codexes.find((c) => c.id === codexId);
  const battle = codex?.battles.find((b) => b.id === battleId);

  if (!codex || !battle) return <Muted>{t('Batalha não encontrada.')}</Muted>;

  const isMaster = !characterId;
  const viewer = characters.find((c) => c.id === characterId);
  const turn = currentTurn(battle);
  const run = (rule: (d: Data) => Result) => {
    const error = act(rule);
    if (error) Alert.alert(t('Ação inválida'), tx(error));
  };

  const canRoll = battle.status === 'ativa' && (isMaster || turn === characterId);
  const participant = battle.participants.find((p) => p.characterId === characterId);

  return (
    <>
      <DicePanel
        lastRoll={battle.lastRoll}
        canRoll={canRoll}
        onRoll={(sides) => run((d) => rollBattleDie(d, codex.id, battle.id, sides, isMaster ? t('Mestre') : (viewer?.name ?? '?')))}
      />

      <MonsterPanel battle={battle} monsters={codex.monsters} reveal={(id) => isMaster || !!participant?.observedIds.includes(id)} />

      <Muted>{t('Rodada {n}', { n: battle.round })}</Muted>
      <TurnOrder battle={battle} monsters={codex.monsters} characters={characters} />

      {battle.status === 'ativa' &&
        (isMaster ? (
          <MasterPanel codex={codex} battle={battle} characters={characters} run={run} />
        ) : viewer ? (
          <PlayerPanel codex={codex} battle={battle} viewer={viewer} characters={characters} run={run} />
        ) : null)}

      {battle.status === 'vitoria' && (
        <VictoryPanel codex={codex} battle={battle} characters={characters} isMaster={isMaster} run={run} />
      )}
      {battle.loot && <LootPanel codex={codex} battle={battle} characterId={characterId} />}
      {battle.status === 'encerrada' && (
        <Card>
          <Text style={text.strong}>🏳️ {t('Batalha encerrada pelo Mestre.')}</Text>
        </Card>
      )}

      <SectionHeader title={t('Participantes')} />
      <ParticipantList battle={battle} characters={characters} />

      <SectionHeader title={t('Registro')} />
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

const monsterName = (codex: Codex, id: string | undefined) => codex.monsters.find((m) => m.id === id)?.name ?? 'Monstro';

/** Chips para escolher um monstro vivo (só aparecem quando há mais de um). */
function FoePicker({ codex, foes, value, onChange, label }: { codex: Codex; foes: Foe[]; value?: string; onChange: (id: string) => void; label?: string }) {
  const { t } = useT();
  if (foes.length < 2) return null;
  return (
    <View style={{ gap: 2 }}>
      <Muted>{label ?? `🎯 ${t('Alvo')}`}</Muted>
      <View style={styles.wrap}>
        {foes.map((f) => (
          <Chip key={f.monsterId} label={`${monsterName(codex, f.monsterId)} ❤️${f.hp}`} active={value === f.monsterId} onPress={() => onChange(f.monsterId)} />
        ))}
      </View>
    </View>
  );
}

function PlayerPanel({ codex, battle, viewer, characters, run }: PanelProps & { viewer: Character }) {
  const { t, tx } = useT();
  const [menu, setMenu] = useState<'raiz' | 'atacar' | 'habilidade' | 'item' | 'observar' | 'defender' | 'fugir'>('raiz');
  const [sides, setSides] = useState(20);
  const [dice, setDice] = useState('');
  const [targetId, setTargetId] = useState<string>();
  const [category, setCategory] = useState<AbilityCategory>();
  const turn = currentTurn(battle);
  const participant = battle.participants.find((p) => p.characterId === viewer.id);

  if (!participant) return <Muted>{t('Você não participa desta batalha.')}</Muted>;
  if (participant.fled) return <Card><Text style={text.strong}>🏃 {t('Você fugiu da batalha.')}</Text></Card>;
  if (viewer.hp <= 0) return <Card><Text style={text.strong}>☠️ {t('Você caiu em batalha.')}</Text></Card>;

  if (battle.pending?.characterId === viewer.id) {
    return (
      <Card style={styles.turnCard}>
        <Text style={text.strong}>⏳ {tx(battle.pending.label)}</Text>
        <Muted>
          {battle.pending.targetId ? `${t('Acertou {name}!', { name: monsterName(codex, battle.pending.targetId) })} ` : ''}
          {t('Aguardando o Mestre definir o resultado. Use o dado acima se o Mestre pedir.')}
        </Muted>
      </Card>
    );
  }

  if (turn !== viewer.id) {
    const who = foeOf(battle, turn) ? monsterName(codex, turn) : (characters.find((c) => c.id === turn)?.name ?? '?');
    return (
      <Card>
        <Text style={text.strong}>{t('Turno de {name}', { name: who })}</Text>
        <Muted>
          {participant.defense
            ? `🛡️ ${t('Você está defendendo (🎲 {roll}). O Mestre decide o dano do próximo ataque.', { roll: diceLabel(participant.defense) })}`
            : t('Aguarde a sua vez.')}
        </Muted>
      </Card>
    );
  }

  const alive = aliveFoes(battle);
  // Alvo escolhido; se ele caiu (ou nada foi escolhido), o primeiro monstro vivo.
  const target = alive.find((f) => f.monsterId === targetId) ?? alive[0];
  const known = target && participant.observedIds.includes(target.monsterId);
  const armor = codex.monsters.find((m) => m.id === target?.monsterId)?.armor;

  const act = (action: PlayerAction) => {
    run((d) => playerAction(d, codex.id, battle.id, viewer.id, action));
    setMenu('raiz');
    setDice('');
  };
  const roll: DiceRoll = { sides, value: toInt(dice) };
  const rollOk = roll.value >= 1 && roll.value <= sides;

  // Habilidades por categoria: classe, geral e montaria (só as que existem aparecem).
  const groups = abilityGroups(viewer, codex);
  const byCategory: Record<AbilityCategory, { ability: Ability; from?: string }[]> = {
    classe: groups.classe.map((ability) => ({ ability })),
    geral: groups.geral.map((ability) => ({ ability })),
    montaria: groups.montaria.flatMap(({ mount, abilities }) => abilities.map((ability) => ({ ability, from: `${mount.emoji} ${mount.name}` }))),
  };
  const cats = (
    [
      { key: 'classe', label: '🛡️ Classe' },
      { key: 'geral', label: '✨ Geral' },
      { key: 'montaria', label: '🐎 Montaria' },
    ] as const
  )
    .map((c) => ({ ...c, count: byCategory[c.key].length }))
    .filter((c) => c.count > 0);
  const shownCat = cats.find((c) => c.key === category)?.key ?? cats[0]?.key;
  const shownList = shownCat ? byCategory[shownCat] : [];

  return (
    <Pulse active={menu === 'raiz'}>
      <Card style={styles.turnCard}>
        <Text style={text.accentStrong}>⭐ {t('Seu turno!')}</Text>
        <CharacterBars character={viewer} />
        {menu === 'raiz' && (
          <View style={styles.actions}>
            <Button title={`⚔️ ${t('Atacar')}`} onPress={() => setMenu('atacar')} />
            <Button variant="secondary" title={`🛡️ ${t('Defender')}`} onPress={() => setMenu('defender')} />
            <Button
              variant="secondary"
              title={`👁️ ${t('Observar')}`}
              onPress={() => (alive.length > 1 ? setMenu('observar') : act({ kind: 'observar', targetId: target?.monsterId }))}
            />
            <Button variant="secondary" title={`🏃 ${t('Fugir')}`} onPress={() => setMenu('fugir')} />
          </View>
        )}
        {menu === 'observar' && (
          <View style={styles.actions}>
            <Muted>{t('Quem você quer observar? Você passa a ver a armadura e as habilidades dele.')}</Muted>
            {alive.map((f) => (
              <Button
                key={f.monsterId}
                variant="secondary"
                title={`👁️ ${monsterName(codex, f.monsterId)}${participant.observedIds.includes(f.monsterId) ? ` (${t('já observado')})` : ''}`}
                onPress={() => act({ kind: 'observar', targetId: f.monsterId })}
              />
            ))}
            <Button variant="ghost" title={t('Voltar')} onPress={() => setMenu('raiz')} />
          </View>
        )}
        {menu === 'fugir' && (
          <View style={styles.actions}>
            <DiceInput label={`🎲 ${t('Dado da fuga')}`} sides={sides} onSides={setSides} value={dice} onValue={setDice} />
            <Muted>{t('Role o dado da fuga. O Mestre decide se você consegue escapar; se falhar, ele pode aplicar dano ou status.')}</Muted>
            <Button title={`🏃 ${t('Tentar fugir')}${rollOk ? ` (${diceLabel(roll)})` : ''}`} disabled={!rollOk} onPress={() => act({ kind: 'fugir', roll })} />
            <Button variant="ghost" title={t('Voltar')} onPress={() => setMenu('raiz')} />
          </View>
        )}
        {menu === 'defender' && (
          <View style={styles.actions}>
            <DiceInput label={`🎲 ${t('Dado da defesa')}`} sides={sides} onSides={setSides} value={dice} onValue={setDice} />
            <Muted>{t('Role o dado da defesa. O Mestre vê o valor e decide quanto dano você recebe do próximo ataque.')}</Muted>
            <Button title={`🛡️ ${t('Defender')}${rollOk ? ` (${diceLabel(roll)})` : ''}`} disabled={!rollOk} onPress={() => act({ kind: 'defender', roll })} />
            <Button variant="ghost" title={t('Voltar')} onPress={() => setMenu('raiz')} />
          </View>
        )}
        {(menu === 'atacar' || menu === 'habilidade') && (
          <View style={{ gap: spacing.sm }}>
            <FoePicker codex={codex} foes={alive} value={target?.monsterId} onChange={setTargetId} />
            <View style={{ gap: 2 }}>
              <DiceInput label={`🎲 ${t('Dado do ataque')}`} sides={sides} onSides={setSides} value={dice} onValue={setDice} />
              <Muted>
                {known
                  ? t('Para acertar, o dado precisa ser maior ou igual à armadura ({armor}). Se acertar, o Mestre define o dano.', { armor })
                  : t('Para acertar, o dado precisa ser maior ou igual à armadura do alvo. Se acertar, o Mestre define o dano.')}
              </Muted>
            </View>
          </View>
        )}
        {menu === 'atacar' && (
          <View style={styles.actions}>
            <Button
              title={`👊 ${t('Golpe físico')}`}
              disabled={!rollOk}
              onPress={() => act({ kind: 'fisico', roll, targetId: target?.monsterId })}
            />
            <Button variant="secondary" icon={<CostIcon kind="magica" />} title={t('Habilidade')} onPress={() => setMenu('habilidade')} />
            <Button variant="secondary" title={`🎒 ${t('Usar item')}`} onPress={() => setMenu('item')} />
            <Button variant="ghost" title={t('Voltar')} onPress={() => setMenu('raiz')} />
          </View>
        )}
        {menu === 'habilidade' && (
          <View style={styles.actions}>
            {cats.length === 0 && <Muted>{t('Você ainda não tem habilidades.')}</Muted>}
            {cats.length > 1 && (
              <View style={styles.wrap}>
                {cats.map((c) => (
                  <Chip key={c.key} label={`${t(c.label)} (${c.count})`} active={shownCat === c.key} onPress={() => setCategory(c.key)} />
                ))}
              </View>
            )}
            {shownList.map(({ ability: a, from }) => {
              const pool = a.kind === 'magica' ? viewer.mana : viewer.stamina;
              return (
                <Button
                  key={a.id}
                  variant="secondary"
                  disabled={pool < a.cost || !rollOk}
                  icon={a.photoUri ? <Image source={{ uri: a.photoUri }} style={styles.abilityPhoto} /> : <CostIcon kind={a.kind} />}
                  title={`${from ? `${from} · ` : ''}${a.name} · ${tx(costLabel(a))}${a.status ? ` · ${STATUS_INFO[a.status].emoji}` : ''}${isOffensive(a) ? '' : ` · ${t('sem alvo')}`}`}
                  onPress={() => act({ kind: 'habilidade', abilityId: a.id, roll, targetId: target?.monsterId })}
                />
              );
            })}
            <Muted>{t('Habilidades sem dano (cura, apoio) não dependem da armadura.')}</Muted>
            <Button variant="ghost" title={t('Voltar')} onPress={() => setMenu('atacar')} />
          </View>
        )}
        {menu === 'item' && (
          <View style={styles.actions}>
            {viewer.inventory.length === 0 && <Muted>{t('A bolsa está vazia.')}</Muted>}
            {viewer.inventory.map((i) => (
              <Button key={i.id} variant="secondary" title={`${i.name} (x${i.quantity})`} onPress={() => act({ kind: 'item', itemId: i.id })} />
            ))}
            <Button variant="ghost" title={t('Voltar')} onPress={() => setMenu('atacar')} />
          </View>
        )}
      </Card>
    </Pulse>
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

/**
 * Dado usado + valor, lado a lado: toca no dado para trocar (d4…d20) e digita o valor que saiu.
 * Avisa quando o valor passa do número de lados.
 */
function DiceInput({
  label,
  sides,
  onSides,
  value,
  onValue,
}: {
  label: string;
  sides: number;
  onSides: (sides: number) => void;
  value: string;
  onValue: (v: string) => void;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const n = toInt(value);
  return (
    <View style={{ gap: 4 }}>
      <Muted>{label}</Muted>
      <View style={styles.inline}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Dado usado: d{sides}. Toque para trocar.', { sides })}
          onPress={() => setOpen((o) => !o)}
          style={styles.diePick}
        >
          <Text style={styles.diePickText}>🎲 d{sides} {open ? '▴' : '▾'}</Text>
        </Pressable>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          keyboardType="number-pad"
          placeholder={t('Valor (1–{sides})', { sides })}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={(v) => onValue(v.replace(/\D/g, ''))}
        />
      </View>
      {open && (
        <View style={styles.wrap}>
          {DICE.map((s) => (
            <Chip
              key={s}
              label={`d${s}`}
              active={s === sides}
              onPress={() => {
                onSides(s);
                setOpen(false);
              }}
            />
          ))}
        </View>
      )}
      {n > sides && <Text style={[text.body, { color: colors.danger }]}>{t('Um d{sides} vai de 1 a {sides}.', { sides })}</Text>}
    </View>
  );
}

/** Chance de status informada ao Mestre antes de aplicar o dano; o sorteio é do sistema. */
function StatusChance({ ability, target }: { ability?: Ability; target: string }) {
  const { t } = useT();
  if (!ability?.status || !ability.statusChance) return null;
  const info = STATUS_INFO[ability.status];
  return (
    <View style={[styles.chance, { borderColor: info.color }]}>
      <Text style={[text.strong, { color: info.color }]}>
        {info.emoji} {t('{chance}% de chance de deixar {target} {condition}', { chance: ability.statusChance, target, condition: info.condition })}
      </Text>
      <Muted>{t('Ao aplicar o dano, o sistema sorteia o status ({effect}).', { effect: info.effect })}</Muted>
    </View>
  );
}

/** Personagens ainda de pé na batalha. */
const aliveCharacters = (battle: Battle, characters: Character[]) =>
  battle.participants
    .map((p) => characters.find((c) => c.id === p.characterId))
    .filter((c): c is Character => !!c && !isOut(battle, c));

const defenseOf = (battle: Battle, id: string) => battle.participants.find((p) => p.characterId === id)?.defense;

function MasterPanel({ codex, battle, characters, run }: PanelProps) {
  const { t } = useT();
  const turn = currentTurn(battle);

  const confirmEnd = () =>
    Alert.alert(t('Encerrar batalha?'), t('Ninguém recebe XP se a batalha for encerrada sem vitória.'), [
      { text: t('Cancelar'), style: 'cancel' },
      { text: t('Encerrar'), style: 'destructive', onPress: () => run((d) => endBattle(d, codex.id, battle.id)) },
    ]);

  return (
    <>
      {battle.pending?.kind === 'fuga' ? (
        <FleeCard key={`${battle.round}:${battle.turnIndex}`} codex={codex} battle={battle} characters={characters} run={run} />
      ) : battle.pending ? (
        <PendingCard key={`${battle.round}:${battle.turnIndex}`} codex={codex} battle={battle} characters={characters} run={run} />
      ) : foeOf(battle, turn) ? (
        // A chave zera as escolhas a cada turno de monstro.
        <FoeTurnCard key={`${battle.round}:${turn}`} codex={codex} battle={battle} characters={characters} run={run} />
      ) : (
        <Card>
          <Text style={text.strong}>{t('Aguardando {name} escolher a ação.', { name: characters.find((c) => c.id === turn)?.name ?? '?' })}</Text>
          <View style={styles.wrap}>
            <Button
              small
              variant="secondary"
              title={t('Abrir visão do jogador')}
              onPress={() => router.push({ pathname: '/batalha/[id]', params: { id: battle.id, codexId: codex.id, characterId: turn } })}
            />
            <Button small variant="secondary" title={`⏭️ ${t('Pular turno')}`} onPress={() => run((d) => skipTurn(d, codex.id, battle.id))} />
          </View>
        </Card>
      )}

      <ReviveCard codex={codex} battle={battle} characters={characters} run={run} />

      <BalloonCard codex={codex} battle={battle} characters={characters} run={run} />

      <Card>
        <Text style={text.strong}>🗺️ {t('Cenário')}</Text>
        <TerrainPicker value={battle.terrain} onChange={(t) => run((d) => setTerrain(d, codex.id, battle.id, t))} />
      </Card>

      <Button variant="danger" title={t('Encerrar batalha sem vitória')} onPress={confirmEnd} />
    </>
  );
}

/** O Mestre decide a fuga: aceita (sai da batalha) ou recusa, com dano, status ou só passando a vez. */
function FleeCard({ codex, battle, characters, run }: PanelProps) {
  const { t } = useT();
  const pending = battle.pending!;
  const who = characters.find((c) => c.id === pending.characterId);
  const name = who?.name ?? t('Personagem');
  const [damage, setDamage] = useState('');
  const [status, setStatus] = useState<StatusType>();
  const decide = (res: Parameters<typeof resolveFlee>[3]) => run((d) => resolveFlee(d, codex.id, battle.id, res));
  const hurt = toInt(damage);
  const refuseLabel = [hurt ? t('{n} de dano', { n: hurt }) : '', status ? t(STATUS_INFO[status].label).toLowerCase() : ''].filter(Boolean).join(' + ');

  return (
    <Card style={styles.turnCard}>
      <Text style={text.strong}>🏃 {t('{name} tenta fugir', { name })}</Text>
      <Text style={text.accentStrong}>
        🎲 {t('Dado da fuga')}: {pending.diceSides ? `d${pending.diceSides} → ` : ''}
        {pending.dice}
      </Text>
      <Button title={`✅ ${t('Aceitar fuga (sai da batalha)')}`} onPress={() => decide({ accepted: true })} />

      <View style={[styles.chance, { gap: spacing.sm }]}>
        <Text style={text.strong}>❌ {t('Recusar a fuga')}</Text>
        <Muted>{t('Se quiser, aplique dano e/ou um status. Sem nada, {name} só perde a vez.', { name })}</Muted>
        <View style={{ gap: 2 }}>
          <Muted>💥 {t('Dano (opcional)')}</Muted>
          <NumberInput value={damage} onChange={setDamage} placeholder="0" />
        </View>
        <Muted>{t('Status (opcional)')}</Muted>
        <View style={styles.wrap}>
          <Chip label={t('Nenhum')} active={!status} onPress={() => setStatus(undefined)} />
          {STATUS_TYPES.map((s) => (
            <Chip key={s} label={`${STATUS_INFO[s].emoji} ${t(STATUS_INFO[s].label)}`} active={status === s} onPress={() => setStatus(s)} />
          ))}
        </View>
        <Button
          variant="secondary"
          title={refuseLabel ? `❌ ${t('Recusar')}: ${refuseLabel}` : `❌ ${t('Recusar (só passa a vez)')}`}
          onPress={() => decide({ accepted: false, damage: hurt, status })}
        />
      </View>
    </Card>
  );
}

/** O Mestre resolve a ação do jogador: dano no monstro, cura ou sem efeito. */
function PendingCard({ codex, battle, characters, run }: PanelProps) {
  const { t, tx } = useT();
  const pending = battle.pending!;
  const foes = aliveFoes(battle);
  // Na cura, entram também os caídos: curar levanta.
  const healable = [...aliveCharacters(battle, characters), ...fallenCharacters(battle, characters)];
  const [amount, setAmount] = useState('');
  const [targetId, setTargetId] = useState(pending.targetId);
  // Cura: aberta pelo botão "Curar"; alvos (personagens e/ou monstros) e quanto curar.
  const [healing, setHealing] = useState(false);
  const [healIds, setHealIds] = useState<string[]>([]);
  const [healAmount, setHealAmount] = useState('');

  const pendingCharacter = characters.find((c) => c.id === pending.characterId);
  const pendingAbility = findAbility(pendingCharacter, codex, pending.abilityId);
  const target = foes.find((f) => f.monsterId === targetId) ?? foes[0];
  const armor = codex.monsters.find((m) => m.id === pending.targetId)?.armor;

  const resolve = (res: Parameters<typeof resolveAction>[3]) => run((d) => resolveAction(d, codex.id, battle.id, res));
  const toggleHeal = (id: string) => setHealIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <Card style={styles.turnCard}>
      <Text style={text.strong}>
        {pendingCharacter?.name}: {tx(pending.label)}
        {pending.targetId ? ` → ${monsterName(codex, pending.targetId)}` : ''}
      </Text>
      {pending.dice !== undefined && (
        <Text style={text.accentStrong}>
          🎲 {t('Dado do jogador')}: {pending.diceSides ? `d${pending.diceSides} → ` : ''}
          {pending.dice}
          {armor !== undefined ? ` · ${t('acertou (armadura {armor})', { armor })}` : ''}
        </Text>
      )}
      {pendingAbility && <DamageStat damage={pendingAbility.baseDamage} />}
      <StatusChance ability={pendingAbility} target={monsterName(codex, target?.monsterId)} />
      {healing ? (
        <View style={styles.actions}>
          <Text style={text.strong}>💚 {t('Quem deve ser curado?')}</Text>
          <View style={styles.wrap}>
            {healable.map((c) => (
              <Chip
                key={c.id}
                label={c.hp <= 0 ? `☠️ ${c.name} (${t('levantar')})` : `${c.name} ❤️${c.hp}/${c.maxHp}`}
                active={healIds.includes(c.id)}
                onPress={() => toggleHeal(c.id)}
              />
            ))}
            {foes.map((f) => (
              <Chip
                key={f.monsterId}
                label={`👹 ${monsterName(codex, f.monsterId)} ❤️${f.hp}/${f.maxHp}`}
                active={healIds.includes(f.monsterId)}
                onPress={() => toggleHeal(f.monsterId)}
              />
            ))}
          </View>
          <Muted>{t('Quanto curar (cada alvo escolhido recebe este valor)')}</Muted>
          <NumberInput value={healAmount} onChange={setHealAmount} placeholder={t('Cura')} />
          <Button
            title={`💚 ${t('Curar {n} alvo(s)', { n: healIds.length || '' })}`}
            disabled={healIds.length === 0 || !toInt(healAmount)}
            onPress={() => resolve({ type: 'cura', amount: toInt(healAmount), targetIds: healIds })}
          />
          <Button variant="ghost" title={t('Voltar para o dano')} onPress={() => setHealing(false)} />
        </View>
      ) : (
        <>
          <FoePicker codex={codex} foes={foes} value={target?.monsterId} onChange={setTargetId} label={`🎯 ${t('Monstro atingido')}`} />
          <Muted>{t('Digite o dano gerado pelo ataque.')}</Muted>
          <NumberInput value={amount} onChange={setAmount} placeholder={t('Dano')} />
          <Button
            title={`💥 ${t('Causar dano em {name}', { name: monsterName(codex, target?.monsterId) })}`}
            disabled={!amount || !target}
            onPress={() => resolve({ type: 'dano', amount: toInt(amount), targetId: target?.monsterId })}
          />
          <Button variant="secondary" title={`💚 ${t('Curar')}`} onPress={() => setHealing(true)} />
        </>
      )}
      <Button variant="ghost" title={t('Sem efeito')} onPress={() => resolve({ type: 'nada' })} />
    </Card>
  );
}

/** Turno de um monstro: o Mestre escolhe habilidade, alvo, dado e dano. */
function FoeTurnCard({ codex, battle, characters, run }: PanelProps) {
  const { t } = useT();
  const foe = foeOf(battle, currentTurn(battle))!;
  const monster = codex.monsters.find((m) => m.id === foe.monsterId);
  const alive = aliveCharacters(battle, characters);
  const [abilityId, setAbilityId] = useState(foe.abilityId);
  const [targetId, setTargetId] = useState<string>();
  const [sides, setSides] = useState(20);
  const [dice, setDice] = useState('');
  const [amount, setAmount] = useState('');

  const ability = monster?.abilities.find((a) => a.id === abilityId);
  const target = alive.find((c) => c.id === targetId);
  const defense = target && defenseOf(battle, target.id);
  const roll: DiceRoll = { sides, value: toInt(dice) };
  const rollOk = roll.value >= 1 && roll.value <= sides;


  return (
    <Card style={styles.turnCard}>
      <Text style={text.accentStrong}>👹 {t('Turno de {name}', { name: monster?.name ?? t('monstro') })}</Text>
      <Muted>{t('Habilidade')}</Muted>
      <View style={styles.wrap}>
        <Chip label={t('Ataque simples')} active={!abilityId} onPress={() => setAbilityId(undefined)} />
        {monster?.abilities.map((a) => (
          <Chip key={a.id} label={`${a.name}${a.status ? ` ${STATUS_INFO[a.status].emoji}` : ''}`} active={abilityId === a.id} onPress={() => setAbilityId(a.id)} />
        ))}
      </View>
      {ability && <DamageStat damage={ability.baseDamage} />}
      <Muted>{t('Alvo')}</Muted>
      <View style={styles.wrap}>
        <Chip label={t('Nenhum')} active={!targetId} onPress={() => setTargetId(undefined)} />
        {alive.map((c) => (
          <Chip
            key={c.id}
            label={`${defenseOf(battle, c.id) ? '🛡️ ' : ''}${c.name} ❤️${c.hp}`}
            active={targetId === c.id}
            onPress={() => setTargetId(c.id)}
          />
        ))}
      </View>
      {target && (
        <>
          {defense && (
            <View style={[styles.chance, { borderColor: colors.mana }]}>
              <Text style={[text.strong, { color: colors.mana }]}>
                🛡️ {t('{name} está defendendo', { name: target.name })} · 🎲 d{defense.sides} → {defense.value}
              </Text>
              <Muted>{t('Considere o dado da defesa e digite abaixo quanto dano {name} recebe.', { name: target.name })}</Muted>
            </View>
          )}
          <StatusChance ability={ability} target={target.name} />
          <DiceInput label={`🎲 ${t('Dado do ataque do monstro')}`} sides={sides} onSides={setSides} value={dice} onValue={setDice} />
          <View style={{ gap: 2 }}>
            <Muted>💥 {defense ? t('Dano que {name} recebe', { name: target.name }) : t('Dano gerado')}</Muted>
            <NumberInput value={amount} onChange={setAmount} placeholder={t('Dano')} />
          </View>
        </>
      )}
      <Button
        title={targetId ? `💥 ${t('Aplicar dano')}` : t('Executar turno de {name}', { name: monster?.name ?? t('monstro') })}
        disabled={!!targetId && (!rollOk || !amount)}
        onPress={() => run((d) => monsterAction(d, codex.id, battle.id, { abilityId, targetId, roll: targetId ? roll : undefined, damage: toInt(amount) }))}
      />
    </Card>
  );
}

/** Personagens caídos (vida 0) que não fugiram: podem ser curados/levantados. */
const fallenCharacters = (battle: Battle, characters: Character[]) =>
  battle.participants
    .filter((p) => !p.fled)
    .map((p) => characters.find((c) => c.id === p.characterId))
    .filter((c): c is Character => !!c && c.hp <= 0);

/** O Mestre levanta um personagem caído e escolhe quanta vida ele recupera. */
function ReviveCard({ codex, battle, characters, run }: PanelProps) {
  const { t } = useT();
  const fallen = fallenCharacters(battle, characters);
  const [chosen, setChosen] = useState<string>();
  const [hp, setHp] = useState('');
  if (fallen.length === 0) return null;
  const who = fallen.find((c) => c.id === chosen) ?? fallen[0];
  const amount = Math.min(toInt(hp), who.maxHp);
  return (
    <Card>
      <Text style={text.strong}>✨ {t('Levantar personagem')}</Text>
      <Muted>{t('Escolha quem levantar e quanta vida recupera. Também dá para levantar curando, quando alguém usa uma cura.')}</Muted>
      <View style={styles.wrap}>
        {fallen.map((c) => (
          <Chip key={c.id} label={`☠️ ${c.name}`} active={who.id === c.id} onPress={() => setChosen(c.id)} />
        ))}
      </View>
      <View style={{ gap: 2 }}>
        <Muted>❤️ {t('Vida que {name} recupera (máx. {max})', { name: who.name, max: who.maxHp })}</Muted>
        <NumberInput value={hp} onChange={setHp} placeholder={`1–${who.maxHp}`} />
      </View>
      <Button
        title={`✨ ${amount ? t('Levantar {name} com {n} de vida', { name: who.name, n: amount }) : t('Levantar {name}', { name: who.name })}`}
        disabled={!amount}
        onPress={() => {
          run((d) => reviveCharacter(d, codex.id, battle.id, who.id, amount));
          setHp('');
        }}
      />
    </Card>
  );
}

/** Balão de cada monstro: habilidade exibida e condição escrita pelo Mestre. */
function BalloonCard({ codex, battle, run }: PanelProps) {
  const { t } = useT();
  const alive = aliveFoes(battle);
  const [foeId, setFoeId] = useState<string>();
  const foe = alive.find((f) => f.monsterId === foeId) ?? alive[0];
  if (!foe) return null;
  return (
    <Card>
      <Text style={text.strong}>🗨️ {t('Balão do monstro')}</Text>
      <FoePicker codex={codex} foes={alive} value={foe.monsterId} onChange={setFoeId} label={t('Monstro')} />
      {/* A chave recomeça a condição digitada ao trocar de monstro. */}
      <BalloonEditor key={foe.monsterId} codex={codex} battle={battle} foe={foe} run={run} />
      <Muted>{t('Status como veneno e congelamento são sorteados pelo sistema e não podem ser alterados.')}</Muted>
    </Card>
  );
}

function BalloonEditor({ codex, battle, foe, run }: Omit<PanelProps, 'characters'> & { foe: Foe }) {
  const { t } = useT();
  const [condition, setCondition] = useState(foe.condition);
  const monster = codex.monsters.find((m) => m.id === foe.monsterId);
  const show = (abilityId: string | undefined, cond: string) =>
    run((d) => setMonsterDisplay(d, codex.id, battle.id, foe.monsterId, abilityId, cond));
  return (
    <>
      <View style={styles.wrap}>
        <Chip label={t('Nenhuma')} active={!foe.abilityId} onPress={() => show(undefined, condition)} />
        {monster?.abilities.map((a) => (
          <Chip key={a.id} label={a.name} active={foe.abilityId === a.id} onPress={() => show(a.id, condition)} />
        ))}
      </View>
      <View style={styles.inline}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder={t('Condição (ex.: Furioso, Ferido)')}
          placeholderTextColor={colors.textMuted}
          value={condition}
          onChangeText={setCondition}
        />
        <Button small title={t('Atualizar')} onPress={() => show(foe.abilityId, condition.trim())} />
      </View>
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
  const { t } = useT();
  const [min, setMin] = useState('10');
  const [max, setMax] = useState('50');

  if (battle.xpAwarded) {
    return (
      <Card style={styles.turnCard}>
        <Text style={text.accentStrong}>🏆 {t('Vitória! XP distribuído')}</Text>
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
        <Text style={text.accentStrong}>🏆 {t('Vitória!')}</Text>
        <Muted>{t('Aguardando o Mestre distribuir o XP.')}</Muted>
      </Card>
    );
  }

  return (
    <Card style={styles.turnCard}>
      <Text style={text.accentStrong}>🏆 {t('Vitória! Distribuir XP')}</Text>
      <Muted>
        {t('O XP é dividido conforme o dano causado: quem causou mais dano recebe o máximo. Personagens mortos ou que fugiram recebem o mínimo.')}
      </Muted>
      <View style={styles.inline}>
        <View style={{ flex: 1, gap: 2 }}>
          <Muted>{t('XP mínimo')}</Muted>
          <NumberInput value={min} onChange={setMin} placeholder={t('Mínimo')} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Muted>{t('XP máximo')}</Muted>
          <NumberInput value={max} onChange={setMax} placeholder={t('Máximo')} />
        </View>
      </View>
      <Button icon={<StarIcon />} title={t('Distribuir XP')} onPress={() => run((d) => awardXp(d, codex.id, battle.id, toInt(min), toInt(max)))} />
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
  diePick: {
    backgroundColor: colors.primary,
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 96,
    alignItems: 'center',
  },
  abilityPhoto: { width: 24, height: 24, borderRadius: 4 },
  diePickText: { color: colors.onPrimary, fontSize: 16, fontWeight: '800' },
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
