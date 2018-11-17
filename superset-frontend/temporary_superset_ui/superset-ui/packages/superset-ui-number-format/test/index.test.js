import {
  formatNumber,
  NumberFormats,
  getNumberFormatter,
  getNumberFormatterRegistry,
  NumberFormatter,
  PREVIEW_VALUE,
} from '../src/index';

describe('index', () => {
  it('exports modules', () => {
    [
      formatNumber,
      NumberFormats,
      getNumberFormatter,
      getNumberFormatterRegistry,
      NumberFormatter,
      PREVIEW_VALUE,
    ].forEach(x => expect(x).toBeDefined());
  });
});
