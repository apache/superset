import {
  formatSelectOptionsForRange,
  d3format,
  d3FormatPreset,
  d3TimeFormatPreset,
  defaultNumberFormatter,
  mainMetric,
  getClientErrorObject,
} from '../../../src/modules/utils';

describe('utils', () => {
  describe('formatSelectOptionsForRange', () => {
    it('returns an array of arrays for the range specified (inclusive)', () => {
      expect(formatSelectOptionsForRange(0, 4)).toEqual([
        [0, '0'],
        [1, '1'],
        [2, '2'],
        [3, '3'],
        [4, '4'],
      ]);
      expect(formatSelectOptionsForRange(1, 2)).toEqual([
        [1, '1'],
        [2, '2'],
      ]);
    });
  });

  describe('d3format', () => {
    it('returns a string formatted number as specified', () => {
      expect(d3format('.3s', 1234)).toBe('1.23k');
      expect(d3format('.3s', 1237)).toBe('1.24k');
      expect(d3format('', 1237)).toBe('1.24k');
    });
  });

  describe('d3FormatPreset', () => {
    it('is a function', () => {
      expect(typeof d3FormatPreset).toBe('function');
    });
    it('returns a working formatter', () => {
      expect(d3FormatPreset('.3s')(3000000)).toBe('3.00M');
    });
  });

  describe('d3TimeFormatPreset', () => {
    it('is a function', () => {
      expect(typeof d3TimeFormatPreset).toBe('function');
    });
    it('returns a working time formatter', () => {
      expect(d3FormatPreset('smart_date')(0)).toBe('1970');
    });
  });

  describe('defaultNumberFormatter', () => {
    expect(defaultNumberFormatter(10)).toBe('10');
    expect(defaultNumberFormatter(1)).toBe('1');
    expect(defaultNumberFormatter(1.0)).toBe('1');
    expect(defaultNumberFormatter(10.0)).toBe('10');
    expect(defaultNumberFormatter(10001)).toBe('10.0k');
    expect(defaultNumberFormatter(10100)).toBe('10.1k');
    expect(defaultNumberFormatter(111000000)).toBe('111M');
    expect(defaultNumberFormatter(0.23)).toBe('230m');

    expect(defaultNumberFormatter(-10)).toBe('-10');
    expect(defaultNumberFormatter(-1)).toBe('-1');
    expect(defaultNumberFormatter(-1.0)).toBe('-1');
    expect(defaultNumberFormatter(-10.0)).toBe('-10');
    expect(defaultNumberFormatter(-10001)).toBe('-10.0k');
    expect(defaultNumberFormatter(-10101)).toBe('-10.1k');
    expect(defaultNumberFormatter(-111000000)).toBe('-111M');
    expect(defaultNumberFormatter(-0.23)).toBe('-230m');
  });

  describe('mainMetric', () => {
    it('is null when no options', () => {
      expect(mainMetric([])).toBeUndefined();
      expect(mainMetric(null)).toBeUndefined();
    });
    it('prefers the "count" metric when first', () => {
      const metrics = [
        { metric_name: 'count' },
        { metric_name: 'foo' },
      ];
      expect(mainMetric(metrics)).toBe('count');
    });
    it('prefers the "count" metric when not first', () => {
      const metrics = [
        { metric_name: 'foo' },
        { metric_name: 'count' },
      ];
      expect(mainMetric(metrics)).toBe('count');
    });
    it('selects the first metric when "count" is not an option', () => {
      const metrics = [
        { metric_name: 'foo' },
        { metric_name: 'not_count' },
      ];
      expect(mainMetric(metrics)).toBe('foo');
    });
  });

  describe('getClientErrorObject', () => {
    it('Returns a Promise', () => {
      const response = getClientErrorObject('error');
      expect(response.constructor === Promise).toBe(true);
    });

    it('Returns a Promise that resolves to an object with an error key', () => {
      const error = 'error';

      return getClientErrorObject(error).then((errorObj) => {
        expect(errorObj).toMatchObject({ error });
      });
    });

    it('Handles Response that can be parsed as json', () => {
      const jsonError = { something: 'something', error: 'Error message' };
      const jsonErrorString = JSON.stringify(jsonError);

      return getClientErrorObject(new Response(jsonErrorString)).then((errorObj) => {
        expect(errorObj).toMatchObject(jsonError);
      });
    });

    it('Handles Response that can be parsed as text', () => {
      const textError = 'Hello I am a text error';

      return getClientErrorObject(new Response(textError)).then((errorObj) => {
        expect(errorObj).toMatchObject({ error: textError });
      });
    });

    it('Handles plain text as input', () => {
      const error = 'error';

      return getClientErrorObject(error).then((errorObj) => {
        expect(errorObj).toMatchObject({ error });
      });
    });
  });
});
