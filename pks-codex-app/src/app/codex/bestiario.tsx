import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { MonsterStats } from '@/components/monster-stats';
import { Avatar, Button, Card, Muted, Screen, text } from '@/components/ui';
import { MONSTER_PRESETS, monsterFromPreset } from '@/lib/presets';
import { useStore } from '@/lib/store';
import { spacing } from '@/lib/theme';
import { useT } from '@/lib/i18n';

export default function Bestiary() {
  const { t } = useT();
  const { codexId } = useLocalSearchParams<{ codexId: string }>();
  const { updateCodex } = useStore();

  const add = (key: string) => {
    const preset = MONSTER_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    const monster = monsterFromPreset(preset);
    updateCodex(codexId, (c) => ({ ...c, monsters: [...c.monsters, monster] }));
    // Abre o monstro recém-adicionado para o Mestre ajustar, se quiser.
    router.replace({ pathname: '/monstro/editar', params: { codexId, monsterId: monster.id } });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('Bestiário IA') }} />
      <Muted>{t('Monstros gerados por IA, prontos para usar. Depois de adicionar você pode editar tudo.')}</Muted>
      {MONSTER_PRESETS.map((p) => (
        <Card key={p.key}>
          <View style={styles.row}>
            <Avatar emoji={p.emoji} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={text.strong}>{p.name}</Text>
              <MonsterStats hitPoints={p.hitPoints} armor={p.armor} />
              <Muted>{p.abilities.map((a) => a[0]).join(', ')}</Muted>
            </View>
          </View>
          <Button small title={t('Adicionar ao Codex')} onPress={() => add(p.key)} />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
