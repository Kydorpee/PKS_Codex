/** Paleta do PKS Codex. */
export const palette = {
  /** Carmesim Suavizado: ação principal, cabeçalhos, vida, alertas. */
  crimson: '#8A1519',
  /** Dourado Antigo: bordas, separadores, destaques. */
  gold: '#D4AF37',
  /** Preto Carvão: fundo do app. */
  charcoal: '#2B2B2B',
  /** Pergaminho Desbotado: cards, formulários, inventário. */
  parchment: '#F0E6D2',
  /** Grafite Escuro: texto sobre pergaminho ou dourado. */
  graphite: '#1A1A1A',
  /** Cinza Ardósia: texto secundário, dicas, desabilitado. */
  slate: '#6C7A86',
};

export const colors = {
  background: palette.charcoal,
  header: palette.crimson,
  /** Cards e superfícies de leitura. */
  surface: palette.parchment,
  /** Campos, chips e blocos dentro de um card. */
  surfaceRaised: '#E3D6BC',
  border: '#CDBB94',
  primary: palette.crimson,
  onPrimary: palette.parchment,
  gold: palette.gold,
  goldDim: '#A8892B',
  /** Texto sobre pergaminho. */
  text: palette.graphite,
  textMuted: palette.slate,
  /** Texto direto sobre o fundo carvão. */
  textOnDark: palette.parchment,
  textOnDarkMuted: '#A9B3BC',
  disabled: palette.slate,
  danger: palette.crimson,
  success: '#2E6B2A',
  hp: palette.crimson,
  xp: '#5B3491',
  mana: '#2D5C9A',
  stamina: '#A8651A',
  track: 'rgba(108, 122, 134, 0.35)',
  /** Rastro da barra ao tomar dano / prévia ao curar. */
  damageTrail: '#F2C38B',
  healTrail: '#8FCB84',
};

/** Cor da barra de vida: verde acima de 50%, âmbar até 25%, carmesim abaixo disso. */
export function hpColor(value: number, max: number): string {
  const pct = max > 0 ? value / max : 0;
  if (pct > 0.5) return colors.success;
  if (pct > 0.25) return '#C8901A';
  return colors.hp;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const radius = { sm: 8, md: 12, lg: 20, round: 999 };
