import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { ItemListEditor, toInt } from '@/components/editors';
import { StarIcon } from '@/components/monster-stats';
import { Button, CheckRow, Field, Muted, Screen, SectionHeader } from '@/components/ui';
import { grantRewards } from '@/lib/engine';
import { itemSuggestions } from '@/lib/presets';
import { MAX_LEVEL } from '@/lib/rules';
import { useStore } from '@/lib/store';
import { spacing } from '@/lib/theme';
import type { Item } from '@/lib/types';
import { useT } from '@/lib/i18n';

/** O Mestre entrega XP e itens aos personagens escolhidos, fora de batalha. */
export default function GrantRewards() {
  const { t, tx } = useT();
  const { codexId } = useLocalSearchParams<{ codexId: string }>();
  const { codexes, characters, act } = useStore();
  const codex = codexes.find((c) => c.id === codexId);

  const [selected, setSelected] = useState<string[]>([]);
  const [xp, setXp] = useState('');
  const [items, setItems] = useState<Item[]>([]);

  if (!codex) return null;
  const players = characters.filter((c) => c.codexId === codex.id);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allSelected = players.length > 0 && players.every((p) => selected.includes(p.id));

  const grant = () => {
    const ids = selected.filter((id) => players.some((p) => p.id === id));
    const error = act((data) => grantRewards(data, codex.id, ids, toInt(xp), items));
    if (error) {
      Alert.alert(t('Não foi possível entregar'), tx(error));
      return;
    }
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('Dar XP e itens') }} />

      <SectionHeader
        title={t('Personagens')}
        action={
          players.length > 0 && (
            <Button
              small
              variant="secondary"
              title={allSelected ? t('Nenhum') : t('Todos')}
              onPress={() => setSelected(allSelected ? [] : players.map((p) => p.id))}
            />
          )
        }
      />
      {players.length === 0 && <Muted>{t('Nenhum personagem entrou no Codex ainda.')}</Muted>}
      {players.map((p) => (
        <CheckRow
          key={p.id}
          label={p.name}
          uri={p.photoUri}
          detail={p.level >= MAX_LEVEL ? t('Nível {level} (máximo)', { level: p.level }) : t('Nível {level}', { level: p.level })}
          checked={selected.includes(p.id)}
          onToggle={() => toggle(p.id)}
        />
      ))}

      <Field label={t('XP para cada um')} icon={<StarIcon />} placeholder="0" keyboardType="number-pad" value={xp} onChangeText={setXp} />

      <ItemListEditor title={t('Itens para cada um')} value={items} onChange={setItems} suggestions={itemSuggestions(codex.shops)} />

      <Button title={`🎁 ${t('Entregar')}`} disabled={selected.length === 0} onPress={grant} style={{ marginTop: spacing.lg }} />
    </Screen>
  );
}
