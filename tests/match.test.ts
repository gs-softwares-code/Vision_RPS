import { describe, it, expect } from 'vitest';
import { MatchEngine } from '../src/game/MatchEngine';
import { RandomOpponent } from '../src/game/ComputerOpponent';
import { GESTURES } from '../src/vision/GestureClassifier';
import type { Round } from '../src/game/GameEngine';

/** Deterministic opponent that always plays rock. */
function rockOpponent() {
  return new RandomOpponent({ random: () => 0 });
}

function makeEngine(mode: 'classic' | 'bestOf3' | 'bestOf5' | 'survival' | 'practice') {
  return new MatchEngine({ mode, opponent: rockOpponent() });
}

function playFixedRound(e: MatchEngine, player: string): Round {
  expect(e.canLock).toBe(true);
  e.lock(player as never);
  expect(e.state).toBe('MOVE_LOCKED');
  const round = e.shoot();
  expect(['win', 'lose', 'draw']).toContain(round.result);
  return round;
}

describe('MatchEngine — state machine', () => {
  it('walks the full lifecycle', () => {
    const e = new MatchEngine({ mode: 'classic' });
    expect(e.state).toBe('IDLE');
    e.start();
    expect(e.state).toBe('WAITING_FOR_GESTURE');
    playFixedRound(e, GESTURES.ROCK);
    expect(e.state).toBe('ROUND_COMPLETE');
    e.next();
    expect(e.state).toBe('WAITING_FOR_GESTURE');
  });

  it('blocks a second lock before next()', () => {
    const e = new MatchEngine({ mode: 'classic' });
    e.start();
    playFixedRound(e, GESTURES.ROCK);
    expect(() => e.lock(GESTURES.PAPER)).toThrow();
    e.next();
    expect(e.canLock).toBe(true);
  });

  it('cannot shoot before lock', () => {
    const e = new MatchEngine({ mode: 'classic' });
    e.start();
    expect(() => e.shoot()).toThrow();
  });
});

describe('MatchEngine — best-of-3/5', () => {
  it('completes best-of-3 at two player wins', () => {
    const e = makeEngine('bestOf3');
    e.start();
    // Computer always plays rock; player plays paper twice to reach two wins.
    e.lock(GESTURES.PAPER); e.shoot(); e.next(); // paper vs rock = win
    e.lock(GESTURES.PAPER); e.shoot(); e.next(); // paper vs rock = win -> best-of-3 complete
    const o = e.outcome();
    expect(o.wins).toBe(2);
    expect(o.state).toBe('MATCH_COMPLETE');
    expect(o.complete).toBe(true);
    expect(o.playerWonMatch).toBe(true);
  });

  it('keeps playing best-of-5 until three wins', () => {
    const e = makeEngine('bestOf5');
    e.start();
    // Two wins should not yet finish best-of-5.
    e.lock(GESTURES.PAPER); e.shoot(); e.next();
    e.lock(GESTURES.PAPER); e.shoot(); e.next();
    expect(e.outcome().state).toBe('WAITING_FOR_GESTURE');
    // Third win finishes it.
    e.lock(GESTURES.PAPER); e.shoot(); e.next();
    expect(e.outcome().state).toBe('MATCH_COMPLETE');
  });
});

describe('MatchEngine — survival', () => {
  it('ends match on first loss', () => {
    const e = makeEngine('survival');
    e.start();
    // Computer always plays rock; scissors loses to rock.
    e.lock(GESTURES.SCISSORS);
    const round = e.shoot();
    expect(round.result).toBe('lose');
    e.next();
    expect(e.state).toBe('MATCH_COMPLETE');
    expect(e.outcome().playerWonMatch).toBe(false);
  });

  it('continues while player wins rounds', () => {
    const e = makeEngine('survival');
    e.start();
    // Rock vs rock = draw, then paper vs rock = win; survival continues.
    e.lock(GESTURES.ROCK); e.shoot(); e.next();
    e.lock(GESTURES.PAPER); e.shoot(); e.next();
    expect(e.state).toBe('WAITING_FOR_GESTURE');
  });
});

describe('MatchEngine — computer move fairness', () => {
  it('chooses opponent move only at shoot()', () => {
    const calls: string[] = [];
    const opponent = {
      name: 'spy',
      move: () => {
        calls.push('move');
        return GESTURES.ROCK;
      },
    };
    const e = new MatchEngine({ mode: 'classic', opponent });
    e.start();
    e.lock(GESTURES.PAPER);
    expect(calls).toHaveLength(0);
    e.shoot();
    expect(calls).toHaveLength(1);
  });
});
