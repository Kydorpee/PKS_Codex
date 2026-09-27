import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { STATUS_INFO } from '@/lib/rules';
import { colors, radius, spacing } from '@/lib/theme';
import { costLabel, type Ability } from '@/lib/types';
import { CostIcon, DamageStat } from './monster-stats';
import { Card, Muted, text } from './ui';

/** Exibição somente leitura de uma habilidade. */
export function AbilityCard({ ability, children, onPress }: { ability: Ability; children?: ReactNode; onPress?: () => void }) {
  const magic = ability.kind === 'magica';
  return (
    <Card onPress={onPress}>
      <View style={styles.header}>
        {ability.photoUri && <Image source={{ uri: ability.photoUri }} style={styles.photo} />}
        <Text style={[text.strong, { flex: 1 }]}>{ability.name}</Text>
        <View style={[styles.pill, { borderColor: magic ? colors.mana : colors.stamina }]}>
          <CostIcon kind={ability.kind} />
          <Text style={[styles.pillText, { color: magic ? colors.mana : colors.stamina }]}>{costLabel(ability)}</Text>
        </View>
      </View>
      {!!ability.baseDamage && <DamageStat damage={ability.baseDamage}> de dano base</DamageStat>}
      {ability.status && (
        <Text style={[styles.damage, { color: STATUS_INFO[ability.status].color }]}>
          {STATUS_INFO[ability.status].emoji} {STATUS_INFO[ability.status].label}:{' '}
          <Text style={text.accent}>{ability.statusChance ?? 0}% de chance</Text> ({STATUS_INFO[ability.status].effect})
        </Text>
      )}
      {!!ability.description && <Muted>{ability.description}</Muted>}
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  photo: { width: 48, height: 48, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.goldDim },
  pill: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderWidth: 1, borderRadius: radius.round, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  pillText: { fontSize: 12, fontWeight: '700' },
  damage: { color: colors.text, fontSize: 14 },
});
