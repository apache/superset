var Complex = require('complex.js');
var format = require('../../utils/number').format;
var isNumber = require('../../utils/number').isNumber;

function factory (type, config, load, typed, math) {

  /**
   * Attach type information
   */
  Complex.prototype.type = 'Complex';
  Complex.prototype.isComplex = true;


  /**
   * Get a JSON representation of the complex number
   * @returns {Object} Returns a JSON object structured as:
   *                   `{"mathjs": "Complex", "re": 2, "im": 3}`
   */
  Complex.prototype.toJSON = function () {
    return {
      mathjs: 'Complex',
      re: this.re,
      im: this.im
    };
  };

  /*
   * Return the value of the complex number in polar notation
   * The angle phi will be set in the interval of [-pi, pi].
   * @return {{r: number, phi: number}} Returns and object with properties r and phi.
   */
  Complex.prototype.toPolar = function () {
    return {
      r: this.abs(),
      phi: this.arg()
    };
  };

  /**
   * Get a string representation of the complex number,
   * with optional formatting options.
   * @param {Object | number | Function} [options]  Formatting options. See
   *                                                lib/utils/number:format for a
   *                                                description of the available
   *                                                options.
   * @return {string} str
   */
  Complex.prototype.format = function (options) {
    var str = '';
    var im = this.im;
    var re = this.re;
    var strRe = format(this.re, options);
    var strIm = format(this.im, options);

    // round either re or im when smaller than the configured precision
    var precision = isNumber(options) ? options : options ? options.precision : null;
    if (precision !== null) {
      var epsilon = Math.pow(10, -precision);
      if (Math.abs(re / im) < epsilon) {
        re = 0;
      }
      if (Math.abs(im / re) < epsilon) {
        im = 0;
      }
    }

    if (im == 0) {
      // real value
      str = strRe;
    } else if (re == 0) {
      // purely complex value
      if (im == 1) {
        str = 'i';
      } else if (im == -1) {
        str = '-i';
      } else {
        str = strIm + 'i';
      }
    } else {
      // complex value
      if (im < 0) {
        if (im == -1) {
          str = strRe + ' - i';
        } else {
          str = strRe + ' - ' + strIm.substring(1) + 'i';
        }
      } else {
        if (im == 1) {
          str = strRe + ' + i';
        } else {
          str = strRe + ' + ' + strIm + 'i';
        }
      }
    }
    return str;
  };

  /**
   * Create a complex number from polar coordinates
   *
   * Usage:
   *
   *     Complex.fromPolar(r: number, phi: number) : Complex
   *     Complex.fromPolar({r: number, phi: number}) : Complex
   *
   * @param {*} args...
   * @return {Complex}
   */
  Complex.fromPolar = function (args) {
    switch (arguments.length) {
      case 1:
        var arg = arguments[0];
        if (typeof arg === 'object') {
          return Complex(arg);
        }
        throw new TypeError('Input has to be an object with r and phi keys.');

      case 2:
        var r = arguments[0],
            phi = arguments[1];
        if (isNumber(r)) {
          if (type.isUnit(phi) && phi.hasBase('ANGLE')) {
            // convert unit to a number in radians
            phi = phi.toNumber('rad');
          }

          if (isNumber(phi)) {
            return new Complex({r: r, phi: phi});
          }

          throw new TypeError('Phi is not a number nor an angle unit.');
        } else {
          throw new TypeError('Radius r is not a number.');
        }

      default:
        throw new SyntaxError('Wrong number of arguments in function fromPolar');
    }
  };


  Complex.prototype.valueOf = Complex.prototype.toString;

  /**
   * Create a Complex number from a JSON object
   * @param {Object} json  A JSON Object structured as
   *                       {"mathjs": "Complex", "re": 2, "im": 3}
   *                       All properties are optional, default values
   *                       for `re` and `im` are 0.
   * @return {Complex} Returns a new Complex number
   */
  Complex.fromJSON = function (json) {
    return new Complex(json);
  };

  // apply the current epsilon
  Complex.EPSILON = config.epsilon;

  // listen for changed in the configuration, automatically apply changed epsilon
  math.on('config', function (curr, prev) {
    if (curr.epsilon !== prev.epsilon) {
      Complex.EPSILON = curr.epsilon;
    }
  });

  /**
   * Compare two complex numbers, `a` and `b`:
   *
   * - Returns 1 when the real part of `a` is larger than the real part of `b`
   * - Returns -1 when the real part of `a` is smaller than the real part of `b`
   * - Returns 1 when the real parts are equal
   *   and the imaginary part of `a` is larger than the imaginary part of `b`
   * - Returns -1 when the real parts are equal
   *   and the imaginary part of `a` is smaller than the imaginary part of `b`
   * - Returns 0 when both real and imaginary parts are equal.
   *
   * @params {Complex} a
   * @params {Complex} b
   * @returns {number} Returns the comparison result: -1, 0, or 1
   */
  Complex.compare = function (a, b) {
    if (a.re > b.re) { return 1; }
    if (a.re < b.re) { return -1; }

    if (a.im > b.im) { return 1; }
    if (a.im < b.im) { return -1; }

    return 0;
  }

  return Complex;
}

exports.name = 'Complex';
exports.path = 'type';
exports.factory = factory;
exports.math = true; // request access to the math namespace
