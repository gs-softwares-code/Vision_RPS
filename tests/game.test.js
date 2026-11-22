import { describe, it, expect } from 'vitest';
import { GameEngine, resolveRound, VALID_MOVES } from '../src/game/GameEngine';
import { RandomOpponent } from '../src/game/ComputerOpponent';
import { ScoreManager, RESULT } from '../src/game/ScoreManager';
import { GESTURES } from '../src/vision/GestureClassifier';

describe('resolveRound', () => {
  const ROCK = GESTURES.ROCK;
  const PAPER = GESTURES.PAPER;
  const SCISSORS = GESTURES.SCISSORS;

  it('player win combinations', () => {
    expect(resolveRound(ROCK, SCISSORS)).toBe('win');
    expect(resolveRound(PAPER, ROCK)).toBe('win');
    expect(resolveRound(SCISSORS, PAPER)).toBe('win');
  });

  it('player lose combinations', () => {
    expect(resolveRound(ROCK, PAPER)).toBe('lose');
    expect(resolveRound(PAPER, SCISSORS)).toBe('lose');
    expect(resolveRound(SCISSORS, ROCK)).toBe('lose');
  });

  it('draws', () => {
    expect(resolveRound(ROCK, ROCK)).toBe('draw');
    expect(resolveRound(PAPER, PAPER)).toBe('draw');
    expect(resolveRound(SCISSORS, SCISSORS)).toBe('draw');
  });

  it('rejects invalid input', () => {
    expect(resolveRound('nope', ROCK)).toBeNull();
    expect(resolveRound(ROCK, 'nope')).toBeNull();
    expect(resolveRound(null, ROCK)).toBeNull();
  });
});

const seeded = (seq) => {
  let i = 0;
  return () => seq[i++ % seq.length];
};

describe('RandomOpponent', () => {
  it('uses uniform distribution over all moves', () => {
    const opp = new RandomOpponent({ random: seeded([0, 0.34, 0.68, 0.999]) });
    const seen = new Set();
    for (let i = 0; i < 4; i += 1) seen.add(opp.move());
    expect(seen.size).toBe(3);
  });

  it('only returns valid moves', () => {
    const opp = new RandomOpponent();
    for (let i = 0; i < 50; i += 1) {
      expect(VALID_MOVES).toContain(opp.move());
    }
  });
});

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
  };
}

describe('ScoreManager', () => {
  it('records results and computes win percentage', () => {
    const s = new ScoreManager({ storage: memoryStorage() });
    s.record(RESULT.WIN);
    s.record(RESULT.LOSE);
    s.record(RESULT.DRAW);
    s.record(RESULT.WIN);
    const snap = s.snapshot();
    expect(snap.playerWins).toBe(2);
    expect(snap.computerWins).toBe(1);
    expect(snap.draws).toBe(1);
    expect(snap.totalRounds).toBe(4);
    expect(snap.winPercentage).toBe(50);
  });

  it('ignores invalid results', () => {
    const s = new ScoreManager({ storage: memoryStorage() });
    s.record('bogus');
    expect(s.snapshot().totalRounds).toBe(0);
  });

  it('persists and reloads', () => {
    const storage = memoryStorage();
    const a = new ScoreManager({ storage });
    a.record(RESULT.WIN);
    a.record(RESULT.WIN);
    const b = new ScoreManager({ storage });
    expect(b.snapshot().playerWins).toBe(2);
  });

  it('reset clears persisted state', () => {
    const storage = memoryStorage();
    const s = new ScoreManager({ storage });
    s.record(RESULT.WIN);
    s.resetPersisted();
    expect(s.snapshot().totalRounds).toBe(0);
    expect(new ScoreManager({ storage }).snapshot().totalRounds).toBe(0);
  });
});

describe('GameEngine', () => {
  function engineWithMoves(seq) {
    const opponent = new RandomOpponent({ random: seeded(seq) });
    return new GameEngine({ opponent, scores: new ScoreManager({ storage: memoryStorage() }) });
  }

  it('locks, shoots, and produces a round', () => {
    const e = engineWithMoves([0]);
    expect(e.canLock).toBe(true);
    e.lock(GESTURES.ROCK);
    expect(e.phase).toBe('countdown');
    expect(e.canLock).toBe(false);
    const round = e.shoot();
    expect(round.player).toBe(GESTURES.ROCK);
    expect(round.computer).toBe(GESTURES.ROCK);
    expect(round.result).toBe('draw');
    expect(e.phase).toBe('revealed');
    expect(e.scores.snapshot().draws).toBe(1);
    e.next();
    expect(e.phase).toBe('idle');
  });

  it('computer move is chosen only after player lock (fairness)', () => {
    const calls = [];
    const opponent = new RandomOpponent({ random: () => (calls.push('move'), 0.5) });
    const e = new GameEngine({ opponent, scores: new ScoreManager({ storage: memoryStorage() }) });
    e.lock(GESTURES.PAPER);
    expect(calls).toHaveLength(0); // no computer move before shoot()
    e.shoot();
    expect(calls).toHaveLength(1);
  });

  it('throws on invalid lock', () => {
    const e = engineWithMoves([0]);
    expect(() => e.lock('bogus')).toThrow();
    expect(() => e.lock(null)).toThrow();
  });

  it('throws when shooting without a lock', () => {
    const e = engineWithMoves([0]);
    expect(() => e.shoot()).toThrow();
  });

  it('throws when locking twice in a row', () => {
    const e = engineWithMoves([0]);
    e.lock(GESTURES.ROCK);
    expect(() => e.lock(GESTURES.PAPER)).toThrow();
  });

  it('tracks multiple rounds and score updates', () => {
    // random values map to moves: 0 → rock, 0.68 → scissors, 0.34 → paper
    const e = engineWithMoves([0, 0.68, 0.34]);
    e.lock(GESTURES.ROCK); // rock vs rock -> draw
    e.shoot();
    e.next();
    e.lock(GESTURES.ROCK); // rock vs scissors -> win
    e.shoot();
    e.next();
    e.lock(GESTURES.ROCK); // rock vs paper -> lose
    const round = e.shoot();
    expect(round.result).toBe('lose');
    const snap = e.scores.snapshot();
    expect(snap.draws).toBe(1);
    expect(snap.playerWins).toBe(1);
    expect(snap.computerWins).toBe(1);
    expect(e.rounds).toHaveLength(3);
  });

  it('reset clears everything', () => {
    const e = engineWithMoves([0]);
    e.lock(GESTURES.ROCK);
    e.shoot();
    e.reset();
    expect(e.rounds).toHaveLength(0);
    expect(e.roundNumber).toBe(0);
    expect(e.phase).toBe('idle');
    expect(e.scores.snapshot().totalRounds).toBe(0);
  });

  it('covers all game rule combinations end-to-end', () => {
    const seq = [0, 0.33, 0.67];
    for (const player of VALID_MOVES) {
      for (const computer of VALID_MOVES) {
        const e = engineWithMoves(seq.map(() => (VALID_MOVES.indexOf(computer) + 0.5) / 3));
        e.lock(player);
        const round = e.shoot();
        expect(round.computer).toBe(computer);
        expect(round.result).toBe(resolveRound(player, computer));
      }
    }
  });
});
