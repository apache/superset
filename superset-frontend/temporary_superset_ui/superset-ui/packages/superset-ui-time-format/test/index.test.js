import {
  formatTime,
  TimeFormats,
  getTimeFormatter,
  getTimeFormatterRegistry,
  TimeFormatter,
  PREVIEW_TIME,
} from '../src/index';

describe('index', () => {
  it('exports modules', () => {
    [
      formatTime,
      TimeFormats,
      getTimeFormatter,
      getTimeFormatterRegistry,
      TimeFormatter,
      PREVIEW_TIME,
    ].forEach(x => expect(x).toBeDefined());
  });
});
