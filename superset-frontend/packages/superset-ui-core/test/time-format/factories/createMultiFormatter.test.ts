import createMultiFormatter from '@superset-ui/core/src/time-format/factories/createMultiFormatter';

describe('createMultiFormatter()', () => {
  describe('creates a multi-step formatter', () => {
    const formatter = createMultiFormatter({
      id: 'my_format',
      useLocalTime: true,
    });
    it('formats millisecond', () => {
      expect(formatter(new Date(2018, 10, 20, 11, 22, 33, 100))).toEqual('.100');
    });
    it('formats second', () => {
      expect(formatter(new Date(2018, 10, 20, 11, 22, 33))).toEqual(':33');
    });
    it('format minutes', () => {
      expect(formatter(new Date(2018, 10, 20, 11, 22))).toEqual('11:22');
    });
    it('format hours', () => {
      expect(formatter(new Date(2018, 10, 20, 11))).toEqual('11 AM');
    });
    it('format first day of week', () => {
      expect(formatter(new Date(2018, 10, 18))).toEqual('Nov 18');
    });
    it('format other day of week', () => {
      expect(formatter(new Date(2018, 10, 20))).toEqual('Tue 20');
    });
    it('format month', () => {
      expect(formatter(new Date(2018, 10))).toEqual('November');
    });
    it('format year', () => {
      expect(formatter(new Date(2018, 0))).toEqual('2018');
    });
  });
});
