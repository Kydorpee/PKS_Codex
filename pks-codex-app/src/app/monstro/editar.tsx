import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { AbilityListEditor, ItemListEditor, PhotoField, toInt } from '@/components/editors';
import { SHIELD_COLOR } from '@/components/monster-stats';
import { PixelIcon } from '@/components/pixel-icon';
import { Button, CheckRow, Field, Muted, Screen, SectionHeader } from '@/components/ui';
import { newId } from '@/lib/ids';
import { pickPhoto } from '@/lib/photos';
import { addToInventory } from '@/lib/rules';
import { useStore } from '@/lib/store';
import { colors, spacing } from '@/lib/theme';
import type { Monster } from '@/lib/types';
import { useT } from '@/lib/i18n';

export default function EditMonster() {
  const { t } = useT();
  const { codexId, monsterId } = useLocalSearchParams<{ codexId: string; monsterId?: string }>();
  const { codexes, characters, updateCodex, updateCharacter } = useStore();
  const codex = codexes.find((c) => c.id === codexId);
  const existing = codex?.monsters.find((m) => m.id === monsterId);

  const [draft, setDraft] = useState<Monster>(
    () =>
      existing ?? {
        id: newId(),
        name: '',
        hitPoints: 10,
        armor: 10,
        abilities: [],
        loot: [],
        source: 'manual',
        defeated: false,
      },
  );
  const set = (patch: Partial<Monster>) => setDraft((d) => ({ ...d, ...patch }));

  if (!codex) return null;
  const players = characters.filter((c) => c.codexId === codex.id);

  const cleaned = (): Monster => ({
    ...draft,
    name: draft.name.trim(),
    abilities: draft.abilities.filter((a) => a.name.trim()),
    loot: draft.loot.filter((i) => i.name.trim() && i.quantity > 0),
  });

  const persist = (monster: Monster) => {
    updateCodex(codex.id, (c) => ({
      ...c,
      monsters: c.monsters.some((m) => m.id === monster.id)
        ? c.monsters.map((m) => (m.id === monster.id ? monster : m))
        : [...c.monsters, monster],
    }));
  };

  const save = () => {
    if (!draft.name.trim()) {
      Alert.alert(t('Nome obrigatório'), t('Dê um nome ao monstro.'));
      return;
    }
    persist(cleaned());
    router.back();
  };

  const deliverLoot = (characterId: string, characterName: string) => {
    const monster = cleaned();
    if (monster.loot.length === 0) return;
    updateCharacter(characterId, (c) => ({ ...c, inventory: addToInventory(c.inventory, monster.loot) }));
    const looted = { ...monster, loot: [] };
    persist(looted);
    setDraft(looted);
    Alert.alert(t('Espólio entregue'), t('Os itens foram para a bolsa de {name}.', { name: characterName }));
  };

  const confirmDelete = () =>
    Alert.alert(t('Remover monstro?'), t('{name} será removido do Codex.', { name: draft.name || t('Este monstro') }), [
      { text: t('Cancelar'), style: 'cancel' },
      {
        text: t('Remover'),
        style: 'destructive',
        onPress: () => {
          updateCodex(codex.id, (c) => ({ ...c, monsters: c.monsters.filter((m) => m.id !== draft.id) }));
          router.back();
        },
      },
    ]);

  const choosePhoto = async () => {
    const uri = await pickPhoto();
    if (uri) set({ photoUri: uri });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? draft.name || t('Monstro') : t('Novo monstro') }} />
      <PhotoField uri={draft.photoUri} emoji={draft.emoji} name={draft.name} onPick={choosePhoto} onRemove={() => set({ photoUri: undefined })} />
      <Field label={t('Nome')} placeholder={t('Ex.: Lich Ancião')} value={draft.name} onChangeText={(name) => set({ name })} />
      <View style={styles.inline}>
        <View style={{ flex: 1 }}>
          <Field
            label={t('Vida')}
            icon={<PixelIcon shape="heart" color={colors.hp} />}
            keyboardType="number-pad"
            value={String(draft.hitPoints)}
            onChangeText={(v) => set({ hitPoints: toInt(v) })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label={t('Armadura')}
            icon={<PixelIcon shape="shield" color={SHIELD_COLOR} />}
            keyboardType="number-pad"
            value={String(draft.armor)}
            onChangeText={(v) => set({ armor: toInt(v) })}
          />
        </View>
      </View>

      <AbilityListEditor value={draft.abilities} onChange={(abilities) => set({ abilities })} />
      <ItemListEditor title={t('Espólio (liberado ao morrer)')} value={draft.loot} onChange={(loot) => set({ loot })} />

      {existing && (
        <>
          <SectionHeader title={t('Combate')} />
          <CheckRow
            label={`${t('Monstro derrotado')} ☠️`}
            detail={t('Ao derrotar, você pode entregar o espólio a um jogador.')}
            checked={draft.defeated}
            onToggle={() => {
              const monster = { ...cleaned(), defeated: !draft.defeated };
              setDraft(monster);
              persist(monster);
            }}
          />
          {draft.defeated && (
            <>
              {draft.loot.length === 0 && <Muted>{t('Sem espólio para entregar.')}</Muted>}
              {draft.loot.length > 0 && players.length === 0 && <Muted>{t('Nenhum jogador no Codex para receber o espólio.')}</Muted>}
              {draft.loot.length > 0 &&
                players.map((p) => (
                  <Button key={p.id} variant="secondary" title={t('Entregar espólio a {name}', { name: p.name })} onPress={() => deliverLoot(p.id, p.name)} />
                ))}
            </>
          )}
        </>
      )}

      <Button title={t('Salvar monstro')} onPress={save} style={{ marginTop: spacing.lg }} />
      {existing && !draft.defeated && (
        <Button
          variant="secondary"
          title={`⚔️ ${t('Iniciar batalha contra este monstro')}`}
          onPress={() => {
            persist(cleaned());
            router.push({ pathname: '/batalha/nova', params: { codexId: codex.id, monsterId: draft.id } });
          }}
        />
      )}
      {existing && <Button variant="danger" title={t('Remover do Codex')} onPress={confirmDelete} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', gap: spacing.md },
});
