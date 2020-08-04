var assert = require('assert');
var typed = require('../typed-function');

describe('find', function () {

  function a () {}
  function b () {}
  function c () {}
  function d () {}
  function e () {}

  var fn = typed('fn', {
    'number': a,
    'string, ...number': b,
    'number, boolean': c,
    'any': d,
    '': e
  });


  it('should find a signature from an array with types', function() {
    assert.strictEqual(typed.find(fn, ['number']), a);
    assert.strictEqual(typed.find(fn, ['number', 'boolean']), c);
    assert.strictEqual(typed.find(fn, ['any']), d);
    assert.strictEqual(typed.find(fn, []), e);

  });

  it('should find a signature from a comma separated string with types', function() {
    assert.strictEqual(typed.find(fn, 'number'), a);
    assert.strictEqual(typed.find(fn, 'number,boolean'), c);
    assert.strictEqual(typed.find(fn, ' number, boolean '), c); // with spaces
    assert.strictEqual(typed.find(fn, 'any'), d);
    assert.strictEqual(typed.find(fn, ''), e);
  });

  it('should throw an error when not found', function() {
    assert.throws(function () {
      typed.find(fn, 'number, number');
    }, /TypeError: Signature not found \(signature: fn\(number, number\)\)/);
  });


  // TODO: implement support for matching non-exact signatures
  //assert.strictEqual(typed.find(fn, ['Array']), d);


});
