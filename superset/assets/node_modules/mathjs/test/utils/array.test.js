var assert = require('assert'),
    array = require('../../lib/utils/array'),
    resize = array.resize,
    reshape = array.reshape,
    size = array.size;

describe('util.array', function() {

  describe('size', function () {

    it('should calculate the size of a scalar', function () {
      assert.deepEqual(size(2), []);
      assert.deepEqual(size("string"), []);
    });

    it('should calculate the size of a 1-dimensional array', function () {
      assert.deepEqual(size([]), [0]);
      assert.deepEqual(size([1]), [1]);
      assert.deepEqual(size([1,2,3]), [3]);
    });

    it('should calculate the size of a 2-dimensional array', function () {
      assert.deepEqual(size([[]]), [1,0]);
      assert.deepEqual(size([[], []]), [2,0]);
      assert.deepEqual(size([[1,2],[3,4]]), [2,2]);
      assert.deepEqual(size([[1,2,3],[4,5,6]]), [2,3]);
    });

    it('should calculate the size of a 3-dimensional array', function () {
      assert.deepEqual(size([[[]]]), [1,1,0]);
      assert.deepEqual(size([[[], []]]), [1,2,0]);
      assert.deepEqual(size([[[], []],[[], []]]), [2,2,0]);
      assert.deepEqual(size([[[1],[2]],[[3],[4]]]), [2,2,1]);
      assert.deepEqual(size([[[1,2],[3,4]],[[5,6],[7,8]]]), [2,2,2]);
      assert.deepEqual(size([
        [[1,2,3,4],[5,6,7,8]],
        [[1,2,3,4],[5,6,7,8]],
        [[1,2,3,4],[5,6,7,8]]
      ]), [3,2,4]);
    });

    it('should not validate whether all dimensions match', function () {
      assert.deepEqual(size([[1,2],[3,4,5]]), [2,2]);
    });

  });

  describe('resize', function () {

    it('should resize a 1 dimensional array', function () {
      var a = [];

      // resize with a default value
      a = resize(a, [3], 100);
      assert.deepEqual(a, [100,100,100]);

      // resize without default value
      a = resize(a, [5]);
      assert.deepEqual(a, [100,100,100, 0, 0]);

      a = resize(a, [2]);
      assert.deepEqual(a, [100,100]);
    });

    it('should resize a 1 dimensional array with UNINITIALIZED defaultValue', function () {
      var a = [];

      // resize with default value UNINITIALIZED
      a = resize(a, [3], array.UNINITIALIZED);
      assert.deepEqual(a, arr(uninit, uninit, uninit));
    });

    it('should resize a 2 dimensional array', function () {
      var a = [
        [0, 1],
        [2, 3]
      ];

      a = resize(a, [2, 4]);
      assert.deepEqual(a, [
        [0, 1, 0, 0],
        [2, 3, 0, 0]
      ]);

      a = resize(a, [4, 4]);
      assert.deepEqual(a, [
        [0, 1, 0, 0],
        [2, 3, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
      ]);

      a = resize(a, [4, 2]);
      assert.deepEqual(a, [
        [0, 1],
        [2, 3],
        [0, 0],
        [0, 0]
      ]);

      a = resize(a, [2, 2]);
      assert.deepEqual(a, [
        [0, 1],
        [2, 3]
      ]);

      a = resize(a, [1, 1]);
      assert.deepEqual(a, [
        [0]
      ]);
    });

    it('should resize a 2 dimensional array with default value', function () {
      var a = [
        [0, 1],
        [2, 3]
      ];

      a = resize(a, [2, 4], 100);
      assert.deepEqual(a, [
        [0, 1, 100, 100],
        [2, 3, 100, 100]
      ]);

      a = resize(a, [4, 4], 100);
      assert.deepEqual(a, [
        [0, 1, 100, 100],
        [2, 3, 100, 100],
        [100, 100, 100, 100],
        [100, 100, 100, 100]
      ]);

      a = resize(a, [4, 2]);
      assert.deepEqual(a, [
        [0, 1],
        [2, 3],
        [100, 100],
        [100, 100]
      ]);

      a = resize(a, [2, 2]);
      assert.deepEqual(a, [
        [0, 1],
        [2, 3]
      ]);

      a = resize(a, [1, 1]);
      assert.deepEqual(a, [
        [0]
      ]);
    });

    it('should resize a 1 dimensional array to 2 dimensional', function () {
      var a = [1, 2];

      a = resize(a, [4], 3);
      assert.deepEqual(a, [1, 2, 3, 3]);

      a = resize(a, [4, 2], 4);
      assert.deepEqual(a, [
          [1, 4],
          [2, 4],
          [3, 4],
          [3, 4]
      ]);

      // without default value
      var b = [1, 2];

      b = resize(b, [4]);
      assert.deepEqual(b, [1, 2, 0, 0]);

      b = resize(b, [4, 2]);
      assert.deepEqual(b, [
          [1, 0],
          [2, 0],
          [0, 0],
          [0, 0]
      ]);
      // TODO: would be nicer if this returns uninit everwhere and not undefined on some places
    });

    it('should resize a 2 dimensional array to 1 dimensional', function () {
      var a = [[1,2],[3,4],[5,6],[7,8]];
      a = resize(a, [6]);
      assert.deepEqual(a, [1,3,5,7,0,0]);

      var b = [[],[]];
      b = resize(b, [2], 8);
      assert.deepEqual(b, [undefined, undefined]);

      var b = [];
      b = resize(b, [2], 8);
      assert.deepEqual(b, [8, 8]);

    });

    it('should resize a 3 dimensional array', function () {
      var a = [];
      a = resize(a, [2,3], 5);
      assert.deepEqual(a, [[5,5,5], [5,5,5]]);

      a = resize(a, [2,3,2], 7);
      assert.deepEqual(a, [[[5,7],[5,7],[5,7]], [[5,7],[5,7],[5,7]]]);

      a = resize(a, [3,2], 9);
      assert.deepEqual(a, [[5,5], [5,5], [9, 9]]);
    });

    it('should resize to an empty array', function () {
      var a = [];
      a = resize(a, [2,3], 5);
      assert.deepEqual(a, [[5,5,5], [5,5,5]]);

      a = resize(a, [0]);
      assert.deepEqual(a, []);
    });

    it('should throw an error when resizing to a scalar', function () {
      var a = [];
      assert.throws(function () {a = resize(a, []);}, /Resizing to scalar is not supported/);
    });

    it('should throw an error in case of wrong type of arguments', function () {
      assert.throws(function () {resize([], 2)}, /Array expected/);
      assert.throws(function () {resize(2)}, /Array expected/);
    });
  });

  describe('reshape', function () {

    it('should reshape a 1 dimensional array into a 2 dimensional array', function () {
      var a = [1, 2, 3, 4, 5, 6, 7, 8];

      assert.deepEqual(
        reshape(a, [2, 4]),
        [[1, 2, 3, 4],
         [5, 6, 7, 8]]
      );
      assert.deepEqual(
        reshape(a, [4, 2]),
        [[1, 2],
         [3, 4],
         [5, 6],
         [7, 8]]
      );
      assert.deepEqual(
        reshape(a, [1, 8]),
        [[1, 2, 3, 4, 5, 6, 7, 8]]
      );
      assert.deepEqual(
        reshape(a, [1, 1, 8]),
        [[[1, 2, 3, 4, 5, 6, 7, 8]]]
      );
    });

    it('should reshape a 2 dimensional array into a 1 dimensional array', function () {
      var a = [
        [0, 1],
        [2, 3]
      ];

      assert.deepEqual(
        reshape(a, [4]),
        [0, 1, 2, 3]
      );
    });

    it('should reshape a 3 dimensional array', function () {
      var a = [[[1, 2],
                [3, 4]],

               [[5, 6],
                [7, 8]]];

      assert.deepEqual(
        reshape(a, [8]),
        [1, 2, 3, 4, 5, 6, 7, 8]
      );

      assert.deepEqual(
        reshape(a, [2, 4]),
        [[1, 2, 3, 4],
         [5, 6, 7, 8]]
      );

    });

    it('should throw an error when reshaping to a dimension with length 0', function () {
      assert.throws(function () {reshape([1, 2], [0, 2]);}, /DimensionError/);
      assert.throws(function () {reshape([1, 2], [2, 0]);}, /DimensionError/);
    });

    it('should throw an error when reshaping a non-empty array to an empty array', function () {
      assert.throws(function () {reshape([1], []);}, /DimensionError/);
      assert.throws(function () {reshape([1, 2], []);}, /DimensionError/);
    });

    it('should throw an error when reshaping to a size that differs from the original', function () {
      var a = [1, 2, 3, 4, 5, 6, 7, 8, 9];

      assert.deepEqual(
        reshape(a, [3, 3]),
        [[1, 2, 3],
         [4, 5, 6],
         [7, 8, 9]]
      );
      assert.throws(function () {reshape(a, [3, 2]);}, /DimensionError/);
      assert.throws(function () {reshape(a, [2, 3]);}, /DimensionError/);
      assert.throws(function () {reshape(a, [3, 3, 3]);}, /DimensionError/);
      assert.throws(function () {reshape(a, [3, 4]);}, /DimensionError/);
      assert.throws(function () {reshape(a, [4, 3]);}, /DimensionError/);
    });

    it('should throw an error in case of wrong type of arguments', function () {
      assert.throws(function () {reshape([], 2);}, /Array expected/);
      assert.throws(function () {reshape(2);}, /Array expected/);
    });

  });

  describe('squeeze', function () {

    it('should squeeze a scalar', function () {
      assert.deepEqual(array.squeeze(2), 2);
      assert.deepEqual(array.squeeze({}), {});
      assert.deepEqual(array.squeeze('string'), 'string');
    });

    it('should squeeze an array', function () {
      // leave zero dimensions as is
      assert.deepEqual(array.squeeze([]), []);
      assert.deepEqual(array.squeeze([[]]), []);
      assert.deepEqual(array.squeeze([[[]]]), []);
      assert.deepEqual(array.squeeze([[[], []]]), [[], []]);
      assert.deepEqual(array.squeeze([[[]], [[]]]), [[[]], [[]]]);

      assert.deepEqual(array.squeeze(2), 2);
      assert.deepEqual(array.squeeze([[2]]), 2);
      assert.deepEqual(array.squeeze([[[2]]]), 2);
      assert.deepEqual(array.squeeze([1, 2, 3]), [1, 2, 3]);
      assert.deepEqual(array.squeeze([[1, 2, 3]]), [1, 2, 3]);
      assert.deepEqual(array.squeeze([[[1, 2, 3]]]), [1, 2, 3]);
      assert.deepEqual(array.squeeze([[1], [2], [3]]), [1, 2, 3]);
      assert.deepEqual(array.squeeze([[1, 2], [3, 4]]), [[1, 2], [3, 4]]);
      assert.deepEqual(array.squeeze([[[1, 2]], [[3, 4]]]), [[[1, 2]], [[3, 4]]]);
      assert.deepEqual(array.squeeze([[[1, 2], [3, 4]]]), [[1, 2], [3, 4]]);
      assert.deepEqual(array.squeeze([[[1], [2]], [[3], [4]]]), [[1, 2], [3, 4]]);
      assert.deepEqual(array.squeeze([[[1]], [[2]], [[3]], [[4]]]), [1, 2, 3, 4]);
    });

    it('should adjust size when squeezing an array', function () {
      var a = [[[1], [2]], [[3], [4]]];
      var size = [2,2,1];
      a = array.squeeze(a, size);
      assert.deepEqual(a, [[1, 2], [3, 4]]);
      assert.deepEqual(size, [2,2]);

      a = [[1,2]];
      size = [1,2];
      a = array.squeeze(a, size);
      assert.deepEqual(a, [1,2]);
      assert.deepEqual(size, [2]);

      a = [[[1]], [[2]], [[3]], [[4]]];
      size = [4,1,1];
      a = array.squeeze(a, size);
      assert.deepEqual(a, [1, 2, 3, 4]);
      assert.deepEqual(size, [4]);
    });

  });

  describe('unsqueeze', function () {

    it('should unsqueeze a scalar', function () {
      assert.deepEqual(array.unsqueeze(2, 0), 2);
      assert.deepEqual(array.unsqueeze(2, 1), [2]);
      assert.deepEqual(array.unsqueeze(2, 2), [[2]]);
      assert.deepEqual(array.unsqueeze('string', 2), [['string']]);
    });

    it('should ignore empty arrays in unsqueeze', function () {
      // should do nothing with empty arrays
      assert.deepEqual(array.unsqueeze([], 0), []);
      assert.deepEqual(array.unsqueeze([], 1), []);
      assert.deepEqual(array.unsqueeze([], 2), []);
      assert.deepEqual(array.unsqueeze([], 3), []);
      assert.deepEqual(array.unsqueeze([[]], 0), [[]]);
      assert.deepEqual(array.unsqueeze([[]], 1), [[]]);
      assert.deepEqual(array.unsqueeze([[]], 2), [[]]);
      assert.deepEqual(array.unsqueeze([[]], 3), [[]]);
    });

    it('should unsqueeze an array', function () {
      assert.deepEqual(array.unsqueeze([1, 2, 3], 1), [1, 2, 3]);
      assert.deepEqual(array.unsqueeze([1, 2, 3], 2), [[1], [2], [3]]);
      assert.deepEqual(array.unsqueeze([1, 2, 3], 3), [[[1]], [[2]], [[3]]]);
      assert.deepEqual(array.unsqueeze([1, 2, 3], 3, 1), [[[1], [2], [3]]]);
      assert.deepEqual(array.unsqueeze([1, 2, 3], 3, 2), [[[1, 2, 3]]]);

      assert.deepEqual(array.unsqueeze([[1, 2], [3, 4]], 1), [[1, 2], [3, 4]]);
      assert.deepEqual(array.unsqueeze([[1, 2], [3, 4]], 2), [[1, 2], [3, 4]]);
      assert.deepEqual(array.unsqueeze([[1, 2], [3, 4]], 3), [[[1], [2]], [[3], [4]]]);
    });

    it('should adjust size when unsqueezing an array', function () {
      var a = [[1, 2], [3, 4]];
      var size = [2,2];
      array.unsqueeze(a, 3, 0, size);
      assert.deepEqual(a, [[[1], [2]], [[3], [4]]]);
      assert.deepEqual(size, [2,2,1]);

      a = [1, 2, 3, 4];
      size = [4];
      array.unsqueeze(a, 3, 0, size);
      assert.deepEqual(a, [[[1]], [[2]], [[3]], [[4]]]);
      assert.deepEqual(size, [4,1,1]);
    });

  });

  describe('resize', function () {

    it('should test whether an object is an array', function () {
      assert.equal(array.isArray([]), true);
      assert.equal(array.isArray({}), false);
      assert.equal(array.isArray(2), false);
      assert.equal(array.isArray('string'), false);
    });

  });

  describe('validateIndex', function () {

    it('should validate whether an index contains integers', function () {
      assert.equal(array.validateIndex(2), undefined);
      assert.equal(array.validateIndex(10), undefined);
      assert.throws(function () {array.validateIndex(2.3)}, /Index must be an integer/);
      assert.throws(function () {array.validateIndex('str')}, /Index must be an integer/);
      assert.throws(function () {array.validateIndex(true)}, /Index must be an integer/);
    });

    it('should validate whether an index doesn\'t exceed the minimum 0', function () {
      assert.equal(array.validateIndex(2), undefined);
      assert.equal(array.validateIndex(0), undefined);
      assert.throws(function () {array.validateIndex(-1)}, /Index out of range/);
      assert.throws(function () {array.validateIndex(-100)}, /Index out of range/);
    });

    it('should validate whether an index doesn\'t exceed both minimum and maximum', function () {
      assert.equal(array.validateIndex(0, 10), undefined);
      assert.equal(array.validateIndex(4, 10), undefined);
      assert.equal(array.validateIndex(9, 10), undefined);
      assert.throws(function () {array.validateIndex(-1, 10)}, /Index out of range/);
      assert.throws(function () {array.validateIndex(10, 10)}, /Index out of range/);
      assert.throws(function () {array.validateIndex(11, 10)}, /Index out of range/);
      assert.throws(function () {array.validateIndex(100, 10)}, /Index out of range/);
    });

    it('thrown IndexError should contain the right index, max, and min properties', function () {
      try {
        array.validateIndex(4, 3);
        assert.ok(false, 'should not reach this point');
      }
      catch(err) {
        assert.equal(err.toString(), 'IndexError: Index out of range (4 > 2)');
        assert.equal(err.index, 4);
        assert.equal(err.min, 0);
        assert.equal(err.max, 3);
      }

      try {
        array.validateIndex(-1, 3);
        assert.ok(false, 'should not reach this point');
      }
      catch(err) {
        assert.equal(err.toString(), 'IndexError: Index out of range (-1 < 0)');
        assert.equal(err.index, -1);
        assert.equal(err.min, 0);
        assert.equal(err.max, 3);
      }

      try {
        array.validateIndex(-1);
        assert.ok(false, 'should not reach this point');
      }
      catch(err) {
        assert.equal(err.toString(), 'IndexError: Index out of range (-1 < 0)');
        assert.equal(err.index, -1);
        assert.equal(err.min, 0);
        assert.equal(err.max, undefined);
      }

    });

  });

  describe('validate', function () {

    it('should validate whether all elements in a vector have correct size', function () {
      // valid vector with correct size
      assert.equal(array.validate([], [0]), undefined);
      assert.equal(array.validate([1], [1]), undefined);
      assert.equal(array.validate([1,2,3], [3]), undefined);

      // valid matrix but wrong size
      assert.throws(function () {array.validate([1,2,3], [2])}, /Dimension mismatch/);
      assert.throws(function () {array.validate([1,2,3], [4])}, /Dimension mismatch/);
      assert.throws(function () {array.validate([1,2,3], [])}, /Dimension mismatch/);
      assert.throws(function () {array.validate([1,2,3], [3,2])}, /Dimension mismatch/);

      // invalid vector
      assert.throws(function () {array.validate([1,[2],3], [3])}, /Dimension mismatch/);
    });

    it('should validate whether all elements in a 2d matrix have correct size', function () {
      // valid matrix with correct size
      assert.equal(array.validate([[1,2],[3,4]], [2,2]), undefined);
      assert.equal(array.validate([[1,2,3],[4,5,6]], [2,3]), undefined);
      assert.equal(array.validate([[1,2],[3,4],[5,6]], [3,2]), undefined);

      // valid matrix with wrong size
      assert.throws(function () {array.validate([[1,2],[3,4]], [2,1])}, /Dimension mismatch/);
      assert.throws(function () {array.validate([[1,2],[3,4]], [3,2])}, /Dimension mismatch/);
      assert.throws(function () {array.validate([[1,2,3],[4,5,6]], [2,4])}, /Dimension mismatch/);
      assert.throws(function () {array.validate([[1,2],[3,4],[5,6]], [4,3])}, /Dimension mismatch/);

      // invalid matrix
      assert.throws(function () {array.validate([[1,2],[3,4,5]], [2,2])}, /Dimension mismatch/);
      assert.throws(function () {array.validate([[1,2],[3]], [2,2])}, /Dimension mismatch/);
      assert.throws(function () {array.validate([[1,2],3], [2,2])}, /Dimension mismatch/);
      assert.throws(function () {array.validate([1,2], [2,2])}, /Dimension mismatch/);
      assert.throws(function () {array.validate([[[1,2],[3,4]]], [2,2])}, /Dimension mismatch/);
    });

    it('should validate whether all elements in a multi dimensional matrix have correct size', function () {
      // valid matrix with correct size
      assert.equal(array.validate([[[1,2],[3,4]],[[5,6],[7,8]]], [2,2,2]), undefined);
      assert.equal(array.validate([[[1,2,3],[4,5,6]],[[7,8,9],[10,11,12]]], [2,2,3]), undefined);
      assert.equal(array.validate([[[1,2],[3,4],[5,6]],[[7,8],[9,10],[11,12]]], [2,3,2]), undefined);
      assert.equal(array.validate([[[1,2],[3,4]],[[5,6],[7,8]],[[9,10],[11,12]]], [3,2,2]), undefined);

      // valid matrix with wrong size
      assert.throws(function () {array.validate([[[1,2],[3,4]],[[5,6],[7,8]]], [2,2,3])}, /Dimension mismatch/);
      assert.throws(function () {array.validate([[[1,2],[3,4]],[[5,6],[7,8]]], [2,2])}, /Dimension mismatch/);
      assert.throws(function () {array.validate([[[1,2],[3,4]],[[5,6],[7,8]]], [2,2,2,2])}, /Dimension mismatch/);
      assert.throws(function () {array.validate([[[1,2],[3,4]],[[5,6],[7,8]]], [3,2,2])}, /Dimension mismatch/);
      assert.throws(function () {array.validate([[[1,2],[3,4]],[[5,6],[7,8]]], [2,3,2])}, /Dimension mismatch/);

      // invalid matrix
      assert.throws(function () {array.validate([[[1,2],[3,4]],[[5,6],[7,8,9]]], [2,2,2])}, /Dimension mismatch/);
      assert.throws(function () {array.validate([[[1,2],[3,4]],[[5,6,6.5],[7,8]]], [2,2,2])}, /Dimension mismatch/);
      assert.throws(function () {array.validate([[[1,2],[3,4]],[[5,6],7]], [2,2,2])}, /Dimension mismatch/);
      assert.throws(function () {array.validate([[[1,2],[3,4]],[6,[7,8]]], [2,2,2])}, /Dimension mismatch/);
    });

    it('should validate whether a variable contains a scalar', function () {
      assert.equal(array.validate(2.3, []), undefined);
      assert.equal(array.validate(new Date(), []), undefined);
      assert.equal(array.validate({}, []), undefined);

      assert.throws(function () {array.validate([], [])}, /Dimension mismatch/);
      assert.throws(function () {array.validate([1,2,3], [])}, /Dimension mismatch/);
      assert.throws(function () {array.validate([[1,2],[3,4]], [])}, /Dimension mismatch/);
    });

  });

  describe('flatten', function () {

    it('should flatten a scalar', function () {
      assert.deepEqual(array.flatten(1), 1);
    });

    it('should flatten a 1 dimensional array', function () {
      assert.deepEqual(array.flatten([1,2,3]), [1,2,3]);
    });

    it('should flatten a 2 dimensional array', function () {
      assert.deepEqual(array.flatten([[1,2],[3,4]]), [1,2,3,4]);
    });

    it('should flatten a 3 dimensional array', function () {
      assert.deepEqual(array.flatten([[[1,2],[3,4]],[[5,6],[7,8]]]), [1,2,3,4,5,6,7,8]);
    });

    it('should return a new array', function () {
      var input = [3,2,1];
      var flat = array.flatten(input);
      flat.sort();
      assert.deepEqual(input, [3,2,1]);
    });

  });
  
  describe('identify', function () {

    it('should append a unique identifier to every element of the array', function () {
      assert.deepEqual(array.identify([]), []);
      assert.deepEqual(array.identify([1, 1, 2]), [{value: 1, identifier: 0}, {value: 1, identifier: 1}, {value: 2, identifier: 0}]);
    });

  });
  
  describe('generalize', function () {

    it('should remove the unique identifier from every element of the array', function () {
      assert.deepEqual(array.generalize([]), []);
      assert.deepEqual(array.generalize([{value: 1, identifier: 0}, {value: 1, identifier: 1}, {value: 2, identifier: 0}]), [1, 1, 2]);
    });

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
