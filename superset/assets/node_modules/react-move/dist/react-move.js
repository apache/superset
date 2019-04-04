(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('react')) :
	typeof define === 'function' && define.amd ? define(['exports', 'react'], factory) :
	(global = global || self, factory(global.ReactMove = {}, global.React));
}(this, function (exports, React) { 'use strict';

	var React__default = 'default' in React ? React['default'] : React;

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	/*
	object-assign
	(c) Sindre Sorhus
	@license MIT
	*/
	/* eslint-disable no-unused-vars */
	var getOwnPropertySymbols = Object.getOwnPropertySymbols;
	var hasOwnProperty = Object.prototype.hasOwnProperty;
	var propIsEnumerable = Object.prototype.propertyIsEnumerable;

	function toObject(val) {
		if (val === null || val === undefined) {
			throw new TypeError('Object.assign cannot be called with null or undefined');
		}

		return Object(val);
	}

	function shouldUseNative() {
		try {
			if (!Object.assign) {
				return false;
			}

			// Detect buggy property enumeration order in older V8 versions.

			// https://bugs.chromium.org/p/v8/issues/detail?id=4118
			var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
			test1[5] = 'de';
			if (Object.getOwnPropertyNames(test1)[0] === '5') {
				return false;
			}

			// https://bugs.chromium.org/p/v8/issues/detail?id=3056
			var test2 = {};
			for (var i = 0; i < 10; i++) {
				test2['_' + String.fromCharCode(i)] = i;
			}
			var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
				return test2[n];
			});
			if (order2.join('') !== '0123456789') {
				return false;
			}

			// https://bugs.chromium.org/p/v8/issues/detail?id=3056
			var test3 = {};
			'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
				test3[letter] = letter;
			});
			if (Object.keys(Object.assign({}, test3)).join('') !==
					'abcdefghijklmnopqrst') {
				return false;
			}

			return true;
		} catch (err) {
			// We don't expect any of the above to throw, but better to be safe.
			return false;
		}
	}

	var objectAssign = shouldUseNative() ? Object.assign : function (target, source) {
		var from;
		var to = toObject(target);
		var symbols;

		for (var s = 1; s < arguments.length; s++) {
			from = Object(arguments[s]);

			for (var key in from) {
				if (hasOwnProperty.call(from, key)) {
					to[key] = from[key];
				}
			}

			if (getOwnPropertySymbols) {
				symbols = getOwnPropertySymbols(from);
				for (var i = 0; i < symbols.length; i++) {
					if (propIsEnumerable.call(from, symbols[i])) {
						to[symbols[i]] = from[symbols[i]];
					}
				}
			}
		}

		return to;
	};

	/**
	 * Copyright (c) 2013-present, Facebook, Inc.
	 *
	 * This source code is licensed under the MIT license found in the
	 * LICENSE file in the root directory of this source tree.
	 */

	var ReactPropTypesSecret = 'SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED';

	var ReactPropTypesSecret_1 = ReactPropTypesSecret;

	var printWarning = function() {};

	{
	  var ReactPropTypesSecret$1 = ReactPropTypesSecret_1;
	  var loggedTypeFailures = {};

	  printWarning = function(text) {
	    var message = 'Warning: ' + text;
	    if (typeof console !== 'undefined') {
	      console.error(message);
	    }
	    try {
	      // --- Welcome to debugging React ---
	      // This error was thrown as a convenience so that you can use this stack
	      // to find the callsite that caused this warning to fire.
	      throw new Error(message);
	    } catch (x) {}
	  };
	}

	/**
	 * Assert that the values match with the type specs.
	 * Error messages are memorized and will only be shown once.
	 *
	 * @param {object} typeSpecs Map of name to a ReactPropType
	 * @param {object} values Runtime values that need to be type-checked
	 * @param {string} location e.g. "prop", "context", "child context"
	 * @param {string} componentName Name of the component for error messages.
	 * @param {?Function} getStack Returns the component stack.
	 * @private
	 */
	function checkPropTypes(typeSpecs, values, location, componentName, getStack) {
	  {
	    for (var typeSpecName in typeSpecs) {
	      if (typeSpecs.hasOwnProperty(typeSpecName)) {
	        var error;
	        // Prop type validation may throw. In case they do, we don't want to
	        // fail the render phase where it didn't fail before. So we log it.
	        // After these have been cleaned up, we'll let them throw.
	        try {
	          // This is intentionally an invariant that gets caught. It's the same
	          // behavior as without this statement except with a better message.
	          if (typeof typeSpecs[typeSpecName] !== 'function') {
	            var err = Error(
	              (componentName || 'React class') + ': ' + location + ' type `' + typeSpecName + '` is invalid; ' +
	              'it must be a function, usually from the `prop-types` package, but received `' + typeof typeSpecs[typeSpecName] + '`.'
	            );
	            err.name = 'Invariant Violation';
	            throw err;
	          }
	          error = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, ReactPropTypesSecret$1);
	        } catch (ex) {
	          error = ex;
	        }
	        if (error && !(error instanceof Error)) {
	          printWarning(
	            (componentName || 'React class') + ': type specification of ' +
	            location + ' `' + typeSpecName + '` is invalid; the type checker ' +
	            'function must return `null` or an `Error` but returned a ' + typeof error + '. ' +
	            'You may have forgotten to pass an argument to the type checker ' +
	            'creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and ' +
	            'shape all require an argument).'
	          );

	        }
	        if (error instanceof Error && !(error.message in loggedTypeFailures)) {
	          // Only monitor this failure once because there tends to be a lot of the
	          // same error.
	          loggedTypeFailures[error.message] = true;

	          var stack = getStack ? getStack() : '';

	          printWarning(
	            'Failed ' + location + ' type: ' + error.message + (stack != null ? stack : '')
	          );
	        }
	      }
	    }
	  }
	}

	var checkPropTypes_1 = checkPropTypes;

	var printWarning$1 = function() {};

	{
	  printWarning$1 = function(text) {
	    var message = 'Warning: ' + text;
	    if (typeof console !== 'undefined') {
	      console.error(message);
	    }
	    try {
	      // --- Welcome to debugging React ---
	      // This error was thrown as a convenience so that you can use this stack
	      // to find the callsite that caused this warning to fire.
	      throw new Error(message);
	    } catch (x) {}
	  };
	}

	function emptyFunctionThatReturnsNull() {
	  return null;
	}

	var factoryWithTypeCheckers = function(isValidElement, throwOnDirectAccess) {
	  /* global Symbol */
	  var ITERATOR_SYMBOL = typeof Symbol === 'function' && Symbol.iterator;
	  var FAUX_ITERATOR_SYMBOL = '@@iterator'; // Before Symbol spec.

	  /**
	   * Returns the iterator method function contained on the iterable object.
	   *
	   * Be sure to invoke the function with the iterable as context:
	   *
	   *     var iteratorFn = getIteratorFn(myIterable);
	   *     if (iteratorFn) {
	   *       var iterator = iteratorFn.call(myIterable);
	   *       ...
	   *     }
	   *
	   * @param {?object} maybeIterable
	   * @return {?function}
	   */
	  function getIteratorFn(maybeIterable) {
	    var iteratorFn = maybeIterable && (ITERATOR_SYMBOL && maybeIterable[ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL]);
	    if (typeof iteratorFn === 'function') {
	      return iteratorFn;
	    }
	  }

	  /**
	   * Collection of methods that allow declaration and validation of props that are
	   * supplied to React components. Example usage:
	   *
	   *   var Props = require('ReactPropTypes');
	   *   var MyArticle = React.createClass({
	   *     propTypes: {
	   *       // An optional string prop named "description".
	   *       description: Props.string,
	   *
	   *       // A required enum prop named "category".
	   *       category: Props.oneOf(['News','Photos']).isRequired,
	   *
	   *       // A prop named "dialog" that requires an instance of Dialog.
	   *       dialog: Props.instanceOf(Dialog).isRequired
	   *     },
	   *     render: function() { ... }
	   *   });
	   *
	   * A more formal specification of how these methods are used:
	   *
	   *   type := array|bool|func|object|number|string|oneOf([...])|instanceOf(...)
	   *   decl := ReactPropTypes.{type}(.isRequired)?
	   *
	   * Each and every declaration produces a function with the same signature. This
	   * allows the creation of custom validation functions. For example:
	   *
	   *  var MyLink = React.createClass({
	   *    propTypes: {
	   *      // An optional string or URI prop named "href".
	   *      href: function(props, propName, componentName) {
	   *        var propValue = props[propName];
	   *        if (propValue != null && typeof propValue !== 'string' &&
	   *            !(propValue instanceof URI)) {
	   *          return new Error(
	   *            'Expected a string or an URI for ' + propName + ' in ' +
	   *            componentName
	   *          );
	   *        }
	   *      }
	   *    },
	   *    render: function() {...}
	   *  });
	   *
	   * @internal
	   */

	  var ANONYMOUS = '<<anonymous>>';

	  // Important!
	  // Keep this list in sync with production version in `./factoryWithThrowingShims.js`.
	  var ReactPropTypes = {
	    array: createPrimitiveTypeChecker('array'),
	    bool: createPrimitiveTypeChecker('boolean'),
	    func: createPrimitiveTypeChecker('function'),
	    number: createPrimitiveTypeChecker('number'),
	    object: createPrimitiveTypeChecker('object'),
	    string: createPrimitiveTypeChecker('string'),
	    symbol: createPrimitiveTypeChecker('symbol'),

	    any: createAnyTypeChecker(),
	    arrayOf: createArrayOfTypeChecker,
	    element: createElementTypeChecker(),
	    instanceOf: createInstanceTypeChecker,
	    node: createNodeChecker(),
	    objectOf: createObjectOfTypeChecker,
	    oneOf: createEnumTypeChecker,
	    oneOfType: createUnionTypeChecker,
	    shape: createShapeTypeChecker,
	    exact: createStrictShapeTypeChecker,
	  };

	  /**
	   * inlined Object.is polyfill to avoid requiring consumers ship their own
	   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
	   */
	  /*eslint-disable no-self-compare*/
	  function is(x, y) {
	    // SameValue algorithm
	    if (x === y) {
	      // Steps 1-5, 7-10
	      // Steps 6.b-6.e: +0 != -0
	      return x !== 0 || 1 / x === 1 / y;
	    } else {
	      // Step 6.a: NaN == NaN
	      return x !== x && y !== y;
	    }
	  }
	  /*eslint-enable no-self-compare*/

	  /**
	   * We use an Error-like object for backward compatibility as people may call
	   * PropTypes directly and inspect their output. However, we don't use real
	   * Errors anymore. We don't inspect their stack anyway, and creating them
	   * is prohibitively expensive if they are created too often, such as what
	   * happens in oneOfType() for any type before the one that matched.
	   */
	  function PropTypeError(message) {
	    this.message = message;
	    this.stack = '';
	  }
	  // Make `instanceof Error` still work for returned errors.
	  PropTypeError.prototype = Error.prototype;

	  function createChainableTypeChecker(validate) {
	    {
	      var manualPropTypeCallCache = {};
	      var manualPropTypeWarningCount = 0;
	    }
	    function checkType(isRequired, props, propName, componentName, location, propFullName, secret) {
	      componentName = componentName || ANONYMOUS;
	      propFullName = propFullName || propName;

	      if (secret !== ReactPropTypesSecret_1) {
	        if (throwOnDirectAccess) {
	          // New behavior only for users of `prop-types` package
	          var err = new Error(
	            'Calling PropTypes validators directly is not supported by the `prop-types` package. ' +
	            'Use `PropTypes.checkPropTypes()` to call them. ' +
	            'Read more at http://fb.me/use-check-prop-types'
	          );
	          err.name = 'Invariant Violation';
	          throw err;
	        } else if (typeof console !== 'undefined') {
	          // Old behavior for people using React.PropTypes
	          var cacheKey = componentName + ':' + propName;
	          if (
	            !manualPropTypeCallCache[cacheKey] &&
	            // Avoid spamming the console because they are often not actionable except for lib authors
	            manualPropTypeWarningCount < 3
	          ) {
	            printWarning$1(
	              'You are manually calling a React.PropTypes validation ' +
	              'function for the `' + propFullName + '` prop on `' + componentName  + '`. This is deprecated ' +
	              'and will throw in the standalone `prop-types` package. ' +
	              'You may be seeing this warning due to a third-party PropTypes ' +
	              'library. See https://fb.me/react-warning-dont-call-proptypes ' + 'for details.'
	            );
	            manualPropTypeCallCache[cacheKey] = true;
	            manualPropTypeWarningCount++;
	          }
	        }
	      }
	      if (props[propName] == null) {
	        if (isRequired) {
	          if (props[propName] === null) {
	            return new PropTypeError('The ' + location + ' `' + propFullName + '` is marked as required ' + ('in `' + componentName + '`, but its value is `null`.'));
	          }
	          return new PropTypeError('The ' + location + ' `' + propFullName + '` is marked as required in ' + ('`' + componentName + '`, but its value is `undefined`.'));
	        }
	        return null;
	      } else {
	        return validate(props, propName, componentName, location, propFullName);
	      }
	    }

	    var chainedCheckType = checkType.bind(null, false);
	    chainedCheckType.isRequired = checkType.bind(null, true);

	    return chainedCheckType;
	  }

	  function createPrimitiveTypeChecker(expectedType) {
	    function validate(props, propName, componentName, location, propFullName, secret) {
	      var propValue = props[propName];
	      var propType = getPropType(propValue);
	      if (propType !== expectedType) {
	        // `propValue` being instance of, say, date/regexp, pass the 'object'
	        // check, but we can offer a more precise error message here rather than
	        // 'of type `object`'.
	        var preciseType = getPreciseType(propValue);

	        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + preciseType + '` supplied to `' + componentName + '`, expected ') + ('`' + expectedType + '`.'));
	      }
	      return null;
	    }
	    return createChainableTypeChecker(validate);
	  }

	  function createAnyTypeChecker() {
	    return createChainableTypeChecker(emptyFunctionThatReturnsNull);
	  }

	  function createArrayOfTypeChecker(typeChecker) {
	    function validate(props, propName, componentName, location, propFullName) {
	      if (typeof typeChecker !== 'function') {
	        return new PropTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside arrayOf.');
	      }
	      var propValue = props[propName];
	      if (!Array.isArray(propValue)) {
	        var propType = getPropType(propValue);
	        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an array.'));
	      }
	      for (var i = 0; i < propValue.length; i++) {
	        var error = typeChecker(propValue, i, componentName, location, propFullName + '[' + i + ']', ReactPropTypesSecret_1);
	        if (error instanceof Error) {
	          return error;
	        }
	      }
	      return null;
	    }
	    return createChainableTypeChecker(validate);
	  }

	  function createElementTypeChecker() {
	    function validate(props, propName, componentName, location, propFullName) {
	      var propValue = props[propName];
	      if (!isValidElement(propValue)) {
	        var propType = getPropType(propValue);
	        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected a single ReactElement.'));
	      }
	      return null;
	    }
	    return createChainableTypeChecker(validate);
	  }

	  function createInstanceTypeChecker(expectedClass) {
	    function validate(props, propName, componentName, location, propFullName) {
	      if (!(props[propName] instanceof expectedClass)) {
	        var expectedClassName = expectedClass.name || ANONYMOUS;
	        var actualClassName = getClassName(props[propName]);
	        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + actualClassName + '` supplied to `' + componentName + '`, expected ') + ('instance of `' + expectedClassName + '`.'));
	      }
	      return null;
	    }
	    return createChainableTypeChecker(validate);
	  }

	  function createEnumTypeChecker(expectedValues) {
	    if (!Array.isArray(expectedValues)) {
	      printWarning$1('Invalid argument supplied to oneOf, expected an instance of array.');
	      return emptyFunctionThatReturnsNull;
	    }

	    function validate(props, propName, componentName, location, propFullName) {
	      var propValue = props[propName];
	      for (var i = 0; i < expectedValues.length; i++) {
	        if (is(propValue, expectedValues[i])) {
	          return null;
	        }
	      }

	      var valuesString = JSON.stringify(expectedValues);
	      return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of value `' + propValue + '` ' + ('supplied to `' + componentName + '`, expected one of ' + valuesString + '.'));
	    }
	    return createChainableTypeChecker(validate);
	  }

	  function createObjectOfTypeChecker(typeChecker) {
	    function validate(props, propName, componentName, location, propFullName) {
	      if (typeof typeChecker !== 'function') {
	        return new PropTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside objectOf.');
	      }
	      var propValue = props[propName];
	      var propType = getPropType(propValue);
	      if (propType !== 'object') {
	        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an object.'));
	      }
	      for (var key in propValue) {
	        if (propValue.hasOwnProperty(key)) {
	          var error = typeChecker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret_1);
	          if (error instanceof Error) {
	            return error;
	          }
	        }
	      }
	      return null;
	    }
	    return createChainableTypeChecker(validate);
	  }

	  function createUnionTypeChecker(arrayOfTypeCheckers) {
	    if (!Array.isArray(arrayOfTypeCheckers)) {
	      printWarning$1('Invalid argument supplied to oneOfType, expected an instance of array.');
	      return emptyFunctionThatReturnsNull;
	    }

	    for (var i = 0; i < arrayOfTypeCheckers.length; i++) {
	      var checker = arrayOfTypeCheckers[i];
	      if (typeof checker !== 'function') {
	        printWarning$1(
	          'Invalid argument supplied to oneOfType. Expected an array of check functions, but ' +
	          'received ' + getPostfixForTypeWarning(checker) + ' at index ' + i + '.'
	        );
	        return emptyFunctionThatReturnsNull;
	      }
	    }

	    function validate(props, propName, componentName, location, propFullName) {
	      for (var i = 0; i < arrayOfTypeCheckers.length; i++) {
	        var checker = arrayOfTypeCheckers[i];
	        if (checker(props, propName, componentName, location, propFullName, ReactPropTypesSecret_1) == null) {
	          return null;
	        }
	      }

	      return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`.'));
	    }
	    return createChainableTypeChecker(validate);
	  }

	  function createNodeChecker() {
	    function validate(props, propName, componentName, location, propFullName) {
	      if (!isNode(props[propName])) {
	        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`, expected a ReactNode.'));
	      }
	      return null;
	    }
	    return createChainableTypeChecker(validate);
	  }

	  function createShapeTypeChecker(shapeTypes) {
	    function validate(props, propName, componentName, location, propFullName) {
	      var propValue = props[propName];
	      var propType = getPropType(propValue);
	      if (propType !== 'object') {
	        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type `' + propType + '` ' + ('supplied to `' + componentName + '`, expected `object`.'));
	      }
	      for (var key in shapeTypes) {
	        var checker = shapeTypes[key];
	        if (!checker) {
	          continue;
	        }
	        var error = checker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret_1);
	        if (error) {
	          return error;
	        }
	      }
	      return null;
	    }
	    return createChainableTypeChecker(validate);
	  }

	  function createStrictShapeTypeChecker(shapeTypes) {
	    function validate(props, propName, componentName, location, propFullName) {
	      var propValue = props[propName];
	      var propType = getPropType(propValue);
	      if (propType !== 'object') {
	        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type `' + propType + '` ' + ('supplied to `' + componentName + '`, expected `object`.'));
	      }
	      // We need to check all keys in case some are required but missing from
	      // props.
	      var allKeys = objectAssign({}, props[propName], shapeTypes);
	      for (var key in allKeys) {
	        var checker = shapeTypes[key];
	        if (!checker) {
	          return new PropTypeError(
	            'Invalid ' + location + ' `' + propFullName + '` key `' + key + '` supplied to `' + componentName + '`.' +
	            '\nBad object: ' + JSON.stringify(props[propName], null, '  ') +
	            '\nValid keys: ' +  JSON.stringify(Object.keys(shapeTypes), null, '  ')
	          );
	        }
	        var error = checker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret_1);
	        if (error) {
	          return error;
	        }
	      }
	      return null;
	    }

	    return createChainableTypeChecker(validate);
	  }

	  function isNode(propValue) {
	    switch (typeof propValue) {
	      case 'number':
	      case 'string':
	      case 'undefined':
	        return true;
	      case 'boolean':
	        return !propValue;
	      case 'object':
	        if (Array.isArray(propValue)) {
	          return propValue.every(isNode);
	        }
	        if (propValue === null || isValidElement(propValue)) {
	          return true;
	        }

	        var iteratorFn = getIteratorFn(propValue);
	        if (iteratorFn) {
	          var iterator = iteratorFn.call(propValue);
	          var step;
	          if (iteratorFn !== propValue.entries) {
	            while (!(step = iterator.next()).done) {
	              if (!isNode(step.value)) {
	                return false;
	              }
	            }
	          } else {
	            // Iterator will provide entry [k,v] tuples rather than values.
	            while (!(step = iterator.next()).done) {
	              var entry = step.value;
	              if (entry) {
	                if (!isNode(entry[1])) {
	                  return false;
	                }
	              }
	            }
	          }
	        } else {
	          return false;
	        }

	        return true;
	      default:
	        return false;
	    }
	  }

	  function isSymbol(propType, propValue) {
	    // Native Symbol.
	    if (propType === 'symbol') {
	      return true;
	    }

	    // 19.4.3.5 Symbol.prototype[@@toStringTag] === 'Symbol'
	    if (propValue['@@toStringTag'] === 'Symbol') {
	      return true;
	    }

	    // Fallback for non-spec compliant Symbols which are polyfilled.
	    if (typeof Symbol === 'function' && propValue instanceof Symbol) {
	      return true;
	    }

	    return false;
	  }

	  // Equivalent of `typeof` but with special handling for array and regexp.
	  function getPropType(propValue) {
	    var propType = typeof propValue;
	    if (Array.isArray(propValue)) {
	      return 'array';
	    }
	    if (propValue instanceof RegExp) {
	      // Old webkits (at least until Android 4.0) return 'function' rather than
	      // 'object' for typeof a RegExp. We'll normalize this here so that /bla/
	      // passes PropTypes.object.
	      return 'object';
	    }
	    if (isSymbol(propType, propValue)) {
	      return 'symbol';
	    }
	    return propType;
	  }

	  // This handles more types than `getPropType`. Only used for error messages.
	  // See `createPrimitiveTypeChecker`.
	  function getPreciseType(propValue) {
	    if (typeof propValue === 'undefined' || propValue === null) {
	      return '' + propValue;
	    }
	    var propType = getPropType(propValue);
	    if (propType === 'object') {
	      if (propValue instanceof Date) {
	        return 'date';
	      } else if (propValue instanceof RegExp) {
	        return 'regexp';
	      }
	    }
	    return propType;
	  }

	  // Returns a string that is postfixed to a warning about an invalid type.
	  // For example, "undefined" or "of type array"
	  function getPostfixForTypeWarning(value) {
	    var type = getPreciseType(value);
	    switch (type) {
	      case 'array':
	      case 'object':
	        return 'an ' + type;
	      case 'boolean':
	      case 'date':
	      case 'regexp':
	        return 'a ' + type;
	      default:
	        return type;
	    }
	  }

	  // Returns class name of the object, if any.
	  function getClassName(propValue) {
	    if (!propValue.constructor || !propValue.constructor.name) {
	      return ANONYMOUS;
	    }
	    return propValue.constructor.name;
	  }

	  ReactPropTypes.checkPropTypes = checkPropTypes_1;
	  ReactPropTypes.PropTypes = ReactPropTypes;

	  return ReactPropTypes;
	};

	var propTypes = createCommonjsModule(function (module) {
	/**
	 * Copyright (c) 2013-present, Facebook, Inc.
	 *
	 * This source code is licensed under the MIT license found in the
	 * LICENSE file in the root directory of this source tree.
	 */

	{
	  var REACT_ELEMENT_TYPE = (typeof Symbol === 'function' &&
	    Symbol.for &&
	    Symbol.for('react.element')) ||
	    0xeac7;

	  var isValidElement = function(object) {
	    return typeof object === 'object' &&
	      object !== null &&
	      object.$$typeof === REACT_ELEMENT_TYPE;
	  };

	  // By explicitly using `prop-types` you are opting into new development behavior.
	  // http://fb.me/prop-types-in-prod
	  var throwOnDirectAccess = true;
	  module.exports = factoryWithTypeCheckers(isValidElement, throwOnDirectAccess);
	}
	});

	function _defineProperty(obj, key, value) {
	  if (key in obj) {
	    Object.defineProperty(obj, key, {
	      value: value,
	      enumerable: true,
	      configurable: true,
	      writable: true
	    });
	  } else {
	    obj[key] = value;
	  }

	  return obj;
	}

	var defineProperty = _defineProperty;

	/**
	 * Copyright (c) 2013-present, Facebook, Inc.
	 *
	 * This source code is licensed under the MIT license found in the
	 * LICENSE file in the root directory of this source tree.
	 */

	function componentWillMount() {
	  // Call this.constructor.gDSFP to support sub-classes.
	  var state = this.constructor.getDerivedStateFromProps(this.props, this.state);
	  if (state !== null && state !== undefined) {
	    this.setState(state);
	  }
	}

	function componentWillReceiveProps(nextProps) {
	  // Call this.constructor.gDSFP to support sub-classes.
	  // Use the setState() updater to ensure state isn't stale in certain edge cases.
	  function updater(prevState) {
	    var state = this.constructor.getDerivedStateFromProps(nextProps, prevState);
	    return state !== null && state !== undefined ? state : null;
	  }
	  // Binding "this" is important for shallow renderer support.
	  this.setState(updater.bind(this));
	}

	function componentWillUpdate(nextProps, nextState) {
	  try {
	    var prevProps = this.props;
	    var prevState = this.state;
	    this.props = nextProps;
	    this.state = nextState;
	    this.__reactInternalSnapshotFlag = true;
	    this.__reactInternalSnapshot = this.getSnapshotBeforeUpdate(
	      prevProps,
	      prevState
	    );
	  } finally {
	    this.props = prevProps;
	    this.state = prevState;
	  }
	}

	// React may warn about cWM/cWRP/cWU methods being deprecated.
	// Add a flag to suppress these warnings for this special case.
	componentWillMount.__suppressDeprecationWarning = true;
	componentWillReceiveProps.__suppressDeprecationWarning = true;
	componentWillUpdate.__suppressDeprecationWarning = true;

	function polyfill(Component) {
	  var prototype = Component.prototype;

	  if (!prototype || !prototype.isReactComponent) {
	    throw new Error('Can only polyfill class components');
	  }

	  if (
	    typeof Component.getDerivedStateFromProps !== 'function' &&
	    typeof prototype.getSnapshotBeforeUpdate !== 'function'
	  ) {
	    return Component;
	  }

	  // If new component APIs are defined, "unsafe" lifecycles won't be called.
	  // Error if any of these lifecycles are present,
	  // Because they would work differently between older and newer (16.3+) versions of React.
	  var foundWillMountName = null;
	  var foundWillReceivePropsName = null;
	  var foundWillUpdateName = null;
	  if (typeof prototype.componentWillMount === 'function') {
	    foundWillMountName = 'componentWillMount';
	  } else if (typeof prototype.UNSAFE_componentWillMount === 'function') {
	    foundWillMountName = 'UNSAFE_componentWillMount';
	  }
	  if (typeof prototype.componentWillReceiveProps === 'function') {
	    foundWillReceivePropsName = 'componentWillReceiveProps';
	  } else if (typeof prototype.UNSAFE_componentWillReceiveProps === 'function') {
	    foundWillReceivePropsName = 'UNSAFE_componentWillReceiveProps';
	  }
	  if (typeof prototype.componentWillUpdate === 'function') {
	    foundWillUpdateName = 'componentWillUpdate';
	  } else if (typeof prototype.UNSAFE_componentWillUpdate === 'function') {
	    foundWillUpdateName = 'UNSAFE_componentWillUpdate';
	  }
	  if (
	    foundWillMountName !== null ||
	    foundWillReceivePropsName !== null ||
	    foundWillUpdateName !== null
	  ) {
	    var componentName = Component.displayName || Component.name;
	    var newApiName =
	      typeof Component.getDerivedStateFromProps === 'function'
	        ? 'getDerivedStateFromProps()'
	        : 'getSnapshotBeforeUpdate()';

	    throw Error(
	      'Unsafe legacy lifecycles will not be called for components using new component APIs.\n\n' +
	        componentName +
	        ' uses ' +
	        newApiName +
	        ' but also contains the following legacy lifecycles:' +
	        (foundWillMountName !== null ? '\n  ' + foundWillMountName : '') +
	        (foundWillReceivePropsName !== null
	          ? '\n  ' + foundWillReceivePropsName
	          : '') +
	        (foundWillUpdateName !== null ? '\n  ' + foundWillUpdateName : '') +
	        '\n\nThe above lifecycles should be removed. Learn more about this warning here:\n' +
	        'https://fb.me/react-async-component-lifecycle-hooks'
	    );
	  }

	  // React <= 16.2 does not support static getDerivedStateFromProps.
	  // As a workaround, use cWM and cWRP to invoke the new static lifecycle.
	  // Newer versions of React will ignore these lifecycles if gDSFP exists.
	  if (typeof Component.getDerivedStateFromProps === 'function') {
	    prototype.componentWillMount = componentWillMount;
	    prototype.componentWillReceiveProps = componentWillReceiveProps;
	  }

	  // React <= 16.2 does not support getSnapshotBeforeUpdate.
	  // As a workaround, use cWU to invoke the new lifecycle.
	  // Newer versions of React will ignore that lifecycle if gSBU exists.
	  if (typeof prototype.getSnapshotBeforeUpdate === 'function') {
	    if (typeof prototype.componentDidUpdate !== 'function') {
	      throw new Error(
	        'Cannot polyfill getSnapshotBeforeUpdate() for components that do not define componentDidUpdate() on the prototype'
	      );
	    }

	    prototype.componentWillUpdate = componentWillUpdate;

	    var componentDidUpdate = prototype.componentDidUpdate;

	    prototype.componentDidUpdate = function componentDidUpdatePolyfill(
	      prevProps,
	      prevState,
	      maybeSnapshot
	    ) {
	      // 16.3+ will not execute our will-update method;
	      // It will pass a snapshot value to did-update though.
	      // Older versions will require our polyfilled will-update value.
	      // We need to handle both cases, but can't just check for the presence of "maybeSnapshot",
	      // Because for <= 15.x versions this might be a "prevContext" object.
	      // We also can't just check "__reactInternalSnapshot",
	      // Because get-snapshot might return a falsy value.
	      // So check for the explicit __reactInternalSnapshotFlag flag to determine behavior.
	      var snapshot = this.__reactInternalSnapshotFlag
	        ? this.__reactInternalSnapshot
	        : maybeSnapshot;

	      componentDidUpdate.call(this, prevProps, prevState, snapshot);
	    };
	  }

	  return Component;
	}

	var frame = 0, // is an animation frame pending?
	    timeout = 0, // is a timeout pending?
	    interval = 0, // are any timers active?
	    pokeDelay = 1000, // how frequently we check for clock skew
	    taskHead,
	    taskTail,
	    clockLast = 0,
	    clockNow = 0,
	    clockSkew = 0,
	    clock = typeof performance === "object" && performance.now ? performance : Date,
	    setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f) { setTimeout(f, 17); };

	function now() {
	  return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
	}

	function clearNow() {
	  clockNow = 0;
	}

	function Timer() {
	  this._call =
	  this._time =
	  this._next = null;
	}

	Timer.prototype = timer.prototype = {
	  constructor: Timer,
	  restart: function(callback, delay, time) {
	    if (typeof callback !== "function") throw new TypeError("callback is not a function");
	    time = (time == null ? now() : +time) + (delay == null ? 0 : +delay);
	    if (!this._next && taskTail !== this) {
	      if (taskTail) taskTail._next = this;
	      else taskHead = this;
	      taskTail = this;
	    }
	    this._call = callback;
	    this._time = time;
	    sleep();
	  },
	  stop: function() {
	    if (this._call) {
	      this._call = null;
	      this._time = Infinity;
	      sleep();
	    }
	  }
	};

	function timer(callback, delay, time) {
	  var t = new Timer;
	  t.restart(callback, delay, time);
	  return t;
	}

	function timerFlush() {
	  now(); // Get the current time, if not already set.
	  ++frame; // Pretend we’ve set an alarm, if we haven’t already.
	  var t = taskHead, e;
	  while (t) {
	    if ((e = clockNow - t._time) >= 0) t._call.call(null, e);
	    t = t._next;
	  }
	  --frame;
	}

	function wake() {
	  clockNow = (clockLast = clock.now()) + clockSkew;
	  frame = timeout = 0;
	  try {
	    timerFlush();
	  } finally {
	    frame = 0;
	    nap();
	    clockNow = 0;
	  }
	}

	function poke() {
	  var now = clock.now(), delay = now - clockLast;
	  if (delay > pokeDelay) clockSkew -= delay, clockLast = now;
	}

	function nap() {
	  var t0, t1 = taskHead, t2, time = Infinity;
	  while (t1) {
	    if (t1._call) {
	      if (time > t1._time) time = t1._time;
	      t0 = t1, t1 = t1._next;
	    } else {
	      t2 = t1._next, t1._next = null;
	      t1 = t0 ? t0._next = t2 : taskHead = t2;
	    }
	  }
	  taskTail = t0;
	  sleep(time);
	}

	function sleep(time) {
	  if (frame) return; // Soonest alarm already set, or will be.
	  if (timeout) timeout = clearTimeout(timeout);
	  var delay = time - clockNow; // Strictly less than if we recomputed clockNow.
	  if (delay > 24) {
	    if (time < Infinity) timeout = setTimeout(wake, time - clock.now() - clockSkew);
	    if (interval) interval = clearInterval(interval);
	  } else {
	    if (!interval) clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
	    frame = 1, setFrame(wake);
	  }
	}

	function timeout$1(callback, delay, time) {
	  var t = new Timer;
	  delay = delay == null ? 0 : +delay;
	  t.restart(function(elapsed) {
	    t.stop();
	    callback(elapsed + delay);
	  }, delay, time);
	  return t;
	}

	function interval$1(callback, delay, time) {
	  var t = new Timer, total = delay;
	  if (delay == null) return t.restart(callback, delay, time), t;
	  delay = +delay, time = time == null ? now() : +time;
	  t.restart(function tick(elapsed) {
	    elapsed += total;
	    t.restart(tick, total += delay, time);
	    callback(elapsed);
	  }, delay, time);
	  return t;
	}

	function extend(obj, props) {
	  for (const i in props) {
	    obj[i] = props[i]; // eslint-disable-line no-param-reassign
	  }

	  return obj;
	}

	function Node(key, data, type) {
	  this.key = key;
	  this.data = data;
	  this.type = type;
	  this.state = {};
	}

	extend(Node.prototype, {
	  setState(state) {
	    const s = this.state;
	    extend(s, typeof state === 'function' ? state(s) : state);
	  },

	  updateData(data) {
	    this.data = data;
	    return this;
	  },

	  updateType(type) {
	    this.type = type;
	    return this;
	  }

	});

	/* based on react-motion's mergeDiff (https://github.com/chenglou/react-motion) */
	function mergeKeys(currNodeKeys, currKeyIndex, nextNodeKeys, nextKeyIndex) {
	  const allKeys = [];

	  for (let i = 0; i < nextNodeKeys.length; i++) {
	    allKeys[i] = nextNodeKeys[i];
	  }

	  for (let i = 0; i < currNodeKeys.length; i++) {
	    if (nextKeyIndex[currNodeKeys[i]] === undefined) {
	      allKeys.push(currNodeKeys[i]);
	    }
	  }

	  return allKeys.sort((a, b) => {
	    const nextOrderA = nextKeyIndex[a];
	    const nextOrderB = nextKeyIndex[b];
	    const currOrderA = currKeyIndex[a];
	    const currOrderB = currKeyIndex[b];

	    if (nextOrderA != null && nextOrderB != null) {
	      return nextKeyIndex[a] - nextKeyIndex[b];
	    } else if (currOrderA != null && currOrderB != null) {
	      return currKeyIndex[a] - currKeyIndex[b];
	    } else if (nextOrderA != null) {
	      for (let i = 0; i < nextNodeKeys.length; i++) {
	        const pivot = nextNodeKeys[i];

	        if (!currKeyIndex[pivot]) {
	          continue;
	        }

	        if (nextOrderA < nextKeyIndex[pivot] && currOrderB > currKeyIndex[pivot]) {
	          return -1;
	        } else if (nextOrderA > nextKeyIndex[pivot] && currOrderB < currKeyIndex[pivot]) {
	          return 1;
	        }
	      }

	      return 1;
	    }

	    for (let i = 0; i < nextNodeKeys.length; i++) {
	      const pivot = nextNodeKeys[i];

	      if (!currKeyIndex[pivot]) {
	        continue;
	      }

	      if (nextOrderB < nextKeyIndex[pivot] && currOrderA > currKeyIndex[pivot]) {
	        return 1;
	      } else if (nextOrderB > nextKeyIndex[pivot] && currOrderA < currKeyIndex[pivot]) {
	        return -1;
	      }
	    }

	    return -1;
	  });
	}

	const ENTER = 'ENTER';
	const UPDATE = 'UPDATE';
	const LEAVE = 'LEAVE';

	function define(constructor, factory, prototype) {
	  constructor.prototype = factory.prototype = prototype;
	  prototype.constructor = constructor;
	}

	function extend$1(parent, definition) {
	  var prototype = Object.create(parent.prototype);
	  for (var key in definition) prototype[key] = definition[key];
	  return prototype;
	}

	function Color() {}

	var darker = 0.7;
	var brighter = 1 / darker;

	var reI = "\\s*([+-]?\\d+)\\s*",
	    reN = "\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)\\s*",
	    reP = "\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)%\\s*",
	    reHex3 = /^#([0-9a-f]{3})$/,
	    reHex6 = /^#([0-9a-f]{6})$/,
	    reRgbInteger = new RegExp("^rgb\\(" + [reI, reI, reI] + "\\)$"),
	    reRgbPercent = new RegExp("^rgb\\(" + [reP, reP, reP] + "\\)$"),
	    reRgbaInteger = new RegExp("^rgba\\(" + [reI, reI, reI, reN] + "\\)$"),
	    reRgbaPercent = new RegExp("^rgba\\(" + [reP, reP, reP, reN] + "\\)$"),
	    reHslPercent = new RegExp("^hsl\\(" + [reN, reP, reP] + "\\)$"),
	    reHslaPercent = new RegExp("^hsla\\(" + [reN, reP, reP, reN] + "\\)$");

	var named = {
	  aliceblue: 0xf0f8ff,
	  antiquewhite: 0xfaebd7,
	  aqua: 0x00ffff,
	  aquamarine: 0x7fffd4,
	  azure: 0xf0ffff,
	  beige: 0xf5f5dc,
	  bisque: 0xffe4c4,
	  black: 0x000000,
	  blanchedalmond: 0xffebcd,
	  blue: 0x0000ff,
	  blueviolet: 0x8a2be2,
	  brown: 0xa52a2a,
	  burlywood: 0xdeb887,
	  cadetblue: 0x5f9ea0,
	  chartreuse: 0x7fff00,
	  chocolate: 0xd2691e,
	  coral: 0xff7f50,
	  cornflowerblue: 0x6495ed,
	  cornsilk: 0xfff8dc,
	  crimson: 0xdc143c,
	  cyan: 0x00ffff,
	  darkblue: 0x00008b,
	  darkcyan: 0x008b8b,
	  darkgoldenrod: 0xb8860b,
	  darkgray: 0xa9a9a9,
	  darkgreen: 0x006400,
	  darkgrey: 0xa9a9a9,
	  darkkhaki: 0xbdb76b,
	  darkmagenta: 0x8b008b,
	  darkolivegreen: 0x556b2f,
	  darkorange: 0xff8c00,
	  darkorchid: 0x9932cc,
	  darkred: 0x8b0000,
	  darksalmon: 0xe9967a,
	  darkseagreen: 0x8fbc8f,
	  darkslateblue: 0x483d8b,
	  darkslategray: 0x2f4f4f,
	  darkslategrey: 0x2f4f4f,
	  darkturquoise: 0x00ced1,
	  darkviolet: 0x9400d3,
	  deeppink: 0xff1493,
	  deepskyblue: 0x00bfff,
	  dimgray: 0x696969,
	  dimgrey: 0x696969,
	  dodgerblue: 0x1e90ff,
	  firebrick: 0xb22222,
	  floralwhite: 0xfffaf0,
	  forestgreen: 0x228b22,
	  fuchsia: 0xff00ff,
	  gainsboro: 0xdcdcdc,
	  ghostwhite: 0xf8f8ff,
	  gold: 0xffd700,
	  goldenrod: 0xdaa520,
	  gray: 0x808080,
	  green: 0x008000,
	  greenyellow: 0xadff2f,
	  grey: 0x808080,
	  honeydew: 0xf0fff0,
	  hotpink: 0xff69b4,
	  indianred: 0xcd5c5c,
	  indigo: 0x4b0082,
	  ivory: 0xfffff0,
	  khaki: 0xf0e68c,
	  lavender: 0xe6e6fa,
	  lavenderblush: 0xfff0f5,
	  lawngreen: 0x7cfc00,
	  lemonchiffon: 0xfffacd,
	  lightblue: 0xadd8e6,
	  lightcoral: 0xf08080,
	  lightcyan: 0xe0ffff,
	  lightgoldenrodyellow: 0xfafad2,
	  lightgray: 0xd3d3d3,
	  lightgreen: 0x90ee90,
	  lightgrey: 0xd3d3d3,
	  lightpink: 0xffb6c1,
	  lightsalmon: 0xffa07a,
	  lightseagreen: 0x20b2aa,
	  lightskyblue: 0x87cefa,
	  lightslategray: 0x778899,
	  lightslategrey: 0x778899,
	  lightsteelblue: 0xb0c4de,
	  lightyellow: 0xffffe0,
	  lime: 0x00ff00,
	  limegreen: 0x32cd32,
	  linen: 0xfaf0e6,
	  magenta: 0xff00ff,
	  maroon: 0x800000,
	  mediumaquamarine: 0x66cdaa,
	  mediumblue: 0x0000cd,
	  mediumorchid: 0xba55d3,
	  mediumpurple: 0x9370db,
	  mediumseagreen: 0x3cb371,
	  mediumslateblue: 0x7b68ee,
	  mediumspringgreen: 0x00fa9a,
	  mediumturquoise: 0x48d1cc,
	  mediumvioletred: 0xc71585,
	  midnightblue: 0x191970,
	  mintcream: 0xf5fffa,
	  mistyrose: 0xffe4e1,
	  moccasin: 0xffe4b5,
	  navajowhite: 0xffdead,
	  navy: 0x000080,
	  oldlace: 0xfdf5e6,
	  olive: 0x808000,
	  olivedrab: 0x6b8e23,
	  orange: 0xffa500,
	  orangered: 0xff4500,
	  orchid: 0xda70d6,
	  palegoldenrod: 0xeee8aa,
	  palegreen: 0x98fb98,
	  paleturquoise: 0xafeeee,
	  palevioletred: 0xdb7093,
	  papayawhip: 0xffefd5,
	  peachpuff: 0xffdab9,
	  peru: 0xcd853f,
	  pink: 0xffc0cb,
	  plum: 0xdda0dd,
	  powderblue: 0xb0e0e6,
	  purple: 0x800080,
	  rebeccapurple: 0x663399,
	  red: 0xff0000,
	  rosybrown: 0xbc8f8f,
	  royalblue: 0x4169e1,
	  saddlebrown: 0x8b4513,
	  salmon: 0xfa8072,
	  sandybrown: 0xf4a460,
	  seagreen: 0x2e8b57,
	  seashell: 0xfff5ee,
	  sienna: 0xa0522d,
	  silver: 0xc0c0c0,
	  skyblue: 0x87ceeb,
	  slateblue: 0x6a5acd,
	  slategray: 0x708090,
	  slategrey: 0x708090,
	  snow: 0xfffafa,
	  springgreen: 0x00ff7f,
	  steelblue: 0x4682b4,
	  tan: 0xd2b48c,
	  teal: 0x008080,
	  thistle: 0xd8bfd8,
	  tomato: 0xff6347,
	  turquoise: 0x40e0d0,
	  violet: 0xee82ee,
	  wheat: 0xf5deb3,
	  white: 0xffffff,
	  whitesmoke: 0xf5f5f5,
	  yellow: 0xffff00,
	  yellowgreen: 0x9acd32
	};

	define(Color, color, {
	  displayable: function() {
	    return this.rgb().displayable();
	  },
	  hex: function() {
	    return this.rgb().hex();
	  },
	  toString: function() {
	    return this.rgb() + "";
	  }
	});

	function color(format) {
	  var m;
	  format = (format + "").trim().toLowerCase();
	  return (m = reHex3.exec(format)) ? (m = parseInt(m[1], 16), new Rgb((m >> 8 & 0xf) | (m >> 4 & 0x0f0), (m >> 4 & 0xf) | (m & 0xf0), ((m & 0xf) << 4) | (m & 0xf), 1)) // #f00
	      : (m = reHex6.exec(format)) ? rgbn(parseInt(m[1], 16)) // #ff0000
	      : (m = reRgbInteger.exec(format)) ? new Rgb(m[1], m[2], m[3], 1) // rgb(255, 0, 0)
	      : (m = reRgbPercent.exec(format)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) // rgb(100%, 0%, 0%)
	      : (m = reRgbaInteger.exec(format)) ? rgba(m[1], m[2], m[3], m[4]) // rgba(255, 0, 0, 1)
	      : (m = reRgbaPercent.exec(format)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) // rgb(100%, 0%, 0%, 1)
	      : (m = reHslPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) // hsl(120, 50%, 50%)
	      : (m = reHslaPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) // hsla(120, 50%, 50%, 1)
	      : named.hasOwnProperty(format) ? rgbn(named[format])
	      : format === "transparent" ? new Rgb(NaN, NaN, NaN, 0)
	      : null;
	}

	function rgbn(n) {
	  return new Rgb(n >> 16 & 0xff, n >> 8 & 0xff, n & 0xff, 1);
	}

	function rgba(r, g, b, a) {
	  if (a <= 0) r = g = b = NaN;
	  return new Rgb(r, g, b, a);
	}

	function rgbConvert(o) {
	  if (!(o instanceof Color)) o = color(o);
	  if (!o) return new Rgb;
	  o = o.rgb();
	  return new Rgb(o.r, o.g, o.b, o.opacity);
	}

	function rgb(r, g, b, opacity) {
	  return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
	}

	function Rgb(r, g, b, opacity) {
	  this.r = +r;
	  this.g = +g;
	  this.b = +b;
	  this.opacity = +opacity;
	}

	define(Rgb, rgb, extend$1(Color, {
	  brighter: function(k) {
	    k = k == null ? brighter : Math.pow(brighter, k);
	    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
	  },
	  darker: function(k) {
	    k = k == null ? darker : Math.pow(darker, k);
	    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
	  },
	  rgb: function() {
	    return this;
	  },
	  displayable: function() {
	    return (0 <= this.r && this.r <= 255)
	        && (0 <= this.g && this.g <= 255)
	        && (0 <= this.b && this.b <= 255)
	        && (0 <= this.opacity && this.opacity <= 1);
	  },
	  hex: function() {
	    return "#" + hex(this.r) + hex(this.g) + hex(this.b);
	  },
	  toString: function() {
	    var a = this.opacity; a = isNaN(a) ? 1 : Math.max(0, Math.min(1, a));
	    return (a === 1 ? "rgb(" : "rgba(")
	        + Math.max(0, Math.min(255, Math.round(this.r) || 0)) + ", "
	        + Math.max(0, Math.min(255, Math.round(this.g) || 0)) + ", "
	        + Math.max(0, Math.min(255, Math.round(this.b) || 0))
	        + (a === 1 ? ")" : ", " + a + ")");
	  }
	}));

	function hex(value) {
	  value = Math.max(0, Math.min(255, Math.round(value) || 0));
	  return (value < 16 ? "0" : "") + value.toString(16);
	}

	function hsla(h, s, l, a) {
	  if (a <= 0) h = s = l = NaN;
	  else if (l <= 0 || l >= 1) h = s = NaN;
	  else if (s <= 0) h = NaN;
	  return new Hsl(h, s, l, a);
	}

	function hslConvert(o) {
	  if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
	  if (!(o instanceof Color)) o = color(o);
	  if (!o) return new Hsl;
	  if (o instanceof Hsl) return o;
	  o = o.rgb();
	  var r = o.r / 255,
	      g = o.g / 255,
	      b = o.b / 255,
	      min = Math.min(r, g, b),
	      max = Math.max(r, g, b),
	      h = NaN,
	      s = max - min,
	      l = (max + min) / 2;
	  if (s) {
	    if (r === max) h = (g - b) / s + (g < b) * 6;
	    else if (g === max) h = (b - r) / s + 2;
	    else h = (r - g) / s + 4;
	    s /= l < 0.5 ? max + min : 2 - max - min;
	    h *= 60;
	  } else {
	    s = l > 0 && l < 1 ? 0 : h;
	  }
	  return new Hsl(h, s, l, o.opacity);
	}

	function hsl(h, s, l, opacity) {
	  return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
	}

	function Hsl(h, s, l, opacity) {
	  this.h = +h;
	  this.s = +s;
	  this.l = +l;
	  this.opacity = +opacity;
	}

	define(Hsl, hsl, extend$1(Color, {
	  brighter: function(k) {
	    k = k == null ? brighter : Math.pow(brighter, k);
	    return new Hsl(this.h, this.s, this.l * k, this.opacity);
	  },
	  darker: function(k) {
	    k = k == null ? darker : Math.pow(darker, k);
	    return new Hsl(this.h, this.s, this.l * k, this.opacity);
	  },
	  rgb: function() {
	    var h = this.h % 360 + (this.h < 0) * 360,
	        s = isNaN(h) || isNaN(this.s) ? 0 : this.s,
	        l = this.l,
	        m2 = l + (l < 0.5 ? l : 1 - l) * s,
	        m1 = 2 * l - m2;
	    return new Rgb(
	      hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
	      hsl2rgb(h, m1, m2),
	      hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2),
	      this.opacity
	    );
	  },
	  displayable: function() {
	    return (0 <= this.s && this.s <= 1 || isNaN(this.s))
	        && (0 <= this.l && this.l <= 1)
	        && (0 <= this.opacity && this.opacity <= 1);
	  }
	}));

	/* From FvD 13.37, CSS Color Module Level 3 */
	function hsl2rgb(h, m1, m2) {
	  return (h < 60 ? m1 + (m2 - m1) * h / 60
	      : h < 180 ? m2
	      : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60
	      : m1) * 255;
	}

	var deg2rad = Math.PI / 180;
	var rad2deg = 180 / Math.PI;

	// https://beta.observablehq.com/@mbostock/lab-and-rgb
	var K = 18,
	    Xn = 0.96422,
	    Yn = 1,
	    Zn = 0.82521,
	    t0 = 4 / 29,
	    t1 = 6 / 29,
	    t2 = 3 * t1 * t1,
	    t3 = t1 * t1 * t1;

	function labConvert(o) {
	  if (o instanceof Lab) return new Lab(o.l, o.a, o.b, o.opacity);
	  if (o instanceof Hcl) {
	    if (isNaN(o.h)) return new Lab(o.l, 0, 0, o.opacity);
	    var h = o.h * deg2rad;
	    return new Lab(o.l, Math.cos(h) * o.c, Math.sin(h) * o.c, o.opacity);
	  }
	  if (!(o instanceof Rgb)) o = rgbConvert(o);
	  var r = rgb2lrgb(o.r),
	      g = rgb2lrgb(o.g),
	      b = rgb2lrgb(o.b),
	      y = xyz2lab((0.2225045 * r + 0.7168786 * g + 0.0606169 * b) / Yn), x, z;
	  if (r === g && g === b) x = z = y; else {
	    x = xyz2lab((0.4360747 * r + 0.3850649 * g + 0.1430804 * b) / Xn);
	    z = xyz2lab((0.0139322 * r + 0.0971045 * g + 0.7141733 * b) / Zn);
	  }
	  return new Lab(116 * y - 16, 500 * (x - y), 200 * (y - z), o.opacity);
	}

	function lab(l, a, b, opacity) {
	  return arguments.length === 1 ? labConvert(l) : new Lab(l, a, b, opacity == null ? 1 : opacity);
	}

	function Lab(l, a, b, opacity) {
	  this.l = +l;
	  this.a = +a;
	  this.b = +b;
	  this.opacity = +opacity;
	}

	define(Lab, lab, extend$1(Color, {
	  brighter: function(k) {
	    return new Lab(this.l + K * (k == null ? 1 : k), this.a, this.b, this.opacity);
	  },
	  darker: function(k) {
	    return new Lab(this.l - K * (k == null ? 1 : k), this.a, this.b, this.opacity);
	  },
	  rgb: function() {
	    var y = (this.l + 16) / 116,
	        x = isNaN(this.a) ? y : y + this.a / 500,
	        z = isNaN(this.b) ? y : y - this.b / 200;
	    x = Xn * lab2xyz(x);
	    y = Yn * lab2xyz(y);
	    z = Zn * lab2xyz(z);
	    return new Rgb(
	      lrgb2rgb( 3.1338561 * x - 1.6168667 * y - 0.4906146 * z),
	      lrgb2rgb(-0.9787684 * x + 1.9161415 * y + 0.0334540 * z),
	      lrgb2rgb( 0.0719453 * x - 0.2289914 * y + 1.4052427 * z),
	      this.opacity
	    );
	  }
	}));

	function xyz2lab(t) {
	  return t > t3 ? Math.pow(t, 1 / 3) : t / t2 + t0;
	}

	function lab2xyz(t) {
	  return t > t1 ? t * t * t : t2 * (t - t0);
	}

	function lrgb2rgb(x) {
	  return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
	}

	function rgb2lrgb(x) {
	  return (x /= 255) <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
	}

	function hclConvert(o) {
	  if (o instanceof Hcl) return new Hcl(o.h, o.c, o.l, o.opacity);
	  if (!(o instanceof Lab)) o = labConvert(o);
	  if (o.a === 0 && o.b === 0) return new Hcl(NaN, 0, o.l, o.opacity);
	  var h = Math.atan2(o.b, o.a) * rad2deg;
	  return new Hcl(h < 0 ? h + 360 : h, Math.sqrt(o.a * o.a + o.b * o.b), o.l, o.opacity);
	}

	function hcl(h, c, l, opacity) {
	  return arguments.length === 1 ? hclConvert(h) : new Hcl(h, c, l, opacity == null ? 1 : opacity);
	}

	function Hcl(h, c, l, opacity) {
	  this.h = +h;
	  this.c = +c;
	  this.l = +l;
	  this.opacity = +opacity;
	}

	define(Hcl, hcl, extend$1(Color, {
	  brighter: function(k) {
	    return new Hcl(this.h, this.c, this.l + K * (k == null ? 1 : k), this.opacity);
	  },
	  darker: function(k) {
	    return new Hcl(this.h, this.c, this.l - K * (k == null ? 1 : k), this.opacity);
	  },
	  rgb: function() {
	    return labConvert(this).rgb();
	  }
	}));

	var A = -0.14861,
	    B = +1.78277,
	    C = -0.29227,
	    D = -0.90649,
	    E = +1.97294,
	    ED = E * D,
	    EB = E * B,
	    BC_DA = B * C - D * A;

	function cubehelixConvert(o) {
	  if (o instanceof Cubehelix) return new Cubehelix(o.h, o.s, o.l, o.opacity);
	  if (!(o instanceof Rgb)) o = rgbConvert(o);
	  var r = o.r / 255,
	      g = o.g / 255,
	      b = o.b / 255,
	      l = (BC_DA * b + ED * r - EB * g) / (BC_DA + ED - EB),
	      bl = b - l,
	      k = (E * (g - l) - C * bl) / D,
	      s = Math.sqrt(k * k + bl * bl) / (E * l * (1 - l)), // NaN if l=0 or l=1
	      h = s ? Math.atan2(k, bl) * rad2deg - 120 : NaN;
	  return new Cubehelix(h < 0 ? h + 360 : h, s, l, o.opacity);
	}

	function cubehelix(h, s, l, opacity) {
	  return arguments.length === 1 ? cubehelixConvert(h) : new Cubehelix(h, s, l, opacity == null ? 1 : opacity);
	}

	function Cubehelix(h, s, l, opacity) {
	  this.h = +h;
	  this.s = +s;
	  this.l = +l;
	  this.opacity = +opacity;
	}

	define(Cubehelix, cubehelix, extend$1(Color, {
	  brighter: function(k) {
	    k = k == null ? brighter : Math.pow(brighter, k);
	    return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
	  },
	  darker: function(k) {
	    k = k == null ? darker : Math.pow(darker, k);
	    return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
	  },
	  rgb: function() {
	    var h = isNaN(this.h) ? 0 : (this.h + 120) * deg2rad,
	        l = +this.l,
	        a = isNaN(this.s) ? 0 : this.s * l * (1 - l),
	        cosh = Math.cos(h),
	        sinh = Math.sin(h);
	    return new Rgb(
	      255 * (l + a * (A * cosh + B * sinh)),
	      255 * (l + a * (C * cosh + D * sinh)),
	      255 * (l + a * (E * cosh)),
	      this.opacity
	    );
	  }
	}));

	function constant(x) {
	  return function() {
	    return x;
	  };
	}

	function linear(a, d) {
	  return function(t) {
	    return a + t * d;
	  };
	}

	function exponential(a, b, y) {
	  return a = Math.pow(a, y), b = Math.pow(b, y) - a, y = 1 / y, function(t) {
	    return Math.pow(a + t * b, y);
	  };
	}

	function gamma(y) {
	  return (y = +y) === 1 ? nogamma : function(a, b) {
	    return b - a ? exponential(a, b, y) : constant(isNaN(a) ? b : a);
	  };
	}

	function nogamma(a, b) {
	  var d = b - a;
	  return d ? linear(a, d) : constant(isNaN(a) ? b : a);
	}

	var rgb$1 = (function rgbGamma(y) {
	  var color$$1 = gamma(y);

	  function rgb$$1(start, end) {
	    var r = color$$1((start = rgb(start)).r, (end = rgb(end)).r),
	        g = color$$1(start.g, end.g),
	        b = color$$1(start.b, end.b),
	        opacity = nogamma(start.opacity, end.opacity);
	    return function(t) {
	      start.r = r(t);
	      start.g = g(t);
	      start.b = b(t);
	      start.opacity = opacity(t);
	      return start + "";
	    };
	  }

	  rgb$$1.gamma = rgbGamma;

	  return rgb$$1;
	})(1);

	function array(a, b) {
	  var nb = b ? b.length : 0,
	      na = a ? Math.min(nb, a.length) : 0,
	      x = new Array(na),
	      c = new Array(nb),
	      i;

	  for (i = 0; i < na; ++i) x[i] = value(a[i], b[i]);
	  for (; i < nb; ++i) c[i] = b[i];

	  return function(t) {
	    for (i = 0; i < na; ++i) c[i] = x[i](t);
	    return c;
	  };
	}

	function date(a, b) {
	  var d = new Date;
	  return a = +a, b -= a, function(t) {
	    return d.setTime(a + b * t), d;
	  };
	}

	function number(a, b) {
	  return a = +a, b -= a, function(t) {
	    return a + b * t;
	  };
	}

	function object(a, b) {
	  var i = {},
	      c = {},
	      k;

	  if (a === null || typeof a !== "object") a = {};
	  if (b === null || typeof b !== "object") b = {};

	  for (k in b) {
	    if (k in a) {
	      i[k] = value(a[k], b[k]);
	    } else {
	      c[k] = b[k];
	    }
	  }

	  return function(t) {
	    for (k in i) c[k] = i[k](t);
	    return c;
	  };
	}

	var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g,
	    reB = new RegExp(reA.source, "g");

	function zero(b) {
	  return function() {
	    return b;
	  };
	}

	function one(b) {
	  return function(t) {
	    return b(t) + "";
	  };
	}

	function string(a, b) {
	  var bi = reA.lastIndex = reB.lastIndex = 0, // scan index for next number in b
	      am, // current match in a
	      bm, // current match in b
	      bs, // string preceding current number in b, if any
	      i = -1, // index in s
	      s = [], // string constants and placeholders
	      q = []; // number interpolators

	  // Coerce inputs to strings.
	  a = a + "", b = b + "";

	  // Interpolate pairs of numbers in a & b.
	  while ((am = reA.exec(a))
	      && (bm = reB.exec(b))) {
	    if ((bs = bm.index) > bi) { // a string precedes the next number in b
	      bs = b.slice(bi, bs);
	      if (s[i]) s[i] += bs; // coalesce with previous string
	      else s[++i] = bs;
	    }
	    if ((am = am[0]) === (bm = bm[0])) { // numbers in a & b match
	      if (s[i]) s[i] += bm; // coalesce with previous string
	      else s[++i] = bm;
	    } else { // interpolate non-matching numbers
	      s[++i] = null;
	      q.push({i: i, x: number(am, bm)});
	    }
	    bi = reB.lastIndex;
	  }

	  // Add remains of b.
	  if (bi < b.length) {
	    bs = b.slice(bi);
	    if (s[i]) s[i] += bs; // coalesce with previous string
	    else s[++i] = bs;
	  }

	  // Special optimization for only a single match.
	  // Otherwise, interpolate each of the numbers and rejoin the string.
	  return s.length < 2 ? (q[0]
	      ? one(q[0].x)
	      : zero(b))
	      : (b = q.length, function(t) {
	          for (var i = 0, o; i < b; ++i) s[(o = q[i]).i] = o.x(t);
	          return s.join("");
	        });
	}

	function value(a, b) {
	  var t = typeof b, c;
	  return b == null || t === "boolean" ? constant(b)
	      : (t === "number" ? number
	      : t === "string" ? ((c = color(b)) ? (b = c, rgb$1) : string)
	      : b instanceof color ? rgb$1
	      : b instanceof Date ? date
	      : Array.isArray(b) ? array
	      : typeof b.valueOf !== "function" && typeof b.toString !== "function" || isNaN(b) ? object
	      : number)(a, b);
	}

	var degrees = 180 / Math.PI;

	var identity = {
	  translateX: 0,
	  translateY: 0,
	  rotate: 0,
	  skewX: 0,
	  scaleX: 1,
	  scaleY: 1
	};

	function decompose(a, b, c, d, e, f) {
	  var scaleX, scaleY, skewX;
	  if (scaleX = Math.sqrt(a * a + b * b)) a /= scaleX, b /= scaleX;
	  if (skewX = a * c + b * d) c -= a * skewX, d -= b * skewX;
	  if (scaleY = Math.sqrt(c * c + d * d)) c /= scaleY, d /= scaleY, skewX /= scaleY;
	  if (a * d < b * c) a = -a, b = -b, skewX = -skewX, scaleX = -scaleX;
	  return {
	    translateX: e,
	    translateY: f,
	    rotate: Math.atan2(b, a) * degrees,
	    skewX: Math.atan(skewX) * degrees,
	    scaleX: scaleX,
	    scaleY: scaleY
	  };
	}

	var svgNode;

	function parseSvg(value) {
	  if (value == null) return identity;
	  if (!svgNode) svgNode = document.createElementNS("http://www.w3.org/2000/svg", "g");
	  svgNode.setAttribute("transform", value);
	  if (!(value = svgNode.transform.baseVal.consolidate())) return identity;
	  value = value.matrix;
	  return decompose(value.a, value.b, value.c, value.d, value.e, value.f);
	}

	function interpolateTransform(parse, pxComma, pxParen, degParen) {

	  function pop(s) {
	    return s.length ? s.pop() + " " : "";
	  }

	  function translate(xa, ya, xb, yb, s, q) {
	    if (xa !== xb || ya !== yb) {
	      var i = s.push("translate(", null, pxComma, null, pxParen);
	      q.push({i: i - 4, x: number(xa, xb)}, {i: i - 2, x: number(ya, yb)});
	    } else if (xb || yb) {
	      s.push("translate(" + xb + pxComma + yb + pxParen);
	    }
	  }

	  function rotate(a, b, s, q) {
	    if (a !== b) {
	      if (a - b > 180) b += 360; else if (b - a > 180) a += 360; // shortest path
	      q.push({i: s.push(pop(s) + "rotate(", null, degParen) - 2, x: number(a, b)});
	    } else if (b) {
	      s.push(pop(s) + "rotate(" + b + degParen);
	    }
	  }

	  function skewX(a, b, s, q) {
	    if (a !== b) {
	      q.push({i: s.push(pop(s) + "skewX(", null, degParen) - 2, x: number(a, b)});
	    } else if (b) {
	      s.push(pop(s) + "skewX(" + b + degParen);
	    }
	  }

	  function scale(xa, ya, xb, yb, s, q) {
	    if (xa !== xb || ya !== yb) {
	      var i = s.push(pop(s) + "scale(", null, ",", null, ")");
	      q.push({i: i - 4, x: number(xa, xb)}, {i: i - 2, x: number(ya, yb)});
	    } else if (xb !== 1 || yb !== 1) {
	      s.push(pop(s) + "scale(" + xb + "," + yb + ")");
	    }
	  }

	  return function(a, b) {
	    var s = [], // string constants and placeholders
	        q = []; // number interpolators
	    a = parse(a), b = parse(b);
	    translate(a.translateX, a.translateY, b.translateX, b.translateY, s, q);
	    rotate(a.rotate, b.rotate, s, q);
	    skewX(a.skewX, b.skewX, s, q);
	    scale(a.scaleX, a.scaleY, b.scaleX, b.scaleY, s, q);
	    a = b = null; // gc
	    return function(t) {
	      var i = -1, n = q.length, o;
	      while (++i < n) s[(o = q[i]).i] = o.x(t);
	      return s.join("");
	    };
	  };
	}
	var interpolateTransformSvg = interpolateTransform(parseSvg, ", ", ")", ")");

	var rho = Math.SQRT2;

	function getInterpolator(attr) {
	  if (attr === 'transform') {
	    return interpolateTransformSvg;
	  }

	  return value;
	}

	function getTween(nameSpace, attr, value1) {
	  return function tween() {
	    const value0 = nameSpace ? this.state[nameSpace][attr] : this.state[attr];

	    if (value0 === value1) {
	      return null;
	    }

	    const i = getInterpolator(attr)(value0, value1);
	    let stateTween;

	    if (nameSpace === null) {
	      stateTween = t => {
	        this.setState(() => {
	          return {
	            [attr]: i(t)
	          };
	        });
	      };
	    } else {
	      stateTween = t => {
	        this.setState(state => {
	          return {
	            [nameSpace]: { ...state[nameSpace],
	              [attr]: i(t)
	            }
	          };
	        });
	      };
	    }

	    return stateTween;
	  };
	}

	function tween (nameSpace, attr, value$$1) {
	  return getTween.call(this, nameSpace, attr, value$$1);
	}

	// Apapted from https://github.com/d3/d3-transition/blob/master/src/transition/schedule.js
	const CREATED = 0;
	const SCHEDULED = 1;
	const STARTING = 2;
	const STARTED = 3;
	const RUNNING = 4;
	const ENDING = 5;
	const ENDED = 6;
	function schedule (node, stateKey, id, timing, tweens, events = {}) {
	  const schedules = node.TRANSITION_SCHEDULES;

	  if (!schedules) {
	    node.TRANSITION_SCHEDULES = {}; // eslint-disable-line no-param-reassign
	  } else if (id in schedules) {
	    return;
	  }

	  const config = {
	    stateKey,
	    events,
	    tweens,
	    ...timing,
	    timer: null,
	    state: CREATED
	  };
	  create(node, id, config);
	}

	function create(node, id, config) {
	  const schedules = node.TRANSITION_SCHEDULES; // Initialize the transition timer when the transition is created.
	  // Note the actual delay is not known until the first callback!

	  const transition = { ...config
	  };
	  const n = transition.tweens.length;
	  const tweens = new Array(n);
	  schedules[id] = transition;
	  transition.timer = timer(schedule, 0, transition.time);

	  function schedule(elapsed) {
	    transition.state = SCHEDULED;
	    transition.timer.restart(start, transition.delay, transition.time); // If the elapsed delay is less than our first sleep, start immediately.

	    if (transition.delay <= elapsed) {
	      start(elapsed - transition.delay);
	    }
	  }

	  function start(elapsed) {
	    // eslint-disable-line consistent-return
	    // If the state is not SCHEDULED, then we previously errored on start.
	    if (transition.state !== SCHEDULED) return stop();

	    for (const sid in schedules) {
	      // eslint-disable-line
	      const s = schedules[sid];

	      if (s.stateKey !== transition.stateKey) {
	        continue; // eslint-disable-line no-continue
	      } // While this element already has a starting transition during this frame,
	      // defer starting an interrupting transition until that transition has a
	      // chance to tick (and possibly end); see d3/d3-transition#54!


	      if (s.state === STARTED) return timeout$1(start); // 1. Interrupt the active transition, if any. dispatch the interrupt event.
	      // 2. Cancel any pre-empted transitions. No interrupt event is dispatched
	      // because the cancelled transitions never started. Note that this also
	      // removes this transition from the pending list!

	      if (s.state === RUNNING) {
	        s.state = ENDED;
	        s.timer.stop();

	        if (s.events.interrupt && typeof s.events.interrupt === 'function') {
	          s.events.interrupt.call(this);
	        }

	        delete schedules[sid];
	      } else if (+sid < id) {
	        s.state = ENDED;
	        s.timer.stop();
	        delete schedules[sid];
	      }
	    } // Defer the first tick to end of the current frame; see d3/d3#1576.
	    // Note the transition may be canceled after start and before the first tick!
	    // Note this must be scheduled before the start event; see d3/d3-transition#16!
	    // Assuming this is successful, subsequent callbacks go straight to tick.


	    timeout$1(() => {
	      if (transition.state === STARTED) {
	        transition.state = RUNNING;
	        transition.timer.restart(tick, transition.delay, transition.time);
	        tick(elapsed);
	      }
	    });
	    transition.state = STARTING;

	    if (transition.events.start && typeof transition.events.start === 'function') {
	      transition.events.start.call(node);
	    }

	    if (transition.state !== STARTING) {
	      // interrupted
	      return; // eslint-disable-line consistent-return
	    }

	    transition.state = STARTED; // Initialize the tween, deleting null tween.

	    let j = -1;

	    for (let i = 0; i < n; ++i) {
	      const res = transition.tweens[i].call(node);

	      if (res) {
	        tweens[++j] = res;
	      }
	    }

	    tweens.length = j + 1;
	  }

	  function tick(elapsed) {
	    let t = 1;

	    if (elapsed < transition.duration) {
	      t = transition.ease.call(null, elapsed / transition.duration);
	    } else {
	      transition.timer.restart(stop);
	      transition.state = ENDING;
	    }

	    let i = -1;

	    while (++i < tweens.length) {
	      tweens[i].call(null, t);
	    }

	    if (transition.state === ENDING) {
	      if (transition.events.end && typeof transition.events.end === 'function') {
	        transition.events.end.call(node);
	      }

	      stop();
	    }
	  }

	  function stop() {
	    transition.state = ENDED;
	    transition.timer.stop();
	    delete schedules[id];

	    for (const i in schedules) return; // eslint-disable-line guard-for-in, no-restricted-syntax


	    delete node.TRANSITION_SCHEDULES; // eslint-disable-line no-param-reassign
	  }
	}

	function once(func) {
	  let called = false;
	  return function transitionEvent() {
	    if (!called) {
	      called = true;
	      func.call(this);
	    }
	  };
	}

	let id = 0;
	function newId() {
	  return ++id;
	} // from https://github.com/d3/d3-ease/blob/master/src/linear.js

	function linear$1(t) {
	  return +t;
	}

	const preset = {
	  time: null,
	  delay: 0,
	  duration: 250,
	  ease: linear$1
	};

	function scheduleTransitions(config = {}) {
	  const transitions = { ...config
	  };
	  const events = transitions.events || {};
	  delete transitions.events; // each event handler should be called only once

	  Object.keys(events).forEach(d => {
	    if (typeof events[d] !== 'function') {
	      throw new Error('Event handlers must be a function');
	    } else {
	      events[d] = once(events[d]);
	    }
	  });
	  const timing = transitions.timing || {};
	  delete transitions.timing;
	  Object.keys(transitions).forEach(stateKey => {
	    const tweens = [];

	    if (typeof transitions[stateKey] === 'object' && Array.isArray(transitions[stateKey]) === false) {
	      Object.keys(transitions[stateKey]).forEach(attr => {
	        const val = transitions[stateKey][attr];

	        if (Array.isArray(val)) {
	          if (val.length === 1) {
	            tweens.push(tween.call(this, stateKey, attr, val[0]));
	          } else {
	            this.setState(state => {
	              return {
	                [stateKey]: { ...state[stateKey],
	                  [attr]: val[0]
	                }
	              };
	            });
	            tweens.push(tween.call(this, stateKey, attr, val[1]));
	          }
	        } else if (typeof val === 'function') {
	          const getResonanceCustomTween = () => {
	            const resonanceCustomTween = t => {
	              this.setState(state => {
	                return {
	                  [stateKey]: { ...state[stateKey],
	                    [attr]: val(t)
	                  }
	                };
	              });
	            };

	            return resonanceCustomTween;
	          };

	          tweens.push(getResonanceCustomTween);
	        } else {
	          this.setState(state => {
	            return {
	              [stateKey]: { ...state[stateKey],
	                [attr]: val
	              }
	            };
	          }); // This assures any existing transitions are stopped

	          tweens.push(tween.call(this, stateKey, attr, val));
	        }
	      });
	    } else {
	      const val = transitions[stateKey];

	      if (Array.isArray(val)) {
	        if (val.length === 1) {
	          tweens.push(tween.call(this, null, stateKey, val[0]));
	        } else {
	          this.setState(() => {
	            return {
	              [stateKey]: val[0]
	            };
	          });
	          tweens.push(tween.call(this, null, stateKey, val[1]));
	        }
	      } else if (typeof val === 'function') {
	        const getResonanceCustomTween = () => {
	          const resonanceCustomTween = t => {
	            this.setState(() => {
	              return {
	                [stateKey]: val(t)
	              };
	            });
	          };

	          return resonanceCustomTween;
	        };

	        tweens.push(getResonanceCustomTween);
	      } else {
	        this.setState(() => {
	          return {
	            [stateKey]: val
	          };
	        }); // This assures any existing transitions are stopped

	        tweens.push(tween.call(this, null, stateKey, val));
	      }
	    }

	    const timingConfig = { ...preset,
	      ...timing,
	      time: now()
	    };
	    schedule(this, stateKey, newId(), timingConfig, tweens, events);
	  });
	}

	function transition(config) {
	  if (Array.isArray(config)) {
	    config.forEach(c => {
	      scheduleTransitions.call(this, c);
	    });
	  } else {
	    scheduleTransitions.call(this, config);
	  }
	}

	function stop() {
	  const ts = this.TRANSITION_SCHEDULES;

	  if (ts) {
	    Object.keys(ts).forEach(s => {
	      ts[s].timer.stop();
	    });
	  }
	}

	class NodeGroup extends React.Component {
	  constructor(...args) {
	    super(...args);

	    defineProperty(this, "state", {
	      nodeKeys: [],
	      nodeHash: {},
	      nodes: [],
	      data: null
	    });

	    defineProperty(this, "animate", () => {
	      const {
	        nodeKeys,
	        nodeHash
	      } = this.state;

	      if (this.unmounting) {
	        return;
	      }

	      let pending = false;
	      const nextNodeKeys = [];
	      const length = nodeKeys.length;

	      for (let i = 0; i < length; i++) {
	        const k = nodeKeys[i];
	        const n = nodeHash[k];

	        if (n.TRANSITION_SCHEDULES) {
	          pending = true;
	        }

	        if (n.type === LEAVE && !n.TRANSITION_SCHEDULES) {
	          delete nodeHash[k];
	        } else {
	          nextNodeKeys.push(k);
	        }
	      }

	      if (!pending) {
	        this.interval.stop();
	      }

	      this.setState(() => ({
	        nodeKeys: nextNodeKeys,
	        nodes: nextNodeKeys.map(key => {
	          return nodeHash[key];
	        })
	      }));
	    });

	    defineProperty(this, "interval", null);

	    defineProperty(this, "unmounting", false);
	  }

	  static getDerivedStateFromProps(nextProps, prevState) {
	    if (nextProps.data !== prevState.data) {
	      const {
	        data,
	        keyAccessor,
	        start,
	        enter,
	        update,
	        leave
	      } = nextProps;
	      const {
	        nodeKeys,
	        nodeHash
	      } = prevState;
	      const keyIndex = {};

	      for (let i = 0; i < nodeKeys.length; i++) {
	        keyIndex[nodeKeys[i]] = i;
	      }

	      const nextKeyIndex = {};
	      const nextNodeKeys = [];

	      for (let i = 0; i < data.length; i++) {
	        const d = data[i];
	        const k = keyAccessor(d, i);
	        nextKeyIndex[k] = i;
	        nextNodeKeys.push(k);

	        if (keyIndex[k] === undefined) {
	          nodeHash[k] = new Node(k, d, ENTER);
	        }
	      }

	      for (let i = 0; i < nodeKeys.length; i++) {
	        const k = nodeKeys[i];
	        const n = nodeHash[k];

	        if (nextKeyIndex[k] !== undefined) {
	          n.updateData(data[nextKeyIndex[k]]);
	          n.updateType(UPDATE);
	        } else {
	          n.updateType(LEAVE);
	        }
	      }

	      const mergedNodeKeys = mergeKeys(nodeKeys, keyIndex, nextNodeKeys, nextKeyIndex);

	      for (let i = 0; i < mergedNodeKeys.length; i++) {
	        const k = mergedNodeKeys[i];
	        const n = nodeHash[k];
	        const d = n.data;

	        if (n.type === ENTER) {
	          n.setState(start(d, nextKeyIndex[k]));
	          transition.call(n, enter(d, nextKeyIndex[k]));
	        } else if (n.type === LEAVE) {
	          transition.call(n, leave(d, keyIndex[k]));
	        } else {
	          transition.call(n, update(d, nextKeyIndex[k]));
	        }
	      }

	      return {
	        data,
	        nodes: mergedNodeKeys.map(key => {
	          return nodeHash[key];
	        }),
	        nodeHash,
	        nodeKeys: mergedNodeKeys
	      };
	    }

	    return null;
	  }

	  componentDidMount() {
	    this.startInterval();
	  }

	  componentDidUpdate(prevProps) {
	    if (prevProps.data !== this.props.data && !this.unmounting) {
	      this.startInterval();
	    }
	  }

	  startInterval() {
	    if (!this.interval) {
	      this.interval = interval$1(this.animate);
	    } else {
	      this.interval.restart(this.animate);
	    }
	  }

	  componentWillUnmount() {
	    const {
	      nodeKeys,
	      nodeHash
	    } = this.state;
	    this.unmounting = true;

	    if (this.interval) {
	      this.interval.stop();
	    }

	    nodeKeys.forEach(key => {
	      stop.call(nodeHash[key]);
	    });
	  }

	  render() {
	    const renderedChildren = this.props.children(this.state.nodes);
	    return renderedChildren && React__default.Children.only(renderedChildren);
	  }

	}

	NodeGroup.propTypes = {
	  /**
	   * An array.  The data prop is treated as immutable so the nodes will only update if prev.data !== next.data.
	   */
	  data: propTypes.array.isRequired,

	  /**
	   * Function that returns a string key given the data and its index.  Used to track which nodes are entering, updating and leaving.
	   */
	  keyAccessor: propTypes.func.isRequired,

	  /**
	   * A function that returns the starting state.  The function is passed the data and index and must return an object.
	   */
	  start: propTypes.func.isRequired,

	  /**
	   * A function that **returns an object or array of objects** describing how the state should transform on enter.  The function is passed the data and index.
	   */
	  enter: propTypes.func,

	  /**
	   * A function that **returns an object or array of objects** describing how the state should transform on update.  The function is passed the data and index.
	   */
	  update: propTypes.func,

	  /**
	   * A function that **returns an object or array of objects** describing how the state should transform on leave.  The function is passed the data and index.
	   */
	  leave: propTypes.func,

	  /**
	   * A function that renders the nodes. It should accept an array of nodes as its only argument.  Each node is an object with the key, data, state and a type of 'ENTER', 'UPDATE' or 'LEAVE'.
	   */
	  children: propTypes.func.isRequired
	};
	NodeGroup.defaultProps = {
	  enter: () => {},
	  update: () => {},
	  leave: () => {}
	};
	polyfill(NodeGroup);

	const keyAccessor = () => '$$key$$';

	function Animate(props) {
	  const {
	    show,
	    start,
	    enter,
	    update,
	    leave,
	    children
	  } = props;
	  const data = typeof start === 'function' ? start() : start;
	  return React__default.createElement(NodeGroup, {
	    data: show ? [data] : [],
	    start: () => data,
	    keyAccessor: keyAccessor,
	    enter: typeof enter === 'function' ? enter : () => enter,
	    update: typeof update === 'function' ? update : () => update,
	    leave: typeof leave === 'function' ? leave : () => leave
	  }, nodes => {
	    if (!nodes[0]) {
	      return null;
	    }

	    const renderedChildren = children(nodes[0].state);
	    return renderedChildren && React__default.Children.only(renderedChildren);
	  });
	}

	Animate.propTypes = {
	  /**
	   * Boolean value that determines if the child should be rendered or not.
	   */
	  show: propTypes.bool.isRequired,

	  /**
	   * An object or function that returns an obejct to be used as the starting state.
	   */
	  start: propTypes.oneOfType([propTypes.func, propTypes.object]),

	  /**
	   * An object, array of objects, or function that returns an object or array of objects describing how the state should transform on enter.
	   */
	  enter: propTypes.oneOfType([propTypes.func, propTypes.array, propTypes.object]),

	  /**
	   * An object, array of objects, or function that returns an object or array of objects describing how the state should transform on update. ***Note:*** although not required, in most cases it make sense to specify an update prop to handle interrupted enter and leave transitions.
	   */
	  update: propTypes.oneOfType([propTypes.func, propTypes.array, propTypes.object]),

	  /**
	   * An object, array of objects, or function that returns an object or array of objects describing how the state should transform on leave.
	   */
	  leave: propTypes.oneOfType([propTypes.func, propTypes.array, propTypes.object]),

	  /**
	   * A function that renders the node.  The function is passed the data and state.
	   */
	  children: propTypes.func.isRequired
	};
	Animate.defaultProps = {
	  show: true
	};

	exports.Animate = Animate;
	exports.NodeGroup = NodeGroup;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
