import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { currentTurn } from '@/lib/engine';
import { useStore } from '@/lib/store';
import { colors, radius, spacing } from '@/lib/theme';
import { MONSTER_TURN, type LevelUpEvent } from '@/lib/types';

type Href = Parameters<typeof router.push>[0];

type Notice = {
  /** O que está sendo acompanhado: uma batalha ou as subidas de nível de um personagem. */
  slot: string;
  /** Muda a cada passagem de turno / nova subida de nível. */
  key: string;
  title: string;
  detail: string;
  /** Pede ação deste aparelho: a vez de um personagem daqui, o turno do monstro ou um evento de nível para o Mestre. */
  mine: boolean;
  href: Href;
  /** Só avisa se `true`; senão apenas registra o estado. */
  notify: boolean;
};

const VISIBLE_MS = 4000;

/** Estado atual de tudo que este aparelho acompanha: turnos de batalhas e subidas de nível (para o Mestre). */
function watch(store: ReturnType<typeof useStore>): Notice[] {
  const { codexes, characters, myCharacters, myCodexes } = store;
  const mine = new Set(myCharacters.map((c) => c.id));
  const mastered = new Set(myCodexes.map((c) => c.id));
  const notices: Notice[] = [];

  for (const codex of codexes) {
    const isMaster = mastered.has(codex.id);
    for (const battle of codex.battles) {
      const ownCharacter = battle.participants.find((p) => mine.has(p.characterId))?.characterId;
      if (battle.status !== 'ativa' || (!isMaster && !ownCharacter)) continue;

      const turn = currentTurn(battle);
      const monster = codex.monsters.find((m) => m.id === battle.monsterId);
      const viewer = mine.has(turn) ? turn : isMaster ? undefined : ownCharacter;
      const base = {
        slot: `batalha/${battle.id}`,
        key: `${battle.round}:${battle.turnIndex}:${turn}`,
        notify: true,
        href: {
          pathname: '/batalha/[id]',
          params: { id: battle.id, codexId: codex.id, ...(viewer ? { characterId: viewer } : {}) },
        } as Href,
      };
      if (turn === MONSTER_TURN) {
        notices.push({
          ...base,
          title: `👹 Vez de ${monster?.name ?? 'monstro'}`,
          detail: isMaster ? 'Mestre, escolha a ação do monstro.' : `Rodada ${battle.round}`,
          mine: isMaster,
        });
      } else {
        const actor = characters.find((c) => c.id === turn);
        const myTurn = mine.has(turn);
        notices.push({
          ...base,
          title: myTurn ? `🔔 Sua vez, ${actor?.name ?? '?'}!` : `⚔️ Vez de ${actor?.name ?? '?'}`,
          detail: myTurn ? 'Toque para agir na batalha.' : `Rodada ${battle.round} · contra ${monster?.name ?? 'o monstro'}`,
          mine: myTurn,
        });
      }
    }

    if (!isMaster) continue;
    // Subidas de nível: o Mestre vê quem subiu e para qual nível.
    const byCharacter = new Map<string, LevelUpEvent[]>();
    for (const e of codex.levelUps) byCharacter.set(e.characterId, [...(byCharacter.get(e.characterId) ?? []), e]);
    for (const [characterId, events] of byCharacter) {
      const newest = events[events.length - 1];
      const pending = events.filter((e) => !e.resolved);
      const name = characters.find((c) => c.id === characterId)?.name ?? 'Um personagem';
      const top = Math.max(...pending.map((e) => e.level), newest.level);
      notices.push({
        slot: `nivel/${codex.id}/${characterId}`,
        // Só uma subida nova muda a chave; concluir eventos não gera aviso.
        key: newest.id,
        notify: !newest.resolved,
        title: `🆙 ${name} subiu para o nível ${top}!`,
        detail: pending.length > 1 ? `${pending.length} eventos de nível para definir.` : 'Toque para definir as recompensas.',
        mine: true,
        href: { pathname: '/codex/nivel', params: { codexId: codex.id, eventId: (pending[0] ?? newest).id } },
      });
    }
  }
  return notices;
}

const stampsOf = (notices: Notice[]) => Object.fromEntries(notices.map((n) => [n.slot, n.key]));

/**
 * Avisa, em qualquer tela, quando o turno de uma batalha acompanhada muda (Mestre e jogadores
 * que lutam nela) e, para o Mestre, quando um personagem sobe de nível. Quando pede ação
 * deste aparelho, o celular também vibra.
 */
export function GameNotifier() {
  const store = useStore();
  const insets = useSafeAreaInsets();
  const current = watch(store);
  // Estado já visto: ao abrir o app só registra, sem avisar.
  const [stamps, setStamps] = useState(() => stampsOf(current));
  const [notice, setNotice] = useState<Notice>();
  const [opacity] = useState(() => new Animated.Value(0));

  // Ajusta o estado durante a renderização quando algo muda (padrão recomendado pelo React).
  const next = stampsOf(current);
  const changedKeys = Object.keys(next).length !== Object.keys(stamps).length || current.some((n) => stamps[n.slot] !== n.key);
  if (changedKeys) {
    setStamps(next);
    const changed = current.filter((n) => n.notify && stamps[n.slot] !== n.key);
    // Se mais de uma coisa mudou, prioriza a que pede ação deste aparelho.
    const pick = changed.find((n) => n.mine) ?? changed[0];
    if (pick) setNotice(pick);
  }

  useEffect(() => {
    if (!notice) return;
    if (notice.mine) Vibration.vibrate([0, 250, 120, 250]);
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setNotice(undefined));
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [notice, opacity]);

  if (!notice) return null;

  const open = () => {
    setNotice(undefined);
    router.push(notice.href);
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <Animated.View style={{ opacity }}>
        <Pressable
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          onPress={open}
          style={[styles.banner, notice.mine && styles.bannerMine]}
        >
          <Text style={[styles.title, notice.mine && styles.titleMine]}>{notice.title}</Text>
          <Text style={[styles.detail, notice.mine && styles.detailMine]}>{notice.detail}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg },
  banner: {
    backgroundColor: colors.surface,
    borderColor: colors.goldDim,
    borderWidth: 2,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 2,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  bannerMine: { backgroundColor: colors.primary, borderColor: colors.gold },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
  titleMine: { color: colors.onPrimary },
  detail: { color: colors.textMuted, fontSize: 13 },
  detailMine: { color: colors.onPrimary },
});
