import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { abilityGroups } from '@/lib/rules';
import { useStore } from '@/lib/store';
import { colors, spacing } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { AbilityCard } from './ability-card';
import { CharacterBars, CharacterStatBlocks } from './character-stats';
import { StarIcon } from './monster-stats';
import { Avatar, Button, Card, Muted, SectionHeader, text } from './ui';

/**
 * Ficha de um personagem em tela cheia, só leitura: barras, status base e de ação, classe e
 * habilidades com a descrição. Aberta ao tocar num personagem durante a batalha.
 */
export function CharacterSheetModal({ characterId, onClose }: { characterId?: string; onClose: () => void }) {
  const { t } = useT();
  const { characters, codexes } = useStore();
  const character = characters.find((c) => c.id === characterId);
  const codex = codexes.find((c) => c.id === character?.codexId);
  const klass = codex?.classes.find((k) => k.id === character?.classId);
  const groups = character ? abilityGroups(character, codex) : undefined;
  const mountAbilities = groups?.montaria.flatMap(({ mount, abilities }) => abilities.map((ability) => ({ mount, ability }))) ?? [];

  return (
    <Modal visible={!!character} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>📜 {t('Ficha')}</Text>
          <Button small variant="secondary" title={t('Fechar')} onPress={onClose} />
        </View>
          {character && (
            <ScrollView contentContainerStyle={styles.content}>
              <Card>
                <View style={styles.identity}>
                  <Avatar uri={character.photoUri} name={character.name} size={64} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={text.title}>{character.name}</Text>
                    <View style={styles.level}>
                      <StarIcon />
                      <Text style={text.accent}>{t('Nível {level}', { level: character.level })}</Text>
                    </View>
                    <Muted>{t('Classe: {klass}', { klass: klass ? `${klass.emoji} ${klass.name}` : t('nenhuma') })}</Muted>
                  </View>
                </View>
                <CharacterBars character={character} />
              </Card>
              {codex && <CharacterStatBlocks character={character} codex={codex} />}

              <SectionHeader title={t('Habilidades')} />
              {character.abilities.length === 0 && mountAbilities.length === 0 && <Muted>{t('Nenhuma habilidade.')}</Muted>}
              {[...(groups?.classe ?? []), ...(groups?.geral ?? [])].map((a) => (
                <AbilityCard key={a.id} ability={a} codex={codex} />
              ))}
              {mountAbilities.map(({ mount, ability }) => (
                <AbilityCard key={`${mount.id}:${ability.id}`} ability={ability} codex={codex}>
                  <Muted>
                    {mount.emoji} {t('Habilidade de {name}', { name: mount.name })}
                  </Muted>
                </AbilityCard>
              ))}
            </ScrollView>
          )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.gold, fontSize: 20, fontWeight: '800' },
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  level: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
