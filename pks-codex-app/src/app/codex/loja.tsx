import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { ShopItemListEditor } from '@/components/editors';
import { GoldAmount } from '@/components/monster-stats';
import { Button, CheckRow, Field, Muted, Screen, SectionHeader } from '@/components/ui';
import { newId } from '@/lib/ids';
import { SHOP_PRESETS, shopFromPreset } from '@/lib/presets';
import { useStore } from '@/lib/store';
import { spacing } from '@/lib/theme';
import type { Shop } from '@/lib/types';
import { useT } from '@/lib/i18n';

export default function EditShop() {
  const { t } = useT();
  const { codexId, shopId, preset } = useLocalSearchParams<{ codexId: string; shopId?: string; preset?: string }>();
  const { codexes, characters, updateCodex } = useStore();
  const codex = codexes.find((c) => c.id === codexId);
  const existing = codex?.shops.find((s) => s.id === shopId);

  const [draft, setDraft] = useState<Shop>(() => {
    if (existing) return existing;
    const model = SHOP_PRESETS.find((p) => p.key === preset);
    return model ? shopFromPreset(model) : { id: newId(), name: '', emoji: '🏠', items: [], visibleTo: [] };
  });
  const set = (patch: Partial<Shop>) => setDraft((d) => ({ ...d, ...patch }));

  if (!codex) return null;
  const players = characters.filter((c) => c.codexId === codex.id);

  const toggleVisible = (characterId: string) =>
    set({
      visibleTo: draft.visibleTo.includes(characterId)
        ? draft.visibleTo.filter((id) => id !== characterId)
        : [...draft.visibleTo, characterId],
    });

  const save = () => {
    if (!draft.name.trim()) {
      Alert.alert(t('Nome obrigatório'), t('Dê um nome ao local.'));
      return;
    }
    const shop: Shop = {
      ...draft,
      name: draft.name.trim(),
      emoji: draft.emoji.trim() || '🏠',
      items: draft.items.filter((i) => i.name.trim()),
    };
    updateCodex(codex.id, (c) => ({
      ...c,
      shops: c.shops.some((s) => s.id === shop.id) ? c.shops.map((s) => (s.id === shop.id ? shop : s)) : [...c.shops, shop],
    }));
    router.back();
  };

  const confirmDelete = () =>
    Alert.alert(t('Apagar local?'), t('{name} deixará de existir para todos os jogadores.', { name: draft.name }), [
      { text: t('Cancelar'), style: 'cancel' },
      {
        text: t('Apagar'),
        style: 'destructive',
        onPress: () => {
          updateCodex(codex.id, (c) => ({ ...c, shops: c.shops.filter((s) => s.id !== draft.id) }));
          router.back();
        },
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? draft.name || t('Local') : t('Novo local') }} />
      <View style={styles.inline}>
        <View style={{ width: 80 }}>
          <Field label={t('Ícone')} value={draft.emoji} maxLength={4} onChangeText={(emoji) => set({ emoji })} style={styles.emoji} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t('Nome do local')} placeholder={t('Ex.: Ferreiro do Porto')} value={draft.name} onChangeText={(name) => set({ name })} />
        </View>
      </View>

      <ShopItemListEditor value={draft.items} onChange={(items) => set({ items })} mounts={codex.mounts} />

      <SectionHeader title={t('Quem pode ver')} />
      {players.length === 0 ? (
        <Muted>{t('Nenhum jogador no Codex ainda. Quando entrarem, marque aqui quem pode ver este local.')}</Muted>
      ) : (
        players.map((p) => (
          <CheckRow
            key={p.id}
            label={p.name}
            uri={p.photoUri}
            detail={<GoldAmount value={p.gold} size={14} />}
            checked={draft.visibleTo.includes(p.id)}
            onToggle={() => toggleVisible(p.id)}
          />
        ))
      )}

      <Button title={t('Salvar local')} onPress={save} style={{ marginTop: spacing.lg }} />
      {existing && <Button variant="danger" title={t('Apagar local')} onPress={confirmDelete} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', gap: spacing.md },
  emoji: { textAlign: 'center', fontSize: 22 },
});
