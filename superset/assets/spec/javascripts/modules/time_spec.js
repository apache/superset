import { it, describe } from 'mocha';
import { expect } from 'chai';
import { parseTimeGrain } from '../../../javascripts/modules/time';

describe('parseTimeGrain', () => {
  it('is a function', () => {
    assert.isFunction(parseTimeGrain);
  });

  it('returns a number', () => {
    expect(parseTimeGrain('minute')).to.be.a('number');
  });

  it('returns the expected output', () => {
    expect(parseTimeGrain('second')).to.equal(1000);
    expect(parseTimeGrain('5 seconds')).to.equal(5000);
    expect(parseTimeGrain('30 seconds')).to.equal(30000);
    expect(parseTimeGrain('minute')).to.equal(60000);
    expect(parseTimeGrain('1 minute')).to.equal(60000);
    expect(parseTimeGrain('5 minute')).to.equal(300000);
    expect(parseTimeGrain('5 minutes')).to.equal(300000);
    expect(parseTimeGrain('10 minute')).to.equal(600000);
    expect(parseTimeGrain('hour')).to.equal(3600000);
    expect(parseTimeGrain('half hour')).to.equal(1800000);
    expect(parseTimeGrain('1 hour')).to.equal(3600000);
    expect(parseTimeGrain('6 hour')).to.equal(21600000);
    expect(parseTimeGrain('day')).to.equal(86400000);
    expect(parseTimeGrain('1 day')).to.equal(86400000);
    expect(parseTimeGrain('7 day')).to.equal(604800000);
    expect(parseTimeGrain('week')).to.equal(604800000);
    expect(parseTimeGrain('week_starting_sunday')).to.equal(604800000);
    expect(parseTimeGrain('week_ending_saturday')).to.equal(604800000);
    expect(parseTimeGrain('month')).to.equal(2592000000);
    expect(parseTimeGrain('quarter')).to.equal(7884000000);
    expect(parseTimeGrain('year')).to.equal(31536000000);
  });
});
