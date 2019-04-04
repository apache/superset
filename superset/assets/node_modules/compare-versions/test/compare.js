const assert = require('assert');
const compare = require('..');
const cmp = {
  '1':  '>',
  '0':  '=',
  '-1': '<',
};

const runTests = (dataSet) => {
  dataSet.forEach(([v1, v2, expected]) => {
    it(`${v1} ${cmp[expected]} ${v2}`, () => assert.equal(compare(v1, v2), expected));
  });
};

describe('compare versions', () => {
  describe('single-segment versions', () => {
    runTests([
      ['10', '9', 1],
      ['10', '10', 0],
      ['9', '10', -1],
    ]);
  });

  describe('two-segment versions', () => {
    runTests([
      ['10.8', '10.4', 1],
      ['10.1', '10.1', 0],
      ['10.1', '10.2', -1],
    ]);
  });

  describe('three-segment versions', () => {
    runTests([
      ['10.1.8', '10.0.4', 1],
      ['10.0.1', '10.0.1', 0],
      ['10.1.1', '10.2.2', -1],
    ]);
  });

  describe('four-segment versions - https://www.chromium.org/developers/version-numbers', () => {
    runTests([
      ['1.0.0.0', '1', 0],
      ['1.0.0.0', '1.0', 0],
      ['1.0.0.0', '1.0.0', 0],
      ['1.0.0.0', '1.0.0.0', 0],
      ['1.2.3.4', '1.2.3.4', 0],
      ['1.2.3.4', '1.2.3.04', 0],
      ['v1.2.3.4', '01.2.3.4', 0],
      ['1.2.3.4', '1.2.3.5', -1],
      ['1.2.3.5', '1.2.3.4', 1],
      ['1.0.0.0-alpha', '1.0.0-alpha', 0],
      ['1.0.0.0-alpha', '1.0.0.0-beta', -1],
    ]);
  });

  it('should compare versions with different number of digits in same group', () => {
    assert.equal(compare('11.0.10', '11.0.2'), 1);
    assert.equal(compare('11.0.2', '11.0.10'), -1);
  });

  it('should compare versions with different number of digits in different groups', () => {
    assert.equal(compare('11.1.10', '11.0'), 1);
  });

  it('should compare versions with different number of digits', () => {
    assert.equal(compare('1.1.1', '1'), 1);
    assert.equal(compare('1.0.0', '1'), 0);
    assert.equal(compare('1.0', '1.4.1'), -1);
  });

  describe('pre-release versions - https://semver.org/#spec-item-9', () => {
    runTests([
      ['1.0.0-alpha.1', '1.0.0-alpha', 1],
      ['1.0.0-alpha', '1.0.0-alpha.1', -1],
      ['1.0.0-alpha.1', '1.0.0-alpha.beta', -1],
      ['1.0.0-alpha.beta', '1.0.0-beta', -1],
      ['1.0.0-beta', '1.0.0-beta.2', -1],
      ['1.0.0-beta.2', '1.0.0-beta.11', -1],
      ['1.0.0-beta.11', '1.0.0-rc.1', -1],
      ['1.0.0-rc.1', '1.0.0', -1],
      ['1.0.0-alpha', '1', -1],
    ]);
  });

  describe('ignore build metadata - https://semver.org/#spec-item-10', () => {
    runTests([
      ['1.4.0-build.3928', '1.4.0-build.3928+sha.a8d9d4f', 0],
      ['1.4.0-build.3928+sha.b8dbdb0', '1.4.0-build.3928+sha.a8d9d4f', 0],
      ['1.0.0-alpha+001', '1.0.0-alpha', 0],
      ['1.0.0-beta+exp.sha.5114f85', '1.0.0-beta+exp.sha.999999', 0],
      ['1.0.0+20130313144700', '1.0.0', 0],
      ['1.0.0+20130313144700', '2.0.0', -1],
      ['1.0.0+20130313144700', '1.0.1+11234343435', -1],
      ['1.0.1+1', '1.0.1+2', 0],
      ['1.0.0+a-a', '1.0.0+a-b', 0],
    ]);
  });

  describe('ignore leading `v`', () => {
    runTests([
      ['v1.0.0', '1.0.0', 0],
      ['v1.0.0', 'v1.0.0', 0],
      ['v1.0.0', 'v1.0.0', 0],
      ['v1.0.0-alpha', '1.0.0-alpha', 0],
    ]);
  });

  describe('ignore leading `0`', () => {
    runTests([
      ['01.0.0', '1', 0],
      ['01.0.0', '1.0.0', 0],
      ['1.01.0', '1.01.0', 0],
      ['1.0.03', '1.0.3', 0],
      ['1.0.03-alpha', '1.0.3-alpha', 0],
      ['v01.0.0', '1.0.0', 0],
      ['v01.0.0', '2.0.0', -1],
    ]);
  });

  describe('invalid input', () => {
    [
      [42, /Invalid argument expected string/],
      [{}, /Invalid argument expected string/],
      [[], /Invalid argument expected string/],
      [() => undefined, /Invalid argument expected string/],
      ['6.3.', /Invalid argument not valid semver/],
      ['1.2.3a', /Invalid argument not valid semver/],
      ['1.2.-3a', /Invalid argument not valid semver/],
    ].forEach(([v1, exception]) => {
      it(`should throw on ${v1}`, () => {
        assert.throws(() => { compare(v1, v1); }, exception);
      });
    });
  });

  runTests([
    ['0.1.20', '0.1.5', 1],
    ['0.6.1-1', '0.6.1-0', 1],
    ['0.7.x', '0.6.0', 1],
    ['0.7.x', '0.6.0-asdf', 1],
    ['0.7.x', '0.6.2', 1],
    ['0.7.x', '0.7.0-asdf', 1],
    ['1', '0.0.0-beta', 1],
    ['1', '0.2.3', 1],
    ['1', '0.2.4', 1],
    ['1', '1.0.0-0', 1],
    ['1', '1.0.0-beta', 1],
    ['1.0', '0.0.0', 1],
    ['1.0', '0.1.0', 1],
    ['1.0', '0.1.2', 1],
    ['1.0.0', '0.0.0', 1],
    ['1.0.0', '0.0.1', 1],
    ['1.0.0', '0.2.3', 1],
    ['1.0.0-beta.2', '1.0.0-beta.1', 1],
    ['1.2.*', '1.1.3', 1],
    ['1.2.*', '1.1.9999', 1],
    ['1.2.2', '1.2.1', 1],
    ['1.2.x', '1.0.0', 1],
    ['1.2.x', '1.1.0', 1],
    ['1.2.x', '1.1.3', 1],
    ['2', '1.0.0', 1],
    ['2', '1.0.0-beta', 1],
    ['2', '1.9999.9999', 1],
    ['2.*.*', '1.0.1', 1],
    ['2.*.*', '1.1.3', 1],
    ['2.0.0', '1.0.0', 1],
    ['2.0.0', '1.1.1', 1],
    ['2.0.0', '1.2.9', 1],
    ['2.0.0', '1.9999.9999', 1],
    ['2.3', '2.2.1', 1],
    ['2.3', '2.2.2', 1],
    ['2.4', '2.3.0', 1],
    ['2.4', '2.3.5', 1],
    ['2.x.x', '1.0.0', 1],
    ['2.x.x', '1.1.3', 1],
    ['3.2.1', '2.3.2', 1],
    ['3.2.1', '3.2.0', 1],
    ['v0.5.4-pre', '0.5.4-alpha', 1],
    ['v3.2.1', 'v2.3.2', 1],
  ]);
});