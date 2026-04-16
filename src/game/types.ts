export type Orientation = 'h' | 'v';

export type EdgeKey = `${Orientation}-${number}-${number}`;
export type BoxKey = `b-${number}-${number}`;
export type GameStatus = 'setup' | 'playing' | 'finished';

export interface GridSize {
  rows: number;
  cols: number;
}

export interface PlayerConfig {
  id: string;
  name: string;
  color: string;
}

export interface PlayerState extends PlayerConfig {
  score: number;
}

export interface EdgeState {
  key: EdgeKey;
  orientation: Orientation;
  row: number;
  col: number;
  ownerPlayerId: string;
  moveNumber: number;
}

export interface BoxState {
  key: BoxKey;
  row: number;
  col: number;
  ownerPlayerId: string;
}

export interface WinnerSummary {
  playerIds: string[];
  score: number;
}

export interface GameSettings {
  grid: GridSize;
  players: PlayerConfig[];
  game: {
    startWithSolidPerimeter: boolean;
  };
}

export interface GameState {
  grid: GridSize;
  players: PlayerState[];
  currentPlayerIndex: number;
  edges: Partial<Record<EdgeKey, EdgeState>>;
  boxes: Partial<Record<BoxKey, BoxState>>;
  lastMoveByPlayerId: Partial<Record<string, EdgeKey>>;
  moveCount: number;
  status: GameStatus;
  winner: WinnerSummary | null;
}

export interface ParsedEdgeKey {
  orientation: Orientation;
  row: number;
  col: number;
}

export interface MoveResult {
  state: GameState;
  claimedBoxes: BoxState[];
  nextPlayerId: string;
  wasValidMove: boolean;
}
