import { describe, expect, it } from 'vitest';
import { formatQuantity } from './decimal.ts';

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
