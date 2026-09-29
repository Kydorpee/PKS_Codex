import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AbilityCard } from '@/components/ability-card';
import { BattleView } from '@/components/battle-view';
import { CharacterBars } from '@/components/character-stats';
import { LevelUpBlock } from '@/components/level-up-block';
import { openLoots } from '@/components/loot-panel';
import { CoinIcon, CostIcon, GoldAmount, IconStat, MonsterStats, StarIcon } from '@/components/monster-stats';
import { Avatar, Button, Card, Muted, Screen, SectionHeader, TabBar, text } from '@/components/ui';
import { currentLooter, currentTurn, foeNames, foeOf } from '@/lib/engine';
import { SHOP_PRESETS } from '@/lib/presets';
import { startingClassOf } from '@/lib/rules';
import { useStore } from '@/lib/store';
import { colors, radius, spacing } from '@/lib/theme';
import type { Battle } from '@/lib/types';
import { useT } from '@/lib/i18n';

/** A batalha espera o Mestre: turno do monstro, ação de jogador para resolver ou XP da vitória. */
const needsMaster = (b: Battle) => (b.status === 'vitoria' && !b.xpAwarded) || (b.status === 'ativa' && (!!b.pending || !!foeOf(b, currentTurn(b))));

export default function CodexDashboard() {
  const { t, tx } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { codexes, characters, updateCharacter, updateCodex, removeFromCodex, deleteCodex, setStartingClass } = useStore();
  const codex = codexes.find((c) => c.id === id);
  // Aba escolhida; sem escolha, abre nas batalhas quando houver alguma.
  const [chosenTab, setChosenTab] = useState<'codex' | 'habilidades' | 'montarias' | 'batalhas'>();
  const [selectedBattle, setSelectedBattle] = useState<string>();
  // Batalha nova (criada agora) passa a ser a selecionada.
  const [knownBattles, setKnownBattles] = useState(() => codex?.battles.map((b) => b.id) ?? []);
  const battleIds = codex?.battles.map((b) => b.id) ?? [];
  if (battleIds.length !== knownBattles.length || battleIds.some((b) => !knownBattles.includes(b))) {
    const created = battleIds.find((b) => !knownBattles.includes(b));
    setKnownBattles(battleIds);
    if (created) {
      setSelectedBattle(created);
      setChosenTab('batalhas');
    }
  }

  if (!codex) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Codex' }} />
        <Muted>{t('Codex não encontrado.')}</Muted>
      </Screen>
    );
  }

  const players = characters.filter((c) => c.codexId === codex.id);
  const classLabel = (classId?: string) => {
    const k = codex.classes.find((x) => x.id === classId);
    return k ? `${k.emoji} ${k.name}` : t('nenhuma');
  };

  const pendingLevelUps = codex.levelUps.filter((e) => !e.resolved);
  const levelRows = codex.levelUps
    .filter((e) => !e.hiddenForMaster)
    .reverse()
    .map((e) => {
      const c = characters.find((x) => x.id === e.characterId);
      return {
        id: e.id,
        title: `🆙 ${t('{name} · nível {level}', { name: c?.name ?? '?', level: e.level })}`,
        pending: !e.resolved,
        lines: e.resolved
          ? e.rewards.map((r) => `• ${tx(r)}`)
          : [c ? t('Toque para liberar habilidades ou aumentar status.') : t('O personagem saiu do Codex. Toque para descartar.')],
        onPress: e.resolved ? undefined : () => router.push({ pathname: '/codex/nivel', params: { codexId: codex.id, eventId: e.id } }),
      };
    });
  // Concluídos só somem do bloco (o jogador ainda vê as recompensas); pendentes são descartados.
  const clearLevelUps = () =>
    updateCodex(codex.id, (c) => ({
      ...c,
      levelUps: c.levelUps.filter((e) => e.resolved).map((e) => ({ ...e, hiddenForMaster: true })),
    }));

  const confirmRemove = (characterId: string, name: string) =>
    Alert.alert(t('Remover do Codex?'), t('{name} vai sair de "{codex}". A ficha do jogador continua existindo.', { name, codex: codex.name }), [
      { text: t('Cancelar'), style: 'cancel' },
      {
        text: t('Remover'),
        style: 'destructive',
        onPress: () => {
          const error = removeFromCodex(codex.id, characterId);
          if (error) Alert.alert(t('Não foi possível remover'), tx(error));
        },
      },
    ]);
  const battles = [...codex.battles].reverse().filter((b) => b.status === 'ativa' || (b.status === 'vitoria' && !b.xpAwarded));
  const tab = battles.length > 0 ? (chosenTab ?? 'batalhas') : (chosenTab ?? 'codex');
  const shown = battles.find((b) => b.id === selectedBattle) ?? battles[0];
  const waiting = battles.filter(needsMaster).length;
  const openBattle = (battleId: string) => {
    setSelectedBattle(battleId);
    setChosenTab('batalhas');
  };
  const newBattle = () => router.push({ pathname: '/batalha/nova', params: { codexId: codex.id } });

  const restore = (characterId: string) =>
    updateCharacter(characterId, (c) => ({ ...c, hp: c.maxHp, mana: c.maxMana, stamina: c.maxStamina, statuses: [] }));

  const changeGold = (characterId: string, delta: number) =>
    updateCharacter(characterId, (c) => ({ ...c, gold: Math.max(0, c.gold + delta) }));

  // O modelo só abre o editor: o local é criado ao tocar em "Salvar", sem duplicar ao voltar.
  const addShopPreset = (key: string) => router.push({ pathname: '/codex/loja', params: { codexId: codex.id, preset: key } });

  const confirmDelete = () =>
    Alert.alert(t('Apagar Codex?'), t('"{codex}" e todo o seu conteúdo serão apagados. Os jogadores sairão da campanha.', { codex: codex.name }), [
      { text: t('Cancelar'), style: 'cancel' },
      {
        text: t('Apagar'),
        style: 'destructive',
        onPress: () => {
          router.back();
          deleteCodex(codex.id);
        },
      },
    ]);

  const tabs = (
    <TabBar
      value={tab}
      onChange={setChosenTab}
      tabs={[
        { key: 'codex', label: '📜 Codex', badge: pendingLevelUps.length ? `🆙 ${pendingLevelUps.length}` : undefined },
        { key: 'habilidades', label: `✨ ${t('Habilidades')}` },
        { key: 'montarias', label: `🐎 ${t('Montarias')}` },
        { key: 'batalhas', label: `⚔️ ${t('Batalhas')}${battles.length ? ` (${battles.length})` : ''}`, badge: waiting ? t('Sua vez!') : undefined },
      ]}
    />
  );

  if (tab === 'montarias') {
    return (
      <Screen>
        <Stack.Screen options={{ title: codex.name }} />
        {tabs}
        <SectionHeader
          title={t('Montarias')}
          action={
            <Button small variant="secondary" title={t('+ Nova')} onPress={() => router.push({ pathname: '/codex/montaria', params: { codexId: codex.id } })} />
          }
        />
        <Muted>{t('Cada montaria tem habilidades próprias. Dê a montaria aos personagens ou venda numa loja.')}</Muted>
        {codex.mounts.length === 0 && <Muted>{t('Nenhuma montaria ainda. Crie um cavalo, um lobo gigante, um grifo...')}</Muted>}
        {codex.mounts.map((m) => {
          const owners = players.filter((p) => p.mountIds.includes(m.id));
          const shops = codex.shops.filter((s) => s.items.some((i) => i.mountId === m.id));
          return (
            <Card key={m.id} onPress={() => router.push({ pathname: '/codex/montaria', params: { codexId: codex.id, mountId: m.id } })}>
              <View style={styles.row}>
                <Avatar uri={m.photoUri} emoji={m.emoji} name={m.name} size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={text.strong}>{m.name}</Text>
                  <Muted>
                    {t('{n} habilidade(s) · {m} personagem(ns)', { n: m.abilities.length, m: owners.length })}
                    {shops.length ? ` · ${t('à venda em {shops}', { shops: shops.map((s) => s.name).join(', ') })}` : ''}
                  </Muted>
                  {owners.length > 0 && <Muted>{owners.map((o) => o.name).join(', ')}</Muted>}
                </View>
              </View>
            </Card>
          );
        })}
      </Screen>
    );
  }

  if (tab === 'habilidades') {
    const general = codex.abilities.filter((a) => !a.classId);
    const startingId = startingClassOf(codex);
    return (
      <Screen>
        <Stack.Screen options={{ title: codex.name }} />
        {tabs}

        {/* Classes */}
        <SectionHeader
          title={t('Classes')}
          action={
            <Button small variant="secondary" title={t('+ Nova')} onPress={() => router.push({ pathname: '/codex/classe', params: { codexId: codex.id } })} />
          }
        />
        <Muted>
          {t('Quem entra no Codex recebe a classe inicial (se houver). Libere outras classes para quem pode trocar: o jogador escolhe se troca.')}
        </Muted>
        {codex.classes.length === 0 && <Muted>{t('Nenhuma classe ainda. Crie Guerreiro, Mago, Ladino...')}</Muted>}
        {codex.classes.map((k) => {
          const members = players.filter((p) => p.classId === k.id);
          const count = codex.abilities.filter((a) => a.classId === k.id).length;
          const starting = k.id === startingId;
          return (
            <Card key={k.id} style={starting && styles.highlight} onPress={() => router.push({ pathname: '/codex/classe', params: { codexId: codex.id, classId: k.id } })}>
              <View style={styles.row}>
                <Text style={{ fontSize: 28 }}>{k.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={text.strong}>
                    {k.name}
                    {starting ? ` · ${t('inicial')}` : ''}
                  </Text>
                  <Muted>
                    {t('{n} habilidade(s) · {m} personagem(ns)', { n: count, m: members.length })}
                    {k.offeredTo.length ? ` · ${t('{n} aguardando escolha', { n: k.offeredTo.length })}` : ''}
                  </Muted>
                  {members.length > 0 && <Muted>{members.map((m) => m.name).join(', ')}</Muted>}
                </View>
              </View>
              {starting ? (
                <Button small variant="secondary" title={t('Tirar como classe inicial')} onPress={() => setStartingClass(codex.id, undefined)} />
              ) : (
                <Button small variant="secondary" title={t('Usar como classe inicial')} onPress={() => setStartingClass(codex.id, k.id)} />
              )}
            </Card>
          );
        })}

        {/* Habilidades gerais */}
        <SectionHeader
          title={t('Habilidades gerais')}
          action={
            <Button small variant="secondary" title={t('+ Nova')} onPress={() => router.push({ pathname: '/codex/habilidade', params: { codexId: codex.id } })} />
          }
        />
        <Muted>{t('Sem classe: você escolhe quais personagens podem pegá-las.')}</Muted>
        {general.map((a) => {
          const owners = players.filter((p) => p.abilities.some((x) => x.id === a.id)).length;
          return (
            <AbilityCard
              key={a.id}
              ability={a}
              codex={codex}
              onPress={() => router.push({ pathname: '/codex/habilidade', params: { codexId: codex.id, abilityId: a.id } })}
            >
              <Muted>
                {t('{owners} possui · {n} aguardando resposta', { owners, n: a.offeredTo.length })}
              </Muted>
            </AbilityCard>
          );
        })}
      </Screen>
    );
  }

  if (tab === 'batalhas') {
    return (
      <Screen>
        <Stack.Screen options={{ title: codex.name }} />
        {tabs}
        {battles.length > 1 && (
          <View style={styles.inline}>
            {battles.map((b) => {
              const m = codex.monsters.find((x) => x.id === b.foes[0]?.monsterId);
              const active = b.id === shown?.id;
              return (
                <Pressable
                  key={b.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelectedBattle(b.id)}
                  style={[styles.battleChip, active && styles.battleChipActive]}
                >
                  <Text style={styles.battleChipText}>
                    {needsMaster(b) ? '❗ ' : ''}
                    {m?.emoji ?? '⚔️'} {foeNames(b, codex.monsters)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {shown ? (
          <BattleView key={shown.id} codexId={codex.id} battleId={shown.id} />
        ) : (
          <Card>
            <Text style={text.strong}>{t('Nenhuma batalha em andamento')}</Text>
            <Muted>{t('Quando começar uma, ela aparece aqui para você acompanhar só o que acontece nela.')}</Muted>
          </Card>
        )}
        <Button variant="secondary" title={`⚔️ ${t('Nova batalha')}`} onPress={newBattle} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: codex.name }} />
      {tabs}

      <Card style={styles.codeCard}>
        <Muted>{t('Código para os jogadores entrarem')}</Muted>
        <Text selectable style={styles.code}>
          {codex.code}
        </Text>
        {!!codex.description && <Muted>{codex.description}</Muted>}
      </Card>

      {/* Batalhas */}
      <SectionHeader
        title={t('Batalhas')}
        action={
          <Button small title={`⚔️ ${t('Nova batalha')}`} onPress={newBattle} />
        }
      />
      {battles.length === 0 && <Muted>{t('Nenhuma batalha em andamento.')}</Muted>}
      {battles.map((b) => {
        const m = codex.monsters.find((x) => x.id === b.foes[0]?.monsterId);
        const hp = b.foes.reduce((n, f) => n + f.hp, 0);
        const maxHp = b.foes.reduce((n, f) => n + f.maxHp, 0);
        return (
          <Card key={b.id} style={styles.highlight} onPress={() => openBattle(b.id)}>
            <View style={styles.row}>
              <Avatar uri={m?.photoUri} emoji={m?.emoji} name={m?.name} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={text.strong}>⚔️ {foeNames(b, codex.monsters)}</Text>
                <Muted>
                  {b.status === 'vitoria' ? `🏆 ${t('Vitória — distribuir XP')}` : `${t('Rodada {n}', { n: b.round })} · ❤️ ${hp}/${maxHp}`} ·{' '}
                  {t('{n} participante(s)', { n: b.participants.length })}
                </Muted>
              </View>
            </View>
          </Card>
        );
      })}

      {/* Eventos de nível */}
      <LevelUpBlock
        rows={levelRows}
        onClear={clearLevelUps}
        emptyText={t('Nenhum evento de nível.')}
        pendingWarning={t('Os eventos pendentes serão descartados sem recompensas. O nível dos personagens não muda.')}
      />

      {/* Jogadores */}
      <SectionHeader
        title={t('Jogadores ({n})', { n: players.length })}
        action={
          players.length > 0 && (
            <Button small title={`🎁 ${t('Dar XP / itens')}`} onPress={() => router.push({ pathname: '/codex/recompensa', params: { codexId: codex.id } })} />
          )
        }
      />
      {players.length === 0 && <Muted>{t('Nenhum personagem entrou ainda. Compartilhe o código acima.')}</Muted>}
      {players.map((p) => (
        <Card key={p.id}>
          <View style={styles.row}>
            <Avatar uri={p.photoUri} name={p.name} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={text.strong}>{p.name}</Text>
              <Muted>{t('Classe: {klass}', { klass: classLabel(p.classId) })}</Muted>
              <View style={styles.playerStats}>
                <IconStat icon={<StarIcon />}>{t('Nível {level}', { level: p.level })}</IconStat>
                <IconStat icon={<CostIcon kind="magica" />}>{t('{n} habilidade(s)', { n: p.abilities.length })}</IconStat>
                <GoldAmount value={p.gold} size={14} />
              </View>
            </View>
            <Button small variant="secondary" title={t('Restaurar')} onPress={() => restore(p.id)} />
          </View>
          <CharacterBars character={p} showXp />
          <View style={styles.goldRow}>
            <Button small variant="secondary" icon={<CoinIcon />} title="−10" style={{ flex: 1 }} onPress={() => changeGold(p.id, -10)} />
            <Button small variant="secondary" icon={<CoinIcon />} title="+10" style={{ flex: 1 }} onPress={() => changeGold(p.id, 10)} />
            <Button small variant="secondary" icon={<CoinIcon />} title="+50" style={{ flex: 1 }} onPress={() => changeGold(p.id, 50)} />
          </View>
          <Button small variant="danger" title={`🚪 ${t('Remover do Codex')}`} onPress={() => confirmRemove(p.id, p.name)} />
        </Card>
      ))}

      {/* Monstros */}
      <SectionHeader
        title={t('Monstros')}
        action={
          <View style={styles.inline}>
            <Button small variant="secondary" title={t('Bestiário IA')} onPress={() => router.push({ pathname: '/codex/bestiario', params: { codexId: codex.id } })} />
            <Button small variant="secondary" title={t('+ Criar')} onPress={() => router.push({ pathname: '/monstro/editar', params: { codexId: codex.id } })} />
          </View>
        }
      />
      {codex.monsters.length === 0 && <Muted>{t('Adicione monstros do bestiário ou crie os seus.')}</Muted>}
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
                extra={t('{n} habilidade(s) · {m} item(ns) de espólio', { n: m.abilities.length, m: m.loot.length })}
              />
            </View>
          </View>
        </Card>
      ))}

      {/* Locais */}
      <SectionHeader
        title={t('Locais')}
        action={
          <Button small variant="secondary" title={t('+ Criar')} onPress={() => router.push({ pathname: '/codex/loja', params: { codexId: codex.id } })} />
        }
      />
      <View style={styles.inline}>
        {SHOP_PRESETS.map((p) => (
          <Button key={p.key} small variant="secondary" title={`${p.emoji} ${p.name}`} onPress={() => addShopPreset(p.key)} style={{ flexGrow: 1 }} />
        ))}
      </View>
      {openLoots(codex).map((b) => {
        const looter = characters.find((c) => c.id === currentLooter(b));
        return (
          <Card key={b.id} onPress={() => router.push({ pathname: '/espolios', params: { codexId: codex.id, battleId: b.id } })}>
            <View style={styles.row}>
              <Text style={{ fontSize: 28 }}>💰</Text>
              <View style={{ flex: 1 }}>
                <Text style={text.strong}>{t('Espólios')} · {foeNames(b, codex.monsters)}</Text>
                <Muted>
                  {t('Gerado pelo sistema · vez de {name} · {n} item(ns)', { name: looter?.name ?? '?', n: b.loot!.items.reduce((n, i) => n + i.quantity, 0) })}
                </Muted>
              </View>
            </View>
          </Card>
        );
      })}
      {codex.shops.map((s) => (
        <Card key={s.id} onPress={() => router.push({ pathname: '/codex/loja', params: { codexId: codex.id, shopId: s.id } })}>
          <View style={styles.row}>
            <Text style={{ fontSize: 28 }}>{s.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={text.strong}>{s.name}</Text>
              <Muted>
                {t('{n} item(ns) · visível para {m} jogador(es)', { n: s.items.length, m: s.visibleTo.length })}
              </Muted>
            </View>
          </View>
        </Card>
      ))}

      <View style={[styles.inline, { marginTop: spacing.xl }]}>
        <Button
          variant="secondary"
          title={t('Editar Codex')}
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/codex/editar', params: { id: codex.id } })}
        />
        <Button variant="danger" title={t('Apagar')} style={{ flex: 1 }} onPress={confirmDelete} />
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
  battleChip: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  battleChipActive: { backgroundColor: colors.gold },
  battleChipText: { color: colors.text, fontSize: 14, fontWeight: '700' },
});
