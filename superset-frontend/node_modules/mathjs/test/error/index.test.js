var assert = require('assert');
var error = require('../../lib/error/index');

describe('index.js', function () {

  it('should contain error factory functions', function () {
    assert(Array.isArray(error));
    assert(error[0].name, 'ArgumentsError');
    assert(error[1].name, 'DimensionError');
    assert(error[2].name, 'IndexError');
  });

});