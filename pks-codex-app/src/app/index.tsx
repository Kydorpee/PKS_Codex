import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PixelIcon, type PixelShape } from '@/components/pixel-icon';
import { Button, Paper } from '@/components/ui';
import { loadDemo } from '@/lib/demo';
import { LANGUAGES, useT } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { colors, radius, spacing } from '@/lib/theme';
import { refreshWidget } from '@/widget';

function RoleButton({
  shape,
  color,
  accent,
  title,
  subtitle,
  onPress,
}: {
  shape: PixelShape;
  color: string;
  accent: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.role, pressed && { opacity: 0.8 }]}>
      <PixelIcon shape={shape} color={color} accent={accent} pixel={5} />
      <Text style={styles.roleTitle}>{title}</Text>
      <Text style={styles.roleSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

/** Opções da tela inicial: idioma, demonstração e galeria visual. */
function OptionsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { act } = useStore();
  const { t, tx, lang, setLang } = useT();

  const confirmDemo = () =>
    Alert.alert(
      t('Carregar demonstração?'),
      t('Cria 3 personagens e um Codex com monstros, lojas, habilidades e uma batalha em andamento. Seus dados atuais são mantidos.'),
      [
        { text: t('Cancelar'), style: 'cancel' },
        {
          text: t('Carregar'),
          onPress: () => {
            const error = act(loadDemo);
            if (error) Alert.alert(t('Não foi possível carregar'), tx(error));
            else {
              onClose();
              Alert.alert(
                t('Demonstração pronta'),
                t('Abra "Personagem" ou "Mestre" para explorar. Os itens de demonstração têm "(demo)" no nome.'),
              );
            }
          },
        },
      ],
    );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('Fechar')}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Paper>
            <Text style={styles.sheetTitle}>⚙️ {t('Opções')}</Text>

            <Text style={styles.sheetLabel}>🌐 {t('Idioma')}</Text>
            <View style={styles.langs}>
              {LANGUAGES.map((l) => (
                <Pressable
                  key={l.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: lang === l.key }}
                  onPress={() => {
                    setLang(l.key);
                    refreshWidget(); // o widget da tela inicial também muda de idioma
                  }}
                  style={[styles.lang, lang === l.key && styles.langActive]}
                >
                  <Text style={styles.langText}>
                    {lang === l.key ? '✓ ' : ''}
                    {l.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Button variant="secondary" title={`🎲 ${t('Carregar demonstração')}`} onPress={confirmDemo} />
            <Button
              variant="secondary"
              title={`🎨 ${t('Galeria visual')}`}
              onPress={() => {
                onClose();
                router.push('/galeria');
              }}
            />
            <Button variant="ghost" title={t('Fechar')} onPress={onClose} />
          </Paper>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function Home() {
  const { t } = useT();
  const [options, setOptions] = useState(false);

  return (
    <SafeAreaView style={styles.screen}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Opções')}
        hitSlop={12}
        onPress={() => setOptions(true)}
        style={({ pressed }) => [styles.gear, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.gearText}>⚙️</Text>
      </Pressable>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.logoFrame}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} accessibilityLabel="PKS Codex" />
          </View>
          <Text style={styles.tagline}>{t('Como você quer iniciar?')}</Text>
        </View>
        <View style={styles.roles}>
          <RoleButton
            shape="helmet"
            color="#8FA3B0"
            accent={colors.primary}
            title={t('Personagem')}
            subtitle={t('Crie seus heróis e entre em uma campanha')}
            onPress={() => router.push('/personagens')}
          />
          <RoleButton
            shape="crown"
            color={colors.gold}
            accent={colors.primary}
            title={t('Mestre')}
            subtitle={t('Crie um Codex com monstros e locais')}
            onPress={() => router.push('/mestre')}
          />
        </View>
      </ScrollView>
      <OptionsModal visible={options} onClose={() => setOptions(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: spacing.xl, justifyContent: 'center' },
  gear: {
    position: 'absolute',
    top: spacing.xl + 24,
    right: spacing.lg,
    zIndex: 1,
    width: 48,
    height: 48,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearText: { fontSize: 24 },
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
  role: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  roleTitle: { color: colors.text, fontSize: 24, fontWeight: '700' },
  roleSubtitle: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.xl },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.gold,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: spacing.xs },
  sheetLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  langs: { gap: spacing.sm, marginBottom: spacing.sm },
  lang: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  langActive: { borderColor: colors.goldDim, backgroundColor: colors.gold },
  langText: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
