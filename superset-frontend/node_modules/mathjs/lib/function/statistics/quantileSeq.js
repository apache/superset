'use strict';

var isInteger = require('../../utils/number').isInteger;
var isNumber = require('../../utils/number').isNumber;
var flatten = require('../../utils/array').flatten;
var isCollection = require('../../utils/collection/isCollection');

function factory (type, config, load, typed) {
  var add = load(require('../arithmetic/add'));
  var multiply = load(require('../arithmetic/multiply'));
  var partitionSelect = load(require('../matrix/partitionSelect'));
  var compare = load(require('../relational/compare'));

  /**
   * Compute the prob order quantile of a matrix or a list with values.
   * The sequence is sorted and the middle value is returned.
   * Supported types of sequence values are: Number, BigNumber, Unit
   * Supported types of probability are: Number, BigNumber
   *
   * In case of a (multi dimensional) array or matrix, the prob order quantile
   * of all elements will be calculated.
   *
   * Syntax:
   *
   *     math.quantileSeq(A, prob[, sorted])
   *     math.quantileSeq(A, [prob1, prob2, ...][, sorted])
   *     math.quantileSeq(A, N[, sorted])
   *
   * Examples:
   *
   *     math.quantileSeq([3, -1, 5, 7], 0.5);         // returns 4
   *     math.quantileSeq([3, -1, 5, 7], [1/3, 2/3]);  // returns [3, 5]
   *     math.quantileSeq([3, -1, 5, 7], 2);           // returns [3, 5]
   *     math.quantileSeq([-1, 3, 5, 7], 0.5, true);   // returns 4
   *
   * See also:
   *
   *     median, mean, min, max, sum, prod, std, var
   *
   * @param {Array, Matrix} data                A single matrix or Array
   * @param {Number, BigNumber, Array} probOrN  prob is the order of the quantile, while N is
   *                                            the amount of evenly distributed steps of
   *                                            probabilities; only one of these options can
   *                                            be provided
   * @param {Boolean} sorted=false              is data sorted in ascending order
   * @return {Number, BigNumber, Unit, Array}   Quantile(s)
   */
  function quantileSeq(data, probOrN, sorted) {
    var probArr, dataArr, one;

    if (arguments.length < 2 || arguments.length > 3) {
      throw new SyntaxError('Function quantileSeq requires two or three parameters');
    }

    if (isCollection(data)) {
      sorted = sorted || false;
      if (typeof sorted === 'boolean') {
        dataArr = data.valueOf();
        if (isNumber(probOrN)) {
          if (probOrN < 0) {
            throw new Error('N/prob must be non-negative');
          }

          if (probOrN <= 1) {
            // quantileSeq([a, b, c, d, ...], prob[,sorted])
            return _quantileSeq(dataArr, probOrN, sorted);
          }

          if (probOrN > 1) {
            // quantileSeq([a, b, c, d, ...], N[,sorted])
            if (!isInteger(probOrN)) {
              throw new Error('N must be a positive integer');
            }

            var nPlusOne = probOrN + 1;
            probArr = new Array(probOrN);
            for (var i = 0; i < probOrN;) {
              probArr[i] = _quantileSeq(dataArr, (++i) / nPlusOne, sorted);
            }
            return probArr;
          }
        }

        if (type.isBigNumber(probOrN)) {
          if (probOrN.isNegative()) {
            throw new Error('N/prob must be non-negative');
          }

          one = new probOrN.constructor(1);

          if (probOrN.lte(one)) {
            // quantileSeq([a, b, c, d, ...], prob[,sorted])
            return _quantileSeq(dataArr, probOrN, sorted);
          }

          if (probOrN.gt(one)) {
            // quantileSeq([a, b, c, d, ...], N[,sorted])
            if (!probOrN.isInteger()) {
              throw new Error('N must be a positive integer');
            }

            // largest possible Array length is 2^32-1;
            // 2^32 < 10^15, thus safe conversion guaranteed
            var intN = probOrN.toNumber();
            if (intN > 4294967295) {
              throw new Error('N must be less than or equal to 2^32-1, as that is the maximum length of an Array');
            }

            var nPlusOne = new type.BigNumber(intN + 1);
            probArr = new Array(intN);
            for (var i = 0; i < intN;) {
              probArr[i] = _quantileSeq(dataArr, new type.BigNumber(++i).div(nPlusOne), sorted);
            }
            return probArr;
          }
        }

        if (Array.isArray(probOrN)) {
          // quantileSeq([a, b, c, d, ...], [prob1, prob2, ...][,sorted])
          probArr = new Array(probOrN.length);
          for (var i = 0; i < probArr.length; ++i) {
            var currProb = probOrN[i];
            if (isNumber(currProb)) {
              if (currProb < 0 || currProb > 1) {
                throw new Error('Probability must be between 0 and 1, inclusive');
              }
            } else if (type.isBigNumber(currProb)) {
              one = new currProb.constructor(1);
              if (currProb.isNegative() || currProb.gt(one)) {
                throw new Error('Probability must be between 0 and 1, inclusive');
              }
            } else {
              throw new TypeError('Unexpected type of argument in function quantileSeq'); // FIXME: becomes redundant when converted to typed-function
            }

            probArr[i] = _quantileSeq(dataArr, currProb, sorted);
          }
          return probArr;
        }

        throw new TypeError('Unexpected type of argument in function quantileSeq'); // FIXME: becomes redundant when converted to typed-function
      }

      throw new TypeError('Unexpected type of argument in function quantileSeq'); // FIXME: becomes redundant when converted to typed-function
    }

    throw new TypeError('Unexpected type of argument in function quantileSeq'); // FIXME: becomes redundant when converted to typed-function
  }

  /**
   * Calculate the prob order quantile of an n-dimensional array.
   * 
   * @param {Array} array
   * @param {Number, BigNumber} prob
   * @param {Boolean} sorted
   * @return {Number, BigNumber, Unit} prob order quantile
   * @private
   */
  function _quantileSeq(array, prob, sorted) {
    var flat = flatten(array);
    var len = flat.length;
    if (len === 0) {
      throw new Error('Cannot calculate quantile of an empty sequence');
    }

    if (isNumber(prob)) {
      var index = prob * (len-1);
      var fracPart = index % 1;
      if (fracPart === 0) {
        var value = sorted ? flat[index] : partitionSelect(flat, index);

        validate(value);

        return value;
      }

      var integerPart = Math.floor(index);

      var left, right;
      if (sorted) {
        left = flat[integerPart];
        right = flat[integerPart+1];
      } else {
        right = partitionSelect(flat, integerPart+1);

        // max of partition is kth largest
        left = flat[integerPart];
        for (var i = 0; i < integerPart; ++i) {
          if (compare(flat[i], left) > 0) {
            left = flat[i];
          }
        }
      }

      validate(left);
      validate(right);

      // Q(prob) = (1-f)*A[floor(index)] + f*A[floor(index)+1]
      return add(multiply(left, 1 - fracPart), multiply(right, fracPart));
    }

    // If prob is a BigNumber
    var index = prob.times(len-1);
    if (index.isInteger()) {
      index = index.toNumber();
      var value = sorted ? flat[index] : partitionSelect(flat, index);

      validate(value);

      return value;
    }

    var integerPart = index.floor();
    var fracPart = index.minus(integerPart);
    var integerPartNumber = integerPart.toNumber();

    var left, right;
    if (sorted) {
      left = flat[integerPartNumber];
      right = flat[integerPartNumber+1];
    } else {
      right = partitionSelect(flat, integerPartNumber+1);

      // max of partition is kth largest
      left = flat[integerPartNumber];
      for (var i = 0; i < integerPartNumber; ++i) {
        if (compare(flat[i], left) > 0) {
          left = flat[i];
        }
      }
    }

    validate(left);
    validate(right);

    // Q(prob) = (1-f)*A[floor(index)] + f*A[floor(index)+1]
    var one = new fracPart.constructor(1);
    return add(multiply(left, one.minus(fracPart)), multiply(right, fracPart));
  }

  /**
   * Check if array value types are valid, throw error otherwise.
   * @param {number | BigNumber | Unit} x
   * @param {number | BigNumber | Unit} x
   * @private
   */
  var validate = typed({
    'number | BigNumber | Unit': function (x) {
      return x;
    }
  });

  return quantileSeq;
}

exports.name = 'quantileSeq';
exports.factory = factory;
