import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { currentLooter, currentTurn, foeNames, foeOf } from '@/lib/engine';
import { STATUS_INFO } from '@/lib/rules';
import { useStore } from '@/lib/store';
import { colors, radius, spacing } from '@/lib/theme';

type Href = Parameters<typeof router.push>[0];

type Notice = {
  /** O que está sendo acompanhado: o turno ou o último status de uma batalha. */
  slot: string;
  /** Muda a cada passagem de turno / novo status aplicado. */
  key: string;
  title: string;
  detail: string;
  /** Pede ação deste aparelho: a vez de um personagem daqui ou o turno do monstro (Mestre). */
  mine: boolean;
  href: Href;
  /** Só avisa se `true`; senão apenas registra o estado. */
  notify: boolean;
  /** Status aplicado pelo sistema: sempre avisa, além da troca de turno. */
  status?: boolean;
  /** Cor do título e da borda (a cor do status). */
  color?: string;
};

const VISIBLE_MS = 4000;

/**
 * Estado atual das batalhas que este aparelho acompanha. Eventos de nível não viram aviso na tela:
 * ficam no bloco "Eventos de nível", para não atrapalhar o jogo.
 */
function watch(store: ReturnType<typeof useStore>): Notice[] {
  const { codexes, characters, myCharacters, myCodexes } = store;
  const mine = new Set(myCharacters.map((c) => c.id));
  const mastered = new Set(myCodexes.map((c) => c.id));
  const notices: Notice[] = [];

  for (const codex of codexes) {
    const isMaster = mastered.has(codex.id);
    for (const battle of codex.battles) {
      const looter = currentLooter(battle);
      const inLoot = battle.loot?.order.some((id) => mine.has(id));
      if (looter && (isMaster || inLoot)) {
        const myLoot = mine.has(looter);
        notices.push({
          slot: `espolios/${battle.id}`,
          key: `${battle.loot!.turnIndex}`,
          notify: true,
          title: myLoot ? '💰 Sua vez nos Espólios!' : `💰 Vez de ${characters.find((c) => c.id === looter)?.name ?? '?'} nos Espólios`,
          detail: myLoot ? 'Pegue os itens que quiser e passe a vez.' : 'Itens do monstro derrotado.',
          mine: myLoot,
          href: {
            pathname: '/espolios',
            params: { codexId: codex.id, battleId: battle.id, ...(myLoot ? { characterId: looter } : {}) },
          } as Href,
        });
      }
      const ownCharacter = battle.participants.find((p) => mine.has(p.characterId))?.characterId;
      if (battle.status !== 'ativa' || (!isMaster && !ownCharacter)) continue;

      const turn = currentTurn(battle);
      const against = foeNames(battle, codex.monsters);
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
      const hit = battle.lastStatus;
      notices.push({
        ...base,
        slot: `status/${battle.id}`,
        key: hit?.id ?? '',
        notify: !!hit,
        status: true,
        color: hit ? STATUS_INFO[hit.type].color : undefined,
        title: hit ? `${STATUS_INFO[hit.type].emoji} ${hit.target} (${STATUS_INFO[hit.type].condition})` : '',
        detail: hit ? `Chance de ${hit.chance}% · o sistema rolou ${hit.roll} · ${STATUS_INFO[hit.type].effect}` : '',
        mine: false,
      });
      if (foeOf(battle, turn)) {
        notices.push({
          ...base,
          title: `👹 Vez de ${codex.monsters.find((m) => m.id === turn)?.name ?? 'monstro'}`,
          detail: isMaster ? 'Mestre, escolha a ação do monstro.' : `Rodada ${battle.round}`,
          mine: isMaster,
        });
      } else {
        const actor = characters.find((c) => c.id === turn);
        const myTurn = mine.has(turn);
        notices.push({
          ...base,
          title: myTurn ? `🔔 Sua vez, ${actor?.name ?? '?'}!` : `⚔️ Vez de ${actor?.name ?? '?'}`,
          detail: myTurn ? 'Toque para agir na batalha.' : `Rodada ${battle.round} · contra ${against}`,
          mine: myTurn,
        });
      }
    }
  }
  return notices;
}

const stampsOf = (notices: Notice[]) => Object.fromEntries(notices.map((n) => [n.slot, n.key]));

/**
 * Avisa, em qualquer tela, quando um status é aplicado (ex.: "Goblin (envenenado)") e quando o
 * turno de uma batalha acompanhada muda (Mestre e jogadores que lutam nela). Quando pede ação
 * deste aparelho, o celular também vibra.
 */
export function GameNotifier() {
  const store = useStore();
  const insets = useSafeAreaInsets();
  const current = watch(store);
  // Estado já visto: ao abrir o app só registra, sem avisar.
  const [stamps, setStamps] = useState(() => stampsOf(current));
  // Avisos em fila: o status aplicado aparece antes da troca de turno que vem logo depois.
  const [queue, setQueue] = useState<Notice[]>([]);
  const notice = queue[0];
  const [opacity] = useState(() => new Animated.Value(0));

  // Ajusta o estado durante a renderização quando algo muda (padrão recomendado pelo React).
  const next = stampsOf(current);
  const changedKeys = Object.keys(next).length !== Object.keys(stamps).length || current.some((n) => stamps[n.slot] !== n.key);
  if (changedKeys) {
    setStamps(next);
    const changed = current.filter((n) => n.notify && stamps[n.slot] !== n.key);
    const statuses = changed.filter((n) => n.status);
    const others = changed.filter((n) => !n.status);
    // Se mais de um turno mudou, prioriza o que pede ação deste aparelho.
    const pick = others.find((n) => n.mine) ?? others[0];
    const added = [...statuses, ...(pick ? [pick] : [])];
    if (added.length) setQueue((q) => [...q, ...added]);
  }

  useEffect(() => {
    if (!notice) return;
    if (notice.mine) Vibration.vibrate([0, 250, 120, 250]);
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setQueue((q) => q.slice(1)));
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [notice, opacity]);

  if (!notice) return null;

  const open = () => {
    setQueue((q) => q.slice(1));
    router.push(notice.href);
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <Animated.View style={{ opacity }}>
        <Pressable
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          onPress={open}
          style={[styles.banner, notice.mine && styles.bannerMine, notice.color && { borderColor: notice.color }]}
        >
          <Text style={[styles.title, notice.mine && styles.titleMine, notice.color && { color: notice.color }]}>{notice.title}</Text>
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
