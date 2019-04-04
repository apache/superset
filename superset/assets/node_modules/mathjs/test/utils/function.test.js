var assert = require('assert');
var functionUtils = require('../../lib/utils/function');

describe('util.function', function() {

  describe('memoize', function () {

    it('should memoize a function with one argument', function () {
      var f = function (x) {return x * x};

      var m = functionUtils.memoize(f);

      assert.strictEqual(m(2), 4);
      assert.strictEqual(m(3), 9);
    });

    it('should memoize a function with two arguments', function () {
      var f = function (x, y) {return x * y};

      var m = functionUtils.memoize(f);

      assert.strictEqual(m(2, 3), 6);

      // hash should differ
      assert.strictEqual(m(1, 23), 23);
      assert.strictEqual(m(12, 3), 36);
    });

    it('should memoize a function with objects as arguments', function () {
      var f = function (obj) {return obj.x * obj.y};

      var m = functionUtils.memoize(f);

      assert.strictEqual(m({x: 2, y: 3}), 6);
      assert.deepEqual(Object.keys(m.cache), ['[{"x":2,"y":3}]']);
      assert.strictEqual(m.cache['[{"x":2,"y":3}]'], 6);
    });

    it('should memoize a function with a custom hashIt function', function () {
      var f = function (obj) {return obj.id};
      var hashIt = function (args) {
        return 'id:' + args[0].id;
      };

      var m = functionUtils.memoize(f, hashIt);

      assert.strictEqual(m({id: 2}), 2);
      assert.deepEqual(Object.keys(m.cache), ['id:2']);
      assert.strictEqual(m.cache['id:2'], 2);
    });

    it('should really return the cached result', function () {
      var a = 2;
      var f = function (x) {return a}; // trick: no pure function

      var m = functionUtils.memoize(f);

      assert.strictEqual(m(4), 2);
      a = 3;
      assert.strictEqual(m(4), 2);
    });

  });

  describe ('maxArgumentCount', function () {

    it('should calculate the max argument count of a typed function', function() {
      var a = function () {};
      a.signatures = {
        'number, number': function () {},
        'number': function () {}
      };
      assert.equal(functionUtils.maxArgumentCount(a), 2);

      var b = function () {};
      b.signatures = {
        'number': function () {},
        'number, number': function () {}
      };
      assert.equal(functionUtils.maxArgumentCount(b), 2);

      var c = function () {};
      c.signatures = {
        'number': function () {},
        'BigNumber': function () {}
      };
      assert.equal(functionUtils.maxArgumentCount(c), 1);

      var d = function () {};
      d.signatures = {
        'number,number': function () {},
        'number': function () {},
        'number,any,number': function () {}
      };
      assert.equal(functionUtils.maxArgumentCount(d), 3);
    });

    it('should return -1 for regular functions', function() {
      assert.equal(functionUtils.maxArgumentCount(function () {}), -1);
    });

  });

});
