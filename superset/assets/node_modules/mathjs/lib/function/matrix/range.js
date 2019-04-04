'use strict';

function factory (type, config, load, typed) {
  var matrix = load(require('../../type/matrix/function/matrix'));

  var ZERO = new type.BigNumber(0);
  var ONE = new type.BigNumber(1);

  /**
   * Create an array from a range.
   * By default, the range end is excluded. This can be customized by providing
   * an extra parameter `includeEnd`.
   *
   * Syntax:
   *
   *     math.range(str [, includeEnd])               // Create a range from a string,
   *                                                  // where the string contains the
   *                                                  // start, optional step, and end,
   *                                                  // separated by a colon.
   *     math.range(start, end [, includeEnd])        // Create a range with start and
   *                                                  // end and a step size of 1.
   *     math.range(start, end, step [, includeEnd])  // Create a range with start, step,
   *                                                  // and end.
   *
   * Where:
   *
   * - `str: string`
   *   A string 'start:end' or 'start:step:end'
   * - `start: {number | BigNumber}`
   *   Start of the range
   * - `end: number | BigNumber`
   *   End of the range, excluded by default, included when parameter includeEnd=true
   * - `step: number | BigNumber`
   *   Step size. Default value is 1.
   * - `includeEnd: boolean`
   *   Option to specify whether to include the end or not. False by default.
   *
   * Examples:
   *
   *     math.range(2, 6);        // [2, 3, 4, 5]
   *     math.range(2, -3, -1);   // [2, 1, 0, -1, -2]
   *     math.range('2:1:6');     // [2, 3, 4, 5]
   *     math.range(2, 6, true);  // [2, 3, 4, 5, 6]
   *
   * See also:
   *
   *     ones, zeros, size, subset
   *
   * @param {*} args   Parameters describing the ranges `start`, `end`, and optional `step`.
   * @return {Array | Matrix} range
   */
  var range = typed('range', {
    // TODO: simplify signatures when typed-function supports default values and optional arguments

    // TODO: a number or boolean should not be converted to string here
    'string': _strRange,
    'string, boolean': _strRange,

    'number, number':  function (start, end) {
      return _out(_rangeEx(start, end, 1));
    },
    'number, number, number': function (start, end, step) {
      return _out(_rangeEx(start, end, step));
    },
    'number, number, boolean': function (start, end, includeEnd) {
      return includeEnd
          ? _out(_rangeInc(start, end, 1))
          : _out(_rangeEx(start, end, 1));
    },
    'number, number, number, boolean': function (start, end, step, includeEnd) {
      return includeEnd
          ? _out(_rangeInc(start, end, step))
          : _out(_rangeEx(start, end, step));
    },

    'BigNumber, BigNumber':  function (start, end) {
      return _out(_bigRangeEx(start, end, ONE));
    },
    'BigNumber, BigNumber, BigNumber': function (start, end, step) {
      return _out(_bigRangeEx(start, end, step));
    },
    'BigNumber, BigNumber, boolean': function (start, end, includeEnd) {
      return includeEnd
          ? _out(_bigRangeInc(start, end, ONE))
          : _out(_bigRangeEx(start, end, ONE));
    },
    'BigNumber, BigNumber, BigNumber, boolean': function (start, end, step, includeEnd) {
      return includeEnd
          ? _out(_bigRangeInc(start, end, step))
          : _out(_bigRangeEx(start, end, step));
    }

  });

  range.toTex = undefined; // use default template

  return range;

  function _out(arr) {
    return config.matrix === 'Array' ? arr : matrix(arr);
  }

  function _strRange (str, includeEnd) {
    var r = _parse(str);
    if (!r){
      throw new SyntaxError('String "' + str + '" is no valid range');
    }

    var fn;
    if (config.number === 'BigNumber') {
      fn = includeEnd ? _bigRangeInc : _bigRangeEx;
      return _out(fn(
          new type.BigNumber(r.start),
          new type.BigNumber(r.end),
          new type.BigNumber(r.step)));
    }
    else {
      fn = includeEnd ? _rangeInc : _rangeEx;
      return _out(fn(r.start, r.end, r.step));
    }
  }

  /**
   * Create a range with numbers. End is excluded
   * @param {number} start
   * @param {number} end
   * @param {number} step
   * @returns {Array} range
   * @private
   */
  function _rangeEx (start, end, step) {
    var array = [],
        x = start;
    if (step > 0) {
      while (x < end) {
        array.push(x);
        x += step;
      }
    }
    else if (step < 0) {
      while (x > end) {
        array.push(x);
        x += step;
      }
    }

    return array;
  }

  /**
   * Create a range with numbers. End is included
   * @param {number} start
   * @param {number} end
   * @param {number} step
   * @returns {Array} range
   * @private
   */
  function _rangeInc (start, end, step) {
    var array = [],
        x = start;
    if (step > 0) {
      while (x <= end) {
        array.push(x);
        x += step;
      }
    }
    else if (step < 0) {
      while (x >= end) {
        array.push(x);
        x += step;
      }
    }

    return array;
  }

  /**
   * Create a range with big numbers. End is excluded
   * @param {BigNumber} start
   * @param {BigNumber} end
   * @param {BigNumber} step
   * @returns {Array} range
   * @private
   */
  function _bigRangeEx (start, end, step) {
    var array = [],
        x = start;
    if (step.gt(ZERO)) {
      while (x.lt(end)) {
        array.push(x);
        x = x.plus(step);
      }
    }
    else if (step.lt(ZERO)) {
      while (x.gt(end)) {
        array.push(x);
        x = x.plus(step);
      }
    }

    return array;
  }

  /**
   * Create a range with big numbers. End is included
   * @param {BigNumber} start
   * @param {BigNumber} end
   * @param {BigNumber} step
   * @returns {Array} range
   * @private
   */
  function _bigRangeInc (start, end, step) {
    var array = [],
        x = start;
    if (step.gt(ZERO)) {
      while (x.lte(end)) {
        array.push(x);
        x = x.plus(step);
      }
    }
    else if (step.lt(ZERO)) {
      while (x.gte(end)) {
        array.push(x);
        x = x.plus(step);
      }
    }

    return array;
  }

  /**
   * Parse a string into a range,
   * The string contains the start, optional step, and end, separated by a colon.
   * If the string does not contain a valid range, null is returned.
   * For example str='0:2:11'.
   * @param {string} str
   * @return {{start: number, end: number, step: number} | null} range Object containing properties start, end, step
   * @private
   */
  function _parse (str) {
    var args = str.split(':');

    // number
    var nums = args.map(function (arg) {
      // use Number and not parseFloat as Number returns NaN on invalid garbage in the string
      return Number(arg);
    });

    var invalid = nums.some(function (num) {
      return isNaN(num);
    });
    if(invalid) {
      return null;
    }

    switch (nums.length) {
      case 2:
        return {
          start: nums[0],
          end: nums[1],
          step: 1
        };

      case 3:
        return {
          start: nums[0],
          end: nums[2],
          step: nums[1]
        };

      default:
        return null;
    }
  }

}

exports.name = 'range';
exports.factory = factory;
