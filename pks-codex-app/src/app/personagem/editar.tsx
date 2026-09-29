import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useStatLabel } from '@/components/character-stats';
import { PhotoField, toInt } from '@/components/editors';
import { PixelIcon } from '@/components/pixel-icon';
import { Button, Field, Muted, Screen, SectionHeader } from '@/components/ui';
import { newId } from '@/lib/ids';
import { toShape } from '@/lib/pixel-shapes';
import { RESOURCE_FIELDS, baseStatValue, characterDefaults, enabledResources, withoutCodex } from '@/lib/rules';
import { pickPhoto } from '@/lib/photos';
import { useStore } from '@/lib/store';
import type { Character } from '@/lib/types';
import { useT } from '@/lib/i18n';

export default function EditCharacter() {
  const { t, tx } = useT();
  const label = useStatLabel();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { characters, codexes, saveCharacter } = useStore();
  const existing = characters.find((c) => c.id === id);
  // Personagem novo começa fora de qualquer Codex: só aparência e história.
  const [draft, setDraft] = useState<Character>(
    () => existing ?? withoutCodex({ id: newId(), name: '', age: '', story: '', ...characterDefaults(), createdAt: Date.now() }),
  );
  const set = (patch: Partial<Character>) => setDraft((d) => ({ ...d, ...patch }));

  const codex = codexes.find((c) => c.id === existing?.codexId);
  // Campos que o Mestre deixou o jogador editar (a regra do Codex liga ou desliga todos).
  const statEdit = !!codex?.allowStatEdit;
  const editableBars = statEdit ? enabledResources(codex).filter((r) => r.editable) : [];
  const editableStats = statEdit ? (codex?.sheet.baseStats.filter((s) => s.editable) ?? []) : [];
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (!existing) return {};
    const bars = editableBars.map((r) => [r.key, String(existing[RESOURCE_FIELDS[r.key].max])]);
    const stats = editableStats.map((s) => [s.id, String(baseStatValue(existing, s))]);
    return Object.fromEntries([...bars, ...stats]);
  });

  const choosePhoto = async () => {
    const uri = await pickPhoto();
    if (uri) set({ photoUri: uri });
  };

  const save = () => {
    if (!draft.name.trim()) {
      Alert.alert(t('Nome obrigatório'), t('Dê um nome ao seu personagem.'));
      return;
    }
    // Salva só os campos editáveis; o resto pode ter mudado (batalha, Mestre) enquanto o formulário estava aberto.
    const current = characters.find((c) => c.id === draft.id);
    const next: Character = {
      ...(current ?? draft),
      name: draft.name.trim(),
      age: draft.age,
      race: draft.race.trim(),
      story: draft.story?.trim(),
      photoUri: draft.photoUri,
    };
    if (current?.codexId === codex?.id) {
      for (const r of editableBars) {
        const { current: now, max } = RESOURCE_FIELDS[r.key];
        const top = toInt(values[r.key] ?? '');
        // Cheio continua cheio; senão o valor atual não passa do novo máximo.
        next[now] = next[now] >= next[max] ? top : Math.min(next[now], top);
        next[max] = top;
      }
      if (editableStats.length > 0) {
        const attributes = next.attributes.map((a) => ({ ...a }));
        for (const s of editableStats) {
          const value = toInt(values[s.id] ?? '');
          const found = attributes.find((a) => a.id === s.id);
          if (found) found.value = value;
          else attributes.push({ id: s.id, name: s.name, value });
        }
        next.attributes = attributes;
      }
    }
    const error = saveCharacter(next);
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
        label={t('História')}
        placeholder={t('De onde vem, o que busca, o que teme...')}
        multiline
        value={draft.story ?? ''}
        onChangeText={(story) => set({ story })}
      />

      {codex && (editableBars.length > 0 || editableStats.length > 0) && (
        <>
          <SectionHeader title={t('Ficha do Codex')} />
          <Muted>{t('O Mestre de "{codex}" deixou você definir estes valores.', { codex: codex.name })}</Muted>
          {editableBars.map((r) => (
            <Field
              key={r.key}
              label={t('{pool} máxima', { pool: t(r.name) })}
              icon={<PixelIcon shape={toShape(r.icon)} color={r.color} />}
              keyboardType="number-pad"
              value={values[r.key] ?? ''}
              onChangeText={(v) => setValues((x) => ({ ...x, [r.key]: v.replace(/\D/g, '') }))}
            />
          ))}
          {editableStats.map((s) => (
            <Field
              key={s.id}
              label={label(s.name, s.abbr)}
              keyboardType="number-pad"
              value={values[s.id] ?? ''}
              onChangeText={(v) => setValues((x) => ({ ...x, [s.id]: v.replace(/\D/g, '') }))}
            />
          ))}
        </>
      )}

      <Muted>
        {codex
          ? t('A ficha (status, itens, moedas, classe e habilidades) vem do Codex e é definida pelo Mestre. Você só altera os status que a regra "Jogador edita status" liberar.')
          : t('A ficha (status, itens, moedas, classe e habilidades) é gerada quando o personagem entra num Codex. Ao sair, ela é apagada e uma nova é gerada se ele entrar de novo.')}
      </Muted>
      <Button title={t('Salvar personagem')} onPress={save} style={{ marginTop: 16 }} />
    </Screen>
  );
}
