'use strict';

function factory (type, config, load, typed) {

  var matrix = load(require('../../../type/matrix/function/matrix'));
  var zeros = load(require('../../matrix/zeros'));
  var eye = load(require('../../matrix/eye'));
  var clone = load(require('../../utils/clone'));
  
  var isZero = load(require('../../utils/isZero'));
  var isPositive = load(require('../../utils/isPositive'));
  var unequal = load(require('../../relational/unequal'));
    
  var abs = load(require('../../arithmetic/abs'));
  var sign = load(require('../../arithmetic/sign'));
  var sqrt = load(require('../../arithmetic/sqrt'));
  var conj = load(require('../../complex/conj'));
  
  var unaryMinus = load(require('../../arithmetic/unaryMinus')); 
  var addScalar = load(require('../../arithmetic/addScalar'));  
  var divideScalar = load(require('../../arithmetic/divideScalar'));
  var multiplyScalar = load(require('../../arithmetic/multiplyScalar'));  
  var subtract = load(require('../../arithmetic/subtract'));
    
  
  /**
   * Calculate the Matrix QR decomposition. Matrix `A` is decomposed in 
   * two matrices (`Q`, `R`) where `Q` is an 
   * orthogonal matrix and `R` is an upper triangular matrix.
   *
   * Syntax:
   *
   *    math.qr(A);
   *
   * Example:
   *
   *    var m = [
   *      [1, -1,  4],
   *      [1,  4, -2],
   *      [1,  4,  2],
   *      [1,  -1, 0]
   *    ];
   *    var result = math.qr(m);
   *    // r = {
   *    //   Q: [
   *    //     [0.5, -0.5,   0.5],
   *    //     [0.5,  0.5,  -0.5],
   *    //     [0.5,  0.5,   0.5],
   *    //     [0.5, -0.5,  -0.5],
   *    //   ],
   *    //   R: [
   *    //     [2, 3,  2],
   *    //     [0, 5, -2],
   *    //     [0, 0,  4],
   *    //     [0, 0,  0]
   *    //   ]
   *    // }
   *
   * See also:
   *
   *    lu
   *
   * @param {Matrix | Array} A    A two dimensional matrix or array 
   * for which to get the QR decomposition.
   *
   * @return {{Q: Array | Matrix, R: Array | Matrix}} Q: the orthogonal
   * matrix and R: the upper triangular matrix
   */
  var qr = typed('qr', {

    'DenseMatrix': function (m) {
      return _denseQR(m);
    },
    
    'SparseMatrix': function (m) {
      return _sparseQR(m);
    },

    'Array': function (a) {
      // create dense matrix from array
      var m = matrix(a);
      // lup, use matrix implementation
      var r = _denseQR(m);
      // result
      return {
        Q: r.Q.valueOf(),
        R: r.R.valueOf()
      };
    }
  });

  var _denseQR = function (m) {
    
    // rows & columns (m x n)
    var rows = m._size[0]; // m
    var cols = m._size[1]; // n
            
    var Q = eye([rows], 'dense');
    var Qdata = Q._data;
    
    var R = m.clone();
    var Rdata = R._data;
    
    // vars
    var i, j, k;
        
    var w = zeros([rows], '');
    
    for (k = 0; k < Math.min(cols, rows); ++k) {
      
      /*
       * **k-th Household matrix**
       *
       * The matrix I - 2*v*transpose(v)
       * x     = first column of A
       * x1    = first element of x
       * alpha = x1 / |x1| * |x|
       * e1    = tranpose([1, 0, 0, ...])
       * u     = x - alpha * e1
       * v     = u / |u|
       *
       * Household matrix = I - 2 * v * tranpose(v)
       *
       *  * Initially Q = I and R = A.
       *  * Household matrix is a reflection in a plane normal to v which 
       *    will zero out all but the top right element in R.
       *  * Appplying reflection to both Q and R will not change product.
       *  * Repeat this process on the (1,1) minor to get R as an upper 
       *    triangular matrix.
       *  * Reflections leave the magnitude of the columns of Q unchanged 
       *    so Q remains othoganal.
       *
       */  
      
      var pivot = Rdata[k][k];          
      var sgn = unaryMinus(sign(pivot));
      var conjSgn = conj(sgn);
      
      var alphaSquared = 0;

      for(i = k; i < rows; i++) {
        alphaSquared = addScalar(alphaSquared, multiplyScalar(Rdata[i][k], conj(Rdata[i][k])));        
      }
      
      var alpha = multiplyScalar(sgn, sqrt(alphaSquared));
      
      
      if (!isZero(alpha)) {
          
        // first element in vector u
        var u1 = subtract(pivot, alpha);
        
        // w = v * u1 / |u|    (only elements k to (rows-1) are used)    
        w[k] = 1;
        
        for (i = k+1; i < rows; i++) {
          w[i] = divideScalar(Rdata[i][k], u1);
        }        
         
        // tau = - conj(u1 / alpha)
        var tau = unaryMinus(conj(divideScalar(u1, alpha)));
        
        var s;
        
        /*
         * tau and w have been choosen so that
         * 
         * 2 * v * tranpose(v) = tau * w * tranpose(w)
         */
         
        /*
         * -- calculate R = R - tau * w * tranpose(w) * R --
         * Only do calculation with rows k to (rows-1)
         * Additionally columns 0 to (k-1) will not be changed by this
         *   multiplication so do not bother recalculating them
         */
        for (j = k; j < cols; j++) {
          s = 0.0;
          
          // calculate jth element of [tranpose(w) * R]
          for (i = k; i < rows; i++) {
            s = addScalar(s, multiplyScalar(conj(w[i]), Rdata[i][j]));
          }
          
          // calculate the jth element of [tau * transpose(w) * R]
          s = multiplyScalar(s, tau);
          
          for (i = k; i < rows; i++) {
            Rdata[i][j] = multiplyScalar(
              subtract(Rdata[i][j], multiplyScalar(w[i], s)), 
              conjSgn
            );            
          }          
        }
        /*
         * -- calculate Q = Q - tau * Q * w * transpose(w) --
         * Q is a square matrix (rows x rows)
         * Only do calculation with columns k to (rows-1)
         * Additionally rows 0 to (k-1) will not be changed by this
         *   multiplication so do not bother recalculating them
         */
        for (i = 0; i < rows; i++) {
          s = 0.0;
          
          // calculate ith element of [Q * w]
          for (j = k; j < rows; j++) {
            s = addScalar(s, multiplyScalar(Qdata[i][j], w[j]));
          }
          
          // calculate the ith element of [tau * Q * w]
          s = multiplyScalar(s, tau);
          
          for (j = k; j < rows; ++j) {
            Qdata[i][j] = divideScalar(
              subtract(Qdata[i][j], multiplyScalar(s, conj(w[j]))), 
              conjSgn
            );
          }
          
        }
      }
      
    }
    
    // coerse almost zero elements to zero
    // TODO I feel uneasy just zeroing these values
    for (i = 0; i < rows; ++i) {
      for (j = 0; j < i && j < cols; ++j) {
        if (unequal(0, divideScalar(Rdata[i][j], 1e5))) {
          throw new Error('math.qr(): unknown error - ' + 
           'R is not lower triangular (element (' + 
            i + ', ' + j + ')  = ' + Rdata[i][j] + ')'
          );
        }
        Rdata[i][j] = multiplyScalar(Rdata[i][j], 0);
      }
    }
    
    // return matrices
    return { 
      Q: Q,
      R: R,
      toString: function () {
        return 'Q: ' + this.Q.toString() + '\nR: ' + this.R.toString();
      }
    };
  };
  
  var _sparseQR = function (m) {
    
    throw new Error('qr not implemented for sparse matrices yet');
  
  };
  
  return qr;
}

exports.name = 'qr';
exports.factory = factory;
