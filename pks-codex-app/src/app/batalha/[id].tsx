import { Stack, useLocalSearchParams } from 'expo-router';
import { BattleView } from '@/components/battle-view';
import { Screen } from '@/components/ui';
import { foeNames } from '@/lib/engine';
import { useStore } from '@/lib/store';

export default function BattleScreen() {
  const { id, codexId, characterId } = useLocalSearchParams<{ id: string; codexId: string; characterId?: string }>();
  const { codexes } = useStore();
  const codex = codexes.find((c) => c.id === codexId);
  const battle = codex?.battles.find((b) => b.id === id);
  const title = codex && battle ? `⚔️ ${foeNames(battle, codex.monsters)}${characterId ? '' : ' (Mestre)'}` : 'Batalha';

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <BattleView codexId={codexId} battleId={id} characterId={characterId} />
    </Screen>
  );
}
