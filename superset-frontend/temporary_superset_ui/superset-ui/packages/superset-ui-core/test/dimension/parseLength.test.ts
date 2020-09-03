import { parseLength } from '@superset-ui/core/src';

describe('parseLength(input)', () => {
  it('handles string "auto"', () => {
    expect(parseLength('auto')).toEqual({ isDynamic: true, multiplier: 1 });
  });

  it('handles strings with % at the end', () => {
    expect(parseLength('100%')).toEqual({ isDynamic: true, multiplier: 1 });
    expect(parseLength('50%')).toEqual({ isDynamic: true, multiplier: 0.5 });
    expect(parseLength('0%')).toEqual({ isDynamic: true, multiplier: 0 });
  });

  it('handles strings that are numbers with px at the end', () => {
    expect(parseLength('100px')).toEqual({ isDynamic: false, value: 100 });
    expect(parseLength('20.5px')).toEqual({ isDynamic: false, value: 20.5 });
  });

  it('handles strings that are numbers', () => {
    expect(parseLength('100')).toEqual({ isDynamic: false, value: 100 });
    expect(parseLength('40.5')).toEqual({ isDynamic: false, value: 40.5 });
    expect(parseLength('20.0')).toEqual({ isDynamic: false, value: 20 });
  });

  it('handles numbers', () => {
    expect(parseLength(100)).toEqual({ isDynamic: false, value: 100 });
    expect(parseLength(0)).toEqual({ isDynamic: false, value: 0 });
  });
});
