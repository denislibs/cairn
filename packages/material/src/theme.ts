import type { Theme } from '@cairn/style';
import type { Shadow } from '@cairn/style';
import { lighten, darken, contrastText } from './colors';

export interface PaletteColor {
  main: string;
  light: string;
  dark: string;
  contrastText: string;
}

export interface Palette {
  mode: 'light' | 'dark';
  primary: PaletteColor;
  secondary: PaletteColor;
  error: PaletteColor;
  warning: PaletteColor;
  info: PaletteColor;
  success: PaletteColor;
  background: { default: string; paper: string };
  text: { primary: string; secondary: string; disabled: string };
  divider: string;
  action: {
    hover: string;
    selected: string;
    disabled: string;
    disabledBg: string;
    focus: string;
  };
}

export interface TypographyVariant {
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  textTransform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
}

export type TypographyVariantName =
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  | 'subtitle1' | 'subtitle2'
  | 'body1' | 'body2'
  | 'button' | 'caption' | 'overline';

export type TypographyScale = Record<TypographyVariantName, TypographyVariant>;

export interface MaterialTheme extends Omit<Theme, 'spacing'> {
  palette: Palette;
  elevation: Shadow[][];
  typography: TypographyScale;
  shape: { borderRadius: number };
  spacing: (n: number) => number;
  colors: Record<string, string>;
}

export interface MaterialThemeOptions {
  mode?: 'light' | 'dark';
  primary?: string;
  secondary?: string;
}

function makePaletteColor(main: string): PaletteColor {
  return {
    main,
    light: lighten(main, 0.2),
    dark: darken(main, 0.3),
    contrastText: contrastText(main),
  };
}

function elevationShadows(dp: number): Shadow[] {
  return [
    { color: 'rgba(0,0,0,0.20)', blur: dp * 1.5, offsetX: 0, offsetY: Math.max(1, Math.ceil(dp / 2)), spread: -1 },
    { color: 'rgba(0,0,0,0.14)', blur: dp, offsetX: 0, offsetY: dp, spread: 0 },
    { color: 'rgba(0,0,0,0.12)', blur: dp * 2.5, offsetX: 0, offsetY: 1, spread: 0 },
  ];
}

const TYPOGRAPHY: TypographyScale = {
  h1: { fontSize: 96, fontWeight: 300, lineHeight: 112, letterSpacing: -1.5 },
  h2: { fontSize: 60, fontWeight: 300, lineHeight: 72, letterSpacing: -0.5 },
  h3: { fontSize: 48, fontWeight: 400, lineHeight: 56, letterSpacing: 0 },
  h4: { fontSize: 34, fontWeight: 400, lineHeight: 42, letterSpacing: 0.25 },
  h5: { fontSize: 24, fontWeight: 400, lineHeight: 32, letterSpacing: 0 },
  h6: { fontSize: 20, fontWeight: 500, lineHeight: 32, letterSpacing: 0.15 },
  subtitle1: { fontSize: 16, fontWeight: 400, lineHeight: 28, letterSpacing: 0.15 },
  subtitle2: { fontSize: 14, fontWeight: 500, lineHeight: 22, letterSpacing: 0.1 },
  body1: { fontSize: 16, fontWeight: 400, lineHeight: 24, letterSpacing: 0.15 },
  body2: { fontSize: 14, fontWeight: 400, lineHeight: 20, letterSpacing: 0.15 },
  button: { fontSize: 14, fontWeight: 500, lineHeight: 24, letterSpacing: 0.4, textTransform: 'uppercase' },
  caption: { fontSize: 12, fontWeight: 400, lineHeight: 16, letterSpacing: 0.4 },
  overline: { fontSize: 10, fontWeight: 400, lineHeight: 16, letterSpacing: 1.5, textTransform: 'uppercase' },
};

export function createMaterialTheme(opts: MaterialThemeOptions = {}): MaterialTheme {
  const mode = opts.mode ?? 'light';
  const dark = mode === 'dark';

  const primary = makePaletteColor(opts.primary ?? '#1976d2');
  const secondary = makePaletteColor(opts.secondary ?? '#9c27b0');

  const palette: Palette = {
    mode,
    primary,
    secondary,
    error: makePaletteColor('#d32f2f'),
    warning: makePaletteColor('#ed6c02'),
    info: makePaletteColor('#0288d1'),
    success: makePaletteColor('#2e7d32'),
    background: dark
      ? { default: '#121212', paper: '#1e1e1e' }
      : { default: '#fafafa', paper: '#ffffff' },
    text: dark
      ? { primary: '#fff', secondary: 'rgba(255,255,255,0.7)', disabled: 'rgba(255,255,255,0.5)' }
      : { primary: 'rgba(0,0,0,0.87)', secondary: 'rgba(0,0,0,0.6)', disabled: 'rgba(0,0,0,0.38)' },
    divider: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
    action: dark
      ? { hover: 'rgba(255,255,255,0.08)', selected: 'rgba(255,255,255,0.16)', disabled: 'rgba(255,255,255,0.3)', disabledBg: 'rgba(255,255,255,0.12)', focus: 'rgba(255,255,255,0.12)' }
      : { hover: 'rgba(0,0,0,0.04)', selected: 'rgba(0,0,0,0.08)', disabled: 'rgba(0,0,0,0.26)', disabledBg: 'rgba(0,0,0,0.12)', focus: 'rgba(0,0,0,0.12)' },
  };

  const elevation = Array.from({ length: 25 }, (_, dp) =>
    dp === 0 ? [] : elevationShadows(dp),
  );

  return {
    palette,
    elevation,
    typography: TYPOGRAPHY,
    shape: { borderRadius: 4 },
    spacing: (n: number) => n * 8,
    colors: {
      primary: primary.main,
      secondary: secondary.main,
      error: palette.error.main,
      background: palette.background.default,
      text: palette.text.primary,
    },
  } as MaterialTheme;
}
