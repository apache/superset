var assert = require('assert');
var typed = require('../typed-function');

describe('convert', function () {

  before(function () {
    typed.conversions = [
      {from: 'boolean', to: 'number', convert: function (x) {return +x;}},
      {from: 'boolean', to: 'string', convert: function (x) {return x + '';}},
      {from: 'number',  to: 'string', convert: function (x) {return x + '';}},
      {
        from: 'string',
        to: 'Date',
        convert: function (x) {
          var d = new Date(x);
          return isNaN(d.valueOf()) ? undefined : d;
        },
        fallible: true // TODO: not yet supported
      }
    ];
  });

  after(function () {
    // cleanup conversions
    typed.conversions = [];
  });

  it('should convert a value', function() {
    assert.strictEqual(typed.convert(2, 'string'), '2');
    assert.strictEqual(typed.convert(true, 'string'), 'true');
    assert.strictEqual(typed.convert(true, 'number'), 1);
  });
  
  it('should return same value when conversion is not needed', function () {
    assert.strictEqual(typed.convert(2, 'number'), 2);
    assert.strictEqual(typed.convert(true, 'boolean'), true);
  });

  it('should throw an error when no conversion function is found', function() {
    assert.throws(function () {typed.convert(2, 'boolean')}, /Error: Cannot convert from number to boolean/);
  });
});
