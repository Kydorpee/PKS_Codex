import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ItemListEditor, toInt } from '@/components/editors';
import { CoinIcon } from '@/components/monster-stats';
import { ActionStatListEditor, BaseStatListEditor, ResourceEditor } from '@/components/sheet-editors';
import { Button, CheckRow, Field, Muted, Screen, SectionHeader } from '@/components/ui';
import { newCodexCode, newId } from '@/lib/ids';
import { itemSuggestions } from '@/lib/presets';
import { defaultSheet, resourcesOf } from '@/lib/rules';
import { useStore } from '@/lib/store';
import { colors, radius, spacing } from '@/lib/theme';
import type { CharacterSheet, Codex, Item } from '@/lib/types';
import { useT } from '@/lib/i18n';

type CodexFields = Pick<Codex, 'name' | 'description' | 'startingItems' | 'allowFreeInventory' | 'sheet' | 'currencyName' | 'startingGold' | 'startingClassId'>;

const newCodex = (usedCodes: string[], fields: CodexFields): Codex => ({
  id: newId(),
  code: newCodexCode(usedCodes),
  ...fields,
  monsters: [],
  shops: [],
  abilities: [],
  classes: [],
  mounts: [],
  battles: [],
  levelUps: [],
  members: [],
  createdAt: Date.now(),
});

/** Ficha pronta para salvar: nomes aparados e fórmulas sem status base apagados. Retorna o erro, se houver. */
function cleanSheet(sheet: CharacterSheet): { sheet: CharacterSheet } | { error: string } {
  const resources = resourcesOf({ sheet }).map((r) => ({ ...r, name: r.name.trim(), abbr: r.abbr.trim() }));
  if (resources.some((r) => r.enabled && !r.name)) return { error: 'Dê um nome a cada barra ligada (a de vida é obrigatória).' };
  const baseStats = sheet.baseStats.map((s) => ({ ...s, name: s.name.trim(), abbr: s.abbr.trim() }));
  if (baseStats.some((s) => !s.name)) return { error: 'Dê um nome a todo status base (ou remova os vazios).' };
  const ids = new Set(baseStats.map((s) => s.id));
  const actionStats = sheet.actionStats.map((a) => ({
    ...a,
    name: a.name.trim(),
    abbr: a.abbr.trim(),
    terms: a.terms.filter((term) => !term.statId || ids.has(term.statId)),
  }));
  if (actionStats.some((a) => !a.name)) return { error: 'Dê um nome a todo status de ação (ou remova os vazios).' };
  if (actionStats.some((a) => a.terms.length === 0)) return { error: 'Todo status de ação precisa de pelo menos um termo na fórmula.' };
  return { sheet: { resources, baseStats, actionStats } };
}

export default function EditCodex() {
  const { t, tx } = useT();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { codexes, saveCodex, saveCodexSettings } = useStore();
  const existing = codexes.find((c) => c.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [sheet, setSheet] = useState<CharacterSheet>(() => existing?.sheet ?? defaultSheet());
  const [currencyName, setCurrencyName] = useState(existing?.currencyName ?? 'Ouro');
  const [startingGold, setStartingGold] = useState(existing?.startingGold === undefined ? '' : String(existing.startingGold));
  const [startingItems, setStartingItems] = useState<Item[]>(existing?.startingItems ?? []);
  const [startingClassId, setStartingClassId] = useState(existing?.startingClassId);
  const [allowFreeInventory, setAllowFreeInventory] = useState(existing?.allowFreeInventory ?? false);
  const setSheetPart = (patch: Partial<CharacterSheet>) => setSheet((s) => ({ ...s, ...patch }));

  const save = () => {
    if (!name.trim()) {
      Alert.alert(t('Nome obrigatório'), t('Dê um nome à campanha.'));
      return;
    }
    const cleaned = cleanSheet(sheet);
    if ('error' in cleaned) {
      Alert.alert(t('Ficha incompleta'), tx(cleaned.error));
      return;
    }
    const items = startingItems
      .filter((i) => i.name.trim() && i.quantity > 0)
      .map((i) => ({ ...i, name: i.name.trim(), description: i.description.trim() }));
    const fields: CodexFields = {
      name: name.trim(),
      description: description.trim(),
      sheet: cleaned.sheet,
      currencyName: currencyName.trim() || 'Ouro',
      startingGold: startingGold.trim() ? toInt(startingGold) : undefined,
      startingItems: items,
      startingClassId: existing?.classes.some((k) => k.id === startingClassId) ? startingClassId : undefined,
      allowFreeInventory,
    };
    if (existing) {
      saveCodexSettings(existing.id, fields);
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

      <SectionHeader title={t('Status de personagem')} />
      <Muted>
        {t('Todo personagem que entrar no Codex recebe esta ficha. Os nomes são obrigatórios; os valores são opcionais (vazio = padrão).')}
      </Muted>
      {resourcesOf({ sheet }).map((r) => (
        <ResourceEditor
          key={r.key}
          value={r}
          onChange={(next) => setSheetPart({ resources: resourcesOf({ sheet }).map((x) => (x.key === next.key ? next : x)) })}
        />
      ))}
      <BaseStatListEditor
        value={sheet.baseStats}
        onChange={(baseStats) => setSheetPart({ baseStats })}
      />
      <ActionStatListEditor value={sheet.actionStats} stats={sheet.baseStats} onChange={(actionStats) => setSheetPart({ actionStats })} />

      <SectionHeader title={t('Itens iniciais')} />
      <View style={styles.inline}>
        <View style={{ flex: 1 }}>
          <Field label={t('Nome da moeda')} placeholder={t('Ouro')} value={currencyName} onChangeText={setCurrencyName} />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label={t('Moedas iniciais')}
            icon={<CoinIcon />}
            placeholder="0"
            keyboardType="number-pad"
            value={startingGold}
            onChangeText={(v) => setStartingGold(v.replace(/\D/g, ''))}
          />
        </View>
      </View>
      <ItemListEditor
        title={t('Inventário inicial')}
        value={startingItems}
        onChange={setStartingItems}
        suggestions={itemSuggestions(existing?.shops)}
      />
      <Muted>{t('Todo personagem que entrar no Codex recebe estes itens na bolsa. Pode deixar vazio.')}</Muted>

      <SectionHeader title={t('Classe inicial')} />
      {existing && existing.classes.length > 0 ? (
        <View style={styles.wrap}>
          {[undefined, ...existing.classes].map((k) => {
            const active = startingClassId === k?.id;
            return (
              <Pressable
                key={k?.id ?? 'nenhuma'}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => setStartingClassId(k?.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{k ? `${k.emoji} ${k.name}` : t('Nenhuma')}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Muted>{t('Sem classe inicial. Crie classes na aba Habilidades do Codex e escolha aqui (opcional).')}</Muted>
      )}

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

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', gap: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  chipActive: { borderColor: colors.goldDim, backgroundColor: colors.gold },
  chipText: { color: colors.textMuted, fontWeight: '600' },
  chipTextActive: { color: colors.text },
});
