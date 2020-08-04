/*globals define, module, Symbol */
/*jshint -W056 */

(function (globals) {
  'use strict';

  var strings, messages, predicates, functions, assert, not, maybe,
      collections, slice, neginf, posinf, isArray, keys, haveSymbols;

  strings = {
    v: 'value',
    n: 'number',
    s: 'string',
    b: 'boolean',
    o: 'object',
    t: 'type',
    a: 'array',
    al: 'array-like',
    i: 'iterable',
    d: 'date',
    f: 'function',
    l: 'length'
  };

  messages = {};
  predicates = {};

  [
    { n: 'equal', f: equal, s: 'v' },
    { n: 'undefined', f: isUndefined, s: 'v' },
    { n: 'null', f: isNull, s: 'v' },
    { n: 'assigned', f: assigned, s: 'v' },
    { n: 'primitive', f: primitive, s: 'v' },
    { n: 'includes', f: includes, s: 'v' },
    { n: 'zero', f: zero },
    { n: 'infinity', f: infinity },
    { n: 'number', f: number },
    { n: 'integer', f: integer },
    { n: 'even', f: even },
    { n: 'odd', f: odd },
    { n: 'greater', f: greater },
    { n: 'less', f: less },
    { n: 'between', f: between },
    { n: 'greaterOrEqual', f: greaterOrEqual },
    { n: 'lessOrEqual', f: lessOrEqual },
    { n: 'inRange', f: inRange },
    { n: 'positive', f: positive },
    { n: 'negative', f: negative },
    { n: 'string', f: string, s: 's' },
    { n: 'emptyString', f: emptyString, s: 's' },
    { n: 'nonEmptyString', f: nonEmptyString, s: 's' },
    { n: 'contains', f: contains, s: 's' },
    { n: 'match', f: match, s: 's' },
    { n: 'boolean', f: boolean, s: 'b' },
    { n: 'object', f: object, s: 'o' },
    { n: 'emptyObject', f: emptyObject, s: 'o' },
    { n: 'nonEmptyObject', f: nonEmptyObject, s: 'o' },
    { n: 'instanceStrict', f: instanceStrict, s: 't' },
    { n: 'instance', f: instance, s: 't' },
    { n: 'like', f: like, s: 't' },
    { n: 'array', f: array, s: 'a' },
    { n: 'emptyArray', f: emptyArray, s: 'a' },
    { n: 'nonEmptyArray', f: nonEmptyArray, s: 'a' },
    { n: 'arrayLike', f: arrayLike, s: 'al' },
    { n: 'iterable', f: iterable, s: 'i' },
    { n: 'date', f: date, s: 'd' },
    { n: 'function', f: isFunction, s: 'f' },
    { n: 'hasLength', f: hasLength, s: 'l' },
  ].map(function (data) {
    var n = data.n;
    messages[n] = 'Invalid ' + strings[data.s || 'n'];
    predicates[n] = data.f;
  });

  functions = {
    map: map,
    all: all,
    any: any
  };

  collections = [ 'array', 'arrayLike', 'iterable', 'object' ];
  slice = Array.prototype.slice;
  neginf = Number.NEGATIVE_INFINITY;
  posinf = Number.POSITIVE_INFINITY;
  isArray = Array.isArray;
  keys = Object.keys;
  haveSymbols = typeof Symbol === 'function';

  functions = mixin(functions, predicates);
  assert = createModifiedPredicates(assertModifier, assertImpl);
  not = createModifiedPredicates(notModifier, notImpl);
  maybe = createModifiedPredicates(maybeModifier, maybeImpl);
  assert.not = createModifiedModifier(assertModifier, not);
  assert.maybe = createModifiedModifier(assertModifier, maybe);

  collections.forEach(createOfPredicates);
  createOfModifiers(assert, assertModifier);
  createOfModifiers(not, notModifier);
  collections.forEach(createMaybeOfModifiers);

  exportFunctions(mixin(functions, {
    assert: assert,
    not: not,
    maybe: maybe
  }));

  /**
   * Public function `equal`.
   *
   * Returns true if `lhs` and `rhs` are strictly equal, without coercion.
   * Returns false otherwise.
   */
  function equal (lhs, rhs) {
    return lhs === rhs;
  }

  /**
   * Public function `undefined`.
   *
   * Returns true if `data` is undefined, false otherwise.
   */
  function isUndefined (data) {
    return data === undefined;
  }

  /**
   * Public function `null`.
   *
   * Returns true if `data` is null, false otherwise.
   */
  function isNull (data) {
    return data === null;
  }

  /**
   * Public function `assigned`.
   *
   * Returns true if `data` is not null or undefined, false otherwise.
   */
  function assigned (data) {
    return data !== undefined && data !== null;
  }

  /**
   * Public function `primitive`.
   *
   * Returns true if `data` is a primitive type, false otherwise.
   */
  function primitive (data) {
    var type;

    switch (data) {
      case null:
      case undefined:
      case false:
      case true:
        return true;
    }

    type = typeof data;
    return type === 'string' || type === 'number' || (haveSymbols && type === 'symbol');
  }

  /**
   * Public function `zero`.
   *
   * Returns true if `data` is zero, false otherwise.
   */
  function zero (data) {
    return data === 0;
  }

  /**
   * Public function `infinity`.
   *
   * Returns true if `data` is positive or negative infinity, false otherwise.
   */
  function infinity (data) {
    return data === neginf || data === posinf;
  }

  /**
   * Public function `number`.
   *
   * Returns true if `data` is a number, false otherwise.
   */
  function number (data) {
    return typeof data === 'number' && data > neginf && data < posinf;
  }

  /**
   * Public function `integer`.
   *
   * Returns true if `data` is an integer, false otherwise.
   */
  function integer (data) {
    return typeof data === 'number' && data % 1 === 0;
  }

  /**
   * Public function `even`.
   *
   * Returns true if `data` is an even number, false otherwise.
   */
  function even (data) {
    return typeof data === 'number' && data % 2 === 0;
  }

  /**
   * Public function `odd`.
   *
   * Returns true if `data` is an odd number, false otherwise.
   */
  function odd (data) {
    return integer(data) && data % 2 !== 0;
  }

  /**
   * Public function `greater`.
   *
   * Returns true if `lhs` is a number greater than `rhs`, false otherwise.
   */
  function greater (lhs, rhs) {
    return number(lhs) && lhs > rhs;
  }

  /**
   * Public function `less`.
   *
   * Returns true if `lhs` is a number less than `rhs`, false otherwise.
   */
  function less (lhs, rhs) {
    return number(lhs) && lhs < rhs;
  }

  /**
   * Public function `between`.
   *
   * Returns true if `data` is a number between `x` and `y`, false otherwise.
   */
  function between (data, x, y) {
    if (x < y) {
      return greater(data, x) && data < y;
    }

    return less(data, x) && data > y;
  }

  /**
   * Public function `greaterOrEqual`.
   *
   * Returns true if `lhs` is a number greater than or equal to `rhs`, false
   * otherwise.
   */
  function greaterOrEqual (lhs, rhs) {
    return number(lhs) && lhs >= rhs;
  }

  /**
   * Public function `lessOrEqual`.
   *
   * Returns true if `lhs` is a number less than or equal to `rhs`, false
   * otherwise.
   */
  function lessOrEqual (lhs, rhs) {
    return number(lhs) && lhs <= rhs;
  }

  /**
   * Public function `inRange`.
   *
   * Returns true if `data` is a number in the range `x..y`, false otherwise.
   */
  function inRange (data, x, y) {
    if (x < y) {
      return greaterOrEqual(data, x) && data <= y;
    }

    return lessOrEqual(data, x) && data >= y;
  }

  /**
   * Public function `positive`.
   *
   * Returns true if `data` is a positive number, false otherwise.
   */
  function positive (data) {
    return greater(data, 0);
  }

  /**
   * Public function `negative`.
   *
   * Returns true if `data` is a negative number, false otherwise.
   */
  function negative (data) {
    return less(data, 0);
  }

  /**
   * Public function `string`.
   *
   * Returns true if `data` is a string, false otherwise.
   */
  function string (data) {
    return typeof data === 'string';
  }

  /**
   * Public function `emptyString`.
   *
   * Returns true if `data` is the empty string, false otherwise.
   */
  function emptyString (data) {
    return data === '';
  }

  /**
   * Public function `nonEmptyString`.
   *
   * Returns true if `data` is a non-empty string, false otherwise.
   */
  function nonEmptyString (data) {
    return string(data) && data !== '';
  }

  /**
   * Public function `contains`.
   *
   * Returns true if `data` is a string that contains `substring`, false
   * otherwise.
   */
  function contains (data, substring) {
    return string(data) && data.indexOf(substring) !== -1;
  }

  /**
   * Public function `match`.
   *
   * Returns true if `data` is a string that matches `regex`, false otherwise.
   */
  function match (data, regex) {
    return string(data) && !! data.match(regex);
  }

  /**
   * Public function `boolean`.
   *
   * Returns true if `data` is a boolean value, false otherwise.
   */
  function boolean (data) {
    return data === false || data === true;
  }

  /**
   * Public function `object`.
   *
   * Returns true if `data` is a plain-old JS object, false otherwise.
   */
  function object (data) {
    return Object.prototype.toString.call(data) === '[object Object]';
  }

  /**
   * Public function `emptyObject`.
   *
   * Returns true if `data` is an empty object, false otherwise.
   */
  function emptyObject (data) {
    return object(data) && !some(data, function () {
      return true;
    });
  }

  function some (data, predicate) {
    for (var key in data) {
      if (data.hasOwnProperty(key)) {
        if (predicate(key, data[key])) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Public function `nonEmptyObject`.
   *
   * Returns true if `data` is a non-empty object, false otherwise.
   */
  function nonEmptyObject (data) {
    return object(data) && some(data, function () {
      return true;
    });
  }

  /**
   * Public function `instanceStrict`.
   *
   * Returns true if `data` is an instance of `prototype`, false otherwise.
   */
  function instanceStrict (data, prototype) {
    try {
      return data instanceof prototype;
    } catch (error) {
      return false;
    }
  }

  /**
   * Public function `instance`.
   *
   * Returns true if `data` is an instance of `prototype`, false otherwise.
   * Falls back to testing constructor.name and Object.prototype.toString
   * if the initial instanceof test fails.
   */
  function instance (data, prototype) {
    try {
      return instanceStrict(data, prototype) ||
        data.constructor.name === prototype.name ||
        Object.prototype.toString.call(data) === '[object ' + prototype.name + ']';
    } catch (error) {
      return false;
    }
  }

  /**
   * Public function `like`.
   *
   * Tests whether `data` 'quacks like a duck'. Returns true if `data` has all
   * of the properties of `archetype` (the 'duck'), false otherwise.
   */
  function like (data, archetype) {
    var name;

    for (name in archetype) {
      if (archetype.hasOwnProperty(name)) {
        if (data.hasOwnProperty(name) === false || typeof data[name] !== typeof archetype[name]) {
          return false;
        }

        if (object(data[name]) && like(data[name], archetype[name]) === false) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Public function `array`.
   *
   * Returns true if `data` is an array, false otherwise.
   */
  function array (data) {
    return isArray(data);
  }

  /**
   * Public function `emptyArray`.
   *
   * Returns true if `data` is an empty array, false otherwise.
   */
  function emptyArray (data) {
    return isArray(data) && data.length === 0;
  }

  /**
   * Public function `nonEmptyArray`.
   *
   * Returns true if `data` is a non-empty array, false otherwise.
   */
  function nonEmptyArray (data) {
    return isArray(data) && data.length > 0;
  }

  /**
   * Public function `arrayLike`.
   *
   * Returns true if `data` is an array-like object, false otherwise.
   */
  function arrayLike (data) {
    return assigned(data) && data.length >= 0;
  }

  /**
   * Public function `iterable`.
   *
   * Returns true if `data` is an iterable, false otherwise.
   */
  function iterable (data) {
    if (! haveSymbols) {
      // Fall back to `arrayLike` predicate in pre-ES6 environments.
      return arrayLike(data);
    }

    return assigned(data) && isFunction(data[Symbol.iterator]);
  }

  /**
   * Public function `includes`.
   *
   * Returns true if `data` contains `value`, false otherwise.
   */
  function includes (data, value) {
    var iterator, iteration;

    if (! assigned(data)) {
      return false;
    }

    if (haveSymbols && data[Symbol.iterator] && isFunction(data.values)) {
      iterator = data.values();

      do {
        iteration = iterator.next();

        if (iteration.value === value) {
          return true;
        }
      } while (! iteration.done);

      return false;
    }

    return some(data, function (key, dataValue) {
      return dataValue === value;
    });
  }

  /**
   * Public function `hasLength`.
   *
   * Returns true if `data` has a length property that equals `length`, false
   * otherwise.
   */
  function hasLength (data, length) {
    return assigned(data) && data.length === length;
  }

  /**
   * Public function `date`.
   *
   * Returns true if `data` is a valid date, false otherwise.
   */
  function date (data) {
    return instanceStrict(data, Date) && integer(data.getTime());
  }

  /**
   * Public function `function`.
   *
   * Returns true if `data` is a function, false otherwise.
   */
  function isFunction (data) {
    return typeof data === 'function';
  }

  /**
   * Public function `map`.
   *
   * Maps each value from `data` to the corresponding predicate and returns
   * the results. If the same function is to be applied across all of the data,
   * a single predicate function may be passed in.
   */
  function map (data, predicates) {
    var result;

    if (isArray(data)) {
      result = [];
    } else {
      result = {};
    }

    if (isFunction(predicates)) {
      forEach(data, function (key, value) {
        result[key] = predicates(value);
      });
    } else {
      if (! isArray(predicates)) {
        assert.object(predicates);
      }

      var dataKeys = keys(data || {});

      forEach(predicates, function (key, predicate) {
        dataKeys.some(function (dataKey, index) {
          if (dataKey === key) {
            dataKeys.splice(index, 1);
            return true;
          }
          return false;
        });

        if (isFunction(predicate)) {
          if (not.assigned(data)) {
            result[key] = !!predicate.m;
          } else {
            result[key] = predicate(data[key]);
          }
        } else {
          result[key] = map(data[key], predicate);
        }
      });
    }

    return result;
  }

  function forEach (object, action) {
    for (var key in object) {
      if (object.hasOwnProperty(key)) {
        action(key, object[key]);
      }
    }
  }

  /**
   * Public function `all`
   *
   * Check that all boolean values are true
   * in an array or object returned from `map`.
   */
  function all (data) {
    if (isArray(data)) {
      return testArray(data, false);
    }

    assert.object(data);

    return testObject(data, false);
  }

  function testArray (data, result) {
    var i;

    for (i = 0; i < data.length; i += 1) {
      if (data[i] === result) {
        return result;
      }
    }

    return !result;
  }

  function testObject (data, result) {
    var key, value;

    for (key in data) {
      if (data.hasOwnProperty(key)) {
        value = data[key];

        if (object(value) && testObject(value, result) === result) {
          return result;
        }

        if (value === result) {
          return result;
        }
      }
    }

    return !result;
  }

  /**
   * Public function `any`
   *
   * Check that at least one boolean value is true
   * in an array or object returned from `map`.
   */
  function any (data) {
    if (isArray(data)) {
      return testArray(data, true);
    }

    assert.object(data);

    return testObject(data, true);
  }

  function mixin (target, source) {
    forEach(source, function (key, value) {
      target[key] = value;
    });

    return target;
  }

  /**
   * Public modifier `assert`.
   *
   * Throws if `predicate` returns false.
   */
  function assertModifier (predicate, defaultMessage) {
    return function () {
      return assertPredicate(predicate, arguments, defaultMessage);
    };
  }

  function assertPredicate (predicate, args, defaultMessage) {
    var argCount = predicate.l || predicate.length;
    var message = args[argCount];
    var ErrorType = args[argCount + 1];
    assertImpl(
      predicate.apply(null, args),
      nonEmptyString(message) ? message : defaultMessage,
      isFunction(ErrorType) ? ErrorType : TypeError
    );
    return args[0];
  }

  function assertImpl (value, message, ErrorType) {
    if (value) {
      return value;
    }
    throw new (ErrorType || Error)(message || 'Assertion failed');
  }

  /**
   * Public modifier `not`.
   *
   * Negates `predicate`.
   */
  function notModifier (predicate) {
    var modifiedPredicate = function () {
      return notImpl(predicate.apply(null, arguments));
    };
    modifiedPredicate.l = predicate.length;
    return modifiedPredicate;
  }

  function notImpl (value) {
    return !value;
  }

  /**
   * Public modifier `maybe`.
   *
   * Returns true if predicate argument is  null or undefined,
   * otherwise propagates the return value from `predicate`.
   */
  function maybeModifier (predicate) {
    var modifiedPredicate = function () {
      if (not.assigned(arguments[0])) {
        return true;
      }

      return predicate.apply(null, arguments);
    };
    modifiedPredicate.l = predicate.length;

    // Hackishly indicate that this is a maybe.xxx predicate.
    // Without this flag, the alternative would be to iterate
    // through the maybe predicates or use indexOf to check,
    // which would be time-consuming.
    modifiedPredicate.m = true;

    return modifiedPredicate;
  }

  function maybeImpl (value) {
    if (assigned(value) === false) {
      return true;
    }

    return value;
  }

  /**
   * Public modifier `of`.
   *
   * Applies the chained predicate to members of the collection.
   */
  function ofModifier (target, type, predicate) {
    var modifiedPredicate = function () {
      var collection, args;

      collection = arguments[0];

      if (target === 'maybe' && not.assigned(collection)) {
        return true;
      }

      if (!type(collection)) {
        return false;
      }

      collection = coerceCollection(type, collection);
      args = slice.call(arguments, 1);

      try {
        collection.forEach(function (item) {
          if (
            (target !== 'maybe' || assigned(item)) &&
            !predicate.apply(null, [ item ].concat(args))
          ) {
            // TODO: Replace with for...of when ES6 is required.
            throw 0;
          }
        });
      } catch (ignore) {
        return false;
      }

      return true;
    };
    modifiedPredicate.l = predicate.length;
    return modifiedPredicate;
  }

  function coerceCollection (type, collection) {
    switch (type) {
      case arrayLike:
        return slice.call(collection);
      case object:
        return keys(collection).map(function (key) {
          return collection[key];
        });
      default:
        return collection;
    }
  }

  function createModifiedPredicates (modifier, object) {
    return createModifiedFunctions([ modifier, predicates, object ]);
  }

  function createModifiedFunctions (args) {
    var modifier, object, functions, result;

    modifier = args.shift();
    object = args.pop();
    functions = args.pop();

    result = object || {};

    forEach(functions, function (key, fn) {
      Object.defineProperty(result, key, {
        configurable: false,
        enumerable: true,
        writable: false,
        value: modifier.apply(null, args.concat(fn, messages[key]))
      });
    });

    return result;
  }

  function createModifiedModifier (modifier, modified) {
    return createModifiedFunctions([ modifier, modified, null ]);
  }

  function createOfPredicates (key) {
    predicates[key].of = createModifiedFunctions(
      [ ofModifier.bind(null, null), predicates[key], predicates, null ]
    );
  }

  function createOfModifiers (base, modifier) {
    collections.forEach(function (key) {
      base[key].of = createModifiedModifier(modifier, predicates[key].of);
    });
  }

  function createMaybeOfModifiers (key) {
    maybe[key].of = createModifiedFunctions(
      [ ofModifier.bind(null, 'maybe'), predicates[key], predicates, null ]
    );
    assert.maybe[key].of = createModifiedModifier(assertModifier, maybe[key].of);
    assert.not[key].of = createModifiedModifier(assertModifier, not[key].of);
  }

  function exportFunctions (functions) {
    if (typeof define === 'function' && define.amd) {
      define(function () {
        return functions;
      });
    } else if (typeof module !== 'undefined' && module !== null && module.exports) {
      module.exports = functions;
    } else {
      globals.check = functions;
    }
  }
}(this));
