// test data type Complex

var assert = require('assert');
var math = require('../../../index');
var Unit = math.type.Unit;
var Complex = math.type.Complex;

describe('Complex', function () {

  assertComplex = function(complex, re, im) {
    assert(complex instanceof Complex);
    assert.strictEqual(complex.re, re);
    assert.strictEqual(complex.im, im);
  };

  describe('constructor', function() {

    it('should create a complex number correctly', function () {
      var complex1 = new Complex(3, -4);
      assertComplex(complex1, 3, -4);

      var complex2 = new Complex();
      assertComplex(complex2, 0, 0);
    });

    it('should have a property isComplex', function () {
      var a = new math.type.Complex(2,3);
      assert.strictEqual(a.isComplex, true);
    });

    it('should have a property type', function () {
      var a = new math.type.Complex(2,3);
      assert.strictEqual(a.type, 'Complex');
    });

    it('should accept an object with im and re as keys', function() {
      assertComplex(new Complex({re: 1, im: 2}), 1, 2);
    });

  });

  describe('toString', function() {

    it('stringify a complex number', function() {
      assert.equal(new Complex(3, -4).toString(), '3 - 4i');
      assert.equal(new Complex().toString(), '0');
      assert.equal(new Complex(2, 3).toString(), '2 + 3i');
      assert.equal(new Complex(2, 0).toString(), '2');
      assert.equal(new Complex(0, 3).toString(), '3i');
      assert.equal(new Complex().toString(),      '0');
      assert.equal(new Complex(0, 2).toString(),  '2i');
      assert.equal(new Complex(0, 1).toString(),  'i');
      assert.equal(new Complex(1, 1).toString(),  '1 + i');
      assert.equal(new Complex(1, 2).toString(),  '1 + 2i');
      assert.equal(new Complex(1, -1).toString(), '1 - i');
      assert.equal(new Complex(1, -2).toString(), '1 - 2i');
      assert.equal(new Complex(1, 0).toString(),  '1');
      assert.equal(new Complex(-1, 2).toString(), '-1 + 2i');
      assert.equal(new Complex(-1, 1).toString(), '-1 + i');
    });

    it('should not round off digits', function() {
      assert.equal(new Complex(1/3, 1/3).toString(), '0.3333333333333333 + 0.3333333333333333i');

    });
  });

  describe('valueOf', function() {

    it('should return string representation when calling valueOf', function() {
      assert.strictEqual(new Complex(3, -4).valueOf(), '3 - 4i');
      assert.strictEqual(new Complex().valueOf(), '0');
      assert.strictEqual(new Complex(2, 3).valueOf(), '2 + 3i');
    });

  });

  describe('format', function() {

    it('should format a complex number', function() {
      assert.equal(new Complex(2, 3).format(), '2 + 3i');
      assert.equal(new Complex(2, -3).format(), '2 - 3i');
      assert.equal(new Complex(-2, 3).format(), '-2 + 3i');
      assert.equal(new Complex(-2, -3).format(), '-2 - 3i');
      assert.equal(new Complex(2, 1).format(), '2 + i');
      assert.equal(new Complex(2, -1).format(), '2 - i');
      assert.equal(new Complex(2, 0).format(), '2');
      assert.equal(new Complex(0, 2).format(), '2i');
    });

    it('should format a complex number with custom precision', function() {
      assert.equal(new Complex(1/3, 1/3).format(3), '0.333 + 0.333i');
      assert.equal(new Complex(1/3, 1/3).format(4), '0.3333 + 0.3333i');
      assert.equal(new Complex(1/3, 1/3).format(), '0.3333333333333333 + 0.3333333333333333i');
    });

    it('should round im to zero if very small compared to re', function() {
      assert.equal(new Complex(-1, 1.22e-16).format(), '-1 + 1.22e-16i');

      assert.equal(new Complex(-1, 1.22e-16).format(15), '-1');
      assert.equal(new Complex(-1, -1.22e-16).format(15), '-1');
      assert.equal(new Complex(1, -1.22e-16).format(15), '1');
      assert.equal(new Complex(1, 1.22e-16).format(15), '1');

      assert.equal(new Complex(-1, 1e-7).format(5), '-1');
    });

    it('should round re to zero if very small compared to im', function() {
      assert.equal(new Complex(1.22e-16, -1).format(), '1.22e-16 - i');

      assert.equal(new Complex(1.22e-16, -1).format(15), '-i');
      assert.equal(new Complex(-1.22e-16, -1).format(15), '-i');
      assert.equal(new Complex(-1.22e-16, 1).format(15), 'i');
      assert.equal(new Complex(1.22e-16, 1).format(15), 'i');

      assert.equal(new Complex(1e-7, -1).format(5), '-i');
    });
  });

  describe('parse', function() {

    it('should parse rightly', function () {
      assertComplex(Complex('2 + 3i'), 2, 3);
      assertComplex(Complex('2 +3i'), 2, 3);
      assertComplex(Complex('2+3i'), 2, 3);
      assertComplex(Complex(' 2+3i '), 2, 3);

      assertComplex(Complex('2-3i'), 2, -3);
      assertComplex(Complex('2 + i'), 2, 1);
      assertComplex(Complex('-2-3i'), -2, - 3);
      assertComplex(Complex('-2+3i'), -2, 3);
      assertComplex(Complex('-2+-3i'), -2, -3);
      assertComplex(Complex('-2-+3i'), -2, -3);
      assertComplex(Complex('+2-+3i'), 2, -3);
      assertComplex(Complex('+2-+3i'), 2, -3);
      assertComplex(Complex('2 + 3i'), 2, 3);
      assertComplex(Complex('2 - -3i'), 2, 3);
      assertComplex(Complex(' 2 + 3i '), 2, 3);
      assertComplex(Complex('2 + i'), 2, 1);
      assertComplex(Complex('2 - i'), 2, -1);
      assertComplex(Complex('2 + -i'), 2, -1);
      assertComplex(Complex('-2+3e-1i'), -2, 0.3);
      assertComplex(Complex('-2+3e+1i'), -2, 30);
      assertComplex(Complex('2+3e2i'), 2, 300);
      assertComplex(Complex('2.2e-1-3.2e-1i'), 0.22, -0.32);
      assertComplex(Complex('2.2e-1-+3.2e-1i'), 0.22, -0.32);
      assertComplex(Complex('2'), 2, 0);
      assertComplex(Complex('i'), 0, 1);
      assertComplex(Complex(' i '), 0, 1);
      assertComplex(Complex('-i'), 0, -1);
      assertComplex(Complex(' -i '), 0, -1);
      assertComplex(Complex('+i'), 0, 1);
      assertComplex(Complex(' +i '), 0, 1);
      assertComplex(Complex('-2'), -2, 0);
      assertComplex(Complex('3I'), 0, 3);
      assertComplex(Complex('-3i'), 0, -3);
      assertComplex(Complex('.2i'), 0, 0.2);
      assertComplex(Complex('.2'), 0.2, 0);
      assertComplex(Complex('2.i'), 0, 2);
      assertComplex(Complex('2.'), 2, 0);
    });

    it('should throw an exception if called with an invalid string', function() {
      assert.throws(function () {Complex('')});
      assert.throws(function () {Complex('2r')});
      assert.throws(function () {Complex('str')});
      assert.throws(function () {Complex('2ia')});
      assert.throws(function () {Complex('3e + 4i')});
      assert.throws(function () {Complex('3 + 4i foo')});
      assert.throws(function () {Complex('3e1.2 + 4i')});
      assert.throws(function () {Complex('3e1.2i')});
      assert.throws(function () {Complex('.')});
      assert.throws(function () {Complex('2 + .i')}); 
      assert.throws(function () {Complex('4i foo')});
      assert.throws(function () {Complex('i foo')});
    });



  });

  describe('clone', function() {

    it('should clone the complex properly', function () {
      var complex1 = new Complex(3, -4);
      var clone = complex1.clone();
      clone.re = 100;
      clone.im = 200;
      assert.notEqual(complex1, clone);
      assert.equal(complex1.re, 3);
      assert.equal(complex1.im, -4);
      assert.equal(clone.re, 100);
      assert.equal(clone.im, 200);
    });

  });

  describe('equals', function() {

    it('should test equality of two complex numbers', function () {
      assert.equal(new Complex(2, 4).equals(new Complex(2, 4)), true);
      assert.equal(new Complex(2, 3).equals(new Complex(2, 4)), false);
      assert.equal(new Complex(2, 4).equals(new Complex(1, 4)), false);
      assert.equal(new Complex(2, 4).equals(new Complex(1, 3)), false);
      assert.equal(new Complex(2, 4).equals(new Complex(2, 0)), false);
      assert.equal(new Complex(2, 4).equals(new Complex(0, 4)), false);
      assert.equal(new Complex(0, 0).equals(new Complex()), true);
    });

    it('should use the epsilon configured with math.js', function () {
      var old = math.config();

      assert.equal(Complex.EPSILON, math.config().epsilon);
      assert.equal(new Complex(1, 0).equals(new Complex(1.01, 0)), false);

      math.config({epsilon: 0.1});
      assert.equal(new Complex(1, 0).equals(new Complex(1.01, 0)), true);

      math.config(old); // restore old config
    });

  });

  describe('fromPolar', function() {
    it('should save polar coordinates input correctly', function() {
      var complex1 = Complex.fromPolar({r: 0, phi: 4});
      var complex2 = Complex.fromPolar({r: 5, phi: 0});
      var complex3 = Complex.fromPolar({r: 1, phi: Math.PI});
      var complex4 = Complex.fromPolar({r: 3, phi: Math.PI / 2});
      var complex5 = Complex.fromPolar({r: 3, phi: -Math.PI / 2});
      assertComplex(complex1, 0, 0);
      assertComplex(complex2, 5, 0);
      assert.equal(complex3.re, -1);
      assert.equal(complex4.im, 3);
      assert.equal(complex5.im, -3);
    });

    it('should have the same value for the different import ways', function() {
      var way1 = Complex.fromPolar(1, 1);
      var way2 = Complex.fromPolar({r: 1, phi: 1});
      assert(way1.equals(way2));
    });

    it('should accept angle units for phi properly', function() {
      var fromDeg = Complex.fromPolar(1, new Unit(90, 'deg')),
          fromRad = Complex.fromPolar(1, new Unit(0, 'rad')),
          fromGrad = Complex.fromPolar(1, new Unit(100, 'grad'));
      assert.equal(fromDeg.im, 1);
      assert.equal(fromGrad.im, 1);
      assert.equal(fromRad.im, 0);
    });

    it('should only accept an object with r and phi keys for 1 argument', function() {
      assert.throws(function() { Complex({}) }, "Invalid Param");
      assert.throws(function() { Complex({r: 1}) }, "Invalid Param");
      assert.throws(function() { Complex({phi: 1}) }, "Invalid Param");
      assert.throws(function() { Complex("") }, "Invalid Param");
    });

  });

  describe('toPolar', function() {
    it('should return polar coordinates properly', function() {
      var polar0 = (new Complex(0, 0)).toPolar();
      var polar1 = (new Complex(3, 4)).toPolar();
      var polar2 = (new Complex(-3, 4)).toPolar();
      var polar3 = (new Complex(3, -4)).toPolar();
      var polar4 = (new Complex(-3, -4)).toPolar();
      var polar5 = (new Complex(0, -1)).toPolar();
      assert.equal(polar0.r, 0);
      assert.equal(polar1.r, 5);
      assert.equal(polar2.r, 5);
      assert.equal(polar3.r, 5);
      assert.equal(polar4.r, 5);
      assert.equal(polar5.r, 1);
      assert.equal(polar0.phi, 0);
      assert.equal(polar1.phi, 0.9272952180016122);
      assert.equal(polar2.phi, 2.214297435588181);
      assert.equal(polar3.phi, -0.9272952180016122);
      assert.equal(polar4.phi, -2.214297435588181);
      assert.equal(polar5.phi, -1.5707963267948966);
    });
  });

  it('toJSON', function () {
    assert.deepEqual(new Complex(2, 4).toJSON(), {'mathjs': 'Complex', re: 2, im: 4});
    assert.deepEqual(new Complex(3, 0).toJSON(), {'mathjs': 'Complex', re: 3, im: 0});
  });

  it('fromJSON', function () {
    var c1 = Complex.fromJSON({re: 2, im: 4});
    assert.ok(c1 instanceof Complex);
    assert.strictEqual(c1.re, 2);
    assert.strictEqual(c1.im, 4);

    var c2 = Complex.fromJSON({re: 3, im: 0});
    assert.ok(c2 instanceof Complex);
    assert.strictEqual(c2.re, 3);
    assert.strictEqual(c2.im, 0);
  });

  it('compare', function () {
    assert.deepEqual(Complex.compare(new Complex(3, 4), new Complex(2, 4)), 1);
    assert.deepEqual(Complex.compare(new Complex(2, 4), new Complex(2, 4)), 0);
    assert.deepEqual(Complex.compare(new Complex(2, 4), new Complex(2, 7)), -1);
  });

});
