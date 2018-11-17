import {
  getBreakPoints,
  getBreakPointColorScaler,
  getBuckets,
} from '../../../../src/visualizations/deckgl/utils';

const metricAccessor = d => d.count;

describe('getBreakPoints', () => {
  it('is a function', () => {
    expect(typeof getBreakPoints).toBe('function');
  });

  it('returns sorted break points', () => {
    const fd = { break_points: ['0', '10', '100', '50', '1000'] };
    const result = getBreakPoints(fd, [], metricAccessor);
    const expected = ['0', '10', '50', '100', '1000'];
    expect(result).toEqual(expected);
  });

  it('returns evenly distributed break points when no break points are specified', () => {
    const fd = { metric: 'count' };
    const features = [0, 1, 2, 10].map(count => ({ count }));
    const result = getBreakPoints(fd, features, metricAccessor);
    const expected = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    expect(result).toEqual(expected);
  });

  it('formats number with proper precision', () => {
    const fd = { metric: 'count', num_buckets: 2 };
    const features = [0, 1 / 3, 2 / 3, 1].map(count => ({ count }));
    const result = getBreakPoints(fd, features, metricAccessor);
    const expected = ['0.0', '0.5', '1.0'];
    expect(result).toEqual(expected);
  });

  it('works with a zero range', () => {
    const fd = { metric: 'count', num_buckets: 1 };
    const features = [1, 1, 1].map(count => ({ count }));
    const result = getBreakPoints(fd, features, metricAccessor);
    const expected = ['1', '1'];
    expect(result).toEqual(expected);
  });
});

describe('getBreakPointColorScaler', () => {
  it('is a function', () => {
    expect(typeof getBreakPointColorScaler).toBe('function');
  });

  it('returns linear color scaler if there are no break points', () => {
    const fd = {
      metric: 'count',
      linear_color_scheme: ['#000000', '#ffffff'],
      opacity: 100,
    };
    const features = [10, 20, 30].map(count => ({ count }));
    const scaler = getBreakPointColorScaler(fd, features, metricAccessor);
    expect(scaler({ count: 10 })).toEqual([0, 0, 0, 255]);
    expect(scaler({ count: 15 })).toEqual([64, 64, 64, 255]);
    expect(scaler({ count: 30 })).toEqual([255, 255, 255, 255]);
  });

  it('returns bucketing scaler if there are break points', () => {
    const fd = {
      metric: 'count',
      linear_color_scheme: ['#000000', '#ffffff'],
      break_points: ['0', '1', '10'],
      opacity: 100,
    };
    const features = [];
    const scaler = getBreakPointColorScaler(fd, features, metricAccessor);
    expect(scaler({ count: 0 })).toEqual([0, 0, 0, 255]);
    expect(scaler({ count: 0.5 })).toEqual([0, 0, 0, 255]);
    expect(scaler({ count: 1 })).toEqual([255, 255, 255, 255]);
    expect(scaler({ count: 5 })).toEqual([255, 255, 255, 255]);
  });

  it('mask values outside the break points', () => {
    const fd = {
      metric: 'count',
      linear_color_scheme: ['#000000', '#ffffff'],
      break_points: ['0', '1', '10'],
      opacity: 100,
    };
    const features = [];
    const scaler = getBreakPointColorScaler(fd, features, metricAccessor);
    expect(scaler({ count: -1 })).toEqual([0, 0, 0, 0]);
    expect(scaler({ count: 11 })).toEqual([255, 255, 255, 0]);
  });
});

describe('getBuckets', () => {
  it('is a function', () => {
    expect(typeof getBuckets).toBe('function');
  });

  it('computes buckets for break points', () => {
    const fd = {
      metric: 'count',
      linear_color_scheme: ['#000000', '#ffffff'],
      break_points: ['0', '1', '10'],
      opacity: 100,
    };
    const features = [];
    const result = getBuckets(fd, features, metricAccessor);
    const expected = {
      '0 - 1': { color: [0, 0, 0, 255], enabled: true },
      '1 - 10': { color: [255, 255, 255, 255], enabled: true },
    };
    expect(result).toEqual(expected);
  });
});
