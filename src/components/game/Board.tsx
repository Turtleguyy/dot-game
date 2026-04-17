import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Animated,
  GestureResponderEvent,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { BOARD, ThemeColors } from '../../constants/theme';
import {
  getPlayerBaseColor,
  getPlayerGradientColors,
  isRainbowColor,
} from '../../constants/playerColors';
import { EdgeKey, GameState } from '../../game/types';
import { PERIMETER_OWNER_ID, createBoxKey, createEdgeKey, parseEdgeKey } from '../../game/engine';

interface BoardProps {
  game: GameState;
  onEdgePress: (edgeKey: EdgeKey) => void;
  interactionLocked?: boolean;
  colors: ThemeColors;
  /** Measured width of the board slot (e.g. from onLayout). Falls back to window width until set. */
  layoutWidth: number;
  /** Measured height of the board slot; when > 0, cell size is capped so the grid fits vertically. */
  layoutHeight: number;
}

function toPastLineColor(color: string, fallback: string): string {
  const hex = getPlayerBaseColor(color).replace('#', '');
  const normalizedHex =
    hex.length === 3
      ? hex
          .split('')
          .map((value) => `${value}${value}`)
          .join('')
      : hex;

  if (!/^[\da-fA-F]{6}$/.test(normalizedHex)) {
    return fallback;
  }

  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, 0.35)`;
}

function getBoardMetrics(game: GameState, availableWidth: number, availableHeight: number) {
  const { rows, cols } = game.grid;
  const widthReserve = BOARD.framePadding * 2 + BOARD.gridInsetHorizontal * 2;
  const heightReserve = BOARD.framePadding * 2 + BOARD.gridInsetVertical * 2;
  const usableWidth = Math.max(0, availableWidth - widthReserve);
  const cellSizeFromWidth = cols > 0 ? (usableWidth - BOARD.dotSize) / cols : 0;
  let cellSize = cellSizeFromWidth;

  if (availableHeight > 0 && rows > 0) {
    const usableHeight = Math.max(0, availableHeight - heightReserve);
    const cellSizeFromHeight = (usableHeight - BOARD.dotSize) / rows;
    cellSize = Math.min(cellSizeFromWidth, cellSizeFromHeight);
  }

  const padding = BOARD.framePadding + BOARD.dotSize / 2;
  const gridWidth = cols * cellSize + BOARD.dotSize + BOARD.framePadding * 2;
  const gridHeight = rows * cellSize + BOARD.dotSize + BOARD.framePadding * 2;

  return { cellSize, gridHeight, gridWidth, padding };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function distanceToHorizontalSegment(
  px: number,
  py: number,
  y0: number,
  x0: number,
  x1: number,
): number {
  const cx = clamp(px, x0, x1);
  return Math.hypot(px - cx, py - y0);
}

function distanceToVerticalSegment(
  px: number,
  py: number,
  x0: number,
  y0: number,
  y1: number,
): number {
  const cy = clamp(py, y0, y1);
  return Math.hypot(px - x0, py - cy);
}

function findClosestUnclaimedEdge(
  px: number,
  py: number,
  game: GameState,
  cellSize: number,
  padding: number,
): EdgeKey | null {
  const { rows, cols } = game.grid;
  const maxD = BOARD.lineTouchThickness * 0.85;
  let bestKey: EdgeKey | null = null;
  let bestD = Infinity;

  for (let row = 0; row <= rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const key = createEdgeKey('h', row, col);
      if (game.edges[key]) {
        continue;
      }
      const y0 = padding + row * cellSize;
      const x0 = padding + col * cellSize;
      const x1 = padding + (col + 1) * cellSize;
      const d = distanceToHorizontalSegment(px, py, y0, x0, x1);
      if (d < bestD && d <= maxD) {
        bestD = d;
        bestKey = key;
      }
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col <= cols; col += 1) {
      const key = createEdgeKey('v', row, col);
      if (game.edges[key]) {
        continue;
      }
      const x0 = padding + col * cellSize;
      const y0 = padding + row * cellSize;
      const y1 = padding + (row + 1) * cellSize;
      const d = distanceToVerticalSegment(px, py, x0, y0, y1);
      if (d < bestD && d <= maxD) {
        bestD = d;
        bestKey = key;
      }
    }
  }

  return bestKey;
}

export function Board({
  game,
  onEdgePress,
  interactionLocked = false,
  colors,
  layoutWidth,
  layoutHeight,
}: BoardProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const widthForMetrics = layoutWidth > 0 ? layoutWidth : windowWidth;
  /** Until the parent measures the flex slot, avoid a one-frame overflow from width-only cell size. */
  const heightForMetrics =
    layoutHeight > 0
      ? layoutHeight
      : Math.max(180, windowHeight - 280 - BOARD.gridInsetVertical * 2);
  const { rows, cols } = game.grid;
  const { cellSize, gridHeight, gridWidth, padding } = getBoardMetrics(
    game,
    widthForMetrics,
    heightForMetrics,
  );
  const edgeAnimations = useRef<Record<string, Animated.Value>>({});
  const boxAnimations = useRef<Record<string, Animated.Value>>({});
  const dotPulseAnimations = useRef<Record<string, Animated.Value>>({});
  const dotPulseColors = useRef<Record<string, string>>({});
  const previousEdgeKeys = useRef<Set<string>>(new Set());
  const previousBoxKeys = useRef<Set<string>>(new Set());
  const [previewEdgeKey, setPreviewEdgeKey] = useState<EdgeKey | null>(null);

  const updatePreview = useCallback(
    (evt: GestureResponderEvent) => {
      if (game.status !== 'playing') {
        setPreviewEdgeKey(null);
        return;
      }
      if (interactionLocked) {
        setPreviewEdgeKey(null);
        return;
      }
      const { locationX, locationY } = evt.nativeEvent;
      const key = findClosestUnclaimedEdge(locationX, locationY, game, cellSize, padding);
      setPreviewEdgeKey(key);
    },
    [cellSize, game, interactionLocked, padding],
  );

  const handleTouchEnd = useCallback(
    (evt: GestureResponderEvent) => {
      if (game.status !== 'playing') {
        setPreviewEdgeKey(null);
        return;
      }
      if (interactionLocked) {
        setPreviewEdgeKey(null);
        return;
      }
      const { locationX, locationY } = evt.nativeEvent;
      const key = findClosestUnclaimedEdge(locationX, locationY, game, cellSize, padding);
      setPreviewEdgeKey(null);
      if (key && !game.edges[key]) {
        onEdgePress(key);
      }
    },
    [cellSize, game, interactionLocked, onEdgePress, padding],
  );

  useEffect(() => {
    if (game.status !== 'playing' || interactionLocked) {
      setPreviewEdgeKey(null);
    }
  }, [game.status, interactionLocked]);

  useEffect(() => {
    const edgeKeys = Object.keys(game.edges);

    const runDotPulse = (dotRow: number, dotCol: number, color: string) => {
      const dotKey = `${dotRow}-${dotCol}`;
      const dotAnimation =
        dotPulseAnimations.current[dotKey] ?? (dotPulseAnimations.current[dotKey] = new Animated.Value(0));
      dotPulseColors.current[dotKey] = color;
      dotAnimation.stopAnimation();
      dotAnimation.setValue(0);
      Animated.sequence([
        Animated.timing(dotAnimation, {
          duration: 90,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(dotAnimation, {
          duration: 180,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
    };

    edgeKeys.forEach((edgeKey) => {
      if (previousEdgeKeys.current.has(edgeKey)) {
        return;
      }

      const animatedValue = new Animated.Value(0);
      edgeAnimations.current[edgeKey] = animatedValue;

      Animated.sequence([
        Animated.timing(animatedValue, {
          duration: 120,
          toValue: 0.82,
          useNativeDriver: true,
        }),
        Animated.spring(animatedValue, {
          damping: 9,
          mass: 0.45,
          stiffness: 260,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();

      const edge = game.edges[edgeKey as EdgeKey];
      const ownerColor =
        game.players.find((player) => player.id === edge?.ownerPlayerId)?.color ?? colors.text;
      const { col, orientation, row } = parseEdgeKey(edgeKey as EdgeKey);
      if (orientation === 'h') {
        runDotPulse(row, col, ownerColor);
        runDotPulse(row, col + 1, ownerColor);
      } else {
        runDotPulse(row, col, ownerColor);
        runDotPulse(row + 1, col, ownerColor);
      }
    });

    previousEdgeKeys.current = new Set(edgeKeys);
  }, [game.edges, game.players]);

  useEffect(() => {
    const boxKeys = Object.keys(game.boxes);

    boxKeys.forEach((boxKey) => {
      if (previousBoxKeys.current.has(boxKey)) {
        return;
      }

      const animatedValue = new Animated.Value(0);
      boxAnimations.current[boxKey] = animatedValue;

      Animated.spring(animatedValue, {
        damping: 14,
        mass: 0.6,
        stiffness: 220,
        toValue: 1,
        useNativeDriver: true,
      }).start();
    });

    previousBoxKeys.current = new Set(boxKeys);
  }, [game.boxes]);

  const activePlayer = game.players[game.currentPlayerIndex];
  const previewColor = activePlayer?.color ?? colors.inactiveLine;

  const renderColorFill = (
    color: string,
    alpha = 1,
    end: { x: number; y: number },
    start: { x: number; y: number },
  ) =>
    isRainbowColor(color) ? (
      <LinearGradient
        colors={getPlayerGradientColors(color, alpha)}
        end={end}
        start={start}
        style={styles.fill}
      />
    ) : (
      <View style={[styles.fill, { backgroundColor: alpha < 1 ? toPastLineColor(color, colors.inactiveLine) : color }]} />
    );

  return (
    <View style={styles.frame}>
      <View style={styles.boardBackground} />
      <View style={styles.gridCenter}>
        <View style={[styles.grid, { height: gridHeight, width: gridWidth }]}>
          <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {Array.from({ length: rows }).map((_, row) =>
        Array.from({ length: cols }).map((__, col) => {
          const key = createBoxKey(row, col);
          const box = game.boxes[key];
          const boxProgress =
            boxAnimations.current[key] ?? (boxAnimations.current[key] = new Animated.Value(1));

          if (!box) {
            return null;
          }

          return (
            <Animated.View
              key={key}
              style={[
                styles.box,
                {
                  height: cellSize,
                  left: padding + col * cellSize,
                  opacity: boxProgress,
                  transform: [
                    {
                      scale: boxProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.85, 1],
                      }),
                    },
                  ],
                  top: padding + row * cellSize,
                  width: cellSize,
                },
              ]}
            >
              {renderColorFill(
                game.players.find((currentPlayer) => currentPlayer.id === box.ownerPlayerId)?.color ??
                  colors.boardBackground,
                0.2,
                { x: 1, y: 1 },
                { x: 0, y: 0 },
              )}
            </Animated.View>
          );
        }),
      )}

      {Array.from({ length: rows + 1 }).map((_, row) =>
        Array.from({ length: cols }).map((__, col) => {
          const edgeKey = createEdgeKey('h', row, col);
          const edge = game.edges[edgeKey];
          const recentPlayerId = edge?.ownerPlayerId
            ? Object.keys(game.lastMoveByPlayerId).find(
                (playerId) => game.lastMoveByPlayerId[playerId] === edgeKey,
              )
            : undefined;
          const owner = edge ? game.players.find((player) => player.id === edge.ownerPlayerId) : null;
          const isRecent = Boolean(recentPlayerId && recentPlayerId === edge?.ownerPlayerId);
          const lineColor =
            edge?.ownerPlayerId === PERIMETER_OWNER_ID ? colors.text : (owner?.color ?? colors.inactiveLine);

          const edgeProgress =
            edgeAnimations.current[edgeKey] ?? (edgeAnimations.current[edgeKey] = new Animated.Value(1));
          const edgeScaleX = edgeProgress.interpolate({
            inputRange: [0, 0.82, 1],
            outputRange: [0.02, 1.08, 1],
          });
          const edgeOpacity = edgeProgress.interpolate({
            inputRange: [0, 0.12, 1],
            outputRange: [0, 0.9, 1],
          });

          return (
            <View
              key={edgeKey}
              style={[
                styles.horizontalTouchTarget,
                {
                  left: padding + col * cellSize,
                  top: padding + row * cellSize - BOARD.lineTouchThickness / 2,
                  width: cellSize,
                },
              ]}
            >
              {edge ? (
                <Animated.View
                    style={[
                      styles.horizontalLine,
                      {
                        backgroundColor: isRecent
                          ? 'transparent'
                          : 'transparent',
                        opacity: edgeOpacity,
                        transform: [{ scaleX: edgeScaleX }],
                        width: cellSize,
                      },
                    ]}
                  >
                    {renderColorFill(
                      lineColor,
                      isRecent ? 1 : 0.35,
                      { x: 1, y: 0 },
                      { x: 0, y: 0 },
                    )}
                  </Animated.View>
              ) : (
                <View style={[styles.horizontalPlaceholder, { opacity: 0.18, width: cellSize }]} />
              )}
            </View>
          );
        }),
      )}

      {Array.from({ length: rows }).map((_, row) =>
        Array.from({ length: cols + 1 }).map((__, col) => {
          const edgeKey = createEdgeKey('v', row, col);
          const edge = game.edges[edgeKey];
          const recentPlayerId = edge?.ownerPlayerId
            ? Object.keys(game.lastMoveByPlayerId).find(
                (playerId) => game.lastMoveByPlayerId[playerId] === edgeKey,
              )
            : undefined;
          const owner = edge ? game.players.find((player) => player.id === edge.ownerPlayerId) : null;
          const isRecent = Boolean(recentPlayerId && recentPlayerId === edge?.ownerPlayerId);
          const lineColor =
            edge?.ownerPlayerId === PERIMETER_OWNER_ID ? colors.text : (owner?.color ?? colors.inactiveLine);

          const edgeProgress =
            edgeAnimations.current[edgeKey] ?? (edgeAnimations.current[edgeKey] = new Animated.Value(1));
          const edgeScaleY = edgeProgress.interpolate({
            inputRange: [0, 0.82, 1],
            outputRange: [0.02, 1.08, 1],
          });
          const edgeOpacity = edgeProgress.interpolate({
            inputRange: [0, 0.12, 1],
            outputRange: [0, 0.9, 1],
          });

          return (
            <View
              key={edgeKey}
              style={[
                styles.verticalTouchTarget,
                {
                  height: cellSize,
                  left: padding + col * cellSize - BOARD.lineTouchThickness / 2,
                  top: padding + row * cellSize,
                },
              ]}
            >
              {edge ? (
                <Animated.View
                    style={[
                      styles.verticalLine,
                      {
                        backgroundColor: isRecent
                          ? 'transparent'
                          : 'transparent',
                        height: cellSize,
                        opacity: edgeOpacity,
                        transform: [{ scaleY: edgeScaleY }],
                      },
                    ]}
                  >
                    {renderColorFill(
                      lineColor,
                      isRecent ? 1 : 0.35,
                      { x: 0, y: 1 },
                      { x: 0, y: 0 },
                    )}
                  </Animated.View>
              ) : (
                <View style={[styles.verticalPlaceholder, { height: cellSize, opacity: 0.18 }]} />
              )}
            </View>
          );
        }),
      )}

            {previewEdgeKey
              ? (() => {
                  const { col, orientation, row } = parseEdgeKey(previewEdgeKey);
                  const previewDots =
                    orientation === 'h'
                      ? [
                          { col, row },
                          { col: col + 1, row },
                        ]
                      : [
                          { col, row },
                          { col, row: row + 1 },
                        ];

                  return previewDots.map((dot, index) => (
                    <View
                      key={`preview-dot-${index}`}
                      pointerEvents="none"
                      style={[
                        styles.previewDot,
                        {
                          left: padding + dot.col * cellSize - BOARD.dotSize / 2,
                          top: padding + dot.row * cellSize - BOARD.dotSize / 2,
                        },
                      ]}
                    >
                      {renderColorFill(previewColor, 1, { x: 1, y: 1 }, { x: 0, y: 0 })}
                    </View>
                  ));
                })()
              : null}

            {previewEdgeKey && !game.edges[previewEdgeKey]
              ? (() => {
                  const { col, orientation, row } = parseEdgeKey(previewEdgeKey);
                  if (orientation === 'h') {
                    return (
                      <View
                        pointerEvents="none"
                        style={[
                          styles.horizontalLine,
                          styles.previewLine,
                          {
                            left: padding + col * cellSize,
                            top: padding + row * cellSize - BOARD.lineThickness / 2,
                            width: cellSize,
                          },
                        ]}
                      >
                        {renderColorFill(previewColor, 1, { x: 1, y: 0 }, { x: 0, y: 0 })}
                      </View>
                    );
                  }
                  return (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.verticalLine,
                        styles.previewLine,
                        {
                          height: cellSize,
                          left: padding + col * cellSize - BOARD.lineThickness / 2,
                          top: padding + row * cellSize,
                        },
                      ]}
                    >
                      {renderColorFill(previewColor, 1, { x: 0, y: 1 }, { x: 0, y: 0 })}
                    </View>
                  );
                })()
              : null}

            {Array.from({ length: rows + 1 }).map((_, row) =>
              Array.from({ length: cols + 1 }).map((__, col) => {
                const dotKey = `${row}-${col}`;
                const dotPulse =
                  dotPulseAnimations.current[dotKey] ??
                  (dotPulseAnimations.current[dotKey] = new Animated.Value(0));
                const pulseScale = dotPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.9],
                });
                const pulseOpacity = dotPulse.interpolate({
                  inputRange: [0, 0.25, 1],
                  outputRange: [0, 0.55, 0],
                });
                const pulseColor = dotPulseColors.current[dotKey] ?? colors.text;

                return (
                  <View
                    key={`dot-${row}-${col}`}
                    style={[
                      styles.dot,
                      {
                        left: padding + col * cellSize - BOARD.dotSize / 2,
                        top: padding + row * cellSize - BOARD.dotSize / 2,
                      },
                    ]}
                  >
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.dotPulse,
                        {
                          borderColor: pulseColor,
                          opacity: pulseOpacity,
                          transform: [{ scale: pulseScale }],
                        },
                      ]}
                    />
                  </View>
                );
              }),
            )}
          </View>

          <View
            pointerEvents={game.status === 'playing' && !interactionLocked ? 'auto' : 'none'}
            style={[StyleSheet.absoluteFillObject, styles.touchLayer]}
            onMoveShouldSetResponder={() => game.status === 'playing' && !interactionLocked}
            onResponderGrant={updatePreview}
            onResponderMove={updatePreview}
            onResponderRelease={handleTouchEnd}
            onResponderTerminate={() => setPreviewEdgeKey(null)}
            onStartShouldSetResponder={() => game.status === 'playing' && !interactionLocked}
          />
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  frame: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    width: '100%',
  },
  boardBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface,
  },
  grid: {
    position: 'relative',
  },
  gridCenter: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 0,
    width: '100%',
  },
  box: {
    overflow: 'hidden',
    position: 'absolute',
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  dot: {
    backgroundColor: colors.dot,
    borderRadius: 999,
    height: BOARD.dotSize,
    justifyContent: 'center',
    overflow: 'visible',
    position: 'absolute',
    width: BOARD.dotSize,
    zIndex: 4,
  },
  dotPulse: {
    borderRadius: 999,
    borderWidth: 2,
    height: BOARD.dotSize,
    left: 0,
    position: 'absolute',
    top: 0,
    width: BOARD.dotSize,
  },
  previewDot: {
    borderRadius: 999,
    height: BOARD.dotSize,
    overflow: 'hidden',
    opacity: 0.75,
    position: 'absolute',
    transform: [{ scale: 1.35 }],
    width: BOARD.dotSize,
    zIndex: 5,
  },
  horizontalTouchTarget: {
    height: BOARD.lineTouchThickness,
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 2,
  },
  verticalTouchTarget: {
    justifyContent: 'center',
    position: 'absolute',
    width: BOARD.lineTouchThickness,
    zIndex: 2,
  },
  horizontalLine: {
    borderRadius: 999,
    height: BOARD.lineThickness,
    zIndex: 3,
  },
  verticalLine: {
    alignSelf: 'center',
    borderRadius: 999,
    width: BOARD.lineThickness,
    zIndex: 3,
  },
  horizontalPlaceholder: {
    alignSelf: 'center',
    borderRadius: 999,
    height: 4,
  },
  verticalPlaceholder: {
    alignSelf: 'center',
    borderRadius: 999,
    width: 4,
  },
  previewLine: {
    opacity: 0.52,
    position: 'absolute',
    zIndex: 3,
  },
  touchLayer: {
    zIndex: 20,
  },
});
