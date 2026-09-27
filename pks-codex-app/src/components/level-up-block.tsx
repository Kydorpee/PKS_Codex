import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';
import { Button, Card, Muted, text } from './ui';
import { useT } from '@/lib/i18n';

export type LevelUpRow = {
  id: string;
  title: string;
  /** Linhas abaixo do título (recompensas ou dica). */
  lines: string[];
  /** Ainda espera o Mestre: fica destacado; limpar pede confirmação. */
  pending: boolean;
  onPress?: () => void;
};

/**
 * Eventos de nível num único bloco recolhível, para não poluir a tela do jogo.
 * "Limpar notificações" tira todos os eventos do bloco; se houver pendentes, pede confirmação
 * com `pendingWarning` (o que acontece com eles).
 */
export function LevelUpBlock({
  rows,
  onClear,
  emptyText,
  pendingWarning,
}: {
  rows: LevelUpRow[];
  onClear: () => void;
  emptyText: string;
  pendingWarning: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const pending = rows.filter((r) => r.pending).length;
  const done = rows.length - pending;
  const clear = () =>
    pending === 0
      ? onClear()
      : Alert.alert(t('Limpar notificações?'), pendingWarning, [
          { text: t('Cancelar'), style: 'cancel' },
          { text: t('Limpar'), style: 'destructive', onPress: onClear },
        ]);

  return (
    <Card style={pending > 0 && styles.attention}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={styles.header}
      >
        <Text style={[text.strong, { flex: 1 }]}>🆙 {t('Eventos de nível')}</Text>
        {pending > 0 && (
          <View style={[styles.count, styles.countPending]}>
            <Text style={styles.countPendingText}>{t('{n} pendente(s)', { n: pending })}</Text>
          </View>
        )}
        {done > 0 && (
          <View style={styles.count}>
            <Text style={styles.countText}>{done}</Text>
          </View>
        )}
        <Text style={text.accent}>{open ? '▾' : '▸'}</Text>
      </Pressable>

      {open &&
        (rows.length === 0 ? (
          <Muted>{emptyText}</Muted>
        ) : (
          <>
            <ScrollView nestedScrollEnabled style={styles.list} contentContainerStyle={{ gap: spacing.sm }}>
              {rows.map((r) => (
                <Pressable
                  key={r.id}
                  disabled={!r.onPress}
                  onPress={r.onPress}
                  style={[styles.row, r.pending && styles.rowPending]}
                >
                  <Text style={r.pending ? text.accentStrong : text.strong}>{r.title}</Text>
                  {r.lines.map((line, i) => (
                    <Muted key={i}>{line}</Muted>
                  ))}
                </Pressable>
              ))}
            </ScrollView>
            <Button small variant="secondary" title={`🧹 ${t('Limpar notificações')}`} onPress={clear} />
          </>
        ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  attention: { borderColor: colors.primary, borderWidth: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  count: {
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  countText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  countPending: { backgroundColor: colors.primary, borderColor: colors.primary },
  countPendingText: { color: colors.onPrimary, fontSize: 12, fontWeight: '700' },
  list: { maxHeight: 260 },
  row: {
    gap: 2,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  rowPending: { borderColor: colors.primary },
});
