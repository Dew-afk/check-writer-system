import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  buildBackupJson,
  clearAllFieldOverrides,
  clearFieldOverrides,
  getFieldOverrides,
  getOffset,
  getPrintLayout,
  getShowBorderOnScreen,
  getWordsMaxWidth,
  loadStoredState,
  parseBackupJson,
  saveFieldOverrides,
  savePrintLayout,
  saveShowBorderOnScreen,
  saveWordsMaxWidth,
  setFieldOverride,
} from './storage';

// These tests only exercise the pure serialize/validate path — no localStorage
// exists in Node, so loadStoredState falls back to defaults.

describe('parseBackupJson', () => {
  it('round-trips a fresh backup', () => {
    const result = parseBackupJson(buildBackupJson());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        payees: [],
        lastBank: null,
        offsets: {},
        fieldOverrides: {},
        dateSpacing: {},
        customFields: {},
        savedNames: [],
        wordsWidthOverrides: {},
        printLayouts: {},
        showBorderOnScreen: {},
      });
    }
  });

  it('accepts a backup with data', () => {
    const json = JSON.stringify({
      app: 'ph-cheque-writer',
      version: 1,
      exportedAt: '2026-10-07T00:00:00.000Z',
      payees: [{ id: 'p1', name: 'Juan Dela Cruz' }],
      lastBank: 'bdo',
      offsets: { bdo: { x: 1.5, y: -2 } },
      fieldOverrides: {
        bdo: {
          payee: { x: 20.3, y: 30.1 },
          amountNum: { x: 150, y: 30 },
        },
      },
    });
    const result = parseBackupJson(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.payees).toHaveLength(1);
      expect(result.data.lastBank).toBe('bdo');
      expect(result.data.offsets.bdo).toEqual({ x: 1.5, y: -2 });
      expect(result.data.fieldOverrides.bdo?.payee).toEqual({ x: 20.3, y: 30.1 });
      expect(result.data.fieldOverrides.bdo?.amountNum).toEqual({ x: 150, y: 30 });
    }
  });

  it('accepts legacy backups without fieldOverrides', () => {
    const json = JSON.stringify({
      app: 'ph-cheque-writer',
      version: 1,
      exportedAt: '2026-10-07T00:00:00.000Z',
      payees: [],
      lastBank: null,
      offsets: {},
    });
    const result = parseBackupJson(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.fieldOverrides).toEqual({});
    }
  });

  it('falls back to empty overrides when they are malformed', () => {
    const json = JSON.stringify({
      app: 'ph-cheque-writer',
      version: 1,
      exportedAt: 'x',
      payees: [],
      lastBank: null,
      offsets: {},
      fieldOverrides: { bdo: { payee: { x: 'banana' } } },
    });
    const result = parseBackupJson(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.fieldOverrides).toEqual({});
    }
  });

  it.each([
    ['not json at all', '{"app":'],
    ['wrong app name', JSON.stringify({ app: 'other-app', version: 1, exportedAt: 'x', payees: [], lastBank: null, offsets: {} })],
    ['wrong version', JSON.stringify({ app: 'ph-cheque-writer', version: 3, exportedAt: 'x', payees: [], lastBank: null, offsets: {} })],
    ['missing fields', JSON.stringify({ app: 'ph-cheque-writer', version: 1 })],
    [
      'bad payee shape',
      JSON.stringify({
        app: 'ph-cheque-writer',
        version: 1,
        exportedAt: 'x',
        payees: [{ id: 'p1' }],
        lastBank: null,
        offsets: {},
      }),
    ],
    [
      'unknown bank in lastBank',
      JSON.stringify({
        app: 'ph-cheque-writer',
        version: 1,
        exportedAt: 'x',
        payees: [],
        lastBank: 'chase',
        offsets: {},
      }),
    ],
    [
      'unknown bank in offsets',
      JSON.stringify({
        app: 'ph-cheque-writer',
        version: 1,
        exportedAt: 'x',
        payees: [],
        lastBank: null,
        offsets: { chase: { x: 0, y: 0 } },
      }),
    ],
  ])('rejects %s', (_label, json) => {
    expect(parseBackupJson(json).ok).toBe(false);
  });
});

describe('field layout persistence (localStorage mock)', () => {
  class MemoryStorage {
    private store = new Map<string, string>();
    get length() { return this.store.size; }
    clear() { this.store.clear(); }
    getItem(key: string) { return this.store.get(key) ?? null; }
    key(index: number) { return Array.from(this.store.keys())[index] ?? null; }
    removeItem(key: string) { this.store.delete(key); }
    setItem(key: string, value: string) { this.store.set(key, String(value)); }
  }

  beforeAll(() => {
    (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  });

  beforeEach(() => {
    globalThis.localStorage?.clear();
  });

  it('saves and loads a bank layout (mm)', () => {
    expect(setFieldOverride('bdo', 'payee', { x: 33.5, y: 21 })).toBe(true);
    expect(setFieldOverride('bdo', 'amountNum', { x: 140, y: 35 })).toBe(true);
    expect(getFieldOverrides('bdo')).toEqual({
      payee: { x: 33.5, y: 21 },
      amountNum: { x: 140, y: 35 },
    });
  });

  it('saveFieldOverrides replaces a bank layout in one write', () => {
    setFieldOverride('bdo', 'payee', { x: 33.5, y: 21 });
    expect(saveFieldOverrides('bdo', { amountNum: { x: 140, y: 35 } })).toBe(true);
    expect(getFieldOverrides('bdo')).toEqual({ amountNum: { x: 140, y: 35 } });
  });

  it('falls back to factory defaults ({}) when nothing is saved', () => {
    expect(getFieldOverrides('aub')).toEqual({});
  });

  it('clamps out-of-bounds positions on save', () => {
    setFieldOverride('pnb', 'payee', { x: -5, y: 999 });
    expect(getFieldOverrides('pnb')).toEqual({ payee: { x: 0, y: 76.2 } });
  });

  it('resets one bank and all banks', () => {
    saveFieldOverrides('bdo', { payee: { x: 10, y: 10 } });
    saveFieldOverrides('aub', { payee: { x: 20, y: 20 } });
    expect(clearFieldOverrides('bdo')).toBe(true);
    expect(getFieldOverrides('bdo')).toEqual({});
    expect(getFieldOverrides('aub')).toEqual({ payee: { x: 20, y: 20 } });
    expect(clearAllFieldOverrides()).toBe(true);
    expect(getFieldOverrides('aub')).toEqual({});
  });

  it('drops malformed entries individually on load, keeps valid ones', () => {
    globalThis.localStorage?.setItem(
      'ph-cheque-writer:v1',
      JSON.stringify({
        payees: [],
        lastBank: null,
        offsets: {},
        fieldOverrides: {
          bdo: { payee: { x: 10, y: 20 }, amountNum: { x: NaN, y: 5 } },
          chase: { payee: { x: 1, y: 1 } },
        },
      }),
    );
    expect(getFieldOverrides('bdo')).toEqual({ payee: { x: 10, y: 20 } });
  });

  it('survives corrupted storage JSON', () => {
    globalThis.localStorage?.setItem('ph-cheque-writer:v1', '{not json');
    expect(loadStoredState()).toEqual({
      payees: [],
      lastBank: null,
      offsets: {},
      fieldOverrides: {},
      dateSpacing: {},
      customFields: {},
      savedNames: [],
      wordsWidthOverrides: {},
      printLayouts: {},
      showBorderOnScreen: {},
    });
  });

  it('accepts v1 backups and migrates layouts', () => {
    const v1 = JSON.stringify({
      app: 'ph-cheque-writer',
      version: 1,
      exportedAt: '2026-10-01T00:00:00.000Z',
      payees: [],
      lastBank: 'bdo',
      offsets: { bdo: { x: 1, y: -2 } },
      fieldOverrides: { bdo: { payee: { x: 33.5, y: 21 } } },
    });
    const result = parseBackupJson(v1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.fieldOverrides.bdo?.payee).toEqual({ x: 33.5, y: 21 });
    }
  });

  it('drops out-of-bounds positions from imported backups individually', () => {
    const json = JSON.stringify({
      app: 'ph-cheque-writer',
      version: 2,
      exportedAt: 'x',
      payees: [],
      lastBank: null,
      offsets: {},
      fieldOverrides: {
        bdo: {
          payee: { x: 10, y: 20 },
          amountNum: { x: 999, y: -3 }, // invalid
        },
      },
    });
    const result = parseBackupJson(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.fieldOverrides.bdo).toEqual({ payee: { x: 10, y: 20 } });
    }
  });

  it('rejects unknown backup versions', () => {
    const json = JSON.stringify({
      app: 'ph-cheque-writer',
      version: 3,
      exportedAt: 'x',
      payees: [],
      lastBank: null,
      offsets: {},
      fieldOverrides: {},
    });
    expect(parseBackupJson(json).ok).toBe(false);
  });

  it('resets invalid saved offsets to the clamped ±10mm range', () => {
    globalThis.localStorage?.setItem(
      'ph-cheque-writer:v1',
      JSON.stringify({
        payees: [],
        lastBank: null,
        offsets: { aub: { x: 999, y: -50 }, bdo: { x: 1.5, y: -2 } },
      }),
    );
    // Bad values fall back to the clamped range instead of shifting the
    // fields off the cheque.
    expect(getOffset('aub')).toEqual({ x: 10, y: -10 });
    expect(getOffset('bdo')).toEqual({ x: 1.5, y: -2 });
  });

  it('resets invalid saved words widths to the factory default', () => {
    globalThis.localStorage?.setItem(
      'ph-cheque-writer:v1',
      JSON.stringify({
        payees: [],
        lastBank: null,
        offsets: {},
        wordsWidthOverrides: {
          aub: 190, // past the cheque to the right of x=38 (max 165.2)
          pnb: 'banana',
          landbank: 5,
          metrobank: 140, // valid
        },
      }),
    );
    expect(getWordsMaxWidth('aub')).toBeUndefined();
    expect(getWordsMaxWidth('pnb')).toBeUndefined();
    expect(getWordsMaxWidth('landbank')).toBeUndefined();
    expect(getWordsMaxWidth('metrobank')).toBe(140);
  });

  it('clamps saved words widths to the bank line bounds', () => {
    // aub words.x = 38 → max width 165.2.
    expect(saveWordsMaxWidth('aub', 999)).toBe(true);
    expect(getWordsMaxWidth('aub')).toBeCloseTo(203.2 - 38, 5);
    expect(saveWordsMaxWidth('aub', 3)).toBe(true);
    expect(getWordsMaxWidth('aub')).toBe(20);
    expect(saveWordsMaxWidth('aub', 130)).toBe(true);
    expect(getWordsMaxWidth('aub')).toBe(130);
  });

  it('shows the border on screen by default and persists per bank', () => {
    expect(getShowBorderOnScreen('aub')).toBe(true);
    expect(saveShowBorderOnScreen('aub', false)).toBe(true);
    expect(getShowBorderOnScreen('aub')).toBe(false);
    expect(getShowBorderOnScreen('pnb')).toBe(true);
  });

  it('migrates old saved data: borders OFF for printing, ON for the screen guide', () => {
    // A pre-feature backup/storage blob: no printChequeBorder on the
    // layout, no showBorderOnScreen key at all.
    globalThis.localStorage?.setItem(
      'ph-cheque-writer:v1',
      JSON.stringify({
        payees: [],
        lastBank: null,
        offsets: {},
        printLayouts: {
          aub: {
            paperPreset: 'a4',
            orientation: 'portrait',
            contentRotation: 0,
            anchorX: 'center',
            anchorY: 'middle',
            offsetMm: { x: 0, y: 0 },
          },
        },
      }),
    );
    // Printing must default OFF…
    expect(getPrintLayout('aub').printChequeBorder).toBe(false);
    // …while the on-screen guide stays ON.
    expect(getShowBorderOnScreen('aub')).toBe(true);
  });

  it('rejects non-boolean screen-guide values and keeps others', () => {
    globalThis.localStorage?.setItem(
      'ph-cheque-writer:v1',
      JSON.stringify({
        payees: [],
        lastBank: null,
        offsets: {},
        showBorderOnScreen: { aub: false, pnb: 'yes', chase: true },
      }),
    );
    expect(getShowBorderOnScreen('aub')).toBe(false);
    expect(getShowBorderOnScreen('pnb')).toBe(true);
    expect(getShowBorderOnScreen('landbank')).toBe(true);
  });

  it('round-trips the screen-guide setting through savePrintLayout helpers', () => {
    expect(
      savePrintLayout('aub', {
        ...getPrintLayout('aub'),
        printChequeBorder: true,
      }),
    ).toBe(true);
    expect(getPrintLayout('aub').printChequeBorder).toBe(true);
  });
});
