import inferFieldType from '../../src/fillers/inferFieldType';

describe('inferFieldType(channelType, field)', () => {
  it('returns quantitative when it should', () => {
    expect(inferFieldType('XBand', 'speed')).toEqual('quantitative');
    expect(inferFieldType('YBand', 'price')).toEqual('quantitative');
  });
  it('returns temporal when it should', () => {
    expect(inferFieldType('X', 'time')).toEqual('temporal');
    expect(inferFieldType('Numeric', 'timestamp')).toEqual('temporal');
  });
  it('returns nominal when it should', () => {
    expect(inferFieldType('Color', 'brand')).toEqual('nominal');
    expect(inferFieldType('Category', 'material')).toEqual('nominal');
  });
});
