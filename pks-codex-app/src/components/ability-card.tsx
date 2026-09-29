import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { abilityCost, abilityPool, STATUS_INFO } from '@/lib/rules';
import { colors, radius, spacing } from '@/lib/theme';
import type { Ability, Codex } from '@/lib/types';
import { CostIcon, DamageStat } from './monster-stats';
import { Card, Muted, text } from './ui';
import { useT } from '@/lib/i18n';

/** Exibição somente leitura de uma habilidade. `codex` dá o nome e a cor da barra que paga o custo. */
export function AbilityCard({
  ability,
  codex,
  children,
  onPress,
}: {
  ability: Ability;
  codex?: Pick<Codex, 'sheet'>;
  children?: ReactNode;
  onPress?: () => void;
}) {
  const { t, tx } = useT();
  const poolColor = abilityPool(codex, ability.kind)?.color ?? colors.textMuted;
  return (
    <Card onPress={onPress}>
      <View style={styles.header}>
        {ability.photoUri && <Image source={{ uri: ability.photoUri }} style={styles.photo} />}
        <Text style={[text.strong, { flex: 1 }]}>{ability.name}</Text>
        <View style={[styles.pill, { borderColor: poolColor }]}>
          <CostIcon kind={ability.kind} />
          <Text style={[styles.pillText, { color: poolColor }]}>{tx(abilityCost(ability, codex))}</Text>
        </View>
      </View>
      {!!ability.baseDamage && <DamageStat damage={ability.baseDamage}>{t(' de dano base')}</DamageStat>}
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
