import { router, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { CharacterBars } from '@/components/character-stats';
import { GoldAmount } from '@/components/monster-stats';
import { Avatar, Button, Card, Muted, Screen, text } from '@/components/ui';
import { useStore } from '@/lib/store';
import { spacing } from '@/lib/theme';
import { MAX_CHARACTERS } from '@/lib/types';
import { useT } from '@/lib/i18n';

export default function Characters() {
  const { t } = useT();
  const { myCharacters: characters, codexes } = useStore();
  const full = characters.length >= MAX_CHARACTERS;

  return (
    <Screen>
      <Stack.Screen options={{ title: t('Meus personagens') }} />
      <Muted>
        {t('{n} de {max} personagens', { n: characters.length, max: MAX_CHARACTERS })}
      </Muted>

      {characters.length === 0 && (
        <Card>
          <Text style={text.strong}>{t('Nenhum personagem ainda')}</Text>
          <Muted>{t('Crie seu primeiro herói para entrar em uma campanha.')}</Muted>
        </Card>
      )}

      {characters.map((c) => {
        const codex = codexes.find((x) => x.id === c.codexId);
        return (
          <Card key={c.id} onPress={() => router.push({ pathname: '/personagem/[id]', params: { id: c.id } })}>
            <View style={styles.row}>
              <Avatar uri={c.photoUri} name={c.name} />
              <View style={{ flex: 1 }}>
                <Text style={text.strong}>{c.name}</Text>
                <Muted>
                  {c.age ? `${t('{age} anos', { age: c.age })} · ` : ''}
                  {codex ? `Codex: ${codex.name}` : t('Sem Codex')}
                </Muted>
              </View>
              <GoldAmount value={c.gold} />
            </View>
            <CharacterBars character={c} />
          </Card>
        );
      })}

      <Button
        title={full ? t('Limite de {max} personagens', { max: MAX_CHARACTERS }) : t('+ Criar personagem')}
        disabled={full}
        onPress={() => router.push('/personagem/editar')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
