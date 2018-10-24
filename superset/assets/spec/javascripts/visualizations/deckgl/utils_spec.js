import { expect, assert } from 'chai';

import {
  getBreakPoints,
  getBreakPointColorScaler,
  getBuckets,
  hexToRGB,
} from '../../../../src/visualizations/deckgl/utils';

describe('getBreakPoints', () => {
  it('is a function', () => {
    assert.isFunction(getBreakPoints);
  });

  it('returns sorted break points', () => {
    const fd = { break_points: ['0', '10', '100', '50', '1000'] };
    const result = getBreakPoints(fd);
    const expected = ['0', '10', '50', '100', '1000'];
    expect(result).to.eql(expected);
  });

  it('returns evenly distributed break points when no break points are specified', () => {
    const fd = { metric: 'count' };
    const features = [0, 1, 2, 10].map(count => ({ count }));
    const result = getBreakPoints(fd, features);
    const expected = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    expect(result).to.eql(expected);
  });

  it('formats number with proper precision', () => {
    const fd = { metric: 'count', num_buckets: 2 };
    const features = [0, 1 / 3, 2 / 3, 1].map(count => ({ count }));
    const result = getBreakPoints(fd, features);
    const expected = ['0.0', '0.5', '1.0'];
    expect(result).to.eql(expected);
  });

  it('works with a zero range', () => {
    const fd = { metric: 'count', num_buckets: 1 };
    const features = [1, 1, 1].map(count => ({ count }));
    const result = getBreakPoints(fd, features);
    const expected = ['1', '1'];
    expect(result).to.eql(expected);
  });
});

describe('hexToRGB', () => {
  it('is a function', () => {
    assert.isFunction(hexToRGB);
  });

  it('works with falsy values', () => {
    expect(hexToRGB()).to.eql([0, 0, 0, 255]);
    /* eslint-disable quotes */
    [false, 0, -0, 0.0, '', "", ``, null, undefined, NaN].forEach((value) => {
      expect(hexToRGB(value)).to.eql([0, 0, 0, 255]);
    });
  });

  it('parses hex colors', () => {
    expect(hexToRGB('#000000')).to.eql([0, 0, 0, 255]);
    expect(hexToRGB('#ffffff')).to.eql([255, 255, 255, 255]);
  });

  it('takes and alpha argument', () => {
    expect(hexToRGB('#000000', 100)).to.eql([0, 0, 0, 100]);
    expect(hexToRGB('#ffffff', 0)).to.eql([255, 255, 255, 0]);
  });
});

describe('getBreakPointColorScaler', () => {
  it('is a function', () => {
    assert.isFunction(getBreakPointColorScaler);
  });

  it('returns linear color scaler if there are no break points', () => {
    const fd = {
      metric: 'count',
      linear_color_scheme: ['#000000', '#ffffff'],
      opacity: 100,
    };
    const features = [10, 20, 30].map(count => ({ count }));
    const scaler = getBreakPointColorScaler(fd, features);
    expect(scaler({ count: 10 })).to.eql([0, 0, 0, 255]);
    expect(scaler({ count: 15 })).to.eql([64, 64, 64, 255]);
    expect(scaler({ count: 30 })).to.eql([255, 255, 255, 255]);
  });

  it('returns bucketing scaler if there are break points', () => {
    const fd = {
      metric: 'count',
      linear_color_scheme: ['#000000', '#ffffff'],
      break_points: ['0', '1', '10'],
      opacity: 100,
    };
    const features = [];
    const scaler = getBreakPointColorScaler(fd, features);
    expect(scaler({ count: 0 })).to.eql([0, 0, 0, 255]);
    expect(scaler({ count: 0.5 })).to.eql([0, 0, 0, 255]);
    expect(scaler({ count: 1 })).to.eql([255, 255, 255, 255]);
    expect(scaler({ count: 5 })).to.eql([255, 255, 255, 255]);
  });

  it('mask values outside the break points', () => {
    const fd = {
      metric: 'count',
      linear_color_scheme: ['#000000', '#ffffff'],
      break_points: ['0', '1', '10'],
      opacity: 100,
    };
    const features = [];
    const scaler = getBreakPointColorScaler(fd, features);
    expect(scaler({ count: -1 })).to.eql([0, 0, 0, 0]);
    expect(scaler({ count: 11 })).to.eql([0, 0, 0, 0]);
  });
});

describe('getBuckets', () => {
  it('is a function', () => {
    assert.isFunction(getBuckets);
  });

  it('computes buckets for break points', () => {
    const fd = {
      metric: 'count',
      linear_color_scheme: ['#000000', '#ffffff'],
      break_points: ['0', '1', '10'],
      opacity: 100,
    };
    const features = [];
    const result = getBuckets(features, fd);
    const expected = {
      '0 - 1': { color: [0, 0, 0, 255], enabled: true },
      '1 - 10': { color: [255, 255, 255, 255], enabled: true },
    };
    expect(result).to.eql(expected);
  });
});
