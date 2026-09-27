/**
 * Widget da tela inicial (Android): ficha resumida do personagem.
 * Só é carregado quando o módulo nativo existe (build de desenvolvimento), nunca no Expo Go.
 */
import { FlexWidget, SvgWidget, TextWidget, type ColorProp } from 'react-native-android-widget';
import { SHAPES, pixelSvg, type PixelShape } from '@/lib/pixel-shapes';
import { xpToNext } from '@/lib/rules';
import { colors, hpColor, palette } from '@/lib/theme';
import type { Character } from '@/lib/types';

const c = (color: string) => color as ColorProp;

const COIN = { color: '#C99A2E', accent: '#F2D46B' };

function Icon({ shape, pct = 1, color, accent, size = 3 }: { shape: PixelShape; pct?: number; color: string; accent?: string; size?: number }) {
  const rows = SHAPES[shape];
  return (
    <SvgWidget
      svg={pixelSvg(shape, pct, { color, accent }, size)}
      style={{ width: rows[0].length * size, height: rows.length * size }}
    />
  );
}

function BarRow({ shape, value, max, color }: { shape: PixelShape; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', flexGap: 6 }}>
      <Icon shape={shape} pct={pct} color={color} />
      <FlexWidget
        style={{ flex: 1, height: 8, flexDirection: 'row', backgroundColor: c('#4A4A4A'), borderRadius: 4, overflow: 'hidden' }}
      >
        <FlexWidget style={{ flex: pct, height: 'match_parent', backgroundColor: c(color), borderRadius: 4 }} />
        <FlexWidget style={{ flex: 1 - pct, height: 'match_parent' }} />
      </FlexWidget>
      <TextWidget text={`${value}/${max}`} style={{ fontSize: 11, color: c(colors.textOnDarkMuted), width: 48, textAlign: 'right' }} />
    </FlexWidget>
  );
}

const frame = {
  height: 'match_parent',
  width: 'match_parent',
  backgroundColor: c(palette.charcoal),
  borderRadius: 16,
  borderWidth: 2,
  borderColor: c(palette.gold),
  padding: 12,
} as const;

export function CharacterWidget({
  character,
  codexName,
  t,
}: {
  character?: Character;
  codexName?: string;
  /** Tradução no idioma escolhido no app (o widget roda fora do app). */
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  if (!character) {
    return (
      <FlexWidget clickAction="OPEN_APP" style={{ ...frame, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flexGap: 6 }}>
        <TextWidget text="PKS Codex" style={{ fontSize: 18, fontWeight: 'bold', color: c(palette.gold) }} />
        <TextWidget text={t('Crie um personagem para vê-lo aqui')} style={{ fontSize: 12, color: c(palette.parchment) }} />
      </FlexWidget>
    );
  }

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: `pkscodex://personagem/${character.id}` }}
      accessibilityLabel={t('Ficha de {name}', { name: character.name })}
      style={{ ...frame, flexDirection: 'column', justifyContent: 'space-between' }}
    >
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', flexGap: 6 }}>
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget
            text={character.name}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 16, fontWeight: 'bold', color: c(palette.parchment) }}
          />
        </FlexWidget>
        <Icon shape="star" pct={character.xp / xpToNext(character.level)} color={palette.gold} />
        <TextWidget text={t('Nv {level}', { level: character.level })} style={{ fontSize: 12, fontWeight: 'bold', color: c(palette.gold) }} />
        <Icon shape="coin" color={COIN.color} accent={COIN.accent} />
        <TextWidget text={String(character.gold)} style={{ fontSize: 12, fontWeight: 'bold', color: c(palette.gold) }} />
      </FlexWidget>
      <BarRow shape="heart" value={character.hp} max={character.maxHp} color={hpColor(character.hp, character.maxHp)} />
      <BarRow shape="drop" value={character.mana} max={character.maxMana} color={colors.mana} />
      <BarRow shape="bolt" value={character.stamina} max={character.maxStamina} color={colors.stamina} />
      {!!codexName && (
        <TextWidget text={`📜 ${codexName}`} maxLines={1} truncate="END" style={{ fontSize: 11, color: c(colors.textOnDarkMuted) }} />
      )}
    </FlexWidget>
  );
}
