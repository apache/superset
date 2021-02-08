import TimeFormatter, { PREVIEW_TIME } from '@superset-ui/core/src/time-format/TimeFormatter';

describe('TimeFormatter', () => {
  describe('new TimeFormatter(config)', () => {
    it('requires config.id', () => {
      expect(
        () =>
          // @ts-ignore -- intentionally pass invalid input
          new TimeFormatter({
            formatFunc: () => 'test',
          }),
      ).toThrow();
    });
    it('requires config.formatFunc', () => {
      expect(
        () =>
          // @ts-ignore -- intentionally pass invalid input
          new TimeFormatter({
            id: 'my_format',
          }),
      ).toThrow();
    });
  });
  describe('formatter is also a format function itself', () => {
    const formatter = new TimeFormatter({
      id: 'year_only',
      formatFunc: (value: Date) => `${value.getFullYear()}`,
    });
    it('returns formatted value', () => {
      expect(formatter(PREVIEW_TIME)).toEqual('2017');
    });
    it('formatter(value) is the same with formatter.format(value)', () => {
      const value = PREVIEW_TIME;
      expect(formatter(value)).toEqual(formatter.format(value));
    });
  });
  describe('.format(value)', () => {
    const formatter = new TimeFormatter({
      id: 'year_only',
      formatFunc: value => `${value.getFullYear()}`,
    });
    it('handles null', () => {
      expect(formatter.format(null)).toEqual('null');
    });
    it('handles undefined', () => {
      expect(formatter.format(undefined)).toEqual('undefined');
    });
    it('handles number, treating it as a timestamp', () => {
      expect(formatter.format(PREVIEW_TIME.getTime())).toEqual('2017');
    });
    it('otherwise returns formatted value', () => {
      expect(formatter.format(PREVIEW_TIME)).toEqual('2017');
    });
  });
  describe('.preview(value)', () => {
    const formatter = new TimeFormatter({
      id: 'year_only',
      formatFunc: value => `${value.getFullYear()}`,
    });
    it('returns string comparing value before and after formatting', () => {
      const time = new Date(Date.UTC(2018, 10, 21, 22, 11, 44));
      expect(formatter.preview(time)).toEqual('Wed, 21 Nov 2018 22:11:44 GMT => 2018');
    });
    it('uses the default preview value if not specified', () => {
      expect(formatter.preview()).toEqual('Tue, 14 Feb 2017 11:22:33 GMT => 2017');
    });
  });
});
