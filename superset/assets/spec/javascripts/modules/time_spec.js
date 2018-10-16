import moment from 'moment';
import { getPlaySliderParams, truncate } from '../../../src/modules/time';

describe('truncate', () => {
  it('truncates timestamps', () => {
    const timestamp = moment('2018-03-03T03:03:03.333');
    const isoDurations = [
      // basic units
      [moment.duration('PT1S'), moment('2018-03-03T03:03:03')],
      [moment.duration('PT1M'), moment('2018-03-03T03:03:00')],
      [moment.duration('PT1H'), moment('2018-03-03T03:00:00')],
      [moment.duration('P1D'), moment('2018-03-03T00:00:00')],
      [moment.duration('P1M'), moment('2018-03-01T00:00:00')],
      [moment.duration('P1Y'), moment('2018-01-01T00:00:00')],

      // durations that are multiples
      [moment.duration('PT2H'), moment('2018-03-03T02:00:00')],
      [moment.duration('P2D'), moment('2018-03-03T00:00:00')],
    ];
    let result;
    isoDurations.forEach(([step, expected]) => {
      result = truncate(timestamp, step);
      expect(result.format()).toBe(expected.format());
    });
  });
});

describe('getPlaySliderParams', () => {
  it('is a function', () => {
    expect(typeof getPlaySliderParams).toBe('function');
  });

  it('handles durations', () => {
    const timestamps = [
      moment('2018-01-01T00:00:00'),
      moment('2018-01-02T00:00:00'),
      moment('2018-01-03T00:00:00'),
      moment('2018-01-04T00:00:00'),
      moment('2018-01-05T00:00:00'),
      moment('2018-01-06T00:00:00'),
      moment('2018-01-07T00:00:00'),
      moment('2018-01-08T00:00:00'),
      moment('2018-01-09T00:00:00'),
      moment('2018-01-10T00:00:00'),
    ].map(d => parseInt(d.format('x'), 10));
    const { start, end, getStep, values, disabled } = getPlaySliderParams(timestamps, 'P2D');
    expect(moment(start).format()).toBe(moment('2018-01-01T00:00:00').format());
    expect(moment(end).format()).toBe(moment('2018-01-11T00:00:00').format());
    expect(getStep(start)).toBe(2 * 24 * 60 * 60 * 1000);
    expect(values.map(v => moment(v).format())).toEqual([
      moment('2018-01-01T00:00:00').format(),
      moment('2018-01-03T00:00:00').format(),
    ]);
    expect(disabled).toBe(false);
  });

  it('handles intervals', () => {
    const timestamps = [
      moment('2018-01-01T00:00:00'),
      moment('2018-01-02T00:00:00'),
      moment('2018-01-03T00:00:00'),
      moment('2018-01-04T00:00:00'),
      moment('2018-01-05T00:00:00'),
      moment('2018-01-06T00:00:00'),
      moment('2018-01-07T00:00:00'),
      moment('2018-01-08T00:00:00'),
      moment('2018-01-09T00:00:00'),
      moment('2018-01-10T00:00:00'),
    ].map(d => parseInt(d.format('x'), 10));
    // 1970-01-03 was a Saturday
    const { start, end, getStep, values, disabled } = getPlaySliderParams(timestamps, 'P1W/1970-01-03T00:00:00Z');
    expect(moment(start).format()).toBe(moment('2017-12-30T00:00:00Z').format());  // Saturday
    expect(moment(end).format()).toBe(moment('2018-01-13T00:00:00Z').format());  // Saturday
    expect(getStep(start)).toBe(7 * 24 * 60 * 60 * 1000);
    expect(values.map(v => moment(v).format())).toEqual([
      moment('2017-12-30T00:00:00Z').format(),
      moment('2018-01-06T00:00:00Z').format(),
    ]);
    expect(disabled).toBe(false);
  });
});
