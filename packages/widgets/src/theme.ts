import { useTheme, type Theme } from '@cairn/style';

export interface WidgetTheme extends Theme {
  colors: Record<string, string>;
  radii: Record<string, number>;
  spacing: Record<string, number>;
  fontSizes: Record<string, number>;
  fontWeights: {
    regular: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  control: {
    height: { sm: number; md: number; lg: number };
    padX: { sm: number; md: number; lg: number };
  };
  motion: {
    fast: number;
    normal: number;
  };
}

export const defaultTheme: WidgetTheme = {
  colors: {
    primary: '#3b82f6',
    primaryHover: '#2f74ee',
    primaryActive: '#2563eb',
    onPrimary: '#ffffff',
    secondary: '#6b7280',
    secondaryHover: '#4b5563',
    secondaryActive: '#374151',
    onSecondary: '#ffffff',
    danger: '#ef4444',
    dangerHover: '#dc2626',
    onDanger: '#ffffff',
    success: '#22c55e',
    warning: '#f59e0b',
    info: '#0ea5e9',
    background: '#f7f7f8',
    surface: '#ffffff',
    surfaceAlt: '#f3f4f6',
    overlay: 'rgba(0,0,0,0.5)',
    text: '#1f2937',
    textMuted: '#6b7280',
    textDisabled: '#9ca3af',
    border: '#e5e7eb',
    borderStrong: '#d1d5db',
    focusRing: '#3b82f6',
    trackOff: '#cbd5e1',
    trackOn: '#3b82f6',
  },
  radii: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    pill: 9999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    '2xl': 32,
  },
  fontSizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    '2xl': 32,
  },
  fontWeights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  control: {
    height: { sm: 32, md: 40, lg: 48 },
    padX: { sm: 12, md: 16, lg: 20 },
  },
  motion: {
    fast: 120,
    normal: 200,
  },
};

export function useWidgetTheme(): WidgetTheme {
  const user = useTheme<Theme & Record<string, unknown>>();

  // Deep-merge user theme over defaultTheme section-by-section.
  const colors = { ...defaultTheme.colors, ...((user as any).colors ?? {}) };
  const radii = { ...defaultTheme.radii, ...((user as any).radii ?? {}) };
  const spacing = { ...defaultTheme.spacing, ...((user as any).spacing ?? {}) };
  const fontSizes = { ...defaultTheme.fontSizes, ...((user as any).fontSizes ?? {}) };
  const fontWeights = { ...defaultTheme.fontWeights, ...((user as any).fontWeights ?? {}) };

  const userControl = (user as any).control ?? {};
  const control = {
    height: { ...defaultTheme.control.height, ...(userControl.height ?? {}) },
    padX: { ...defaultTheme.control.padX, ...(userControl.padX ?? {}) },
  };

  const userMotion = (user as any).motion ?? {};
  const motion = { ...defaultTheme.motion, ...userMotion };

  // Copy any non-section extra keys from user theme.
  const sectionKeys = new Set(['colors', 'radii', 'spacing', 'fontSizes', 'fontWeights', 'control', 'motion']);
  const extra: Record<string, unknown> = {};
  for (const key of Object.keys(user as object)) {
    if (!sectionKeys.has(key)) extra[key] = (user as any)[key];
  }

  return { ...extra, colors, radii, spacing, fontSizes, fontWeights, control, motion };
}
