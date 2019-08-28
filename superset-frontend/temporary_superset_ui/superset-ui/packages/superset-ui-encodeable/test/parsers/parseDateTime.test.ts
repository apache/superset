import parseDateTime from '../../src/parsers/parseDateTime';

describe('parseDateTime(dateTime)', () => {
  it('parses number', () => {
    expect(parseDateTime(1560384000000)).toEqual(new Date(Date.UTC(2019, 5, 13)));
  });
  it('parses string', () => {
    expect(parseDateTime('2019-01-01')).toEqual(new Date('2019-01-01'));
  });
  it('parse DateTime object', () => {
    expect(
      parseDateTime({
        year: 2019,
        month: 6,
        date: 14,
      }),
    ).toEqual(new Date(2019, 5, 14));
  });
  it('handles utc correctly', () => {
    expect(
      parseDateTime({
        year: 2019,
        month: 6,
        date: 14,
        utc: true,
      }),
    ).toEqual(new Date(Date.UTC(2019, 5, 14)));
  });
});
