var assert = require('assert');
var isCollection = require('../../../lib/utils/collection/isCollection');
var math = require('../../../index');
var DenseMatrix = math.type.DenseMatrix;
var SparseMatrix = math.type.SparseMatrix;

describe('isCollection', function() {

  it('should test whether an object is a collection', function () {
    assert.strictEqual(isCollection([]), true);
    assert.strictEqual(isCollection({}), false);
    assert.strictEqual(isCollection(2), false);
    assert.strictEqual(isCollection(new DenseMatrix()), true);
    assert.strictEqual(isCollection(new SparseMatrix()), true);
  });
});
