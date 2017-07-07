import { it, describe } from 'mocha';
import { expect } from 'chai';
import {
  tickMultiFormat,
  formatDate,
  fDuration,
  now,
  addXHours,
  epochTimeXHoursAgo,
  epochTimeXDaysAgo,
  epochTimeXYearsAgo,
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

describe('addXHours', () => {
  it('is a function', () => {
    assert.isFunction(addXHours);
  });

  it('returns a number', () => {
    expect(addXHours(0, 0)).to.be.a('number');
  });

  it('returns the expected output', () => {
    expect(addXHours(1496293608897, 24)).to.equal(1496380008897);
  });

  it('returns the expected output', () => {
    expect(addXHours(1496293608897, 0)).to.equal(1496293608897);
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
