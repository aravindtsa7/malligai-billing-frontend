// Pure bookkeeping for the print-attempt readiness handshake. Extracted from
// LabelPrintingPage so the aggregation contract (revision scoping, duplicate-report
// rejection, fail-fast on any invalid copy) can be unit-tested independent of React's
// effect-flush timing, which cannot be staggered deterministically from a test.
export interface PrintReadinessTracker {
  readonly revision: number;
  readonly reportedCount: number;
  report(reportRevision: number, copyIndex: number, isValid: boolean): void;
}

export function createPrintReadinessTracker(
  revision: number,
  expectedCount: number,
  onSettle: (allValid: boolean) => void,
): PrintReadinessTracker {
  const reported = new Set<number>();
  let settled = false;

  return {
    revision,
    get reportedCount() {
      return reported.size;
    },
    report(reportRevision: number, copyIndex: number, isValid: boolean): void {
      if (settled) return;
      if (reportRevision !== revision) return; // stale attempt — cannot satisfy this one
      if (reported.has(copyIndex)) return; // duplicate report from the same copy — ignore

      reported.add(copyIndex);

      if (!isValid) {
        settled = true;
        onSettle(false);
        return;
      }
      if (reported.size >= expectedCount) {
        settled = true;
        onSettle(true);
      }
    },
  };
}
