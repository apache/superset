// test import
var assert = require('assert');
var mathjs = require('../../index');
var approx = require('../../tools/approx');

describe('import', function() {
  var math = null;

  beforeEach(function() {
    math = mathjs.create();
    math.import({
      myvalue: 42,
      hello: function (name) {
        return 'hello, ' + name + '!';
      }
    }, {override: true});
  });

  afterEach(function() {
    math = null;
  });

  it('should import a custom member', function() {
    assert.equal(math.myvalue * 2, 84);
    assert.equal(math.hello('user'), 'hello, user!');
  });

  it('should not override existing functions', function() {
    assert.throws(function () {math.import({myvalue: 10})},
        /Error: Cannot import "myvalue": already exists/);
    assert.equal(math.myvalue, 42);
  });

  it('should throw no errors when silent:true', function() {
    math.import({myvalue: 10}, {silent: true});
    assert.strictEqual(math.myvalue, 42);
  });

  it('should override existing functions if forced', function() {
    math.import({myvalue: 10}, {override: true});
    assert.strictEqual(math.myvalue, 10);
  });

  it('should parse the user defined members', function() {
    if (math.parser) {
      var parser = math.parser();
      math.add(math.myvalue, 10);
      parser.eval('myvalue + 10');    // 52
      parser.eval('hello("user")');   // 'hello, user!'
    }
  });

  var getSize = function (array) {
    return array.length;
  };

  it('shouldn\'t wrap custom functions by default', function () {
    math.import({ getSizeNotWrapped: getSize });
    assert.strictEqual(math.getSizeNotWrapped([1,2,3]), 3);
    assert.strictEqual(math.getSizeNotWrapped(math.matrix([1,2,3])), undefined);
  });

  it('should wrap custom functions if wrap = true', function () {
    math.import({ getSizeWrapped: getSize }, { wrap: true});
    assert.strictEqual(math.getSizeWrapped([1,2,3]), 3);
    assert.strictEqual(math.getSizeWrapped(math.matrix([1,2,3])), 3);
  });

  it('wrapped imported functions should accept undefined and null', function () {
    math.import({
      isNull: function (obj) {
        return obj === null;
      }
    }, { wrap: true });
    assert.equal(math.isNull(null), true);
    assert.equal(math.isNull(0), false);

    math.import({
      isUndefined: function (obj) {
        return obj === undefined;
      }
    }, { wrap: true });
    assert.equal(math.isUndefined(undefined), true);
    assert.equal(math.isUndefined(0), false);
    assert.equal(math.isUndefined(null), false);

  });

  it('should throw an error in case of wrong number of arguments', function () {
    assert.throws (function () {math.import()}, /ArgumentsError/);
    assert.throws (function () {math.import('', {}, 3)}, /ArgumentsError/);
  });

  it('should throw an error in case of wrong type of arguments', function () {
    assert.throws(function () {math.import(2)}, /TypeError: Factory, Object, or Array expected/);
    assert.throws(function () {math.import(function () {})}, /TypeError: Factory, Object, or Array expected/);
  });

  it('should ignore properties on Object', function () {
    Object.prototype.foo = 'bar';

    math.import({bar: 456});

    assert(!math.hasOwnProperty('foo'));
    assert(math.hasOwnProperty('bar'));

    delete Object.prototype.foo;
  });

  it('should return the imported object', function () {
    math.import({a: 24});
    assert.deepEqual(math.a, 24);

    math.import({pi: 24}, {silent: true});
    approx.equal(math.pi, Math.PI); // pi was ignored
  });

  it('should import a boolean', function () {
    math.import({a: true});
    assert.strictEqual(math.a, true);
  });

  it('should merge typed functions with the same name', function () {
    math.import({
      'foo': math.typed('foo', {
        'number': function (x) {
          return 'foo(number)';
        }
      })
    });

    math.import({
      'foo': math.typed('foo', {
        'string': function (x) {
          return 'foo(string)';
        }
      })
    });

    assert.deepEqual(Object.keys(math.foo.signatures).sort(), ['number', 'string']);
    assert.equal(math.foo(2), 'foo(number)');
    assert.equal(math.foo('bar'), 'foo(string)');
    assert.throws(function () {
      math.foo(new Date())
    }, /TypeError: Unexpected type of argument in function foo/);

  });

  it('should override existing typed functions', function () {
    math.import({
      'foo': math.typed('foo', {
        'Date': function (x) {
          return 'foo(Date)';
        }
      })
    });

    assert.equal(math.foo(new Date()), 'foo(Date)');

    math.import({
      'foo': math.typed('foo', {
        'string': function (x) {
          return 'foo(string)';
        }
      })
    }, {override: true});

    assert.deepEqual(Object.keys(math.foo.signatures).sort(), ['string']);
    assert.equal(math.foo('bar'), 'foo(string)');
    assert.throws(function () {
      math.foo(new Date())
    }, /TypeError: Unexpected type of argument in function foo/);
    assert.throws(function () {
      math.foo(new Date())
    }, /TypeError: Unexpected type of argument in function foo/);

  });

  it('should merge typed functions coming from a factory', function () {
    math.import({
      'foo': math.typed('foo', {
        'number': function (x) {
          return 'foo(number)';
        }
      })
    });

    math.import({
      'name': 'foo',
      'factory': function () {
        return math.typed('foo', {
          'string': function (x) {
            return 'foo(string)';
          }
        })
      }
    });

    assert.deepEqual(Object.keys(math.foo.signatures).sort(), ['number', 'string']);
    assert.equal(math.foo(2), 'foo(number)');
    assert.equal(math.foo('bar'), 'foo(string)');
    assert.throws(function () {
      math.foo(new Date())
    }, /TypeError: Unexpected type of argument in function foo/);

  });

  it('should import a boolean', function () {
    math.import({a: true});
    assert.strictEqual(math.a, true);
  });

  it('should import a function with transform', function() {
    function foo (text) {
      return text.toLowerCase();
    }

    foo.transform = function foo(text) {
      return text.toUpperCase();
    };

    math.import({foo: foo});

    assert(math.hasOwnProperty('foo'));
    assert.strictEqual(math.foo, foo);
    assert(math.expression.transform.hasOwnProperty('foo'));
    assert.strictEqual(math.expression.transform.foo, foo.transform);
  });

  it('should override a function with transform for one without', function() {
    function mean () {
      return 'test'
    }

    math.import({mean: mean}, {override: true});

    assert(math.hasOwnProperty('mean'));
    assert.strictEqual(math.mean, mean);
    assert.strictEqual(math.expression.transform.mean, undefined);
    assert.strictEqual(math.expression.mathWithTransform.mean, mean);
  });

  it('should throw an error when a factory function has a transform', function() {
    assert.throws(function () {
      math.import({
        name: 'foo2',
        factory: function () {
          var fn = function () {};
          fn.transform = function () {};
          return fn;
        }
      });

      math.foo2(); // as soon as we use it, it will resolve the factory function

    }, /Transforms cannot be attached to factory functions/);
  });

  it.skip('should import a factory with name', function () {
    // TODO: unit test importing a factory
  });

  it.skip('should import a factory with path', function () {
    // TODO: unit test importing a factory
  });

  it.skip('should import a factory without name', function () {
    // TODO: unit test importing a factory
  });

  it.skip('should pass the namespace to a factory function', function () {
    // TODO: unit test importing a factory
  });

  it.skip('should import an Array', function () {
    // TODO: unit test importing an Array containing stuff
  });

  it('should LaTeX import', function () {
    var expression = math.parse('import(object)');
    assert.equal(expression.toTex(), '\\mathrm{import}\\left( object\\right)');
  });

});
