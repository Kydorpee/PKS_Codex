import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { isOut } from '@/lib/engine';
import { DICE, STATUS_INFO } from '@/lib/rules';
import { colors, hpColor, radius, spacing } from '@/lib/theme';
import { MONSTER_TURN, type Battle, type Character, type LogTone, type Monster } from '@/lib/types';
import { CharacterBars } from './character-stats';
import { BlastIcon, DamageStat, IconStat, SHIELD_COLOR } from './monster-stats';
import { PixelIcon } from './pixel-icon';
import { PixelScene } from './pixel-scene';
import { Avatar, Bar, Card, Muted, Paper, text } from './ui';

/** Quadro do monstro: miniatura, balão com habilidade/condição, vida e cenário. */
export function MonsterPanel({ monster, battle, reveal }: { monster: Monster; battle: Battle; reveal: boolean }) {
  const ability = monster.abilities.find((a) => a.id === battle.monsterAbilityId);
  const hasSpeech = !!ability || !!battle.monsterCondition;
  const dead = battle.monsterHp <= 0;

  return (
    <View style={styles.monsterFrame}>
      <Paper>
        <View style={styles.monsterTop}>
          <View style={[styles.thumb, dead && { opacity: 0.4 }]}>
            {monster.photoUri ? (
              <Image source={{ uri: monster.photoUri }} style={styles.thumbImage} />
            ) : (
              <Text style={styles.thumbEmoji}>{monster.emoji ?? '👹'}</Text>
            )}
          </View>
          <View style={styles.balloonWrap}>
            <View style={styles.balloonTail} />
            <View style={styles.balloon}>
              {dead ? (
                <Text style={styles.balloonText}>☠️ Derrotado</Text>
              ) : hasSpeech ? (
                <>
                  {ability && (
                    <View style={styles.balloonRow}>
                      <Text style={[styles.balloonText, { fontWeight: '800' }]}>{ability.name}</Text>
                      {!!ability.baseDamage && (
                        <>
                          <BlastIcon />
                          <Text style={styles.balloonText}>{ability.baseDamage}</Text>
                        </>
                      )}
                    </View>
                  )}
                  {!!battle.monsterCondition && <Text style={styles.balloonCondition}>Condição: {battle.monsterCondition}</Text>}
                </>
              ) : (
                <Text style={styles.balloonCondition}>...</Text>
              )}
            </View>
          </View>
        </View>

        <Text style={[text.strong, { marginTop: spacing.sm }]}>{monster.name}</Text>
        <Bar
          label="Vida"
          value={battle.monsterHp}
          max={battle.monsterMaxHp}
          color={hpColor(battle.monsterHp, battle.monsterMaxHp)}
          effects
          icon={
            <PixelIcon
              shape="heart"
              pixel={3}
              pct={battle.monsterMaxHp > 0 ? battle.monsterHp / battle.monsterMaxHp : 0}
              color={hpColor(battle.monsterHp, battle.monsterMaxHp)}
            />
          }
        />
        {battle.monsterStatuses.length > 0 && (
          <View style={styles.statusRow}>
            {battle.monsterStatuses.map((s) => (
              <Text key={s.type} style={[styles.systemStatus, { color: STATUS_INFO[s.type].color }]}>
                🔒 {STATUS_INFO[s.type].emoji} {STATUS_INFO[s.type].label} · {s.roundsLeft}t
              </Text>
            ))}
          </View>
        )}

        <View style={styles.scene}>
          <PixelScene terrain={battle.terrain} />
        </View>

        {reveal && (
          <View style={styles.reveal}>
            <IconStat icon={<PixelIcon shape="shield" color={SHIELD_COLOR} />}>Armadura {monster.armor}</IconStat>
            {monster.abilities.map((a) => {
              const status = a.status ? ` — ${STATUS_INFO[a.status].emoji} ${a.statusChance}%` : '';
              return a.baseDamage ? (
                <DamageStat key={a.id} damage={a.baseDamage}>
                  {` ${a.name}${status}`}
                </DamageStat>
              ) : (
                <Muted key={a.id}>
                  • {a.name}
                  {status}
                </Muted>
              );
            })}
          </View>
        )}
      </Paper>
    </View>
  );
}

export function DicePanel({
  lastRoll: roll,
  canRoll,
  onRoll,
}: {
  lastRoll?: Battle['lastRoll'];
  canRoll: boolean;
  onRoll: (sides: number) => void;
}) {
  return (
    <Card style={styles.dice}>
      <View style={styles.diceRow}>
        <View style={styles.die}>
          <Text style={styles.dieValue}>{roll?.value ?? '—'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={text.strong}>🎲 Dado virtual</Text>
          <Muted>{roll ? `${roll.by} rolou d${roll.sides}` : canRoll ? 'Escolha um dado para girar.' : 'Disponível no seu turno.'}</Muted>
        </View>
      </View>
      {canRoll && (
        <View style={styles.diceChoices}>
          {DICE.map((sides) => (
            <Pressable
              key={sides}
              accessibilityRole="button"
              accessibilityLabel={`Rolar d${sides}`}
              onPress={() => onRoll(sides)}
              style={({ pressed }) => [styles.diceChip, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.diceChipText}>d{sides}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}

export function TurnOrder({ battle, monster, characters }: { battle: Battle; monster: Monster; characters: Character[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.turns}>
      {battle.order.map((id, index) => {
        const isMonster = id === MONSTER_TURN;
        const c = characters.find((x) => x.id === id);
        const current = battle.status === 'ativa' && index === battle.turnIndex;
        const out = isMonster ? battle.monsterHp <= 0 : isOut(battle, c);
        const fled = battle.participants.find((p) => p.characterId === id)?.fled;
        return (
          <View key={id} style={[styles.turn, current && styles.turnCurrent, out && { opacity: 0.45 }]}>
            {isMonster ? (
              <Avatar uri={monster.photoUri} emoji={monster.emoji ?? '👹'} size={32} />
            ) : (
              <Avatar uri={c?.photoUri} name={c?.name} size={32} />
            )}
            <Text style={styles.turnName} numberOfLines={1}>
              {out ? (fled ? '🏃 ' : '☠️ ') : ''}
              {isMonster ? monster.name : (c?.name ?? '?')}
            </Text>
            <Text style={styles.turnInit}>🎲 {battle.initiatives[id]}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

export function ParticipantList({ battle, characters }: { battle: Battle; characters: Character[] }) {
  return (
    <>
      {battle.participants.map((p) => {
        const c = characters.find((x) => x.id === p.characterId);
        if (!c) return null;
        return (
          <Card key={p.characterId} style={isOut(battle, c) && { opacity: 0.55 }}>
            <View style={styles.participantHeader}>
              <Avatar uri={c.photoUri} name={c.name} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={text.strong}>
                  {c.name} {p.fled ? '🏃' : c.hp <= 0 ? '☠️' : ''}
                </Text>
                <Muted>
                  Nível {c.level} · dano causado: {p.damageDealt}
                </Muted>
              </View>
            </View>
            <CharacterBars character={c} />
          </Card>
        );
      })}
    </>
  );
}

const toneColor: Record<LogTone, string> = {
  info: colors.textMuted,
  dano: colors.hp,
  cura: colors.success,
  status: colors.xp,
  dado: '#7A5E12',
};

export function BattleLog({ battle }: { battle: Battle }) {
  const entries = battle.log.slice(-40).reverse();
  return (
    <Card>
      {entries.map((e) => (
        <Text key={e.id} style={[styles.logLine, { color: e.status ? STATUS_INFO[e.status].color : toneColor[e.tone] }]}>
          {e.text}
        </Text>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  monsterFrame: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  monsterTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.goldDim,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  thumbEmoji: { fontSize: 56 },
  balloonWrap: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', paddingTop: spacing.md },
  balloonTail: {
    width: 0,
    height: 0,
    marginTop: spacing.md,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 12,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: colors.background,
  },
  balloon: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
    minHeight: 48,
    justifyContent: 'center',
    gap: 2,
  },
  balloonRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  balloonText: { color: colors.textOnDark, fontSize: 14 },
  balloonCondition: { color: colors.gold, fontSize: 13, fontStyle: 'italic' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  systemStatus: { fontSize: 12, fontWeight: '700' },
  scene: { marginTop: spacing.sm, borderRadius: radius.sm, overflow: 'hidden', borderWidth: 2, borderColor: colors.goldDim },
  reveal: { marginTop: spacing.sm, gap: 2 },
  dice: { paddingVertical: spacing.md },
  diceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  die: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
  },
  dieValue: { color: colors.onPrimary, fontSize: 26, fontWeight: '900' },
  diceChoices: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  diceChip: {
    minWidth: 48,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  diceChipText: { color: colors.onPrimary, fontWeight: '800' },
  turns: { gap: spacing.sm, paddingVertical: spacing.xs },
  turn: {
    width: 84,
    alignItems: 'center',
    gap: 2,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: colors.surface,
  },
  turnCurrent: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.gold },
  turnName: { color: colors.text, fontSize: 12, fontWeight: '600' },
  turnInit: { color: colors.textMuted, fontSize: 11 },
  participantHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logLine: { fontSize: 13 },
});
