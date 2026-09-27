import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { ItemListEditor } from '@/components/editors';
import { Button, CheckRow, Field, Muted, Screen, SectionHeader } from '@/components/ui';
import { newCodexCode, newId } from '@/lib/ids';
import { itemSuggestions } from '@/lib/presets';
import { useStore } from '@/lib/store';
import type { Codex, Item } from '@/lib/types';
import { useT } from '@/lib/i18n';

type CodexFields = Pick<Codex, 'name' | 'description' | 'startingItems' | 'allowFreeInventory'>;

const newCodex = (usedCodes: string[], fields: CodexFields): Codex => ({
  id: newId(),
  code: newCodexCode(usedCodes),
  ...fields,
  monsters: [],
  shops: [],
  abilities: [],
  classes: [], mounts: [],
  battles: [],
  levelUps: [],
  members: [],
  createdAt: Date.now(),
});

export default function EditCodex() {
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { codexes, saveCodex, updateCodex } = useStore();
  const existing = codexes.find((c) => c.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [startingItems, setStartingItems] = useState<Item[]>(existing?.startingItems ?? []);
  const [allowFreeInventory, setAllowFreeInventory] = useState(existing?.allowFreeInventory ?? false);

  const save = () => {
    if (!name.trim()) {
      Alert.alert(t('Nome obrigatório'), t('Dê um nome à campanha.'));
      return;
    }
    const items = startingItems
      .filter((i) => i.name.trim() && i.quantity > 0)
      .map((i) => ({ ...i, name: i.name.trim(), description: i.description.trim() }));
    const fields: CodexFields = { name: name.trim(), description: description.trim(), startingItems: items, allowFreeInventory };
    if (existing) {
      updateCodex(existing.id, (c) => ({ ...c, ...fields }));
      router.back();
      return;
    }
    const codex = newCodex(codexes.map((c) => c.code), fields);
    saveCodex(codex);
    router.replace({ pathname: '/codex/[id]', params: { id: codex.id } });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? t('Editar Codex') : t('Novo Codex') }} />
      <Field label={t('Nome da campanha')} placeholder={t('Ex.: A Queda de Valdoria')} value={name} onChangeText={setName} />
      <Field
        label={t('Descrição')}
        placeholder={t('Um resumo da história para os jogadores')}
        multiline
        value={description}
        onChangeText={setDescription}
      />
      <ItemListEditor
        title={t('Inventário inicial')}
        value={startingItems}
        onChange={setStartingItems}
        suggestions={itemSuggestions(existing?.shops)}
      />
      <Muted>{t('Todo personagem que entrar no Codex recebe estes itens na bolsa (uma vez por personagem).')}</Muted>
      <SectionHeader title={t('Regras')} />
      <CheckRow
        label={t('Inventário livre')}
        icon={<Text style={{ fontSize: 28 }}>🎒</Text>}
        detail={
          allowFreeInventory
            ? t('Jogadores compram nas lojas e também podem adicionar e ajustar itens na própria bolsa.')
            : t('Jogadores só recebem itens comprando nas lojas ou pelas mãos do Mestre.')
        }
        checked={allowFreeInventory}
        onToggle={() => setAllowFreeInventory((v) => !v)}
      />
      <Button title={existing ? t('Salvar') : t('Criar Codex')} onPress={save} style={{ marginTop: 16 }} />
    </Screen>
  );
}
