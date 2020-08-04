var assert = require('assert'),
    error = require('../../../../lib/error/index'),
    math = require('../../../../index'),
    bignumber = math.bignumber,
    BigNumber = math.type.BigNumber;

describe('bignumber', function() {

  it('should create a bignumber', function() {
    // no arguments
    var n = bignumber();
    assert.ok(n instanceof BigNumber);
    assert.equal(n.valueOf(), '0');

    // from number
    var a = bignumber(0.1);
    assert.ok(a instanceof BigNumber);
    assert.equal(a.valueOf(), '0.1');

    // from Fraction
    var a = bignumber(math.fraction(0.1));
    assert.ok(a instanceof BigNumber);
    assert.equal(a.valueOf(), '0.1');

    // from number with >15 digits
    var a2 = bignumber(1/3);
    assert.ok(a2 instanceof BigNumber);
    assert.equal(a2.valueOf(), '0.3333333333333333');

    // from string
    var b = bignumber('0.1');
    assert.ok(b instanceof BigNumber);
    assert.equal(b.valueOf(), '0.1');

    // from boolean
    var c = bignumber(true);
    assert.ok(c instanceof BigNumber);
    assert.equal(c.valueOf(), '1');

    // from null
    var c = bignumber(null);
    assert.ok(c instanceof BigNumber);
    assert.equal(c.valueOf(), '0');

    // from array
    var d = bignumber([0.1, 0.2, '0.3']);
    assert.ok(Array.isArray(d));
    assert.equal(d.length, 3);
    assert.ok(d[0] instanceof BigNumber);
    assert.ok(d[1] instanceof BigNumber);
    assert.ok(d[2] instanceof BigNumber);
    assert.equal(d[0].valueOf(), '0.1');
    assert.equal(d[1].valueOf(), '0.2');
    assert.equal(d[2].valueOf(), '0.3');

    // from matrix
    var e = bignumber(math.matrix([0.1, 0.2]));
    assert.ok(e instanceof math.type.Matrix);
    assert.deepEqual(e.size(), [2]);
    assert.ok(e.get([0]) instanceof BigNumber);
    assert.ok(e.get([1]) instanceof BigNumber);
    assert.equal(e.get([0]).valueOf(), '0.1');
    assert.equal(e.get([1]).valueOf(), '0.2');

    // really big
    var f = bignumber('1.2e500');
    assert.equal(f.valueOf(), '1.2e+500');
  });

  it('should create a bignumber from a fraction', function() {
    var f = math.fraction(2,3);
    var b = math.bignumber(f);
    assert.equal(b.toString(), '0.6666666666666666666666666666666666666666666666666666666666666667');
  });

  it('should apply precision setting to bignumbers', function() {
    var mymath = math.create({
      precision: 32
    });

    var a = mymath.bignumber(1).dividedBy(3);
    assert.equal(a.toString(), '0.33333333333333333333333333333333')
  });

  it('should throw an error in case of unsupported type of argument', function() {
    assert.throws(function () {math.bignumber(new Date())}, /TypeError: Unexpected type of argument/);
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {math.bignumber(1, 2)}, /TypeError: Too many arguments/);
  });

  it('should LaTeX bignumber', function () {
    var expr1 = math.parse('bignumber()');
    var expr2 = math.parse('bignumber(1)');

    assert.equal(expr1.toTex(), '0');
    assert.equal(expr2.toTex(), '\\left(1\\right)');
  });

});
