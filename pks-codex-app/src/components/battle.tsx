import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { currentTurn, foeOf, isOut } from '@/lib/engine';
import { DICE, STATUS_INFO } from '@/lib/rules';
import { colors, hpColor, radius, spacing } from '@/lib/theme';
import { diceLabel, type Battle, type Character, type Foe, type LogTone, type Monster } from '@/lib/types';
import { HitFx, Pulse, RollingDie } from './battle-fx';
import { useT } from '@/lib/i18n';
import { CharacterBars } from './character-stats';
import { BlastIcon, DamageStat, IconStat, SHIELD_COLOR } from './monster-stats';
import { PixelIcon } from './pixel-icon';
import { PixelScene } from './pixel-scene';
import { Avatar, Bar, Card, Muted, Paper, text } from './ui';

/** Um monstro no quadro: miniatura, balão com habilidade/condição, vida e status. */
function FoeRow({
  foe,
  monster,
  battle,
  reveal,
  compact,
  current,
}: {
  foe: Foe;
  monster: Monster;
  battle: Battle;
  reveal: boolean;
  compact: boolean;
  current: boolean;
}) {
  const { t } = useT();
  const ability = monster.abilities.find((a) => a.id === foe.abilityId);
  const hasSpeech = !!ability || !!foe.condition;
  const dead = foe.hp <= 0;
  const size = compact ? 64 : 96;

  return (
    <HitFx fx={battle.fx} targetId={foe.monsterId} style={[styles.foe, current && styles.foeCurrent, dead && { opacity: 0.5 }]}>
      <View style={styles.monsterTop}>
        <View style={[styles.thumb, { width: size, height: size }]}>
          {monster.photoUri ? (
            <Image source={{ uri: monster.photoUri }} style={styles.thumbImage} />
          ) : (
            <Text style={{ fontSize: compact ? 38 : 56 }}>{monster.emoji ?? '👹'}</Text>
          )}
        </View>
        <View style={[styles.balloonWrap, compact && { paddingTop: spacing.xs }]}>
          <View style={styles.balloonTail} />
          <View style={styles.balloon}>
            {dead ? (
              <Text style={styles.balloonText}>☠️ {t('Derrotado')}</Text>
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
                {!!foe.condition && <Text style={styles.balloonCondition}>{t('Condição: {c}', { c: foe.condition })}</Text>}
              </>
            ) : (
              <Text style={styles.balloonCondition}>...</Text>
            )}
          </View>
        </View>
      </View>

      <Text style={[text.strong, { marginTop: spacing.xs }]}>
        {current ? '👉 ' : ''}
        {monster.name}
      </Text>
      <Bar
        label={t('Vida')}
        value={foe.hp}
        max={foe.maxHp}
        color={hpColor(foe.hp, foe.maxHp)}
        effects
        icon={<PixelIcon shape="heart" pixel={3} pct={foe.maxHp > 0 ? foe.hp / foe.maxHp : 0} color={hpColor(foe.hp, foe.maxHp)} />}
      />
      {foe.statuses.length > 0 && (
        <View style={styles.statusRow}>
          {foe.statuses.map((s) => (
            <Text key={s.type} style={[styles.systemStatus, { color: STATUS_INFO[s.type].color }]}>
              🔒 {STATUS_INFO[s.type].emoji} {t(STATUS_INFO[s.type].label)} · {s.roundsLeft}t
            </Text>
          ))}
        </View>
      )}

      {reveal && (
        <View style={styles.reveal}>
          <IconStat icon={<PixelIcon shape="shield" color={SHIELD_COLOR} />}>{t('Armadura {n}', { n: monster.armor })}</IconStat>
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
    </HitFx>
  );
}

/**
 * Quadro dos monstros da batalha, com o cenário embaixo. `reveal` diz quais monstros mostram
 * armadura e habilidades (o Mestre vê todos; o jogador, os que observou).
 */
export function MonsterPanel({ battle, monsters, reveal }: { battle: Battle; monsters: Monster[]; reveal: (monsterId: string) => boolean }) {
  const turn = battle.status === 'ativa' ? currentTurn(battle) : undefined;
  const compact = battle.foes.length > 1;
  return (
    <View style={styles.monsterFrame}>
      <Paper>
        {battle.foes.map((foe) => {
          const monster = monsters.find((m) => m.id === foe.monsterId);
          if (!monster) return null;
          return (
            <FoeRow
              key={foe.monsterId}
              foe={foe}
              monster={monster}
              battle={battle}
              reveal={reveal(foe.monsterId)}
              compact={compact}
              current={compact && turn === foe.monsterId}
            />
          );
        })}

        <View style={styles.scene}>
          <PixelScene terrain={battle.terrain} />
        </View>
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
  const { t } = useT();
  return (
    <Card style={styles.dice}>
      <View style={styles.diceRow}>
        <RollingDie roll={roll} style={styles.die} textStyle={styles.dieValue} />
        <View style={{ flex: 1 }}>
          <Text style={text.strong}>🎲 {t('Dado virtual')}</Text>
          <Muted>{roll ? t('{by} rolou d{sides}', { by: roll.by, sides: roll.sides }) : canRoll ? t('Escolha um dado para girar.') : t('Disponível no seu turno.')}</Muted>
        </View>
      </View>
      {canRoll && (
        <View style={styles.diceChoices}>
          {DICE.map((sides) => (
            <Pressable
              key={sides}
              accessibilityRole="button"
              accessibilityLabel={t('Rolar d{sides}', { sides })}
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

export function TurnOrder({
  battle,
  monsters,
  characters,
  onOpenCharacter,
}: {
  battle: Battle;
  monsters: Monster[];
  characters: Character[];
  /** Tocar num personagem abre a ficha dele. */
  onOpenCharacter?: (id: string) => void;
}) {
  const { t } = useT();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.turns}>
      {battle.order.map((id, index) => {
        const foe = foeOf(battle, id);
        const monster = foe && monsters.find((m) => m.id === id);
        const c = characters.find((x) => x.id === id);
        const current = battle.status === 'ativa' && index === battle.turnIndex;
        const out = foe ? foe.hp <= 0 : isOut(battle, c);
        const p = battle.participants.find((x) => x.characterId === id);
        return (
          <Pulse key={id} active={current} style={[styles.turn, current && styles.turnCurrent, out && { opacity: 0.45 }]}>
            <Pressable
              accessibilityRole={foe ? undefined : 'button'}
              accessibilityLabel={foe ? undefined : t('Ver ficha de {name}', { name: c?.name ?? '?' })}
              disabled={!!foe || !onOpenCharacter}
              onPress={() => onOpenCharacter?.(id)}
              style={styles.turnPress}
            >
            {foe ? (
              <Avatar uri={monster?.photoUri} emoji={monster?.emoji ?? '👹'} size={32} />
            ) : (
              <Avatar uri={c?.photoUri} name={c?.name} size={32} />
            )}
            <Text style={styles.turnName} numberOfLines={1}>
              {out ? (p?.fled ? '🏃 ' : '☠️ ') : p?.defense ? '🛡️ ' : ''}
              {foe ? (monster?.name ?? t('Monstro')) : (c?.name ?? '?')}
            </Text>
            <Text style={styles.turnInit}>🎲 {battle.initiatives[id]}</Text>
            </Pressable>
          </Pulse>
        );
      })}
    </ScrollView>
  );
}

export function ParticipantList({
  battle,
  characters,
  onOpenCharacter,
}: {
  battle: Battle;
  characters: Character[];
  /** Tocar num personagem abre a ficha dele. */
  onOpenCharacter?: (id: string) => void;
}) {
  const { t } = useT();
  return (
    <>
      {battle.participants.map((p) => {
        const c = characters.find((x) => x.id === p.characterId);
        if (!c) return null;
        return (
          <HitFx key={p.characterId} fx={battle.fx} targetId={c.id}>
            <Card style={isOut(battle, c) && { opacity: 0.55 }} onPress={onOpenCharacter && (() => onOpenCharacter(c.id))}>
              <View style={styles.participantHeader}>
                <Avatar uri={c.photoUri} name={c.name} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={text.strong}>
                    {c.name} {p.fled ? '🏃' : c.hp <= 0 ? '☠️' : p.defense ? '🛡️' : ''}
                  </Text>
                  <Muted>
                    {t('Nível {level} · dano causado: {dmg}', { level: c.level, dmg: p.damageDealt })}
                    {p.defense ? ` · ${t('defendendo (🎲 {roll})', { roll: diceLabel(p.defense) })}` : ''}
                  </Muted>
                </View>
                {onOpenCharacter && <Text style={text.accent}>›</Text>}
              </View>
              <CharacterBars character={c} />
            </Card>
          </HitFx>
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
  const { tx } = useT();
  const entries = battle.log.slice(-40).reverse();
  return (
    <Card>
      {entries.map((e) => (
        <Text key={e.id} style={[styles.logLine, { color: e.status ? STATUS_INFO[e.status].color : toneColor[e.tone] }]}>
          {tx(e.text)}
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
  foe: { gap: spacing.xs, borderRadius: radius.md, borderWidth: 2, borderColor: 'transparent', padding: spacing.xs },
  foeCurrent: { borderColor: colors.primary },
  monsterTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  thumb: {
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.goldDim,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
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
  reveal: { marginTop: spacing.xs, gap: 2 },
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
  turnPress: { alignItems: 'center' },
  turnCurrent: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.gold },
  turnName: { color: colors.text, fontSize: 12, fontWeight: '600' },
  turnInit: { color: colors.textMuted, fontSize: 11 },
  participantHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logLine: { fontSize: 13 },
});
