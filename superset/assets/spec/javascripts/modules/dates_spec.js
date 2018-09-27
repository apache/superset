import { assert, expect } from 'chai';
import {
  tickMultiFormat,
  formatDate,
  formatDateVerbose,
  fDuration,
  now,
  epochTimeXHoursAgo,
  epochTimeXDaysAgo,
  epochTimeXYearsAgo,
 } from '../../../src/modules/dates';

describe('tickMultiFormat', () => {
  it('is a function', () => {
    assert.isFunction(tickMultiFormat);
  });
});

describe('formatDate', () => {
  it('is a function', () => {
    assert.isFunction(formatDate);
  });

  it('shows only year when 1st day of the year', () => {
    expect(formatDate(new Date('2020-01-01'))).to.equal('2020');
  });

  it('shows only month when 1st of month', () => {
    expect(formatDate(new Date('2020-03-01'))).to.equal('March');
  });

  it('does not show day of week when it is Sunday', () => {
    expect(formatDate(new Date('2020-03-15'))).to.equal('Mar 15');
  });

  it('shows weekday when it is not Sunday (and no ms/sec/min/hr)', () => {
    expect(formatDate(new Date('2020-03-03'))).to.equal('Tue 03');
  });
});

describe('formatDateVerbose', () => {
  it('is a function', () => {
    assert.isFunction(formatDateVerbose);
  });

  it('shows only year when 1st day of the year', () => {
    expect(formatDateVerbose(new Date('2020-01-01'))).to.equal('2020');
  });

  it('shows month and year when 1st of month', () => {
    expect(formatDateVerbose(new Date('2020-03-01'))).to.equal('Mar 2020');
  });

  it('shows weekday when any day of the month', () => {
    expect(formatDateVerbose(new Date('2020-03-03'))).to.equal('Tue Mar 3');
    expect(formatDateVerbose(new Date('2020-03-15'))).to.equal('Sun Mar 15');
  });
});

describe('fDuration', () => {
  it('is a function', () => {
    assert.isFunction(fDuration);
  });

  it('returns a string', () => {
    expect(fDuration(new Date(), new Date())).to.be.a('string');
  });

  it('returns the expected output', () => {
    const output = fDuration('1496293608897', '1496293623406');
    expect(output).to.equal('00:00:14.50');
  });
});

describe('now', () => {
  it('is a function', () => {
    assert.isFunction(now);
  });

  it('returns a number', () => {
    expect(now()).to.be.a('number');
  });
});

describe('epochTimeXHoursAgo', () => {
  it('is a function', () => {
    assert.isFunction(epochTimeXHoursAgo);
  });

  it('returns a number', () => {
    expect(epochTimeXHoursAgo(1)).to.be.a('number');
  });
});

describe('epochTimeXDaysAgo', () => {
  it('is a function', () => {
    assert.isFunction(epochTimeXDaysAgo);
  });

  it('returns a number', () => {
    expect(epochTimeXDaysAgo(1)).to.be.a('number');
  });
});

describe('epochTimeXYearsAgo', () => {
  it('is a function', () => {
    assert.isFunction(epochTimeXYearsAgo);
  });

  it('returns a number', () => {
    expect(epochTimeXYearsAgo(1)).to.be.a('number');
  });
});
