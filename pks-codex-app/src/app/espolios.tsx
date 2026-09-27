import { Stack, useLocalSearchParams } from 'expo-router';
import { LootPanel } from '@/components/loot-panel';
import { Muted, Screen } from '@/components/ui';
import { useStore } from '@/lib/store';
import { useT } from '@/lib/i18n';

/** Local "Espólios" gerado pelo sistema quando um monstro morre. Sem `characterId`, é a visão do Mestre. */
export default function LootScreen() {
  const { t } = useT();
  const { codexId, battleId, characterId } = useLocalSearchParams<{ codexId: string; battleId: string; characterId?: string }>();
  const { codexes } = useStore();
  const codex = codexes.find((c) => c.id === codexId);
  const battle = codex?.battles.find((b) => b.id === battleId);

  return (
    <Screen>
      <Stack.Screen options={{ title: `💰 ${t('Espólios')}` }} />
      {codex && battle?.loot ? <LootPanel codex={codex} battle={battle} characterId={characterId} /> : <Muted>{t('Espólios não encontrados.')}</Muted>}
    </Screen>
  );
}
