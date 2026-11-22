import { describe, it, expect } from 'vitest';
import {
  RandomOpponent,
  AdaptiveOpponent,
  PredictiveOpponent,
  ChallengeOpponent,
  counterTo,
  createOpponent,
  COMPUTER_MOVES,
} from '../src/game/ComputerOpponent';
import { GESTURES } from '../src/vision/GestureClassifier';

const seeded = (seq: number[]) => {
  let i = 0;
  return () => seq[i++ % seq.length];
};

describe('counterTo', () => {
  it('beats each move', () => {
    expect(counterTo(GESTURES.ROCK)).toBe(GESTURES.PAPER);
    expect(counterTo(GESTURES.PAPER)).toBe(GESTURES.SCISSORS);
    expect(counterTo(GESTURES.SCISSORS)).toBe(GESTURES.ROCK);
  });
});

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
      expect(COMPUTER_MOVES).toContain(opp.move());
    }
  });

  it('is labeled as non-adaptive (fair)', () => {
    const opp = new RandomOpponent();
    expect(opp.name).toBe('Random');
    expect((opp as { isAdaptive?: boolean }).isAdaptive).toBeUndefined();
  });
});

describe('AdaptiveOpponent', () => {
  it('counters the most frequent observed move', () => {
    const opp = new AdaptiveOpponent({ random: seeded([0.5, 0.5]) });
    // player plays rock a lot
    opp.observe(GESTURES.ROCK);
    opp.observe(GESTURES.ROCK);
    opp.observe(GESTURES.ROCK);
    expect(opp.move()).toBe(GESTURES.PAPER); // counter to rock
  });

  it('random before any data', () => {
    const opp = new AdaptiveOpponent({ random: seeded([0]) });
    const mv = opp.move();
    expect(COMPUTER_MOVES).toContain(mv);
  });
});

describe('PredictiveOpponent', () => {
  it('counters predicted next move from transition history', () => {
    const opp = new PredictiveOpponent({ random: seeded([0.5]) });
    // sequence: rock -> paper -> rock -> paper
    opp.observe(GESTURES.ROCK);
    opp.observe(GESTURES.PAPER);
    opp.observe(GESTURES.ROCK);
    opp.observe(GESTURES.PAPER);
    // now last=paper; after paper the player chose rock (2x); predict rock -> counter = paper
    expect(opp.move()).toBe(GESTURES.PAPER);
  });

  it('falls back to random without history', () => {
    const opp = new PredictiveOpponent({ random: seeded([0.9]) });
    expect(COMPUTER_MOVES).toContain(opp.move());
  });
});

describe('ChallengeOpponent', () => {
  it('respects difficulty counter ratio (easy ~ low counter)', () => {
    const opp = new ChallengeOpponent({ random: seeded([0.1, 0.1, 0.1]), difficulty: 'easy' });
    // ratio 0.2; random 0.1 < 0.2 => counter branch
    const mv = opp.move();
    expect(COMPUTER_MOVES).toContain(mv);
    expect(opp.counterRatio).toBe(0.2);
  });

  it('is labeled adaptive', () => {
    expect(new ChallengeOpponent({ difficulty: 'hard' }).isAdaptive).toBe(true);
  });
});

describe('createOpponent factory', () => {
  it('maps kinds to implementations', () => {
    expect(createOpponent('random') instanceof RandomOpponent).toBe(true);
    expect(createOpponent('adaptive') instanceof AdaptiveOpponent).toBe(true);
    expect(createOpponent('predictive') instanceof PredictiveOpponent).toBe(true);
    expect(createOpponent('challenge') instanceof ChallengeOpponent).toBe(true);
  });
});
