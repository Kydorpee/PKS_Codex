import { router, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { CharacterBars } from '@/components/character-stats';
import { GoldAmount } from '@/components/monster-stats';
import { Avatar, Button, Card, Muted, Screen, text } from '@/components/ui';
import { useStore } from '@/lib/store';
import { spacing } from '@/lib/theme';
import { MAX_CHARACTERS } from '@/lib/types';

export default function Characters() {
  const { myCharacters: characters, codexes } = useStore();
  const full = characters.length >= MAX_CHARACTERS;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Meus personagens' }} />
      <Muted>
        {characters.length} de {MAX_CHARACTERS} personagens
      </Muted>

      {characters.length === 0 && (
        <Card>
          <Text style={text.strong}>Nenhum personagem ainda</Text>
          <Muted>Crie seu primeiro herói para entrar em uma campanha.</Muted>
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
                  {c.age ? `${c.age} anos · ` : ''}
                  {codex ? `Codex: ${codex.name}` : 'Sem Codex'}
                </Muted>
              </View>
              <GoldAmount value={c.gold} />
            </View>
            <CharacterBars character={c} />
          </Card>
        );
      })}

      <Button
        title={full ? `Limite de ${MAX_CHARACTERS} personagens` : '+ Criar personagem'}
        disabled={full}
        onPress={() => router.push('/personagem/editar')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
