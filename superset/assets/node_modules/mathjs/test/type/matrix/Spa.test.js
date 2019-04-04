var assert = require('assert');
var math = require('../../../index');
var Spa = math.type.Spa;

describe('Spa', function() {

  describe('constructor', function() {
    
    it('should throw an error when called without new keyword', function () {
      assert.throws(function () { Spa(); }, /Constructor must be called with the new operator/);
    });

    it('should have a property isSpa', function () {
      var a = new Spa();
      assert.strictEqual(a.isSpa, true);
    });

    it('should have a property type', function () {
      var a = new Spa();
      assert.strictEqual(a.type, 'Spa');
    });

  });
  
  describe('test', function () {
    
    it('should add value when no value exists for row', function () {
      var spa = new Spa(10);
      spa.set(5, 0.5);
      assert(spa._values[5]);
      assert(spa._values[5].value);
      assert.equal(spa._values[5].value, 0.5);
    });
    
    it('should set value when value exists for row', function () {
      var spa = new Spa(10);
      spa.set(5, 0.5);
      assert(spa._values[5]);
      assert(spa._values[5].value);
      assert.equal(spa._values[5].value, 0.5);
      spa.set(5, 1.5);
      assert(spa._values[5]);
      assert(spa._values[5].value);
      assert.equal(spa._values[5].value, 1.5);
    });
  });
  
  describe('get', function () {
    
    it('should get zero when no value exists for row', function () {
      var spa = new Spa(10);
      var v = spa.get(5);
      assert.equal(v, 0);
    });
    
    it('should get value when value exists for row', function () {
      var spa = new Spa(10);
      spa.set(5, 0.5);
      var v = spa.get(5);
      assert.equal(v, 0.5);
    });
  });
  
  describe('accumulate', function () {
    
    it('should add value when no value exists for row', function () {
      var spa = new Spa(10);
      spa.accumulate(5, 0.5);
      assert(spa._values[5]);
      assert(spa._values[5].value);
      assert.equal(spa._values[5].value, 0.5);
    });
    
    it('should accumulate value when value exists for row', function () {
      var spa = new Spa(10);
      spa.set(5, 0.5);
      spa.accumulate(5, 1.5);
      assert(spa._values[5]);
      assert(spa._values[5].value);
      assert.equal(spa._values[5].value, 2);
    });
  });
  
  describe('swap', function () {
    
    it('should swap two existing values', function () {
      var spa = new Spa(10);
      spa.set(5, 0.5);
      spa.set(2, 0.2);
      spa.swap(2, 5);
      assert(spa._values[5]);
      assert(spa._values[5].value);
      assert.equal(spa._values[5].value, 0.2);
      assert(spa._values[2]);
      assert(spa._values[2].value);
      assert.equal(spa._values[2].value, 0.5);
    });
    
    it('should swap an existing and non existing values', function () {
      var spa = new Spa(10);
      spa.set(5, 0.5);
      spa.swap(5, 2);
      assert(!spa._values[5]);
      assert(spa._values[2]);
      assert(spa._values[2].value);
      assert.equal(spa._values[2].value, 0.5);
    });
    
    it('should swap a non existing and existing values', function () {
      var spa = new Spa(10);
      spa.set(5, 0.5);
      spa.swap(2, 5);
      assert(!spa._values[5]);
      assert(spa._values[2]);
      assert(spa._values[2].value);
      assert.equal(spa._values[2].value, 0.5);
    });
    
    it('should swap two non existing values', function () {
      var spa = new Spa(10);
      spa.swap(2, 5);
      assert(!spa._values[5]);
      assert(!spa._values[2]);
    });
  });
  
  describe('forEach', function () {
    
    it('should enumerate values in correct order', function () {
      var spa = new Spa(10);
      spa.set(2, 2);
      spa.set(3, 3);
      spa.set(4, 4);
      spa.set(1, 2);
      var x;
      var c = 0;
      spa.forEach(0, 9, function (i) {
        if (!x) {
          assert.equal(i, 1);
          x = i;
        }
        else {
          assert(i > x);
          x = i;
        }
        c++;
      });
      assert.equal(c, 4);
      assert.equal(x, 4);
      assert(spa._heap._minimum !== null);
      assert.equal(spa._heap._size, 4);
    });
    
    it('should enumerate values in interval', function () {
      var spa = new Spa(10);
      spa.set(2, 2);
      spa.set(3, 3);
      spa.set(4, 4);
      spa.set(1, 2);
      var x;
      var c = 0;
      spa.forEach(2, 3, function (i) {
        if (!x) {
          assert.equal(i, 2);
          x = i;
        }
        else {
          assert(i > x);
          x = i;
        }
        c++;
      });
      assert.equal(c, 2);
      assert.equal(x, 3);
      assert(spa._heap._minimum !== null);
      assert.equal(spa._heap._size, 4);
    });
  });
});
