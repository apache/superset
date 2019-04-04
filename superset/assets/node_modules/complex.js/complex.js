/**
 * @license Complex.js v2.0.3 11/02/2016
 *
 * Copyright (c) 2016, Robert Eisele (robert@xarg.org)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 **/

/**
 *
 * This class allows the manipulation of complex numbers.
 * You can pass a complex number in different formats. Either as object, double, string or two integer parameters.
 *
 * Object form
 * { re: <real>, im: <imaginary> }
 * { arg: <angle>, abs: <radius> }
 * { phi: <angle>, r: <radius> }
 *
 * Array / Vector form
 * [ real, imaginary ]
 *
 * Double form
 * 99.3 - Single double value
 *
 * String form
 * '23.1337' - Simple real number
 * '15+3i' - a simple complex number
 * '3-i' - a simple complex number
 *
 * Example:
 *
 * var c = new Complex('99.3+8i');
 * c.mul({r: 3, i: 9}).div(4.9).sub(3, 2);
 *
 */

(function(root) {

  'use strict';

  var P = {'re': 0, 'im': 0};

  var cosh = function(x) {
    return (Math.exp(x) + Math.exp(-x)) * 0.5;
  };

  var sinh = function(x) {
    return (Math.exp(x) - Math.exp(-x)) * 0.5;
  };

  var hypot = function(x, y) {

      var a = Math.abs(x);
      var b = Math.abs(y);

      if (a < 3000 && b < 3000) {
        return Math.sqrt(a * a + b * b);
      }

      if (a < b) {
        a = b;
        b = x / y;
      } else {
        b = y / x;
      }
      return a * Math.sqrt(1 + b * b);
  };

  var parser_exit = function() {
    throw SyntaxError('Invalid Param');
  };

  /**
   * Calculates log(sqrt(a^2+b^2)) in a way to avoid overflows
   *
   * @param {number} a
   * @param {number} b
   * @returns {number}
   */
  function logHypot(a, b) {

    var _a = Math.abs(a);
    var _b = Math.abs(b);

    if (a === 0) {
      return Math.log(_b);
    }

    if (b === 0) {
      return Math.log(_a);
    }

    if (_a < 3000 && _b < 3000) {
      return Math.log(a * a + b * b) * 0.5;
    }

    /* I got 4 ideas to compute this property without overflow:
     *
     * Testing 1000000 times with random samples for a,b ∈ [1, 1000000000] against a big decimal library to get an error estimate
     *
     * 1. Only eliminate the square root: (OVERALL ERROR: 3.9122483030951116e-11)

     Math.log(a * a + b * b) / 2

     *
     *
     * 2. Try to use the non-overflowing pythagoras: (OVERALL ERROR: 8.889760039210159e-10)

     var fn = function(a, b) {
     a = Math.abs(a);
     b = Math.abs(b);
     var t = Math.min(a, b);
     a = Math.max(a, b);
     t = t / a;

     return Math.log(a) + Math.log(1 + t * t) / 2;
     };

     * 3. Abuse the identity cos(atan(y/x) = x / sqrt(x^2+y^2): (OVERALL ERROR: 3.4780178737037204e-10)

     Math.log(a / Math.cos(Math.atan2(b, a)))

     * 4. Use 3. and apply log rules: (OVERALL ERROR: 1.2014087502620896e-9)

     Math.log(a) - Math.log(Math.cos(Math.atan2(b, a)))

     */

    return Math.log(a / Math.cos(Math.atan2(b, a)));
  }

  var parse = function(a, b) {

    if (a === undefined || a === null) {
      P['re'] =
      P['im'] = 0;
    } else if (b !== undefined) {
      P['re'] = a;
      P['im'] = b;
    } else switch (typeof a) {

      case 'object':

        if ('im' in a && 're' in a) {
          P['re'] = a['re'];
          P['im'] = a['im'];
        } else if ('abs' in a && 'arg' in a) {
          P['re'] = a['abs'] * Math.cos(a['arg']);
          P['im'] = a['abs'] * Math.sin(a['arg']);
        } else if ('r' in a && 'phi' in a) {
          P['re'] = a['r'] * Math.cos(a['phi']);
          P['im'] = a['r'] * Math.sin(a['phi']);
        } else if (a.length === 2) { // Quick array check
          P['re'] = a[0];
          P['im'] = a[1];
        } else {
          parser_exit();
        }
        break;

      case 'string':

        P['im'] = /* void */
        P['re'] = 0;

        var tokens = a.match(/\d+\.?\d*e[+-]?\d+|\d+\.?\d*|\.\d+|./g);
        var plus = 1;
        var minus = 0;

        if (tokens === null) {
          parser_exit();
        }

        for (var i = 0; i < tokens.length; i++) {

          var c = tokens[i];

          if (c === ' ' || c === '\t' || c === '\n') {
            /* void */
          } else if (c === '+') {
            plus++;
          } else if (c === '-') {
            minus++;
          } else if (c === 'i' || c === 'I') {

            if (plus + minus === 0) {
              parser_exit();
            }

            if (tokens[i + 1] !== ' ' && !isNaN(tokens[i + 1])) {
              P['im']+= parseFloat((minus % 2 ? '-' : '') + tokens[i + 1]);
              i++;
            } else {
              P['im']+= parseFloat((minus % 2 ? '-' : '') + '1');
            }
            plus = minus = 0;

          } else {

            if (plus + minus === 0 || isNaN(c)) {
              parser_exit();
            }

            if (tokens[i + 1] === 'i' || tokens[i + 1] === 'I') {
              P['im']+= parseFloat((minus % 2 ? '-' : '') + c);
              i++;
            } else {
              P['re']+= parseFloat((minus % 2 ? '-' : '') + c);
            }
            plus = minus = 0;
          }
        }

        // Still something on the stack
        if (plus + minus > 0) {
          parser_exit();
        }
        break;

      case 'number':
        P['im'] = 0;
        P['re'] = a;
        break;

      default:
        parser_exit();
    }

    if (isNaN(P['re']) || isNaN(P['im'])) {
      // If a calculation is NaN, we treat it as NaN and don't throw
      //parser_exit();
    }
  };

  /**
   * @constructor
   * @returns {Complex}
   */
  function Complex(a, b) {

    if (!(this instanceof Complex)) {
      return new Complex(a, b);
    }

    parse(a, b); // mutates P

    this['re'] = P['re'];
    this['im'] = P['im'];
  }

  Complex.prototype = {

    're': 0,
    'im': 0,

    /**
     * Calculates the sign of a complex number, which is a normalized complex
     *
     * @returns {Complex}
     */
    'sign': function() {

      var abs = this['abs']();

      return new Complex(
              this['re'] / abs,
              this['im'] / abs);
    },

    /**
     * Adds two complex numbers
     *
     * @returns {Complex}
     */
    'add': function(a, b) {

      parse(a, b); // mutates P

      return new Complex(
              this['re'] + P['re'],
              this['im'] + P['im']);
    },

    /**
     * Subtracts two complex numbers
     *
     * @returns {Complex}
     */
    'sub': function(a, b) {

      parse(a, b); // mutates P

      return new Complex(
              this['re'] - P['re'],
              this['im'] - P['im']);
    },

    /**
     * Multiplies two complex numbers
     *
     * @returns {Complex}
     */
    'mul': function(a, b) {

      parse(a, b); // mutates P

      // Besides the addition/subtraction, this helps having a solution for real Infinity
      if (P['im'] === 0 && this['im'] === 0) {
        return new Complex(this['re'] * P['re'], 0);
      }

      return new Complex(
              this['re'] * P['re'] - this['im'] * P['im'],
              this['re'] * P['im'] + this['im'] * P['re']);
    },

    /**
     * Divides two complex numbers
     *
     * @returns {Complex}
     */
    'div': function(a, b) {

      parse(a, b); // mutates P

      a = this['re'];
      b = this['im'];

      var c = P['re'];
      var d = P['im'];
      var t, x;

      if (0 === d) {
        if (0 === c) {
          // Divisor is zero
          return new Complex(
                (a !== 0) ? (a / 0) : 0,
                (b !== 0) ? (b / 0) : 0);
        } else {
          // Divisor is real
          return new Complex(a / c, b / c);
        }
      }

      if (Math.abs(c) < Math.abs(d)) {

        x = c / d;
        t = c * x + d;

        return new Complex(
                (a * x + b) / t,
                (b * x - a) / t);

      } else {

        x = d / c;
        t = d * x + c;

        return new Complex(
                (a + b * x) / t,
                (b - a * x) / t);
      }
    },

    /**
     * Calculate the power of two complex numbers
     *
     * @returns {Complex}
     */
    'pow': function(a, b) {

      parse(a, b); // mutates P

      a = this['re'];
      b = this['im'];

      if (a === 0 && b === 0) {
        return Complex['ZERO'];
      }

      // If the exponent is real
      if (P['im'] === 0) {

        if (b === 0 && a >= 0) {

          return new Complex(Math.pow(a, P['re']), 0);

        } else if (a === 0) { // If base is fully imaginary

          switch ((P['re'] % 4 + 4) % 4) {
            case 0:
              return new Complex(Math.pow(b, P['re']), 0);
            case 1:
              return new Complex(0, Math.pow(b, P['re']));
            case 2:
              return new Complex(-Math.pow(b, P['re']), 0);
            case 3:
              return new Complex(0, -Math.pow(b, P['re']));
          }
        }
      }

      /* I couldn't find a good formula, so here is a derivation and optimization
       *
       * z_1^z_2 = (a + bi)^(c + di)
       *         = exp((c + di) * log(a + bi)
       *         = pow(a^2 + b^2, (c + di) / 2) * exp(i(c + di)atan2(b, a))
       * =>...
       * Re = (pow(a^2 + b^2, c / 2) * exp(-d * atan2(b, a))) * cos(d * log(a^2 + b^2) / 2 + c * atan2(b, a))
       * Im = (pow(a^2 + b^2, c / 2) * exp(-d * atan2(b, a))) * sin(d * log(a^2 + b^2) / 2 + c * atan2(b, a))
       *
       * =>...
       * Re = exp(c * log(sqrt(a^2 + b^2)) - d * atan2(b, a)) * cos(d * log(sqrt(a^2 + b^2)) + c * atan2(b, a))
       * Im = exp(c * log(sqrt(a^2 + b^2)) - d * atan2(b, a)) * sin(d * log(sqrt(a^2 + b^2)) + c * atan2(b, a))
       *
       * =>
       * Re = exp(c * logsq2 - d * arg(z_1)) * cos(d * logsq2 + c * arg(z_1))
       * Im = exp(c * logsq2 - d * arg(z_1)) * sin(d * logsq2 + c * arg(z_1))
       *
       */

      var arg = Math.atan2(b, a);
      var loh = logHypot(a, b);

      a = Math.exp(P['re'] * loh - P['im'] * arg);
      b = P['im'] * loh + P['re'] * arg;
      return new Complex(
              a * Math.cos(b),
              a * Math.sin(b));
    },

    /**
     * Calculate the complex square root
     *
     * @returns {Complex}
     */
    'sqrt': function() {

      var a = this['re'];
      var b = this['im'];
      var r = this['abs']();

      var re, im;

      if (a >= 0) {

        if (b === 0) {
          return new Complex(Math.sqrt(a), 0);
        }

        re = 0.5 * Math.sqrt(2.0 * (r + a));
      } else {
        re = Math.abs(b) / Math.sqrt(2 * (r - a));
      }

      if (a <= 0) {
        im = 0.5 * Math.sqrt(2.0 * (r - a));
      } else {
        im = Math.abs(b) / Math.sqrt(2 * (r + a));
      }

      return new Complex(re, b < 0 ? -im : im);
    },

    /**
     * Calculate the complex exponent
     *
     * @returns {Complex}
     */
    'exp': function() {

      var tmp = Math.exp(this['re']);

      if (this['im'] === 0) {
        //return new Complex(tmp, 0);
      }
      return new Complex(
              tmp * Math.cos(this['im']),
              tmp * Math.sin(this['im']));
    },

    /**
     * Calculate the natural log
     *
     * @returns {Complex}
     */
    'log': function() {

      var a = this['re'];
      var b = this['im'];

      if (b === 0 && a > 0) {
        //return new Complex(Math.log(a), 0);
      }

      return new Complex(
              logHypot(a, b),
              Math.atan2(b, a));
    },

    /**
     * Calculate the magnitude of the complex number
     *
     * @returns {number}
     */
    'abs': function() {

      return hypot(this['re'], this['im']);
    },

    /**
     * Calculate the angle of the complex number
     *
     * @returns {number}
     */
    'arg': function() {

      return Math.atan2(this['im'], this['re']);
    },

    /**
     * Calculate the sine of the complex number
     *
     * @returns {Complex}
     */
    'sin': function() {

      // sin(c) = (e^b - e^(-b)) / (2i)

      var a = this['re'];
      var b = this['im'];

      return new Complex(
              Math.sin(a) * cosh(b),
              Math.cos(a) * sinh(b));
    },

    /**
     * Calculate the cosine
     *
     * @returns {Complex}
     */
    'cos': function() {

      // cos(z) = (e^b + e^(-b)) / 2

      var a = this['re'];
      var b = this['im'];

      return new Complex(
              Math.cos(a) * cosh(b),
             -Math.sin(a) * sinh(b));
    },

    /**
     * Calculate the tangent
     *
     * @returns {Complex}
     */
    'tan': function() {

      // tan(c) = (e^(ci) - e^(-ci)) / (i(e^(ci) + e^(-ci)))

      var a = 2 * this['re'];
      var b = 2 * this['im'];
      var d = Math.cos(a) + cosh(b);

      return new Complex(
              Math.sin(a) / d,
              sinh(b) / d);
    },

    /**
     * Calculate the cotangent
     *
     * @returns {Complex}
     */
    'cot': function() {

      // cot(c) = i(e^(ci) + e^(-ci)) / (e^(ci) - e^(-ci))

      var a = 2 * this['re'];
      var b = 2 * this['im'];
      var d = Math.cos(a) - cosh(b);

      return new Complex(
             -Math.sin(a) / d,
              sinh(b) / d);
    },

    /**
     * Calculate the secant
     *
     * @returns {Complex}
     */
    'sec': function() {

      // sec(c) = 2 / (e^(ci) + e^(-ci))

      var a = this['re'];
      var b = this['im'];
      var d = 0.5 * cosh(2 * b) + 0.5 * Math.cos(2 * a);

      return new Complex(
              Math.cos(a) * cosh(b) / d,
              Math.sin(a) * sinh(b) / d);
    },

    /**
     * Calculate the cosecans
     *
     * @returns {Complex}
     */
    'csc': function() {

      // csc(c) = 2i / (e^(ci) - e^(-ci))

      var a = this['re'];
      var b = this['im'];
      var d = 0.5 * cosh(2 * b) - 0.5 * Math.cos(2 * a);

      return new Complex(
              Math.sin(a) * cosh(b) / d,
             -Math.cos(a) * sinh(b) / d);
    },

    /**
     * Calculate the complex arcus sinus
     *
     * @returns {Complex}
     */
    'asin': function() {

      // asin(c) = -i * log(ci + sqrt(1 - c^2))

      var a = this['re'];
      var b = this['im'];

      var t1 = new Complex(
               b * b - a * a + 1,
              -2 * a * b)['sqrt']();

      var t2 = new Complex(
              t1['re'] - b,
              t1['im'] + a)['log']();

      return new Complex(t2['im'], -t2['re']);
    },

    /**
     * Calculate the complex arcus cosinus
     *
     * @returns {Complex}
     */
    'acos': function() {

      // acos(c) = i * log(c - i * sqrt(1 - c^2))

      var a = this['re'];
      var b = this['im'];

      var t1 = new Complex(
               b * b - a * a + 1,
              -2 * a * b)['sqrt']();

      var t2 = new Complex(
              t1['re'] - b,
              t1['im'] + a)['log']();

      return new Complex(Math.PI / 2 - t2['im'], t2['re']);
    },

    /**
     * Calculate the complex arcus tangent
     *
     * @returns {Complex}
     */
    'atan': function() {

      // atan(c) = i / 2 log((i + x) / (i - x))

      var a = this['re'];
      var b = this['im'];

      if (a === 0) {

        if (b === 1) {
          return new Complex(0, Infinity);
        }

        if (b === -1) {
          return new Complex(0, -Infinity);
        }
      }

      var d = a * a + (1.0 - b) * (1.0 - b);

      var t1 = new Complex(
              (1 - b * b - a * a) / d,
              -2 * a / d).log();

      return new Complex(-0.5 * t1['im'], 0.5 * t1['re']);
    },

    /**
     * Calculate the complex arcus cotangent
     *
     * @returns {Complex}
     */
    'acot': function() {

      // acot(c) = i / 2 log((c - i) / (c + i))

      var a = this['re'];
      var b = this['im'];

      if (b === 0) {
        return new Complex(Math.atan2(1, a), 0);
      }

      var d = a * a + b * b;
      return (d !== 0)
              ? new Complex(
                      a / d,
                     -b / d).atan()
              : new Complex(
                      (a !== 0) ? a / 0 : 0,
                      (b !== 0) ?-b / 0 : 0).atan();
    },

    /**
     * Calculate the complex arcus secant
     *
     * @returns {Complex}
     */
    'asec': function() {

      // asec(c) = -i * log(1 / c + sqrt(1 - i / c^2))

      var a = this['re'];
      var b = this['im'];

      if (a === 0 && b === 0) {
        return new Complex(0, Infinity);
      }

      var d = a * a + b * b;
      return (d !== 0)
              ? new Complex(
                      a / d,
                      -b / d).acos()
              : new Complex(
                      (a !== 0) ? a / 0 : 0,
                      (b !== 0) ?-b / 0 : 0).acos();
    },

    /**
     * Calculate the complex arcus cosecans
     *
     * @returns {Complex}
     */
    'acsc': function() {

      // acsc(c) = -i * log(i / c + sqrt(1 - 1 / c^2))

      var a = this['re'];
      var b = this['im'];

      if (a === 0 && b === 0) {
        return new Complex(Math.PI / 2, Infinity);
      }

      var d = a * a + b * b;
      return (d !== 0)
              ? new Complex(
                      a / d,
                     -b / d).asin()
              : new Complex(
                      (a !== 0) ? a / 0 : 0,
                      (b !== 0) ?-b / 0 : 0).asin();
    },

    /**
     * Calculate the complex sinh
     *
     * @returns {Complex}
     */
    'sinh': function() {

      // sinh(c) = (e^c - e^-c) / 2

      var a = this['re'];
      var b = this['im'];

      return new Complex(
              sinh(a) * Math.cos(b),
              cosh(a) * Math.sin(b));
    },

    /**
     * Calculate the complex cosh
     *
     * @returns {Complex}
     */
    'cosh': function() {

      // cosh(c) = (e^c + e^-c) / 2

      var a = this['re'];
      var b = this['im'];

      return new Complex(
              cosh(a) * Math.cos(b),
              sinh(a) * Math.sin(b));
    },

    /**
     * Calculate the complex tanh
     *
     * @returns {Complex}
     */
    'tanh': function() {

      // tanh(c) = (e^c - e^-c) / (e^c + e^-c)

      var a = 2 * this['re'];
      var b = 2 * this['im'];
      var d = cosh(a) + Math.cos(b);

      return new Complex(
              sinh(a) / d,
              Math.sin(b) / d);
    },

    /**
     * Calculate the complex coth
     *
     * @returns {Complex}
     */
    'coth': function() {

      // coth(c) = (e^c + e^-c) / (e^c - e^-c)

      var a = 2 * this['re'];
      var b = 2 * this['im'];
      var d = cosh(a) - Math.cos(b);

      return new Complex(
              sinh(a) / d,
             -Math.sin(b) / d);
    },

    /**
     * Calculate the complex coth
     *
     * @returns {Complex}
     */
    'csch': function() {

      // csch(c) = 2 / (e^c - e^-c)

      var a = this['re'];
      var b = this['im'];
      var d = Math.cos(2 * b) - cosh(2 * a);

      return new Complex(
           -2 * sinh(a) * Math.cos(b) / d,
            2 * cosh(a) * Math.sin(b) / d);
    },

    /**
     * Calculate the complex sech
     *
     * @returns {Complex}
     */
    'sech': function() {

      // sech(c) = 2 / (e^c + e^-c)

      var a = this['re'];
      var b = this['im'];
      var d = Math.cos(2 * b) + cosh(2 * a);

      return new Complex(
              2 * cosh(a) * Math.cos(b) / d,
             -2 * sinh(a) * Math.sin(b) / d);
    },

    /**
     * Calculate the complex asinh
     *
     * @returns {Complex}
     */
    'asinh': function() {

      // asinh(c) = log(c + sqrt(c^2 + 1))

      var tmp = this['im'];
      this['im'] = -this['re'];
      this['re'] = tmp;
      var res = this['asin']();

      this['re'] = -this['im'];
      this['im'] = tmp;
      tmp = res['re'];

      res['re'] = -res['im'];
      res['im'] = tmp;
      return res;
    },

    /**
     * Calculate the complex asinh
     *
     * @returns {Complex}
     */
    'acosh': function() {

      // acosh(c) = log(c + sqrt(c^2 - 1))

      var tmp;
      var res = this['acos']();
      if (res['im'] <= 0) {
        tmp = res['re'];
        res['re'] = -res['im'];
        res['im'] = tmp;
      } else {
        tmp = res['im'];
        res['im'] = -res['re'];
        res['re'] = tmp;
      }
      return res;
    },

    /**
     * Calculate the complex atanh
     *
     * @returns {Complex}
     */
    'atanh': function() {

      // atanh(c) = log((1+c) / (1-c)) / 2

      var a = this['re'];
      var b = this['im'];

      var noIM = a > 1 && b === 0;
      var oneMinus = 1 - a;
      var onePlus = 1 + a;
      var d = oneMinus * oneMinus + b * b;

      var x = (d !== 0)
              ? new Complex(
                      (onePlus * oneMinus - b * b) / d,
                      (b * oneMinus + onePlus * b) / d)
              : new Complex(
                      (a !== -1) ? (a / 0) : 0,
                      (b !== 0) ? (b / 0) : 0);

      var temp = x['re'];
      x['re'] = logHypot(x['re'], x['im']) / 2;
      x['im'] = Math.atan2(x['im'], temp) / 2;
      if (noIM) {
        x['im'] = -x['im'];
      }
      return x;
    },

    /**
     * Calculate the complex acoth
     *
     * @returns {Complex}
     */
    'acoth': function() {

      // acoth(c) = log((c+1) / (c-1)) / 2

      var a = this['re'];
      var b = this['im'];

      if (a === 0 && b === 0) {

        return new Complex(0, Math.PI / 2);
      }

      var d = a * a + b * b;
      return (d !== 0)
              ? new Complex(
                      a / d,
                     -b / d).atanh()
              : new Complex(
                      (a !== 0) ? a / 0 : 0,
                      (b !== 0) ?-b / 0 : 0).atanh();
    },

    /**
     * Calculate the complex acsch
     *
     * @returns {Complex}
     */
    'acsch': function() {

      // acsch(c) = log((1+sqrt(1+c^2))/c)

      var a = this['re'];
      var b = this['im'];

      if (b === 0) {

        return new Complex(
                (a !== 0)
                ? Math.log(a + Math.sqrt(a * a + 1))
                : Infinity, 0);
      }

      var d = a * a + b * b;
      return (d !== 0)
              ? new Complex(
                      a / d,
                      -b / d).asinh()
              : new Complex(
                      (a !== 0) ? a / 0 : 0,
                      (b !== 0) ?-b / 0 : 0).asinh();
    },

    /**
     * Calculate the complex asech
     *
     * @returns {Complex}
     */
    'asech': function() {

      // asech(c) = log((1+sqrt(1-c^2))/c)

      var a = this['re'];
      var b = this['im'];

      if (a === 0 && b === 0) {
        return new Complex(Infinity, 0);
      }

      var d = a * a + b * b;
      return (d !== 0)
              ? new Complex(
                      a / d,
                     -b / d).acosh()
              : new Complex(
                      (a !== 0) ? a / 0 : 0,
                      (b !== 0) ?-b / 0 : 0).acosh();
    },

    /**
     * Calculate the complex inverse 1/z
     *
     * @returns {Complex}
     */
    'inverse': function() {

      var a = this['re'];
      var b = this['im'];

      var d = a * a + b * b;

      return new Complex(
              a !== 0 ? a / d : 0,
              b !== 0 ?-b / d : 0);
    },

    /**
     * Returns the complex conjugate
     *
     * @returns {Complex}
     */
    'conjugate': function() {

      return new Complex(this['re'], -this['im']);
    },

    /**
     * Gets the negated complex number
     *
     * @returns {Complex}
     */
    'neg': function() {

      return new Complex(-this['re'], -this['im']);
    },

    /**
     * Ceils the actual complex number
     *
     * @returns {Complex}
     */
    'ceil': function(places) {

      places = Math.pow(10, places || 0);

      return new Complex(
              Math.ceil(this['re'] * places) / places,
              Math.ceil(this['im'] * places) / places);
    },

    /**
     * Floors the actual complex number
     *
     * @returns {Complex}
     */
    'floor': function(places) {

      places = Math.pow(10, places || 0);

      return new Complex(
              Math.floor(this['re'] * places) / places,
              Math.floor(this['im'] * places) / places);
    },

    /**
     * Ceils the actual complex number
     *
     * @returns {Complex}
     */
    'round': function(places) {

      places = Math.pow(10, places || 0);

      return new Complex(
              Math.round(this['re'] * places) / places,
              Math.round(this['im'] * places) / places);
    },

    /**
     * Compares two complex numbers
     *
     * @returns {boolean}
     */
    'equals': function(a, b) {

      parse(a, b); // mutates P

      return Math.abs(P['re'] - this['re']) <= Complex['EPSILON'] &&
             Math.abs(P['im'] - this['im']) <= Complex['EPSILON'];
    },

    /**
     * Clones the actual object
     *
     * @returns {Complex}
     */
    'clone': function() {

      return new Complex(this['re'], this['im']);
    },

    /**
     * Gets a string of the actual complex number
     *
     * @returns {string}
     */
    'toString': function() {

      var a = this['re'];
      var b = this['im'];
      var ret = '';

      if (isNaN(a) || isNaN(b)) {
        return 'NaN';
      }

      if (a !== 0) {
        ret+= a;
      }

      if (b !== 0) {

        if (a !== 0) {
          ret+= b < 0 ? ' - ' : ' + ';
        } else if (b < 0) {
          ret+= '-';
        }

        b = Math.abs(b);

        if (1 !== b) {
          ret+= b;
        }
        ret+= 'i';
      }

      if (!ret)
        return '0';

      return ret;
    },

    /**
     * Returns the actual number as a vector
     *
     * @returns {Array}
     */
    'toVector': function() {

      return [this['re'], this['im']];
    },

    /**
     * Returns the actual real value of the current object
     *
     * @returns {number|null}
     */
    'valueOf': function() {

      if (this['im'] === 0) {
        return this['re'];
      }
      return null;
    },

    /**
     * Checks if the given complex number is not a number
     *
     * @returns {boolean}
     */
    'isNaN': function() {
      return isNaN(this['re']) || isNaN(this['im']);
    },

    /**
     * Checks if the given complex number is finite
     *
     * @returns {boolean}
     */
    'isFinite': function() {
      return isFinite(this['re']) && isFinite(this['im']);
    }
  };

  Complex['ZERO'] = new Complex(0, 0);
  Complex['ONE'] = new Complex(1, 0);
  Complex['I'] = new Complex(0, 1);
  Complex['PI'] = new Complex(Math.PI, 0);
  Complex['E'] = new Complex(Math.E, 0);
  Complex['EPSILON'] = 1e-16;

  if (typeof define === 'function' && define['amd']) {
    define([], function() {
      return Complex;
    });
  } else if (typeof exports === 'object') {
    module['exports'] = Complex;
  } else {
    root['Complex'] = Complex;
  }

})(this);
