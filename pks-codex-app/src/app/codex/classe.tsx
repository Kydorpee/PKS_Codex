import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { AbilityCard } from '@/components/ability-card';
import { Button, CheckRow, Field, Muted, Screen, SectionHeader } from '@/components/ui';
import { newId } from '@/lib/ids';
import { useStore } from '@/lib/store';
import { spacing } from '@/lib/theme';
import type { CodexClass } from '@/lib/types';
import { useT } from '@/lib/i18n';

/** O Mestre cria/edita uma classe, vê as habilidades dela e libera a troca para os personagens. */
export default function EditCodexClass() {
  const { t } = useT();
  const { codexId, classId } = useLocalSearchParams<{ codexId: string; classId?: string }>();
  const { codexes, characters, saveClass, deleteClass } = useStore();
  const codex = codexes.find((c) => c.id === codexId);
  const existing = codex?.classes.find((k) => k.id === classId);

  const [draft, setDraft] = useState<CodexClass>(
    () => existing ?? { id: newId(), name: '', emoji: '⚔️', description: '', offeredTo: [] },
  );

  if (!codex) return null;
  const players = characters.filter((c) => c.codexId === codex.id);
  const abilities = codex.abilities.filter((a) => a.classId === draft.id);
  const set = (patch: Partial<CodexClass>) => setDraft((d) => ({ ...d, ...patch }));

  const toggleOffer = (characterId: string) =>
    set({
      offeredTo: draft.offeredTo.includes(characterId)
        ? draft.offeredTo.filter((id) => id !== characterId)
        : [...draft.offeredTo, characterId],
    });

  const valid = () => {
    if (draft.name.trim()) return true;
    Alert.alert(t('Nome obrigatório'), t('Dê um nome à classe.'));
    return false;
  };

  const clean = (): CodexClass => ({
    ...draft,
    name: draft.name.trim(),
    emoji: draft.emoji.trim() || '⚔️',
    // Quem já é da classe não precisa da oferta.
    offeredTo: draft.offeredTo.filter((id) => players.find((p) => p.id === id)?.classId !== draft.id),
  });

  const save = () => {
    if (!valid()) return;
    saveClass(codex.id, clean());
    router.back();
  };

  // A habilidade nova já pertence à classe: salva a classe antes de abrir o editor.
  const newAbility = () => {
    if (!valid()) return;
    saveClass(codex.id, clean());
    router.push({ pathname: '/codex/habilidade', params: { codexId: codex.id, classId: draft.id } });
  };

  const confirmDelete = () =>
    Alert.alert(t('Apagar classe?'), t('As habilidades desta classe serão apagadas e quem a tinha ficará sem classe.'), [
      { text: t('Cancelar'), style: 'cancel' },
      {
        text: t('Apagar'),
        style: 'destructive',
        onPress: () => {
          router.back();
          deleteClass(codex.id, draft.id);
        },
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? t('Editar classe') : t('Nova classe') }} />

      <View style={styles.inline}>
        <Field label={t('Ícone')} value={draft.emoji} maxLength={4} onChangeText={(emoji) => set({ emoji })} style={styles.emoji} />
        <View style={{ flex: 1 }}>
          <Field label={t('Nome')} placeholder={t('Ex.: Guerreiro, Mago, Ladino')} value={draft.name} onChangeText={(name) => set({ name })} />
        </View>
      </View>
      <Field label={t('Descrição')} multiline value={draft.description} onChangeText={(description) => set({ description })} />

      <SectionHeader title={t('Habilidades da classe')} action={<Button small variant="secondary" title={t('+ Nova')} onPress={newAbility} />} />
      <Muted>{t('Todo personagem desta classe recebe estas habilidades. Ao trocar de classe, ele as perde.')}</Muted>
      {abilities.map((a) => (
        <AbilityCard
          key={a.id}
          ability={a}
          onPress={() => router.push({ pathname: '/codex/habilidade', params: { codexId: codex.id, abilityId: a.id } })}
        />
      ))}

      <SectionHeader title={t('Quem pode escolher esta classe')} />
      <Muted>{t('Só o Mestre libera classes. O jogador escolhe se troca a classe atual por esta.')}</Muted>
      {players.length === 0 && <Muted>{t('Nenhum jogador no Codex ainda.')}</Muted>}
      {players.map((p) => {
        if (p.classId === draft.id) {
          return <CheckRow key={p.id} label={p.name} uri={p.photoUri} detail={t('Classe atual')} checked onToggle={() => {}} />;
        }
        const offered = draft.offeredTo.includes(p.id);
        const current = codex.classes.find((k) => k.id === p.classId);
        return (
          <CheckRow
            key={p.id}
            label={p.name}
            uri={p.photoUri}
            detail={
              offered
                ? t('Liberada — aguardando o jogador escolher')
                : t('Classe atual: {klass} · toque para liberar', { klass: current ? `${current.emoji} ${current.name}` : t('nenhuma') })
            }
            checked={offered}
            onToggle={() => toggleOffer(p.id)}
          />
        );
      })}

      <Button title={t('Salvar classe')} onPress={save} style={{ marginTop: spacing.lg }} />
      {existing && <Button variant="danger" title={t('Apagar classe')} onPress={confirmDelete} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  emoji: { textAlign: 'center', fontSize: 22, width: 64 },
});
