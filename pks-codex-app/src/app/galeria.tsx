import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AbilityCard } from '@/components/ability-card';
import { DicePanel } from '@/components/battle';
import { CharacterBars, StatusBadges } from '@/components/character-stats';
import {
  BLADE_COLOR,
  BLAST_COLOR,
  BLAST_CORE,
  COIN_FACE,
  COIN_RIM,
  CoinIcon,
  DamageStat,
  GoldAmount,
  MonsterStats,
  SHIELD_COLOR,
  StarIcon,
  WOOD_COLOR,
} from '@/components/monster-stats';
import { PIXEL_SHAPES, PixelIcon, type PixelShape } from '@/components/pixel-icon';
import { PixelScene, TERRAINS } from '@/components/pixel-scene';
import { Avatar, Button, Card, CheckRow, Muted, Screen, SectionHeader, Stat, text } from '@/components/ui';
import { ABILITY_PRESETS, abilityFromSeed } from '@/lib/presets';
import { characterDefaults, rollDie, STATUS_INFO, STATUS_TYPES, xpToNext } from '@/lib/rules';
import { colors, palette, radius, spacing } from '@/lib/theme';
import type { Battle, Character } from '@/lib/types';

const ICONS: Record<PixelShape, { label: string; color: string; accent?: string }> = {
  heart: { label: 'Vida', color: colors.hp },
  drop: { label: 'Mana', color: colors.mana },
  bolt: { label: 'Estamina', color: colors.stamina },
  star: { label: 'XP / nível', color: colors.gold },
  arrow: { label: 'Voltar', color: colors.onPrimary },
  shield: { label: 'Armadura', color: SHIELD_COLOR },
  sword: { label: 'Custo físico', color: BLADE_COLOR },
  staff: { label: 'Custo mágico', color: WOOD_COLOR, accent: colors.mana },
  explosion: { label: 'Dano base', color: BLAST_COLOR, accent: BLAST_CORE },
  coin: { label: 'Ouro', color: COIN_RIM, accent: COIN_FACE },
};

const PALETTE_NAMES: Record<keyof typeof palette, string> = {
  crimson: 'Carmesim Suavizado',
  gold: 'Dourado Antigo',
  charcoal: 'Preto Carvão',
  parchment: 'Pergaminho Desbotado',
  graphite: 'Grafite Escuro',
  slate: 'Cinza Ardósia',
};

const sample = (() => {
  const fireball = ABILITY_PRESETS.find((s) => s[0] === 'Bola de Fogo')!;
  const strike = ABILITY_PRESETS.find((s) => s[0] === 'Golpe Poderoso')!;
  return { magic: abilityFromSeed(fireball), physical: abilityFromSeed(strike) };
})();

/** Tela para ver e testar todos os componentes visuais do app. */
export default function Gallery() {
  const [hero, setHero] = useState<Character>(() => ({
    id: 'galeria',
    name: 'Herói de teste',
    age: '',
    createdAt: 0,
    ...characterDefaults(),
    xp: 40,
    statuses: [{ type: 'veneno', roundsLeft: 2 }],
  }));
  const [lastRoll, setLastRoll] = useState<Battle['lastRoll']>();
  const [checked, setChecked] = useState(true);

  const change = (patch: (c: Character) => Partial<Character>) => setHero((c) => ({ ...c, ...patch(c) }));
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Galeria visual' }} />
      <Muted>Todos os componentes visuais do PKS Codex. Use os botões para testar as animações.</Muted>

      <SectionHeader title="Paleta" />
      <View style={styles.grid}>
        {(Object.keys(palette) as (keyof typeof palette)[]).map((key) => (
          <View key={key} style={styles.swatchCell}>
            <View style={[styles.swatch, { backgroundColor: palette[key] }]} />
            <Muted>{PALETTE_NAMES[key]}</Muted>
            <Muted>{palette[key]}</Muted>
          </View>
        ))}
      </View>

      <SectionHeader title="Ícones em pixel art" />
      <Card>
        <View style={styles.grid}>
          {PIXEL_SHAPES.map((shape) => (
            <View key={shape} style={styles.iconCell}>
              <PixelIcon shape={shape} pixel={5} color={ICONS[shape].color} accent={ICONS[shape].accent} />
              <Muted>{ICONS[shape].label}</Muted>
            </View>
          ))}
        </View>
        <Muted>Ícones de barra esvaziam conforme o valor:</Muted>
        <View style={styles.inline}>
          {[1, 0.75, 0.5, 0.25, 0].map((pct) => (
            <View key={pct} style={styles.iconCell}>
              <PixelIcon shape="heart" pixel={4} pct={pct} color={colors.hp} />
              <Muted>{pct * 100}%</Muted>
            </View>
          ))}
        </View>
      </Card>

      <SectionHeader title="Barras (interativas)" />
      <Card>
        <CharacterBars character={hero} showXp />
        <View style={styles.wrap}>
          <Button small variant="danger" title="Dano −5" onPress={() => change((c) => ({ hp: clamp(c.hp - 5, c.maxHp) }))} />
          <Button small title="Cura +5" onPress={() => change((c) => ({ hp: clamp(c.hp + 5, c.maxHp) }))} />
          <Button
            small
            variant="secondary"
            title="Veneno (1d4)"
            onPress={() => change((c) => ({ hp: clamp(c.hp - rollDie(4), c.maxHp) }))}
          />
          <Button
            small
            variant="secondary"
            icon={<PixelIcon shape="staff" color={WOOD_COLOR} accent={colors.mana} />}
            title="Magia −3"
            onPress={() => change((c) => ({ mana: clamp(c.mana - 3, c.maxMana) }))}
          />
          <Button
            small
            variant="secondary"
            icon={<PixelIcon shape="sword" color={BLADE_COLOR} />}
            title="Golpe −2"
            onPress={() => change((c) => ({ stamina: clamp(c.stamina - 2, c.maxStamina) }))}
          />
          <Button
            small
            variant="secondary"
            icon={<StarIcon />}
            title="XP +30"
            onPress={() => change((c) => ({ xp: Math.min(xpToNext(c.level), c.xp + 30) }))}
          />
          <Button
            small
            variant="ghost"
            title="Restaurar"
            onPress={() => change((c) => ({ hp: c.maxHp, mana: c.maxMana, stamina: c.maxStamina, xp: 0 }))}
          />
        </View>
      </Card>

      <SectionHeader title="Status" />
      <Card>
        <StatusBadges statuses={STATUS_TYPES.map((type) => ({ type, roundsLeft: STATUS_INFO[type].rounds }))} />
        {STATUS_TYPES.map((type) => (
          <Text key={type} style={{ color: STATUS_INFO[type].color }}>
            {STATUS_INFO[type].emoji} {STATUS_INFO[type].label}: {STATUS_INFO[type].effect}
          </Text>
        ))}
      </Card>

      <SectionHeader title="Dado virtual" />
      <DicePanel lastRoll={lastRoll} canRoll onRoll={(sides) => setLastRoll({ sides, value: rollDie(sides), by: 'Galeria' })} />

      <SectionHeader title="Cenários de batalha" />
      <View style={styles.grid}>
        {TERRAINS.map((t) => (
          <View key={t.key} style={styles.sceneCell}>
            <View style={styles.scene}>
              <PixelScene terrain={t.key} />
            </View>
            <Muted>{t.label}</Muted>
          </View>
        ))}
      </View>

      <SectionHeader title="Botões" />
      <Button title="Principal" onPress={() => {}} />
      <Button variant="secondary" title="Secundário" onPress={() => {}} />
      <Button variant="secondary" icon={<CoinIcon />} title="Com ícone" onPress={() => {}} />
      <Button variant="danger" title="Perigo" onPress={() => {}} />
      <Button title="Desabilitado" disabled onPress={() => {}} />
      <Button variant="ghost" title="Discreto" onPress={() => {}} />

      <SectionHeader title="Habilidades" />
      <AbilityCard ability={sample.magic} />
      <AbilityCard ability={sample.physical} />

      <SectionHeader title="Informações" />
      <Card>
        <View style={styles.inline}>
          <Avatar name="Aria" size={48} />
          <Avatar emoji="🐉" size={48} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={text.strong}>Texto forte</Text>
            <Text style={text.accent}>Destaque</Text>
            <Muted>Texto secundário</Muted>
          </View>
        </View>
        <MonsterStats hitPoints={84} armor={15} extra="2 habilidade(s)" />
        <DamageStat damage="2d6 + 3"> de dano base</DamageStat>
        <GoldAmount value={250} />
      </Card>
      <View style={styles.inline}>
        <Stat label="Ouro" value={250} icon={<CoinIcon pixel={3} />} />
        <Stat label="Força" value={12} />
        <Stat label="Agilidade" value={9} />
      </View>
      <CheckRow label="Opção marcável" detail="Toque para alternar" checked={checked} onToggle={() => setChecked((v) => !v)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  swatchCell: { width: '30%', gap: 2 },
  swatch: { height: 48, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.goldDim },
  iconCell: { alignItems: 'center', gap: spacing.xs, minWidth: 64 },
  sceneCell: { width: '47%', gap: spacing.xs },
  scene: { borderRadius: radius.sm, overflow: 'hidden', borderWidth: 2, borderColor: colors.goldDim },
});
