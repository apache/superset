var typedFunction = require('typed-function');
var digits = require('./../utils/number').digits;
var isBigNumber = require('./../utils/bignumber/isBigNumber');
var isMatrix = require('./../utils/collection/isMatrix');

// returns a new instance of typed-function
var createTyped = function () {
  // initially, return the original instance of typed-function
  // consecutively, return a new instance from typed.create.
  createTyped = typedFunction.create;
  return typedFunction;
};

/**
 * Factory function for creating a new typed instance
 * @param {Object} type   Object with data types like Complex and BigNumber
 * @returns {Function}
 */
exports.create = function create(type) {
  // TODO: typed-function must be able to silently ignore signatures with unknown data types

  // type checks for all known types
  //
  // note that:
  //
  // - check by duck-typing on a property like `isUnit`, instead of checking instanceof.
  //   instanceof cannot be used because that would not allow to pass data from
  //   one instance of math.js to another since each has it's own instance of Unit.
  // - check the `isUnit` property via the constructor, so there will be no
  //   matches for "fake" instances like plain objects with a property `isUnit`.
  //   That is important for security reasons.
  // - It must not be possible to override the type checks used internally,
  //   for security reasons, so these functions are not exposed in the expression
  //   parser.
  type.isNumber = function (x) { return typeof x === 'number' };
  type.isComplex = function (x) { return type.Complex && x instanceof type.Complex || false };
  type.isBigNumber = isBigNumber;
  type.isFraction = function (x) { return type.Fraction && x instanceof type.Fraction || false };
  type.isUnit = function (x) { return x && x.constructor.prototype.isUnit || false };
  type.isString = function (x) { return typeof x === 'string' };
  type.isArray = Array.isArray;
  type.isMatrix = isMatrix;
  type.isDenseMatrix = function (x) { return x && x.isDenseMatrix && x.constructor.prototype.isMatrix || false };
  type.isSparseMatrix = function (x) { return x && x.isSparseMatrix && x.constructor.prototype.isMatrix || false };
  type.isRange = function (x) { return x && x.constructor.prototype.isRange || false };
  type.isIndex = function (x) { return x && x.constructor.prototype.isIndex || false };
  type.isBoolean = function (x) { return typeof x === 'boolean' };
  type.isResultSet = function (x) { return x && x.constructor.prototype.isResultSet || false };
  type.isHelp = function (x) { return x && x.constructor.prototype.isHelp || false };
  type.isFunction = function (x) { return typeof x === 'function'};
  type.isDate = function (x) { return x instanceof Date };
  type.isRegExp = function (x) { return x instanceof RegExp };
  type.isObject = function (x) { return typeof x === 'object' };
  type.isNull = function (x) { return x === null };
  type.isUndefined = function (x) { return x === undefined };

  type.isAccessorNode = function (x) { return x && x.isAccessorNode && x.constructor.prototype.isNode || false };
  type.isArrayNode = function (x) { return x && x.isArrayNode && x.constructor.prototype.isNode || false };
  type.isAssignmentNode = function (x) { return x && x.isAssignmentNode && x.constructor.prototype.isNode || false };
  type.isBlockNode = function (x) { return x && x.isBlockNode && x.constructor.prototype.isNode || false };
  type.isConditionalNode = function (x) { return x && x.isConditionalNode && x.constructor.prototype.isNode || false };
  type.isConstantNode = function (x) { return x && x.isConstantNode && x.constructor.prototype.isNode || false };
  type.isFunctionAssignmentNode = function (x) { return x && x.isFunctionAssignmentNode && x.constructor.prototype.isNode || false };
  type.isFunctionNode = function (x) { return x && x.isFunctionNode && x.constructor.prototype.isNode || false };
  type.isIndexNode = function (x) { return x && x.isIndexNode && x.constructor.prototype.isNode || false };
  type.isNode = function (x) { return x && x.isNode && x.constructor.prototype.isNode || false };
  type.isObjectNode = function (x) { return x && x.isObjectNode && x.constructor.prototype.isNode || false };
  type.isOperatorNode = function (x) { return x && x.isOperatorNode && x.constructor.prototype.isNode || false };
  type.isParenthesisNode = function (x) { return x && x.isParenthesisNode && x.constructor.prototype.isNode || false };
  type.isRangeNode = function (x) { return x && x.isRangeNode && x.constructor.prototype.isNode || false };
  type.isSymbolNode = function (x) { return x && x.isSymbolNode && x.constructor.prototype.isNode || false };

  type.isChain = function (x) { return x && x.constructor.prototype.isChain || false };

  // get a new instance of typed-function
  var typed = createTyped();

  // define all types. The order of the types determines in which order function
  // arguments are type-checked (so for performance it's important to put the
  // most used types first).
  typed.types = [
    { name: 'number',          test: type.isNumber },
    { name: 'Complex',         test: type.isComplex },
    { name: 'BigNumber',       test: type.isBigNumber },
    { name: 'Fraction',        test: type.isFraction },
    { name: 'Unit',            test: type.isUnit },
    { name: 'string',          test: type.isString },
    { name: 'Array',           test: type.isArray },
    { name: 'Matrix',          test: type.isMatrix },
    { name: 'DenseMatrix',     test: type.isDenseMatrix },
    { name: 'SparseMatrix',    test: type.isSparseMatrix },
    { name: 'Range',           test: type.isRange },
    { name: 'Index',           test: type.isIndex },
    { name: 'boolean',         test: type.isBoolean },
    { name: 'ResultSet',       test: type.isResultSet },
    { name: 'Help',            test: type.isHelp },
    { name: 'function',        test: type.isFunction },
    { name: 'Date',            test: type.isDate },
    { name: 'RegExp',          test: type.isRegExp },
    { name: 'Object',          test: type.isObject },
    { name: 'null',            test: type.isNull },
    { name: 'undefined',       test: type.isUndefined },

    { name: 'OperatorNode',    test: type.isOperatorNode },
    { name: 'ConstantNode',    test: type.isConstantNode },
    { name: 'SymbolNode',      test: type.isSymbolNode },
    { name: 'ParenthesisNode', test: type.isParenthesisNode },
    { name: 'FunctionNode',    test: type.isFunctionNode },
    { name: 'FunctionAssignmentNode',    test: type.isFunctionAssignmentNode },
    { name: 'ArrayNode',                 test: type.isArrayNode },
    { name: 'AssignmentNode',            test: type.isAssignmentNode },
    { name: 'BlockNode',                 test: type.isBlockNode },
    { name: 'ConditionalNode',           test: type.isConditionalNode },
    { name: 'IndexNode',                 test: type.isIndexNode },
    { name: 'RangeNode',                 test: type.isRangeNode },
    { name: 'Node',                      test: type.isNode }
  ];

  // TODO: add conversion from BigNumber to number?
  typed.conversions = [
    {
      from: 'number',
      to: 'BigNumber',
      convert: function (x) {
        // note: conversion from number to BigNumber can fail if x has >15 digits
        if (digits(x) > 15) {
          throw new TypeError('Cannot implicitly convert a number with >15 significant digits to BigNumber ' +
          '(value: ' + x + '). ' +
          'Use function bignumber(x) to convert to BigNumber.');
        }
        return new type.BigNumber(x);
      }
    }, {
      from: 'number',
      to: 'Complex',
      convert: function (x) {
        return new type.Complex(x, 0);
      }
    }, {
      from: 'number',
      to: 'string',
      convert: function (x) {
        return x + '';
      }
    }, {
      from: 'BigNumber',
      to: 'Complex',
      convert: function (x) {
        return new type.Complex(x.toNumber(), 0);
      }
    }, {
      from: 'Fraction',
      to: 'BigNumber',
      convert: function (x) {
        throw new TypeError('Cannot implicitly convert a Fraction to BigNumber or vice versa. ' +
            'Use function bignumber(x) to convert to BigNumber or fraction(x) to convert to Fraction.');
      }
    }, {
      from: 'Fraction',
      to: 'Complex',
      convert: function (x) {
        return new type.Complex(x.valueOf(), 0);
      }
    }, {
      from: 'number',
      to: 'Fraction',
      convert: function (x) {
        var f = new type.Fraction(x);
        if (f.valueOf() !== x) {
          throw new TypeError('Cannot implicitly convert a number to a Fraction when there will be a loss of precision ' +
              '(value: ' + x + '). ' +
              'Use function fraction(x) to convert to Fraction.');
        }
        return new type.Fraction(x);
      }
    }, {
    // FIXME: add conversion from Fraction to number, for example for `sqrt(fraction(1,3))`
    //  from: 'Fraction',
    //  to: 'number',
    //  convert: function (x) {
    //    return x.valueOf();
    //  }
    //}, {
      from: 'string',
      to: 'number',
      convert: function (x) {
        var n = Number(x);
        if (isNaN(n)) {
          throw new Error('Cannot convert "' + x + '" to a number');
        }
        return n;
      }
    }, {
      from: 'string',
      to: 'BigNumber',
      convert: function (x) {
        try {
          return new type.BigNumber(x);
        }
        catch (err) {
          throw new Error('Cannot convert "' + x + '" to BigNumber');
        }
      }
    }, {
      from: 'string',
      to: 'Fraction',
      convert: function (x) {
        try {
          return new type.Fraction(x);
        }
        catch (err) {
          throw new Error('Cannot convert "' + x + '" to Fraction');
        }
      }
    }, {
      from: 'string',
      to: 'Complex',
      convert: function (x) {
        try {
          return new type.Complex(x);
        }
        catch (err) {
          throw new Error('Cannot convert "' + x + '" to Complex');
        }
      }
    }, {
      from: 'boolean',
      to: 'number',
      convert: function (x) {
        return +x;
      }
    }, {
      from: 'boolean',
      to: 'BigNumber',
      convert: function (x) {
        return new type.BigNumber(+x);
      }
    }, {
      from: 'boolean',
      to: 'Fraction',
      convert: function (x) {
        return new type.Fraction(+x);
      }
    }, {
      from: 'boolean',
      to: 'string',
      convert: function (x) {
        return +x;
      }
    }, {
      from: 'null',
      to: 'number',
      convert: function () {
        return 0;
      }
    }, {
      from: 'null',
      to: 'string',
      convert: function () {
        return 'null';
      }
    }, {
      from: 'null',
      to: 'BigNumber',
      convert: function () {
        return new type.BigNumber(0);
      }
    }, {
      from: 'null',
      to: 'Fraction',
      convert: function () {
        return new type.Fraction(0);
      }
    }, {
      from: 'Array',
      to: 'Matrix',
      convert: function (array) {
        // TODO: how to decide on the right type of matrix to create?
        return new type.DenseMatrix(array);
      }
    }, {
      from: 'Matrix',
      to: 'Array',
      convert: function (matrix) {
        return matrix.valueOf();
      }
    }
  ];

  return typed;
};
