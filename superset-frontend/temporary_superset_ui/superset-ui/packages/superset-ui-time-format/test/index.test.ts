import {
  createD3TimeFormatter,
  createMultiFormatter,
  formatTime,
  getTimeFormatter,
  getTimeFormatterRegistry,
  LOCAL_PREFIX,
  PREVIEW_TIME,
  smartDateFormatter,
  smartDateVerboseFormatter,
  TimeFormats,
  TimeFormatter,
} from '../src';

describe('index', () => {
  it('exports modules', () => {
    [
      createD3TimeFormatter,
      createMultiFormatter,
      formatTime,
      getTimeFormatter,
      getTimeFormatterRegistry,
      LOCAL_PREFIX,
      PREVIEW_TIME,
      smartDateFormatter,
      smartDateVerboseFormatter,
      TimeFormats,
      TimeFormatter,
    ].forEach(x => expect(x).toBeDefined());
  });
});
