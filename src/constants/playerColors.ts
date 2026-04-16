export const RAINBOW_COLOR = 'rainbow';

export const PLAYER_COLOR_OPTIONS = [
  '#2563eb',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  RAINBOW_COLOR,
] as const;

export const RAINBOW_GRADIENT = [
  '#ff3b30',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#2563eb',
  '#8b5cf6',
  '#ff3b30',
] as const;
const SOLID_FALLBACK_GRADIENT = ['#2563eb', '#2563eb'] as const;

function withAlpha(hexColor: string, alpha: number): string {
  const hex = hexColor.replace('#', '');
  const normalized =
    hex.length === 3
      ? hex
          .split('')
          .map((value) => `${value}${value}`)
          .join('')
      : hex;

  if (!/^[\da-fA-F]{6}$/.test(normalized)) {
    return hexColor;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function isRainbowColor(color: string): boolean {
  return color === RAINBOW_COLOR;
}

export function getPlayerGradientColors(
  color: string,
  alpha = 1,
): readonly [string, string, ...string[]] {
  const source = isRainbowColor(color)
    ? RAINBOW_GRADIENT
    : color
      ? [color, color]
      : SOLID_FALLBACK_GRADIENT;

  const resolved = alpha >= 1 ? source : source.map((entry) => withAlpha(entry, alpha));

  return [resolved[0], resolved[1], ...resolved.slice(2)];
}

export function getPlayerBaseColor(color: string): string {
  return isRainbowColor(color) ? RAINBOW_GRADIENT[0] : color;
}
