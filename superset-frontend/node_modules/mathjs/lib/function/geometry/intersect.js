'use strict';

function factory (type, config, load, typed) {

  var abs = load(require('../arithmetic/abs'));
  var add = load(require('../arithmetic/add'));
  var addScalar = load(require('../arithmetic/addScalar'));
  var matrix = load(require('../../type/matrix/function/matrix'));
  var multiply = load(require('../arithmetic/multiply'));
  var multiplyScalar = load(require('../arithmetic/multiplyScalar'));
  var divideScalar = load(require('../arithmetic/divideScalar'));
  var subtract = load(require('../arithmetic/subtract'));
  var smaller = load(require('../relational/smaller'));
  var equalScalar = load(require('../relational/equalScalar'));

  /**
   * Calculates the point of intersection of two lines in two or three dimensions
   * and of a line and a plane in three dimensions. The inputs are in the form of
   * arrays or 1 dimensional matrices. The line intersection functions return null
   * if the lines do not meet.
   *
   * Note: Fill the plane coefficients as `x + y + z = c` and not as `x + y + z + c = 0`.
   *
   * Syntax:
   *
   *    math.intersect(endPoint1Line1, endPoint2Line1, endPoint1Line2, endPoint2Line2)
   *    math.intersect(endPoint1, endPoint2, planeCoefficients)
   *
   * Examples:
   *
   *    math.intersect([0, 0], [10, 10], [10, 0], [0, 10]);              // Returns [5, 5]
   *    math.intersect([0, 0, 0], [10, 10, 0], [10, 0, 0], [0, 10, 0]);  // Returns [5, 5, 0]
   *    math.intersect([1, 0, 1],  [4, -2, 2], [1, 1, 1, 6]);            // Returns [7, -4, 3]
   *
   * @param  {Array | Matrix} w   Co-ordinates of first end-point of first line
   * @param  {Array | Matrix} x   Co-ordinates of second end-point of first line
   * @param  {Array | Matrix} y   Co-ordinates of first end-point of second line
   *                              OR Co-efficients of the plane's equation
   * @param  {Array | Matrix} z   Co-ordinates of second end-point of second line
   *                              OR null if the calculation is for line and plane
   * @return {Array}              Returns the point of intersection of lines/lines-planes
   */
  var intersect = typed('intersect', {
    'Array, Array, Array': function (x, y, plane) {
      if (!_3d(x)) { throw new TypeError('Array with 3 numbers or BigNumbers expected for first argument'); }
      if (!_3d(y)) { throw new TypeError('Array with 3 numbers or BigNumbers expected for second argument'); }
      if (!_4d(plane)) { throw new TypeError('Array with 4 numbers expected as third argument'); }

      return _intersectLinePlane(x[0], x[1], x[2], y[0], y[1], y[2], plane[0], plane[1], plane[2], plane[3]);
    },

    'Array, Array, Array, Array': function (w, x, y, z) {
      if (w.length === 2) {
        if (!_2d(w)) { throw new TypeError('Array with 2 numbers or BigNumbers expected for first argument'); }
        if (!_2d(x)) { throw new TypeError('Array with 2 numbers or BigNumbers expected for second argument'); }
        if (!_2d(y)) { throw new TypeError('Array with 2 numbers or BigNumbers expected for third argument'); }
        if (!_2d(z)) { throw new TypeError('Array with 2 numbers or BigNumbers expected for fourth argument'); }

        return _intersect2d(w, x, y, z);
      }
      else if (w.length === 3) {
        if (!_3d(w)) { throw new TypeError('Array with 3 numbers or BigNumbers expected for first argument'); }
        if (!_3d(x)) { throw new TypeError('Array with 3 numbers or BigNumbers expected for second argument'); }
        if (!_3d(y)) { throw new TypeError('Array with 3 numbers or BigNumbers expected for third argument'); }
        if (!_3d(z)) { throw new TypeError('Array with 3 numbers or BigNumbers expected for fourth argument'); }

        return _intersect3d(w[0], w[1], w[2], x[0], x[1], x[2], y[0], y[1], y[2], z[0], z[1], z[2]);
      }
      else {
        throw new TypeError('Arrays with two or thee dimensional points expected');
      }
    },

    'Matrix, Matrix, Matrix': function (x, y, plane) {
      return matrix(intersect(x.valueOf(), y.valueOf(), plane.valueOf()));
    },

    'Matrix, Matrix, Matrix, Matrix': function (w, x, y, z) {
      // TODO: output matrix type should match input matrix type
      return matrix(intersect(w.valueOf(), x.valueOf(), y.valueOf(), z.valueOf()));
    }
  });

  function _isNumber(a) {
    // intersect supports numbers and bignumbers
    return (typeof a === 'number' || type.isBigNumber(a));
  }

  function _2d(x) {
    return x.length === 2 && _isNumber(x[0]) && _isNumber(x[1]);
  }

  function _3d(x) {
    return x.length === 3 && _isNumber(x[0]) && _isNumber(x[1]) && _isNumber(x[2]);
  }

  function _4d(x) {
    return x.length === 4 && _isNumber(x[0]) && _isNumber(x[1]) && _isNumber(x[2]) && _isNumber(x[3]);
  }

  function _intersect2d(p1a, p1b, p2a, p2b){
    var o1 = p1a;
    var o2 = p2a;
    var d1 = subtract(o1, p1b);
    var d2 = subtract(o2, p2b);
    var det = subtract(multiplyScalar(d1[0], d2[1]), multiplyScalar(d2[0], d1[1]));
    if (smaller(abs(det), config.epsilon)) {
      return null;
    }
    var d20o11 = multiplyScalar(d2[0], o1[1]);
    var d21o10 = multiplyScalar(d2[1], o1[0]);
    var d20o21 = multiplyScalar(d2[0], o2[1]);
    var d21o20 = multiplyScalar(d2[1], o2[0]);
    var t = divideScalar(addScalar(subtract(subtract(d20o11, d21o10), d20o21), d21o20), det);
    return add(multiply(d1, t), o1);
  }

  function _intersect3dHelper(a, b, c, d, e, f, g, h, i, j, k, l){
      // (a - b)*(c - d) + (e - f)*(g - h) + (i - j)*(k - l)
      var add1 = multiplyScalar(subtract(a, b), subtract(c, d));
      var add2 = multiplyScalar(subtract(e, f), subtract(g, h));
      var add3 = multiplyScalar(subtract(i, j), subtract(k, l));
      return addScalar(addScalar(add1, add2), add3);
  }

  function _intersect3d(x1, y1, z1, x2, y2, z2, x3, y3, z3, x4, y4, z4){
    var d1343 = _intersect3dHelper(x1, x3, x4, x3, y1, y3, y4, y3, z1, z3, z4, z3);
    var d4321 = _intersect3dHelper(x4, x3, x2, x1, y4, y3, y2, y1, z4, z3, z2, z1);
    var d1321 = _intersect3dHelper(x1, x3, x2, x1, y1, y3, y2, y1, z1, z3, z2, z1);
    var d4343 = _intersect3dHelper(x4, x3, x4, x3, y4, y3, y4, y3, z4, z3, z4, z3);
    var d2121 = _intersect3dHelper(x2, x1, x2, x1, y2, y1, y2, y1, z2, z1, z2, z1);
    var ta = divideScalar(
      subtract(multiplyScalar(d1343, d4321), multiplyScalar(d1321, d4343)),
      subtract(multiplyScalar(d2121, d4343), multiplyScalar(d4321, d4321)));
    var tb = divideScalar(addScalar(d1343, multiplyScalar(ta, d4321)), d4343);

    var pax = addScalar(x1, multiplyScalar(ta, subtract(x2, x1)));
    var pay = addScalar(y1, multiplyScalar(ta, subtract(y2, y1)));
    var paz = addScalar(z1, multiplyScalar(ta, subtract(z2, z1)));
    var pbx = addScalar(x3, multiplyScalar(tb, subtract(x4, x3)));
    var pby = addScalar(y3, multiplyScalar(tb, subtract(y4, y3)));
    var pbz = addScalar(z3, multiplyScalar(tb, subtract(z4, z3)));
    if (equalScalar(pax, pbx) && equalScalar(pay, pby) && equalScalar(paz, pbz)){
      return [pax, pay, paz];
    }
    else{
      return null;
    }
  }

  function _intersectLinePlane(x1, y1, z1, x2, y2, z2, x, y, z, c){
    var x1x = multiplyScalar(x1, x);
    var x2x = multiplyScalar(x2, x);
    var y1y = multiplyScalar(y1, y);
    var y2y = multiplyScalar(y2, y);
    var z1z = multiplyScalar(z1, z);
    var z2z = multiplyScalar(z2, z);
    var t = divideScalar(
      subtract(subtract(subtract(c, x1x), y1y), z1z),
      subtract(subtract(subtract(addScalar(addScalar(x2x, y2y), z2z), x1x), y1y), z1z));
    var px = addScalar(x1, multiplyScalar(t, subtract(x2, x1)));
    var py = addScalar(y1, multiplyScalar(t, subtract(y2, y1)));
    var pz = addScalar(z1, multiplyScalar(t, subtract(z2, z1)));
    return [px, py, pz];
    // TODO: Add cases when line is parallel to the plane:
    //       (a) no intersection,
    //       (b) line contained in plane
  }

  return intersect;
}

exports.name = 'intersect';
exports.factory = factory;
