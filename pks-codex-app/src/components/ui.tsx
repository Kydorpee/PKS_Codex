import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/lib/theme';

/** Indica que o conteúdo está sobre pergaminho (texto escuro) e não sobre o fundo carvão. */
const PaperContext = createContext(false);
export const usePaper = () => useContext(PaperContext);

export function Paper({ children }: { children: ReactNode }) {
  return <PaperContext.Provider value>{children}</PaperContext.Provider>;
}

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, styles.content]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  small,
  style,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Ícone à esquerda do texto. */
  icon?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        buttonVariants[variant],
        disabled && variant !== 'ghost' && styles.buttonDisabled,
        pressed && { opacity: 0.75 },
        style,
      ]}
    >
      {icon}
      <Text
        style={[
          styles.buttonText,
          buttonTextVariants[variant],
          disabled && (variant === 'ghost' ? { opacity: 0.5 } : { color: colors.onPrimary }),
          small && { fontSize: 14 },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

// Todas as variantes têm fundo próprio, então funcionam sobre carvão e sobre pergaminho.
const buttonVariants: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.gold },
  secondary: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.goldDim },
  danger: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.danger },
  ghost: { backgroundColor: 'transparent' },
};

const buttonTextVariants: Record<ButtonVariant, { color: string; textDecorationLine?: 'underline' }> = {
  primary: { color: colors.onPrimary },
  secondary: { color: colors.text },
  danger: { color: colors.danger },
  ghost: { color: colors.textMuted, textDecorationLine: 'underline' },
};

export function Card({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  if (!onPress) {
    return (
      <View style={[styles.card, style]}>
        <Paper>{children}</Paper>
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }, style]}>
      <Paper>{children}</Paper>
    </Pressable>
  );
}

export function Field({ label, icon, style, ...props }: TextInputProps & { label: string; icon?: ReactNode }) {
  const paper = usePaper();
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        {icon}
        <Text style={[styles.label, { color: paper ? colors.textMuted : colors.textOnDarkMuted }]}>{label}</Text>
      </View>
      <TextInput placeholderTextColor={colors.textMuted} {...props} style={[styles.input, props.multiline && styles.multiline, style]} />
    </View>
  );
}

export function Avatar({ uri, emoji, name, size = 56 }: { uri?: string; emoji?: string; name?: string; size?: number }) {
  const shape = { width: size, height: size, borderRadius: size / 2 };
  if (uri) return <Image source={{ uri }} style={[shape, styles.avatarBorder]} />;
  return (
    <View style={[shape, styles.avatarBorder, styles.avatarFallback]}>
      <Text style={{ fontSize: size * 0.45, color: colors.gold, fontWeight: '700' }}>
        {emoji ?? (name?.trim()[0]?.toUpperCase() || '?')}
      </Text>
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const paper = usePaper();
  return (
    <View style={style}>
      <Text style={[styles.muted, { color: paper ? colors.textMuted : colors.textOnDarkMuted }]}>{children}</Text>
    </View>
  );
}

export function Stat({ label, value, icon }: { label: string; value: string | number; icon?: ReactNode }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statValueRow}>
        {icon}
        <Text style={styles.statValue}>{value}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function CheckRow({
  label,
  detail,
  checked,
  onToggle,
  uri,
  icon,
}: {
  label: string;
  detail?: ReactNode;
  checked: boolean;
  onToggle: () => void;
  uri?: string;
  /** Substitui o avatar (ex.: ícone em pixel art). */
  icon?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={({ pressed }) => [styles.checkRow, pressed && { opacity: 0.8 }]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
        {checked && <Text style={styles.checkMark}>✓</Text>}
      </View>
      {icon ?? <Avatar uri={uri} name={label} size={36} />}
      <View style={{ flex: 1 }}>
        <Text style={text.strong}>{label}</Text>
        {typeof detail === 'string' ? (
          <Text style={[styles.muted, { color: colors.textMuted }]}>{detail}</Text>
        ) : (
          <Paper>{detail}</Paper>
        )}
      </View>
    </Pressable>
  );
}

type BarChange = { id: number; delta: number };

/**
 * Barra animada. A largura sempre transiciona suavemente; com `effects` (barras de vida)
 * o dano deixa um rastro, treme e mostra o número; a cura mostra um prévia verde e "+N".
 */
export function Bar({
  label,
  value,
  max,
  color,
  effects,
  icon,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  effects?: boolean;
  /** Ícone à esquerda do rótulo; pulsa junto com os efeitos de dano/cura. */
  icon?: ReactNode;
}) {
  const labelColor = { color: usePaper() ? colors.textMuted : colors.textOnDarkMuted };
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;

  const [fill] = useState(() => new Animated.Value(pct));
  const [trail] = useState(() => new Animated.Value(pct));
  const [shake] = useState(() => new Animated.Value(0));
  const [float] = useState(() => new Animated.Value(0));
  const previous = useRef(value);
  const previousMax = useRef(max);
  const [change, setChange] = useState<BarChange | null>(null);
  const [healing, setHealing] = useState(false);

  useEffect(() => {
    const delta = value - previous.current;
    const maxChanged = max !== previousMax.current;
    previous.current = value;
    previousMax.current = max;
    fill.stopAnimation();
    trail.stopAnimation();

    // Mudou o máximo (ex.: subiu de nível e o XP recomeçou): ajusta sem efeito.
    if (delta === 0 || maxChanged) {
      fill.setValue(pct);
      trail.setValue(pct);
      return;
    }

    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) return;
      if (reduceMotion) {
        fill.setValue(pct);
        trail.setValue(pct);
        return;
      }
      setHealing(delta > 0);
      if (delta < 0) {
        // Dano: a barra cai rápido e o rastro claro acompanha depois.
        Animated.timing(fill, { toValue: pct, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
        Animated.sequence([
          Animated.delay(450),
          Animated.timing(trail, { toValue: pct, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        ]).start();
      } else {
        // Cura: a prévia verde aparece na hora e a barra enche até ela.
        trail.setValue(pct);
        Animated.timing(fill, { toValue: pct, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
      }

      if (!effects) return;
      setChange({ id: Date.now(), delta });
      float.setValue(0);
      Animated.timing(float, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() =>
        setChange(null),
      );
      if (delta < 0) {
        shake.setValue(0);
        Animated.sequence(
          [6, -6, 4, -4, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 50, useNativeDriver: true })),
        ).start();
      }
    });
    return () => {
      cancelled = true;
    };
    // Só reage a mudanças de valor/máximo; os Animated.Value são estáveis.
  }, [value, max]);

  const width = (v: Animated.Value) => v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Animated.View style={[styles.bar, { transform: [{ translateX: shake }] }]}>
      <View style={styles.barHeader}>
        <View style={styles.barTitle}>
          {icon && (
            <Animated.View
              style={
                change && {
                  transform: [{ scale: float.interpolate({ inputRange: [0, 0.12, 0.3, 0.45, 1], outputRange: [1, 1.45, 1, 1.25, 1] }) }],
                }
              }
            >
              {icon}
            </Animated.View>
          )}
          <Text style={[styles.barLabel, labelColor]}>{label}</Text>
        </View>
        <Text style={[styles.barLabel, labelColor]}>
          {value}/{max}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <Animated.View
          style={[styles.barLayer, { width: width(trail), backgroundColor: healing ? colors.healTrail : colors.damageTrail }]}
        />
        <Animated.View style={[styles.barLayer, { width: width(fill), backgroundColor: color }]} />
      </View>
      {change && (
        <Animated.Text
          key={change.id}
          accessibilityLiveRegion="polite"
          style={[
            styles.barChange,
            { color: change.delta < 0 ? colors.hp : colors.success },
            {
              opacity: float.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -22] }) },
                { scale: float.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.6, 1.2, 1] }) },
              ],
            },
          ]}
        >
          {change.delta > 0 ? `+${change.delta}` : change.delta}
        </Animated.Text>
      )}
    </Animated.View>
  );
}

export type TabItem<K extends string> = { key: K; label: string; /** Marca de atenção (ex.: "Sua vez!"). */ badge?: string };

/** Abas no topo da tela: separam a batalha do resto para acompanhar só o que acontece nela. */
export function TabBar<K extends string>({ tabs, value, onChange }: { tabs: TabItem<K>[]; value: K; onChange: (key: K) => void }) {
  return (
    <View accessibilityRole="tablist" style={tabStyles.bar}>
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(t.key)}
            style={[tabStyles.tab, active && tabStyles.tabActive]}
          >
            <Text style={[tabStyles.label, active && tabStyles.labelActive]} numberOfLines={1}>
              {t.label}
            </Text>
            {!!t.badge && (
              <View style={tabStyles.badge}>
                <Text style={tabStyles.badgeText}>{t.badge}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  tabActive: { backgroundColor: colors.gold },
  label: { color: colors.textOnDarkMuted, fontSize: 15, fontWeight: '700' },
  labelActive: { color: colors.text },
  badge: { backgroundColor: colors.primary, borderRadius: radius.round, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: '800' },
});

export const text = StyleSheet.create({
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: 15 },
  body: { color: colors.text, fontSize: 15 },
  strong: { color: colors.text, fontSize: 16, fontWeight: '600' },
  /** Destaque sobre pergaminho (carmesim). */
  accent: { color: colors.primary, fontWeight: '700' },
  /** Título de destaque dentro de um card. */
  accentStrong: { color: colors.primary, fontSize: 16, fontWeight: '800' },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  button: {
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  buttonText: { fontSize: 16, fontWeight: '700' },
  buttonDisabled: { backgroundColor: colors.disabled, borderColor: colors.disabled },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.goldDim,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  field: { gap: spacing.xs },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  avatarBorder: { borderWidth: 2, borderColor: colors.gold },
  avatarFallback: { backgroundColor: '#3A3A3A', alignItems: 'center', justifyContent: 'center' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  sectionTitle: { color: colors.gold, fontSize: 18, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 14 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: colors.onPrimary, fontWeight: '900' },
  bar: { gap: 2, flex: 1 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  barLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },
  barLayer: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
  barChange: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -8,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  stat: {
    flexGrow: 1,
    minWidth: 72,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '700' },
  statLabel: { color: colors.textMuted, fontSize: 12 },
});
