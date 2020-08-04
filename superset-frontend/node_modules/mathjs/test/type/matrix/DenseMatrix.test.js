var assert = require('assert');
var math = require('../../../index');
var Matrix = math.type.Matrix;
var DenseMatrix = math.type.DenseMatrix;
var SparseMatrix = math.type.SparseMatrix;
var Complex = math.type.Complex;
var Range = math.type.Range;

var index = math.index;

describe('DenseMatrix', function() {

  describe('constructor', function() {

    it('should create empty matrix if called with no argument', function() {
      var m = new DenseMatrix();
      assert.deepEqual(m._size, [0]);
      assert.deepEqual(m._data, []);
    });

    it('should create a DenseMatrix from an array', function () {
      var m = new DenseMatrix(
        [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
          [10, 11, 12]
        ]);
      assert.deepEqual(m._size, [4, 3]);
      assert.deepEqual(
        m._data,
        [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
          [10, 11, 12]
        ]);
    });
    
    it('should create a DenseMatrix from an array, number datatype', function () {
      var m = new DenseMatrix(
        [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
          [10, 11, 12]
        ], 'number');
      assert.deepEqual(m._size, [4, 3]);
      assert.deepEqual(
        m._data,
        [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
          [10, 11, 12]
        ]);
      assert(m._datatype === 'number');
    });
    
    it('should create a DenseMatrix an array containing matrices', function () {
      var m = new DenseMatrix([new DenseMatrix([1,2]), new DenseMatrix([3, 4])]);

      assert.deepEqual(m, new DenseMatrix([[1,2],[3, 4]]));
    });
    
    it('should create a DenseMatrix from another DenseMatrix', function () {
      var m1 = new DenseMatrix(
        [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
          [10, 11, 12]
        ]);
      var m2 = new DenseMatrix(m1);
      assert.deepEqual(m1._size, m2._size);
      assert.deepEqual(m1._data, m2._data);
    });
    
    it('should create a DenseMatrix from another DenseMatrix, number datatype', function () {
      var m1 = new DenseMatrix(
        [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
          [10, 11, 12]
        ], 'number');
      var m2 = new DenseMatrix(m1);
      assert.deepEqual(m1._size, m2._size);
      assert.deepEqual(m1._data, m2._data);
      assert.deepEqual(m1._datatype, m2._datatype);
    });
    
    it('should create a DenseMatrix from a SparseMatrix', function () {
      var m1 = new SparseMatrix(
        [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
          [10, 11, 12]
        ]);
      var m2 = new DenseMatrix(m1);
      assert.deepEqual(m1.size(), m2.size());
      assert.deepEqual(m1.toArray(), m2.toArray());
    });
    
    it('should create a DenseMatrix from a SparseMatrix, number datatype', function () {
      var m1 = new SparseMatrix(
        [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
          [10, 11, 12]
        ], 'number');
      var m2 = new DenseMatrix(m1);
      assert.deepEqual(m1.size(), m2.size());
      assert.deepEqual(m1.toArray(), m2.toArray());
      assert.deepEqual(m1._datatype, m2._datatype);
    });

    it('should create a DenseMatrix using method create', function () {
      var a = new DenseMatrix ([1,2,3]);

      var b = a.create([4,5,6]);
      assert.equal(b.isDenseMatrix, true);
      assert.deepEqual(b, new DenseMatrix([4,5,6]));

      var c = a.create([7,8,9], 'number');
      assert.deepEqual(c, new DenseMatrix([7,8,9], 'number'));
    });

    it('should have a property isMatrix', function () {
      var a = new DenseMatrix();
      assert.strictEqual(a.isMatrix, true);
    });

    it('should have a property isDenseMatrix', function () {
      var a = new DenseMatrix();
      assert.strictEqual(a.isDenseMatrix, true);
    });

    it('should have a property type', function () {
      var a = new DenseMatrix();
      assert.strictEqual(a.type, 'DenseMatrix');
    });

    it('should throw an error when the dimensions of the input array are invalid', function () {
      assert.throws(function () {
        new DenseMatrix(
            [
              [1, 2],
              [4, 5, 6]
            ]);
      }, /DimensionError: Dimension mismatch \(3 != 2\)/);
    });

    it('should throw an error when called without new keyword', function () {
      assert.throws(function () { DenseMatrix(); }, /Constructor must be called with the new operator/);
    });

    it('should throw an error when called with invalid datatype', function () {
      assert.throws(function () { new DenseMatrix([], 1); });
    });
  });

  describe('size', function() {

    it('should return the expected size', function() {
      assert.deepEqual(new DenseMatrix().size(), [0]);
      assert.deepEqual(new DenseMatrix([[23]]).size(), [1,1]);
      assert.deepEqual(new DenseMatrix([[1,2,3],[4,5,6]]).size(), [2,3]);
      assert.deepEqual(new DenseMatrix([1,2,3]).size(), [3]);
      assert.deepEqual(new DenseMatrix([[1],[2],[3]]).size(), [3,1]);
      assert.deepEqual(new DenseMatrix([[[1],[2],[3]]]).size(), [1,3,1]);
      assert.deepEqual(new DenseMatrix([[[3]]]).size(), [1,1,1]);
      assert.deepEqual(new DenseMatrix([[]]).size(), [1,0]);
    });

    it('should return a clone of the size', function() {
      var m = new DenseMatrix([[1,2,3], [4,5,6]]);
      var s = m.size();

      assert.deepEqual(s, [2, 3]);

      // change s, should not change the size of m
      s[2] = 4;
      assert.deepEqual(s, [2, 3, 4]);
      assert.deepEqual(m.size(), [2, 3]);
    });

  });

  describe('toString', function() {

    it('should return string representation of matrix', function() {
      assert.equal(new DenseMatrix([[1,2],[3,4]]).toString(), '[[1, 2], [3, 4]]');
      assert.equal(new DenseMatrix([[1,2],[3,1/3]]).toString(), '[[1, 2], [3, 0.3333333333333333]]');
    });
  });
  
  describe('toJSON', function () {

    it('should serialize Matrix', function() {
      assert.deepEqual(
        new DenseMatrix([[1,2],[3,4]]).toJSON(),
        {
          mathjs: 'DenseMatrix',
          data: [[1, 2], [3, 4]],
          size: [2, 2],
          datatype: undefined
        });
    });
    
    it('should serialize Matrix, number datatype', function() {
      assert.deepEqual(
        new DenseMatrix([[1,2],[3,4]], 'number').toJSON(),
        {
          mathjs: 'DenseMatrix',
          data: [[1, 2], [3, 4]],
          size: [2, 2],
          datatype: 'number'
        });
    });
  });
  
  describe('fromJSON', function () {

    it('should deserialize Matrix', function() {
      var json = {
        mathjs: 'DenseMatrix',
        data: [[1, 2], [3, 4]],
        size: [2, 2]
      };
      var m = DenseMatrix.fromJSON(json);
      assert.ok(m instanceof Matrix);

      assert.deepEqual(m._size, [2, 2]);
      assert.strictEqual(m._data[0][0], 1);
      assert.strictEqual(m._data[0][1], 2);
      assert.strictEqual(m._data[1][0], 3);
      assert.strictEqual(m._data[1][1], 4);
    });
    
    it('should deserialize Matrix, number datatype', function() {
      var json = {
        mathjs: 'DenseMatrix',
        data: [[1, 2], [3, 4]],
        size: [2, 2],
        datatype: 'number'
      };
      var m = DenseMatrix.fromJSON(json);
      assert.ok(m instanceof Matrix);

      assert.deepEqual(m._size, [2, 2]);
      assert.strictEqual(m._data[0][0], 1);
      assert.strictEqual(m._data[0][1], 2);
      assert.strictEqual(m._data[1][0], 3);
      assert.strictEqual(m._data[1][1], 4);
      assert.strictEqual(m._datatype, 'number');
    });
  });
  
  describe('format', function () {
    it('should format matrix', function() {
      assert.equal(new DenseMatrix([[1,2],[3,1/3]]).format(), '[[1, 2], [3, 0.3333333333333333]]');
      assert.equal(new DenseMatrix([[1,2],[3,1/3]]).format(3), '[[1, 2], [3, 0.333]]');
      assert.equal(new DenseMatrix([[1,2],[3,1/3]]).format(4), '[[1, 2], [3, 0.3333]]');
    });
  });
  
  describe('resize', function() {

    it('should resize the matrix correctly', function() {
      var m = new DenseMatrix([[1,2,3],[4,5,6]]);
      m.resize([2,4]);
      assert.deepEqual(m.valueOf(), [[1,2,3,0], [4,5,6,0]]);

      m.resize([1,2]);
      assert.deepEqual(m.valueOf(), [[1,2]]);

      m.resize([1,2,2], 8);
      assert.deepEqual(m.valueOf(), [[[1,8],[2,8]]]);

      m.resize([2,3], 9);
      assert.deepEqual(m.valueOf(), [[1,2, 9], [9,9,9]]);

      m = new DenseMatrix();
      m.resize([3,3,3], 6);
      assert.deepEqual(m.valueOf(), [
        [[6,6,6],[6,6,6],[6,6,6]],
        [[6,6,6],[6,6,6],[6,6,6]],
        [[6,6,6],[6,6,6],[6,6,6]]
      ]);

      m.resize([2,2]);
      assert.deepEqual(m.valueOf(), [[6,6],[6,6]]);

      m.resize([0]);
      assert.deepEqual(m.valueOf(), []);
    });

    it('should resize the matrix with uninitialized default value', function() {
      var m = new DenseMatrix([]);
      m.resize([3], math.uninitialized);
      assert.deepEqual(m.valueOf(), arr(uninit, uninit, uninit));
    });
    
    it('should return a different matrix when copy=true', function() {
      var m1 = new DenseMatrix(
        [
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0]
        ]);
      var m2 = m1.resize([2, 2], 0, true);
      assert(m1 !== m2);
      // original matrix cannot be modified
      assert.deepEqual(m1._size, [4, 4]);
      assert.deepEqual(
        m1._data, 
        [
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0]
        ]);
      // new matrix should have correct size
      assert.deepEqual(m2._size, [2, 2]);
      assert.deepEqual(
        m2._data, 
        [
          [0, 0],
          [0, 0]
        ]);
    });
  });

  describe('reshape', function () {

    it('should reshape the matrix properly', function () {
      var m = new DenseMatrix([[1,2,3],[4,5,6]]);
      m.reshape([3,2]);
      assert.deepEqual(m.valueOf(), [[1,2], [3,4], [5,6]]);
      m.reshape([6,1]);
      assert.deepEqual(m.valueOf(), [[1],[2],[3],[4],[5],[6]]);
    });

    it('should return a copy only when specified', function () {
      var m1 = new DenseMatrix([[1, 2], [3, 4]]);
      var m2 = m1.reshape([4]);
      var m3 = m2.reshape([1, 4], true);

      assert.strictEqual(m2, m1);
      assert.deepEqual(m2.valueOf(), [1, 2, 3, 4]);
      assert.deepEqual(m2.valueOf(), m1.valueOf());

      assert.notStrictEqual(m3, m2);
      assert.deepEqual(m3.valueOf(), [[1, 2, 3, 4]]);
      assert.notDeepEqual(m3.valueOf(), m2.valueOf());
    });

    it('should update the size of the reshaped matrix', function () {
      var m1 = new DenseMatrix([[1, 2], [3, 4]]);
      var m2 = m1.reshape([4], true);

      assert.deepEqual(m1.size(), [2, 2]);

      m1.reshape([1, 1, 4]);

      assert.deepEqual(m1.size(), [1, 1, 4]);
      assert.deepEqual(m2.size(), [4]);
    });

  });
  
  describe('get', function () {

    var m = new DenseMatrix([[0, 1], [2, 3]]);

    it('should get a value from the matrix', function() {
      assert.equal(m.get([1,0]), 2);
      assert.equal(m.get([0,1]), 1);
    });

    it('should throw an error when getting a value out of range', function() {
      assert.throws(function () { m.get([3,0]); });
      assert.throws(function () { m.get([1,5]); });
      assert.throws(function () { m.get([1]); });
      assert.throws(function () { m.get([]); });
    });

    it('should throw an error in case of dimension mismatch', function() {
      assert.throws(function () { m.get([0,2,0,2,0,2]); }, /Dimension mismatch/);
    });

    it('should throw an error when getting a value given a invalid index', function() {
      assert.throws(function () { m.get([1.2, 2]); });
      assert.throws(function () { m.get([1,-2]); });
      assert.throws(function () { m.get(1,1); });
      assert.throws(function () { m.get(math.index(1,1)); });
      assert.throws(function () { m.get([[1,1]]); });
    });
  });
  
  describe('set', function () {

    it('should set a value in a matrix', function() {
      var m = new DenseMatrix([[0, 0], [0, 0]]);
      m.set([1,0], 5);
      assert.deepEqual(m, new DenseMatrix([
        [0, 0],
        [5, 0]
      ]));

      m.set([0, 2], 4);
      assert.deepEqual(m, new DenseMatrix([
        [0, 0, 4],
        [5, 0, 0]
      ]));

      m.set([0,0,1], 3);
      assert.deepEqual(m, new DenseMatrix([
        [[0,3], [0,0], [4,0]],
        [[5,0], [0,0], [0,0]]
      ]));
    });

    it('should set a value in a matrix with defaultValue for new elements', function() {
      var m = new DenseMatrix();
      var defaultValue = 0;
      m.set([2], 4, defaultValue);
      assert.deepEqual(m, new DenseMatrix([0, 0, 4]));
    });

    it('should throw an error when setting a value given a invalid index', function() {
      var m = new DenseMatrix([[0, 0], [0, 0]]);
      assert.throws(function() { m.set([2.5,0], 5); });
      assert.throws(function() { m.set([1], 5); });
      assert.throws(function() { m.set([-1, 1], 5); });
      assert.throws(function() { m.set(math.index(new Range(0,0)), 5); });
    });
  });
  
  describe('get subset', function() {

    it('should get the right subset of the matrix', function() {
      var m;

      // get 1-dimensional
      m = new DenseMatrix(math.range(0,10));
      assert.deepEqual(m.size(), [10]);
      assert.deepEqual(m.subset(index(new Range(2, 5))).valueOf(), [2,3,4]);

      // get 2-dimensional
      m = new DenseMatrix([[1,2,3],[4,5,6],[7,8,9]]);
      assert.deepEqual(m.size(), [3,3]);
      assert.deepEqual(m.subset(index(1,1)), 5);
      assert.deepEqual(m.subset(index(new Range(0,2),new Range(0,2))).valueOf(), [[1,2],[4,5]]);
      assert.deepEqual(m.subset(index(1, new Range(1,3))).valueOf(), [[5,6]]);
      assert.deepEqual(m.subset(index(0, new Range(1,3))).valueOf(), [[2,3]]);
      assert.deepEqual(m.subset(index(new Range(1,3), 1)).valueOf(), [[5],[8]]);
      assert.deepEqual(m.subset(index(new Range(1,3), 2)).valueOf(), [[6],[9]]);
      assert.deepEqual(m.subset(index([0,1,2], [1])).valueOf(), [[2],[5],[8]]);

      // get n-dimensional
      m = new DenseMatrix([[[1,2],[3,4]], [[5,6],[7,8]]]);
      assert.deepEqual(m.size(), [2,2,2]);
      assert.deepEqual(m.subset(index(new Range(0,2),new Range(0,2),new Range(0,2))).valueOf(), m.valueOf());
      assert.deepEqual(m.subset(index(0,0,0)), 1);
      assert.deepEqual(m.subset(index(1,1,1)).valueOf(), 8);
      assert.deepEqual(m.subset(index(1,1,new Range(0,2))).valueOf(), [[[7,8]]]);
      assert.deepEqual(m.subset(index(1,new Range(0,2),1)).valueOf(), [[[6],[8]]]);
      assert.deepEqual(m.subset(index(new Range(0,2),1,1)).valueOf(), [[[4]],[[8]]]);
    });

    it('should squeeze the output when index contains a scalar', function() {
      var m = new DenseMatrix(math.range(0,10));
      assert.deepEqual(m.subset(index(1)), 1);
      assert.deepEqual(m.subset(index(new Range(1,2))), new DenseMatrix([1]));

      m = new DenseMatrix([[1,2], [3,4]]);
      assert.deepEqual(m.subset(index(1,1)), 4);
      assert.deepEqual(m.subset(index(new Range(1,2), 1)), new DenseMatrix([[4]]));
      assert.deepEqual(m.subset(index(1, new Range(1,2))), new DenseMatrix([[4]]));
      assert.deepEqual(m.subset(index(new Range(1,2), new Range(1,2))), new DenseMatrix([[4]]));
    });

    it('should throw an error if the given subset is invalid', function() {
      var m = new DenseMatrix();
      assert.throws(function () { m.subset([-1]); });

      m = new DenseMatrix([[1,2,3],[4,5,6]]);
      assert.throws(function () { m.subset([1,2,3]); });
      assert.throws(function () { m.subset([3,0]); });
      assert.throws(function () { m.subset([1]); });
    });

    it('should throw an error in case of wrong number of arguments', function() {
      var m = new DenseMatrix();
      assert.throws(function () { m.subset();}, /Wrong number of arguments/);
      assert.throws(function () { m.subset(1,2,3,4); }, /Wrong number of arguments/);
    });

    it('should throw an error in case of dimension mismatch', function() {
      var m = new DenseMatrix([[1,2,3],[4,5,6]]);
      assert.throws(function () { m.subset(index(new Range(0,2))); }, /Dimension mismatch/);
    });

  });
  
  describe('set subset', function() {

    it('should set the given subset', function() {
      // set 1-dimensional
      var m = new DenseMatrix(math.range(0,7));
      m.subset(index(new Range(2,4)), [20,30]);
      assert.deepEqual(m, new DenseMatrix([0,1,20,30,4,5,6]));
      m.subset(index(4), 40);
      assert.deepEqual(m, new DenseMatrix([0,1,20,30,40,5,6]));

      // set 2-dimensional
      m = new DenseMatrix();
      m.resize([3,3]);
      assert.deepEqual(m, new DenseMatrix([
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
      ]));
      m.subset(index(new Range(1,3), new Range(1,3)), [[1,2],[3,4]]);
      assert.deepEqual(m, new DenseMatrix([
        [0, 0, 0],
        [0, 1, 2],
        [0, 3, 4]]));
      m.subset(index(0, new Range(0,3)), [5,6,7]);
      assert.deepEqual(m, new DenseMatrix([[5,6,7],[0,1,2],[0,3,4]]));
      m.subset(index(new Range(0,3), 0), [8,9,10]);  // unsqueezes the submatrix
      assert.deepEqual(m, new DenseMatrix([[8,6,7],[9,1,2],[10,3,4]]));
    });

    it('should set the given subset with defaultValue for new elements', function() {
      // multiple values
      var m = new DenseMatrix();
      var defaultValue = 0;
      m.subset(index(new Range(3,5)), [3, 4], defaultValue);
      assert.deepEqual(m, new DenseMatrix([0, 0, 0, 3, 4]));

      defaultValue = 1;
      m.subset(index(new Range(3,5),1), [5, 6], defaultValue);
      assert.deepEqual(m, new DenseMatrix([
        [0, 1],
        [0, 1],
        [0, 1],
        [3, 5],
        [4, 6]
      ]));

      defaultValue = 2;
      m.subset(index(new Range(3,5),2), [7, 8], defaultValue);
      assert.deepEqual(m, new DenseMatrix([
        [0, 1, 2],
        [0, 1, 2],
        [0, 1, 2],
        [3, 5, 7],
        [4, 6, 8]
      ]));

      // a single value
      var i = new DenseMatrix();
      defaultValue = 0;
      i.subset(math.index(2, 1), 6, defaultValue);
      assert.deepEqual(i, new DenseMatrix([[0, 0], [0, 0], [0, 6]]));
    });

    it('should unsqueeze the replacement subset if needed', function() {
      var m = new DenseMatrix([[0,0],[0,0]]); // 2x2

      m.subset(index(0, new Range(0,2)), [1,1]); // 2
      assert.deepEqual(m, new DenseMatrix([[1,1],[0,0]]));

      m.subset(index(new Range(0,2), 0), [2,2]); // 2
      assert.deepEqual(m, new DenseMatrix([[2,1],[2,0]]));

      m = new DenseMatrix([[[0],[0],[0]]]); // 1x3x1
      m.subset(index(0, new Range(0,3), 0), [1,2,3]); // 3
      assert.deepEqual(m, new DenseMatrix([[[1],[2],[3]]]));

      m = new DenseMatrix([[[0,0,0]]]); // 1x1x3
      m.subset(index(0, 0, new Range(0,3)), [1,2,3]); // 3
      assert.deepEqual(m, new DenseMatrix([[[1,2,3]]]));

      m = new DenseMatrix([[[0]],[[0]],[[0]]]); // 3x1x1
      m.subset(index(new Range(0,3), 0, 0), [1,2,3]); // 3
      assert.deepEqual(m, new DenseMatrix([[[1]],[[2]],[[3]]]));

      m = new DenseMatrix([[[0,0,0]]]); // 1x1x3
      m.subset(index(0, 0, new Range(0,3)), [[1,2,3]]); // 1x3
      assert.deepEqual(m, new DenseMatrix([[[1,2,3]]]));

      m = new DenseMatrix([[[0]],[[0]],[[0]]]); // 3x1x1
      m.subset(index(new Range(0,3), 0, 0), [[1],[2],[3]]); // 3x1
      assert.deepEqual(m, new DenseMatrix([[[1]],[[2]],[[3]]]));
    });

    it('should leave the subset unchanged when unsqueezing it', function() {
      var m = new DenseMatrix([[0, 0], [0, 0]]);  // 2 dimensional
      var r = new DenseMatrix([1,2]); // 1 dimensional

      m.subset(index(0, new Range(0,2)), r);

      assert.deepEqual(m, new DenseMatrix([[1, 2], [0, 0]]));
      assert.deepEqual(r, new DenseMatrix([1,2]));
    });

    it('should resize the matrix if the replacement subset is different size than selected subset', function() {
      // set 2-dimensional with resize
      var m = new DenseMatrix([[123]]);
      m.subset(index(new Range(1,3), new Range(1,3)), [[1,2],[3,4]]);
      assert.deepEqual(m, new DenseMatrix([[123,0,0],[0,1,2],[0,3,4]]));

      // set resize dimensions
      m = new DenseMatrix([123]);
      assert.deepEqual(m.size(), [1]);

      m.subset(index(new Range(1,3), new Range(1,3)), [[1,2],[3,4]]);
      assert.deepEqual(m, new DenseMatrix([[123,0,0],[0,1,2],[0,3,4]]));

      m.subset(index(new Range(0,2), new Range(0,2)), [[55,55],[55,55]]);
      assert.deepEqual(m, new DenseMatrix([[55,55,0],[55,55,2],[0,3,4]]));

      m = new DenseMatrix();
      m.subset(index(new Range(1,3), new Range(1,3), new Range(1,3)), [[[1,2],[3,4]],[[5,6],[7,8]]]);
      var res = new DenseMatrix([
        [
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0]
        ],
        [
          [0, 0, 0],
          [0, 1, 2],
          [0, 3, 4]
        ],
        [
          [0, 0, 0],
          [0, 5, 6],
          [0, 7, 8]
        ]
      ]);
      assert.deepEqual(m, res);
    });

    it ('should throw an error in case of wrong type of index', function () {
      assert.throws(function () { new DenseMatrix().subset('no index', 2); }, /Invalid index/);
    });

    it ('should throw an error in case of wrong size of submatrix', function () {
      assert.throws(function () { new DenseMatrix().subset(index(0), [2,3]); }, /Scalar expected/);
    });

    it('should throw an error in case of dimension mismatch', function() {
      var m = new DenseMatrix([[1,2,3],[4,5,6]]);
      assert.throws(function () { m.subset(index(new Range(0,2)), [100,100]); }, /Dimension mismatch/);
      assert.throws(function () { m.subset(index(new Range(0,2), new Range(0,2)), [100,100]); }, /Dimension mismatch/);
    });

  });
  
  describe('map', function() {

    it('should apply the given function to all elements in the matrix', function() {
      var m = new DenseMatrix([
        [[1,2],[3,4]],
        [[5,6],[7,8]],
        [[9,10],[11,12]],
        [[13,14],[15,16]]
      ]);      
      var m2 = m.map(function (value) { return value * 2; });      
      assert.deepEqual(
        m2.valueOf(), 
        [
          [[2,4],[6,8]],
          [[10,12],[14,16]],
          [[18,20],[22,24]],
          [[26,28],[30,32]]
        ]);

      m = new DenseMatrix([1]);
      m2 = m.map(function (value) { return value * 2; });
      assert.deepEqual(m2.valueOf(), [2]);

      m = new DenseMatrix([1,2,3]);
      m2 = m.map(function (value) { return value * 2; });
      assert.deepEqual(m2.valueOf(), [2,4,6]);
    });

    it('should work on empty matrices', function() {
      var m = new DenseMatrix([]);
      var m2 = m.map(function (value) { return value * 2; });
      assert.deepEqual(m2.toArray(), []);
    });

    it('should invoke callback with parameters value, index, obj', function() {
      var m = new DenseMatrix([[1,2,3], [4,5,6]]);
      var m2 = m.map(
        function (value, index, obj) {
          return math.clone([value, index, obj === m]);
        }
      );

      assert.deepEqual(
        m2.toArray(),
        [
          [
            [1, [0, 0], true ],
            [2, [0, 1], true ],
            [3, [0, 2], true ]
          ],
          [
            [4, [1, 0], true ],
            [5, [1, 1], true ],
            [6, [1, 2], true ]
          ]
        ]);
    });
  });
  
  describe('forEach', function() {

    it('should run on all elements of the matrix, last dimension first', function() {
      var m, output;

      m = new DenseMatrix([
        [[1,2],[3,4]],
        [[5,6],[7,8]],
        [[9,10],[11,12]],
        [[13,14],[15,16]]
      ]);
      output = [];
      m.forEach(function (value) { output.push(value); });
      assert.deepEqual(output, [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]);

      m = new DenseMatrix([1]);
      output = [];
      m.forEach(function (value) { output.push(value); });
      assert.deepEqual(output, [1]);

      m = new DenseMatrix([1,2,3]);
      output = [];
      m.forEach(function (value) { output.push(value); });
      assert.deepEqual(output, [1,2,3]);
    });

    it('should work on empty matrices', function() {
      var m = new DenseMatrix([]);
      var output = [];
      m.forEach(function (value) { output.push(value); });
      assert.deepEqual(output, []);
    });

    it('should invoke callback with parameters value, index, obj', function() {
      var m = new DenseMatrix([[1,2,3], [4,5,6]]);
      var output = [];
      m.forEach(
        function (value, index, obj) {
          output.push(math.clone([value, index, obj === m]));
        }
      );
      assert.deepEqual(output, [
        [1, [0, 0], true ],
        [2, [0, 1], true ],
        [3, [0, 2], true ],
        [4, [1, 0], true ],
        [5, [1, 1], true ],
        [6, [1, 2], true ]
      ]);
    });
  });

  describe('clone', function() {

    it('should clone the matrix properly', function() {
      var m1 = new DenseMatrix(
        [
          [1,2,3],
          [4,5,6]
        ]);

      var m2 = m1.clone();

      assert.deepEqual(m1._data, m2._data);
    });
  });
  
  describe('toArray', function () {

    it('should return array', function () {
      var m = new DenseMatrix({
        data: 
        [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
          [10, 11, 12]
        ],
        size: [4, 3]
      });

      var a = m.toArray();

      assert.deepEqual(
        a, 
        [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
          [10, 11, 12]
        ]);
    });

    it('should return array, complex numbers', function () {
      var m = new DenseMatrix({
        data: [new Complex(1, 1), new Complex(4, 4), new Complex(5, 5), new Complex(2, 2), new Complex(3, 3), new Complex(6, 6)],
        size: [1, 6]
      });

      var a = m.toArray();

      assert.deepEqual(a, [new Complex(1, 1), new Complex(4, 4), new Complex(5, 5), new Complex(2, 2), new Complex(3, 3), new Complex(6, 6)]);
    });
  });

  describe('diagonal', function () {

    it('should create matrix (n x n)', function () {

      var m = DenseMatrix.diagonal([3, 3], 1);

      assert.deepEqual(m._size, [3, 3]);
      assert.deepEqual(
        m.toArray(), 
        [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1]
        ]);
    });

    it('should create matrix (n x n), k > 0', function () {

      var m = DenseMatrix.diagonal([3, 3], 1, 1);

      assert.deepEqual(m._size, [3, 3]);
      assert.deepEqual(
        m.toArray(), 
        [
          [0, 1, 0],
          [0, 0, 1],
          [0, 0, 0]
        ]);
    });

    it('should create matrix (n x n), k < 0', function () {

      var m = DenseMatrix.diagonal([3, 3], 1, -1);

      assert.deepEqual(m._size, [3, 3]);
      assert.deepEqual(
        m.toArray(), 
        [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0]
        ]);
    });

    it('should create matrix (n x n), vector value', function () {

      var m = DenseMatrix.diagonal([3, 3], [1, 2, 3]);

      assert.deepEqual(m._size, [3, 3]);
      assert.deepEqual(
        m.toArray(), 
        [
          [1, 0, 0],
          [0, 2, 0],
          [0, 0, 3]
        ]);
    });

    it('should create matrix (n x n), vector value, k > 0', function () {

      var m = DenseMatrix.diagonal([3, 3], [1, 2], 1);

      assert.deepEqual(m._size, [3, 3]);
      assert.deepEqual(
        m.toArray(), 
        [
          [0, 1, 0],
          [0, 0, 2],
          [0, 0, 0]
        ]);
    });

    it('should create matrix (n x n), vector value, k < 0', function () {

      var m = DenseMatrix.diagonal([3, 3], [1, 2], -1);

      assert.deepEqual(m._size, [3, 3]);
      assert.deepEqual(
        m.toArray(), 
        [
          [0, 0, 0],
          [1, 0, 0],
          [0, 2, 0]
        ]);
    });
    
    it('should create matrix (n x n), matrix vector value', function () {

      var m = DenseMatrix.diagonal([3, 3], math.matrix([1, 2, 3]));

      assert.deepEqual(m._size, [3, 3]);
      assert.deepEqual(
        m.toArray(), 
        [
          [1, 0, 0],
          [0, 2, 0],
          [0, 0, 3]
        ]);
    });

    it('should create matrix (n x n), matrix vector value, k > 0', function () {

      var m = DenseMatrix.diagonal([3, 3], math.matrix([1, 2]), 1);

      assert.deepEqual(m._size, [3, 3]);
      assert.deepEqual(
        m.toArray(), 
        [
          [0, 1, 0],
          [0, 0, 2],
          [0, 0, 0]
        ]);
    });

    it('should create matrix (n x n), matrix vector value, k < 0', function () {

      var m = DenseMatrix.diagonal([3, 3], math.matrix([1, 2]), -1);

      assert.deepEqual(m._size, [3, 3]);
      assert.deepEqual(
        m.toArray(), 
        [
          [0, 0, 0],
          [1, 0, 0],
          [0, 2, 0]
        ]);
    });

    it('should create matrix (m x n), m > n', function () {

      var m = DenseMatrix.diagonal([4, 3], 1);

      assert.deepEqual(m._size, [4, 3]);
      assert.deepEqual(
        m.toArray(), 
        [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
          [0, 0, 0]
        ]);
    });

    it('should create matrix (m x n), m > n, k > 0', function () {

      var m = DenseMatrix.diagonal([4, 3], 1, 1);

      assert.deepEqual(m._size, [4, 3]);
      assert.deepEqual(
        m.toArray(), 
        [
          [0, 1, 0],
          [0, 0, 1],
          [0, 0, 0],
          [0, 0, 0]
        ]);
    });

    it('should create matrix (m x n), m > n, k < 0', function () {

      var m = DenseMatrix.diagonal([4, 3], 1, -1);

      assert.deepEqual(m._size, [4, 3]);
      assert.deepEqual(
        m.toArray(), 
        [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ]);
    });

    it('should create matrix (m x n), m > n, vector value', function () {

      var m = DenseMatrix.diagonal([4, 3], [1, 2, 3]);

      assert.deepEqual(m._size, [4, 3]);
      assert.deepEqual(
        m.toArray(), 
        [
          [1, 0, 0],
          [0, 2, 0],
          [0, 0, 3],
          [0, 0, 0]
        ]);
    });

    it('should create matrix (m x n), m > n, vector value, k > 0', function () {

      var m = DenseMatrix.diagonal([4, 3], [1, 2], 1);

      assert.deepEqual(m._size, [4, 3]);
      assert.deepEqual(
        m.toArray(), 
        [
          [0, 1, 0],
          [0, 0, 2],
          [0, 0, 0],
          [0, 0, 0]
        ]);
    });

    it('should create matrix (m x n), m > n, vector value, k < 0', function () {

      var m = DenseMatrix.diagonal([4, 3], [1, 2, 3], -1);

      assert.deepEqual(m._size, [4, 3]);
      assert.deepEqual(
        m.toArray(), 
        [
          [0, 0, 0],
          [1, 0, 0],
          [0, 2, 0],
          [0, 0, 3]
        ]);
    });

    it('should create matrix (m x n), m < n', function () {

      var m = DenseMatrix.diagonal([3, 4], 1);

      assert.deepEqual(m._size, [3, 4]);
      assert.deepEqual(
        m.toArray(), 
        [
          [1, 0, 0, 0],
          [0, 1, 0, 0],
          [0, 0, 1, 0]
        ]);
    });

    it('should create matrix (m x n), m < n, k > 0', function () {

      var m = DenseMatrix.diagonal([3, 4], 1, 1);

      assert.deepEqual(m._size, [3, 4]);
      assert.deepEqual(
        m.toArray(), 
        [
          [0, 1, 0, 0],
          [0, 0, 1, 0],
          [0, 0, 0, 1]
        ]);
    });

    it('should create matrix (m x n), m < n, k < 0', function () {

      var m = DenseMatrix.diagonal([3, 4], 1, -1);

      assert.deepEqual(m._size, [3, 4]);
      assert.deepEqual(
        m.toArray(), 
        [
          [0, 0, 0, 0],
          [1, 0, 0, 0],
          [0, 1, 0, 0]
        ]);
    });

    it('should create matrix (m x n), m < n, vector value', function () {

      var m = DenseMatrix.diagonal([3, 4], [1, 2, 3]);

      assert.deepEqual(m._size, [3, 4]);
      assert.deepEqual(
        m.toArray(), 
        [
          [1, 0, 0, 0],
          [0, 2, 0, 0],
          [0, 0, 3, 0]
        ]);
    });

    it('should create matrix (m x n), m < n, vector value, k > 0', function () {

      var m = DenseMatrix.diagonal([3, 4], [1, 2, 3], 1);

      assert.deepEqual(m._size, [3, 4]);
      assert.deepEqual(
        m.toArray(), 
        [
          [0, 1, 0, 0],
          [0, 0, 2, 0],
          [0, 0, 0, 3]
        ]);
    });

    it('should create matrix (m x n), m < n, vector value, k < 0', function () {

      var m = DenseMatrix.diagonal([3, 4], [1, 2], -1);

      assert.deepEqual(m._size, [3, 4]);
      assert.deepEqual(
        m.toArray(), 
        [
          [0, 0, 0, 0],
          [1, 0, 0, 0],
          [0, 2, 0, 0]
        ]);
    });

    it('should get matrix diagonal (n x n)', function () {

      var m = new DenseMatrix(
        [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1]
        ]);

      assert.deepEqual(m.diagonal(), new DenseMatrix([1, 1, 1]));
    });

    it('should get matrix diagonal (n x n), k > 0', function () {

      var m = new DenseMatrix(
        [
          [1, 2, 0],
          [0, 1, 3],
          [0, 0, 1]
        ]);

      assert.deepEqual(m.diagonal(1), new DenseMatrix([2, 3]));
    });

    it('should get matrix diagonal (n x n), k < 0', function () {

      var m = new DenseMatrix(
        [
          [1, 0, 0],
          [2, 1, 0],
          [0, 3, 1]
        ]);

      assert.deepEqual(m.diagonal(-1), new DenseMatrix([2, 3]));
    });

    it('should get matrix diagonal (m x n), m > n', function () {

      var m = new DenseMatrix(
        [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
          [0, 0, 0]
        ]);

      assert.deepEqual(m.diagonal(), new DenseMatrix([1, 1, 1]));
    });

    it('should get matrix diagonal (m x n), m > n, k > 0', function () {

      var m = new DenseMatrix(
        [
          [1, 2, 0],
          [0, 1, 3],
          [0, 0, 1],
          [0, 0, 0]
        ]);

      assert.deepEqual(m.diagonal(1), new DenseMatrix([2, 3]));
    });

    it('should get matrix diagonal (m x n), m > n, k < 0', function () {

      var m = new DenseMatrix(
        [
          [1, 0, 0],
          [2, 1, 0],
          [0, 3, 1],
          [0, 0, 4]
        ]);

      assert.deepEqual(m.diagonal(-1), new DenseMatrix([2, 3, 4]));
    });

    it('should get matrix diagonal (m x n), m < n', function () {

      var m = new DenseMatrix(
        [
          [1, 0, 0, 0],
          [0, 1, 0, 0],
          [0, 0, 1, 0]
        ]);

      assert.deepEqual(m.diagonal(), new DenseMatrix([1, 1, 1]));
    });

    it('should get matrix diagonal (m x n), m < n, k > 0', function () {

      var m = new DenseMatrix(
        [
          [1, 2, 0, 0],
          [0, 1, 3, 0],
          [0, 0, 1, 4]
        ]);

      assert.deepEqual(m.diagonal(1), new DenseMatrix([2, 3, 4]));
    });

    it('should get matrix diagonal (m x n), m < n, k < 0', function () {

      var m = new DenseMatrix(
        [
          [1, 0, 0, 0],
          [2, 1, 0, 0],
          [4, 3, 1, 0]
        ]);

      assert.deepEqual(m.diagonal(-1), new DenseMatrix([2, 3]));

      assert.deepEqual(m.diagonal(-2), new DenseMatrix([4]));
    });
  });

  describe('swapRows', function () {

    it('should swap rows with values', function () {
      var m = new DenseMatrix(
        [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
          [10, 11, 12]
        ]);
      m.swapRows(1, 2);
      assert.deepEqual(
        m.valueOf(),
        [
          [1, 2, 3],
          [7, 8, 9],
          [4, 5, 6],          
          [10, 11, 12]
        ]);
    });

    it('should swap row with value and no values', function () {
      var m = new DenseMatrix(
        [
          [1, 2, 3],
          [4, 5, 6],
          [0, 0, 0],
          [10, 11, 12]
        ]);
      m.swapRows(1, 2);
      assert.deepEqual(
        m.valueOf(),
        [
          [1, 2, 3],
          [0, 0, 0],
          [4, 5, 6],          
          [10, 11, 12]
        ]);
    });

    it('should swap row with no value and values', function () {
      var m = new DenseMatrix(
        [
          [1, 2, 3],
          [4, 5, 6],
          [0, 0, 0],
          [10, 11, 12]
        ]);
      m.swapRows(2, 1);
      assert.deepEqual(
        m.valueOf(),
        [
          [1, 2, 3],
          [0, 0, 0],
          [4, 5, 6],          
          [10, 11, 12]
        ]);
    });

    it('should swap rows with missing values', function () {
      var m = new DenseMatrix(
        [
          [1, 2, 3],
          [0, 5, 0],
          [7, 0, 9],
          [10, 11, 12]
        ]);
      m.swapRows(2, 1);
      assert.deepEqual(
        m.valueOf(),
        [
          [1, 2, 3],
          [7, 0, 9],
          [0, 5, 0],          
          [10, 11, 12]
        ]);
    });

    it('should swap last row with another row', function () {
      var m = new DenseMatrix(
        [
          [1, 2, 3],
          [0, 5, 0],
          [7, 0, 9],
          [10, 11, 12]
        ]);
      m.swapRows(3, 1);
      assert.deepEqual(
        m.valueOf(),
        [
          [1, 2, 3],
          [10, 11, 12],
          [7, 0, 9],
          [0, 5, 0]
        ]);
    });

    it('should swap first row with another row', function () {
      var m = new DenseMatrix(
        [
          [0, 2, 0],
          [0, 5, 0],
          [7, 0, 9],
          [10, 0, 0]
        ]);
      m.swapRows(0, 2);
      assert.deepEqual(
        m.valueOf(),
        [
          [7, 0, 9],
          [0, 5, 0],
          [0, 2, 0],
          [10, 0, 0]
        ]);
    });
  });
  
  /**
   * Helper function to create an Array containing uninitialized values
   * Example: arr(uninit, uninit, 2);    // [ , , 2 ]
   */
  var uninit = {};
  function arr() {
    var array = [];
    array.length = arguments.length;
    for (var i = 0; i < arguments.length; i++) {
      var value = arguments[i];
      if (value !== uninit) {
        array[i] = value;
      }
    }
    return array;
  }
});  
