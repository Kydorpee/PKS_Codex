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
import { costLabel } from '@/lib/types';

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
  return (
    <View style={styles.stepper}>
      <View style={styles.stepLabel}>
        {icon}
        <Text style={text.body}>{label}</Text>
      </View>
      <Pressable accessibilityLabel={`Diminuir ${label}`} hitSlop={8} onPress={() => onChange(value - 1)} style={styles.stepButton}>
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text style={[styles.stepValue, value > 0 && { color: colors.success }, value < 0 && { color: colors.danger }]}>
        {value > 0 ? `+${value}` : value}
      </Text>
      <Pressable accessibilityLabel={`Aumentar ${label}`} hitSlop={8} onPress={() => onChange(value + 1)} style={styles.stepButton}>
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

export default function LevelUpEventScreen() {
  const { codexId, eventId } = useLocalSearchParams<{ codexId: string; eventId: string }>();
  const { codexes, characters, act } = useStore();
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
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Evento de nível' }} />
        <Muted>Evento não encontrado.</Muted>
      </Screen>
    );
  }

  if (event.resolved) {
    return (
      <Screen>
        <Stack.Screen options={{ title: `Nível ${event.level}` }} />
        <Card>
          <Text style={text.strong}>
            🆙 {character.name} — nível {event.level}
          </Text>
          {event.rewards.map((r, i) => (
            <Muted key={i}>• {r}</Muted>
          ))}
        </Card>
      </Screen>
    );
  }

  const offerable = codex.abilities.filter((a) => !character.abilities.some((x) => x.id === a.id) && !a.offeredTo.includes(character.id));

  const save = () => {
    const error = act((d) => resolveLevelUp(d, codex.id, event.id, reward));
    if (error) Alert.alert('Não foi possível concluir', error);
    else router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: `Nível ${event.level}` }} />
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

      <SectionHeader title="Aumentar status" />
      <Card>
        <Stepper
          label="Vida máxima"
          icon={<PixelIcon shape="heart" color={colors.hp} />}
          value={reward.maxHp}
          onChange={(maxHp) => set({ maxHp })}
        />
        <Stepper
          label="Mana máxima"
          icon={<PixelIcon shape="drop" color={colors.mana} />}
          value={reward.maxMana}
          onChange={(maxMana) => set({ maxMana })}
        />
        <Stepper
          label="Estamina máxima"
          icon={<PixelIcon shape="bolt" color={colors.stamina} />}
          value={reward.maxStamina}
          onChange={(maxStamina) => set({ maxStamina })}
        />
        {character.attributes.map((a) => (
          <Stepper
            key={a.id}
            label={`${a.name} (${a.value})`}
            value={reward.attributes[a.id] ?? 0}
            onChange={(v) => set({ attributes: { ...reward.attributes, [a.id]: v } })}
          />
        ))}
      </Card>

      <SectionHeader
        title="Novos atributos"
        action={
          <Button
            small
            variant="secondary"
            title="+ Atributo"
            onPress={() => set({ newAttributes: [...reward.newAttributes, { name: '', value: 1 }] })}
          />
        }
      />
      {reward.newAttributes.map((a, index) => (
        <View key={index} style={styles.inline}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Nome (ex.: Carisma)"
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

      <SectionHeader title="Liberar habilidades" />
      {offerable.length === 0 && <Muted>Nenhuma habilidade nova disponível no Codex. Crie uma no painel do Codex.</Muted>}
      {offerable.map((a) => (
        <CheckRow
          key={a.id}
          label={a.name}
          icon={<CostIcon kind={a.kind} pixel={4} />}
          detail={
            <View style={styles.abilityDetail}>
              <DamageStat damage={a.baseDamage} />
              <IconStat icon={<CostIcon kind={a.kind} />}>{costLabel(a)}</IconStat>
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
      <Muted>O jogador ainda escolhe se aceita cada habilidade oferecida.</Muted>

      <Field label="Mensagem / evento" placeholder="Ex.: Você despertou o poder do fogo!" multiline value={reward.note} onChangeText={(note) => set({ note })} />

      <Button title="Concluir evento de nível" onPress={save} style={{ marginTop: spacing.lg }} />
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
