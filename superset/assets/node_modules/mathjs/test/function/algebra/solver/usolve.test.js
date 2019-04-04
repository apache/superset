// test usolve
var assert = require('assert'),
    approx = require('../../../../tools/approx'),
    math = require('../../../../index');

describe('usolve', function () {

  it('should solve linear system 4 x 4, arrays', function () {
    var m = 
        [
          [1, 1, 1, 1],
          [0, 1, 1, 1],
          [0, 0, 1, 1],
          [0, 0, 0, 1]
        ];
    var b = [1, 2, 3, 4];

    var x = math.usolve(m, b);

    approx.deepEqual(x, [-1, -1, -1, 4]);
  });

  it('should solve linear system 4 x 4, array and column array', function () {
    var m = 
        [
          [1, 1, 1, 1],
          [0, 1, 1, 1],
          [0, 0, 1, 1],
          [0, 0, 0, 1]
        ];
    var b = [
      [1],
      [2], 
      [3],
      [4]
    ];
    var x = math.usolve(m, b);

    approx.deepEqual(x, [[-1], [-1], [-1], [4]]);
  });

  it('should solve linear system 4 x 4, matrices', function () {
    var m = math.matrix(
      [
        [1, 1, 1, 1],
        [0, 1, 1, 1],
        [0, 0, 1, 1],
        [0, 0, 0, 1]
      ]);
    var b = math.matrix([1, 2, 3, 4]);

    var x = math.usolve(m, b);

    assert(x instanceof math.type.Matrix);
    approx.deepEqual(x, math.matrix([[-1], [-1], [-1], [4]]));
  });

  it('should solve linear system 4 x 4, sparse matrices', function () {
    var m = math.sparse(
      [
        [1, 1, 1, 1],
        [0, 1, 1, 1],
        [0, 0, 1, 1],
        [0, 0, 0, 1]
      ]);
    var b = math.matrix([[1], [2], [3], [4]], 'sparse');

    var x = math.usolve(m, b);

    assert(x instanceof math.type.Matrix);
    approx.deepEqual(x, math.matrix([[-1], [-1], [-1], [4]]));
  });

  it('should solve linear system 4 x 4, matrix and column matrix', function () {
    var m = math.matrix(
      [
        [1, 1, 1, 1],
        [0, 1, 1, 1],
        [0, 0, 1, 1],
        [0, 0, 0, 1]
      ]);
    var b = math.matrix([
      [1],
      [2], 
      [3],
      [4]
    ]);

    var x = math.usolve(m, b);

    assert(x instanceof math.type.Matrix);
    approx.deepEqual(x, math.matrix([[-1], [-1], [-1], [4]]));
  });

  it('should solve linear system 4 x 4, sparse matrix and column matrix', function () {
    var m = math.matrix(
      [
        [1, 1, 1, 1],
        [0, 1, 1, 1],
        [0, 0, 1, 1],
        [0, 0, 0, 1]
      ], 'sparse');
    var b = math.matrix([
      [1],
      [2], 
      [3],
      [4]
    ], 'sparse');

    var x = math.usolve(m, b);

    assert(x instanceof math.type.Matrix);
    approx.deepEqual(x, math.matrix([[-1], [-1], [-1], [4]]));
  });

  it('should throw exception when matrix is singular', function () {
    assert.throws(function () { math.usolve([[1, 1], [0, 0]], [1, 1]); }, /Error: Linear system cannot be solved since matrix is singular/);
    assert.throws(function () { math.usolve(math.matrix([[1, 1], [0, 0]], 'dense'), [1, 1]); }, /Error: Linear system cannot be solved since matrix is singular/);
    assert.throws(function () { math.usolve(math.matrix([[1, 1], [0, 0]], 'sparse'), [1, 1]); }, /Error: Linear system cannot be solved since matrix is singular/);
  });
});