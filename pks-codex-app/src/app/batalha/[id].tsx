import { Stack, useLocalSearchParams } from 'expo-router';
import { BattleView } from '@/components/battle-view';
import { Screen } from '@/components/ui';
import { useStore } from '@/lib/store';

export default function BattleScreen() {
  const { id, codexId, characterId } = useLocalSearchParams<{ id: string; codexId: string; characterId?: string }>();
  const { codexes } = useStore();
  const codex = codexes.find((c) => c.id === codexId);
  const monster = codex?.monsters.find((m) => m.id === codex.battles.find((b) => b.id === id)?.monsterId);
  const title = monster ? `⚔️ ${monster.name}${characterId ? '' : ' (Mestre)'}` : 'Batalha';

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <BattleView codexId={codexId} battleId={id} characterId={characterId} />
    </Screen>
  );
}
