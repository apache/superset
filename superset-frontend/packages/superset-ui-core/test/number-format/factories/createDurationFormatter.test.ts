import { NumberFormatter, createDurationFormatter } from '@superset-ui/core/src/number-format';

describe('createDurationFormatter()', () => {
  it('creates an instance of NumberFormatter', () => {
    const formatter = createDurationFormatter();
    expect(formatter).toBeInstanceOf(NumberFormatter);
  });
  it('format milliseconds in human readable format with default options', () => {
    const formatter = createDurationFormatter();
    expect(formatter(0)).toBe('0ms');
    expect(formatter(1000)).toBe('1s');
    expect(formatter(1337)).toBe('1.3s');
    expect(formatter(10500)).toBe('10.5s');
    expect(formatter(60 * 1000)).toBe('1m');
    expect(formatter(90 * 1000)).toBe('1m 30s');
  });
  it('format seconds in human readable format with default options', () => {
    const formatter = createDurationFormatter({ multiplier: 1000 });
    expect(formatter(0.5)).toBe('500ms');
    expect(formatter(1)).toBe('1s');
    expect(formatter(30)).toBe('30s');
    expect(formatter(60)).toBe('1m');
    expect(formatter(90)).toBe('1m 30s');
  });
  it('format milliseconds in human readable format with additional pretty-ms options', () => {
    const colonNotationFormatter = createDurationFormatter({ colonNotation: true });
    expect(colonNotationFormatter(10500)).toBe('0:10.5');
    const zeroDecimalFormatter = createDurationFormatter({ secondsDecimalDigits: 0 });
    expect(zeroDecimalFormatter(10500)).toBe('10s');
    const subMillisecondFormatter = createDurationFormatter({ formatSubMilliseconds: true });
    expect(subMillisecondFormatter(100.40008)).toBe('100ms 400µs 80ns');
  });
});
