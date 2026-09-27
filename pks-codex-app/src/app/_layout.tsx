import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '@/components/back-button';
import { GameNotifier } from '@/components/game-notifier';
import { Button } from '@/components/ui';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { firebaseConfigured } from '@/lib/firebase';
import { StoreProvider, useStore } from '@/lib/store';
import { colors } from '@/lib/theme';

function Message({ title, detail, onRetry }: { title: string; detail?: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>{title}</Text>
      {!!detail && <Text style={styles.detail}>{detail}</Text>}
      {onRetry && <Button title="Tentar de novo" onPress={onRetry} />}
    </View>
  );
}

/** Aviso discreto no rodapé: sincronizando em segundo plano ou sem conexão. */
function SyncStatus() {
  const { synced, error, retry } = useStore();
  const insets = useSafeAreaInsets();
  if (synced && !error) return null;
  return (
    <View pointerEvents="box-none" style={[styles.statusWrap, { bottom: insets.bottom + 12 }]}>
      <Pressable accessibilityRole="button" disabled={!error} onPress={retry} style={styles.status}>
        {error ? (
          <Text style={styles.statusText}>Sem conexão · toque para tentar de novo</Text>
        ) : (
          <>
            <ActivityIndicator size="small" color={colors.gold} />
            <Text style={styles.statusText}>Sincronizando...</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

function Navigator() {
  const { loaded, error, retry } = useStore();
  if (!loaded) {
    if (error) return <Message title="Sem conexão com o servidor" detail={error} onRetry={retry} />;
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
        <Text style={styles.detail}>Conectando ao servidor...</Text>
      </View>
    );
  }
  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.header },
          headerTintColor: colors.onPrimary,
          headerTitleStyle: { color: colors.onPrimary },
          contentStyle: { backgroundColor: colors.background },
          headerBackVisible: false,
          headerLeft: () => <BackButton />,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
      <SyncStatus />
      <GameNotifier />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {firebaseConfigured ? (
        <StoreProvider>
          <Navigator />
        </StoreProvider>
      ) : (
        <Message title="Firebase não configurado" detail="Preencha o arquivo .env com os dados do projeto Firebase e gere o app de novo." />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  title: { color: colors.gold, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  detail: { color: colors.textOnDarkMuted, fontSize: 15, textAlign: 'center' },
  statusWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderColor: colors.goldDim,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  statusText: { color: colors.textOnDark, fontSize: 13 },
});
