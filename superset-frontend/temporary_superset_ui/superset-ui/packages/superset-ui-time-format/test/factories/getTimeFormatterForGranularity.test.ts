import getFormatter from '../../src/factories/getTimeFormatterForGranularity';
import smartDateVerbose from '../../src/formatters/smartDateVerbose';

describe('getTimeFormatterForGranularity()', () => {
  it('use smartDate when granularity unknown or undefined', () => {
    expect(getFormatter(undefined)).toBe(smartDateVerbose);
    // @ts-ignore
    expect(getFormatter('random-string')).toBe(smartDateVerbose);
  });

  it('format time for known granularities', () => {
    // JS Date constructor month is zero-based
    const date = new Date(2020, 4, 10, 11, 10, 1); // May 10, 2020 is Sunday
    expect(getFormatter('date')(date)).toBe('2020-05-10');
    expect(getFormatter('PT1S')(date)).toBe('2020-05-10 11:10:01');
    expect(getFormatter('PT1M')(date)).toBe('2020-05-10 11:10');
    expect(getFormatter('PT5M')(date)).toBe('2020-05-10 11:10');
    expect(getFormatter('PT10M')(date)).toBe('2020-05-10 11:10');
    expect(getFormatter('PT15M')(date)).toBe('2020-05-10 11:10');
    expect(getFormatter('PT0.5H')(date)).toBe('2020-05-10 11:10');
    expect(getFormatter('PT1H')(date)).toBe('2020-05-10 11:00');
    expect(getFormatter('P1D')(date)).toBe('2020-05-10');
    expect(getFormatter('P1W')(date)).toBe('2020-05-10');
    expect(getFormatter('P1M')(date)).toBe('2020-05');
    expect(getFormatter('P0.25Y')(date)).toBe('2020 Q2');
    expect(getFormatter('P1Y')(date)).toBe('2020');
    // sunday based week
    expect(getFormatter('1969-12-28T00:00:00Z/P1W')(date)).toBe('2020-05-10');
    expect(getFormatter('P1W/1970-01-03T00:00:00Z')(date)).toBe('2020-05-10');
    // monday based week
    expect(getFormatter('1969-12-29T00:00:00Z/P1W')(date)).toBe('2020-05-10');
    expect(getFormatter('P1W/1970-01-04T00:00:00Z')(date)).toBe('2020-05-10');
  });
});
