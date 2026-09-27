import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { MonsterStats } from '@/components/monster-stats';
import { PixelScene, TerrainPicker } from '@/components/pixel-scene';
import { Avatar, Button, CheckRow, Muted, Paper, Screen, SectionHeader, text } from '@/components/ui';
import { startBattle } from '@/lib/engine';
import { useStore } from '@/lib/store';
import { colors, radius, spacing } from '@/lib/theme';
import { MAX_FOES, type Terrain } from '@/lib/types';

export default function NewBattle() {
  const params = useLocalSearchParams<{ codexId: string; monsterId?: string }>();
  const { codexes, characters, act } = useStore();
  const codex = codexes.find((c) => c.id === params.codexId);

  const [monsterIds, setMonsterIds] = useState<string[]>(params.monsterId ? [params.monsterId] : []);
  const [terrain, setTerrain] = useState<Terrain>('planicie');
  const [selected, setSelected] = useState<string[]>([]);

  if (!codex) return null;

  const active = codex.battles.filter((b) => b.status === 'ativa');
  const busyMonsters = new Set(active.flatMap((b) => b.foes.map((f) => f.monsterId)));
  const busyCharacters = new Set(active.flatMap((b) => b.participants.map((p) => p.characterId)));
  const monsters = codex.monsters.filter((m) => !m.defeated && !busyMonsters.has(m.id));
  const players = characters.filter((c) => c.codexId === codex.id);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleMonster = (id: string) =>
    setMonsterIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < MAX_FOES ? [...ids, id] : ids));

  const start = () => {
    if (monsterIds.length === 0) {
      Alert.alert('Escolha pelo menos um monstro');
      return;
    }
    let battleId: string | undefined;
    const error = act((data) => {
      const result = startBattle(data, codex.id, monsterIds, selected, terrain);
      battleId = result.battleId;
      return result;
    });
    if (error || !battleId) {
      Alert.alert('Não foi possível iniciar', error ?? 'Erro desconhecido.');
      return;
    }
    // Volta ao painel do Codex, que abre a batalha nova na aba "Batalhas".
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Nova batalha' }} />

      <SectionHeader title={`Monstros (${monsterIds.length}/${MAX_FOES})`} />
      {monsters.length === 0 && <Muted>Nenhum monstro disponível. Adicione monstros ao Codex.</Muted>}
      {monsters.length > 1 && <Muted>Escolha até {MAX_FOES} monstros: cada um tem vida, turno e iniciativa próprios.</Muted>}
      {monsters.map((m) => {
        const chosen = monsterIds.includes(m.id);
        const full = !chosen && monsterIds.length >= MAX_FOES;
        return (
          <Pressable
            key={m.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: chosen, disabled: full }}
            onPress={() => toggleMonster(m.id)}
            style={[styles.option, chosen && styles.optionActive, full && { opacity: 0.5 }]}
          >
            <Avatar uri={m.photoUri} emoji={m.emoji} name={m.name} size={44} />
            <View style={{ flex: 1 }}>
              <Paper>
                <Text style={text.strong}>
                  {chosen ? '✓ ' : ''}
                  {m.name}
                </Text>
                <MonsterStats hitPoints={m.hitPoints} armor={m.armor} />
              </Paper>
            </View>
          </Pressable>
        );
      })}

      <SectionHeader title="Cenário" />
      <View style={styles.preview}>
        <PixelScene terrain={terrain} />
      </View>
      <TerrainPicker value={terrain} onChange={setTerrain} />

      <SectionHeader title="Participantes" />
      {players.length === 0 && <Muted>Nenhum jogador no Codex.</Muted>}
      {players.map((p) => {
        const dead = p.hp <= 0;
        const busy = busyCharacters.has(p.id);
        return (
          <CheckRow
            key={p.id}
            label={p.name}
            uri={p.photoUri}
            detail={dead ? '☠️ Sem vida — restaure no painel do Codex' : busy ? 'Já está em outra batalha' : `Nível ${p.level} · ❤️ ${p.hp}/${p.maxHp}`}
            checked={selected.includes(p.id)}
            onToggle={() => !dead && !busy && toggle(p.id)}
          />
        );
      })}

      <Muted>A ordem dos turnos é definida por um d20 de iniciativa para cada participante e para cada monstro.</Muted>
      <Button title="⚔️ Iniciar batalha" disabled={monsterIds.length === 0 || selected.length === 0} onPress={start} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  optionActive: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.gold },
  preview: { borderRadius: radius.md, overflow: 'hidden', borderWidth: 2, borderColor: colors.gold },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
