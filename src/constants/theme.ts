export type ThemeMode = 'system' | 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  border: string;
  boardBackground: string;
  dot: string;
  inactiveLine: string;
  recentMoveGlow: string;
  buttonText: string;
  primaryAction: string;
  winnerSurface: string;
}

export const LIGHT_COLORS: ThemeColors = {
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  mutedText: '#475569',
  border: '#cbd5e1',
  boardBackground: '#e2e8f0',
  dot: '#334155',
  inactiveLine: '#cbd5e1',
  recentMoveGlow: 'rgba(15, 23, 42, 0.14)',
  buttonText: '#ffffff',
  primaryAction: '#0f172a',
  winnerSurface: '#ecfccb',
};

export const DARK_COLORS: ThemeColors = {
  background: '#0b1220',
  surface: '#111827',
  text: '#e2e8f0',
  mutedText: '#94a3b8',
  border: '#334155',
  boardBackground: '#0f172a',
  dot: '#e2e8f0',
  inactiveLine: '#475569',
  recentMoveGlow: 'rgba(148, 163, 184, 0.2)',
  buttonText: '#ffffff',
  primaryAction: '#3b82f6',
  winnerSurface: '#1f3d2c',
};

export const COLORS = LIGHT_COLORS;

export function getThemeColors(mode: ThemeMode, systemScheme: 'light' | 'dark' | null): ThemeColors {
  if (mode === 'light') {
    return LIGHT_COLORS;
  }
  if (mode === 'dark') {
    return DARK_COLORS;
  }
  return systemScheme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
}

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
};

export const BOARD = {
  minCellSize: 48,
  maxCellSize: 84,
  framePadding: 0,
  /** Inset between board frame and dot grid on left/right. */
  gridInsetHorizontal: 20,
  /** Inset between board frame and dot grid on top/bottom (typically larger than horizontal). */
  gridInsetVertical: 36,
  dotSize: 12,
  lineThickness: 8,
  lineTouchThickness: 26,
  boxInset: 10,
  recentMoveThickness: 14,
};
