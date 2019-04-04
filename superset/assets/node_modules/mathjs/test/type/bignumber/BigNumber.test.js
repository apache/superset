var assert = require('assert');
var math = require('../../../index');


describe('BigNumber', function () {

  it('should have a property isBigNumber', function () {
    var a = new math.type.BigNumber(5);
    assert.strictEqual(a.isBigNumber, true);
  });

  it('should have a property type', function () {
    var a = new math.type.BigNumber(5);
    assert.strictEqual(a.type, 'BigNumber');
  });

  it('toJSON', function () {
    assert.deepEqual(new math.type.BigNumber(5).toJSON(), {'mathjs': 'BigNumber', value: '5'});
  });

  it('fromJSON', function () {
    var b = math.type.BigNumber.fromJSON({value: '5'});
    assert.ok(b instanceof math.type.BigNumber);
    assert.strictEqual(b.toString(), '5');
    assert.deepEqual(b, new math.type.BigNumber(5));
  });

});
