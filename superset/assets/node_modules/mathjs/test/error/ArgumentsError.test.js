var assert = require('assert'),
    ArgumentsError = require('../../lib/error/ArgumentsError');

describe('ArgumentsError', function () {

  it('should construct an ArgumentsError without max', function () {
    var err = new ArgumentsError('myfunction', 1, 2);
    assert(err instanceof Error);
    assert(err instanceof ArgumentsError);
    assert.equal(err.fn, 'myfunction');
    assert.equal(err.count, 1);
    assert.equal(err.min, 2);
    assert.equal(err.max, undefined);
    assert.equal(err.toString(), 'ArgumentsError: Wrong number of arguments in function myfunction (1 provided, 2 expected)');
  });

  it('should construct an ArgumentsError with max', function () {
    var err = new ArgumentsError('myfunction', 1, 2, 3);
    assert(err instanceof Error);
    assert(err instanceof ArgumentsError);
    assert.equal(err.fn, 'myfunction');
    assert.equal(err.count, 1);
    assert.equal(err.min, 2);
    assert.equal(err.max, 3);
    assert.equal(err.toString(), 'ArgumentsError: Wrong number of arguments in function myfunction (1 provided, 2-3 expected)');
  });

  it('should throw an error when operator new is missing', function () {
    assert.throws(function () {
      ArgumentsError();
    }, SyntaxError);
  });

});
