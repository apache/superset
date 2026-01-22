import {
  getSafeCellSize,
  MIN_CELL_SIZE,
  MAX_CELL_SIZE,
} from './getSafeCellSize';

describe('getSafeCellSize', () => {
  it('defaults to 200 when value is not finite', () => {
    expect(getSafeCellSize({ cellSize: 'nope' })).toBe(200);
  });

  it('clamps below minimum', () => {
    expect(getSafeCellSize({ cellSize: 1 })).toBe(MIN_CELL_SIZE);
  });

  it('clamps above maximum', () => {
    expect(getSafeCellSize({ cellSize: 999999 })).toBe(MAX_CELL_SIZE);
  });

  it('auto-scales when estimated grid is too large', () => {
    const size = getSafeCellSize({
      cellSize: 1,
      viewport: { width: 11000, height: 11000 },
    });

    expect(size).toBeGreaterThan(MIN_CELL_SIZE);
  });

  it('never exceeds MAX_CELL_SIZE', () => {
    const size = getSafeCellSize({
      cellSize: 1,
      viewport: { width: 100000, height: 100000 },
    });

    expect(size).toBeLessThanOrEqual(MAX_CELL_SIZE);
  });

  it('calls onAutoAdjust when scaling happens', () => {
    const spy = jest.fn();

    getSafeCellSize({
      cellSize: 1,
      viewport: { width: 11000, height: 11000 },
      onAutoAdjust: spy,
    });

    expect(spy).toHaveBeenCalled();
  });
});
