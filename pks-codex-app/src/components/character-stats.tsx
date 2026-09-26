import { StyleSheet, Text, View } from 'react-native';
import { STATUS_INFO, xpToNext } from '@/lib/rules';
import { colors, hpColor, radius, spacing } from '@/lib/theme';
import type { ActiveStatus, Character } from '@/lib/types';
import { PixelIcon } from './pixel-icon';
import { Bar } from './ui';

export function StatusBadges({ statuses }: { statuses: ActiveStatus[] }) {
  if (statuses.length === 0) return null;
  return (
    <View style={styles.badges}>
      {statuses.map((s) => (
        <View key={s.type} style={styles.badge}>
          <Text style={styles.badgeText}>
            {STATUS_INFO[s.type].emoji} {STATUS_INFO[s.type].label} · {s.roundsLeft}t
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Vida, mana e estamina (e XP, opcional). */
export function CharacterBars({ character, showXp }: { character: Character; showXp?: boolean }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Bar
        label="Vida"
        value={character.hp}
        max={character.maxHp}
        color={hpColor(character.hp, character.maxHp)}
        effects
        icon={<PixelIcon shape="heart" pct={character.maxHp > 0 ? character.hp / character.maxHp : 0} color={hpColor(character.hp, character.maxHp)} />}
      />
      <View style={styles.inline}>
        <Bar
          label="Mana"
          value={character.mana}
          max={character.maxMana}
          color={colors.mana}
          icon={<PixelIcon shape="drop" pct={character.maxMana > 0 ? character.mana / character.maxMana : 0} color={colors.mana} />}
        />
        <Bar
          label="Estamina"
          value={character.stamina}
          max={character.maxStamina}
          color={colors.stamina}
          icon={
            <PixelIcon shape="bolt" pct={character.maxStamina > 0 ? character.stamina / character.maxStamina : 0} color={colors.stamina} />
          }
        />
      </View>
      {showXp && (
        <Bar
          label={`Nível ${character.level} — XP`}
          value={character.xp}
          max={xpToNext(character.level)}
          color={colors.xp}
          icon={<PixelIcon shape="star" pct={character.xp / xpToNext(character.level)} color={colors.gold} />}
        />
      )}
      <StatusBadges statuses={character.statuses} />
    </View>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', gap: spacing.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  badge: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { color: colors.text, fontSize: 12, fontWeight: '600' },
});
