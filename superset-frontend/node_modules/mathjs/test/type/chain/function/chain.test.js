var assert = require('assert');
var math = require('../../../../index');
var Chain = math.type.Chain;

describe('chain', function() {

  it ('should construct a chain', function () {
    assert.ok(math.chain(45) instanceof Chain);
    assert.ok(math.chain(math.complex(2, 3)) instanceof Chain);
    assert.ok(math.chain() instanceof Chain);
  });

  it('should LaTeX chain', function () {
    var expression = math.parse('chain(1)');
    assert.equal(expression.toTex(), '\\mathrm{chain}\\left(1\\right)');
  });

});
