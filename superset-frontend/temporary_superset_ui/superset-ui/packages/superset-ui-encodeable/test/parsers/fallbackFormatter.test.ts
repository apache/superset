import fallbackFormatter from '../../src/parsers/fallbackFormatter';

describe('fallbackFormatter(v: any)', () => {
  it('handles primitive types', () => {
    expect(fallbackFormatter(undefined)).toEqual('undefined');
    expect(fallbackFormatter(null)).toEqual('null');
    expect(fallbackFormatter(true)).toEqual('true');
    expect(fallbackFormatter(false)).toEqual('false');
    expect(fallbackFormatter(0)).toEqual('0');
    expect(fallbackFormatter(1)).toEqual('1');
    expect(fallbackFormatter(-1)).toEqual('-1');
  });
  it('handles arrays', () => {
    expect(fallbackFormatter([])).toEqual('');
    expect(fallbackFormatter(['def'])).toEqual('def');
    expect(fallbackFormatter(['def', 'ghi'])).toEqual('def,ghi');
  });
  it('handles objects', () => {
    expect(fallbackFormatter({})).toEqual('[object Object]');
    expect(fallbackFormatter({ abc: 1 })).toEqual('[object Object]');
  });
});
