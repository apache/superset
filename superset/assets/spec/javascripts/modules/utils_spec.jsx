import { it, describe } from 'mocha';
import { expect } from 'chai';
import {
  tryNumify,
  slugify,
  formatSelectOptionsForRange,
  d3format,
  d3FormatPreset,
  d3TimeFormatPreset,
  defaultNumberFormatter,
  mainMetric,
} from '../../../src/modules/utils';

describe('utils', () => {
  it('tryNumify works as expected', () => {
    expect(tryNumify(5)).to.equal(5);
    expect(tryNumify('5')).to.equal(5);
    expect(tryNumify('5.1')).to.equal(5.1);
    expect(tryNumify('a string')).to.equal('a string');
  });
  it('slugify slugifies', () => {
    expect(slugify('My Neat Label! ')).to.equal('my-neat-label');
    expect(slugify('Some Letters AnD a 5')).to.equal('some-letters-and-a-5');
    expect(slugify(' 439278 ')).to.equal('439278');
    expect(slugify('5')).to.equal('5');
  });
  it('formatSelectOptionsForRange', () => {
    expect(formatSelectOptionsForRange(0, 4)).to.deep.equal([
      [0, '0'],
      [1, '1'],
      [2, '2'],
      [3, '3'],
      [4, '4'],
    ]);
    expect(formatSelectOptionsForRange(1, 2)).to.deep.equal([
      [1, '1'],
      [2, '2'],
    ]);
  });
  it('d3format', () => {
    expect(d3format('.3s', 1234)).to.equal('1.23k');
    expect(d3format('.3s', 1237)).to.equal('1.24k');
    expect(d3format('', 1237)).to.equal('1.24k');
  });
  describe('d3FormatPreset', () => {
    it('is a function', () => {
      assert.isFunction(d3FormatPreset);
    });
    it('returns a working formatter', () => {
      expect(d3FormatPreset('.3s')(3000000)).to.equal('3.00M');
    });
  });
  describe('d3TimeFormatPreset', () => {
    it('is a function', () => {
      assert.isFunction(d3TimeFormatPreset);
    });
    it('returns a working time formatter', () => {
      expect(d3FormatPreset('smart_date')(0)).to.equal('1970');
    });
  });
  describe('defaultNumberFormatter', () => {
    expect(defaultNumberFormatter(10)).to.equal('10');
    expect(defaultNumberFormatter(1)).to.equal('1');
    expect(defaultNumberFormatter(1.0)).to.equal('1');
    expect(defaultNumberFormatter(10.0)).to.equal('10');
    expect(defaultNumberFormatter(10001)).to.equal('10.0k');
    expect(defaultNumberFormatter(10100)).to.equal('10.1k');
    expect(defaultNumberFormatter(111000000)).to.equal('111M');
    expect(defaultNumberFormatter(0.23)).to.equal('230m');

    expect(defaultNumberFormatter(-10)).to.equal('-10');
    expect(defaultNumberFormatter(-1)).to.equal('-1');
    expect(defaultNumberFormatter(-1.0)).to.equal('-1');
    expect(defaultNumberFormatter(-10.0)).to.equal('-10');
    expect(defaultNumberFormatter(-10001)).to.equal('-10.0k');
    expect(defaultNumberFormatter(-10101)).to.equal('-10.1k');
    expect(defaultNumberFormatter(-111000000)).to.equal('-111M');
    expect(defaultNumberFormatter(-0.23)).to.equal('-230m');
  });
  describe('mainMetric', () => {
    it('is null when no options', () => {
      expect(mainMetric([])).to.equal(undefined);
      expect(mainMetric(null)).to.equal(undefined);
    });
    it('prefers the "count" metric when first', () => {
      const metrics = [
        { metric_name: 'count' },
        { metric_name: 'foo' },
      ];
      expect(mainMetric(metrics)).to.equal('count');
    });
    it('prefers the "count" metric when not first', () => {
      const metrics = [
        { metric_name: 'foo' },
        { metric_name: 'count' },
      ];
      expect(mainMetric(metrics)).to.equal('count');
    });
    it('selects the first metric when "count" is not an option', () => {
      const metrics = [
        { metric_name: 'foo' },
        { metric_name: 'not_count' },
      ];
      expect(mainMetric(metrics)).to.equal('foo');
    });
  });
});
