import {
  BoxKey,
  BoxState,
  EdgeKey,
  EdgeState,
  GameSettings,
  GameState,
  MoveResult,
  Orientation,
  ParsedEdgeKey,
  PlayerConfig,
  PlayerState,
} from './types';
import { PLAYER_COLOR_OPTIONS } from '../constants/playerColors';

export const DEFAULT_GRID = { rows: 6, cols: 6 };
export const PERIMETER_OWNER_ID = 'perimeter';

export const PLAYER_COLORS = [...PLAYER_COLOR_OPTIONS];

export function createDefaultPlayers(count = 2): PlayerConfig[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `player-${index + 1}`,
    name: `Player ${index + 1}`,
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
  }));
}

export function createInitialGame(settings: GameSettings): GameState {
  const players: PlayerState[] = settings.players.map((player) => ({
    ...player,
    score: 0,
  }));
  const edges: Partial<Record<EdgeKey, EdgeState>> = {};
  let moveCount = 0;

  if (settings.game.startWithSolidPerimeter) {
    const { cols, rows } = settings.grid;
    for (let col = 0; col < cols; col += 1) {
      const topKey = createEdgeKey('h', 0, col);
      moveCount += 1;
      edges[topKey] = {
        col,
        key: topKey,
        moveNumber: moveCount,
        orientation: 'h',
        ownerPlayerId: PERIMETER_OWNER_ID,
        row: 0,
      };
      const bottomKey = createEdgeKey('h', rows, col);
      moveCount += 1;
      edges[bottomKey] = {
        col,
        key: bottomKey,
        moveNumber: moveCount,
        orientation: 'h',
        ownerPlayerId: PERIMETER_OWNER_ID,
        row: rows,
      };
    }
    for (let row = 0; row < rows; row += 1) {
      const leftKey = createEdgeKey('v', row, 0);
      moveCount += 1;
      edges[leftKey] = {
        col: 0,
        key: leftKey,
        moveNumber: moveCount,
        orientation: 'v',
        ownerPlayerId: PERIMETER_OWNER_ID,
        row,
      };
      const rightKey = createEdgeKey('v', row, cols);
      moveCount += 1;
      edges[rightKey] = {
        col: cols,
        key: rightKey,
        moveNumber: moveCount,
        orientation: 'v',
        ownerPlayerId: PERIMETER_OWNER_ID,
        row,
      };
    }
  }

  return {
    grid: settings.grid,
    players,
    currentPlayerIndex: 0,
    edges,
    boxes: {},
    lastMoveByPlayerId: {},
    moveCount,
    status: 'playing',
    winner: null,
  };
}

export function createEdgeKey(
  orientation: Orientation,
  row: number,
  col: number,
): EdgeKey {
  return `${orientation}-${row}-${col}`;
}

export function createBoxKey(row: number, col: number): BoxKey {
  return `b-${row}-${col}`;
}

export function parseEdgeKey(edgeKey: EdgeKey): ParsedEdgeKey {
  const [orientation, row, col] = edgeKey.split('-');

  return {
    orientation: orientation as Orientation,
    row: Number(row),
    col: Number(col),
  };
}

export function isEdgeWithinBounds(state: GameState, edgeKey: EdgeKey): boolean {
  const { orientation, row, col } = parseEdgeKey(edgeKey);
  const { rows, cols } = state.grid;

  if (orientation === 'h') {
    return row >= 0 && row <= rows && col >= 0 && col < cols;
  }

  return row >= 0 && row < rows && col >= 0 && col <= cols;
}

function getAdjacentBoxes(state: GameState, edgeKey: EdgeKey): Array<{ row: number; col: number }> {
  const { orientation, row, col } = parseEdgeKey(edgeKey);
  const { rows, cols } = state.grid;
  const boxes: Array<{ row: number; col: number }> = [];

  if (orientation === 'h') {
    if (row > 0) {
      boxes.push({ row: row - 1, col });
    }

    if (row < rows) {
      boxes.push({ row, col });
    }
  } else {
    if (col > 0) {
      boxes.push({ row, col: col - 1 });
    }

    if (col < cols) {
      boxes.push({ row, col });
    }
  }

  return boxes;
}

function getBoxEdges(row: number, col: number): EdgeKey[] {
  return [
    createEdgeKey('h', row, col),
    createEdgeKey('h', row + 1, col),
    createEdgeKey('v', row, col),
    createEdgeKey('v', row, col + 1),
  ];
}

function isBoxClosed(state: GameState, row: number, col: number): boolean {
  return getBoxEdges(row, col).every((edgeKey) => Boolean(state.edges[edgeKey]));
}

function determineWinner(players: PlayerState[]) {
  const highScore = Math.max(...players.map((player) => player.score));
  const winners = players.filter((player) => player.score === highScore);

  return {
    playerIds: winners.map((player) => player.id),
    score: highScore,
  };
}

function clonePlayers(players: PlayerState[]): PlayerState[] {
  return players.map((player) => ({ ...player }));
}

export function applyMove(previousState: GameState, edgeKey: EdgeKey): MoveResult {
  if (
    previousState.status !== 'playing' ||
    previousState.edges[edgeKey] ||
    !isEdgeWithinBounds(previousState, edgeKey)
  ) {
    return {
      state: previousState,
      claimedBoxes: [],
      nextPlayerId: previousState.players[previousState.currentPlayerIndex].id,
      wasValidMove: false,
    };
  }

  const players = clonePlayers(previousState.players);
  const currentPlayer = players[previousState.currentPlayerIndex];
  const parsed = parseEdgeKey(edgeKey);
  const moveNumber = previousState.moveCount + 1;
  const edgeState: EdgeState = {
    key: edgeKey,
    orientation: parsed.orientation,
    row: parsed.row,
    col: parsed.col,
    ownerPlayerId: currentPlayer.id,
    moveNumber,
  };

  const nextState: GameState = {
    ...previousState,
    players,
    edges: {
      ...previousState.edges,
      [edgeKey]: edgeState,
    },
    lastMoveByPlayerId: {
      ...previousState.lastMoveByPlayerId,
      [currentPlayer.id]: edgeKey,
    },
    moveCount: moveNumber,
  };

  const claimedBoxes = getAdjacentBoxes(nextState, edgeKey)
    .filter(({ row, col }) => !nextState.boxes[createBoxKey(row, col)] && isBoxClosed(nextState, row, col))
    .map(({ row, col }) => ({
      key: createBoxKey(row, col),
      row,
      col,
      ownerPlayerId: currentPlayer.id,
    }));

  if (claimedBoxes.length > 0) {
    const claimedBoxEntries = Object.fromEntries(
      claimedBoxes.map((box) => [box.key, box]),
    ) as Partial<Record<BoxKey, BoxState>>;

    nextState.boxes = {
      ...nextState.boxes,
      ...claimedBoxEntries,
    };

    currentPlayer.score += claimedBoxes.length;
  } else {
    nextState.currentPlayerIndex =
      (previousState.currentPlayerIndex + 1) % previousState.players.length;
  }

  const totalBoxes = previousState.grid.rows * previousState.grid.cols;

  if (Object.keys(nextState.boxes).length === totalBoxes) {
    nextState.status = 'finished';
    nextState.winner = determineWinner(nextState.players);
  }

  return {
    state: nextState,
    claimedBoxes,
    nextPlayerId: nextState.players[nextState.currentPlayerIndex].id,
    wasValidMove: true,
  };
}
