import { it, describe } from 'mocha';
import { assert, expect } from 'chai';
import moment from 'moment';

import {
  tickMultiFormat,
  formatDate,
  fDuration,
  now,
  epochTimeXHoursAgo,
  epochTimeXDaysAgo,
  epochTimeXYearsAgo,
  granularityToEpoch,
 } from '../../../javascripts/modules/dates';

describe('tickMultiFormat', () => {
  it('is a function', () => {
    assert.isFunction(tickMultiFormat);
  });
});

describe('formatDate', () => {
  it('is a function', () => {
    assert.isFunction(formatDate);
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


const ONE_MILLISECOND = moment.duration(1).asMilliseconds();
const ONE_SECOND = moment.duration(1, 'second').asMilliseconds();
const TWO_SECONDS = moment.duration(2, 'second').asMilliseconds();
const ONE_MINUTE = moment.duration(1, 'minute').asMilliseconds();
const FIFTEEN_MINUTES = moment.duration(15, 'minute').asMilliseconds();
const THIRTY_MINUTES = moment.duration(30, 'minute').asMilliseconds();
const ONE_HOUR = moment.duration(1, 'hour').asMilliseconds();
const ONE_DAY = moment.duration(1, 'day').asMilliseconds();
const ONE_WEEK = moment.duration(7, 'days').asMilliseconds();
const ONE_MONTH = moment.duration(1, 'month').asMilliseconds();
const ONE_QUARTER = moment.duration(1, 'quarter').asMilliseconds();
const ONE_YEAR = moment.duration(1, 'year').asMilliseconds();
const FIVE_YEARS = moment.duration(5, 'year').asMilliseconds();

describe('granularityToEpoch', () => {
  it('handles numbers', () => {
    assert.equal(granularityToEpoch(1), ONE_MILLISECOND);
    assert.equal(granularityToEpoch(1000), ONE_SECOND);
  });
  it('handles human', () => {
    assert.equal(granularityToEpoch('1 millisecond'), ONE_MILLISECOND);
    assert.equal(granularityToEpoch('1 second'), ONE_SECOND);
    assert.equal(granularityToEpoch('2 second'), TWO_SECONDS);
    assert.equal(granularityToEpoch('2 seConds'), TWO_SECONDS);
    assert.equal(granularityToEpoch('1 minute'), ONE_MINUTE);
    assert.equal(granularityToEpoch('1 hour'), ONE_HOUR);
    assert.equal(granularityToEpoch('1 day'), ONE_DAY);
    assert.equal(granularityToEpoch('1 week'), ONE_WEEK);
    assert.equal(granularityToEpoch('1 month'), ONE_MONTH);
    assert.equal(granularityToEpoch('1 quarter'), ONE_QUARTER);
    assert.equal(granularityToEpoch('1 year'), ONE_YEAR);
    assert.equal(granularityToEpoch('5 years'), FIVE_YEARS);
  });
  it('handles SQL', () => {
    assert.equal(granularityToEpoch('second'), ONE_SECOND);
    assert.equal(granularityToEpoch('minute'), ONE_MINUTE);
    assert.equal(granularityToEpoch('hour'), ONE_HOUR);
    assert.equal(granularityToEpoch('day'), ONE_DAY);
    assert.equal(granularityToEpoch('week'), ONE_WEEK);
    assert.equal(granularityToEpoch('month'), ONE_MONTH);
    assert.equal(granularityToEpoch('quarter'), ONE_QUARTER);
    assert.equal(granularityToEpoch('year'), ONE_YEAR);
  });
  it('handles ISO 8601', () => {
    assert.equal(granularityToEpoch('PT1S'), ONE_SECOND);
    assert.equal(granularityToEpoch('PT2S'), TWO_SECONDS);
    assert.equal(granularityToEpoch('PT1M'), ONE_MINUTE);
    assert.equal(granularityToEpoch('PT1H'), ONE_HOUR);
    assert.equal(granularityToEpoch('P1D'), ONE_DAY);
    assert.equal(granularityToEpoch('P1W'), ONE_WEEK);
    assert.equal(granularityToEpoch('P1M'), ONE_MONTH);
    assert.equal(granularityToEpoch('P1Y'), ONE_YEAR);
    assert.equal(granularityToEpoch('P5Y'), FIVE_YEARS);
  });
  it('handles Druid', () => {
    assert.equal(granularityToEpoch('all'), 0);
    assert.equal(granularityToEpoch('none'), 0);
    assert.equal(granularityToEpoch('second'), ONE_SECOND);
    assert.equal(granularityToEpoch('minute'), ONE_MINUTE);
    assert.equal(granularityToEpoch('fifteen_minute'), FIFTEEN_MINUTES);
    assert.equal(granularityToEpoch('thirty_minute'), THIRTY_MINUTES);
    assert.equal(granularityToEpoch('hour'), ONE_HOUR);
    assert.equal(granularityToEpoch('day'), ONE_DAY);
    assert.equal(granularityToEpoch('week'), ONE_WEEK);
    assert.equal(granularityToEpoch('month'), ONE_MONTH);
    assert.equal(granularityToEpoch('quarter'), ONE_QUARTER);
    assert.equal(granularityToEpoch('year'), ONE_YEAR);
  });
  it('handles bad input', () => {
    assert.equal(granularityToEpoch(null), 0);
    assert.equal(granularityToEpoch(undefined), 0);
    assert.equal(granularityToEpoch('fsdf'), 0);
    assert.equal(granularityToEpoch({}), 0);
    assert.equal(granularityToEpoch([]), 0);
  });
});
