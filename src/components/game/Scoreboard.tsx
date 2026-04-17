import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { SPACING, ThemeColors } from '../../constants/theme';
import { getPlayerGradientColors, isRainbowColor } from '../../constants/playerColors';
import { GameState } from '../../game/types';

interface ScoreboardProps {
  game: GameState;
  colors: ThemeColors;
}

export function Scoreboard({ game, colors }: ScoreboardProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      {game.players.map((player, index) => {
        const isActive = game.status === 'playing' && index === game.currentPlayerIndex;
        const isWinner = Boolean(game.winner?.playerIds.includes(player.id));

        return (
          <PlayerRow
            key={player.id}
            playerName={player.name}
            playerColor={player.color}
            score={player.score}
            isActive={isActive}
            isWinner={isWinner}
            colors={colors}
          />
        );
      })}
    </View>
  );
}

interface PlayerRowProps {
  playerName: string;
  playerColor: string;
  score: number;
  isActive: boolean;
  isWinner: boolean;
  colors: ThemeColors;
}

function PlayerRow({ playerName, playerColor, score, isActive, isWinner, colors }: PlayerRowProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const cardScale = useRef(new Animated.Value(1)).current;
  const scoreScale = useRef(new Animated.Value(1)).current;
  const previousScore = useRef(score);

  useEffect(() => {
    if (!isActive) {
      cardScale.stopAnimation();
      Animated.spring(cardScale, {
        damping: 15,
        mass: 0.5,
        stiffness: 240,
        toValue: 1,
        useNativeDriver: true,
      }).start();
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(cardScale, {
          duration: 420,
          toValue: 1.02,
          useNativeDriver: true,
        }),
        Animated.timing(cardScale, {
          duration: 420,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => {
      loop.stop();
      cardScale.stopAnimation();
    };
  }, [cardScale, isActive]);

  useEffect(() => {
    if (score <= previousScore.current) {
      previousScore.current = score;
      return;
    }

    previousScore.current = score;
    scoreScale.setValue(0.86);
    Animated.spring(scoreScale, {
      damping: 9,
      mass: 0.45,
      stiffness: 280,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [score, scoreScale]);

  return (
    <Animated.View
      style={[
        styles.playerCard,
        isActive && styles.activeCard,
        isWinner && styles.winnerCard,
        { transform: [{ scale: cardScale }] },
      ]}
    >
      {isRainbowColor(playerColor) ? (
        <LinearGradient
          colors={getPlayerGradientColors(playerColor)}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.playerMarker}
        />
      ) : (
        <View style={[styles.playerMarker, { backgroundColor: playerColor }]} />
      )}
      <View style={styles.playerTextGroup}>
        <Text style={styles.playerName}>{playerName}</Text>
        <Animated.Text style={[styles.playerMeta, { transform: [{ scale: scoreScale }] }]}>
          {score} point{score === 1 ? '' : 's'}
        </Animated.Text>
      </View>
      <Text style={styles.statusText}>{isWinner ? 'Winner' : isActive ? 'Your Turn' : 'Waiting'}</Text>
    </Animated.View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    gap: SPACING.sm,
  },
  playerCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  activeCard: {
    borderColor: colors.text,
    borderWidth: 2,
  },
  winnerCard: {
    backgroundColor: colors.winnerSurface,
  },
  playerMarker: {
    borderRadius: 999,
    height: 14,
    width: 14,
  },
  playerTextGroup: {
    flex: 1,
  },
  playerName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  playerMeta: {
    color: colors.mutedText,
    fontSize: 14,
    marginTop: 2,
  },
  statusText: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
