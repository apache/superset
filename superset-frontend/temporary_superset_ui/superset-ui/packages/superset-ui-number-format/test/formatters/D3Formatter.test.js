import D3Formatter from '../../src/formatters/D3Formatter';

describe('D3Formatter', () => {
  describe('new D3Formatter(config)', () => {
    it('requires configOrFormatString', () => {
      expect(() => new D3Formatter()).toThrow();
    });
    describe('if configOrFormatString is string', () => {
      it('uses the input as d3.format string', () => {
        const formatter = new D3Formatter('.2f');
        expect(formatter.format(100)).toEqual('100.00');
      });
    });
    describe('if configOrFormatString is not string', () => {
      it('requires field config.id', () => {
        expect(() => new D3Formatter({})).toThrow();
      });
      it('uses d3.format(config.id) as format function', () => {
        const formatter = new D3Formatter({ id: ',.4f' });
        expect(formatter.format(12345.67)).toEqual('12,345.6700');
      });
      it('if it is an invalid d3 format, the format function displays error message', () => {
        const formatter = new D3Formatter({ id: 'i-am-groot' });
        expect(formatter.format(12345.67)).toEqual('Invalid format: i-am-groot');
      });
    });
  });
});
