import { router, useSegments, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { colors, spacing } from '@/lib/theme';
import { PixelIcon } from './pixel-icon';

/** Menu de onde cada grupo de telas é aberto; usado quando não há tela anterior na pilha. */
const PARENT: Record<string, Href> = {
  personagem: '/personagens',
  codex: '/mestre',
  monstro: '/mestre',
  batalha: '/mestre',
};

/** Botão de voltar da barra superior. */
export function BackButton() {
  const [section] = useSegments();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(PARENT[section] ?? '/');
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      hitSlop={12}
      onPress={goBack}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
    >
      <PixelIcon shape="arrow" color={colors.onPrimary} pixel={3} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingVertical: spacing.sm, paddingRight: spacing.lg },
});
