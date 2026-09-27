import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { AbilityFields, emptyAbility } from '@/components/editors';
import { Button, CheckRow, Muted, Screen, SectionHeader } from '@/components/ui';
import { ABILITY_PRESETS, abilityFromSeed } from '@/lib/presets';
import { useStore } from '@/lib/store';
import { spacing } from '@/lib/theme';
import type { CodexAbility } from '@/lib/types';
import { useT } from '@/lib/i18n';

export default function EditCodexAbility() {
  const { t } = useT();
  const { codexId, abilityId, classId } = useLocalSearchParams<{ codexId: string; abilityId?: string; classId?: string }>();
  const { codexes, characters, saveAbility, deleteAbility, revokeAbility } = useStore();
  const codex = codexes.find((c) => c.id === codexId);
  const existing = codex?.abilities.find((a) => a.id === abilityId);

  const [draft, setDraft] = useState<CodexAbility>(() => existing ?? { ...emptyAbility(), offeredTo: [], classId });

  if (!codex) return null;
  const players = characters.filter((c) => c.codexId === codex.id);
  const klass = codex.classes.find((k) => k.id === draft.classId);

  const toggleOffer = (characterId: string) =>
    setDraft((d) => ({
      ...d,
      offeredTo: d.offeredTo.includes(characterId) ? d.offeredTo.filter((id) => id !== characterId) : [...d.offeredTo, characterId],
    }));

  const save = () => {
    if (!draft.name.trim()) {
      Alert.alert(t('Nome obrigatório'), t('Dê um nome à habilidade.'));
      return;
    }
    const owns = (characterId: string) =>
      characters.find((c) => c.id === characterId)?.abilities.some((a) => a.id === draft.id) ?? true;
    // Habilidade de classe não tem oferta: vai para todos da classe.
    const offeredTo = draft.classId ? [] : draft.offeredTo.filter((id) => !owns(id));
    saveAbility(codex.id, { ...draft, name: draft.name.trim(), offeredTo });
    router.back();
  };

  const confirmDelete = () =>
    Alert.alert(t('Apagar habilidade?'), t('Ela também será removida de todos os personagens que a possuem.'), [
      { text: t('Cancelar'), style: 'cancel' },
      {
        text: t('Apagar'),
        style: 'destructive',
        onPress: () => {
          router.back();
          deleteAbility(codex.id, draft.id);
        },
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? t('Editar habilidade') : t('Nova habilidade') }} />

      {!existing && (
        <>
          <Muted>{t('Sugestões (toque para preencher):')}</Muted>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestions}>
            {ABILITY_PRESETS.map((seed) => (
              <Button
                key={seed[0]}
                small
                variant="secondary"
                title={seed[0]}
                onPress={() => setDraft((d) => ({ ...abilityFromSeed(seed), id: d.id, offeredTo: d.offeredTo, classId: d.classId }))}
              />
            ))}
          </ScrollView>
        </>
      )}

      <AbilityFields value={draft} onChange={setDraft} />

      <SectionHeader title={t('Classe')} />
      <View style={styles.classes}>
        <Button
          small
          variant={draft.classId ? 'secondary' : 'primary'}
          title={t('Geral (sem classe)')}
          onPress={() => setDraft((d) => ({ ...d, classId: undefined }))}
        />
        {codex.classes.map((k) => (
          <Button
            key={k.id}
            small
            variant={draft.classId === k.id ? 'primary' : 'secondary'}
            title={`${k.emoji} ${k.name}`}
            onPress={() => setDraft((d) => ({ ...d, classId: k.id, offeredTo: [] }))}
          />
        ))}
      </View>

      {klass ? (
        <Muted>
          {t('Todo personagem da classe {klass} recebe esta habilidade ({n} agora).', { klass: `${klass.emoji} ${klass.name}`, n: players.filter((p) => p.classId === klass.id).length })}
        </Muted>
      ) : (
        <SectionHeader title={t('Quem pode pegar')} />
      )}
      {!klass && players.length === 0 && <Muted>{t('Nenhum jogador no Codex ainda.')}</Muted>}
      {!klass && players.map((p) => {
        const owns = p.abilities.some((a) => a.id === draft.id);
        if (owns) {
          return (
            <View key={p.id} style={styles.ownerRow}>
              <View style={{ flex: 1 }}>
                <CheckRow label={p.name} uri={p.photoUri} detail={t('Já possui esta habilidade')} checked onToggle={() => {}} />
              </View>
              <Button small variant="danger" title={t('Remover')} onPress={() => revokeAbility(p.id, draft.id)} />
            </View>
          );
        }
        const offered = draft.offeredTo.includes(p.id);
        return (
          <CheckRow
            key={p.id}
            label={p.name}
            uri={p.photoUri}
            detail={offered ? t('Oferecida — aguardando o jogador aceitar') : t('Toque para oferecer')}
            checked={offered}
            onToggle={() => toggleOffer(p.id)}
          />
        );
      })}

      <Button title={t('Salvar habilidade')} onPress={save} style={{ marginTop: spacing.lg }} />
      {existing && <Button variant="danger" title={t('Apagar habilidade')} onPress={confirmDelete} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  suggestions: { gap: spacing.sm },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  classes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
