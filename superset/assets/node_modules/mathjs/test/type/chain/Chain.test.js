// test chain
var assert = require('assert');
var approx = require('../../../tools/approx');
var math = require('../../../index');
var Chain = math.type.Chain;

describe('Chain', function() {

  it('should chain operations with numbers', function() {
    assert.equal(new Chain(3).add(4).subtract(2).done(), 5);
    assert.equal(new Chain(0).add(3).done(), 3);
  });

  it('should have a property isChain', function () {
    var a = new math.type.Chain(5);
    assert.strictEqual(a.isChain, true);
  });

  it('should have a property type', function () {
    var a = new math.type.Chain(5);
    assert.strictEqual(a.type, 'Chain');
  });

  it('should not contain constants, only functions', function() {
    assert(typeof Chain.pi, 'undefined');

    var chain = new Chain(math.bignumber(3));

    assert(typeof chain.pi, 'undefined');
    assert(typeof chain.sin, 'function');
  });

  it('should chain operations with matrices', function() {
    assert.deepEqual(new Chain(math.matrix([[1,2],[3,4]]))
        .subset(math.index(0,0), 8)
        .multiply(3).done(), math.matrix([[24, 6], [9, 12]]));
    assert.deepEqual(new Chain([[1,2],[3,4]])
        .subset(math.index(0,0), 8)
        .multiply(3).done(), [[24, 6], [9, 12]]);
  });

  it('should get string representation', function() {
    assert.equal(new Chain(5.2).toString(), '5.2');
  });

  it('should get chain\'s value via valueOf', function() {
    assert.equal(new Chain(5.2).valueOf(), 5.2);
    assert.equal(new Chain(5.2) + 2, 7.2);
  });

  it('should create a chain from a chain', function() {
    var a = new Chain(2.3);
    var b = new Chain(a);
    assert.equal(a.done(), 2.3);
    assert.equal(b.done(), 2.3);
  });

  it('should create a proxy for imported functions', function() {
    math.import({hello: function (a) { return a + '!'}});
    var a = new Chain('hello').hello().done();
    assert.strictEqual(a, 'hello!');
  });

  it('should not break with null or true as value', function() {
    assert.equal(new Chain(null).add(1).done(), 1);
    assert.equal(new Chain(true).add(1).done(), 2);
  });

  it('should throw an error if called with wrong input', function() {
    assert.throws(function () {new Chain().add(2).done()}, TypeError);
    assert.throws(function () {new Chain(undefined).add(2).done()}, TypeError);
  });

  it('should throw an error if constructed without new keyword', function() {
    assert.throws(function () {Chain()}, SyntaxError);
  });

  it ('should not clear inherited properties', function () {
    Object.prototype.foo = 'bar';

    var chain = new Chain();

    assert.equal(chain.foo, 'bar');
    assert.equal(chain.hasOwnProperty('foo'), false);

    delete Object.prototype.foo;
  });

  // TODO: test createProxy(name, value)
  // TODO: test createProxy(values)

});