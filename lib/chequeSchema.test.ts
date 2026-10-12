import { describe, expect, it } from 'vitest';

import {
  amountSchema,
  bankIdSchema,
  capitalizationSchema,
  crossingSchema,
  formatIsoDateUs,
  getDateWarnings,
  isoDateSchema,
  parseAmountText,
  payeeSchema,
  toIsoDate,
} from './chequeSchema';

// Fixed "today" so warnings tests don't drift: October 7, 2026.
const TODAY = new Date(2026, 9, 7);

describe('bankIdSchema', () => {
  it.each(['aub', 'pnb', 'landbank', 'metrobank', 'bdo', 'securitybank'])(
    'accepts %s',
    (id) => {
      expect(bankIdSchema.safeParse(id).success).toBe(true);
    },
  );

  it('rejects unknown banks', () => {
    expect(bankIdSchema.safeParse('chase').success).toBe(false);
    expect(bankIdSchema.safeParse('').success).toBe(false);
  });
});

describe('crossingSchema', () => {
  it.each([
    'none',
    'account-payee-only',
    'cross-ac-payee-or-bearer',
    'not-negotiable',
  ])('accepts %s', (value) => {
    expect(crossingSchema.safeParse(value).success).toBe(true);
  });

  it('rejects unknown crossings', () => {
    expect(crossingSchema.safeParse('account-payee').success).toBe(false);
  });
});

describe('capitalizationSchema', () => {
  it.each(['title', 'upper', 'lower'])('accepts %s', (value) => {
    expect(capitalizationSchema.safeParse(value).success).toBe(true);
  });

  it('rejects unknown styles', () => {
    expect(capitalizationSchema.safeParse('sentence').success).toBe(false);
  });
});

describe('payeeSchema', () => {
  it('accepts and trims payee names', () => {
    const result = payeeSchema.safeParse('  Juan Dela Cruz  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('Juan Dela Cruz');
  });

  it('rejects empty and overlong names', () => {
    expect(payeeSchema.safeParse('').success).toBe(false);
    expect(payeeSchema.safeParse('   ').success).toBe(false);
    expect(payeeSchema.safeParse('x'.repeat(121)).success).toBe(false);
  });
});

describe('amountSchema', () => {
  it.each([0, 0.01, 1.23, 100, 999999999.99])('accepts %s', (value) => {
    expect(amountSchema.safeParse(value).success).toBe(true);
  });

  it.each([-1, -0.01, 1000000000, 1.234, NaN, Infinity, -Infinity])(
    'rejects %s',
    (value) => {
      expect(amountSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe('isoDateSchema', () => {
  it.each(['2026-10-07', '2024-02-29', '2000-01-01'])('accepts %s', (value) => {
    expect(isoDateSchema.safeParse(value).success).toBe(true);
  });

  it.each([
    '2026-13-01',
    '2026-00-10',
    '2026-02-29', // 2026 is not a leap year
    '2026-04-31',
    '2026-10-7',
    '10/07/2026',
    'not-a-date',
  ])('rejects %s', (value) => {
    expect(isoDateSchema.safeParse(value).success).toBe(false);
  });
});

describe('parseAmountText', () => {
  it.each([
    ['1234.56', 1234.56],
    ['1,234.56', 1234.56],
    ['0', 0],
    ['12.', 12],
    ['.5', 0.5],
  ])('parses "%s" as %s', (text, expected) => {
    expect(parseAmountText(text)).toBe(expected);
  });

  it.each(["", ".", "abc", "1.234", "1,2.3", "12,34", "--5"])(
    'rejects "%s"',
    (text) => {
      expect(parseAmountText(text)).toBeNull();
    },
  );
});

describe('getDateWarnings', () => {
  it.each<[string, string[]]>([
    ['2026-10-07', []], // today
    ['2026-10-08', ['postdated']],
    ['2027-01-15', ['postdated']],
    ['2026-09-01', []],
    ['2026-04-07', []], // exactly 6 months old is fine
    ['2026-04-06', ['stale']],
    ['2025-12-31', ['stale']],
  ])('%s → %s', (isoDate, expected) => {
    expect(getDateWarnings(isoDate, TODAY)).toEqual(expected);
  });
});

describe('date formatting', () => {
  it('formats ISO to US style with zero padding', () => {
    expect(formatIsoDateUs('2026-10-07')).toBe('10/07/2026');
    expect(formatIsoDateUs('2026-01-05')).toBe('01/05/2026');
  });

  it('converts Date to ISO in local time', () => {
    expect(toIsoDate(new Date(2026, 9, 7))).toBe('2026-10-07');
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
