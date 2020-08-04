// test boolean utils
var assert = require('assert');
var approx = require('../../tools/approx');
var customs = require('../../lib/utils/customs');
var math = require('../../index');

describe ('customs', function () {

  describe ('isSafeMethod', function() {

    it ('plain objects', function () {
      var object = {
        fn: function () {}
      }
      assert.equal(customs.isSafeMethod(object, 'fn'), true);
      assert.equal(customs.isSafeMethod(object, 'toString'), true);
      assert.equal(customs.isSafeMethod(object, 'toLocaleString'), true);
      assert.equal(customs.isSafeMethod(object, 'valueOf'), true);

      assert.equal(customs.isSafeMethod(object, 'constructor'), false);
      assert.equal(customs.isSafeMethod(object, 'hasOwnProperty'), false);
      assert.equal(customs.isSafeMethod(object, 'isPrototypeOf'), false);
      assert.equal(customs.isSafeMethod(object, 'propertyIsEnumerable'), false);
      assert.equal(customs.isSafeMethod(object, '__defineGetter__'), false);
      assert.equal(customs.isSafeMethod(object, '__defineSetter__'), false);
      assert.equal(customs.isSafeMethod(object, '__lookupGetter__'), false);
      assert.equal(customs.isSafeMethod(object, '__lookupSetter__'), false);

      // non existing method
      assert.equal(customs.isSafeMethod(object, 'foo'), false);

      // custom inherited method
      var object = {
        foo: function () {}
      };
      var object2 = Object.create(object);
      assert.equal(customs.isSafeMethod(object2, 'foo'), true);

      // ghosted native method
      var object3 = {};
      object3.toString = function () {};
      assert.equal(customs.isSafeMethod(object3, 'toString'), false);

    });

    it ('function objects', function () {
      var f = function () {};

      assert.equal(customs.isSafeMethod(f, 'call'), false);
      assert.equal(customs.isSafeMethod(f, 'bind'), false);
    });

    it ('classes', function () {
      var matrix = math.matrix();
      assert.equal(customs.isSafeMethod(matrix, 'get'), true);
      assert.equal(customs.isSafeMethod(matrix, 'toString'), true);

      var complex = math.complex();
      assert.equal(customs.isSafeMethod(complex, 'sqrt'), true);
      assert.equal(customs.isSafeMethod(complex, 'toString'), true);

      var unit = math.unit('5cm');
      assert.equal(customs.isSafeMethod(unit, 'toNumeric'), true);
      assert.equal(customs.isSafeMethod(unit, 'toString'), true);

      // extend the class instance with a custom method
      var object = math.matrix();
      object.foo = function () {};
      assert.equal(customs.isSafeMethod(object, 'foo'), true);

      // extend the class instance with a ghosted method
      var object = math.matrix();
      object.toJSON = function () {};
      assert.equal(customs.isSafeMethod(object, 'toJSON'), false);

      // unsafe native methods
      assert.equal(customs.isSafeMethod(matrix, 'constructor'), false);
      assert.equal(customs.isSafeMethod(matrix, 'hasOwnProperty'), false);
      assert.equal(customs.isSafeMethod(matrix, 'isPrototypeOf'), false);
      assert.equal(customs.isSafeMethod(matrix, 'propertyIsEnumerable'), false);
      assert.equal(customs.isSafeMethod(matrix, '__defineGetter__'), false);
      assert.equal(customs.isSafeMethod(matrix, '__defineSetter__'), false);
      assert.equal(customs.isSafeMethod(matrix, '__lookupGetter__'), false);
      assert.equal(customs.isSafeMethod(matrix, '__lookupSetter__'), false);

      // non existing method
      assert.equal(customs.isSafeMethod(matrix, 'nonExistingMethod'), false);

      // method with unicode chars
      assert.equal(customs.isSafeMethod(matrix, 'co\u006Estructor'), false);
    });

  });

  describe ('isSafeProperty', function () {

    it ('should test properties on plain objects', function () {
      var object = {};

      /* From Object.prototype:
        Object.getOwnPropertyNames(Object.prototype).forEach(
          key => typeof ({})[key] !== 'function' && console.log(key))
      */
      assert.equal(customs.isSafeProperty(object, '__proto__'), false);
      assert.equal(customs.isSafeProperty(object, 'constructor'), false);

      /* From Function.prototype:
        Object.getOwnPropertyNames(Function.prototype).forEach(
          key => typeof (function () {})[key] !== 'function' && console.log(key))
      */
      assert.equal(customs.isSafeProperty(object, 'length'), true);
      assert.equal(customs.isSafeProperty(object, 'name'), true);
      assert.equal(customs.isSafeProperty(object, 'arguments'), false);
      assert.equal(customs.isSafeProperty(object, 'caller'), false);

      // non existing property
      assert.equal(customs.isSafeProperty(object, 'bar'), true);

      // property with unicode chars
      assert.equal(customs.isSafeProperty(object, 'co\u006Estructor'), false);
    });

    it ('should test inherited properties on plain objects ', function () {
      var object1 = {};
      var object2 = Object.create(object1);
      object1.foo = true;
      object2.bar = true;
      assert.equal(customs.isSafeProperty(object2, 'foo'), true);
      assert.equal(customs.isSafeProperty(object2, 'bar'), true);
      assert.equal(customs.isSafeProperty(object2, '__proto__'), false);
      assert.equal(customs.isSafeProperty(object2, 'constructor'), false);

      object2.foo = true; // override "foo" of object1
      assert.equal(customs.isSafeProperty(object2, 'foo'), true);
      assert.equal(customs.isSafeProperty(object2, 'constructor'), false);
    });

    it ('should test for ghosted native property', function () {
      var array1 = [];
      var array2 = Object.create(array1);
      array2.length = Infinity;
      assert.equal(customs.isSafeProperty(array2, 'length'), true);
    });

  });

  it ('should distinguish plain objects', function () {
    var a = {};
    var b = Object.create(a);
    assert.equal(customs.isPlainObject (a), true);
    assert.equal(customs.isPlainObject (b), true);

    assert.equal(customs.isPlainObject (math.unit('5cm')), false);
    assert.equal(customs.isPlainObject (math.unit('5cm')), false);
    assert.equal(customs.isPlainObject ([]), false);
    // assert.equal(customs.isPlainObject (math.complex()), false); // FIXME: shouldn't treat Complex as a plain object (it is a plain object which has __proto__ overridden)
    assert.equal(customs.isPlainObject (math.matrix()), false);
  });
});
