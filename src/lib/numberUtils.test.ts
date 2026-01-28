import { describe, it, expect } from 'vitest';
import { toNumberOrZero, safeDivide } from './numberUtils';

describe('toNumberOrZero', () => {
  it('returns 0 for undefined', () => {
    expect(toNumberOrZero(undefined)).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(toNumberOrZero(null)).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(toNumberOrZero('')).toBe(0);
  });

  it('returns 0 for whitespace string', () => {
    expect(toNumberOrZero('   ')).toBe(0);
  });

  it('returns 0 for non-numeric string', () => {
    expect(toNumberOrZero('abc')).toBe(0);
  });

  it('parses dot-decimal format correctly', () => {
    expect(toNumberOrZero('2.5')).toBe(2.5);
    expect(toNumberOrZero('1234.56')).toBe(1234.56);
  });

  it('parses comma-decimal format correctly (German)', () => {
    expect(toNumberOrZero('2,5')).toBe(2.5);
    expect(toNumberOrZero('1234,56')).toBe(1234.56);
  });

  it('returns the number for valid numbers', () => {
    expect(toNumberOrZero(42)).toBe(42);
    expect(toNumberOrZero(3.14)).toBe(3.14);
    expect(toNumberOrZero(0)).toBe(0);
  });

  it('returns 0 for NaN', () => {
    expect(toNumberOrZero(NaN)).toBe(0);
  });

  it('returns 0 for Infinity', () => {
    expect(toNumberOrZero(Infinity)).toBe(0);
    expect(toNumberOrZero(-Infinity)).toBe(0);
  });
});

describe('safeDivide', () => {
  it('performs normal division', () => {
    expect(safeDivide(10, 2)).toBe(5);
    expect(safeDivide(7, 2)).toBe(3.5);
  });

  it('returns fallback for division by zero', () => {
    expect(safeDivide(10, 0)).toBe(0);
    expect(safeDivide(10, 0, -1)).toBe(-1);
  });

  it('returns fallback for division by NaN', () => {
    expect(safeDivide(10, NaN)).toBe(0);
  });
});
