import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AbilityCard } from '@/components/ability-card';
import { BattleView } from '@/components/battle-view';
import { CharacterBars } from '@/components/character-stats';
import { InventoryModal } from '@/components/inventory-modal';
import { CoinIcon, StarIcon } from '@/components/monster-stats';
import { LevelUpBlock } from '@/components/level-up-block';
import { openLoots } from '@/components/loot-panel';
import { Avatar, Button, Card, Muted, Screen, SectionHeader, Stat, TabBar, text } from '@/components/ui';
import { currentLooter, currentTurn, foeNames } from '@/lib/engine';
import { useStore } from '@/lib/store';
import { WIDGET_CHARACTER_KEY } from '@/lib/storage-keys';
import { colors, radius, spacing } from '@/lib/theme';
import { refreshWidget } from '@/widget';

export default function CharacterSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { characters, codexes, joinCodex, leaveCodex, deleteCharacter, respondAbilityOffer, respondClassOffer, updateCharacter } = useStore();
  const [code, setCode] = useState('');
  const [bagOpen, setBagOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  // Aba escolhida; sem escolha, abre na batalha quando houver uma.
  const [chosenTab, setChosenTab] = useState<'ficha' | 'habilidades' | 'batalha'>();

  // O widget da tela inicial mostra o último personagem aberto.
  useEffect(() => {
    if (id) AsyncStorage.setItem(WIDGET_CHARACTER_KEY, id).then(refreshWidget);
  }, [id]);

  const character = characters.find((c) => c.id === id);
  if (!character) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Personagem' }} />
        <Muted>Personagem não encontrado.</Muted>
      </Screen>
    );
  }

  const codex = codexes.find((c) => c.id === character.codexId);
  const shops = codex?.shops.filter((s) => s.visibleTo.includes(character.id)) ?? [];
  const offers = codex?.abilities.filter((a) => a.offeredTo.includes(character.id)) ?? [];
  const battle = codex?.battles.find((b) => b.status !== 'encerrada' && !b.xpAwarded && b.participants.some((p) => p.characterId === character.id));
  const inBattle = !!(codex && battle);
  const tab = inBattle ? (chosenTab ?? 'batalha') : chosenTab === 'batalha' ? 'ficha' : (chosenTab ?? 'ficha');
  const klass = codex?.classes.find((k) => k.id === character.classId);
  const classOffers = codex?.classes.filter((k) => k.offeredTo.includes(character.id)) ?? [];
  const classAbilityIds = new Set(codex?.abilities.filter((a) => a.classId && a.classId === character.classId).map((a) => a.id));
  const pendingOffers = classOffers.length + offers.length;
  const battleBadge =
    battle?.status === 'vitoria' ? '🏆' : battle && currentTurn(battle) === character.id && !battle.pending ? 'Sua vez!' : undefined;
  const dismissed = character.dismissedLevelUps ?? [];
  const levelUps = (codex?.levelUps.filter((e) => e.characterId === character.id && !dismissed.includes(e.id)) ?? []).reverse();
  const levelRows = levelUps.map((e) => ({
    id: e.id,
    title: `🆙 Nível ${e.level}!`,
    pending: !e.resolved,
    lines: e.resolved ? e.rewards.map((r) => `• ${r}`) : ['Aguardando o Mestre definir o evento de nível.'],
  }));
  const clearLevelUps = () =>
    updateCharacter(character.id, (c) => ({
      ...c,
      dismissedLevelUps: [...(c.dismissedLevelUps ?? []), ...levelUps.map((e) => e.id)],
    }));
  const itemCount = character.inventory.reduce((sum, i) => sum + i.quantity, 0);

  const join = async () => {
    setJoining(true);
    const error = await joinCodex(character.id, code);
    setJoining(false);
    if (error) Alert.alert('Codex não encontrado', error);
    else setCode('');
  };

  const confirmLeave = () =>
    Alert.alert('Sair do Codex?', `${character.name} vai sair de "${codex?.name}".`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => leaveCodex(character.id) },
    ]);

  const confirmDelete = () =>
    Alert.alert('Apagar personagem?', `${character.name} será apagado para sempre.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () => {
          router.back();
          deleteCharacter(character.id);
        },
      },
    ]);

  const tabs = (
    <TabBar
      value={tab}
      onChange={setChosenTab}
      tabs={[
        { key: 'ficha', label: '📜 Ficha' },
        { key: 'habilidades', label: '✨ Habilidades', badge: pendingOffers ? `${pendingOffers} nova(s)` : undefined },
        ...(inBattle ? [{ key: 'batalha' as const, label: '⚔️ Batalha', badge: battleBadge }] : []),
      ]}
    />
  );

  const chooseClass = (classId: string, name: string) =>
    Alert.alert(
      'Trocar de classe?',
      `${character.name} vira ${name}${klass ? ` e deixa de ser ${klass.name}, perdendo as habilidades dessa classe` : ''}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Trocar', onPress: () => codex && respondClassOffer(character.id, codex.id, classId, true) },
      ],
    );

  if (tab === 'habilidades') {
    return (
      <Screen>
        <Stack.Screen options={{ title: character.name }} />
        {tabs}

        {codex && (
          <Card style={styles.codexCard}>
            <Muted>Classe</Muted>
            <Text style={text.title}>{klass ? `${klass.emoji} ${klass.name}` : 'Sem classe'}</Text>
            {klass?.description ? <Muted>{klass.description}</Muted> : null}
            {!klass && <Muted>O Mestre ainda não definiu uma classe para você.</Muted>}
          </Card>
        )}

        {codex && classOffers.length > 0 && (
          <>
            <SectionHeader title="Classes liberadas" />
            <Muted>O Mestre liberou estas classes para você. Escolher uma troca a sua classe atual.</Muted>
            {classOffers.map((k) => {
              const count = codex.abilities.filter((a) => a.classId === k.id).length;
              return (
                <Card key={k.id}>
                  <Text style={text.strong}>
                    {k.emoji} {k.name}
                  </Text>
                  {!!k.description && <Muted>{k.description}</Muted>}
                  <Muted>{count} habilidade(s) de classe</Muted>
                  <View style={styles.offerActions}>
                    <Button small title="Escolher" style={{ flex: 1 }} onPress={() => chooseClass(k.id, k.name)} />
                    <Button
                      small
                      variant="secondary"
                      title="Recusar"
                      style={{ flex: 1 }}
                      onPress={() => respondClassOffer(character.id, codex.id, k.id, false)}
                    />
                  </View>
                </Card>
              );
            })}
          </>
        )}

      {codex && offers.length > 0 && (
        <>
          <SectionHeader title="Habilidades oferecidas" />
          <Muted>O Mestre liberou estas habilidades para você. Aceite para registrá-las no personagem.</Muted>
          {offers.map((a) => (
            <AbilityCard key={a.id} ability={a}>
              <View style={styles.offerActions}>
                <Button small title="Aceitar" style={{ flex: 1 }} onPress={() => respondAbilityOffer(character.id, codex.id, a.id, true)} />
                <Button
                  small
                  variant="secondary"
                  title="Recusar"
                  style={{ flex: 1 }}
                  onPress={() => respondAbilityOffer(character.id, codex.id, a.id, false)}
                />
              </View>
            </AbilityCard>
          ))}
        </>
      )}

      <SectionHeader title="Habilidades" />
      {character.abilities.length === 0 ? (
        <Muted>Nenhuma habilidade ainda. Elas são liberadas pelo Mestre do Codex.</Muted>
      ) : (
        character.abilities.map((a) => (
          <AbilityCard key={a.id} ability={a}>
            {classAbilityIds.has(a.id) && klass ? <Muted>Habilidade de classe: {klass.emoji} {klass.name}</Muted> : null}
          </AbilityCard>
        ))
      )}

      </Screen>
    );
  }

  if (tab === 'batalha' && codex && battle) {
    return (
      <Screen>
        <Stack.Screen options={{ title: `⚔️ ${codex && battle ? foeNames(battle, codex.monsters) : 'Batalha'}` }} />
        {tabs}
        <BattleView key={battle.id} codexId={codex.id} battleId={battle.id} characterId={character.id} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: character.name }} />
      {tabs}

      {/* Juntar-se a um Codex */}
      <Card style={styles.codexCard}>
        {codex ? (
          <>
            <Muted>Campanha atual</Muted>
            <Text style={text.title}>📜 {codex.name}</Text>
            {!!codex.description && <Muted>{codex.description}</Muted>}
            <Button small variant="danger" title="Sair do Codex" onPress={confirmLeave} style={{ alignSelf: 'flex-start' }} />
          </>
        ) : (
          <>
            <Text style={text.strong}>Juntar-se a um Codex</Text>
            <Muted>Digite o código da campanha que o Mestre compartilhou.</Muted>
            <View style={styles.joinRow}>
              <TextInput
                style={styles.codeInput}
                placeholder="CÓDIGO"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                value={code}
                onChangeText={setCode}
              />
              <Button title={joining ? 'Buscando...' : 'Entrar'} disabled={joining || code.trim().length < 6} onPress={join} />
            </View>
          </>
        )}
      </Card>

      {/* Identidade */}
      <Card>
        <View style={styles.identity}>
          <Avatar uri={character.photoUri} name={character.name} size={96} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={text.title}>{character.name}</Text>
            <View style={styles.level}>
              <StarIcon />
              <Text style={text.accent}>Nível {character.level}</Text>
            </View>
            {(!!character.race || !!character.age) && (
              <Muted>{[character.race, character.age && `${character.age} anos`].filter(Boolean).join(' · ')}</Muted>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir bolsa de itens"
            onPress={() => setBagOpen(true)}
            style={({ pressed }) => [styles.bag, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.bagIcon}>🎒</Text>
            {itemCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{itemCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
        <CharacterBars character={character} showXp />
      </Card>

      <View style={styles.stats}>
        <Stat label="Ouro" value={character.gold} icon={<CoinIcon pixel={3} />} />
        {character.attributes.map((a) => (
          <Stat key={a.id} label={a.name} value={a.value} />
        ))}
      </View>

      {codex && (
        <LevelUpBlock
          rows={levelRows}
          onClear={clearLevelUps}
          emptyText="Nenhuma notificação de nível."
          pendingWarning="Os avisos que ainda esperam o Mestre também somem daqui. As recompensas continuam valendo na sua ficha."
        />
      )}

      {/* Locais liberados pelo Mestre */}
      {codex && (
        <>
          <SectionHeader title="Locais" />
          {openLoots(codex)
            .filter((b) => b.loot!.order.includes(character.id))
            .map((b) => {
              const mine = currentLooter(b) === character.id;
              return (
                <Card
                  key={b.id}
                  style={mine && styles.lootMine}
                  onPress={() => router.push({ pathname: '/espolios', params: { codexId: codex.id, battleId: b.id, characterId: character.id } })}
                >
                  <View style={styles.shopRow}>
                    <Text style={{ fontSize: 28 }}>💰</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={text.strong}>Espólios · {foeNames(b, codex.monsters)}</Text>
                      <Muted>
                        {mine ? '⭐ Sua vez de pegar itens!' : `Vez de ${characters.find((c) => c.id === currentLooter(b))?.name ?? '?'}`} ·{' '}
                        {b.loot!.items.reduce((n, i) => n + i.quantity, 0)} item(ns)
                      </Muted>
                    </View>
                    <Text style={text.accent}>›</Text>
                  </View>
                </Card>
              );
            })}
          {shops.length === 0 && openLoots(codex).length === 0 ? (
            <Muted>O Mestre ainda não liberou nenhum local para você.</Muted>
          ) : (
            shops.map((s) => (
              <Card
                key={s.id}
                onPress={() => router.push({ pathname: '/personagem/loja', params: { characterId: character.id, shopId: s.id } })}
              >
                <View style={styles.shopRow}>
                  <Text style={{ fontSize: 28 }}>{s.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={text.strong}>{s.name}</Text>
                    <Muted>{s.items.length} itens à venda</Muted>
                  </View>
                  <Text style={text.accent}>›</Text>
                </View>
              </Card>
            ))
          )}
        </>
      )}

      <View style={styles.actions}>
        <Button
          variant="secondary"
          title="Editar"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/personagem/editar', params: { id: character.id } })}
        />
        <Button variant="danger" title="Apagar" style={{ flex: 1 }} onPress={confirmDelete} />
      </View>

      <InventoryModal
        visible={bagOpen}
        character={character}
        freeEdit={!!codex?.allowFreeInventory}
        onClose={() => setBagOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  codexCard: { borderColor: colors.goldDim },
  lootMine: { borderColor: colors.primary, borderWidth: 2 },
  joinRow: { flexDirection: 'row', gap: spacing.sm },
  codeInput: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  bag: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bagIcon: { fontSize: 30 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 4,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  level: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  offerActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
});
