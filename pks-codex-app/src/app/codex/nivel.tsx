import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CharacterBars } from '@/components/character-stats';
import { CostIcon, DamageStat, IconStat } from '@/components/monster-stats';
import { PixelIcon } from '@/components/pixel-icon';
import { Avatar, Button, Card, CheckRow, Field, Muted, Screen, SectionHeader, text } from '@/components/ui';
import { resolveLevelUp, type LevelUpReward } from '@/lib/engine';
import { useStore } from '@/lib/store';
import { colors, radius, spacing } from '@/lib/theme';
import { toShape } from '@/lib/pixel-shapes';
import { RESOURCE_FIELDS, abilityCost, enabledResources } from '@/lib/rules';
import { useT } from '@/lib/i18n';

function Stepper({
  label,
  icon,
  value,
  onChange,
}: {
  label: string;
  icon?: ReactNode;
  value: number;
  onChange: (v: number) => void;
}) {
  const { t } = useT();
  return (
    <View style={styles.stepper}>
      <View style={styles.stepLabel}>
        {icon}
        <Text style={text.body}>{label}</Text>
      </View>
      <Pressable accessibilityLabel={t('Diminuir {what}', { what: label })} hitSlop={8} onPress={() => onChange(value - 1)} style={styles.stepButton}>
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text style={[styles.stepValue, value > 0 && { color: colors.success }, value < 0 && { color: colors.danger }]}>
        {value > 0 ? `+${value}` : value}
      </Text>
      <Pressable accessibilityLabel={t('Aumentar {what}', { what: label })} hitSlop={8} onPress={() => onChange(value + 1)} style={styles.stepButton}>
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

export default function LevelUpEventScreen() {
  const { t, tx } = useT();
  const { codexId, eventId } = useLocalSearchParams<{ codexId: string; eventId: string }>();
  const { codexes, characters, synced, act, updateCodex } = useStore();
  const codex = codexes.find((c) => c.id === codexId);
  const event = codex?.levelUps.find((e) => e.id === eventId);
  const character = characters.find((c) => c.id === event?.characterId);

  const [reward, setReward] = useState<LevelUpReward>({
    maxHp: 5,
    maxMana: 2,
    maxStamina: 2,
    attributes: {},
    newAttributes: [],
    offerAbilityIds: [],
    note: '',
  });
  const set = (patch: Partial<LevelUpReward>) => setReward((r) => ({ ...r, ...patch }));

  if (!codex || !event || !character) {
    const discard = () => {
      if (codex && event) updateCodex(codex.id, (c) => ({ ...c, levelUps: c.levelUps.filter((e) => e.id !== event.id) }));
      router.back();
    };
    return (
      <Screen>
        <Stack.Screen options={{ title: t('Evento de nível') }} />
        {!synced ? (
          <Muted>{t('Carregando...')}</Muted>
        ) : event ? (
          <>
            <Muted>{t('O personagem deste evento saiu do Codex ou foi apagado.')}</Muted>
            <Button variant="danger" title={t('Descartar evento')} onPress={discard} />
          </>
        ) : (
          <Muted>{t('Evento não encontrado.')}</Muted>
        )}
      </Screen>
    );
  }

  if (event.resolved) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('Nível {level}', { level: event.level }) }} />
        <Card>
          <Text style={text.strong}>
            🆙 {t('{name} — nível {level}', { name: character.name, level: event.level })}
          </Text>
          {event.rewards.map((r, i) => (
            <Muted key={i}>• {tx(r)}</Muted>
          ))}
        </Card>
      </Screen>
    );
  }

  const offerable = codex.abilities.filter((a) => !a.classId && !character.abilities.some((x) => x.id === a.id) && !a.offeredTo.includes(character.id));

  const save = () => {
    const error = act((d) => resolveLevelUp(d, codex.id, event.id, reward));
    if (error) Alert.alert(t('Não foi possível concluir'), tx(error));
    else router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('Nível {level}', { level: event.level }) }} />
      <Card>
        <View style={styles.header}>
          <Avatar uri={character.photoUri} name={character.name} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={text.title}>{character.name}</Text>
            <Text style={text.accent}>🆙 Subiu para o nível {event.level}!</Text>
          </View>
        </View>
        <CharacterBars character={character} />
      </Card>

      <SectionHeader title={t('Aumentar status')} />
      <Card>
        {enabledResources(codex).map((r) => {
          const max = RESOURCE_FIELDS[r.key].max;
          return (
            <Stepper
              key={r.key}
              label={t('{pool} máxima', { pool: r.name })}
              icon={<PixelIcon shape={toShape(r.icon)} color={r.color} />}
              value={reward[max]}
              onChange={(v) => set({ [max]: v })}
            />
          );
        })}
        {character.attributes.map((a) => (
          <Stepper
            key={a.id}
            label={`${codex.sheet.baseStats.find((s) => s.id === a.id)?.name ?? a.name} (${a.value})`}
            value={reward.attributes[a.id] ?? 0}
            onChange={(v) => set({ attributes: { ...reward.attributes, [a.id]: v } })}
          />
        ))}
      </Card>

      <SectionHeader
        title={t('Novos atributos')}
        action={
          <Button
            small
            variant="secondary"
            title={t('+ Atributo')}
            onPress={() => set({ newAttributes: [...reward.newAttributes, { name: '', value: 1 }] })}
          />
        }
      />
      {reward.newAttributes.map((a, index) => (
        <View key={index} style={styles.inline}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder={t('Nome (ex.: Carisma)')}
            placeholderTextColor={colors.textMuted}
            value={a.name}
            onChangeText={(name) => set({ newAttributes: reward.newAttributes.map((x, i) => (i === index ? { ...x, name } : x)) })}
          />
          <TextInput
            style={[styles.input, { width: 70, textAlign: 'center' }]}
            keyboardType="number-pad"
            value={String(a.value)}
            onChangeText={(v) =>
              set({ newAttributes: reward.newAttributes.map((x, i) => (i === index ? { ...x, value: parseInt(v, 10) || 0 } : x)) })
            }
          />
        </View>
      ))}

      <SectionHeader title={t('Liberar habilidades')} />
      {offerable.length === 0 && <Muted>{t('Nenhuma habilidade nova disponível no Codex. Crie uma no painel do Codex.')}</Muted>}
      {offerable.map((a) => (
        <CheckRow
          key={a.id}
          label={a.name}
          icon={<CostIcon kind={a.kind} pixel={4} />}
          detail={
            <View style={styles.abilityDetail}>
              <DamageStat damage={a.baseDamage} />
              <IconStat icon={<CostIcon kind={a.kind} />}>{tx(abilityCost(a, codex))}</IconStat>
            </View>
          }
          checked={reward.offerAbilityIds.includes(a.id)}
          onToggle={() =>
            set({
              offerAbilityIds: reward.offerAbilityIds.includes(a.id)
                ? reward.offerAbilityIds.filter((x) => x !== a.id)
                : [...reward.offerAbilityIds, a.id],
            })
          }
        />
      ))}
      <Muted>{t('O jogador ainda escolhe se aceita cada habilidade oferecida.')}</Muted>

      <Field label={t('Mensagem / evento')} placeholder={t('Ex.: Você despertou o poder do fogo!')} multiline value={reward.note} onChangeText={(note) => set({ note })} />

      <Button title={t('Concluir evento de nível')} onPress={save} style={{ marginTop: spacing.lg }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
  stepLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: colors.primary, fontSize: 20, fontWeight: '700' },
  stepValue: { color: colors.text, fontWeight: '700', minWidth: 36, textAlign: 'center' },
  inline: { flexDirection: 'row', gap: spacing.sm },
  abilityDetail: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, marginTop: 2 },
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
