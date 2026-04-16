import test from 'node:test';
import assert from 'node:assert/strict';

import { applyMove, createDefaultPlayers, createEdgeKey, createInitialGame } from './engine';

test('rejects duplicate edge claims', () => {
  const game = createInitialGame({
    game: { startWithSolidPerimeter: false },
    grid: { rows: 2, cols: 2 },
    players: createDefaultPlayers(2),
  });

  const firstMove = applyMove(game, createEdgeKey('h', 0, 0));
  const secondMove = applyMove(firstMove.state, createEdgeKey('h', 0, 0));

  assert.equal(firstMove.wasValidMove, true);
  assert.equal(secondMove.wasValidMove, false);
  assert.equal(Object.keys(secondMove.state.edges).length, 1);
});

test('closing a box scores and keeps the turn', () => {
  const startingGame = createInitialGame({
    game: { startWithSolidPerimeter: false },
    grid: { rows: 1, cols: 1 },
    players: createDefaultPlayers(2),
  });

  const first = applyMove(startingGame, createEdgeKey('h', 0, 0)).state;
  const second = applyMove(first, createEdgeKey('v', 0, 0)).state;
  const third = applyMove(second, createEdgeKey('h', 1, 0)).state;
  const finalMove = applyMove(third, createEdgeKey('v', 0, 1));

  assert.equal(finalMove.claimedBoxes.length, 1);
  assert.equal(finalMove.state.players[1].score, 1);
  assert.equal(finalMove.state.currentPlayerIndex, 1);
  assert.equal(finalMove.state.status, 'finished');
  assert.deepEqual(finalMove.state.winner?.playerIds, ['player-2']);
});

test('turn advances when no box is closed', () => {
  const game = createInitialGame({
    game: { startWithSolidPerimeter: false },
    grid: { rows: 2, cols: 2 },
    players: createDefaultPlayers(3),
  });

  const move = applyMove(game, createEdgeKey('h', 0, 0));

  assert.equal(move.state.currentPlayerIndex, 1);
  assert.equal(move.nextPlayerId, 'player-2');
  assert.equal(move.claimedBoxes.length, 0);
});

test('tracks each players most recent move independently', () => {
  const game = createInitialGame({
    game: { startWithSolidPerimeter: false },
    grid: { rows: 2, cols: 2 },
    players: createDefaultPlayers(2),
  });

  const first = applyMove(game, createEdgeKey('h', 0, 0)).state;
  const second = applyMove(first, createEdgeKey('v', 0, 0)).state;
  const third = applyMove(second, createEdgeKey('h', 1, 0)).state;

  assert.equal(third.lastMoveByPlayerId['player-1'], createEdgeKey('h', 1, 0));
  assert.equal(third.lastMoveByPlayerId['player-2'], createEdgeKey('v', 0, 0));
});
