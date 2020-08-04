// test add
var assert = require('assert');
var approx = require('../../../tools/approx');
var math = require('../../../index');
var add = math.add;

// TODO: make unit tests independent of math
describe('add', function() {

  describe('Array', function () {
    
    it('should convert strings and add them element wise', function() {
      assert.deepEqual(add('2', ['3', '4']), [5, 6]);
      assert.deepEqual(add(['2', '3'], '4'), [6, 7]);
    });

    it('should add arrays correctly', function() {
      var a2 = [[1,2],[3,4]];
      var a3 = [[5,6],[7,8]];
      var a4 = add(a2, a3);
      assert.deepEqual(a4, [[6,8],[10,12]]);
    });
    
    it('should add 3 dimension arrays correctly', function() {
      var a2 = [[[1,1],[2,2]],[[3,3],[4,4]]];
      var a3 = [[[5,5],[6,6]],[[7,7],[8,8]]];
      var a4 = add(a2, a3);
      assert.deepEqual(a4, [[[6,6],[8,8]],[[10,10],[12,12]]]);
    });
    
    it('should add a scalar and an array correctly', function() {
      assert.deepEqual(add(2, [3,4]), [5,6]);
      assert.deepEqual(add([3,4], 2), [5,6]);
    });

    it('should add array and dense matrix correctly', function() {
      var a = [1,2,3];
      var b = math.matrix([3,2,1]);
      var c = add(a, b);

      assert.ok(c instanceof math.type.Matrix);
      assert.deepEqual(c, math.matrix([4,4,4]));
    });
    
    it('should add array and sparse matrix correctly', function() {
      var a = [[1,2,3],[4,5,6]];
      var b = math.sparse([[6, 5, 4],[ 3, 2, 1]]);
      var c = add(a, b);

      assert.ok(c instanceof math.type.Matrix);
      assert.deepEqual(c, math.matrix([[7,7,7],[7,7,7]]));
    });
  });

  describe('DenseMatrix', function () {
    
    it('should handle strings and matrices element wise', function() {
      assert.deepEqual(add('2', math.matrix(['3', '4'])), math.matrix([5, 6]));
      assert.deepEqual(add(math.matrix(['2', '3']), '4'), math.matrix([6, 7]));
    });
    
    it('should add matrices correctly', function() {
      var a2 = math.matrix([[1,2],[3,4]]);
      var a3 = math.matrix([[5,6],[7,8]]);
      var a4 = add(a2, a3);
      assert.ok(a4 instanceof math.type.Matrix);
      assert.deepEqual(a4.size(), [2,2]);
      assert.deepEqual(a4.valueOf(), [[6,8],[10,12]]);
    });
    
    it('should add 3 dimension natrices correctly', function() {
      var a2 = math.matrix([[[1,1],[2,2]],[[3,3],[4,4]]]);
      var a3 = math.matrix([[[5,5],[6,6]],[[7,7],[8,8]]]);
      var a4 = add(a2, a3);
      assert.deepEqual(a4, math.matrix([[[6,6],[8,8]],[[10,10],[12,12]]]));
    });
    
    it('should add a scalar and a matrix correctly', function() {
      assert.deepEqual(add(2, math.matrix([3,4])), math.matrix([5,6]));
      assert.deepEqual(add(math.matrix([3,4]), 2), math.matrix([5,6]));
    });

    it('should add matrix and array correctly', function() {
      var a = math.matrix([1,2,3]);
      var b = [3,2,1];
      var c = add(a, b);

      assert.ok(c instanceof math.type.Matrix);
      assert.deepEqual(c, math.matrix([4,4,4]));
    });
    
    it('should add dense and sparse matrices correctly', function() {
      var a = math.matrix([[1,2,3],[1,0,0]]);
      var b = math.sparse([[3,2,1],[0,0,1]]);
      var c = add(a, b);

      assert.ok(c instanceof math.type.Matrix);
      assert.deepEqual(c, math.matrix([[4,4,4],[1,0,1]]));
    });
  });
  
  describe('SparseMatrix', function () {

    it('should add matrices correctly', function() {
      var a2 = math.matrix([[1,2],[3,4]], 'sparse');
      var a3 = math.matrix([[5,-2],[7,-4]], 'sparse');
      var a4 = add(a2, a3);
      assert.ok(a4 instanceof math.type.Matrix);
      assert.deepEqual(a4, math.sparse([[6,0],[10,0]]));
    });

    it('should add a scalar and a matrix correctly', function() {
      assert.deepEqual(add(2, math.matrix([[3,4],[5,6]], 'sparse')), math.matrix([[5,6],[7,8]], 'dense'));
      assert.deepEqual(add(math.matrix([[3,4],[5,6]], 'sparse'), 2), math.matrix([[5,6],[7,8]], 'dense'));
    });

    it('should add matrix and array correctly', function() {
      var a = math.matrix([[1,2,3],[1,0,0]], 'sparse');
      var b = [[3,2,1],[0,0,1]];
      var c = add(a, b);

      assert.ok(c instanceof math.type.Matrix);
      assert.deepEqual(c, math.matrix([[4,4,4],[1,0,1]]));
    });
    
    it('should add sparse and dense matrices correctly', function() {
      var a = math.sparse([[1,2,3],[1,0,0]]);
      var b = math.matrix([[3,2,1],[0,0,1]]);
      var c = add(a, b);

      assert.ok(c instanceof math.type.Matrix);
      assert.deepEqual(c, math.matrix([[4,4,4],[1,0,1]]));
    });
    
    it('should add sparse and sparse matrices correctly', function() {
      var a = math.sparse([[1,2,3],[1,0,0]]);
      var b = math.sparse([[3,2,1],[0,0,1]]);
      var c = add(a, b);

      assert.ok(c instanceof math.type.Matrix);
      assert.deepEqual(c, math.sparse([[4,4,4],[1,0,1]]));
    });
    
    it('should add two pattern matrices correctly', function() {
      
      var a = new math.type.SparseMatrix({
        values: undefined,
        index: [0, 1, 2, 0],
        ptr: [0, 2, 3, 4],
        size: [3, 3]
      });
      
      var b = new math.type.SparseMatrix({
        values: undefined,
        index: [0, 1, 2, 1],
        ptr: [0, 3, 3, 4],
        size: [3, 3]
      });
      
      var c = add(a, b);
      
      assert.deepEqual(
        c, 
        new math.type.SparseMatrix({
          values: undefined,
          index: [0, 1, 2, 2, 0, 1],
          ptr: [0, 3, 4, 6],
          size: [3, 3]
        }));
    });
    
    it('should add pattern and value matrices correctly', function() {

      var a = new math.type.SparseMatrix({
        values: undefined,
        index: [0, 1, 2, 0],
        ptr: [0, 2, 3, 4],
        size: [3, 3]
      });

      var b = new math.type.SparseMatrix({
        values: [1, 2, 3, 4],
        index: [0, 1, 2, 1],
        ptr: [0, 3, 3, 4],
        size: [3, 3]
      });

      var c = add(a, b);

      assert.deepEqual(
        c, 
        new math.type.SparseMatrix({
          values: undefined,
          index: [0, 1, 2, 2, 0, 1],
          ptr: [0, 3, 4, 6],
          size: [3, 3]
        }));
    });
    
    it('should add value and pattern matrices correctly', function() {

      var a = new math.type.SparseMatrix({
        values: [1, 2, 3, 4],
        index: [0, 1, 2, 0],
        ptr: [0, 2, 3, 4],
        size: [3, 3]
      });

      var b = new math.type.SparseMatrix({
        values: undefined,
        index: [0, 1, 2, 1],
        ptr: [0, 3, 3, 4],
        size: [3, 3]
      });

      var c = add(a, b);

      assert.deepEqual(
        c, 
        new math.type.SparseMatrix({
          values: undefined,
          index: [0, 1, 2, 2, 0, 1],
          ptr: [0, 3, 4, 6],
          size: [3, 3]
        }));
    });
  });

  describe ('multiple arguments', function () {

    it ('should add more than two arguments', function () {
      assert.deepEqual(add(2, 3, 4), 9);
      assert.deepEqual(add(2, 3, [5,6]), [10,11]);

      assert.deepEqual(add([1,1], [2,2], [3,3]), [6, 6]);
      assert.deepEqual(add([1,1], [2,2], 3), [6, 6]);
      assert.deepEqual(add([1,1], 2, 3), [6, 6]);

      assert.deepEqual(add(math.matrix([1,1]), math.matrix([2,2]), math.matrix([3,3])), math.matrix([6, 6]));
      assert.deepEqual(add(math.matrix([1,1]), math.matrix([2,2]), 3), math.matrix([6, 6]));
      assert.deepEqual(add(math.matrix([1,1]), 2, 3), math.matrix([6, 6]));
    });

  });

});
