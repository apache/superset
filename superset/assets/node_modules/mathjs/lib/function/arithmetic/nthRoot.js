'use strict';

function factory (type, config, load, typed) {

  var matrix = load(require('../../type/matrix/function/matrix'));

  var algorithm01 = load(require('../../type/matrix/utils/algorithm01'));
  var algorithm02 = load(require('../../type/matrix/utils/algorithm02'));
  var algorithm06 = load(require('../../type/matrix/utils/algorithm06'));
  var algorithm11 = load(require('../../type/matrix/utils/algorithm11'));
  var algorithm13 = load(require('../../type/matrix/utils/algorithm13'));
  var algorithm14 = load(require('../../type/matrix/utils/algorithm14'));

  /**
   * Calculate the nth root of a value.
   * The principal nth root of a positive real number A, is the positive real
   * solution of the equation
   *
   *     x^root = A
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *     math.nthRoot(a)
   *     math.nthRoot(a, root)
   *
   * Examples:
   *
   *     math.nthRoot(9, 2);    // returns 3, as 3^2 == 9
   *     math.sqrt(9);          // returns 3, as 3^2 == 9
   *     math.nthRoot(64, 3);   // returns 4, as 4^3 == 64
   *
   * See also:
   *
   *     sqrt, pow
   *
   * @param {number | BigNumber | Array | Matrix | Complex} a
   *              Value for which to calculate the nth root
   * @param {number | BigNumber} [root=2]    The root.
   * @return {number | Complex | Array | Matrix} Returns the nth root of `a`
   */
  var nthRoot = typed('nthRoot', {
    
    'number': function (x) {
      return _nthRoot(x, 2);
    },
    'number, number': _nthRoot,

    'BigNumber': function (x) {
      return _bigNthRoot(x, new type.BigNumber(2));
    },
    'Complex' : function(x) {
      return _nthComplexRoot(x, 2);
    }, 
    'Complex, number' : _nthComplexRoot,
    'BigNumber, BigNumber': _bigNthRoot,

    'Array | Matrix': function (x) {
      return nthRoot(x, 2);
    },
    
    'Matrix, Matrix': function (x, y) {
      // result
      var c;

      // process matrix storage
      switch (x.storage()) {
        case 'sparse':
          switch (y.storage()) {
            case 'sparse':
              // density must be one (no zeros in matrix)
              if (y.density() === 1) {
                // sparse + sparse
                c = algorithm06(x, y, nthRoot);
              }
              else {
                // throw exception
                throw new Error('Root must be non-zero');
              }
              break;
            default:
              // sparse + dense
              c = algorithm02(y, x, nthRoot, true);
              break;
          }
          break;
        default:
          switch (y.storage()) {
            case 'sparse':
              // density must be one (no zeros in matrix)
              if (y.density() === 1) {
                // dense + sparse
                c = algorithm01(x, y, nthRoot, false);
              }
              else {
                // throw exception
                throw new Error('Root must be non-zero');
              }
              break;
            default:
              // dense + dense
              c = algorithm13(x, y, nthRoot);
              break;
          }
          break;
      }
      return c;
    },

    'Array, Array': function (x, y) {
      // use matrix implementation
      return nthRoot(matrix(x), matrix(y)).valueOf();
    },

    'Array, Matrix': function (x, y) {
      // use matrix implementation
      return nthRoot(matrix(x), y);
    },

    'Matrix, Array': function (x, y) {
      // use matrix implementation
      return nthRoot(x, matrix(y));
    },
    
    'Matrix, number | BigNumber': function (x, y) {
      // result
      var c;
      // check storage format
      switch (x.storage()) {
        case 'sparse':
          c = algorithm11(x, y, nthRoot, false);
          break;
        default:
          c = algorithm14(x, y, nthRoot, false);
          break;
      }
      return c;
    },

    'number | BigNumber, Matrix': function (x, y) {
      // result
      var c;
      // check storage format
      switch (y.storage()) {
        case 'sparse':
          // density must be one (no zeros in matrix)
          if (y.density() === 1) {
            // sparse - scalar
            c = algorithm11(y, x, nthRoot, true);
          }
          else {
            // throw exception
            throw new Error('Root must be non-zero');
          }
          break;
        default:
          c = algorithm14(y, x, nthRoot, true);
          break;
      }
      return c;
    },

    'Array, number | BigNumber': function (x, y) {
      // use matrix implementation
      return nthRoot(matrix(x), y).valueOf();
    },

    'number | BigNumber, Array': function (x, y) {
      // use matrix implementation
      return nthRoot(x, matrix(y)).valueOf();
    }
  });

  nthRoot.toTex = {2: '\\sqrt[${args[1]}]{${args[0]}}'};

  return nthRoot;

  /**
   * Calculate the nth root of a for BigNumbers, solve x^root == a
   * http://rosettacode.org/wiki/Nth_root#JavaScript
   * @param {BigNumber} a
   * @param {BigNumber} root
   * @private
   */
  function _bigNthRoot(a, root) {
    var precision = type.BigNumber.precision;
    var Big = type.BigNumber.clone({precision: precision + 2});
    var zero = new type.BigNumber(0);

    var one = new Big(1);
    var inv = root.isNegative();
    if (inv) {
      root = root.neg();
    }

    if (root.isZero()) {
      throw new Error('Root must be non-zero');
    }
    if (a.isNegative() && !root.abs().mod(2).equals(1)) {
      throw new Error('Root must be odd when a is negative.');
    }

    // edge cases zero and infinity
    if (a.isZero()) {
      return inv ? new Big(Infinity) : 0;
    }
    if (!a.isFinite()) {
      return inv ? zero : a;
    }

    var x = a.abs().pow(one.div(root));
    // If a < 0, we require that root is an odd integer,
    // so (-1) ^ (1/root) = -1
    x = a.isNeg() ? x.neg() : x;
    return new type.BigNumber((inv ? one.div(x) : x).toPrecision(precision));
  }
}

/**
 * Calculate the nth root of a, solve x^root == a
 * http://rosettacode.org/wiki/Nth_root#JavaScript
 * @param {number} a
 * @param {number} root
 * @private
 */
function _nthRoot(a, root) {
  var inv = root < 0;
  if (inv) {
    root = -root;
  }

  if (root === 0) {
    throw new Error('Root must be non-zero');
  }
  if (a < 0 && (Math.abs(root) % 2 != 1)) {
    throw new Error('Root must be odd when a is negative.');
  }

  // edge cases zero and infinity
  if (a == 0) {
    return inv ? Infinity : 0;
  }
  if (!isFinite(a)) {
    return inv ? 0 : a;
  }

  var x = Math.pow(Math.abs(a), 1/root);
  // If a < 0, we require that root is an odd integer,
  // so (-1) ^ (1/root) = -1
  x = a < 0 ? -x : x;
  return inv ? 1 / x : x;

  // Very nice algorithm, but fails with nthRoot(-2, 3).
  // Newton's method has some well-known problems at times:
  // https://en.wikipedia.org/wiki/Newton%27s_method#Failure_analysis
  /*
  var x = 1; // Initial guess
  var xPrev = 1;
  var i = 0;
  var iMax = 10000;
  do {
    var delta = (a / Math.pow(x, root - 1) - x) / root;
    xPrev = x;
    x = x + delta;
    i++;
  }
  while (xPrev !== x && i < iMax);

  if (xPrev !== x) {
    throw new Error('Function nthRoot failed to converge');
  }

  return inv ? 1 / x : x;
  */
}

/**
 * Calculate the nth root of a Complex Number a using De Moviers Theorem.
 * @param  {Complex} a
 * @param  {number} root
 * @return {Array} array or n Complex Roots in Polar Form.
 */
function _nthComplexRoot(a, root) {
  if (root < 0) throw new Error('Root must be greater than zero');
  if (root === 0) throw new Error('Root must be non-zero');
  if (root % 1 !== 0) throw new Error('Root must be an integer');  
  var arg = a.arg();
  var abs = a.abs();
  var roots = [];
  var r = Math.pow(abs, 1/root);
  for(var k = 0; k < root; k++) {
    roots.push({r: r, phi: (arg + 2 * Math.PI * k)/root});
  }
  return roots;
}

exports.name = 'nthRoot';
exports.factory = factory;
