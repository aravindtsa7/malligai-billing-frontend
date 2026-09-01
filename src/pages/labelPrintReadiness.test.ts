import { describe, expect, it, vi } from 'vitest';
import { createPrintReadinessTracker } from './labelPrintReadiness.ts';

describe('createPrintReadinessTracker', () => {
  it('settles true only after every expected copy reports valid (copies=3, staggered)', () => {
    const onSettle = vi.fn();
    const tracker = createPrintReadinessTracker(1, 3, onSettle);

    tracker.report(1, 0, true);
    expect(onSettle).not.toHaveBeenCalled();

    tracker.report(1, 1, true);
    expect(onSettle).not.toHaveBeenCalled();

    tracker.report(1, 2, true);
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenCalledWith(true);
  });

  it('settles true after a single copy reports valid (copies=1)', () => {
    const onSettle = vi.fn();
    const tracker = createPrintReadinessTracker(5, 1, onSettle);

    tracker.report(5, 0, true);

    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenCalledWith(true);
  });

  it('aborts (settles false) as soon as any copy reports invalid, without waiting for the rest', () => {
    const onSettle = vi.fn();
    const tracker = createPrintReadinessTracker(1, 3, onSettle);

    tracker.report(1, 0, true);
    tracker.report(1, 1, false);

    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenCalledWith(false);

    // A later report for the third copy must not flip or repeat the outcome.
    tracker.report(1, 2, true);
    expect(onSettle).toHaveBeenCalledTimes(1);
  });

  it('ignores a report from a stale (earlier) revision', () => {
    const onSettle = vi.fn();
    const tracker = createPrintReadinessTracker(2, 1, onSettle);

    tracker.report(1, 0, true); // stale revision — must not satisfy this attempt
    expect(onSettle).not.toHaveBeenCalled();
    expect(tracker.reportedCount).toBe(0);

    tracker.report(2, 0, true); // current revision — satisfies it
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenCalledWith(true);
  });

  it('ignores a duplicate report from the same copy index and does not double-count it', () => {
    const onSettle = vi.fn();
    const tracker = createPrintReadinessTracker(1, 2, onSettle);

    tracker.report(1, 0, true);
    tracker.report(1, 0, true); // duplicate from copy 0 — must not count as copy 1
    expect(tracker.reportedCount).toBe(1);
    expect(onSettle).not.toHaveBeenCalled();

    tracker.report(1, 1, true);
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenCalledWith(true);
  });

  it('never calls onSettle more than once even if reports keep arriving after settling', () => {
    const onSettle = vi.fn();
    const tracker = createPrintReadinessTracker(1, 2, onSettle);

    tracker.report(1, 0, true);
    tracker.report(1, 1, true);
    expect(onSettle).toHaveBeenCalledTimes(1);

    tracker.report(1, 0, true);
    tracker.report(1, 1, false);
    expect(onSettle).toHaveBeenCalledTimes(1);
  });

  it('keeps expectedCount equal to actual copies, not four-up row count', () => {
    const onSettle = vi.fn();
    const tracker = createPrintReadinessTracker(9, 20, onSettle);

    for (let copyIndex = 0; copyIndex < 5; copyIndex += 1) {
      tracker.report(9, copyIndex, true);
    }
    expect(tracker.reportedCount).toBe(5);
    expect(onSettle).not.toHaveBeenCalled();

    for (let copyIndex = 5; copyIndex < 20; copyIndex += 1) {
      tracker.report(9, copyIndex, true);
    }
    expect(tracker.reportedCount).toBe(20);
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenCalledWith(true);
  });
});
