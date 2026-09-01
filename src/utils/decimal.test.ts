import { describe, expect, it } from 'vitest';
import {
  formatQuantity,
  getLocalCalendarDate,
  getLocalDayBoundaryIsoRange,
} from './decimal.ts';

describe('formatQuantity', () => {
  it.each([
    ['97.000', '97'],
    ['1.000', '1'],
    ['2.000', '2'],
    ['448.000', '448'],
    ['2.500', '2.5'],
    ['1.250', '1.25'],
    ['0.750', '0.75'],
    ['0.125', '0.125'],
    ['0.000', '0'],
    ['10', '10'],
  ])('formats string %s as %s', (input, expected) => {
    expect(formatQuantity(input)).toBe(expected);
  });

  it.each([
    [97, '97'],
    [2.5, '2.5'],
    [0, '0'],
  ])('formats number %s as %s', (input, expected) => {
    expect(formatQuantity(input)).toBe(expected);
  });

  it.each([
    [undefined, '0'],
    [null, '0'],
    ['', '0'],
  ])('formats invalid/empty input %s as "0" without showing NaN', (input, expected) => {
    expect(formatQuantity(input)).toBe(expected);
  });

  it('never mutates the underlying precision beyond display', () => {
    expect(formatQuantity('97.000')).not.toContain('.000');
    expect(formatQuantity('0.125')).toBe('0.125');
  });
});

describe('getLocalCalendarDate', () => {
  it('formats local calendar date YYYY-MM-DD from given Date object', () => {
    // 2026-09-02
    const d1 = new Date(2026, 8, 2, 2, 30, 0); // 2:30 AM local time
    expect(getLocalCalendarDate(d1)).toBe('2026-09-02');

    // 2026-01-05 with zero padding
    const d2 = new Date(2026, 0, 5, 23, 45, 0);
    expect(getLocalCalendarDate(d2)).toBe('2026-01-05');

    // 2026-12-31
    const d3 = new Date(2026, 11, 31, 0, 0, 0);
    expect(getLocalCalendarDate(d3)).toBe('2026-12-31');
  });

  it('returns valid YYYY-MM-DD format for current date by default', () => {
    const todayStr = getLocalCalendarDate();
    expect(todayStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getLocalDayBoundaryIsoRange', () => {
  it('generates local 00:00:00.000 start and 23:59:59.999 end serialized to valid ISO datetime strings', () => {
    // Local date: 2026-09-01 (Month index 8 in JS Date)
    const fixedNow = new Date(2026, 8, 1, 14, 30, 0); // 2:30 PM local
    const { startDate, endDate } = getLocalDayBoundaryIsoRange(fixedNow);

    // Verify ISO string format
    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    // Parse back to Date objects and check local fields
    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);

    expect(parsedStart.getFullYear()).toBe(2026);
    expect(parsedStart.getMonth()).toBe(8);
    expect(parsedStart.getDate()).toBe(1);
    expect(parsedStart.getHours()).toBe(0);
    expect(parsedStart.getMinutes()).toBe(0);
    expect(parsedStart.getSeconds()).toBe(0);
    expect(parsedStart.getMilliseconds()).toBe(0);

    expect(parsedEnd.getFullYear()).toBe(2026);
    expect(parsedEnd.getMonth()).toBe(8);
    expect(parsedEnd.getDate()).toBe(1);
    expect(parsedEnd.getHours()).toBe(23);
    expect(parsedEnd.getMinutes()).toBe(59);
    expect(parsedEnd.getSeconds()).toBe(59);
    expect(parsedEnd.getMilliseconds()).toBe(999);
  });

  it('works with default parameter using current time', () => {
    const { startDate, endDate } = getLocalDayBoundaryIsoRange();
    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(new Date(startDate).getTime()).toBeLessThan(new Date(endDate).getTime());
  });
});
