import { router, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Muted, Screen, text } from '@/components/ui';
import { useStore } from '@/lib/store';
import { spacing } from '@/lib/theme';
import { useT } from '@/lib/i18n';

export default function Master() {
  const { t } = useT();
  const { myCodexes: codexes, characters } = useStore();

  return (
    <Screen>
      <Stack.Screen options={{ title: t('Mestre') }} />
      <Button title={t('+ Criar Codex')} onPress={() => router.push('/codex/editar')} />

      {codexes.length === 0 && (
        <Card>
          <Text style={text.strong}>{t('Nenhum Codex ainda')}</Text>
          <Muted>{t('Um Codex é a sua campanha: monstros, locais e habilidades para os jogadores.')}</Muted>
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
                  {t('{players} jogador(es) · {monsters} monstro(s) · {shops} local(is)', { players, monsters: codex.monsters.length, shops: codex.shops.length })}
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
