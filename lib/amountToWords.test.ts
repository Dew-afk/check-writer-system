import { describe, expect, it } from 'vitest';
import { MAX_AMOUNT, amountToWords } from './amountToWords';

describe('amountToWords', () => {
  describe('basic amounts', () => {
    it('writes the plan example', () => {
      expect(amountToWords(1234.5)).toBe(
        'One Thousand Two Hundred Thirty-Four Pesos and 50/100 Only',
      );
    });

    it('writes zero', () => {
      expect(amountToWords(0)).toBe('Zero Pesos and 00/100 Only');
    });

    it('writes centavos-only amounts, zero-padded', () => {
      expect(amountToWords(0.01)).toBe('Zero Pesos and 01/100 Only');
      expect(amountToWords(0.05)).toBe('Zero Pesos and 05/100 Only');
      expect(amountToWords(0.99)).toBe('Zero Pesos and 99/100 Only');
    });

    it('uses the singular "Peso"', () => {
      expect(amountToWords(1)).toBe('One Peso and 00/100 Only');
      expect(amountToWords(1.01)).toBe('One Peso and 01/100 Only');
      expect(amountToWords(2)).toBe('Two Pesos and 00/100 Only');
    });
  });

  describe('hundreds, tens and teens', () => {
    it.each<[number, string]>([
      [15, 'Fifteen Pesos and 00/100 Only'],
      [20, 'Twenty Pesos and 00/100 Only'],
      [21, 'Twenty-One Pesos and 00/100 Only'],
      [100, 'One Hundred Pesos and 00/100 Only'],
      [101, 'One Hundred One Pesos and 00/100 Only'],
      [110, 'One Hundred Ten Pesos and 00/100 Only'],
      [115, 'One Hundred Fifteen Pesos and 00/100 Only'],
      [999, 'Nine Hundred Ninety-Nine Pesos and 00/100 Only'],
    ])('converts %d', (amount, expected) => {
      expect(amountToWords(amount)).toBe(expected);
    });
  });

  describe('thousands', () => {
    it.each<[number, string]>([
      [1000, 'One Thousand Pesos and 00/100 Only'],
      [1001, 'One Thousand One Pesos and 00/100 Only'],
      [1010, 'One Thousand Ten Pesos and 00/100 Only'],
      [1100, 'One Thousand One Hundred Pesos and 00/100 Only'],
      [100000, 'One Hundred Thousand Pesos and 00/100 Only'],
      [100001, 'One Hundred Thousand One Pesos and 00/100 Only'],
      [
        999999,
        'Nine Hundred Ninety-Nine Thousand Nine Hundred Ninety-Nine Pesos and 00/100 Only',
      ],
    ])('converts %d', (amount, expected) => {
      expect(amountToWords(amount)).toBe(expected);
    });
  });

  describe('millions', () => {
    it.each<[number, string]>([
      [1000000, 'One Million Pesos and 00/100 Only'],
      [
        1234567.89,
        'One Million Two Hundred Thirty-Four Thousand Five Hundred Sixty-Seven Pesos and 89/100 Only',
      ],
      [100000000, 'One Hundred Million Pesos and 00/100 Only'],
      [
        999999999.99,
        'Nine Hundred Ninety-Nine Million Nine Hundred Ninety-Nine Thousand Nine Hundred Ninety-Nine Pesos and 99/100 Only',
      ],
    ])('converts %d', (amount, expected) => {
      expect(amountToWords(amount)).toBe(expected);
    });
  });

  describe('rounding to the nearest centavo', () => {
    it.each<[number, string]>([
      [1.005, 'One Peso and 01/100 Only'],
      [1.999, 'Two Pesos and 00/100 Only'],
      [19.999, 'Twenty Pesos and 00/100 Only'],
      [0.004, 'Zero Pesos and 00/100 Only'],
    ])('rounds %d', (amount, expected) => {
      expect(amountToWords(amount)).toBe(expected);
    });
  });

  describe('wording options', () => {
    const amount = 1234.5;

    it('uppercases', () => {
      expect(amountToWords(amount, { capitalization: 'upper' })).toBe(
        'ONE THOUSAND TWO HUNDRED THIRTY-FOUR PESOS AND 50/100 ONLY',
      );
    });

    it('lowercases', () => {
      expect(amountToWords(amount, { capitalization: 'lower' })).toBe(
        'one thousand two hundred thirty-four pesos and 50/100 only',
      );
    });

    it('omits the "Only" suffix when asked', () => {
      expect(amountToWords(amount, { suffixOnly: false })).toBe(
        'One Thousand Two Hundred Thirty-Four Pesos and 50/100',
      );
    });

    it('combines options', () => {
      expect(amountToWords(amount, { capitalization: 'lower', suffixOnly: false })).toBe(
        'one thousand two hundred thirty-four pesos and 50/100',
      );
    });
  });

  describe('invalid amounts', () => {
    it.each([
      -1,
      -0.01,
      -0.004,
      1000000000,
      999999999.999, // rounds to 1,000,000,000.00 → above the cap
      MAX_AMOUNT + 0.01,
    ])('rejects %s', (amount) => {
      expect(() => amountToWords(amount)).toThrow(RangeError);
    });

    it.each([NaN, Infinity, -Infinity])('rejects non-finite %s', (amount) => {
      expect(() => amountToWords(amount)).toThrow(TypeError);
    });

    it('rejects non-numbers', () => {
      expect(() => amountToWords('1234' as unknown as number)).toThrow(TypeError);
    });

    it('accepts the maximum amount', () => {
      expect(() => amountToWords(MAX_AMOUNT)).not.toThrow();
    });
  });
});

describe('omitZeroCentavos option', () => {
  it('keeps "and 00/100" by default (standard format)', () => {
    expect(amountToWords(100)).toBe('One Hundred Pesos and 00/100 Only');
  });

  it('omits the fraction for whole-peso amounts', () => {
    expect(amountToWords(100, { omitZeroCentavos: true })).toBe(
      'One Hundred Pesos Only',
    );
    expect(amountToWords(1, { omitZeroCentavos: true })).toBe('One Peso Only');
    expect(amountToWords(1000000, { omitZeroCentavos: true })).toBe(
      'One Million Pesos Only',
    );
  });

  it('still shows the fraction when there are centavos', () => {
    expect(amountToWords(100.5, { omitZeroCentavos: true })).toBe(
      'One Hundred Pesos and 50/100 Only',
    );
    expect(amountToWords(0.01, { omitZeroCentavos: true })).toBe(
      'Zero Pesos and 01/100 Only',
    );
  });

  it('combines with other options', () => {
    expect(
      amountToWords(100, {
        omitZeroCentavos: true,
        capitalization: 'lower',
        suffixOnly: false,
      }),
    ).toBe('one hundred pesos');
  });
});
