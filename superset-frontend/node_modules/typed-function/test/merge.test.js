var assert = require('assert');
var typed = require('../typed-function');

describe('merge', function () {
  it('should merge two typed-functions', function () {
    var typed1 = typed({'boolean': function (value) { return 'boolean:' + value; }});
    var typed2 = typed({'number':  function (value) { return 'number:' + value;  }});

    var typed3 = typed(typed1, typed2);

    assert.deepEqual(Object.keys(typed3.signatures).sort(), ['boolean', 'number']);

    assert.strictEqual(typed3(true), 'boolean:true');
    assert.strictEqual(typed3(2), 'number:2');
    assert.throws(function () {typed3('foo')}, /TypeError: Unexpected type of argument in function unnamed \(expected: number or boolean, actual: string, index: 0\)/);
  });

  it('should merge three typed-functions', function () {
    var typed1 = typed({'boolean': function (value) { return 'boolean:' + value; }});
    var typed2 = typed({'number':  function (value) { return 'number:' + value;  }});
    var typed3 = typed({'string':  function (value) { return 'string:' + value;  }});

    var typed4 = typed(typed1, typed2, typed3);

    assert.deepEqual(Object.keys(typed4.signatures).sort(), ['boolean', 'number', 'string']);

    assert.strictEqual(typed4(true), 'boolean:true');
    assert.strictEqual(typed4(2), 'number:2');
    assert.strictEqual(typed4('foo'), 'string:foo');
    assert.throws(function () {typed4(new Date())}, /TypeError: Unexpected type of argument in function unnamed \(expected: number or string or boolean, actual: Date, index: 0\)/);
  });

  it('should allow merging duplicate signatures when pointing to the same function', function () {
    var typed1 = typed({'boolean': function (value) { return 'boolean:' + value; }});

    var merged = typed(typed1, typed1);

    assert.deepEqual(Object.keys(merged.signatures).sort(), ['boolean']);
  });

  it('should throw an error in case of conflicting signatures when merging', function () {
    var typed1 = typed({'boolean': function (value) { return 'boolean:' + value; }});
    var typed2 = typed({'boolean': function (value) { return 'boolean:' + value; }});

    assert.throws(function () {
      typed(typed1, typed2)
    }, /Error: Signature "boolean" is defined twice/);
  });

  it('should throw an error in case of conflicting names when merging', function () {
    var typed1 = typed('fn1', {'boolean': function () {}});
    var typed2 = typed('fn2', {'string': function () {}});
    var typed3 = typed({'number': function () {}});

    assert.throws(function () {
      typed(typed1, typed2)
    }, /Error: Function names do not match \(expected: fn1, actual: fn2\)/);

    var typed4 = typed(typed2, typed3);
    assert.equal(typed4.name, 'fn2');
  });
});
