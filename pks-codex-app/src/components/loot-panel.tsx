import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Muted, text } from './ui';
import { currentLooter, foeNames, passLoot, takeLoot, type Data, type Result } from '@/lib/engine';
import { useStore } from '@/lib/store';
import { colors, radius, spacing } from '@/lib/theme';
import type { Battle, Codex } from '@/lib/types';
import { useT } from '@/lib/i18n';

/** Espólios abertos (com vez de alguém) de um Codex. */
export const openLoots = (codex: Codex) => codex.battles.filter((b) => b.loot && !b.loot.done);

/**
 * Local "Espólios": itens dos monstros derrotados, compartilhados. Cada personagem vivo pega
 * na sua vez e passa a vez; ao fim da última vez, o que sobrou é apagado.
 * Sem `characterId`, mostra a visão do Mestre (que pode pular a vez de quem não responde).
 */
export function LootPanel({ codex, battle, characterId }: { codex: Codex; battle: Battle; characterId?: string }) {
  const { t, tx } = useT();
  const { characters, act } = useStore();
  const loot = battle.loot;
  const from = foeNames(battle, codex.monsters);
  if (!loot) return null;

  const run = (rule: (d: Data) => Result) => {
    const error = act(rule);
    if (error) Alert.alert(t('Espólios'), tx(error));
  };
  const looter = currentLooter(battle);
  const myTurn = !!characterId && looter === characterId;
  const name = (id: string) => characters.find((c) => c.id === id)?.name ?? '?';

  if (loot.done) {
    return (
      <Card>
        <Text style={text.strong}>💰 {t('Espólios de {from}', { from })}</Text>
        <Muted>{t('Todos tiveram a sua vez. Os itens que sobraram foram apagados.')}</Muted>
      </Card>
    );
  }

  const confirmPass = () =>
    Alert.alert(
      t('Passar a vez?'),
      loot.turnIndex === loot.order.length - 1
        ? t('Você é o último: os itens que sobrarem serão apagados.')
        : t('A vez passa para {name}. Você não poderá pegar mais itens.', { name: name(loot.order[loot.turnIndex + 1]) }),
      [
        { text: t('Cancelar'), style: 'cancel' },
        { text: t('Passar'), onPress: () => run((d) => passLoot(d, codex.id, battle.id, characterId)) },
      ],
    );

  return (
    <Card style={myTurn && styles.mine}>
      <Text style={text.accentStrong}>💰 {t('Espólios de {from}', { from })}</Text>
      <Muted>{t('Itens compartilhados: cada um pega na sua vez, na ordem da batalha. Ao fim, o que sobrar é apagado.')}</Muted>

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

      <Text style={text.strong}>{myTurn ? `⭐ ${t('Sua vez! Pegue o que quiser e passe a vez.')}` : t('Vez de {name}', { name: name(looter ?? '') })}</Text>

      {loot.items.length === 0 && <Muted>{t('Não sobrou nenhum item.')}</Muted>}
      {loot.items.map((item) => (
        <View key={item.id} style={styles.item}>
          {item.photoUri && <Image source={{ uri: item.photoUri }} style={styles.photo} />}
          <View style={{ flex: 1 }}>
            <Text style={text.strong}>
              {item.name} <Text style={text.accent}>x{item.quantity}</Text>
            </Text>
            {!!item.description && <Muted>{item.description}</Muted>}
          </View>
          {myTurn && <Button small title={t('Pegar')} onPress={() => run((d) => takeLoot(d, codex.id, battle.id, characterId!, item.id))} />}
        </View>
      ))}

      {myTurn && <Button variant="secondary" title={t('Passar a vez')} onPress={confirmPass} />}
      {!characterId && looter && (
        <Button small variant="secondary" title={`⏭️ ${t('Pular a vez de {name}', { name: name(looter) })}`} onPress={() => run((d) => passLoot(d, codex.id, battle.id))} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  mine: { borderColor: colors.primary, borderWidth: 2 },
  photo: { width: 44, height: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.goldDim },
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
