import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { AbilityCard } from '@/components/ability-card';
import { CharacterBars } from '@/components/character-stats';
import { CoinIcon, CostIcon, GoldAmount, IconStat, MonsterStats, StarIcon } from '@/components/monster-stats';
import { Avatar, Button, Card, Muted, Screen, SectionHeader, text } from '@/components/ui';
import { SHOP_PRESETS, shopFromPreset } from '@/lib/presets';
import { useStore } from '@/lib/store';
import { colors, radius, spacing } from '@/lib/theme';

export default function CodexDashboard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { codexes, characters, updateCodex, updateCharacter, deleteCodex } = useStore();
  const codex = codexes.find((c) => c.id === id);

  if (!codex) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Codex' }} />
        <Muted>Codex não encontrado.</Muted>
      </Screen>
    );
  }

  const players = characters.filter((c) => c.codexId === codex.id);

  const pendingLevelUps = codex.levelUps.filter((e) => !e.resolved);
  const battles = [...codex.battles].reverse().filter((b) => b.status === 'ativa' || (b.status === 'vitoria' && !b.xpAwarded));

  const restore = (characterId: string) =>
    updateCharacter(characterId, (c) => ({ ...c, hp: c.maxHp, mana: c.maxMana, stamina: c.maxStamina, statuses: [] }));

  const changeGold = (characterId: string, delta: number) =>
    updateCharacter(characterId, (c) => ({ ...c, gold: Math.max(0, c.gold + delta) }));

  const addShopPreset = (key: string) => {
    const preset = SHOP_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    const shop = shopFromPreset(preset);
    updateCodex(codex.id, (c) => ({ ...c, shops: [...c.shops, shop] }));
    router.push({ pathname: '/codex/loja', params: { codexId: codex.id, shopId: shop.id } });
  };

  const confirmDelete = () =>
    Alert.alert('Apagar Codex?', `"${codex.name}" e todo o seu conteúdo serão apagados. Os jogadores sairão da campanha.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () => {
          router.back();
          deleteCodex(codex.id);
        },
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: codex.name }} />

      <Card style={styles.codeCard}>
        <Muted>Código para os jogadores entrarem</Muted>
        <Text selectable style={styles.code}>
          {codex.code}
        </Text>
        {!!codex.description && <Muted>{codex.description}</Muted>}
      </Card>

      {/* Batalhas */}
      <SectionHeader
        title="Batalhas"
        action={
          <Button small title="⚔️ Nova batalha" onPress={() => router.push({ pathname: '/batalha/nova', params: { codexId: codex.id } })} />
        }
      />
      {battles.length === 0 && <Muted>Nenhuma batalha em andamento.</Muted>}
      {battles.map((b) => {
        const m = codex.monsters.find((x) => x.id === b.monsterId);
        return (
          <Card key={b.id} style={styles.highlight} onPress={() => router.push({ pathname: '/batalha/[id]', params: { id: b.id, codexId: codex.id } })}>
            <View style={styles.row}>
              <Avatar uri={m?.photoUri} emoji={m?.emoji} name={m?.name} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={text.strong}>⚔️ {m?.name ?? 'Monstro'}</Text>
                <Muted>
                  {b.status === 'vitoria' ? '🏆 Vitória — distribuir XP' : `Rodada ${b.round} · ❤️ ${b.monsterHp}/${b.monsterMaxHp}`} ·{' '}
                  {b.participants.length} participante(s)
                </Muted>
              </View>
            </View>
          </Card>
        );
      })}

      {/* Eventos de nível */}
      {pendingLevelUps.length > 0 && (
        <>
          <SectionHeader title="Eventos de nível" />
          {pendingLevelUps.map((e) => {
            const c = characters.find((x) => x.id === e.characterId);
            return (
              <Card key={e.id} style={styles.highlight} onPress={() => router.push({ pathname: '/codex/nivel', params: { codexId: codex.id, eventId: e.id } })}>
                <Text style={text.strong}>
                  🆙 {c?.name ?? '?'} subiu para o nível {e.level}
                </Text>
                <Muted>Toque para liberar habilidades ou aumentar status.</Muted>
              </Card>
            );
          })}
        </>
      )}

      {/* Jogadores */}
      <SectionHeader title={`Jogadores (${players.length})`} />
      {players.length === 0 && <Muted>Nenhum personagem entrou ainda. Compartilhe o código acima.</Muted>}
      {players.map((p) => (
        <Card key={p.id}>
          <View style={styles.row}>
            <Avatar uri={p.photoUri} name={p.name} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={text.strong}>{p.name}</Text>
              <View style={styles.playerStats}>
                <IconStat icon={<StarIcon />}>Nível {p.level}</IconStat>
                <IconStat icon={<CostIcon kind="magica" />}>{p.abilities.length} habilidade(s)</IconStat>
                <GoldAmount value={p.gold} size={14} />
              </View>
            </View>
            <Button small variant="secondary" title="Restaurar" onPress={() => restore(p.id)} />
          </View>
          <CharacterBars character={p} showXp />
          <View style={styles.goldRow}>
            <Button small variant="secondary" icon={<CoinIcon />} title="−10" style={{ flex: 1 }} onPress={() => changeGold(p.id, -10)} />
            <Button small variant="secondary" icon={<CoinIcon />} title="+10" style={{ flex: 1 }} onPress={() => changeGold(p.id, 10)} />
            <Button small variant="secondary" icon={<CoinIcon />} title="+50" style={{ flex: 1 }} onPress={() => changeGold(p.id, 50)} />
          </View>
        </Card>
      ))}

      {/* Habilidades */}
      <SectionHeader
        title="Habilidades"
        action={
          <Button small variant="secondary" title="+ Nova" onPress={() => router.push({ pathname: '/codex/habilidade', params: { codexId: codex.id } })} />
        }
      />
      <Muted>Crie habilidades e escolha quais personagens podem pegá-las.</Muted>
      {codex.abilities.map((a) => {
        const owners = players.filter((p) => p.abilities.some((x) => x.id === a.id)).length;
        return (
          <AbilityCard
            key={a.id}
            ability={a}
            onPress={() => router.push({ pathname: '/codex/habilidade', params: { codexId: codex.id, abilityId: a.id } })}
          >
            <Muted>
              {owners} possui · {a.offeredTo.length} aguardando resposta
            </Muted>
          </AbilityCard>
        );
      })}

      {/* Monstros */}
      <SectionHeader
        title="Monstros"
        action={
          <View style={styles.inline}>
            <Button small variant="secondary" title="Bestiário IA" onPress={() => router.push({ pathname: '/codex/bestiario', params: { codexId: codex.id } })} />
            <Button small variant="secondary" title="+ Criar" onPress={() => router.push({ pathname: '/monstro/editar', params: { codexId: codex.id } })} />
          </View>
        }
      />
      {codex.monsters.length === 0 && <Muted>Adicione monstros do bestiário ou crie os seus.</Muted>}
      {codex.monsters.map((m) => (
        <Card
          key={m.id}
          onPress={() => router.push({ pathname: '/monstro/editar', params: { codexId: codex.id, monsterId: m.id } })}
          style={m.defeated && { opacity: 0.6 }}
        >
          <View style={styles.row}>
            <Avatar uri={m.photoUri} emoji={m.emoji} name={m.name} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={text.strong}>
                {m.name} {m.defeated ? '☠️' : ''}
              </Text>
              <MonsterStats
                hitPoints={m.hitPoints}
                armor={m.armor}
                extra={`${m.abilities.length} habilidade(s) · ${m.loot.length} item(ns) de espólio`}
              />
            </View>
          </View>
        </Card>
      ))}

      {/* Locais */}
      <SectionHeader
        title="Locais"
        action={
          <Button small variant="secondary" title="+ Criar" onPress={() => router.push({ pathname: '/codex/loja', params: { codexId: codex.id } })} />
        }
      />
      <View style={styles.inline}>
        {SHOP_PRESETS.map((p) => (
          <Button key={p.key} small variant="secondary" title={`${p.emoji} ${p.name}`} onPress={() => addShopPreset(p.key)} style={{ flexGrow: 1 }} />
        ))}
      </View>
      {codex.shops.map((s) => (
        <Card key={s.id} onPress={() => router.push({ pathname: '/codex/loja', params: { codexId: codex.id, shopId: s.id } })}>
          <View style={styles.row}>
            <Text style={{ fontSize: 28 }}>{s.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={text.strong}>{s.name}</Text>
              <Muted>
                {s.items.length} item(ns) · visível para {s.visibleTo.length} jogador(es)
              </Muted>
            </View>
          </View>
        </Card>
      ))}

      <View style={[styles.inline, { marginTop: spacing.xl }]}>
        <Button
          variant="secondary"
          title="Editar Codex"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/codex/editar', params: { id: codex.id } })}
        />
        <Button variant="danger" title="Apagar" style={{ flex: 1 }} onPress={confirmDelete} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeCard: { alignItems: 'center' },
  code: {
    color: colors.gold,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 8,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  playerStats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.md, rowGap: 2 },
  goldRow: { flexDirection: 'row', gap: spacing.sm },
  highlight: { borderColor: colors.primary, borderWidth: 2 },
  inline: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
