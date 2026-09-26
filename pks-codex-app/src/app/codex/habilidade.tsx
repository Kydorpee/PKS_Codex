import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { AbilityFields, emptyAbility } from '@/components/editors';
import { Button, CheckRow, Muted, Screen, SectionHeader } from '@/components/ui';
import { ABILITY_PRESETS, abilityFromSeed } from '@/lib/presets';
import { useStore } from '@/lib/store';
import { spacing } from '@/lib/theme';
import type { CodexAbility } from '@/lib/types';

export default function EditCodexAbility() {
  const { codexId, abilityId } = useLocalSearchParams<{ codexId: string; abilityId?: string }>();
  const { codexes, characters, saveAbility, deleteAbility, revokeAbility } = useStore();
  const codex = codexes.find((c) => c.id === codexId);
  const existing = codex?.abilities.find((a) => a.id === abilityId);

  const [draft, setDraft] = useState<CodexAbility>(() => existing ?? { ...emptyAbility(), offeredTo: [] });

  if (!codex) return null;
  const players = characters.filter((c) => c.codexId === codex.id);

  const toggleOffer = (characterId: string) =>
    setDraft((d) => ({
      ...d,
      offeredTo: d.offeredTo.includes(characterId) ? d.offeredTo.filter((id) => id !== characterId) : [...d.offeredTo, characterId],
    }));

  const save = () => {
    if (!draft.name.trim()) {
      Alert.alert('Nome obrigatório', 'Dê um nome à habilidade.');
      return;
    }
    const owns = (characterId: string) =>
      characters.find((c) => c.id === characterId)?.abilities.some((a) => a.id === draft.id) ?? true;
    saveAbility(codex.id, { ...draft, name: draft.name.trim(), offeredTo: draft.offeredTo.filter((id) => !owns(id)) });
    router.back();
  };

  const confirmDelete = () =>
    Alert.alert('Apagar habilidade?', 'Ela também será removida de todos os personagens que a possuem.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () => {
          router.back();
          deleteAbility(codex.id, draft.id);
        },
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? 'Editar habilidade' : 'Nova habilidade' }} />

      {!existing && (
        <>
          <Muted>Sugestões (toque para preencher):</Muted>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestions}>
            {ABILITY_PRESETS.map((seed) => (
              <Button
                key={seed[0]}
                small
                variant="secondary"
                title={seed[0]}
                onPress={() => setDraft((d) => ({ ...abilityFromSeed(seed), id: d.id, offeredTo: d.offeredTo }))}
              />
            ))}
          </ScrollView>
        </>
      )}

      <AbilityFields value={draft} onChange={setDraft} />

      <SectionHeader title="Quem pode pegar" />
      {players.length === 0 && <Muted>Nenhum jogador no Codex ainda.</Muted>}
      {players.map((p) => {
        const owns = p.abilities.some((a) => a.id === draft.id);
        if (owns) {
          return (
            <View key={p.id} style={styles.ownerRow}>
              <View style={{ flex: 1 }}>
                <CheckRow label={p.name} uri={p.photoUri} detail="Já possui esta habilidade" checked onToggle={() => {}} />
              </View>
              <Button small variant="danger" title="Remover" onPress={() => revokeAbility(p.id, draft.id)} />
            </View>
          );
        }
        const offered = draft.offeredTo.includes(p.id);
        return (
          <CheckRow
            key={p.id}
            label={p.name}
            uri={p.photoUri}
            detail={offered ? 'Oferecida — aguardando o jogador aceitar' : 'Toque para oferecer'}
            checked={offered}
            onToggle={() => toggleOffer(p.id)}
          />
        );
      })}

      <Button title="Salvar habilidade" onPress={save} style={{ marginTop: spacing.lg }} />
      {existing && <Button variant="danger" title="Apagar habilidade" onPress={confirmDelete} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  suggestions: { gap: spacing.sm },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
