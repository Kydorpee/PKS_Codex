import { router, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Muted, Screen, text } from '@/components/ui';
import { useStore } from '@/lib/store';
import { spacing } from '@/lib/theme';

export default function Master() {
  const { myCodexes: codexes, characters } = useStore();

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Mestre' }} />
      <Button title="+ Criar Codex" onPress={() => router.push('/codex/editar')} />

      {codexes.length === 0 && (
        <Card>
          <Text style={text.strong}>Nenhum Codex ainda</Text>
          <Muted>Um Codex é a sua campanha: monstros, locais e habilidades para os jogadores.</Muted>
        </Card>
      )}

      {codexes.map((codex) => {
        const players = characters.filter((c) => c.codexId === codex.id).length;
        return (
          <Card key={codex.id} onPress={() => router.push({ pathname: '/codex/[id]', params: { id: codex.id } })}>
            <View style={styles.row}>
              <Text style={{ fontSize: 30 }}>📜</Text>
              <View style={{ flex: 1 }}>
                <Text style={text.strong}>{codex.name}</Text>
                <Muted>
                  {players} jogador(es) · {codex.monsters.length} monstro(s) · {codex.shops.length} local(is)
                </Muted>
              </View>
              <Text style={text.accent}>{codex.code}</Text>
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
