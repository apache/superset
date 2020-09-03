import { createD3NumberFormatter } from '@superset-ui/core/src/number-format';

describe('createD3NumberFormatter(config)', () => {
  it('requires config.formatString', () => {
    // @ts-ignore -- intentionally pass invalid input
    expect(() => createD3NumberFormatter({})).toThrow();
  });
  describe('config.formatString', () => {
    it('creates a NumberFormatter with the formatString as id', () => {
      const formatter = createD3NumberFormatter({ formatString: '.2f' });
      expect(formatter.id).toEqual('.2f');
    });
    describe('if it is valid d3 formatString', () => {
      it('uses d3.format(config.formatString) as format function', () => {
        const formatter = createD3NumberFormatter({ formatString: '.2f' });
        expect(formatter.format(100)).toEqual('100.00');
      });
    });
    describe('if it is invalid d3 formatString', () => {
      it('The format function displays error message', () => {
        const formatter = createD3NumberFormatter({ formatString: 'i-am-groot' });
        expect(formatter.format(12345.67)).toEqual('12345.67 (Invalid format: i-am-groot)');
      });
      it('also set formatter.isInvalid to true', () => {
        const formatter = createD3NumberFormatter({ formatString: 'i-am-groot' });
        expect(formatter.isInvalid).toEqual(true);
      });
    });
  });
  describe('config.label', () => {
    it('set label if specified', () => {
      const formatter = createD3NumberFormatter({
        formatString: '.2f',
        label: 'float formatter',
      });
      expect(formatter.label).toEqual('float formatter');
    });
  });
  describe('config.description', () => {
    it('set decription if specified', () => {
      const formatter = createD3NumberFormatter({
        description: 'lorem ipsum',
        formatString: '.2f',
      });
      expect(formatter.description).toEqual('lorem ipsum');
    });
  });
  describe('config.locale', () => {
    it('supports locale customization such as currency', () => {
      const formatter = createD3NumberFormatter({
        description: 'lorem ipsum',
        formatString: '$.2f',
        locale: {
          decimal: '.',
          thousands: ',',
          grouping: [3],
          currency: ['€', ''],
        },
      });
      expect(formatter(200)).toEqual('€200.00');
    });
  });
});
