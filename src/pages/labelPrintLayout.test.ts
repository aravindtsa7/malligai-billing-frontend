import { describe, expect, it } from 'vitest';
import {
  LABELS_PER_ROW,
  LABEL_HEIGHT_MM,
  LABEL_MEDIA_ROW_HEIGHT_MM,
  LABEL_MEDIA_WIDTH_MM,
  LABEL_WIDTH_MM,
  createLabelPrintRows,
  formatPackedMonthYear,
} from './labelPrintLayout.ts';

describe('25mm four-up label print layout', () => {
  it('formats a date-only packed date as MM/YY without Date conversion', () => {
    expect(formatPackedMonthYear('2026-09-01')).toBe('09/26');
  });

  it('uses four fixed 25mm labels in one 100mm x 25mm media row', () => {
    expect(LABEL_WIDTH_MM).toBe(25);
    expect(LABEL_HEIGHT_MM).toBe(25);
    expect(LABELS_PER_ROW).toBe(4);
    expect(LABEL_MEDIA_WIDTH_MM).toBe(100);
    expect(LABEL_MEDIA_ROW_HEIGHT_MM).toBe(25);
  });

  it.each([
    { copies: 1, expectedRows: 1, expectedLabels: 1, expectedPlaceholders: 3 },
    { copies: 2, expectedRows: 1, expectedLabels: 2, expectedPlaceholders: 2 },
    { copies: 4, expectedRows: 1, expectedLabels: 4, expectedPlaceholders: 0 },
    { copies: 5, expectedRows: 2, expectedLabels: 5, expectedPlaceholders: 3 },
    { copies: 20, expectedRows: 5, expectedLabels: 20, expectedPlaceholders: 0 },
  ])('chunks $copies copies into $expectedRows physical rows', ({
    copies,
    expectedRows,
    expectedLabels,
    expectedPlaceholders,
  }) => {
    const rows = createLabelPrintRows(copies);
    const slots = rows.flat();

    expect(rows).toHaveLength(expectedRows);
    expect(rows.every((row) => row.length === LABELS_PER_ROW)).toBe(true);
    expect(slots.filter((copyIndex) => copyIndex != null)).toHaveLength(expectedLabels);
    expect(slots.filter((copyIndex) => copyIndex == null)).toHaveLength(expectedPlaceholders);
  });

  it('does not create a trailing logical row after a complete final row', () => {
    expect(createLabelPrintRows(4)).toEqual([[0, 1, 2, 3]]);
    expect(createLabelPrintRows(20)).toHaveLength(5);
  });
});
