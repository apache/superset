// test boolean utils
var assert = require('assert'),
    approx = require('../../tools/approx'),
    boolean = require('../../lib/utils/boolean');

describe ('boolean', function () {

  it('isBoolean', function() {
    assert.equal(boolean.isBoolean(true), true);
    assert.equal(boolean.isBoolean(false), true);
    assert.equal(boolean.isBoolean(Boolean(false)), true);
    assert.equal(boolean.isBoolean('hi'), false);
    assert.equal(boolean.isBoolean(23), false);
    assert.equal(boolean.isBoolean([]), false);
    assert.equal(boolean.isBoolean({}), false);
    assert.equal(boolean.isBoolean(new Date()), false);

    // we don't support non primitive Boolean anymore
    assert.equal(boolean.isBoolean(new Boolean(true)), false);
    assert.equal(boolean.isBoolean(new Boolean(false)), false);
  });

});