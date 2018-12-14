import createD3TimeFormatter from '../../src/factories/createD3TimeFormatter';
import { PREVIEW_TIME } from '../../src/TimeFormatter';
import { TimeFormats } from '../../src';

describe('createD3TimeFormatter(config)', () => {
  it('requires config.formatString', () => {
    expect(() => createD3TimeFormatter()).toThrow();
    expect(() => createD3TimeFormatter({})).toThrow();
  });
  describe('if config.useLocalTime is true', () => {
    it('formats in local time', () => {
      const formatter = createD3TimeFormatter({
        formatString: TimeFormats.DATABASE_DATETIME,
        useLocalTime: true,
      });
      const offset = new Date().getTimezoneOffset();
      if (offset === 0) {
        expect(formatter.format(PREVIEW_TIME)).toEqual('2017-02-14 11:22:33');
      } else {
        expect(formatter.format(PREVIEW_TIME)).not.toEqual('2017-02-14 11:22:33');
      }
    });
  });
  describe('if config.useLocalTime is false', () => {
    it('formats in UTC time', () => {
      const formatter = createD3TimeFormatter({
        formatString: TimeFormats.DATABASE_DATETIME,
      });
      expect(formatter.format(PREVIEW_TIME)).toEqual('2017-02-14 11:22:33');
    });
  });
});
