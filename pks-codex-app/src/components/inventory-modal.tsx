import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { newId } from '@/lib/ids';
import { addToInventory } from '@/lib/rules';
import { useStore } from '@/lib/store';
import { colors, radius, spacing } from '@/lib/theme';
import type { Character } from '@/lib/types';
import { GoldAmount } from './monster-stats';
import { Button, Muted, Paper, text } from './ui';
import { useT } from '@/lib/i18n';

export function InventoryModal({
  visible,
  character,
  freeEdit,
  onClose,
}: {
  visible: boolean;
  character: Character;
  /** Regra "Inventário livre" do Codex: permite adicionar itens sem comprar. */
  freeEdit: boolean;
  onClose: () => void;
}) {
  const { t } = useT();
  const { updateCharacter } = useStore();
  const [newItem, setNewItem] = useState('');

  /** Sem a regra do Codex, o jogador só gasta/descarta; ganhar é pelas lojas ou pelo Mestre. */
  const changeQuantity = (itemId: string, delta: number) =>
    updateCharacter(character.id, (c) => ({
      ...c,
      inventory: c.inventory
        .map((i) => (i.id === itemId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0),
    }));

  const add = () => {
    const name = newItem.trim();
    if (!name || !freeEdit) return;
    updateCharacter(character.id, (c) => ({
      ...c,
      inventory: addToInventory(c.inventory, [{ id: newId(), name, quantity: 1, description: '' }]),
    }));
    setNewItem('');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.sheet}>
        <Paper>
          <View style={styles.header}>
            <Text style={text.title}>🎒 {t('Bolsa de itens')}</Text>
            <Button small variant="ghost" title={t('Fechar')} onPress={onClose} />
          </View>
          <GoldAmount value={character.gold} size={20} suffix=" de ouro" />

          <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
            {character.inventory.length === 0 && <Muted>{t('A bolsa está vazia.')}</Muted>}
            {character.inventory.map((item) => (
              <View key={item.id} style={styles.item}>
                {item.photoUri && <Image source={{ uri: item.photoUri }} style={styles.photo} />}
                <View style={{ flex: 1 }}>
                  <Text style={text.strong}>{item.name}</Text>
                  {!!item.description && <Muted>{item.description}</Muted>}
                </View>
                <View style={styles.qty}>
                  <Pressable accessibilityLabel={t('Usar ou descartar um')} hitSlop={8} onPress={() => changeQuantity(item.id, -1)} style={styles.qtyButton}>
                    <Text style={styles.qtyButtonText}>−</Text>
                  </Pressable>
                  <Text style={styles.qtyValue}>{item.quantity}</Text>
                  {freeEdit && (
                    <Pressable accessibilityLabel={t('Aumentar')} hitSlop={8} onPress={() => changeQuantity(item.id, 1)} style={styles.qtyButton}>
                      <Text style={styles.qtyButtonText}>+</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>

          {freeEdit ? (
            <View style={styles.addRow}>
              <TextInput
                style={styles.input}
                placeholder={t('Adicionar item...')}
                placeholderTextColor={colors.textMuted}
                value={newItem}
                onChangeText={setNewItem}
                onSubmitEditing={add}
                returnKeyType="done"
              />
              <Button title={t('Adicionar')} disabled={!newItem.trim()} onPress={add} />
            </View>
          ) : (
            <Muted>{t('Itens chegam comprando nas lojas ou pelas mãos do Mestre do Codex.')}</Muted>
          )}
        </Paper>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  photo: { width: 44, height: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.goldDim },
  sheet: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { gap: spacing.sm, paddingVertical: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  qty: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonText: { color: colors.primary, fontSize: 20, fontWeight: '700' },
  qtyValue: { color: colors.text, fontSize: 16, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  addRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: spacing.md,
  },
});
