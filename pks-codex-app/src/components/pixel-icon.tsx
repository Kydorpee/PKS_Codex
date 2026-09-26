import { memo } from 'react';
import { View } from 'react-native';
import { pixelGrid, type PixelShape } from '@/lib/pixel-shapes';
import { colors } from '@/lib/theme';

export { PIXEL_SHAPES, type PixelShape } from '@/lib/pixel-shapes';

/** Ícone em pixel art que esvazia de baixo para cima conforme `pct` (0–1). */
export const PixelIcon = memo(function PixelIcon({
  shape,
  pct = 1,
  color,
  accent = colors.gold,
  pixel = 2,
}: {
  shape: PixelShape;
  /** Quanto do ícone está cheio (0–1). Omitido = cheio. */
  pct?: number;
  color: string;
  /** Cor do emblema (células "A"). */
  accent?: string;
  pixel?: number;
}) {
  return (
    <View accessible={false}>
      {pixelGrid(shape, pct, { color, accent }).map((row, y) => (
        <View key={y} style={{ flexDirection: 'row' }}>
          {row.map((fill, x) => (
            <View key={x} style={{ width: pixel, height: pixel, backgroundColor: fill ?? 'transparent' }} />
          ))}
        </View>
      ))}
    </View>
  );
});
