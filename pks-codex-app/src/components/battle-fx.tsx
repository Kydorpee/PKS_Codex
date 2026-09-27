import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '@/lib/theme';
import type { Battle, Hit } from '@/lib/types';

/** Respeita a opção "Remover animações" do aparelho: sem tremor, giro ou pulso. */
function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduce(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

type Float = { key: string; hit: Hit };

const floatColor: Record<Hit['kind'], string> = { dano: colors.hp, cura: colors.success, errou: colors.textMuted };
const floatText = (hit: Hit) =>
  hit.kind === 'errou' ? 'Errou!' : `${hit.defended ? '🛡️ ' : ''}${hit.kind === 'cura' ? '+' : '−'}${hit.amount}`;

/** Número que sobe e some em cima do alvo. */
function FloatLabel({ id, hit, index, onDone }: { id: string; hit: Hit; index: number; onDone: (id: string) => void }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => onDone(id));
  }, [progress, onDone, id]);
  return (
    <Animated.Text
      style={[
        styles.float,
        { color: floatColor[hit.kind], right: 12 + index * 44 },
        {
          opacity: progress.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -44] }) },
            { scale: progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.6, 1.25, 1] }) },
          ],
        },
      ]}
    >
      {floatText(hit)}
    </Animated.Text>
  );
}

/**
 * Envolve o quadro de um alvo (monstro ou personagem): quando a última ação da batalha o atinge,
 * ele treme, pisca (vermelho no dano, verde na cura) e mostra o número flutuando.
 * O que já tinha acontecido antes de a tela abrir não é animado.
 */
export function HitFx({ fx, targetId, style, children }: { fx: Battle['fx']; targetId: string; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const reduce = useReduceMotion();
  const [seen, setSeen] = useState(fx?.id);
  const [floats, setFloats] = useState<Float[]>([]);
  const [shake] = useState(() => new Animated.Value(0));
  const [flash] = useState(() => new Animated.Value(0));
  // Última ação que feriu ou curou este alvo: dispara o tremor e o brilho.
  const [burst, setBurst] = useState<{ key: string; hurt: boolean }>();

  // Ajusta o estado durante a renderização quando chega uma ação nova (padrão recomendado pelo React).
  if (fx && fx.id !== seen) {
    setSeen(fx.id);
    const mine = fx.hits.filter((h) => h.targetId === targetId);
    if (mine.length) {
      setFloats((f) => [...f.slice(-3), ...mine.map((hit, i) => ({ key: `${fx.id}:${i}`, hit }))]);
      const hurt = mine.some((h) => h.kind === 'dano' && h.amount > 0);
      const healed = mine.some((h) => h.kind === 'cura' && h.amount > 0);
      if (hurt || healed) setBurst({ key: fx.id, hurt });
    }
  }

  const burstKey = burst?.key;
  const hurt = !!burst?.hurt;
  useEffect(() => {
    if (!burstKey) return;
    flash.setValue(0.45);
    Animated.timing(flash, { toValue: 0, duration: 500, useNativeDriver: true }).start();
    if (reduce || !hurt) return;
    shake.setValue(0);
    const step = (toValue: number) => Animated.timing(shake, { toValue, duration: 45, useNativeDriver: true });
    Animated.sequence([step(8), step(-8), step(6), step(-6), step(3), step(0)]).start();
  }, [burstKey, hurt, flash, shake, reduce]);

  const remove = useCallback((key: string) => setFloats((all) => all.filter((x) => x.key !== key)), []);

  return (
    <Animated.View style={[style, { transform: [{ translateX: shake }] }]}>
      {children}
      <Animated.View pointerEvents="none" style={[styles.flash, { backgroundColor: hurt ? colors.hp : colors.success, opacity: flash }]} />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {floats.map((f, i) => (
          <FloatLabel key={f.key} id={f.key} hit={f.hit} index={floats.length - 1 - i} onDone={remove} />
        ))}
      </View>
    </Animated.View>
  );
}

/** Pulso suave para chamar a atenção (ex.: "Seu turno!"). */
export function Pulse({ active, style, children }: { active: boolean; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const reduce = useReduceMotion();
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!active || reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.025, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      scale.setValue(1);
    };
  }, [active, reduce, scale]);
  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

const ROLL_MS = 750;

/**
 * Face do dado virtual: a cada rolagem nova, gira e passa por números aleatórios antes de
 * parar no resultado. Rolagens que já existiam ao abrir a tela aparecem paradas.
 */
export function RollingDie({ roll, style, textStyle }: { roll?: Battle['lastRoll']; style: StyleProp<ViewStyle>; textStyle: object }) {
  const reduce = useReduceMotion();
  const [seen, setSeen] = useState(roll?.id);
  const [rolling, setRolling] = useState<string>();
  const [face, setFace] = useState<number>();
  const [spin] = useState(() => new Animated.Value(1));

  if (roll?.id && roll.id !== seen) {
    setSeen(roll.id);
    setRolling(roll.id);
  }

  const sides = roll?.sides ?? 20;
  useEffect(() => {
    if (!rolling) return;
    if (!reduce) {
      spin.setValue(0);
      Animated.timing(spin, { toValue: 1, duration: ROLL_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
    const tick = setInterval(() => setFace(1 + Math.floor(Math.random() * sides)), 60);
    const done = setTimeout(() => {
      clearInterval(tick);
      setRolling(undefined);
    }, ROLL_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(done);
    };
  }, [rolling, reduce, sides, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['-726deg', '-6deg'] });
  return (
    <Animated.View style={[style, { transform: [{ rotate }] }]}>
      <Text style={textStyle}>{rolling ? (face ?? '…') : (roll?.value ?? '—')}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flash: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: radius.md },
  float: {
    position: 'absolute',
    top: 8,
    fontSize: 22,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
