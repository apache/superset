'use strict';

var naturalSort = require('javascript-natural-sort');

function factory (type, config, load, typed) {
  var getTypeOf = load(require('../utils/typeof'));
  var matrix = load(require('../../type/matrix/function/matrix'));
  var compare = load(require('./compare'));

  var compareBooleans = compare.signatures['boolean,boolean']

  /**
   * Compare two values of any type in a deterministic, natural way.
   *
   * For numeric values, the function works the same as `math.compare`.
   * For types of values that can't be compared mathematically,
   * the function compares in a natural way.
   *
   * For numeric values, x and y are considered equal when the relative
   * difference between x and y is smaller than the configured epsilon.
   * The function cannot be used to compare values smaller than
   * approximately 2.22e-16.
   *
   * For Complex numbers, first the real parts are compared. If equal,
   * the imaginary parts are compared.
   *
   * Arrays and Matrices are compared value by value until there is an
   * unequal pair of values encountered. Objects are compared by sorted
   * keys until the keys or their values are unequal.
   *
   * Syntax:
   *
   *    math.compareNatural(x, y)
   *
   * Examples:
   *
   *    math.compareNatural(6, 1);              // returns 1
   *    math.compareNatural(2, 3);              // returns -1
   *    math.compareNatural(7, 7);              // returns 0
   *
   *    math.compareNatural('10', '2');         // returns 1
   *
   *    var a = math.unit('5 cm');
   *    var b = math.unit('40 mm');
   *    math.compareNatural(a, b);              // returns 1
   *
   *    var c = math.complex('2 + 3i');
   *    var d = math.complex('2 + 4i');
   *    math.compareNatural(c, d);              // returns -1
   *
   *    math.compareNatural([1, 2, 4], [1, 2, 3]); // returns 1
   *    math.compareNatural([1, 2, 3], [1, 2]);    // returns 1
   *    math.compareNatural([1, 5], [1, 2, 3]);    // returns 1
   *    math.compareNatural([1, 2], [1, 2]);       // returns 0
   *
   *    math.compareNatural({a: 2}, {a: 4});       // returns -1
   *
   * See also:
   *
   *    equal, unequal, smaller, smallerEq, larger, largerEq, compare
   *
   * @param  {*} x First value to compare
   * @param  {*} y Second value to compare
   * @return {number} Returns the result of the comparison: 1, 0 or -1.
   */
  var compareNatural = typed('compareNatural', {
    'any, any': function (x, y) {
      var typeX = getTypeOf(x);
      var typeY = getTypeOf(y);
      var c;

      // numeric types
      if ((typeX === 'number' || typeX === 'BigNumber' || typeX === 'Fraction') &&
          (typeY === 'number' || typeY === 'BigNumber' || typeY === 'Fraction')) {
        c = compare(x, y);
        if (c.toString() !== '0') {
          // c can be number, BigNumber, or Fraction
          return c > 0 ? 1 : -1; // return a number
        }
        else {
          return naturalSort(typeX, typeY);
        }
      }

      // matrix types
      if (typeX === 'Array' || typeX === 'Matrix' ||
          typeY === 'Array' || typeY === 'Matrix') {
        c = compareMatricesAndArrays (x, y);
        if (c !== 0) {
          return c;
        }
        else {
          return naturalSort(typeX, typeY);
        }
      }

      // in case of different types, order by name of type, i.e. 'BigNumber' < 'Complex'
      if (typeX !== typeY) {
        return naturalSort(typeX, typeY);
      }

      if (typeX === 'Complex') {
        return compareComplexNumbers(x, y);
      }

      if (typeX === 'Unit') {
        if (x.equalBase(y)) {
          return compareNatural(x.value, y.value);
        }

        // compare by units
        return compareArrays(x.formatUnits(), y.formatUnits());
      }

      if (typeX === 'boolean') {
        return compareBooleans(x, y);
      }

      if (typeX === 'string') {
        return naturalSort(x, y);
      }

      if (typeX === 'Object') {
        return compareObjects(x, y);
      }

      if (typeX === 'null') {
        return 0;
      }

      if (typeX === 'undefined') {
        return 0;
      }

      // this should not occur...
      throw new TypeError('Unsupported type of value "' + typeX + '"');
    }
  });

  compareNatural.toTex = undefined; // use default template

  /**
   * Compare mixed matrix/array types, by converting to same-shaped array.
   * This comparator is non-deterministic regarding input types.
   * @param {Array | SparseMatrix | DenseMatrix | *} x
   * @param {Array | SparseMatrix | DenseMatrix | *} y
   * @returns {number} Returns the comparison result: -1, 0, or 1
   */
  function compareMatricesAndArrays (x, y) {
    if (type.isSparseMatrix(x) && type.isSparseMatrix(y)) {
      return compareArrays(x.toJSON().values, y.toJSON().values);
    }
    if (type.isSparseMatrix(x)) {
      // note: convert to array is expensive
      return compareMatricesAndArrays(x.toArray(), y);
    }
    if (type.isSparseMatrix(y)) {
      // note: convert to array is expensive
      return compareMatricesAndArrays(x, y.toArray());
    }

    // convert DenseArray into Array
    if (type.isDenseMatrix(x)) {
      return compareMatricesAndArrays(x.toJSON().data, y);
    }
    if (type.isDenseMatrix(y)) {
      return compareMatricesAndArrays(x, y.toJSON().data);
    }

    // convert scalars to array
    if (!Array.isArray(x)) {
      return compareMatricesAndArrays([x], y);
    }
    if (!Array.isArray(y)) {
      return compareMatricesAndArrays(x, [y]);
    }

    return compareArrays(x, y);
  }

  /**
   * Compare two Arrays
   *
   * - First, compares value by value
   * - Next, if all corresponding values are equal,
   *   look at the length: longest array will be considered largest
   *
   * @param {Array} x
   * @param {Array} y
   * @returns {number} Returns the comparison result: -1, 0, or 1
   */
  function compareArrays (x, y) {
    // compare each value
    for (var i = 0, ii = Math.min(x.length, y.length); i < ii; i++) {
      var v = compareNatural(x[i], y[i]);
      if (v !== 0) {
        return v;
      }
    }

    // compare the size of the arrays
    if (x.length > y.length) { return 1; }
    if (x.length < y.length) { return -1; }

    // both Arrays have equal size and content
    return 0;
  }

  /**
   * Compare two objects
   *
   * - First, compare sorted property names
   * - Next, compare the property values
   *
   * @param {Object} x
   * @param {Object} y
   * @returns {number} Returns the comparison result: -1, 0, or 1
   */
  function compareObjects (x, y) {
    var keysX = Object.keys(x);
    var keysY = Object.keys(y);

    // compare keys
    keysX.sort(naturalSort)
    keysY.sort(naturalSort)
    var c = compareArrays(keysX, keysY);
    if (c !== 0) {
      return c;
    }

    // compare values
    for (var i = 0; i < keysX.length; i++) {
      var v = compareNatural(x[keysX[i]], y[keysY[i]]);
      if (v !== 0) {
        return v;
      }
    }

    return 0;
  }

  return compareNatural;
}

/**
 * Compare two complex numbers, `x` and `y`:
 *
 * - First, compare the real values of `x` and `y`
 * - If equal, compare the imaginary values of `x` and `y`
 * 
 * @params {Complex} x
 * @params {Complex} y
 * @returns {number} Returns the comparison result: -1, 0, or 1
 */
function compareComplexNumbers (x, y) {
  if (x.re > y.re) { return 1; }
  if (x.re < y.re) { return -1; }

  if (x.im > y.im) { return 1; }
  if (x.im < y.im) { return -1; }

  return 0;
}

exports.name = 'compareNatural';
exports.factory = factory;
