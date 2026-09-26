import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Muted, text } from './ui';
import { currentLooter, passLoot, takeLoot, type Data, type Result } from '@/lib/engine';
import { useStore } from '@/lib/store';
import { colors, radius, spacing } from '@/lib/theme';
import type { Battle, Codex } from '@/lib/types';

/** Espólios abertos (com vez de alguém) de um Codex. */
export const openLoots = (codex: Codex) => codex.battles.filter((b) => b.loot && !b.loot.done);

/**
 * Local "Espólios": itens do monstro derrotado, compartilhados. Cada personagem vivo pega
 * na sua vez e passa a vez; ao fim da última vez, o que sobrou é apagado.
 * Sem `characterId`, mostra a visão do Mestre (que pode pular a vez de quem não responde).
 */
export function LootPanel({ codex, battle, characterId }: { codex: Codex; battle: Battle; characterId?: string }) {
  const { characters, act } = useStore();
  const loot = battle.loot;
  const monster = codex.monsters.find((m) => m.id === battle.monsterId);
  if (!loot) return null;

  const run = (rule: (d: Data) => Result) => {
    const error = act(rule);
    if (error) Alert.alert('Espólios', error);
  };
  const looter = currentLooter(battle);
  const myTurn = !!characterId && looter === characterId;
  const name = (id: string) => characters.find((c) => c.id === id)?.name ?? '?';

  if (loot.done) {
    return (
      <Card>
        <Text style={text.strong}>💰 Espólios de {monster?.name ?? 'monstro'}</Text>
        <Muted>Todos tiveram a sua vez. Os itens que sobraram foram apagados.</Muted>
      </Card>
    );
  }

  const confirmPass = () =>
    Alert.alert(
      'Passar a vez?',
      loot.turnIndex === loot.order.length - 1
        ? 'Você é o último: os itens que sobrarem serão apagados.'
        : `A vez passa para ${name(loot.order[loot.turnIndex + 1])}. Você não poderá pegar mais itens.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Passar', onPress: () => run((d) => passLoot(d, codex.id, battle.id, characterId)) },
      ],
    );

  return (
    <Card style={myTurn && styles.mine}>
      <Text style={text.accentStrong}>💰 Espólios de {monster?.name ?? 'monstro'}</Text>
      <Muted>Itens compartilhados: cada um pega na sua vez, na ordem da batalha. Ao fim, o que sobrar é apagado.</Muted>

      <View style={styles.order}>
        {loot.order.map((id, i) => (
          <View key={id} style={[styles.turn, i === loot.turnIndex && styles.turnNow, i < loot.turnIndex && { opacity: 0.5 }]}>
            <Text style={styles.turnText}>
              {i < loot.turnIndex ? '✓ ' : i === loot.turnIndex ? '👉 ' : ''}
              {name(id)}
            </Text>
          </View>
        ))}
      </View>

      <Text style={text.strong}>{myTurn ? '⭐ Sua vez! Pegue o que quiser e passe a vez.' : `Vez de ${name(looter ?? '')}`}</Text>

      {loot.items.length === 0 && <Muted>Não sobrou nenhum item.</Muted>}
      {loot.items.map((item) => (
        <View key={item.id} style={styles.item}>
          <View style={{ flex: 1 }}>
            <Text style={text.strong}>
              {item.name} <Text style={text.accent}>x{item.quantity}</Text>
            </Text>
            {!!item.description && <Muted>{item.description}</Muted>}
          </View>
          {myTurn && <Button small title="Pegar" onPress={() => run((d) => takeLoot(d, codex.id, battle.id, characterId!, item.id))} />}
        </View>
      ))}

      {myTurn && <Button variant="secondary" title="Passar a vez" onPress={confirmPass} />}
      {!characterId && looter && (
        <Button small variant="secondary" title={`⏭️ Pular a vez de ${name(looter)}`} onPress={() => run((d) => passLoot(d, codex.id, battle.id))} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  mine: { borderColor: colors.primary, borderWidth: 2 },
  order: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  turn: {
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  turnNow: { borderColor: colors.goldDim, backgroundColor: colors.gold },
  turnText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
});
