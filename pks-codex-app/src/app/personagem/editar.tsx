import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { AttributeListEditor, PhotoField, toInt } from '@/components/editors';
import { CoinIcon } from '@/components/monster-stats';
import { PixelIcon } from '@/components/pixel-icon';
import { Button, Field, Muted, Screen, SectionHeader } from '@/components/ui';
import { newId } from '@/lib/ids';
import { characterDefaults } from '@/lib/rules';
import { pickPhoto } from '@/lib/photos';
import { useStore } from '@/lib/store';
import { colors, spacing } from '@/lib/theme';
import type { Character } from '@/lib/types';
import { useT } from '@/lib/i18n';

type Pool = { current: 'hp' | 'mana' | 'stamina'; max: 'maxHp' | 'maxMana' | 'maxStamina'; label: string; icon: ReactNode };

const POOLS: Pool[] = [
  { current: 'hp', max: 'maxHp', label: 'Vida', icon: <PixelIcon shape="heart" color={colors.danger} /> },
  { current: 'mana', max: 'maxMana', label: 'Mana', icon: <PixelIcon shape="drop" color={colors.mana} /> },
  { current: 'stamina', max: 'maxStamina', label: 'Estamina', icon: <PixelIcon shape="bolt" color={colors.stamina} /> },
];

export default function EditCharacter() {
  const { t, tx } = useT();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { characters, saveCharacter } = useStore();
  const existing = characters.find((c) => c.id === id);

  const [draft, setDraft] = useState<Character>(
    () =>
      existing ?? {
        id: newId(),
        name: '',
        age: '',
        ...characterDefaults(),
        createdAt: Date.now(),
      },
  );
  const set = (patch: Partial<Character>) => setDraft((d) => ({ ...d, ...patch }));

  const choosePhoto = async () => {
    const uri = await pickPhoto();
    if (uri) set({ photoUri: uri });
  };

  const save = () => {
    if (!draft.name.trim()) {
      Alert.alert(t('Nome obrigatório'), t('Dê um nome ao seu personagem.'));
      return;
    }
    // Na criação o personagem começa cheio; na edição o valor atual não passa do máximo.
    const pools = Object.fromEntries(
      POOLS.flatMap(({ current, max }) => [
        [max, draft[max]],
        [current, existing ? Math.min(draft[current], draft[max]) : draft[max]],
      ]),
    ) as Pick<Character, Pool['current'] | Pool['max']>;
    // Salva só os campos editáveis; habilidades/inventário podem ter mudado enquanto o formulário estava aberto.
    const current = characters.find((c) => c.id === draft.id);
    const error = saveCharacter({
      ...(current ?? draft),
      name: draft.name.trim(),
      age: draft.age,
      race: draft.race.trim(),
      photoUri: draft.photoUri,
      gold: draft.gold,
      attributes: draft.attributes.filter((a) => a.name.trim()).map((a) => ({ ...a, name: a.name.trim() })),
      ...pools,
    });
    if (error) {
      Alert.alert(t('Não foi possível salvar'), tx(error));
      return;
    }
    if (existing) router.back();
    else router.replace({ pathname: '/personagem/[id]', params: { id: draft.id } });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? t('Editar personagem') : t('Novo personagem') }} />
      <PhotoField uri={draft.photoUri} name={draft.name} onPick={choosePhoto} onRemove={() => set({ photoUri: undefined })} />
      <Field label={t('Nome')} placeholder={t('Ex.: Aria Lâmina-Negra')} value={draft.name} onChangeText={(name) => set({ name })} />
      <Field label={t('Raça')} placeholder={t('Ex.: Elfo')} value={draft.race} onChangeText={(race) => set({ race })} />
      <Field label={t('Idade')} placeholder="27" keyboardType="number-pad" value={draft.age} onChangeText={(age) => set({ age: age.replace(/\D/g, '') })} />
      <Field
        label={existing ? t('Ouro') : t('Ouro inicial')}
        icon={<CoinIcon />}
        keyboardType="number-pad"
        value={String(draft.gold)}
        onChangeText={(v) => set({ gold: toInt(v) })}
      />

      <SectionHeader title={t('Vida, mana e estamina')} />
      {POOLS.map(({ current, max, label, icon }) =>
        existing ? (
          <View key={max} style={styles.poolRow}>
            <View style={{ flex: 1 }}>
              <Field label={t('{pool} atual', { pool: label })} icon={icon} keyboardType="number-pad" value={String(draft[current])} onChangeText={(v) => set({ [current]: toInt(v) })} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('{pool} máxima', { pool: label })} keyboardType="number-pad" value={String(draft[max])} onChangeText={(v) => set({ [max]: toInt(v) })} />
            </View>
          </View>
        ) : (
          <Field key={max} label={t(label)} icon={icon} keyboardType="number-pad" value={String(draft[max])} onChangeText={(v) => set({ [max]: toInt(v) })} />
        ),
      )}

      <AttributeListEditor value={draft.attributes} onChange={(attributes) => set({ attributes })} />
      <Muted>{t('Use os atributos do seu Codex. Habilidades são liberadas pelo Mestre.')}</Muted>
      <Button title={t('Salvar personagem')} onPress={save} style={{ marginTop: 16 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  poolRow: { flexDirection: 'row', gap: spacing.md },
});
