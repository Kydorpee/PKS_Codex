import { router } from 'expo-router';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { loadDemo } from '@/lib/demo';
import { useStore } from '@/lib/store';
import { colors, radius, spacing } from '@/lib/theme';

function RoleButton({ emoji, title, subtitle, onPress }: { emoji: string; title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.role, pressed && { opacity: 0.8 }]}>
      <Text style={styles.roleEmoji}>{emoji}</Text>
      <Text style={styles.roleTitle}>{title}</Text>
      <Text style={styles.roleSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

export default function Home() {
  const { act } = useStore();

  const confirmDemo = () =>
    Alert.alert(
      'Carregar demonstração?',
      'Cria 3 personagens e um Codex com monstros, lojas, habilidades e uma batalha em andamento. Seus dados atuais são mantidos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Carregar',
          onPress: () => {
            const error = act(loadDemo);
            if (error) Alert.alert('Não foi possível carregar', error);
            else Alert.alert('Demonstração pronta', 'Abra "Personagem" ou "Mestre" para explorar. Os itens de demonstração têm "(demo)" no nome.');
          },
        },
      ],
    );

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.logoFrame}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} accessibilityLabel="PKS Codex" />
          </View>
          <Text style={styles.tagline}>Como você quer iniciar?</Text>
        </View>
        <View style={styles.roles}>
          <RoleButton
            emoji="🛡️"
            title="Personagem"
            subtitle="Crie seus heróis e entre em uma campanha"
            onPress={() => router.push('/personagens')}
          />
          <RoleButton
            emoji="📜"
            title="Mestre"
            subtitle="Crie um Codex com monstros e locais"
            onPress={() => router.push('/mestre')}
          />
        </View>
        <View style={styles.extras}>
          <Button small variant="secondary" title="Galeria visual" style={{ flex: 1 }} onPress={() => router.push('/galeria')} />
          <Button small variant="secondary" title="Carregar demonstração" style={{ flex: 1 }} onPress={confirmDemo} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: spacing.xl, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  logoFrame: {
    // Mesmo tom de pergaminho do fundo da logo, para a imagem não ter emenda.
    backgroundColor: '#F9F6EE',
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: radius.lg,
    padding: spacing.sm,
    overflow: 'hidden',
  },
  logo: { width: 220, height: 220 * (698 / 720) },
  tagline: { color: colors.textOnDarkMuted, fontSize: 16, marginTop: spacing.sm },
  roles: { gap: spacing.lg },
  extras: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  role: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  roleEmoji: { fontSize: 44 },
  roleTitle: { color: colors.text, fontSize: 24, fontWeight: '700' },
  roleSubtitle: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
});
