import inferScaleType from '../../src/fillers/inferScaleType';

describe('inferScaleType(channelType, fieldType, isBinned)', () => {
  describe('for nominal and ordinal fields', () => {
    it('returns band when it should', () => {
      expect(inferScaleType('XBand', 'nominal')).toEqual('band');
      expect(inferScaleType('YBand', 'ordinal')).toEqual('band');
    });
    it('returns point when it should', () => {
      expect(inferScaleType('X', 'nominal')).toEqual('point');
      expect(inferScaleType('Y', 'ordinal')).toEqual('point');
    });
    it('returns ordinal when it should', () => {
      expect(inferScaleType('Color', 'nominal')).toEqual('ordinal');
      expect(inferScaleType('Category', 'ordinal')).toEqual('ordinal');
    });
  });
  describe('for quantitative fields', () => {
    it('returns linear in general', () => {
      expect(inferScaleType('XBand', 'quantitative')).toEqual('linear');
      expect(inferScaleType('YBand', 'quantitative')).toEqual('linear');
      expect(inferScaleType('X', 'quantitative')).toEqual('linear');
      expect(inferScaleType('Y', 'quantitative')).toEqual('linear');
      expect(inferScaleType('Numeric', 'quantitative')).toEqual('linear');
    });
    it('return bin-ordinal for binned color', () => {
      expect(inferScaleType('Color', 'quantitative', true)).toEqual('bin-ordinal');
    });
    it('return linear for color', () => {
      expect(inferScaleType('Color', 'quantitative')).toEqual('linear');
    });
  });
  describe('for temporal fields', () => {
    it('returns UTC time scale in general', () => {
      expect(inferScaleType('XBand', 'temporal')).toEqual('utc');
      expect(inferScaleType('YBand', 'temporal')).toEqual('utc');
      expect(inferScaleType('X', 'temporal')).toEqual('utc');
      expect(inferScaleType('Y', 'temporal')).toEqual('utc');
      expect(inferScaleType('Numeric', 'temporal')).toEqual('utc');
    });
    it('returns linear for color', () => {
      expect(inferScaleType('Color', 'temporal')).toEqual('linear');
    });
  });
  describe('for other channel types', () => {
    it('returns undefined', () => {
      expect(inferScaleType('Text', 'quantitative')).toBeUndefined();
      expect(inferScaleType('Text', 'nominal')).toBeUndefined();
      expect(inferScaleType('Text', 'ordinal')).toBeUndefined();
      expect(inferScaleType('Text', 'temporal')).toBeUndefined();
    });
  });
  describe('for undefined fieldType', () => {
    it('returns undefined', () => {
      expect(inferScaleType('X')).toBeUndefined();
    });
  });
});
