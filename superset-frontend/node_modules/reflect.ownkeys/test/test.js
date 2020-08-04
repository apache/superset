var assert = require('assert');

var ownKeys = require('..');

describe('Reflect.ownKeys()', function() {
  describe('normal object', function() {
    var o = { a: 1, b: 2 };
    it('should get own keys', function() {
      assert.deepEqual(ownKeys(o), ["a", "b"]);
    });
  });
  describe('object with prototype', function() {
    var p = { a: 1, b: 2 };
    var o = Object.create(p);
    o.c = 3, o.d = 4;
    it('should get own keys', function() {
      assert.deepEqual(ownKeys(o), ["c", "d"]);
    });
  });
  describe('object with non-enumerable properties', function() {
    var o = {};
    Object.defineProperty(o, "a", {
      value: 1, enumerable: false
    });
    Object.defineProperty(o, "b", {
      get: function(){ return 2; }, enumerable: false
    });
    it('should get own keys', function() {
      assert.deepEqual(ownKeys(o), ["a", "b"]);
    });
  });

  // Only Relevant to ES6 Symbol support past this point
  var symbolDesc = describe;
  if (typeof Symbol !== 'function') {
    symbolDesc = describe.skip;
    Symbol = function() { return 0; };
  }

  symbolDesc('with Symbol', function() {
    var a = Symbol('a'), b = Symbol('b'), c = Symbol('c');
    describe('object with symbol properties', function() {
      var o = { a: 1, b: 2 }; o[a] = 3, o[b] = 4;
      it('should get own keys', function() {
        assert.deepEqual(ownKeys(o), ["a", "b", a, b]);
      });
    });
    describe('object with symbol properties in prototype', function() {
      var p = { a: 1 }; p[a] = 3;
      var o = Object.create(p);
      o.b = 2; o[b] = 4;
      it('should get own keys', function() {
        assert.deepEqual(ownKeys(o), ["b", b]);
      });
    });
    describe('object with non-enumerable symbol properties', function() {
      var o = { a: 1 };
      Object.defineProperty(o, a, {
        value: 1, enumerable: false
      });
      it('should get own keys', function() {
        assert.deepEqual(ownKeys(o), ["a", a]);
      });
    });
  });

});
