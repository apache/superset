// test data type Range

var assert = require('assert');
var math = require('../../../index');
var Range = math.type.Range;

describe('range', function() {
  describe('create', function() {

    it('should create a range', function() {
      var r = new Range(2,6);
      assert.deepEqual(r.toArray(), [2,3,4,5]);
      assert.equal(r.size(), 4);
    });

    it('should create a range with custom step', function() {
      var r = new Range(10, 4, -1);
      assert.deepEqual(r.toArray(), [10,9,8,7,6,5]);
      assert.equal(r.size(), 6);
    });

    it('should create a range with floating points', function() {
      var r = new Range(1, 5.5, 1.5);
      assert.deepEqual(r.toArray(), [1,2.5,4]);
      assert.equal(r.size(), 3);
    });

    it('should create an empty range', function() {
      var r = new Range();
      assert.deepEqual(r.toArray(), []);
    });

    it('should create a range with only one value', function() {
      var r = new Range(0,1);
      assert.deepEqual(r.toArray(), [0]);
      assert.equal(r.size(), 1);
    });

    it('should create an empty range because of wrong step size', function() {
      var r = new Range(0,10,0);
      assert.deepEqual(r.toArray(), []);
      assert.equal(r.size(), 0);

      r = new Range(0,10,-1);
      assert.deepEqual(r.toArray(), []);
      assert.equal(r.size(), 0);
    });

    it('should throw an error when created without new keyword', function() {
      assert.throws(function () {Range(0,10)}, /Constructor must be called with the new operator/)
    });

    it('should throw an error for wrong type of arguments', function() {
      assert.throws(function () {new Range('str', 10, 1)}, /Parameter start must be a number/)
      assert.throws(function () {new Range(0, 'str', 1)}, /Parameter end must be a number/)
      assert.throws(function () {new Range(0, 10, 'str')}, /Parameter step must be a number/)
    });
  });

  describe('parse', function () {
    it('should create a range from a string', function() {
      var r = Range.parse('10:-1:4');
      assert.deepEqual(r.toArray(), [10,9,8,7,6,5]);
      assert.equal(r.size(), 6);

      r = Range.parse('2 : 6');
      assert.deepEqual(r.toArray(), [2,3,4,5]);
      assert.equal(r.size(), 4);
    });

    it('should return null when parsing an invalid string', function() {
      assert.equal(Range.parse('a:4'), null);
      assert.equal(Range.parse('3'), null);
      assert.equal(Range.parse(''), null);
      assert.equal(Range.parse(2), null);
    });

  });

  describe('size', function () {
    it('should calculate the size of a range', function() {
      assert.deepEqual(new Range(0, 0).size(), [0]);
      assert.deepEqual(new Range(0, 0, -1).size(), [0]);
      assert.deepEqual(new Range(0, 0, 0).size(), [0]);

      assert.deepEqual(new Range(0, 4).size(), [4]);
      assert.deepEqual(new Range(2, 4).size(), [2]);
      assert.deepEqual(new Range(0, 8, 2).size(), [4]);
      assert.deepEqual(new Range(0, 8.1, 2).size(), [5]);
      assert.deepEqual(new Range(0, 7.9, 2).size(), [4]);
      assert.deepEqual(new Range(0, 7, 2).size(), [4]);

      assert.deepEqual(new Range(3, -1, -1).size(), [4]);
      assert.deepEqual(new Range(3, -1.1, -1).size(), [5]);
      assert.deepEqual(new Range(3, -0.9, -1).size(), [4]);
      assert.deepEqual(new Range(3, -1, -2).size(), [2]);
      assert.deepEqual(new Range(3, -0.9, -2).size(), [2]);
      assert.deepEqual(new Range(3, -1.1, -2).size(), [3]);
      assert.deepEqual(new Range(3, 0.1, -2).size(), [2]);
    });
  });

  describe('min', function () {
    it('should calculate the minimum value of a range', function() {
      assert.strictEqual(new Range(0, 0).min(), undefined);
      assert.strictEqual(new Range(0, 0, -1).min(), undefined);

      assert.strictEqual(new Range(0, 4).min(), 0);
      assert.strictEqual(new Range(2, 4).min(), 2);
      assert.strictEqual(new Range(0, 8, 2).min(), 0);
      assert.strictEqual(new Range(0, 8.1, 2).min(), 0);
      assert.strictEqual(new Range(0, 7.9, 2).min(), 0);
      assert.strictEqual(new Range(0, 7, 2).min(), 0);

      assert.strictEqual(new Range(3, -1, -1).min(), 0);
      assert.strictEqual(new Range(3, -1.1, -1).min(), -1);
      assert.strictEqual(new Range(3, -0.9, -1).min(), 0);
      assert.strictEqual(new Range(3, -1, -2).min(), 1);
      assert.strictEqual(new Range(3, -0.9, -2).min(), 1);
      assert.strictEqual(new Range(3, -1.1, -2).min(), -1);
      assert.strictEqual(new Range(3, 0.1, -2).min(), 1);
    });
  });

  describe('max', function () {
    it('should calculate the maximum value of a range', function() {
      assert.strictEqual(new Range(0, 0).max(), undefined);
      assert.strictEqual(new Range(0, 0, -1).max(), undefined);

      assert.strictEqual(new Range(2, 4).max(), 3);
      assert.strictEqual(new Range(0, 8, 2).max(), 6);
      assert.strictEqual(new Range(0, 8.1, 2).max(), 8);
      assert.strictEqual(new Range(0, 7.9, 2).max(), 6);
      assert.strictEqual(new Range(0, 7, 2).max(), 6);

      assert.strictEqual(new Range(3, -1, -1).max(), 3);
      assert.strictEqual(new Range(3, -1.1, -1).max(), 3);
      assert.strictEqual(new Range(3, -0.9, -1).max(), 3);
      assert.strictEqual(new Range(3, -1, -2).max(), 3);
      assert.strictEqual(new Range(3, -0.9, -2).max(), 3);
      assert.strictEqual(new Range(3, -1.1, -2).max(), 3);
      assert.strictEqual(new Range(3, 0.1, -2).max(), 3);
    });
  });

  describe('toString', function () {
    it('should stringify a range to format start:step:end', function () {
      assert.equal(new math.type.Range(0,10).toString(), '0:10');
      assert.equal(new math.type.Range(0,10,2).toString(), '0:2:10');
    });

    it('should stringify a range to format start:step:end with given precision', function () {
      assert.equal(new math.type.Range(1/3, 4/3, 2/3).format(3), '0.333:0.667:1.33');
      assert.equal(new math.type.Range(1/3, 4/3, 2/3).format(4), '0.3333:0.6667:1.333');
      assert.equal(new math.type.Range(1/3, 4/3, 2/3).format(), '0.3333333333333333:0.6666666666666666:1.3333333333333333');
    });
  });

  describe('clone', function () {
    it('should clone a Range', function () {
      var r1 = new Range(0, 10, 2);
      var r2 = r1.clone();

      assert.deepEqual(r1, r2);
      assert.notStrictEqual(r1, r2);

      // changes in r1 should not affect r2
      r1.start = 2;
      r1.end = 8;
      r1.step = 1;

      assert.equal(r1.start, 2);
      assert.equal(r1.end, 8);
      assert.equal(r1.step, 1);
      assert.equal(r2.start, 0);
      assert.equal(r2.end, 10);
      assert.equal(r2.step, 2);
    });
  });

  describe('type', function () {

    it('should have a property isRange', function () {
      var a = new math.type.Range(0, 10);
      assert.strictEqual(a.isRange, true);
    });

    it('should have a property type', function () {
      var a = new math.type.Range(0, 10);
      assert.strictEqual(a.type, 'Range');
    });

  });

  describe('map', function () {
    it('should perform a transformation on all values in the range', function () {
      var r = new Range(2, 6);
      assert.deepEqual(r.map(function (value, index, range) {
        assert.strictEqual(range, r);
        return 'range[' + index[0] + ']=' + value;
      }), [
          'range[0]=2',
          'range[1]=3',
          'range[2]=4',
          'range[3]=5'
      ]);
    });
  });

  describe('forEach', function () {
    it('should perform a given callback on all values in the range', function () {
      var r = new Range(2, 6);
      var log = [];
      r.forEach(function (value, index, range) {
        assert.strictEqual(range, r);
        log.push('range[' + index[0] + ']=' + value);
      });

      assert.deepEqual(log, [
        'range[0]=2',
        'range[1]=3',
        'range[2]=4',
        'range[3]=5'
      ]);
    });
  });

  describe('format', function () {
    it('should format a range as string', function () {
      assert.equal(new Range(0, 4).format(), '0:4');
      assert.equal(new Range(0, 4, 2).format(), '0:2:4');

      assert.equal(new Range(0.01, 0.09, 0.02).format(), '0.01:0.02:0.09');

      assert.equal(new Range(0.01, 0.09, 0.02).format({
        notation: 'exponential'
      }), '1e-2:2e-2:9e-2');
    });
  });

  describe('toArray', function () {
    it('should expand a Range into an Array', function () {
      assert.deepEqual(new Range(0, 4).toArray(), [0,1,2,3]);
      assert.deepEqual(new Range(4, 0, -1).toArray(), [4, 3, 2, 1]);
    });
  });

  describe('valueOf', function () {
    it('valueOf should return the Range expanded as Array', function () {
      assert.deepEqual(new Range(0, 4).valueOf(), [0,1,2,3]);
      assert.deepEqual(new Range(4, 0, -1).valueOf(), [4, 3, 2, 1]);
    });
  });

  it('toJSON', function () {
    assert.deepEqual(new Range(2, 4).toJSON(), {'mathjs': 'Range', start: 2, end: 4, step: 1});
    assert.deepEqual(new Range(0, 10, 2).toJSON(), {'mathjs': 'Range', start: 0, end: 10, step: 2});
  });

  it('fromJSON', function () {
    var r1 = Range.fromJSON({start: 2, end: 4});
    assert.ok(r1 instanceof Range);
    assert.strictEqual(r1.start, 2);
    assert.strictEqual(r1.end, 4);
    assert.strictEqual(r1.step, 1);

    var r2 = Range.fromJSON({start: 0, end: 10, step: 2});
    assert.ok(r2 instanceof Range);
    assert.strictEqual(r2.start, 0);
    assert.strictEqual(r2.end, 10);
    assert.strictEqual(r2.step, 2);
  });

});