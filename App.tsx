import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Board } from './src/components/game/Board';
import { Scoreboard } from './src/components/game/Scoreboard';
import { SetupForm, createDefaultSettings } from './src/components/game/SetupForm';
import { BOARD, COLORS, SPACING, getThemeColors } from './src/constants/theme';
import { applyMove, createInitialGame } from './src/game/engine';
import { EdgeKey, GameState, GameSettings } from './src/game/types';

const MIN_ROWS = 3;
const MAX_ROWS = 12;
const MOVE_INPUT_LOCK_MS = 420;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Inner width available for the dot grid (board is full window width; inset is symmetric). */
function estimateGridInnerWidth(windowWidth: number): number {
  return Math.max(windowWidth - BOARD.gridInsetHorizontal * 2, 1);
}

/** Rough inner height of the board flex area before cell sizing (matches gameRoot + scoreboard + actions). */
function estimateGridInnerHeight(
  windowHeight: number,
  verticalInsets: number,
  playerCount: number,
): number {
  const scoreboardHeight =
    playerCount * 72 + Math.max(0, playerCount - 1) * SPACING.sm;
  const chromeAboveBoard =
    SPACING.lg * 2 + // gameRoot top + bottom padding
    SPACING.lg * 2 + // gaps: scoreboard–board, board–actions
    scoreboardHeight +
    56; // action buttons row
  return Math.max(windowHeight - verticalInsets - chromeAboveBoard - BOARD.gridInsetVertical * 2, 80);
}

/** Rows so width- and height-limited cell sizes match (~square cells, minimal side gutters). */
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

function resolveSettingsForDevice(
  settings: GameSettings,
  windowWidth: number,
  windowHeight: number,
  verticalInsets: number,
): GameSettings {
  const cols = settings.grid.cols;
  const innerW = estimateGridInnerWidth(windowWidth);
  const innerH = estimateGridInnerHeight(windowHeight, verticalInsets, settings.players.length);
  const rows = balancedRowCount(cols, innerW, innerH);

  return {
    ...settings,
    grid: {
      rows,
      cols,
    },
  };
}

function normalizeSettings(settings: GameSettings): GameSettings {
  return {
    ...settings,
    players: settings.players.map((player, index) => ({
      ...player,
      name: player.name.trim() || `Player ${index + 1}`,
    })),
  };
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppScreen />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppScreen() {
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [settings, setSettings] = useState<GameSettings>(createDefaultSettings);
  const colors = useMemo(
    () => getThemeColors(settings.appearanceMode, systemColorScheme ?? null),
    [settings.appearanceMode, systemColorScheme],
  );
  const responsiveSettings = useMemo(
    () => resolveSettingsForDevice(settings, windowWidth, windowHeight, insets.top + insets.bottom),
    [insets.bottom, insets.top, settings, windowHeight, windowWidth],
  );
  const [game, setGame] = useState<GameState>(() =>
    createInitialGame(resolveSettingsForDevice(createDefaultSettings(), windowWidth, windowHeight, 0)),
  );
  const [boardBounds, setBoardBounds] = useState({ height: 0, width: 0 });
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isRestartConfirmOpen, setIsRestartConfirmOpen] = useState(false);
  const [isMoveInputLocked, setIsMoveInputLocked] = useState(false);
  const sheetTranslateY = useRef(new Animated.Value(windowHeight)).current;
  const dragY = useRef(0);
  const moveLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (moveLockTimeoutRef.current) {
        clearTimeout(moveLockTimeoutRef.current);
      }
    };
  }, []);

  const lockBoardInput = () => {
    if (moveLockTimeoutRef.current) {
      clearTimeout(moveLockTimeoutRef.current);
    }
    setIsMoveInputLocked(true);
    moveLockTimeoutRef.current = setTimeout(() => {
      setIsMoveInputLocked(false);
      moveLockTimeoutRef.current = null;
    }, MOVE_INPUT_LOCK_MS);
  };

  const openSheet = () => {
    dragY.current = 0;
    setIsSetupOpen(true);
    sheetTranslateY.setValue(windowHeight);
    Animated.spring(sheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 90,
      friction: 14,
    }).start();
  };

  const closeSheet = () => {
    Animated.timing(sheetTranslateY, {
      toValue: windowHeight,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsSetupOpen(false);
      }
    });
  };

  const settleSheet = (velocityY: number) => {
    const shouldClose = dragY.current > 120 || velocityY > 1.15;
    if (shouldClose) {
      closeSheet();
      return;
    }
    Animated.spring(sheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 120,
      friction: 16,
    }).start();
  };

  const sheetPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderMove: (_, gestureState) => {
        const nextDrag = Math.max(0, gestureState.dy);
        dragY.current = nextDrag;
        sheetTranslateY.setValue(nextDrag);
      },
      onPanResponderRelease: (_, gestureState) => {
        settleSheet(gestureState.vy);
      },
      onPanResponderTerminate: () => {
        settleSheet(0);
      },
    }),
  ).current;

  const handleSettingsChange = (nextSettings: GameSettings) => {
    const resolvedSettings = resolveSettingsForDevice(
      nextSettings,
      windowWidth,
      windowHeight,
      insets.top + insets.bottom,
    );
    const normalizedSettings = normalizeSettings(resolvedSettings);

    setSettings(normalizedSettings);
    setGame((currentGame) => {
      const nextPlayerIds = new Set(normalizedSettings.players.map((player) => player.id));
      const removedPlayerIds = new Set(
        currentGame.players
          .map((player) => player.id)
          .filter((playerId) => !nextPlayerIds.has(playerId)),
      );
      const hasRemovedPlayers = removedPlayerIds.size > 0;

      const nextEdges = hasRemovedPlayers
        ? Object.fromEntries(
            Object.entries(currentGame.edges).filter(
              ([, edge]) => edge && nextPlayerIds.has(edge.ownerPlayerId),
            ),
          )
        : currentGame.edges;
      const nextBoxes = hasRemovedPlayers
        ? Object.fromEntries(
            Object.entries(currentGame.boxes).filter(
              ([, box]) => box && nextPlayerIds.has(box.ownerPlayerId),
            ),
          )
        : currentGame.boxes;

      const scoresByPlayerId = new Map(normalizedSettings.players.map((player) => [player.id, 0]));
      Object.values(nextBoxes).forEach((box) => {
        if (!box) {
          return;
        }
        scoresByPlayerId.set(box.ownerPlayerId, (scoresByPlayerId.get(box.ownerPlayerId) ?? 0) + 1);
      });

      const nextPlayers = normalizedSettings.players.map((player) => ({
        ...player,
        score: scoresByPlayerId.get(player.id) ?? 0,
      }));

      const currentPlayerId = currentGame.players[currentGame.currentPlayerIndex]?.id;
      let nextCurrentPlayerIndex = nextPlayers.findIndex((player) => player.id === currentPlayerId);
      if (nextCurrentPlayerIndex === -1) {
        nextCurrentPlayerIndex = Math.min(
          currentGame.currentPlayerIndex,
          Math.max(nextPlayers.length - 1, 0),
        );
      }

      const nextLastMoveByPlayerId = Object.fromEntries(
        Object.entries(currentGame.lastMoveByPlayerId).filter(
          ([playerId, edgeKey]) =>
            nextPlayerIds.has(playerId) &&
            typeof edgeKey === 'string' &&
            Boolean(nextEdges[edgeKey as EdgeKey]),
        ),
      );

      return {
        ...currentGame,
        boxes: nextBoxes,
        currentPlayerIndex: nextCurrentPlayerIndex,
        edges: nextEdges,
        lastMoveByPlayerId: nextLastMoveByPlayerId,
        moveCount: Object.keys(nextEdges).length,
        players: nextPlayers,
        status:
          Object.keys(nextBoxes).length === currentGame.grid.rows * currentGame.grid.cols
            ? 'finished'
            : 'playing',
        winner: null,
      };
    });
  };

  const handleRestart = () => {
    if (isSetupOpen) {
      closeSetup();
      setTimeout(() => {
        setIsRestartConfirmOpen(true);
      }, 220);
      return;
    }
    setIsRestartConfirmOpen(true);
  };

  const handleConfirmRestart = () => {
    setIsRestartConfirmOpen(false);
    closeSetup();
    setIsMoveInputLocked(false);
    if (moveLockTimeoutRef.current) {
      clearTimeout(moveLockTimeoutRef.current);
      moveLockTimeoutRef.current = null;
    }
    setGame(createInitialGame(responsiveSettings));
  };

  const handleOpenSetup = () => {
    openSheet();
  };

  const closeSetup = () => {
    closeSheet();
  };

  const handleEdgePress = (edgeKey: EdgeKey) => {
    if (isMoveInputLocked) {
      return;
    }
    setGame((currentGame) => {
      const result = applyMove(currentGame, edgeKey);
      if (result.wasValidMove) {
        lockBoardInput();
      }
      return result.state;
    });
  };

  const winnerNames =
    game.winner?.playerIds
      .map((playerId) => game.players.find((player) => player.id === playerId)?.name)
      .filter((name): name is string => Boolean(name)) ?? [];
  const winnerLabel =
    winnerNames.length > 1
      ? `${winnerNames.join(' & ')} tie!`
      : winnerNames.length === 1
        ? `${winnerNames[0]} wins!`
        : 'Game over';

  return (
    <View
      style={[
        styles.safeArea,
        { backgroundColor: colors.background },
        {
          paddingBottom: insets.bottom,
          paddingTop: insets.top,
        },
      ]}
    >
      <StatusBar style={settings.appearanceMode === 'dark' || (settings.appearanceMode === 'system' && systemColorScheme === 'dark') ? 'light' : 'dark'} />
      <View style={styles.gameRoot}>
        <Scoreboard colors={colors} game={game} />
        <View
          style={styles.boardSection}
          onLayout={({ nativeEvent }) => {
            const { height, width } = nativeEvent.layout;
            setBoardBounds({ height, width });
          }}
        >
          <Board
            colors={colors}
            game={game}
            interactionLocked={isMoveInputLocked}
            layoutHeight={boardBounds.height}
            layoutWidth={boardBounds.width}
            onEdgePress={handleEdgePress}
          />
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            onPress={handleRestart}
            style={[styles.secondaryButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Restart</Text>
          </Pressable>
          <Pressable
            onPress={handleOpenSetup}
            style={[styles.primaryButton, { backgroundColor: colors.primaryAction }]}
          >
            <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>Settings</Text>
          </Pressable>
        </View>
      </View>
      <Modal
        animationType="fade"
        onRequestClose={() => {}}
        transparent
        visible={game.status === 'finished'}
      >
        <View style={styles.winnerModalBackdrop}>
          <View style={[styles.winnerModalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.winnerTitle, { color: colors.text }]}>{winnerLabel}</Text>
            <Text style={[styles.winnerSubtitle, { color: colors.mutedText }]}>All boxes are claimed.</Text>
            <Pressable
              onPress={() => setGame(createInitialGame(responsiveSettings))}
              style={[styles.winnerPrimaryButton, { backgroundColor: colors.primaryAction }]}
            >
                <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>New Game</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => setIsRestartConfirmOpen(false)}
        transparent
        visible={isRestartConfirmOpen}
      >
        <View style={styles.restartModalBackdrop}>
          <View style={[styles.restartModalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.restartTitle, { color: colors.text }]}>Restart game?</Text>
            <Text style={[styles.restartSubtitle, { color: colors.mutedText }]}>
              This clears the current board and scores.
            </Text>
            <View style={styles.restartActionsRow}>
              <Pressable
                onPress={() => setIsRestartConfirmOpen(false)}
                style={[styles.restartCancelButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={[styles.restartCancelButtonText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmRestart}
                style={[styles.restartConfirmButton, { backgroundColor: colors.primaryAction }]}
              >
                <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>Restart</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="none"
        onRequestClose={closeSetup}
        transparent
        visible={isSetupOpen}
      >
        <Pressable onPress={closeSetup} style={styles.backdrop} />
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.background },
            {
              maxHeight: windowHeight * 0.88,
              paddingBottom: insets.bottom,
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <View {...sheetPanResponder.panHandlers} style={styles.sheetHandleTouchArea}>
            <View style={styles.sheetHandle} />
          </View>
          <ScrollView
            bounces={false}
            contentContainerStyle={[styles.setupContainer, { paddingBottom: insets.bottom + SPACING.lg }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <SetupForm
              colors={colors}
              settings={settings}
              onChange={handleSettingsChange}
              onRestartGame={handleRestart}
            />
          </ScrollView>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    height: '100%'
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  setupContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.24)',
  },
  gameRoot: {
    flex: 1,
    gap: SPACING.lg,
    minHeight: 0,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  boardSection: {
    alignItems: 'stretch',
    flex: 1,
    marginHorizontal: -SPACING.lg,
    minHeight: 0,
  },
  winnerModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.36)',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  winnerModalCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: SPACING.sm,
    maxWidth: 420,
    padding: SPACING.xl,
    width: '100%',
  },
  winnerPrimaryButton: {
    alignItems: 'center',
    backgroundColor: COLORS.text,
    borderRadius: 14,
    marginTop: SPACING.sm,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  restartModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.32)',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  restartModalCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: SPACING.sm,
    maxWidth: 420,
    padding: SPACING.lg,
    width: '100%',
  },
  restartTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  restartSubtitle: {
    color: COLORS.mutedText,
    fontSize: 14,
  },
  restartActionsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  restartCancelButton: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: SPACING.md,
  },
  restartCancelButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  restartConfirmButton: {
    alignItems: 'center',
    backgroundColor: COLORS.text,
    borderRadius: 12,
    flex: 1,
    paddingVertical: SPACING.md,
  },
  winnerTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
  },
  winnerSubtitle: {
    color: COLORS.mutedText,
    fontSize: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: COLORS.text,
    borderRadius: 14,
    flex: 1,
    paddingVertical: SPACING.md,
  },
  primaryButtonText: {
    color: COLORS.buttonText,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    paddingVertical: SPACING.md,
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: COLORS.border,
    borderRadius: 999,
    height: 5,
    width: 44,
  },
  sheetHandleTouchArea: {
    paddingVertical: SPACING.md,
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
