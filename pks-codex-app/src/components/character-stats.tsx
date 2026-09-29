import { StyleSheet, Text, View } from 'react-native';
import { toShape } from '@/lib/pixel-shapes';
import { DEFAULT_RESOURCES, RESOURCE_FIELDS, STATUS_INFO, actionStatValue, baseStatValue, enabledResources, extraAttributes, formulaText, xpToNext } from '@/lib/rules';
import { useStore } from '@/lib/store';
import { colors, hpColor, radius, spacing } from '@/lib/theme';
import type { ActiveStatus, Character, Codex, ResourceDef } from '@/lib/types';
import { useT } from '@/lib/i18n';
import { PixelIcon } from './pixel-icon';
import { Bar, Muted, SectionHeader, Stat } from './ui';

export function StatusBadges({ statuses }: { statuses: ActiveStatus[] }) {
  const { t } = useT();
  if (statuses.length === 0) return null;
  return (
    <View style={styles.badges}>
      {statuses.map((s) => (
        <View key={s.type} style={[styles.badge, { borderColor: STATUS_INFO[s.type].color }]}>
          <Text style={[styles.badgeText, { color: STATUS_INFO[s.type].color }]}>
            {STATUS_INFO[s.type].emoji} {t(STATUS_INFO[s.type].label)} · {s.roundsLeft}t
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Codex do personagem (para ler a ficha configurada pelo Mestre). */
export function useCharacterCodex(character: Character): Codex | undefined {
  const { codexes } = useStore();
  return codexes.find((c) => c.id === character.codexId);
}

/** Cor da barra: a vida com a cor padrão muda com a porcentagem (verde → âmbar → carmesim). */
const barColor = (def: ResourceDef, value: number, max: number) =>
  def.key === 'hp' && def.color === DEFAULT_RESOURCES[0].color ? hpColor(value, max) : def.color;

/** Rótulo de uma barra ou status: "Nome (SIGLA)". Os nomes padrão são traduzidos. */
export function useStatLabel() {
  const { t } = useT();
  return (name: string, abbr?: string) => (abbr ? `${t(name)} (${abbr})` : t(name));
}

/** Uma barra da ficha (vida, mana, estamina...) com o nome, cor e ícone escolhidos pelo Mestre. */
export function ResourceBar({ character, def, effects }: { character: Character; def: ResourceDef; effects?: boolean }) {
  const label = useStatLabel();
  const { current, max } = RESOURCE_FIELDS[def.key];
  const value = character[current];
  const top = character[max];
  const color = barColor(def, value, top);
  return (
    <Bar
      label={label(def.name, def.abbr)}
      value={value}
      max={top}
      color={color}
      effects={effects}
      icon={<PixelIcon shape={toShape(def.icon)} pct={top > 0 ? value / top : 0} color={color} />}
    />
  );
}

/** Barras ligadas no Codex (vida em cima, as outras lado a lado) e XP, opcional. */
export function CharacterBars({ character, showXp }: { character: Character; showXp?: boolean }) {
  const { t } = useT();
  const codex = useCharacterCodex(character);
  const [life, ...others] = enabledResources(codex);
  return (
    <View style={{ gap: spacing.sm }}>
      <ResourceBar character={character} def={life} effects />
      {others.length > 0 && (
        <View style={styles.inline}>
          {others.map((def) => (
            <ResourceBar key={def.key} character={character} def={def} />
          ))}
        </View>
      )}
      {showXp && (
        <Bar
          label={t('Nível {level} — XP', { level: character.level })}
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

/** Status base (valores da ficha), status de ação (calculados) e atributos extras do personagem. */
export function CharacterStatBlocks({ character, codex }: { character: Character; codex: Codex }) {
  const { t } = useT();
  const label = useStatLabel();
  const { baseStats, actionStats } = codex.sheet;
  const extras = extraAttributes(character, codex);
  return (
    <>
      {(baseStats.length > 0 || extras.length > 0) && <SectionHeader title={t('Status base')} />}
      {(baseStats.length > 0 || extras.length > 0) && (
        <View style={styles.stats}>
          {baseStats.map((s) => (
            <Stat key={s.id} label={label(s.name, s.abbr)} value={baseStatValue(character, s)} />
          ))}
          {extras.map((a) => (
            <Stat key={a.id} label={a.name} value={a.value} />
          ))}
        </View>
      )}
      {actionStats.length > 0 && (
        <>
          <SectionHeader title={t('Status de ação')} />
          <View style={styles.stats}>
            {actionStats.map((a) => (
              <View key={a.id} style={styles.actionStat}>
                <Stat label={label(a.name, a.abbr)} value={actionStatValue(character, codex, a)} />
                <Muted>{formulaText(a, baseStats)}</Muted>
              </View>
            ))}
          </View>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionStat: { alignItems: 'center' },
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
