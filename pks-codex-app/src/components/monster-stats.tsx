import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/lib/theme';
import type { AbilityKind } from '@/lib/types';
import { PixelIcon } from './pixel-icon';
import { usePaper } from './ui';

export const SHIELD_COLOR = '#8A9BAD';
export const BLADE_COLOR = '#B8C4CE';
export const WOOD_COLOR = '#8B5A2B';
export const BLAST_COLOR = '#E0701A';
export const BLAST_CORE = '#F2C94C';
export const COIN_RIM = '#C99A2E';
export const COIN_FACE = '#F2D46B';

/** Estrela de XP/nível em pixel art. */
export const StarIcon = ({ pixel }: { pixel?: number }) => <PixelIcon shape="star" color={colors.gold} pixel={pixel} />;

/** Moeda de ouro em pixel art. */
export const CoinIcon = ({ pixel }: { pixel?: number }) => (
  <PixelIcon shape="coin" color={COIN_RIM} accent={COIN_FACE} pixel={pixel} />
);

/** Quantidade de ouro com a moeda, em destaque (carmesim sobre pergaminho, dourado sobre carvão). */
export function GoldAmount({ value, size = 16, suffix }: { value: number; size?: number; suffix?: string }) {
  const color = usePaper() ? colors.primary : colors.gold;
  return (
    <View style={styles.stat}>
      <CoinIcon pixel={size >= 20 ? 3 : 2} />
      <Text style={{ color, fontSize: size, fontWeight: '800' }}>
        {value}
        {suffix}
      </Text>
    </View>
  );
}

/** Cajado (mágica, custa mana) ou espada (física, custa estamina). */
export function CostIcon({ kind, pixel }: { kind: AbilityKind; pixel?: number }) {
  return kind === 'magica' ? (
    <PixelIcon shape="staff" color={WOOD_COLOR} accent={colors.mana} pixel={pixel} />
  ) : (
    <PixelIcon shape="sword" color={BLADE_COLOR} pixel={pixel} />
  );
}

/** Ícone em pixel art seguido de um valor, na cor de texto secundário do contexto. */
export function IconStat({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  const color = usePaper() ? colors.textMuted : colors.textOnDarkMuted;
  return (
    <View style={styles.stat}>
      {icon}
      <Text style={[styles.value, { color }]}>{children}</Text>
    </View>
  );
}

/** Explosão em pixel art: ícone do dano. */
export const BlastIcon = () => <PixelIcon shape="explosion" color={BLAST_COLOR} accent={BLAST_CORE} />;

/** Dano base de uma habilidade, com explosão em pixel art. */
export function DamageStat({ damage, children }: { damage: string; children?: ReactNode }) {
  return (
    <IconStat icon={<BlastIcon />}>
      <Text style={styles.damage}>{damage || '—'}</Text>
      {children}
    </IconStat>
  );
}

/** Vida e armadura de um monstro, com coração e escudo em pixel art. */
export function MonsterStats({ hitPoints, armor, extra }: { hitPoints: number; armor: number; extra?: string }) {
  return (
    <View style={styles.row}>
      <IconStat icon={<PixelIcon shape="heart" color={colors.hp} />}>{hitPoints}</IconStat>
      <IconStat icon={<PixelIcon shape="shield" color={SHIELD_COLOR} />}>{armor}</IconStat>
      {!!extra && <IconStat icon={null}>{extra}</IconStat>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.md, rowGap: 2 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  value: { fontSize: 14, flexShrink: 1 },
  damage: { color: colors.primary, fontWeight: '800' },
});
