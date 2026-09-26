import { Stack, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { CoinIcon, GoldAmount } from '@/components/monster-stats';
import { Button, Card, Muted, Screen, text } from '@/components/ui';
import { useStore } from '@/lib/store';
import { spacing } from '@/lib/theme';

export default function ShopForCharacter() {
  const { characterId, shopId } = useLocalSearchParams<{ characterId: string; shopId: string }>();
  const { characters, codexes, buyItem } = useStore();

  const character = characters.find((c) => c.id === characterId);
  const codex = codexes.find((c) => c.id === character?.codexId);
  const shop = codex?.shops.find((s) => s.id === shopId);

  if (!character || !codex || !shop || !shop.visibleTo.includes(character.id)) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Loja' }} />
        <Muted>Esta loja não está disponível.</Muted>
      </Screen>
    );
  }

  const buy = (itemId: string) => {
    const error = buyItem(character.id, codex.id, shop.id, itemId);
    if (error) Alert.alert('Compra não realizada', error);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: `${shop.emoji} ${shop.name}` }} />
      <Card>
        <Muted>Seu ouro</Muted>
        <GoldAmount value={character.gold} size={24} />
      </Card>

      {shop.items.length === 0 && <Muted>Nada à venda no momento.</Muted>}
      {shop.items.map((item) => {
        const affordable = character.gold >= item.price;
        return (
          <Card key={item.id}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={text.strong}>{item.name}</Text>
                {!!item.description && <Muted>{item.description}</Muted>}
              </View>
              <Button small icon={<CoinIcon />} title={String(item.price)} disabled={!affordable} onPress={() => buy(item.id)} />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
