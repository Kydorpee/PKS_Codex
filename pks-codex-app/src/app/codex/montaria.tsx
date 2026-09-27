import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { AbilityListEditor, PhotoThumb } from '@/components/editors';
import { Button, CheckRow, Field, Muted, Screen, SectionHeader } from '@/components/ui';
import { newId } from '@/lib/ids';
import { useStore } from '@/lib/store';
import { spacing } from '@/lib/theme';
import type { Mount } from '@/lib/types';
import { useT } from '@/lib/i18n';

/** O Mestre cria/edita uma montaria (foto e habilidades) e escolhe quem a tem. Também pode vendê-la numa loja. */
export default function EditMount() {
  const { t } = useT();
  const { codexId, mountId } = useLocalSearchParams<{ codexId: string; mountId?: string }>();
  const { codexes, characters, saveMount, deleteMount } = useStore();
  const codex = codexes.find((c) => c.id === codexId);
  const existing = codex?.mounts.find((m) => m.id === mountId);

  const [draft, setDraft] = useState<Mount>(() => existing ?? { id: newId(), name: '', emoji: '🐎', description: '', abilities: [] });
  const players = characters.filter((c) => c.codexId === codexId);
  const [owners, setOwners] = useState<string[]>(() => players.filter((p) => p.mountIds.includes(draft.id)).map((p) => p.id));
  const set = (patch: Partial<Mount>) => setDraft((d) => ({ ...d, ...patch }));

  if (!codex) return null;
  const toggleOwner = (id: string) => setOwners((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const inShops = codex.shops.filter((s) => s.items.some((i) => i.mountId === draft.id));

  const save = () => {
    if (!draft.name.trim()) {
      Alert.alert(t('Nome obrigatório'), t('Dê um nome à montaria.'));
      return;
    }
    saveMount(
      codex.id,
      {
        ...draft,
        name: draft.name.trim(),
        emoji: draft.emoji.trim() || '🐎',
        abilities: draft.abilities.filter((a) => a.name.trim()).map((a) => ({ ...a, name: a.name.trim() })),
      },
      owners,
    );
    router.back();
  };

  const confirmDelete = () =>
    Alert.alert(t('Apagar montaria?'), t('{name} sai de todos os personagens e das lojas.', { name: draft.name }), [
      { text: t('Cancelar'), style: 'cancel' },
      {
        text: t('Apagar'),
        style: 'destructive',
        onPress: () => {
          router.back();
          deleteMount(codex.id, draft.id);
        },
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? draft.name || t('Montaria') : t('Nova montaria') }} />
      <View style={styles.inline}>
        <PhotoThumb uri={draft.photoUri} onChange={(photoUri) => set({ photoUri })} size={88} placeholder={draft.emoji || '🐎'} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <View style={styles.inline}>
            <View style={{ width: 72 }}>
              <Field label={t('Ícone')} value={draft.emoji} maxLength={4} onChangeText={(emoji) => set({ emoji })} style={styles.emoji} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('Nome')} placeholder={t('Ex.: Cavalo de Guerra')} value={draft.name} onChangeText={(name) => set({ name })} />
            </View>
          </View>
        </View>
      </View>
      <Field label={t('Descrição')} placeholder={t('Como é, de onde veio...')} multiline value={draft.description} onChangeText={(description) => set({ description })} />

      <AbilityListEditor value={draft.abilities} onChange={(abilities) => set({ abilities })} />
      <Muted>{t('Quem tem a montaria usa estas habilidades na batalha, na categoria “Montaria”.')}</Muted>

      <SectionHeader title={t('Quem tem esta montaria')} />
      {players.length === 0 && <Muted>{t('Nenhum jogador no Codex ainda.')}</Muted>}
      {players.map((p) => (
        <CheckRow
          key={p.id}
          label={p.name}
          uri={p.photoUri}
          detail={owners.includes(p.id) ? t('Tem a montaria') : t('Toque para dar a montaria')}
          checked={owners.includes(p.id)}
          onToggle={() => toggleOwner(p.id)}
        />
      ))}
      <Muted>
        {inShops.length
          ? t('À venda em: {shops}.', { shops: inShops.map((s) => `${s.emoji} ${s.name}`).join(', ') })
          : t('Para vender, abra um local (loja) e toque em "+ montaria" nos itens à venda.')}
      </Muted>

      <Button title={t('Salvar montaria')} onPress={save} style={{ marginTop: spacing.lg }} />
      {existing && <Button variant="danger" title={t('Apagar montaria')} onPress={confirmDelete} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end' },
  emoji: { textAlign: 'center', fontSize: 22 },
});
