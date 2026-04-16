import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { BOARD, COLORS, SPACING } from '../../constants/theme';
import { DEFAULT_GRID, PLAYER_COLORS, createDefaultPlayers } from '../../game/engine';
import { getPlayerGradientColors, isRainbowColor } from '../../constants/playerColors';
import { GameSettings, PlayerConfig } from '../../game/types';

interface SetupFormProps {
  settings: GameSettings;
  onChange: (settings: GameSettings) => void;
  onRestartGame: () => void;
}

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;
const MIN_COLUMNS = 3;
const MAX_COLUMNS = 8;
const MIN_ROWS = 3;
const MAX_ROWS = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function estimateGridInnerWidth(windowWidth: number): number {
  return Math.max(windowWidth - BOARD.gridInsetHorizontal * 2, 1);
}

function estimateGridInnerHeight(windowHeight: number, playerCount: number): number {
  const scoreboardHeight = playerCount * 72 + Math.max(0, playerCount - 1) * SPACING.sm;
  const chromeAboveBoard = SPACING.lg * 2 + SPACING.lg * 2 + scoreboardHeight + 56;
  return Math.max(windowHeight - chromeAboveBoard - BOARD.gridInsetVertical * 2, 80);
}

function balancedRowCount(cols: number, innerWidth: number, innerHeight: number): number {
  if (cols <= 0) {
    return MIN_ROWS;
  }
  const wSpan = innerWidth - BOARD.dotSize;
  const hSpan = innerHeight - BOARD.dotSize;
  if (wSpan <= 0 || hSpan <= 0) {
    return MIN_ROWS;
  }
  const rows = Math.round((hSpan * cols) / wSpan);
  return clamp(rows, MIN_ROWS, MAX_ROWS);
}

function updatePlayers(players: PlayerConfig[], count: number): PlayerConfig[] {
  if (players.length === count) {
    return players;
  }
  if (players.length > count) {
    return players.slice(0, count);
  }
  const nextPlayers = [...players];
  const defaults = createDefaultPlayers(count);
  for (let index = players.length; index < count; index += 1) {
    nextPlayers.push(defaults[index]);
  }
  return nextPlayers;
}

export function createDefaultSettings(): GameSettings {
  return {
    game: {
      startWithSolidPerimeter: false,
    },
    grid: DEFAULT_GRID,
    players: createDefaultPlayers(2),
  };
}

export function SetupForm({ settings, onChange, onRestartGame }: SetupFormProps) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const playerCount = settings.players.length;
  const innerW = estimateGridInnerWidth(windowWidth);
  const innerH = estimateGridInnerHeight(windowHeight, playerCount);
  const estimatedRows = balancedRowCount(settings.grid.cols, innerW, innerH);
  const cols = settings.grid.cols;
  const playersAtMin = playerCount <= MIN_PLAYERS;
  const playersAtMax = playerCount >= MAX_PLAYERS;
  const gridAtMinCols = cols <= MIN_COLUMNS;
  const gridAtMaxCols = cols >= MAX_COLUMNS;
  const selectedColors = new Set(settings.players.map((player) => player.color));

  const setPlayerCount = (count: number) => {
    const nextCount = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, count));
    const nextPlayers = updatePlayers(settings.players, nextCount);
    const nextInnerH = estimateGridInnerHeight(windowHeight, nextCount);
    const nextRows = balancedRowCount(settings.grid.cols, innerW, nextInnerH);
    onChange({
      ...settings,
      grid: { cols: settings.grid.cols, rows: nextRows },
      players: nextPlayers,
    });
  };

  const setColumnCount = (value: number) => {
    const nextCols = clamp(value, MIN_COLUMNS, MAX_COLUMNS);
    const nextRows = balancedRowCount(nextCols, innerW, innerH);
    onChange({
      ...settings,
      grid: { rows: nextRows, cols: nextCols },
    });
  };

  const setStartWithSolidPerimeter = (enabled: boolean) => {
    onChange({
      ...settings,
      game: {
        ...settings.game,
        startWithSolidPerimeter: enabled,
      },
    });
  };

  const updatePlayer = (playerId: string, updates: Partial<PlayerConfig>) => {
    onChange({
      ...settings,
      players: settings.players.map((player) =>
        player.id === playerId ? { ...player, ...updates } : player,
      ),
    });
  };

  return (
    <>
    <View style={[styles.card, styles.section]}>
        <Text style={styles.sectionTitle}>Players</Text>
        <View style={[styles.section, styles.sectionCompact]}>
          <Text style={styles.sectionLabel}>Count</Text>
          <View style={styles.stepperRow}>
            <Pressable
              disabled={playersAtMin}
              onPress={() => setPlayerCount(playerCount - 1)}
              style={({ pressed }) => [
                styles.stepperButton,
                playersAtMin && styles.stepperButtonDisabled,
                pressed && !playersAtMin && styles.stepperButtonPressed,
              ]}
            >
              <Text style={[styles.stepperText, playersAtMin && styles.stepperTextDisabled]}>-</Text>
            </Pressable>
            <Text style={styles.stepperValueCompact}>{playerCount}</Text>
            <Pressable
              disabled={playersAtMax}
              onPress={() => setPlayerCount(playerCount + 1)}
              style={({ pressed }) => [
                styles.stepperButton,
                playersAtMax && styles.stepperButtonDisabled,
                pressed && !playersAtMax && styles.stepperButtonPressed,
              ]}
            >
              <Text style={[styles.stepperText, playersAtMax && styles.stepperTextDisabled]}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Player Setup</Text>
          <View style={styles.playerSetupList}>
            {settings.players.map((player, index) => (
              <View key={player.id} style={styles.playerRow}>
                <View style={styles.playerConfig}>
                  <TextInput
                    value={player.name}
                    onChangeText={(name) => updatePlayer(player.id, { name })}
                    placeholder={`Player ${index + 1}`}
                    placeholderTextColor={COLORS.mutedText}
                    style={styles.nameInput}
                    maxLength={18}
                  />
                  <View style={styles.colorGrid}>
                    {PLAYER_COLORS.map((color) => {
                      const isSelected = player.color === color;
                      const isTaken = selectedColors.has(color) && !isSelected;

                      return (
                        <Pressable
                          key={color}
                          disabled={isTaken}
                          onPress={() => updatePlayer(player.id, { color })}
                          style={({ pressed }) => [
                            styles.colorOption,
                            isSelected && styles.colorOptionSelected,
                            isTaken && styles.colorOptionDisabled,
                            pressed && !isTaken && !isSelected && styles.colorOptionPressed,
                          ]}
                        >
                          {isRainbowColor(color) ? (
                            <LinearGradient
                              colors={getPlayerGradientColors(color)}
                              end={{ x: 1, y: 1 }}
                              start={{ x: 0, y: 0 }}
                              style={styles.colorFill}
                            />
                          ) : (
                            <View style={[styles.colorFill, { backgroundColor: color }]} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
    </View>

      <View style={[styles.card, styles.section, styles.gameSection]}>
        <Text style={styles.sectionTitle}>Game</Text>
        <Text style={styles.gameHint}>Game settings apply after restart.</Text>

        <View style={[styles.section, styles.sectionCompact]}>
          <Text style={styles.sectionLabel}>Grid</Text>
          <View style={styles.stepperRow}>
            <Pressable
              disabled={gridAtMinCols}
              onPress={() => setColumnCount(cols - 1)}
              style={({ pressed }) => [
                styles.stepperButton,
                gridAtMinCols && styles.stepperButtonDisabled,
                pressed && !gridAtMinCols && styles.stepperButtonPressed,
              ]}
            >
              <Text style={[styles.stepperText, gridAtMinCols && styles.stepperTextDisabled]}>-</Text>
            </Pressable>
            <Text style={styles.stepperValueCompact}>
              {cols}x{estimatedRows}
            </Text>
            <Pressable
              disabled={gridAtMaxCols}
              onPress={() => setColumnCount(cols + 1)}
              style={({ pressed }) => [
                styles.stepperButton,
                gridAtMaxCols && styles.stepperButtonDisabled,
                pressed && !gridAtMaxCols && styles.stepperButtonPressed,
              ]}
            >
              <Text style={[styles.stepperText, gridAtMaxCols && styles.stepperTextDisabled]}>+</Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          onPress={() => setStartWithSolidPerimeter(!settings.game.startWithSolidPerimeter)}
          style={({ pressed }) => [styles.toggleRow, pressed && styles.toggleRowPressed]}
        >
          <View
            style={[
              styles.checkbox,
              settings.game.startWithSolidPerimeter && styles.checkboxChecked,
            ]}
          >
            {settings.game.startWithSolidPerimeter ? <View style={styles.checkboxDot} /> : null}
          </View>
          <View style={styles.toggleTextWrap}>
            <Text style={styles.toggleTitle}>Start with box outline</Text>
            <Text style={styles.toggleSubtitle}>Pre-fills the outer box perimeter.</Text>
          </View>
        </Pressable>

        <Pressable onPress={onRestartGame} style={styles.gameRestartButton}>
          <Text style={styles.gameRestartButtonText}>Restart to Apply Game Settings</Text>
        </Pressable>
      </View>
      </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: SPACING.lg,
    padding: SPACING.xl,
  },
  title: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    color: COLORS.mutedText,
    fontSize: 16,
    lineHeight: 22,
  },
  section: {
    gap: SPACING.sm,
  },
  gameSection: {
    marginTop: SPACING.sm,
  },
  sectionCompact: {
    alignSelf: 'flex-start',
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
  },
  sectionLabel: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  gameHint: {
    color: COLORS.mutedText,
    fontSize: 13,
    fontWeight: '600',
  },
  stepperRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.md,
  },
  stepperButton: {
    alignItems: 'center',
    backgroundColor: COLORS.text,
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  stepperButtonDisabled: {
    backgroundColor: COLORS.border,
    opacity: 0.85,
  },
  stepperButtonPressed: {
    opacity: 0.88,
  },
  stepperText: {
    color: COLORS.buttonText,
    fontSize: 24,
    fontWeight: '700',
  },
  stepperTextDisabled: {
    color: COLORS.mutedText,
  },
  stepperValueCompact: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: SPACING.sm,
    textAlign: 'center',
  },
  playerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: SPACING.md,
  },
  playerSetupList: {
    gap: SPACING.md,
  },
  playerConfig: {
    flex: 1,
    gap: SPACING.sm,
  },
  colorGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  colorOption: {
    borderColor: COLORS.border,
    borderRadius: 10,
    borderWidth: 2,
    height: 28,
    overflow: 'hidden',
    width: 28,
  },
  colorFill: {
    flex: 1,
  },
  colorOptionDisabled: {
    opacity: 0.22,
  },
  colorOptionPressed: {
    opacity: 0.82,
  },
  colorOptionSelected: {
    borderColor: COLORS.text,
    transform: [{ scale: 1.08 }],
  },
  nameInput: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    color: COLORS.text,
    flex: 1,
    minHeight: 44,
    paddingHorizontal: SPACING.md,
  },
  toggleRow: {
    alignItems: 'center',
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  toggleRowPressed: {
    opacity: 0.82,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: COLORS.border,
    borderRadius: 7,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  checkboxChecked: {
    borderColor: COLORS.text,
  },
  checkboxDot: {
    backgroundColor: COLORS.text,
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  toggleTextWrap: {
    flex: 1,
    gap: 2,
  },
  toggleTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  toggleSubtitle: {
    color: COLORS.mutedText,
    fontSize: 13,
    fontWeight: '500',
  },
  gameRestartButton: {
    alignItems: 'center',
    backgroundColor: COLORS.text,
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  gameRestartButtonText: {
    color: COLORS.buttonText,
    fontSize: 15,
    fontWeight: '700',
  },
});
