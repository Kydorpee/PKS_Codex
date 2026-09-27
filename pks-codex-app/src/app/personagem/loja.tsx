import { Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { CoinIcon, GoldAmount } from '@/components/monster-stats';
import { Button, Card, Muted, Screen, text } from '@/components/ui';
import { useStore } from '@/lib/store';
import { colors, radius, spacing } from '@/lib/theme';

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
        const mount = item.mountId ? codex.mounts.find((m) => m.id === item.mountId) : undefined;
        const owned = !!mount && character.mountIds.includes(mount.id);
        if (item.mountId && !mount) return null;
        return (
          <Card key={item.id}>
            <View style={styles.row}>
              {item.photoUri ? (
                <Image source={{ uri: item.photoUri }} style={styles.photo} />
              ) : mount ? (
                <Text style={{ fontSize: 32 }}>{mount.emoji}</Text>
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={text.strong}>{item.name}</Text>
                {mount && <Muted>🐎 Montaria · {mount.abilities.length} habilidade(s){owned ? ' · você já tem' : ''}</Muted>}
                {!!item.description && <Muted>{item.description}</Muted>}
              </View>
              <Button small icon={<CoinIcon />} title={String(item.price)} disabled={!affordable || owned} onPress={() => buy(item.id)} />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  photo: { width: 52, height: 52, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.goldDim },
});
