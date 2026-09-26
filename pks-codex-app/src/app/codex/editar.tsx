import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Button, Field, Screen } from '@/components/ui';
import { newCodexCode, newId } from '@/lib/ids';
import { useStore } from '@/lib/store';

export default function EditCodex() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { codexes, saveCodex, updateCodex } = useStore();
  const existing = codexes.find((c) => c.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');

  const save = () => {
    if (!name.trim()) {
      Alert.alert('Nome obrigatório', 'Dê um nome à campanha.');
      return;
    }
    if (existing) {
      updateCodex(existing.id, (c) => ({ ...c, name: name.trim(), description: description.trim() }));
      router.back();
      return;
    }
    const codexId = newId();
    saveCodex({
      id: codexId,
      code: newCodexCode(codexes.map((c) => c.code)),
      name: name.trim(),
      description: description.trim(),
      monsters: [],
      shops: [],
      abilities: [],
      battles: [],
      levelUps: [],
      members: [],
      createdAt: Date.now(),
    });
    router.replace({ pathname: '/codex/[id]', params: { id: codexId } });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? 'Editar Codex' : 'Novo Codex' }} />
      <Field label="Nome da campanha" placeholder="Ex.: A Queda de Valdoria" value={name} onChangeText={setName} />
      <Field
        label="Descrição"
        placeholder="Um resumo da história para os jogadores"
        multiline
        value={description}
        onChangeText={setDescription}
      />
      <Button title={existing ? 'Salvar' : 'Criar Codex'} onPress={save} style={{ marginTop: 16 }} />
    </Screen>
  );
}
