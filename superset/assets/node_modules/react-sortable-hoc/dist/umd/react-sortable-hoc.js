(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory(require("react"), require("react-dom"));
	else if(typeof define === 'function' && define.amd)
		define(["react", "react-dom"], factory);
	else if(typeof exports === 'object')
		exports["SortableHOC"] = factory(require("react"), require("react-dom"));
	else
		root["SortableHOC"] = factory(root["React"], root["ReactDOM"]);
})(this, function(__WEBPACK_EXTERNAL_MODULE_133__, __WEBPACK_EXTERNAL_MODULE_143__) {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

	module.exports = __webpack_require__(1);


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.arrayMove = exports.sortableHandle = exports.sortableElement = exports.sortableContainer = exports.SortableHandle = exports.SortableElement = exports.SortableContainer = undefined;

	var _utils = __webpack_require__(2);

	Object.defineProperty(exports, 'arrayMove', {
	  enumerable: true,
	  get: function get() {
	    return _utils.arrayMove;
	  }
	});

	var _SortableContainer2 = __webpack_require__(41);

	var _SortableContainer3 = _interopRequireDefault(_SortableContainer2);

	var _SortableElement2 = __webpack_require__(145);

	var _SortableElement3 = _interopRequireDefault(_SortableElement2);

	var _SortableHandle2 = __webpack_require__(146);

	var _SortableHandle3 = _interopRequireDefault(_SortableHandle2);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	exports.SortableContainer = _SortableContainer3.default;
	exports.SortableElement = _SortableElement3.default;
	exports.SortableHandle = _SortableHandle3.default;
	exports.sortableContainer = _SortableContainer3.default;
	exports.sortableElement = _SortableElement3.default;
	exports.sortableHandle = _SortableHandle3.default;

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.vendorPrefix = exports.events = undefined;

	var _keys = __webpack_require__(3);

	var _keys2 = _interopRequireDefault(_keys);

	exports.arrayMove = arrayMove;
	exports.omit = omit;
	exports.closest = closest;
	exports.limit = limit;
	exports.getElementMargin = getElementMargin;
	exports.provideDisplayName = provideDisplayName;
	exports.getPosition = getPosition;
	exports.isTouchEvent = isTouchEvent;
	exports.getEdgeOffset = getEdgeOffset;
	exports.getLockPixelOffset = getLockPixelOffset;

	var _invariant = __webpack_require__(39);

	var _invariant2 = _interopRequireDefault(_invariant);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	function arrayMove(arr, previousIndex, newIndex) {
	  var array = arr.slice(0);
	  if (newIndex >= array.length) {
	    var k = newIndex - array.length;
	    while (k-- + 1) {
	      array.push(undefined);
	    }
	  }
	  array.splice(newIndex, 0, array.splice(previousIndex, 1)[0]);
	  return array;
	}

	function omit(obj) {
	  for (var _len = arguments.length, keysToOmit = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
	    keysToOmit[_key - 1] = arguments[_key];
	  }

	  return (0, _keys2.default)(obj).reduce(function (acc, key) {
	    if (keysToOmit.indexOf(key) === -1) acc[key] = obj[key];
	    return acc;
	  }, {});
	}

	var events = exports.events = {
	  start: ['touchstart', 'mousedown'],
	  move: ['touchmove', 'mousemove'],
	  end: ['touchend', 'touchcancel', 'mouseup']
	};

	var vendorPrefix = exports.vendorPrefix = function () {
	  if (typeof window === 'undefined' || typeof document === 'undefined') return ''; // server environment
	  // fix for:
	  //    https://bugzilla.mozilla.org/show_bug.cgi?id=548397
	  //    window.getComputedStyle() returns null inside an iframe with display: none
	  // in this case return an array with a fake mozilla style in it.
	  var styles = window.getComputedStyle(document.documentElement, '') || ['-moz-hidden-iframe'];
	  var pre = (Array.prototype.slice.call(styles).join('').match(/-(moz|webkit|ms)-/) || styles.OLink === '' && ['', 'o'])[1];

	  switch (pre) {
	    case 'ms':
	      return 'ms';
	    default:
	      return pre && pre.length ? pre[0].toUpperCase() + pre.substr(1) : '';
	  }
	}();

	function closest(el, fn) {
	  while (el) {
	    if (fn(el)) return el;
	    el = el.parentNode;
	  }
	}

	function limit(min, max, value) {
	  if (value < min) {
	    return min;
	  }
	  if (value > max) {
	    return max;
	  }
	  return value;
	}

	function getCSSPixelValue(stringValue) {
	  if (stringValue.substr(-2) === 'px') {
	    return parseFloat(stringValue);
	  }
	  return 0;
	}

	function getElementMargin(element) {
	  var style = window.getComputedStyle(element);

	  return {
	    top: getCSSPixelValue(style.marginTop),
	    right: getCSSPixelValue(style.marginRight),
	    bottom: getCSSPixelValue(style.marginBottom),
	    left: getCSSPixelValue(style.marginLeft)
	  };
	}

	function provideDisplayName(prefix, Component) {
	  var componentName = Component.displayName || Component.name;

	  return componentName ? prefix + '(' + componentName + ')' : prefix;
	}

	function getPosition(event) {
	  if (event.touches && event.touches.length) {
	    return {
	      x: event.touches[0].pageX,
	      y: event.touches[0].pageY
	    };
	  } else if (event.changedTouches && event.changedTouches.length) {
	    return {
	      x: event.changedTouches[0].pageX,
	      y: event.changedTouches[0].pageY
	    };
	  } else {
	    return {
	      x: event.pageX,
	      y: event.pageY
	    };
	  }
	}

	function isTouchEvent(event) {
	  return event.touches && event.touches.length || event.changedTouches && event.changedTouches.length;
	}

	function getEdgeOffset(node, parent) {
	  var offset = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : { top: 0, left: 0 };

	  // Get the actual offsetTop / offsetLeft value, no matter how deep the node is nested
	  if (node) {
	    var nodeOffset = {
	      top: offset.top + node.offsetTop,
	      left: offset.left + node.offsetLeft
	    };

	    if (node.parentNode !== parent) {
	      return getEdgeOffset(node.parentNode, parent, nodeOffset);
	    } else {
	      return nodeOffset;
	    }
	  }
	}

	function getLockPixelOffset(_ref) {
	  var lockOffset = _ref.lockOffset,
	      width = _ref.width,
	      height = _ref.height;

	  var offsetX = lockOffset;
	  var offsetY = lockOffset;
	  var unit = 'px';

	  if (typeof lockOffset === 'string') {
	    var match = /^[+-]?\d*(?:\.\d*)?(px|%)$/.exec(lockOffset);

	    (0, _invariant2.default)(match !== null, 'lockOffset value should be a number or a string of a ' + 'number followed by "px" or "%". Given %s', lockOffset);

	    offsetX = offsetY = parseFloat(lockOffset);
	    unit = match[1];
	  }

	  (0, _invariant2.default)(isFinite(offsetX) && isFinite(offsetY), 'lockOffset value should be a finite. Given %s', lockOffset);

	  if (unit === '%') {
	    offsetX = offsetX * width / 100;
	    offsetY = offsetY * height / 100;
	  }

	  return {
	    x: offsetX,
	    y: offsetY
	  };
	}

/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

	module.exports = { "default": __webpack_require__(4), __esModule: true };

/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

	__webpack_require__(5);
	module.exports = __webpack_require__(20).Object.keys;


/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

	// 19.1.2.14 Object.keys(O)
	var toObject = __webpack_require__(6);
	var $keys = __webpack_require__(8);

	__webpack_require__(25)('keys', function () {
	  return function keys(it) {
	    return $keys(toObject(it));
	  };
	});


/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

	// 7.1.13 ToObject(argument)
	var defined = __webpack_require__(7);
	module.exports = function (it) {
	  return Object(defined(it));
	};


/***/ }),
/* 7 */
/***/ (function(module, exports) {

	// 7.2.1 RequireObjectCoercible(argument)
	module.exports = function (it) {
	  if (it == undefined) throw TypeError("Can't call method on  " + it);
	  return it;
	};


/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

	// 19.1.2.14 / 15.2.3.14 Object.keys(O)
	var $keys = __webpack_require__(9);
	var enumBugKeys = __webpack_require__(24);

	module.exports = Object.keys || function keys(O) {
	  return $keys(O, enumBugKeys);
	};


/***/ }),
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

	var has = __webpack_require__(10);
	var toIObject = __webpack_require__(11);
	var arrayIndexOf = __webpack_require__(14)(false);
	var IE_PROTO = __webpack_require__(18)('IE_PROTO');

	module.exports = function (object, names) {
	  var O = toIObject(object);
	  var i = 0;
	  var result = [];
	  var key;
	  for (key in O) if (key != IE_PROTO) has(O, key) && result.push(key);
	  // Don't enum bug & hidden keys
	  while (names.length > i) if (has(O, key = names[i++])) {
	    ~arrayIndexOf(result, key) || result.push(key);
	  }
	  return result;
	};


/***/ }),
/* 10 */
/***/ (function(module, exports) {

	var hasOwnProperty = {}.hasOwnProperty;
	module.exports = function (it, key) {
	  return hasOwnProperty.call(it, key);
	};


/***/ }),
/* 11 */
/***/ (function(module, exports, __webpack_require__) {

	// to indexed object, toObject with fallback for non-array-like ES3 strings
	var IObject = __webpack_require__(12);
	var defined = __webpack_require__(7);
	module.exports = function (it) {
	  return IObject(defined(it));
	};


/***/ }),
/* 12 */
/***/ (function(module, exports, __webpack_require__) {

	// fallback for non-array-like ES3 and non-enumerable old V8 strings
	var cof = __webpack_require__(13);
	// eslint-disable-next-line no-prototype-builtins
	module.exports = Object('z').propertyIsEnumerable(0) ? Object : function (it) {
	  return cof(it) == 'String' ? it.split('') : Object(it);
	};


/***/ }),
/* 13 */
/***/ (function(module, exports) {

	var toString = {}.toString;

	module.exports = function (it) {
	  return toString.call(it).slice(8, -1);
	};


/***/ }),
/* 14 */
/***/ (function(module, exports, __webpack_require__) {

	// false -> Array#indexOf
	// true  -> Array#includes
	var toIObject = __webpack_require__(11);
	var toLength = __webpack_require__(15);
	var toAbsoluteIndex = __webpack_require__(17);
	module.exports = function (IS_INCLUDES) {
	  return function ($this, el, fromIndex) {
	    var O = toIObject($this);
	    var length = toLength(O.length);
	    var index = toAbsoluteIndex(fromIndex, length);
	    var value;
	    // Array#includes uses SameValueZero equality algorithm
	    // eslint-disable-next-line no-self-compare
	    if (IS_INCLUDES && el != el) while (length > index) {
	      value = O[index++];
	      // eslint-disable-next-line no-self-compare
	      if (value != value) return true;
	    // Array#indexOf ignores holes, Array#includes - not
	    } else for (;length > index; index++) if (IS_INCLUDES || index in O) {
	      if (O[index] === el) return IS_INCLUDES || index || 0;
	    } return !IS_INCLUDES && -1;
	  };
	};


/***/ }),
/* 15 */
/***/ (function(module, exports, __webpack_require__) {

	// 7.1.15 ToLength
	var toInteger = __webpack_require__(16);
	var min = Math.min;
	module.exports = function (it) {
	  return it > 0 ? min(toInteger(it), 0x1fffffffffffff) : 0; // pow(2, 53) - 1 == 9007199254740991
	};


/***/ }),
/* 16 */
/***/ (function(module, exports) {

	// 7.1.4 ToInteger
	var ceil = Math.ceil;
	var floor = Math.floor;
	module.exports = function (it) {
	  return isNaN(it = +it) ? 0 : (it > 0 ? floor : ceil)(it);
	};


/***/ }),
/* 17 */
/***/ (function(module, exports, __webpack_require__) {

	var toInteger = __webpack_require__(16);
	var max = Math.max;
	var min = Math.min;
	module.exports = function (index, length) {
	  index = toInteger(index);
	  return index < 0 ? max(index + length, 0) : min(index, length);
	};


/***/ }),
/* 18 */
/***/ (function(module, exports, __webpack_require__) {

	var shared = __webpack_require__(19)('keys');
	var uid = __webpack_require__(23);
	module.exports = function (key) {
	  return shared[key] || (shared[key] = uid(key));
	};


/***/ }),
/* 19 */
/***/ (function(module, exports, __webpack_require__) {

	var core = __webpack_require__(20);
	var global = __webpack_require__(21);
	var SHARED = '__core-js_shared__';
	var store = global[SHARED] || (global[SHARED] = {});

	(module.exports = function (key, value) {
	  return store[key] || (store[key] = value !== undefined ? value : {});
	})('versions', []).push({
	  version: core.version,
	  mode: __webpack_require__(22) ? 'pure' : 'global',
	  copyright: '© 2018 Denis Pushkarev (zloirock.ru)'
	});


/***/ }),
/* 20 */
/***/ (function(module, exports) {

	var core = module.exports = { version: '2.5.6' };
	if (typeof __e == 'number') __e = core; // eslint-disable-line no-undef


/***/ }),
/* 21 */
/***/ (function(module, exports) {

	// https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
	var global = module.exports = typeof window != 'undefined' && window.Math == Math
	  ? window : typeof self != 'undefined' && self.Math == Math ? self
	  // eslint-disable-next-line no-new-func
	  : Function('return this')();
	if (typeof __g == 'number') __g = global; // eslint-disable-line no-undef


/***/ }),
/* 22 */
/***/ (function(module, exports) {

	module.exports = true;


/***/ }),
/* 23 */
/***/ (function(module, exports) {

	var id = 0;
	var px = Math.random();
	module.exports = function (key) {
	  return 'Symbol('.concat(key === undefined ? '' : key, ')_', (++id + px).toString(36));
	};


/***/ }),
/* 24 */
/***/ (function(module, exports) {

	// IE 8- don't enum bug keys
	module.exports = (
	  'constructor,hasOwnProperty,isPrototypeOf,propertyIsEnumerable,toLocaleString,toString,valueOf'
	).split(',');


/***/ }),
/* 25 */
/***/ (function(module, exports, __webpack_require__) {

	// most Object methods by ES6 should accept primitives
	var $export = __webpack_require__(26);
	var core = __webpack_require__(20);
	var fails = __webpack_require__(35);
	module.exports = function (KEY, exec) {
	  var fn = (core.Object || {})[KEY] || Object[KEY];
	  var exp = {};
	  exp[KEY] = exec(fn);
	  $export($export.S + $export.F * fails(function () { fn(1); }), 'Object', exp);
	};


/***/ }),
/* 26 */
/***/ (function(module, exports, __webpack_require__) {

	var global = __webpack_require__(21);
	var core = __webpack_require__(20);
	var ctx = __webpack_require__(27);
	var hide = __webpack_require__(29);
	var has = __webpack_require__(10);
	var PROTOTYPE = 'prototype';

	var $export = function (type, name, source) {
	  var IS_FORCED = type & $export.F;
	  var IS_GLOBAL = type & $export.G;
	  var IS_STATIC = type & $export.S;
	  var IS_PROTO = type & $export.P;
	  var IS_BIND = type & $export.B;
	  var IS_WRAP = type & $export.W;
	  var exports = IS_GLOBAL ? core : core[name] || (core[name] = {});
	  var expProto = exports[PROTOTYPE];
	  var target = IS_GLOBAL ? global : IS_STATIC ? global[name] : (global[name] || {})[PROTOTYPE];
	  var key, own, out;
	  if (IS_GLOBAL) source = name;
	  for (key in source) {
	    // contains in native
	    own = !IS_FORCED && target && target[key] !== undefined;
	    if (own && has(exports, key)) continue;
	    // export native or passed
	    out = own ? target[key] : source[key];
	    // prevent global pollution for namespaces
	    exports[key] = IS_GLOBAL && typeof target[key] != 'function' ? source[key]
	    // bind timers to global for call from export context
	    : IS_BIND && own ? ctx(out, global)
	    // wrap global constructors for prevent change them in library
	    : IS_WRAP && target[key] == out ? (function (C) {
	      var F = function (a, b, c) {
	        if (this instanceof C) {
	          switch (arguments.length) {
	            case 0: return new C();
	            case 1: return new C(a);
	            case 2: return new C(a, b);
	          } return new C(a, b, c);
	        } return C.apply(this, arguments);
	      };
	      F[PROTOTYPE] = C[PROTOTYPE];
	      return F;
	    // make static versions for prototype methods
	    })(out) : IS_PROTO && typeof out == 'function' ? ctx(Function.call, out) : out;
	    // export proto methods to core.%CONSTRUCTOR%.methods.%NAME%
	    if (IS_PROTO) {
	      (exports.virtual || (exports.virtual = {}))[key] = out;
	      // export proto methods to core.%CONSTRUCTOR%.prototype.%NAME%
	      if (type & $export.R && expProto && !expProto[key]) hide(expProto, key, out);
	    }
	  }
	};
	// type bitmap
	$export.F = 1;   // forced
	$export.G = 2;   // global
	$export.S = 4;   // static
	$export.P = 8;   // proto
	$export.B = 16;  // bind
	$export.W = 32;  // wrap
	$export.U = 64;  // safe
	$export.R = 128; // real proto method for `library`
	module.exports = $export;


/***/ }),
/* 27 */
/***/ (function(module, exports, __webpack_require__) {

	// optional / simple context binding
	var aFunction = __webpack_require__(28);
	module.exports = function (fn, that, length) {
	  aFunction(fn);
	  if (that === undefined) return fn;
	  switch (length) {
	    case 1: return function (a) {
	      return fn.call(that, a);
	    };
	    case 2: return function (a, b) {
	      return fn.call(that, a, b);
	    };
	    case 3: return function (a, b, c) {
	      return fn.call(that, a, b, c);
	    };
	  }
	  return function (/* ...args */) {
	    return fn.apply(that, arguments);
	  };
	};


/***/ }),
/* 28 */
/***/ (function(module, exports) {

	module.exports = function (it) {
	  if (typeof it != 'function') throw TypeError(it + ' is not a function!');
	  return it;
	};


/***/ }),
/* 29 */
/***/ (function(module, exports, __webpack_require__) {

	var dP = __webpack_require__(30);
	var createDesc = __webpack_require__(38);
	module.exports = __webpack_require__(34) ? function (object, key, value) {
	  return dP.f(object, key, createDesc(1, value));
	} : function (object, key, value) {
	  object[key] = value;
	  return object;
	};


/***/ }),
/* 30 */
/***/ (function(module, exports, __webpack_require__) {

	var anObject = __webpack_require__(31);
	var IE8_DOM_DEFINE = __webpack_require__(33);
	var toPrimitive = __webpack_require__(37);
	var dP = Object.defineProperty;

	exports.f = __webpack_require__(34) ? Object.defineProperty : function defineProperty(O, P, Attributes) {
	  anObject(O);
	  P = toPrimitive(P, true);
	  anObject(Attributes);
	  if (IE8_DOM_DEFINE) try {
	    return dP(O, P, Attributes);
	  } catch (e) { /* empty */ }
	  if ('get' in Attributes || 'set' in Attributes) throw TypeError('Accessors not supported!');
	  if ('value' in Attributes) O[P] = Attributes.value;
	  return O;
	};


/***/ }),
/* 31 */
/***/ (function(module, exports, __webpack_require__) {

	var isObject = __webpack_require__(32);
	module.exports = function (it) {
	  if (!isObject(it)) throw TypeError(it + ' is not an object!');
	  return it;
	};


/***/ }),
/* 32 */
/***/ (function(module, exports) {

	module.exports = function (it) {
	  return typeof it === 'object' ? it !== null : typeof it === 'function';
	};


/***/ }),
/* 33 */
/***/ (function(module, exports, __webpack_require__) {

	module.exports = !__webpack_require__(34) && !__webpack_require__(35)(function () {
	  return Object.defineProperty(__webpack_require__(36)('div'), 'a', { get: function () { return 7; } }).a != 7;
	});


/***/ }),
/* 34 */
/***/ (function(module, exports, __webpack_require__) {

	// Thank's IE8 for his funny defineProperty
	module.exports = !__webpack_require__(35)(function () {
	  return Object.defineProperty({}, 'a', { get: function () { return 7; } }).a != 7;
	});


/***/ }),
/* 35 */
/***/ (function(module, exports) {

	module.exports = function (exec) {
	  try {
	    return !!exec();
	  } catch (e) {
	    return true;
	  }
	};


/***/ }),
/* 36 */
/***/ (function(module, exports, __webpack_require__) {

	var isObject = __webpack_require__(32);
	var document = __webpack_require__(21).document;
	// typeof document.createElement is 'object' in old IE
	var is = isObject(document) && isObject(document.createElement);
	module.exports = function (it) {
	  return is ? document.createElement(it) : {};
	};


/***/ }),
/* 37 */
/***/ (function(module, exports, __webpack_require__) {

	// 7.1.1 ToPrimitive(input [, PreferredType])
	var isObject = __webpack_require__(32);
	// instead of the ES6 spec version, we didn't implement @@toPrimitive case
	// and the second argument - flag - preferred type is a string
	module.exports = function (it, S) {
	  if (!isObject(it)) return it;
	  var fn, val;
	  if (S && typeof (fn = it.toString) == 'function' && !isObject(val = fn.call(it))) return val;
	  if (typeof (fn = it.valueOf) == 'function' && !isObject(val = fn.call(it))) return val;
	  if (!S && typeof (fn = it.toString) == 'function' && !isObject(val = fn.call(it))) return val;
	  throw TypeError("Can't convert object to primitive value");
	};


/***/ }),
/* 38 */
/***/ (function(module, exports) {

	module.exports = function (bitmap, value) {
	  return {
	    enumerable: !(bitmap & 1),
	    configurable: !(bitmap & 2),
	    writable: !(bitmap & 4),
	    value: value
	  };
	};


/***/ }),
/* 39 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {/**
	 * Copyright (c) 2013-present, Facebook, Inc.
	 *
	 * This source code is licensed under the MIT license found in the
	 * LICENSE file in the root directory of this source tree.
	 */

	'use strict';

	/**
	 * Use invariant() to assert state which your program assumes to be true.
	 *
	 * Provide sprintf-style format (only %s is supported) and arguments
	 * to provide information about what broke and what you were
	 * expecting.
	 *
	 * The invariant message will be stripped in production, but the invariant
	 * will remain to ensure logic does not differ in production.
	 */

	var invariant = function(condition, format, a, b, c, d, e, f) {
	  if (process.env.NODE_ENV !== 'production') {
	    if (format === undefined) {
	      throw new Error('invariant requires an error message argument');
	    }
	  }

	  if (!condition) {
	    var error;
	    if (format === undefined) {
	      error = new Error(
	        'Minified exception occurred; use the non-minified dev environment ' +
	        'for the full error message and additional helpful warnings.'
	      );
	    } else {
	      var args = [a, b, c, d, e, f];
	      var argIndex = 0;
	      error = new Error(
	        format.replace(/%s/g, function() { return args[argIndex++]; })
	      );
	      error.name = 'Invariant Violation';
	    }

	    error.framesToPop = 1; // we don't care about invariant's own frame
	    throw error;
	  }
	};

	module.exports = invariant;

	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(40)))

/***/ }),
/* 40 */
/***/ (function(module, exports) {

	// shim for using process in browser
	var process = module.exports = {};

	// cached from whatever global is present so that test runners that stub it
	// don't break things.  But we need to wrap it in a try catch in case it is
	// wrapped in strict mode code which doesn't define any globals.  It's inside a
	// function because try/catches deoptimize in certain engines.

	var cachedSetTimeout;
	var cachedClearTimeout;

	function defaultSetTimout() {
	    throw new Error('setTimeout has not been defined');
	}
	function defaultClearTimeout () {
	    throw new Error('clearTimeout has not been defined');
	}
	(function () {
	    try {
	        if (typeof setTimeout === 'function') {
	            cachedSetTimeout = setTimeout;
	        } else {
	            cachedSetTimeout = defaultSetTimout;
	        }
	    } catch (e) {
	        cachedSetTimeout = defaultSetTimout;
	    }
	    try {
	        if (typeof clearTimeout === 'function') {
	            cachedClearTimeout = clearTimeout;
	        } else {
	            cachedClearTimeout = defaultClearTimeout;
	        }
	    } catch (e) {
	        cachedClearTimeout = defaultClearTimeout;
	    }
	} ())
	function runTimeout(fun) {
	    if (cachedSetTimeout === setTimeout) {
	        //normal enviroments in sane situations
	        return setTimeout(fun, 0);
	    }
	    // if setTimeout wasn't available but was latter defined
	    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
	        cachedSetTimeout = setTimeout;
	        return setTimeout(fun, 0);
	    }
	    try {
	        // when when somebody has screwed with setTimeout but no I.E. maddness
	        return cachedSetTimeout(fun, 0);
	    } catch(e){
	        try {
	            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
	            return cachedSetTimeout.call(null, fun, 0);
	        } catch(e){
	            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
	            return cachedSetTimeout.call(this, fun, 0);
	        }
	    }


	}
	function runClearTimeout(marker) {
	    if (cachedClearTimeout === clearTimeout) {
	        //normal enviroments in sane situations
	        return clearTimeout(marker);
	    }
	    // if clearTimeout wasn't available but was latter defined
	    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
	        cachedClearTimeout = clearTimeout;
	        return clearTimeout(marker);
	    }
	    try {
	        // when when somebody has screwed with setTimeout but no I.E. maddness
	        return cachedClearTimeout(marker);
	    } catch (e){
	        try {
	            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
	            return cachedClearTimeout.call(null, marker);
	        } catch (e){
	            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
	            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
	            return cachedClearTimeout.call(this, marker);
	        }
	    }



	}
	var queue = [];
	var draining = false;
	var currentQueue;
	var queueIndex = -1;

	function cleanUpNextTick() {
	    if (!draining || !currentQueue) {
	        return;
	    }
	    draining = false;
	    if (currentQueue.length) {
	        queue = currentQueue.concat(queue);
	    } else {
	        queueIndex = -1;
	    }
	    if (queue.length) {
	        drainQueue();
	    }
	}

	function drainQueue() {
	    if (draining) {
	        return;
	    }
	    var timeout = runTimeout(cleanUpNextTick);
	    draining = true;

	    var len = queue.length;
	    while(len) {
	        currentQueue = queue;
	        queue = [];
	        while (++queueIndex < len) {
	            if (currentQueue) {
	                currentQueue[queueIndex].run();
	            }
	        }
	        queueIndex = -1;
	        len = queue.length;
	    }
	    currentQueue = null;
	    draining = false;
	    runClearTimeout(timeout);
	}

	process.nextTick = function (fun) {
	    var args = new Array(arguments.length - 1);
	    if (arguments.length > 1) {
	        for (var i = 1; i < arguments.length; i++) {
	            args[i - 1] = arguments[i];
	        }
	    }
	    queue.push(new Item(fun, args));
	    if (queue.length === 1 && !draining) {
	        runTimeout(drainQueue);
	    }
	};

	// v8 likes predictible objects
	function Item(fun, array) {
	    this.fun = fun;
	    this.array = array;
	}
	Item.prototype.run = function () {
	    this.fun.apply(null, this.array);
	};
	process.title = 'browser';
	process.browser = true;
	process.env = {};
	process.argv = [];
	process.version = ''; // empty string to avoid regexp issues
	process.versions = {};

	function noop() {}

	process.on = noop;
	process.addListener = noop;
	process.once = noop;
	process.off = noop;
	process.removeListener = noop;
	process.removeAllListeners = noop;
	process.emit = noop;
	process.prependListener = noop;
	process.prependOnceListener = noop;

	process.listeners = function (name) { return [] }

	process.binding = function (name) {
	    throw new Error('process.binding is not supported');
	};

	process.cwd = function () { return '/' };
	process.chdir = function (dir) {
	    throw new Error('process.chdir is not supported');
	};
	process.umask = function() { return 0; };


/***/ }),
/* 41 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});

	var _extends2 = __webpack_require__(42);

	var _extends3 = _interopRequireDefault(_extends2);

	var _slicedToArray2 = __webpack_require__(49);

	var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

	var _promise = __webpack_require__(74);

	var _promise2 = _interopRequireDefault(_promise);

	var _toConsumableArray2 = __webpack_require__(95);

	var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

	var _getPrototypeOf = __webpack_require__(100);

	var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

	var _classCallCheck2 = __webpack_require__(103);

	var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

	var _createClass2 = __webpack_require__(104);

	var _createClass3 = _interopRequireDefault(_createClass2);

	var _possibleConstructorReturn2 = __webpack_require__(108);

	var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

	var _inherits2 = __webpack_require__(125);

	var _inherits3 = _interopRequireDefault(_inherits2);

	exports.default = sortableContainer;

	var _react = __webpack_require__(133);

	var _react2 = _interopRequireDefault(_react);

	var _propTypes = __webpack_require__(134);

	var _propTypes2 = _interopRequireDefault(_propTypes);

	var _reactDom = __webpack_require__(143);

	var _invariant = __webpack_require__(39);

	var _invariant2 = _interopRequireDefault(_invariant);

	var _Manager = __webpack_require__(144);

	var _Manager2 = _interopRequireDefault(_Manager);

	var _utils = __webpack_require__(2);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	// Export Higher Order Sortable Container Component
	function sortableContainer(WrappedComponent) {
	  var _class, _temp;

	  var config = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { withRef: false };

	  return _temp = _class = function (_Component) {
	    (0, _inherits3.default)(_class, _Component);

	    function _class(props) {
	      (0, _classCallCheck3.default)(this, _class);

	      var _this = (0, _possibleConstructorReturn3.default)(this, (_class.__proto__ || (0, _getPrototypeOf2.default)(_class)).call(this, props));

	      _this.handleStart = function (event) {
	        var _this$props = _this.props,
	            distance = _this$props.distance,
	            shouldCancelStart = _this$props.shouldCancelStart;


	        if (event.button === 2 || shouldCancelStart(event)) {
	          return false;
	        }

	        _this._touched = true;
	        _this._pos = (0, _utils.getPosition)(event);

	        var node = (0, _utils.closest)(event.target, function (el) {
	          return el.sortableInfo != null;
	        });

	        if (node && node.sortableInfo && _this.nodeIsChild(node) && !_this.state.sorting) {
	          var useDragHandle = _this.props.useDragHandle;
	          var _node$sortableInfo = node.sortableInfo,
	              index = _node$sortableInfo.index,
	              collection = _node$sortableInfo.collection;


	          if (useDragHandle && !(0, _utils.closest)(event.target, function (el) {
	            return el.sortableHandle != null;
	          })) return;

	          _this.manager.active = { index: index, collection: collection };

	          /*
	          * Fixes a bug in Firefox where the :active state of anchor tags
	          * prevent subsequent 'mousemove' events from being fired
	          * (see https://github.com/clauderic/react-sortable-hoc/issues/118)
	          */
	          if (!(0, _utils.isTouchEvent)(event) && event.target.tagName.toLowerCase() === 'a') {
	            event.preventDefault();
	          }

	          if (!distance) {
	            if (_this.props.pressDelay === 0) {
	              _this.handlePress(event);
	            } else {
	              _this.pressTimer = setTimeout(function () {
	                return _this.handlePress(event);
	              }, _this.props.pressDelay);
	            }
	          }
	        }
	      };

	      _this.nodeIsChild = function (node) {
	        return node.sortableInfo.manager === _this.manager;
	      };

	      _this.handleMove = function (event) {
	        var _this$props2 = _this.props,
	            distance = _this$props2.distance,
	            pressThreshold = _this$props2.pressThreshold;


	        if (!_this.state.sorting && _this._touched) {
	          var position = (0, _utils.getPosition)(event);
	          var delta = _this._delta = {
	            x: _this._pos.x - position.x,
	            y: _this._pos.y - position.y
	          };
	          var combinedDelta = Math.abs(delta.x) + Math.abs(delta.y);

	          if (!distance && (!pressThreshold || pressThreshold && combinedDelta >= pressThreshold)) {
	            clearTimeout(_this.cancelTimer);
	            _this.cancelTimer = setTimeout(_this.cancel, 0);
	          } else if (distance && combinedDelta >= distance && _this.manager.isActive()) {
	            _this.handlePress(event);
	          }
	        }
	      };

	      _this.handleEnd = function () {
	        _this._touched = false;
	        _this.cancel();
	      };

	      _this.cancel = function () {
	        var distance = _this.props.distance;
	        var sorting = _this.state.sorting;


	        if (!sorting) {
	          if (!distance) {
	            clearTimeout(_this.pressTimer);
	          }
	          _this.manager.active = null;
	        }
	      };

	      _this.handlePress = function (event) {
	        var active = _this.manager.getActive();

	        if (active) {
	          var _this$props3 = _this.props,
	              axis = _this$props3.axis,
	              getHelperDimensions = _this$props3.getHelperDimensions,
	              helperClass = _this$props3.helperClass,
	              hideSortableGhost = _this$props3.hideSortableGhost,
	              onSortStart = _this$props3.onSortStart,
	              useWindowAsScrollContainer = _this$props3.useWindowAsScrollContainer;
	          var node = active.node,
	              collection = active.collection;
	          var index = node.sortableInfo.index;

	          var margin = (0, _utils.getElementMargin)(node);

	          var containerBoundingRect = _this.container.getBoundingClientRect();
	          var dimensions = getHelperDimensions({ index: index, node: node, collection: collection });

	          _this.node = node;
	          _this.margin = margin;
	          _this.width = dimensions.width;
	          _this.height = dimensions.height;
	          _this.marginOffset = {
	            x: _this.margin.left + _this.margin.right,
	            y: Math.max(_this.margin.top, _this.margin.bottom)
	          };
	          _this.boundingClientRect = node.getBoundingClientRect();
	          _this.containerBoundingRect = containerBoundingRect;
	          _this.index = index;
	          _this.newIndex = index;

	          _this.axis = {
	            x: axis.indexOf('x') >= 0,
	            y: axis.indexOf('y') >= 0
	          };
	          _this.offsetEdge = (0, _utils.getEdgeOffset)(node, _this.container);
	          _this.initialOffset = (0, _utils.getPosition)(event);
	          _this.initialScroll = {
	            top: _this.container.scrollTop,
	            left: _this.container.scrollLeft
	          };

	          _this.initialWindowScroll = {
	            top: window.pageYOffset,
	            left: window.pageXOffset
	          };

	          var fields = node.querySelectorAll('input, textarea, select');
	          var clonedNode = node.cloneNode(true);
	          var clonedFields = [].concat((0, _toConsumableArray3.default)(clonedNode.querySelectorAll('input, textarea, select'))); // Convert NodeList to Array

	          clonedFields.forEach(function (field, index) {
	            if (field.type !== 'file' && fields[index]) {
	              field.value = fields[index].value;
	            }
	          });

	          _this.helper = _this.document.body.appendChild(clonedNode);

	          _this.helper.style.position = 'fixed';
	          _this.helper.style.top = _this.boundingClientRect.top - margin.top + 'px';
	          _this.helper.style.left = _this.boundingClientRect.left - margin.left + 'px';
	          _this.helper.style.width = _this.width + 'px';
	          _this.helper.style.height = _this.height + 'px';
	          _this.helper.style.boxSizing = 'border-box';
	          _this.helper.style.pointerEvents = 'none';

	          if (hideSortableGhost) {
	            _this.sortableGhost = node;
	            node.style.visibility = 'hidden';
	            node.style.opacity = 0;
	          }

	          _this.minTranslate = {};
	          _this.maxTranslate = {};
	          if (_this.axis.x) {
	            _this.minTranslate.x = (useWindowAsScrollContainer ? 0 : containerBoundingRect.left) - _this.boundingClientRect.left - _this.width / 2;
	            _this.maxTranslate.x = (useWindowAsScrollContainer ? _this.contentWindow.innerWidth : containerBoundingRect.left + containerBoundingRect.width) - _this.boundingClientRect.left - _this.width / 2;
	          }
	          if (_this.axis.y) {
	            _this.minTranslate.y = (useWindowAsScrollContainer ? 0 : containerBoundingRect.top) - _this.boundingClientRect.top - _this.height / 2;
	            _this.maxTranslate.y = (useWindowAsScrollContainer ? _this.contentWindow.innerHeight : containerBoundingRect.top + containerBoundingRect.height) - _this.boundingClientRect.top - _this.height / 2;
	          }

	          if (helperClass) {
	            var _this$helper$classLis;

	            (_this$helper$classLis = _this.helper.classList).add.apply(_this$helper$classLis, (0, _toConsumableArray3.default)(helperClass.split(' ')));
	          }

	          _this.listenerNode = event.touches ? node : _this.contentWindow;
	          _utils.events.move.forEach(function (eventName) {
	            return _this.listenerNode.addEventListener(eventName, _this.handleSortMove, false);
	          });
	          _utils.events.end.forEach(function (eventName) {
	            return _this.listenerNode.addEventListener(eventName, _this.handleSortEnd, false);
	          });

	          _this.setState({
	            sorting: true,
	            sortingIndex: index
	          });

	          if (onSortStart) {
	            onSortStart({ node: node, index: index, collection: collection }, event);
	          }
	        }
	      };

	      _this.handleSortMove = function (event) {
	        var onSortMove = _this.props.onSortMove;

	        event.preventDefault(); // Prevent scrolling on mobile

	        _this.updatePosition(event);
	        _this.animateNodes();
	        _this.autoscroll();

	        if (onSortMove) {
	          onSortMove(event);
	        }
	      };

	      _this.handleSortEnd = function (event) {
	        var _this$props4 = _this.props,
	            hideSortableGhost = _this$props4.hideSortableGhost,
	            onSortEnd = _this$props4.onSortEnd;
	        var collection = _this.manager.active.collection;

	        // Remove the event listeners if the node is still in the DOM

	        if (_this.listenerNode) {
	          _utils.events.move.forEach(function (eventName) {
	            return _this.listenerNode.removeEventListener(eventName, _this.handleSortMove);
	          });
	          _utils.events.end.forEach(function (eventName) {
	            return _this.listenerNode.removeEventListener(eventName, _this.handleSortEnd);
	          });
	        }

	        // Remove the helper from the DOM
	        _this.helper.parentNode.removeChild(_this.helper);

	        if (hideSortableGhost && _this.sortableGhost) {
	          _this.sortableGhost.style.visibility = '';
	          _this.sortableGhost.style.opacity = '';
	        }

	        var nodes = _this.manager.refs[collection];
	        for (var i = 0, len = nodes.length; i < len; i++) {
	          var node = nodes[i];
	          var el = node.node;

	          // Clear the cached offsetTop / offsetLeft value
	          node.edgeOffset = null;

	          // Remove the transforms / transitions
	          el.style[_utils.vendorPrefix + 'Transform'] = '';
	          el.style[_utils.vendorPrefix + 'TransitionDuration'] = '';
	        }

	        // Stop autoscroll
	        clearInterval(_this.autoscrollInterval);
	        _this.autoscrollInterval = null;

	        // Update state
	        _this.manager.active = null;

	        _this.setState({
	          sorting: false,
	          sortingIndex: null
	        });

	        if (typeof onSortEnd === 'function') {
	          onSortEnd({
	            oldIndex: _this.index,
	            newIndex: _this.newIndex,
	            collection: collection
	          }, event);
	        }

	        _this._touched = false;
	      };

	      _this.autoscroll = function () {
	        var translate = _this.translate;
	        var direction = {
	          x: 0,
	          y: 0
	        };
	        var speed = {
	          x: 1,
	          y: 1
	        };
	        var acceleration = {
	          x: 10,
	          y: 10
	        };

	        if (translate.y >= _this.maxTranslate.y - _this.height / 2) {
	          direction.y = 1; // Scroll Down
	          speed.y = acceleration.y * Math.abs((_this.maxTranslate.y - _this.height / 2 - translate.y) / _this.height);
	        } else if (translate.x >= _this.maxTranslate.x - _this.width / 2) {
	          direction.x = 1; // Scroll Right
	          speed.x = acceleration.x * Math.abs((_this.maxTranslate.x - _this.width / 2 - translate.x) / _this.width);
	        } else if (translate.y <= _this.minTranslate.y + _this.height / 2) {
	          direction.y = -1; // Scroll Up
	          speed.y = acceleration.y * Math.abs((translate.y - _this.height / 2 - _this.minTranslate.y) / _this.height);
	        } else if (translate.x <= _this.minTranslate.x + _this.width / 2) {
	          direction.x = -1; // Scroll Left
	          speed.x = acceleration.x * Math.abs((translate.x - _this.width / 2 - _this.minTranslate.x) / _this.width);
	        }

	        if (_this.autoscrollInterval) {
	          clearInterval(_this.autoscrollInterval);
	          _this.autoscrollInterval = null;
	          _this.isAutoScrolling = false;
	        }

	        if (direction.x !== 0 || direction.y !== 0) {
	          _this.autoscrollInterval = setInterval(function () {
	            _this.isAutoScrolling = true;
	            var offset = {
	              left: 1 * speed.x * direction.x,
	              top: 1 * speed.y * direction.y
	            };
	            _this.scrollContainer.scrollTop += offset.top;
	            _this.scrollContainer.scrollLeft += offset.left;
	            _this.translate.x += offset.left;
	            _this.translate.y += offset.top;
	            _this.animateNodes();
	          }, 5);
	        }
	      };

	      _this.manager = new _Manager2.default();
	      _this.events = {
	        start: _this.handleStart,
	        move: _this.handleMove,
	        end: _this.handleEnd
	      };

	      (0, _invariant2.default)(!(props.distance && props.pressDelay), 'Attempted to set both `pressDelay` and `distance` on SortableContainer, you may only use one or the other, not both at the same time.');

	      _this.state = {};
	      return _this;
	    }

	    (0, _createClass3.default)(_class, [{
	      key: 'getChildContext',
	      value: function getChildContext() {
	        return {
	          manager: this.manager
	        };
	      }
	    }, {
	      key: 'componentDidMount',
	      value: function componentDidMount() {
	        var _this2 = this;

	        var useWindowAsScrollContainer = this.props.useWindowAsScrollContainer;

	        /*
	         *  Set our own default rather than using defaultProps because Jest
	         *  snapshots will serialize window, causing a RangeError
	         *  https://github.com/clauderic/react-sortable-hoc/issues/249
	         */

	        var container = this.getContainer();

	        _promise2.default.resolve(container).then(function (containerNode) {
	          _this2.container = containerNode;
	          _this2.document = _this2.container.ownerDocument || document;

	          var contentWindow = _this2.props.contentWindow || _this2.document.defaultView || window;

	          _this2.contentWindow = typeof contentWindow === 'function' ? contentWindow() : contentWindow;
	          _this2.scrollContainer = useWindowAsScrollContainer ? _this2.document.scrollingElement || _this2.document.documentElement : _this2.container;

	          var _loop = function _loop(key) {
	            if (_this2.events.hasOwnProperty(key)) {
	              _utils.events[key].forEach(function (eventName) {
	                return _this2.container.addEventListener(eventName, _this2.events[key], false);
	              });
	            }
	          };

	          for (var key in _this2.events) {
	            _loop(key);
	          }
	        });
	      }
	    }, {
	      key: 'componentWillUnmount',
	      value: function componentWillUnmount() {
	        var _this3 = this;

	        if (this.container) {
	          var _loop2 = function _loop2(key) {
	            if (_this3.events.hasOwnProperty(key)) {
	              _utils.events[key].forEach(function (eventName) {
	                return _this3.container.removeEventListener(eventName, _this3.events[key]);
	              });
	            }
	          };

	          for (var key in this.events) {
	            _loop2(key);
	          }
	        }
	      }
	    }, {
	      key: 'getLockPixelOffsets',
	      value: function getLockPixelOffsets() {
	        var width = this.width,
	            height = this.height;
	        var lockOffset = this.props.lockOffset;

	        var offsets = Array.isArray(lockOffset) ? lockOffset : [lockOffset, lockOffset];

	        (0, _invariant2.default)(offsets.length === 2, 'lockOffset prop of SortableContainer should be a single ' + 'value or an array of exactly two values. Given %s', lockOffset);

	        var _offsets = (0, _slicedToArray3.default)(offsets, 2),
	            minLockOffset = _offsets[0],
	            maxLockOffset = _offsets[1];

	        return [(0, _utils.getLockPixelOffset)({ lockOffset: minLockOffset, width: width, height: height }), (0, _utils.getLockPixelOffset)({ lockOffset: maxLockOffset, width: width, height: height })];
	      }
	    }, {
	      key: 'updatePosition',
	      value: function updatePosition(event) {
	        var _props = this.props,
	            lockAxis = _props.lockAxis,
	            lockToContainerEdges = _props.lockToContainerEdges;


	        var offset = (0, _utils.getPosition)(event);
	        var translate = {
	          x: offset.x - this.initialOffset.x,
	          y: offset.y - this.initialOffset.y
	        };

	        // Adjust for window scroll
	        translate.y -= window.pageYOffset - this.initialWindowScroll.top;
	        translate.x -= window.pageXOffset - this.initialWindowScroll.left;

	        this.translate = translate;

	        if (lockToContainerEdges) {
	          var _getLockPixelOffsets = this.getLockPixelOffsets(),
	              _getLockPixelOffsets2 = (0, _slicedToArray3.default)(_getLockPixelOffsets, 2),
	              minLockOffset = _getLockPixelOffsets2[0],
	              maxLockOffset = _getLockPixelOffsets2[1];

	          var minOffset = {
	            x: this.width / 2 - minLockOffset.x,
	            y: this.height / 2 - minLockOffset.y
	          };
	          var maxOffset = {
	            x: this.width / 2 - maxLockOffset.x,
	            y: this.height / 2 - maxLockOffset.y
	          };

	          translate.x = (0, _utils.limit)(this.minTranslate.x + minOffset.x, this.maxTranslate.x - maxOffset.x, translate.x);
	          translate.y = (0, _utils.limit)(this.minTranslate.y + minOffset.y, this.maxTranslate.y - maxOffset.y, translate.y);
	        }

	        if (lockAxis === 'x') {
	          translate.y = 0;
	        } else if (lockAxis === 'y') {
	          translate.x = 0;
	        }

	        this.helper.style[_utils.vendorPrefix + 'Transform'] = 'translate3d(' + translate.x + 'px,' + translate.y + 'px, 0)';
	      }
	    }, {
	      key: 'animateNodes',
	      value: function animateNodes() {
	        var _props2 = this.props,
	            transitionDuration = _props2.transitionDuration,
	            hideSortableGhost = _props2.hideSortableGhost,
	            onSortOver = _props2.onSortOver;

	        var nodes = this.manager.getOrderedRefs();
	        var containerScrollDelta = {
	          left: this.container.scrollLeft - this.initialScroll.left,
	          top: this.container.scrollTop - this.initialScroll.top
	        };
	        var sortingOffset = {
	          left: this.offsetEdge.left + this.translate.x + containerScrollDelta.left,
	          top: this.offsetEdge.top + this.translate.y + containerScrollDelta.top
	        };
	        var windowScrollDelta = {
	          top: window.pageYOffset - this.initialWindowScroll.top,
	          left: window.pageXOffset - this.initialWindowScroll.left
	        };
	        var prevIndex = this.newIndex;
	        this.newIndex = null;

	        for (var i = 0, len = nodes.length; i < len; i++) {
	          var node = nodes[i].node;

	          var index = node.sortableInfo.index;
	          var width = node.offsetWidth;
	          var height = node.offsetHeight;
	          var offset = {
	            width: this.width > width ? width / 2 : this.width / 2,
	            height: this.height > height ? height / 2 : this.height / 2
	          };

	          var translate = {
	            x: 0,
	            y: 0
	          };
	          var edgeOffset = nodes[i].edgeOffset;

	          // If we haven't cached the node's offsetTop / offsetLeft value

	          if (!edgeOffset) {
	            nodes[i].edgeOffset = edgeOffset = (0, _utils.getEdgeOffset)(node, this.container);
	          }

	          // Get a reference to the next and previous node
	          var nextNode = i < nodes.length - 1 && nodes[i + 1];
	          var prevNode = i > 0 && nodes[i - 1];

	          // Also cache the next node's edge offset if needed.
	          // We need this for calculating the animation in a grid setup
	          if (nextNode && !nextNode.edgeOffset) {
	            nextNode.edgeOffset = (0, _utils.getEdgeOffset)(nextNode.node, this.container);
	          }

	          // If the node is the one we're currently animating, skip it
	          if (index === this.index) {
	            if (hideSortableGhost) {
	              /*
	              * With windowing libraries such as `react-virtualized`, the sortableGhost
	              * node may change while scrolling down and then back up (or vice-versa),
	              * so we need to update the reference to the new node just to be safe.
	              */
	              this.sortableGhost = node;
	              node.style.visibility = 'hidden';
	              node.style.opacity = 0;
	            }
	            continue;
	          }

	          if (transitionDuration) {
	            node.style[_utils.vendorPrefix + 'TransitionDuration'] = transitionDuration + 'ms';
	          }

	          if (this.axis.x) {
	            if (this.axis.y) {
	              // Calculations for a grid setup
	              if (index < this.index && (sortingOffset.left + windowScrollDelta.left - offset.width <= edgeOffset.left && sortingOffset.top + windowScrollDelta.top <= edgeOffset.top + offset.height || sortingOffset.top + windowScrollDelta.top + offset.height <= edgeOffset.top)) {
	                // If the current node is to the left on the same row, or above the node that's being dragged
	                // then move it to the right
	                translate.x = this.width + this.marginOffset.x;
	                if (edgeOffset.left + translate.x > this.containerBoundingRect.width - offset.width) {
	                  // If it moves passed the right bounds, then animate it to the first position of the next row.
	                  // We just use the offset of the next node to calculate where to move, because that node's original position
	                  // is exactly where we want to go
	                  translate.x = nextNode.edgeOffset.left - edgeOffset.left;
	                  translate.y = nextNode.edgeOffset.top - edgeOffset.top;
	                }
	                if (this.newIndex === null) {
	                  this.newIndex = index;
	                }
	              } else if (index > this.index && (sortingOffset.left + windowScrollDelta.left + offset.width >= edgeOffset.left && sortingOffset.top + windowScrollDelta.top + offset.height >= edgeOffset.top || sortingOffset.top + windowScrollDelta.top + offset.height >= edgeOffset.top + height)) {
	                // If the current node is to the right on the same row, or below the node that's being dragged
	                // then move it to the left
	                translate.x = -(this.width + this.marginOffset.x);
	                if (edgeOffset.left + translate.x < this.containerBoundingRect.left + offset.width) {
	                  // If it moves passed the left bounds, then animate it to the last position of the previous row.
	                  // We just use the offset of the previous node to calculate where to move, because that node's original position
	                  // is exactly where we want to go
	                  translate.x = prevNode.edgeOffset.left - edgeOffset.left;
	                  translate.y = prevNode.edgeOffset.top - edgeOffset.top;
	                }
	                this.newIndex = index;
	              }
	            } else {
	              if (index > this.index && sortingOffset.left + windowScrollDelta.left + offset.width >= edgeOffset.left) {
	                translate.x = -(this.width + this.marginOffset.x);
	                this.newIndex = index;
	              } else if (index < this.index && sortingOffset.left + windowScrollDelta.left <= edgeOffset.left + offset.width) {
	                translate.x = this.width + this.marginOffset.x;
	                if (this.newIndex == null) {
	                  this.newIndex = index;
	                }
	              }
	            }
	          } else if (this.axis.y) {
	            if (index > this.index && sortingOffset.top + windowScrollDelta.top + offset.height >= edgeOffset.top) {
	              translate.y = -(this.height + this.marginOffset.y);
	              this.newIndex = index;
	            } else if (index < this.index && sortingOffset.top + windowScrollDelta.top <= edgeOffset.top + offset.height) {
	              translate.y = this.height + this.marginOffset.y;
	              if (this.newIndex == null) {
	                this.newIndex = index;
	              }
	            }
	          }
	          node.style[_utils.vendorPrefix + 'Transform'] = 'translate3d(' + translate.x + 'px,' + translate.y + 'px,0)';
	        }

	        if (this.newIndex == null) {
	          this.newIndex = this.index;
	        }

	        if (onSortOver && this.newIndex !== prevIndex) {
	          onSortOver({
	            newIndex: this.newIndex,
	            oldIndex: prevIndex,
	            index: this.index,
	            collection: this.manager.active.collection
	          });
	        }
	      }
	    }, {
	      key: 'getWrappedInstance',
	      value: function getWrappedInstance() {
	        (0, _invariant2.default)(config.withRef, 'To access the wrapped instance, you need to pass in {withRef: true} as the second argument of the SortableContainer() call');

	        return this.refs.wrappedInstance;
	      }
	    }, {
	      key: 'getContainer',
	      value: function getContainer() {
	        var getContainer = this.props.getContainer;


	        if (typeof getContainer !== 'function') {
	          return (0, _reactDom.findDOMNode)(this);
	        }

	        return getContainer(config.withRef ? this.getWrappedInstance() : undefined);
	      }
	    }, {
	      key: 'render',
	      value: function render() {
	        var ref = config.withRef ? 'wrappedInstance' : null;

	        return _react2.default.createElement(WrappedComponent, (0, _extends3.default)({
	          ref: ref
	        }, (0, _utils.omit)(this.props, 'contentWindow', 'useWindowAsScrollContainer', 'distance', 'helperClass', 'hideSortableGhost', 'transitionDuration', 'useDragHandle', 'pressDelay', 'pressThreshold', 'shouldCancelStart', 'onSortStart', 'onSortMove', 'onSortEnd', 'axis', 'lockAxis', 'lockOffset', 'lockToContainerEdges', 'getContainer', 'getHelperDimensions')));
	      }
	    }]);
	    return _class;
	  }(_react.Component), _class.displayName = (0, _utils.provideDisplayName)('sortableList', WrappedComponent), _class.defaultProps = {
	    axis: 'y',
	    transitionDuration: 300,
	    pressDelay: 0,
	    pressThreshold: 5,
	    distance: 0,
	    useWindowAsScrollContainer: false,
	    hideSortableGhost: true,
	    shouldCancelStart: function shouldCancelStart(e) {
	      // Cancel sorting if the event target is an `input`, `textarea`, `select` or `option`
	      var disabledElements = ['input', 'textarea', 'select', 'option', 'button'];

	      if (disabledElements.indexOf(e.target.tagName.toLowerCase()) !== -1) {
	        return true; // Return true to cancel sorting
	      }
	    },
	    lockToContainerEdges: false,
	    lockOffset: '50%',
	    getHelperDimensions: function getHelperDimensions(_ref) {
	      var node = _ref.node;
	      return {
	        width: node.offsetWidth,
	        height: node.offsetHeight
	      };
	    }
	  }, _class.propTypes = {
	    axis: _propTypes2.default.oneOf(['x', 'y', 'xy']),
	    distance: _propTypes2.default.number,
	    lockAxis: _propTypes2.default.string,
	    helperClass: _propTypes2.default.string,
	    transitionDuration: _propTypes2.default.number,
	    contentWindow: _propTypes2.default.any,
	    onSortStart: _propTypes2.default.func,
	    onSortMove: _propTypes2.default.func,
	    onSortOver: _propTypes2.default.func,
	    onSortEnd: _propTypes2.default.func,
	    shouldCancelStart: _propTypes2.default.func,
	    pressDelay: _propTypes2.default.number,
	    useDragHandle: _propTypes2.default.bool,
	    useWindowAsScrollContainer: _propTypes2.default.bool,
	    hideSortableGhost: _propTypes2.default.bool,
	    lockToContainerEdges: _propTypes2.default.bool,
	    lockOffset: _propTypes2.default.oneOfType([_propTypes2.default.number, _propTypes2.default.string, _propTypes2.default.arrayOf(_propTypes2.default.oneOfType([_propTypes2.default.number, _propTypes2.default.string]))]),
	    getContainer: _propTypes2.default.func,
	    getHelperDimensions: _propTypes2.default.func
	  }, _class.childContextTypes = {
	    manager: _propTypes2.default.object.isRequired
	  }, _temp;
	}

/***/ }),
/* 42 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	exports.__esModule = true;

	var _assign = __webpack_require__(43);

	var _assign2 = _interopRequireDefault(_assign);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	exports.default = _assign2.default || function (target) {
	  for (var i = 1; i < arguments.length; i++) {
	    var source = arguments[i];

	    for (var key in source) {
	      if (Object.prototype.hasOwnProperty.call(source, key)) {
	        target[key] = source[key];
	      }
	    }
	  }

	  return target;
	};

/***/ }),
/* 43 */
/***/ (function(module, exports, __webpack_require__) {

	module.exports = { "default": __webpack_require__(44), __esModule: true };

/***/ }),
/* 44 */
/***/ (function(module, exports, __webpack_require__) {

	__webpack_require__(45);
	module.exports = __webpack_require__(20).Object.assign;


/***/ }),
/* 45 */
/***/ (function(module, exports, __webpack_require__) {

	// 19.1.3.1 Object.assign(target, source)
	var $export = __webpack_require__(26);

	$export($export.S + $export.F, 'Object', { assign: __webpack_require__(46) });


/***/ }),
/* 46 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	// 19.1.2.1 Object.assign(target, source, ...)
	var getKeys = __webpack_require__(8);
	var gOPS = __webpack_require__(47);
	var pIE = __webpack_require__(48);
	var toObject = __webpack_require__(6);
	var IObject = __webpack_require__(12);
	var $assign = Object.assign;

	// should work with symbols and should have deterministic property order (V8 bug)
	module.exports = !$assign || __webpack_require__(35)(function () {
	  var A = {};
	  var B = {};
	  // eslint-disable-next-line no-undef
	  var S = Symbol();
	  var K = 'abcdefghijklmnopqrst';
	  A[S] = 7;
	  K.split('').forEach(function (k) { B[k] = k; });
	  return $assign({}, A)[S] != 7 || Object.keys($assign({}, B)).join('') != K;
	}) ? function assign(target, source) { // eslint-disable-line no-unused-vars
	  var T = toObject(target);
	  var aLen = arguments.length;
	  var index = 1;
	  var getSymbols = gOPS.f;
	  var isEnum = pIE.f;
	  while (aLen > index) {
	    var S = IObject(arguments[index++]);
	    var keys = getSymbols ? getKeys(S).concat(getSymbols(S)) : getKeys(S);
	    var length = keys.length;
	    var j = 0;
	    var key;
	    while (length > j) if (isEnum.call(S, key = keys[j++])) T[key] = S[key];
	  } return T;
	} : $assign;


/***/ }),
/* 47 */
/***/ (function(module, exports) {

	exports.f = Object.getOwnPropertySymbols;


/***/ }),
/* 48 */
/***/ (function(module, exports) {

	exports.f = {}.propertyIsEnumerable;


/***/ }),
/* 49 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	exports.__esModule = true;

	var _isIterable2 = __webpack_require__(50);

	var _isIterable3 = _interopRequireDefault(_isIterable2);

	var _getIterator2 = __webpack_require__(70);

	var _getIterator3 = _interopRequireDefault(_getIterator2);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	exports.default = function () {
	  function sliceIterator(arr, i) {
	    var _arr = [];
	    var _n = true;
	    var _d = false;
	    var _e = undefined;

	    try {
	      for (var _i = (0, _getIterator3.default)(arr), _s; !(_n = (_s = _i.next()).done); _n = true) {
	        _arr.push(_s.value);

	        if (i && _arr.length === i) break;
	      }
	    } catch (err) {
	      _d = true;
	      _e = err;
	    } finally {
	      try {
	        if (!_n && _i["return"]) _i["return"]();
	      } finally {
	        if (_d) throw _e;
	      }
	    }

	    return _arr;
	  }

	  return function (arr, i) {
	    if (Array.isArray(arr)) {
	      return arr;
	    } else if ((0, _isIterable3.default)(Object(arr))) {
	      return sliceIterator(arr, i);
	    } else {
	      throw new TypeError("Invalid attempt to destructure non-iterable instance");
	    }
	  };
	}();

/***/ }),
/* 50 */
/***/ (function(module, exports, __webpack_require__) {

	module.exports = { "default": __webpack_require__(51), __esModule: true };

/***/ }),
/* 51 */
/***/ (function(module, exports, __webpack_require__) {

	__webpack_require__(52);
	__webpack_require__(66);
	module.exports = __webpack_require__(68);


/***/ }),
/* 52 */
/***/ (function(module, exports, __webpack_require__) {

	__webpack_require__(53);
	var global = __webpack_require__(21);
	var hide = __webpack_require__(29);
	var Iterators = __webpack_require__(56);
	var TO_STRING_TAG = __webpack_require__(64)('toStringTag');

	var DOMIterables = ('CSSRuleList,CSSStyleDeclaration,CSSValueList,ClientRectList,DOMRectList,DOMStringList,' +
	  'DOMTokenList,DataTransferItemList,FileList,HTMLAllCollection,HTMLCollection,HTMLFormElement,HTMLSelectElement,' +
	  'MediaList,MimeTypeArray,NamedNodeMap,NodeList,PaintRequestList,Plugin,PluginArray,SVGLengthList,SVGNumberList,' +
	  'SVGPathSegList,SVGPointList,SVGStringList,SVGTransformList,SourceBufferList,StyleSheetList,TextTrackCueList,' +
	  'TextTrackList,TouchList').split(',');

	for (var i = 0; i < DOMIterables.length; i++) {
	  var NAME = DOMIterables[i];
	  var Collection = global[NAME];
	  var proto = Collection && Collection.prototype;
	  if (proto && !proto[TO_STRING_TAG]) hide(proto, TO_STRING_TAG, NAME);
	  Iterators[NAME] = Iterators.Array;
	}


/***/ }),
/* 53 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	var addToUnscopables = __webpack_require__(54);
	var step = __webpack_require__(55);
	var Iterators = __webpack_require__(56);
	var toIObject = __webpack_require__(11);

	// 22.1.3.4 Array.prototype.entries()
	// 22.1.3.13 Array.prototype.keys()
	// 22.1.3.29 Array.prototype.values()
	// 22.1.3.30 Array.prototype[@@iterator]()
	module.exports = __webpack_require__(57)(Array, 'Array', function (iterated, kind) {
	  this._t = toIObject(iterated); // target
	  this._i = 0;                   // next index
	  this._k = kind;                // kind
	// 22.1.5.2.1 %ArrayIteratorPrototype%.next()
	}, function () {
	  var O = this._t;
	  var kind = this._k;
	  var index = this._i++;
	  if (!O || index >= O.length) {
	    this._t = undefined;
	    return step(1);
	  }
	  if (kind == 'keys') return step(0, index);
	  if (kind == 'values') return step(0, O[index]);
	  return step(0, [index, O[index]]);
	}, 'values');

	// argumentsList[@@iterator] is %ArrayProto_values% (9.4.4.6, 9.4.4.7)
	Iterators.Arguments = Iterators.Array;

	addToUnscopables('keys');
	addToUnscopables('values');
	addToUnscopables('entries');


/***/ }),
/* 54 */
/***/ (function(module, exports) {

	module.exports = function () { /* empty */ };


/***/ }),
/* 55 */
/***/ (function(module, exports) {

	module.exports = function (done, value) {
	  return { value: value, done: !!done };
	};


/***/ }),
/* 56 */
/***/ (function(module, exports) {

	module.exports = {};


/***/ }),
/* 57 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	var LIBRARY = __webpack_require__(22);
	var $export = __webpack_require__(26);
	var redefine = __webpack_require__(58);
	var hide = __webpack_require__(29);
	var Iterators = __webpack_require__(56);
	var $iterCreate = __webpack_require__(59);
	var setToStringTag = __webpack_require__(63);
	var getPrototypeOf = __webpack_require__(65);
	var ITERATOR = __webpack_require__(64)('iterator');
	var BUGGY = !([].keys && 'next' in [].keys()); // Safari has buggy iterators w/o `next`
	var FF_ITERATOR = '@@iterator';
	var KEYS = 'keys';
	var VALUES = 'values';

	var returnThis = function () { return this; };

	module.exports = function (Base, NAME, Constructor, next, DEFAULT, IS_SET, FORCED) {
	  $iterCreate(Constructor, NAME, next);
	  var getMethod = function (kind) {
	    if (!BUGGY && kind in proto) return proto[kind];
	    switch (kind) {
	      case KEYS: return function keys() { return new Constructor(this, kind); };
	      case VALUES: return function values() { return new Constructor(this, kind); };
	    } return function entries() { return new Constructor(this, kind); };
	  };
	  var TAG = NAME + ' Iterator';
	  var DEF_VALUES = DEFAULT == VALUES;
	  var VALUES_BUG = false;
	  var proto = Base.prototype;
	  var $native = proto[ITERATOR] || proto[FF_ITERATOR] || DEFAULT && proto[DEFAULT];
	  var $default = $native || getMethod(DEFAULT);
	  var $entries = DEFAULT ? !DEF_VALUES ? $default : getMethod('entries') : undefined;
	  var $anyNative = NAME == 'Array' ? proto.entries || $native : $native;
	  var methods, key, IteratorPrototype;
	  // Fix native
	  if ($anyNative) {
	    IteratorPrototype = getPrototypeOf($anyNative.call(new Base()));
	    if (IteratorPrototype !== Object.prototype && IteratorPrototype.next) {
	      // Set @@toStringTag to native iterators
	      setToStringTag(IteratorPrototype, TAG, true);
	      // fix for some old engines
	      if (!LIBRARY && typeof IteratorPrototype[ITERATOR] != 'function') hide(IteratorPrototype, ITERATOR, returnThis);
	    }
	  }
	  // fix Array#{values, @@iterator}.name in V8 / FF
	  if (DEF_VALUES && $native && $native.name !== VALUES) {
	    VALUES_BUG = true;
	    $default = function values() { return $native.call(this); };
	  }
	  // Define iterator
	  if ((!LIBRARY || FORCED) && (BUGGY || VALUES_BUG || !proto[ITERATOR])) {
	    hide(proto, ITERATOR, $default);
	  }
	  // Plug for library
	  Iterators[NAME] = $default;
	  Iterators[TAG] = returnThis;
	  if (DEFAULT) {
	    methods = {
	      values: DEF_VALUES ? $default : getMethod(VALUES),
	      keys: IS_SET ? $default : getMethod(KEYS),
	      entries: $entries
	    };
	    if (FORCED) for (key in methods) {
	      if (!(key in proto)) redefine(proto, key, methods[key]);
	    } else $export($export.P + $export.F * (BUGGY || VALUES_BUG), NAME, methods);
	  }
	  return methods;
	};


/***/ }),
/* 58 */
/***/ (function(module, exports, __webpack_require__) {

	module.exports = __webpack_require__(29);


/***/ }),
/* 59 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	var create = __webpack_require__(60);
	var descriptor = __webpack_require__(38);
	var setToStringTag = __webpack_require__(63);
	var IteratorPrototype = {};

	// 25.1.2.1.1 %IteratorPrototype%[@@iterator]()
	__webpack_require__(29)(IteratorPrototype, __webpack_require__(64)('iterator'), function () { return this; });

	module.exports = function (Constructor, NAME, next) {
	  Constructor.prototype = create(IteratorPrototype, { next: descriptor(1, next) });
	  setToStringTag(Constructor, NAME + ' Iterator');
	};


/***/ }),
/* 60 */
/***/ (function(module, exports, __webpack_require__) {

	// 19.1.2.2 / 15.2.3.5 Object.create(O [, Properties])
	var anObject = __webpack_require__(31);
	var dPs = __webpack_require__(61);
	var enumBugKeys = __webpack_require__(24);
	var IE_PROTO = __webpack_require__(18)('IE_PROTO');
	var Empty = function () { /* empty */ };
	var PROTOTYPE = 'prototype';

	// Create object with fake `null` prototype: use iframe Object with cleared prototype
	var createDict = function () {
	  // Thrash, waste and sodomy: IE GC bug
	  var iframe = __webpack_require__(36)('iframe');
	  var i = enumBugKeys.length;
	  var lt = '<';
	  var gt = '>';
	  var iframeDocument;
	  iframe.style.display = 'none';
	  __webpack_require__(62).appendChild(iframe);
	  iframe.src = 'javascript:'; // eslint-disable-line no-script-url
	  // createDict = iframe.contentWindow.Object;
	  // html.removeChild(iframe);
	  iframeDocument = iframe.contentWindow.document;
	  iframeDocument.open();
	  iframeDocument.write(lt + 'script' + gt + 'document.F=Object' + lt + '/script' + gt);
	  iframeDocument.close();
	  createDict = iframeDocument.F;
	  while (i--) delete createDict[PROTOTYPE][enumBugKeys[i]];
	  return createDict();
	};

	module.exports = Object.create || function create(O, Properties) {
	  var result;
	  if (O !== null) {
	    Empty[PROTOTYPE] = anObject(O);
	    result = new Empty();
	    Empty[PROTOTYPE] = null;
	    // add "__proto__" for Object.getPrototypeOf polyfill
	    result[IE_PROTO] = O;
	  } else result = createDict();
	  return Properties === undefined ? result : dPs(result, Properties);
	};


/***/ }),
/* 61 */
/***/ (function(module, exports, __webpack_require__) {

	var dP = __webpack_require__(30);
	var anObject = __webpack_require__(31);
	var getKeys = __webpack_require__(8);

	module.exports = __webpack_require__(34) ? Object.defineProperties : function defineProperties(O, Properties) {
	  anObject(O);
	  var keys = getKeys(Properties);
	  var length = keys.length;
	  var i = 0;
	  var P;
	  while (length > i) dP.f(O, P = keys[i++], Properties[P]);
	  return O;
	};


/***/ }),
/* 62 */
/***/ (function(module, exports, __webpack_require__) {

	var document = __webpack_require__(21).document;
	module.exports = document && document.documentElement;


/***/ }),
/* 63 */
/***/ (function(module, exports, __webpack_require__) {

	var def = __webpack_require__(30).f;
	var has = __webpack_require__(10);
	var TAG = __webpack_require__(64)('toStringTag');

	module.exports = function (it, tag, stat) {
	  if (it && !has(it = stat ? it : it.prototype, TAG)) def(it, TAG, { configurable: true, value: tag });
	};


/***/ }),
/* 64 */
/***/ (function(module, exports, __webpack_require__) {

	var store = __webpack_require__(19)('wks');
	var uid = __webpack_require__(23);
	var Symbol = __webpack_require__(21).Symbol;
	var USE_SYMBOL = typeof Symbol == 'function';

	var $exports = module.exports = function (name) {
	  return store[name] || (store[name] =
	    USE_SYMBOL && Symbol[name] || (USE_SYMBOL ? Symbol : uid)('Symbol.' + name));
	};

	$exports.store = store;


/***/ }),
/* 65 */
/***/ (function(module, exports, __webpack_require__) {

	// 19.1.2.9 / 15.2.3.2 Object.getPrototypeOf(O)
	var has = __webpack_require__(10);
	var toObject = __webpack_require__(6);
	var IE_PROTO = __webpack_require__(18)('IE_PROTO');
	var ObjectProto = Object.prototype;

	module.exports = Object.getPrototypeOf || function (O) {
	  O = toObject(O);
	  if (has(O, IE_PROTO)) return O[IE_PROTO];
	  if (typeof O.constructor == 'function' && O instanceof O.constructor) {
	    return O.constructor.prototype;
	  } return O instanceof Object ? ObjectProto : null;
	};


/***/ }),
/* 66 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	var $at = __webpack_require__(67)(true);

	// 21.1.3.27 String.prototype[@@iterator]()
	__webpack_require__(57)(String, 'String', function (iterated) {
	  this._t = String(iterated); // target
	  this._i = 0;                // next index
	// 21.1.5.2.1 %StringIteratorPrototype%.next()
	}, function () {
	  var O = this._t;
	  var index = this._i;
	  var point;
	  if (index >= O.length) return { value: undefined, done: true };
	  point = $at(O, index);
	  this._i += point.length;
	  return { value: point, done: false };
	});


/***/ }),
/* 67 */
/***/ (function(module, exports, __webpack_require__) {

	var toInteger = __webpack_require__(16);
	var defined = __webpack_require__(7);
	// true  -> String#at
	// false -> String#codePointAt
	module.exports = function (TO_STRING) {
	  return function (that, pos) {
	    var s = String(defined(that));
	    var i = toInteger(pos);
	    var l = s.length;
	    var a, b;
	    if (i < 0 || i >= l) return TO_STRING ? '' : undefined;
	    a = s.charCodeAt(i);
	    return a < 0xd800 || a > 0xdbff || i + 1 === l || (b = s.charCodeAt(i + 1)) < 0xdc00 || b > 0xdfff
	      ? TO_STRING ? s.charAt(i) : a
	      : TO_STRING ? s.slice(i, i + 2) : (a - 0xd800 << 10) + (b - 0xdc00) + 0x10000;
	  };
	};


/***/ }),
/* 68 */
/***/ (function(module, exports, __webpack_require__) {

	var classof = __webpack_require__(69);
	var ITERATOR = __webpack_require__(64)('iterator');
	var Iterators = __webpack_require__(56);
	module.exports = __webpack_require__(20).isIterable = function (it) {
	  var O = Object(it);
	  return O[ITERATOR] !== undefined
	    || '@@iterator' in O
	    // eslint-disable-next-line no-prototype-builtins
	    || Iterators.hasOwnProperty(classof(O));
	};


/***/ }),
/* 69 */
/***/ (function(module, exports, __webpack_require__) {

	// getting tag from 19.1.3.6 Object.prototype.toString()
	var cof = __webpack_require__(13);
	var TAG = __webpack_require__(64)('toStringTag');
	// ES3 wrong here
	var ARG = cof(function () { return arguments; }()) == 'Arguments';

	// fallback for IE11 Script Access Denied error
	var tryGet = function (it, key) {
	  try {
	    return it[key];
	  } catch (e) { /* empty */ }
	};

	module.exports = function (it) {
	  var O, T, B;
	  return it === undefined ? 'Undefined' : it === null ? 'Null'
	    // @@toStringTag case
	    : typeof (T = tryGet(O = Object(it), TAG)) == 'string' ? T
	    // builtinTag case
	    : ARG ? cof(O)
	    // ES3 arguments fallback
	    : (B = cof(O)) == 'Object' && typeof O.callee == 'function' ? 'Arguments' : B;
	};


/***/ }),
/* 70 */
/***/ (function(module, exports, __webpack_require__) {

	module.exports = { "default": __webpack_require__(71), __esModule: true };

/***/ }),
/* 71 */
/***/ (function(module, exports, __webpack_require__) {

	__webpack_require__(52);
	__webpack_require__(66);
	module.exports = __webpack_require__(72);


/***/ }),
/* 72 */
/***/ (function(module, exports, __webpack_require__) {

	var anObject = __webpack_require__(31);
	var get = __webpack_require__(73);
	module.exports = __webpack_require__(20).getIterator = function (it) {
	  var iterFn = get(it);
	  if (typeof iterFn != 'function') throw TypeError(it + ' is not iterable!');
	  return anObject(iterFn.call(it));
	};


/***/ }),
/* 73 */
/***/ (function(module, exports, __webpack_require__) {

	var classof = __webpack_require__(69);
	var ITERATOR = __webpack_require__(64)('iterator');
	var Iterators = __webpack_require__(56);
	module.exports = __webpack_require__(20).getIteratorMethod = function (it) {
	  if (it != undefined) return it[ITERATOR]
	    || it['@@iterator']
	    || Iterators[classof(it)];
	};


/***/ }),
/* 74 */
/***/ (function(module, exports, __webpack_require__) {

	module.exports = { "default": __webpack_require__(75), __esModule: true };

/***/ }),
/* 75 */
/***/ (function(module, exports, __webpack_require__) {

	__webpack_require__(76);
	__webpack_require__(66);
	__webpack_require__(52);
	__webpack_require__(77);
	__webpack_require__(93);
	__webpack_require__(94);
	module.exports = __webpack_require__(20).Promise;


/***/ }),
/* 76 */
/***/ (function(module, exports) {

	

/***/ }),
/* 77 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	var LIBRARY = __webpack_require__(22);
	var global = __webpack_require__(21);
	var ctx = __webpack_require__(27);
	var classof = __webpack_require__(69);
	var $export = __webpack_require__(26);
	var isObject = __webpack_require__(32);
	var aFunction = __webpack_require__(28);
	var anInstance = __webpack_require__(78);
	var forOf = __webpack_require__(79);
	var speciesConstructor = __webpack_require__(82);
	var task = __webpack_require__(83).set;
	var microtask = __webpack_require__(85)();
	var newPromiseCapabilityModule = __webpack_require__(86);
	var perform = __webpack_require__(87);
	var userAgent = __webpack_require__(88);
	var promiseResolve = __webpack_require__(89);
	var PROMISE = 'Promise';
	var TypeError = global.TypeError;
	var process = global.process;
	var versions = process && process.versions;
	var v8 = versions && versions.v8 || '';
	var $Promise = global[PROMISE];
	var isNode = classof(process) == 'process';
	var empty = function () { /* empty */ };
	var Internal, newGenericPromiseCapability, OwnPromiseCapability, Wrapper;
	var newPromiseCapability = newGenericPromiseCapability = newPromiseCapabilityModule.f;

	var USE_NATIVE = !!function () {
	  try {
	    // correct subclassing with @@species support
	    var promise = $Promise.resolve(1);
	    var FakePromise = (promise.constructor = {})[__webpack_require__(64)('species')] = function (exec) {
	      exec(empty, empty);
	    };
	    // unhandled rejections tracking support, NodeJS Promise without it fails @@species test
	    return (isNode || typeof PromiseRejectionEvent == 'function')
	      && promise.then(empty) instanceof FakePromise
	      // v8 6.6 (Node 10 and Chrome 66) have a bug with resolving custom thenables
	      // https://bugs.chromium.org/p/chromium/issues/detail?id=830565
	      // we can't detect it synchronously, so just check versions
	      && v8.indexOf('6.6') !== 0
	      && userAgent.indexOf('Chrome/66') === -1;
	  } catch (e) { /* empty */ }
	}();

	// helpers
	var isThenable = function (it) {
	  var then;
	  return isObject(it) && typeof (then = it.then) == 'function' ? then : false;
	};
	var notify = function (promise, isReject) {
	  if (promise._n) return;
	  promise._n = true;
	  var chain = promise._c;
	  microtask(function () {
	    var value = promise._v;
	    var ok = promise._s == 1;
	    var i = 0;
	    var run = function (reaction) {
	      var handler = ok ? reaction.ok : reaction.fail;
	      var resolve = reaction.resolve;
	      var reject = reaction.reject;
	      var domain = reaction.domain;
	      var result, then, exited;
	      try {
	        if (handler) {
	          if (!ok) {
	            if (promise._h == 2) onHandleUnhandled(promise);
	            promise._h = 1;
	          }
	          if (handler === true) result = value;
	          else {
	            if (domain) domain.enter();
	            result = handler(value); // may throw
	            if (domain) {
	              domain.exit();
	              exited = true;
	            }
	          }
	          if (result === reaction.promise) {
	            reject(TypeError('Promise-chain cycle'));
	          } else if (then = isThenable(result)) {
	            then.call(result, resolve, reject);
	          } else resolve(result);
	        } else reject(value);
	      } catch (e) {
	        if (domain && !exited) domain.exit();
	        reject(e);
	      }
	    };
	    while (chain.length > i) run(chain[i++]); // variable length - can't use forEach
	    promise._c = [];
	    promise._n = false;
	    if (isReject && !promise._h) onUnhandled(promise);
	  });
	};
	var onUnhandled = function (promise) {
	  task.call(global, function () {
	    var value = promise._v;
	    var unhandled = isUnhandled(promise);
	    var result, handler, console;
	    if (unhandled) {
	      result = perform(function () {
	        if (isNode) {
	          process.emit('unhandledRejection', value, promise);
	        } else if (handler = global.onunhandledrejection) {
	          handler({ promise: promise, reason: value });
	        } else if ((console = global.console) && console.error) {
	          console.error('Unhandled promise rejection', value);
	        }
	      });
	      // Browsers should not trigger `rejectionHandled` event if it was handled here, NodeJS - should
	      promise._h = isNode || isUnhandled(promise) ? 2 : 1;
	    } promise._a = undefined;
	    if (unhandled && result.e) throw result.v;
	  });
	};
	var isUnhandled = function (promise) {
	  return promise._h !== 1 && (promise._a || promise._c).length === 0;
	};
	var onHandleUnhandled = function (promise) {
	  task.call(global, function () {
	    var handler;
	    if (isNode) {
	      process.emit('rejectionHandled', promise);
	    } else if (handler = global.onrejectionhandled) {
	      handler({ promise: promise, reason: promise._v });
	    }
	  });
	};
	var $reject = function (value) {
	  var promise = this;
	  if (promise._d) return;
	  promise._d = true;
	  promise = promise._w || promise; // unwrap
	  promise._v = value;
	  promise._s = 2;
	  if (!promise._a) promise._a = promise._c.slice();
	  notify(promise, true);
	};
	var $resolve = function (value) {
	  var promise = this;
	  var then;
	  if (promise._d) return;
	  promise._d = true;
	  promise = promise._w || promise; // unwrap
	  try {
	    if (promise === value) throw TypeError("Promise can't be resolved itself");
	    if (then = isThenable(value)) {
	      microtask(function () {
	        var wrapper = { _w: promise, _d: false }; // wrap
	        try {
	          then.call(value, ctx($resolve, wrapper, 1), ctx($reject, wrapper, 1));
	        } catch (e) {
	          $reject.call(wrapper, e);
	        }
	      });
	    } else {
	      promise._v = value;
	      promise._s = 1;
	      notify(promise, false);
	    }
	  } catch (e) {
	    $reject.call({ _w: promise, _d: false }, e); // wrap
	  }
	};

	// constructor polyfill
	if (!USE_NATIVE) {
	  // 25.4.3.1 Promise(executor)
	  $Promise = function Promise(executor) {
	    anInstance(this, $Promise, PROMISE, '_h');
	    aFunction(executor);
	    Internal.call(this);
	    try {
	      executor(ctx($resolve, this, 1), ctx($reject, this, 1));
	    } catch (err) {
	      $reject.call(this, err);
	    }
	  };
	  // eslint-disable-next-line no-unused-vars
	  Internal = function Promise(executor) {
	    this._c = [];             // <- awaiting reactions
	    this._a = undefined;      // <- checked in isUnhandled reactions
	    this._s = 0;              // <- state
	    this._d = false;          // <- done
	    this._v = undefined;      // <- value
	    this._h = 0;              // <- rejection state, 0 - default, 1 - handled, 2 - unhandled
	    this._n = false;          // <- notify
	  };
	  Internal.prototype = __webpack_require__(90)($Promise.prototype, {
	    // 25.4.5.3 Promise.prototype.then(onFulfilled, onRejected)
	    then: function then(onFulfilled, onRejected) {
	      var reaction = newPromiseCapability(speciesConstructor(this, $Promise));
	      reaction.ok = typeof onFulfilled == 'function' ? onFulfilled : true;
	      reaction.fail = typeof onRejected == 'function' && onRejected;
	      reaction.domain = isNode ? process.domain : undefined;
	      this._c.push(reaction);
	      if (this._a) this._a.push(reaction);
	      if (this._s) notify(this, false);
	      return reaction.promise;
	    },
	    // 25.4.5.1 Promise.prototype.catch(onRejected)
	    'catch': function (onRejected) {
	      return this.then(undefined, onRejected);
	    }
	  });
	  OwnPromiseCapability = function () {
	    var promise = new Internal();
	    this.promise = promise;
	    this.resolve = ctx($resolve, promise, 1);
	    this.reject = ctx($reject, promise, 1);
	  };
	  newPromiseCapabilityModule.f = newPromiseCapability = function (C) {
	    return C === $Promise || C === Wrapper
	      ? new OwnPromiseCapability(C)
	      : newGenericPromiseCapability(C);
	  };
	}

	$export($export.G + $export.W + $export.F * !USE_NATIVE, { Promise: $Promise });
	__webpack_require__(63)($Promise, PROMISE);
	__webpack_require__(91)(PROMISE);
	Wrapper = __webpack_require__(20)[PROMISE];

	// statics
	$export($export.S + $export.F * !USE_NATIVE, PROMISE, {
	  // 25.4.4.5 Promise.reject(r)
	  reject: function reject(r) {
	    var capability = newPromiseCapability(this);
	    var $$reject = capability.reject;
	    $$reject(r);
	    return capability.promise;
	  }
	});
	$export($export.S + $export.F * (LIBRARY || !USE_NATIVE), PROMISE, {
	  // 25.4.4.6 Promise.resolve(x)
	  resolve: function resolve(x) {
	    return promiseResolve(LIBRARY && this === Wrapper ? $Promise : this, x);
	  }
	});
	$export($export.S + $export.F * !(USE_NATIVE && __webpack_require__(92)(function (iter) {
	  $Promise.all(iter)['catch'](empty);
	})), PROMISE, {
	  // 25.4.4.1 Promise.all(iterable)
	  all: function all(iterable) {
	    var C = this;
	    var capability = newPromiseCapability(C);
	    var resolve = capability.resolve;
	    var reject = capability.reject;
	    var result = perform(function () {
	      var values = [];
	      var index = 0;
	      var remaining = 1;
	      forOf(iterable, false, function (promise) {
	        var $index = index++;
	        var alreadyCalled = false;
	        values.push(undefined);
	        remaining++;
	        C.resolve(promise).then(function (value) {
	          if (alreadyCalled) return;
	          alreadyCalled = true;
	          values[$index] = value;
	          --remaining || resolve(values);
	        }, reject);
	      });
	      --remaining || resolve(values);
	    });
	    if (result.e) reject(result.v);
	    return capability.promise;
	  },
	  // 25.4.4.4 Promise.race(iterable)
	  race: function race(iterable) {
	    var C = this;
	    var capability = newPromiseCapability(C);
	    var reject = capability.reject;
	    var result = perform(function () {
	      forOf(iterable, false, function (promise) {
	        C.resolve(promise).then(capability.resolve, reject);
	      });
	    });
	    if (result.e) reject(result.v);
	    return capability.promise;
	  }
	});


/***/ }),
/* 78 */
/***/ (function(module, exports) {

	module.exports = function (it, Constructor, name, forbiddenField) {
	  if (!(it instanceof Constructor) || (forbiddenField !== undefined && forbiddenField in it)) {
	    throw TypeError(name + ': incorrect invocation!');
	  } return it;
	};


/***/ }),
/* 79 */
/***/ (function(module, exports, __webpack_require__) {

	var ctx = __webpack_require__(27);
	var call = __webpack_require__(80);
	var isArrayIter = __webpack_require__(81);
	var anObject = __webpack_require__(31);
	var toLength = __webpack_require__(15);
	var getIterFn = __webpack_require__(73);
	var BREAK = {};
	var RETURN = {};
	var exports = module.exports = function (iterable, entries, fn, that, ITERATOR) {
	  var iterFn = ITERATOR ? function () { return iterable; } : getIterFn(iterable);
	  var f = ctx(fn, that, entries ? 2 : 1);
	  var index = 0;
	  var length, step, iterator, result;
	  if (typeof iterFn != 'function') throw TypeError(iterable + ' is not iterable!');
	  // fast case for arrays with default iterator
	  if (isArrayIter(iterFn)) for (length = toLength(iterable.length); length > index; index++) {
	    result = entries ? f(anObject(step = iterable[index])[0], step[1]) : f(iterable[index]);
	    if (result === BREAK || result === RETURN) return result;
	  } else for (iterator = iterFn.call(iterable); !(step = iterator.next()).done;) {
	    result = call(iterator, f, step.value, entries);
	    if (result === BREAK || result === RETURN) return result;
	  }
	};
	exports.BREAK = BREAK;
	exports.RETURN = RETURN;


/***/ }),
/* 80 */
/***/ (function(module, exports, __webpack_require__) {

	// call something on iterator step with safe closing on error
	var anObject = __webpack_require__(31);
	module.exports = function (iterator, fn, value, entries) {
	  try {
	    return entries ? fn(anObject(value)[0], value[1]) : fn(value);
	  // 7.4.6 IteratorClose(iterator, completion)
	  } catch (e) {
	    var ret = iterator['return'];
	    if (ret !== undefined) anObject(ret.call(iterator));
	    throw e;
	  }
	};


/***/ }),
/* 81 */
/***/ (function(module, exports, __webpack_require__) {

	// check on default Array iterator
	var Iterators = __webpack_require__(56);
	var ITERATOR = __webpack_require__(64)('iterator');
	var ArrayProto = Array.prototype;

	module.exports = function (it) {
	  return it !== undefined && (Iterators.Array === it || ArrayProto[ITERATOR] === it);
	};


/***/ }),
/* 82 */
/***/ (function(module, exports, __webpack_require__) {

	// 7.3.20 SpeciesConstructor(O, defaultConstructor)
	var anObject = __webpack_require__(31);
	var aFunction = __webpack_require__(28);
	var SPECIES = __webpack_require__(64)('species');
	module.exports = function (O, D) {
	  var C = anObject(O).constructor;
	  var S;
	  return C === undefined || (S = anObject(C)[SPECIES]) == undefined ? D : aFunction(S);
	};


/***/ }),
/* 83 */
/***/ (function(module, exports, __webpack_require__) {

	var ctx = __webpack_require__(27);
	var invoke = __webpack_require__(84);
	var html = __webpack_require__(62);
	var cel = __webpack_require__(36);
	var global = __webpack_require__(21);
	var process = global.process;
	var setTask = global.setImmediate;
	var clearTask = global.clearImmediate;
	var MessageChannel = global.MessageChannel;
	var Dispatch = global.Dispatch;
	var counter = 0;
	var queue = {};
	var ONREADYSTATECHANGE = 'onreadystatechange';
	var defer, channel, port;
	var run = function () {
	  var id = +this;
	  // eslint-disable-next-line no-prototype-builtins
	  if (queue.hasOwnProperty(id)) {
	    var fn = queue[id];
	    delete queue[id];
	    fn();
	  }
	};
	var listener = function (event) {
	  run.call(event.data);
	};
	// Node.js 0.9+ & IE10+ has setImmediate, otherwise:
	if (!setTask || !clearTask) {
	  setTask = function setImmediate(fn) {
	    var args = [];
	    var i = 1;
	    while (arguments.length > i) args.push(arguments[i++]);
	    queue[++counter] = function () {
	      // eslint-disable-next-line no-new-func
	      invoke(typeof fn == 'function' ? fn : Function(fn), args);
	    };
	    defer(counter);
	    return counter;
	  };
	  clearTask = function clearImmediate(id) {
	    delete queue[id];
	  };
	  // Node.js 0.8-
	  if (__webpack_require__(13)(process) == 'process') {
	    defer = function (id) {
	      process.nextTick(ctx(run, id, 1));
	    };
	  // Sphere (JS game engine) Dispatch API
	  } else if (Dispatch && Dispatch.now) {
	    defer = function (id) {
	      Dispatch.now(ctx(run, id, 1));
	    };
	  // Browsers with MessageChannel, includes WebWorkers
	  } else if (MessageChannel) {
	    channel = new MessageChannel();
	    port = channel.port2;
	    channel.port1.onmessage = listener;
	    defer = ctx(port.postMessage, port, 1);
	  // Browsers with postMessage, skip WebWorkers
	  // IE8 has postMessage, but it's sync & typeof its postMessage is 'object'
	  } else if (global.addEventListener && typeof postMessage == 'function' && !global.importScripts) {
	    defer = function (id) {
	      global.postMessage(id + '', '*');
	    };
	    global.addEventListener('message', listener, false);
	  // IE8-
	  } else if (ONREADYSTATECHANGE in cel('script')) {
	    defer = function (id) {
	      html.appendChild(cel('script'))[ONREADYSTATECHANGE] = function () {
	        html.removeChild(this);
	        run.call(id);
	      };
	    };
	  // Rest old browsers
	  } else {
	    defer = function (id) {
	      setTimeout(ctx(run, id, 1), 0);
	    };
	  }
	}
	module.exports = {
	  set: setTask,
	  clear: clearTask
	};


/***/ }),
/* 84 */
/***/ (function(module, exports) {

	// fast apply, http://jsperf.lnkit.com/fast-apply/5
	module.exports = function (fn, args, that) {
	  var un = that === undefined;
	  switch (args.length) {
	    case 0: return un ? fn()
	                      : fn.call(that);
	    case 1: return un ? fn(args[0])
	                      : fn.call(that, args[0]);
	    case 2: return un ? fn(args[0], args[1])
	                      : fn.call(that, args[0], args[1]);
	    case 3: return un ? fn(args[0], args[1], args[2])
	                      : fn.call(that, args[0], args[1], args[2]);
	    case 4: return un ? fn(args[0], args[1], args[2], args[3])
	                      : fn.call(that, args[0], args[1], args[2], args[3]);
	  } return fn.apply(that, args);
	};


/***/ }),
/* 85 */
/***/ (function(module, exports, __webpack_require__) {

	var global = __webpack_require__(21);
	var macrotask = __webpack_require__(83).set;
	var Observer = global.MutationObserver || global.WebKitMutationObserver;
	var process = global.process;
	var Promise = global.Promise;
	var isNode = __webpack_require__(13)(process) == 'process';

	module.exports = function () {
	  var head, last, notify;

	  var flush = function () {
	    var parent, fn;
	    if (isNode && (parent = process.domain)) parent.exit();
	    while (head) {
	      fn = head.fn;
	      head = head.next;
	      try {
	        fn();
	      } catch (e) {
	        if (head) notify();
	        else last = undefined;
	        throw e;
	      }
	    } last = undefined;
	    if (parent) parent.enter();
	  };

	  // Node.js
	  if (isNode) {
	    notify = function () {
	      process.nextTick(flush);
	    };
	  // browsers with MutationObserver, except iOS Safari - https://github.com/zloirock/core-js/issues/339
	  } else if (Observer && !(global.navigator && global.navigator.standalone)) {
	    var toggle = true;
	    var node = document.createTextNode('');
	    new Observer(flush).observe(node, { characterData: true }); // eslint-disable-line no-new
	    notify = function () {
	      node.data = toggle = !toggle;
	    };
	  // environments with maybe non-completely correct, but existent Promise
	  } else if (Promise && Promise.resolve) {
	    // Promise.resolve without an argument throws an error in LG WebOS 2
	    var promise = Promise.resolve(undefined);
	    notify = function () {
	      promise.then(flush);
	    };
	  // for other environments - macrotask based on:
	  // - setImmediate
	  // - MessageChannel
	  // - window.postMessag
	  // - onreadystatechange
	  // - setTimeout
	  } else {
	    notify = function () {
	      // strange IE + webpack dev server bug - use .call(global)
	      macrotask.call(global, flush);
	    };
	  }

	  return function (fn) {
	    var task = { fn: fn, next: undefined };
	    if (last) last.next = task;
	    if (!head) {
	      head = task;
	      notify();
	    } last = task;
	  };
	};


/***/ }),
/* 86 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	// 25.4.1.5 NewPromiseCapability(C)
	var aFunction = __webpack_require__(28);

	function PromiseCapability(C) {
	  var resolve, reject;
	  this.promise = new C(function ($$resolve, $$reject) {
	    if (resolve !== undefined || reject !== undefined) throw TypeError('Bad Promise constructor');
	    resolve = $$resolve;
	    reject = $$reject;
	  });
	  this.resolve = aFunction(resolve);
	  this.reject = aFunction(reject);
	}

	module.exports.f = function (C) {
	  return new PromiseCapability(C);
	};


/***/ }),
/* 87 */
/***/ (function(module, exports) {

	module.exports = function (exec) {
	  try {
	    return { e: false, v: exec() };
	  } catch (e) {
	    return { e: true, v: e };
	  }
	};


/***/ }),
/* 88 */
/***/ (function(module, exports, __webpack_require__) {

	var global = __webpack_require__(21);
	var navigator = global.navigator;

	module.exports = navigator && navigator.userAgent || '';


/***/ }),
/* 89 */
/***/ (function(module, exports, __webpack_require__) {

	var anObject = __webpack_require__(31);
	var isObject = __webpack_require__(32);
	var newPromiseCapability = __webpack_require__(86);

	module.exports = function (C, x) {
	  anObject(C);
	  if (isObject(x) && x.constructor === C) return x;
	  var promiseCapability = newPromiseCapability.f(C);
	  var resolve = promiseCapability.resolve;
	  resolve(x);
	  return promiseCapability.promise;
	};


/***/ }),
/* 90 */
/***/ (function(module, exports, __webpack_require__) {

	var hide = __webpack_require__(29);
	module.exports = function (target, src, safe) {
	  for (var key in src) {
	    if (safe && target[key]) target[key] = src[key];
	    else hide(target, key, src[key]);
	  } return target;
	};


/***/ }),
/* 91 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	var global = __webpack_require__(21);
	var core = __webpack_require__(20);
	var dP = __webpack_require__(30);
	var DESCRIPTORS = __webpack_require__(34);
	var SPECIES = __webpack_require__(64)('species');

	module.exports = function (KEY) {
	  var C = typeof core[KEY] == 'function' ? core[KEY] : global[KEY];
	  if (DESCRIPTORS && C && !C[SPECIES]) dP.f(C, SPECIES, {
	    configurable: true,
	    get: function () { return this; }
	  });
	};


/***/ }),
/* 92 */
/***/ (function(module, exports, __webpack_require__) {

	var ITERATOR = __webpack_require__(64)('iterator');
	var SAFE_CLOSING = false;

	try {
	  var riter = [7][ITERATOR]();
	  riter['return'] = function () { SAFE_CLOSING = true; };
	  // eslint-disable-next-line no-throw-literal
	  Array.from(riter, function () { throw 2; });
	} catch (e) { /* empty */ }

	module.exports = function (exec, skipClosing) {
	  if (!skipClosing && !SAFE_CLOSING) return false;
	  var safe = false;
	  try {
	    var arr = [7];
	    var iter = arr[ITERATOR]();
	    iter.next = function () { return { done: safe = true }; };
	    arr[ITERATOR] = function () { return iter; };
	    exec(arr);
	  } catch (e) { /* empty */ }
	  return safe;
	};


/***/ }),
/* 93 */
/***/ (function(module, exports, __webpack_require__) {

	// https://github.com/tc39/proposal-promise-finally
	'use strict';
	var $export = __webpack_require__(26);
	var core = __webpack_require__(20);
	var global = __webpack_require__(21);
	var speciesConstructor = __webpack_require__(82);
	var promiseResolve = __webpack_require__(89);

	$export($export.P + $export.R, 'Promise', { 'finally': function (onFinally) {
	  var C = speciesConstructor(this, core.Promise || global.Promise);
	  var isFunction = typeof onFinally == 'function';
	  return this.then(
	    isFunction ? function (x) {
	      return promiseResolve(C, onFinally()).then(function () { return x; });
	    } : onFinally,
	    isFunction ? function (e) {
	      return promiseResolve(C, onFinally()).then(function () { throw e; });
	    } : onFinally
	  );
	} });


/***/ }),
/* 94 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	// https://github.com/tc39/proposal-promise-try
	var $export = __webpack_require__(26);
	var newPromiseCapability = __webpack_require__(86);
	var perform = __webpack_require__(87);

	$export($export.S, 'Promise', { 'try': function (callbackfn) {
	  var promiseCapability = newPromiseCapability.f(this);
	  var result = perform(callbackfn);
	  (result.e ? promiseCapability.reject : promiseCapability.resolve)(result.v);
	  return promiseCapability.promise;
	} });


/***/ }),
/* 95 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	exports.__esModule = true;

	var _from = __webpack_require__(96);

	var _from2 = _interopRequireDefault(_from);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	exports.default = function (arr) {
	  if (Array.isArray(arr)) {
	    for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
	      arr2[i] = arr[i];
	    }

	    return arr2;
	  } else {
	    return (0, _from2.default)(arr);
	  }
	};

/***/ }),
/* 96 */
/***/ (function(module, exports, __webpack_require__) {

	module.exports = { "default": __webpack_require__(97), __esModule: true };

/***/ }),
/* 97 */
/***/ (function(module, exports, __webpack_require__) {

	__webpack_require__(66);
	__webpack_require__(98);
	module.exports = __webpack_require__(20).Array.from;


/***/ }),
/* 98 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	var ctx = __webpack_require__(27);
	var $export = __webpack_require__(26);
	var toObject = __webpack_require__(6);
	var call = __webpack_require__(80);
	var isArrayIter = __webpack_require__(81);
	var toLength = __webpack_require__(15);
	var createProperty = __webpack_require__(99);
	var getIterFn = __webpack_require__(73);

	$export($export.S + $export.F * !__webpack_require__(92)(function (iter) { Array.from(iter); }), 'Array', {
	  // 22.1.2.1 Array.from(arrayLike, mapfn = undefined, thisArg = undefined)
	  from: function from(arrayLike /* , mapfn = undefined, thisArg = undefined */) {
	    var O = toObject(arrayLike);
	    var C = typeof this == 'function' ? this : Array;
	    var aLen = arguments.length;
	    var mapfn = aLen > 1 ? arguments[1] : undefined;
	    var mapping = mapfn !== undefined;
	    var index = 0;
	    var iterFn = getIterFn(O);
	    var length, result, step, iterator;
	    if (mapping) mapfn = ctx(mapfn, aLen > 2 ? arguments[2] : undefined, 2);
	    // if object isn't iterable or it's array with default iterator - use simple case
	    if (iterFn != undefined && !(C == Array && isArrayIter(iterFn))) {
	      for (iterator = iterFn.call(O), result = new C(); !(step = iterator.next()).done; index++) {
	        createProperty(result, index, mapping ? call(iterator, mapfn, [step.value, index], true) : step.value);
	      }
	    } else {
	      length = toLength(O.length);
	      for (result = new C(length); length > index; index++) {
	        createProperty(result, index, mapping ? mapfn(O[index], index) : O[index]);
	      }
	    }
	    result.length = index;
	    return result;
	  }
	});


/***/ }),
/* 99 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	var $defineProperty = __webpack_require__(30);
	var createDesc = __webpack_require__(38);

	module.exports = function (object, index, value) {
	  if (index in object) $defineProperty.f(object, index, createDesc(0, value));
	  else object[index] = value;
	};


/***/ }),
/* 100 */
/***/ (function(module, exports, __webpack_require__) {

	module.exports = { "default": __webpack_require__(101), __esModule: true };

/***/ }),
/* 101 */
/***/ (function(module, exports, __webpack_require__) {

	__webpack_require__(102);
	module.exports = __webpack_require__(20).Object.getPrototypeOf;


/***/ }),
/* 102 */
/***/ (function(module, exports, __webpack_require__) {

	// 19.1.2.9 Object.getPrototypeOf(O)
	var toObject = __webpack_require__(6);
	var $getPrototypeOf = __webpack_require__(65);

	__webpack_require__(25)('getPrototypeOf', function () {
	  return function getPrototypeOf(it) {
	    return $getPrototypeOf(toObject(it));
	  };
	});


/***/ }),
/* 103 */
/***/ (function(module, exports) {

	"use strict";

	exports.__esModule = true;

	exports.default = function (instance, Constructor) {
	  if (!(instance instanceof Constructor)) {
	    throw new TypeError("Cannot call a class as a function");
	  }
	};

/***/ }),
/* 104 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	exports.__esModule = true;

	var _defineProperty = __webpack_require__(105);

	var _defineProperty2 = _interopRequireDefault(_defineProperty);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	exports.default = function () {
	  function defineProperties(target, props) {
	    for (var i = 0; i < props.length; i++) {
	      var descriptor = props[i];
	      descriptor.enumerable = descriptor.enumerable || false;
	      descriptor.configurable = true;
	      if ("value" in descriptor) descriptor.writable = true;
	      (0, _defineProperty2.default)(target, descriptor.key, descriptor);
	    }
	  }

	  return function (Constructor, protoProps, staticProps) {
	    if (protoProps) defineProperties(Constructor.prototype, protoProps);
	    if (staticProps) defineProperties(Constructor, staticProps);
	    return Constructor;
	  };
	}();

/***/ }),
/* 105 */
/***/ (function(module, exports, __webpack_require__) {

	module.exports = { "default": __webpack_require__(106), __esModule: true };

/***/ }),
/* 106 */
/***/ (function(module, exports, __webpack_require__) {

	__webpack_require__(107);
	var $Object = __webpack_require__(20).Object;
	module.exports = function defineProperty(it, key, desc) {
	  return $Object.defineProperty(it, key, desc);
	};


/***/ }),
/* 107 */
/***/ (function(module, exports, __webpack_require__) {

	var $export = __webpack_require__(26);
	// 19.1.2.4 / 15.2.3.6 Object.defineProperty(O, P, Attributes)
	$export($export.S + $export.F * !__webpack_require__(34), 'Object', { defineProperty: __webpack_require__(30).f });


/***/ }),
/* 108 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	exports.__esModule = true;

	var _typeof2 = __webpack_require__(109);

	var _typeof3 = _interopRequireDefault(_typeof2);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	exports.default = function (self, call) {
	  if (!self) {
	    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
	  }

	  return call && ((typeof call === "undefined" ? "undefined" : (0, _typeof3.default)(call)) === "object" || typeof call === "function") ? call : self;
	};

/***/ }),
/* 109 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	exports.__esModule = true;

	var _iterator = __webpack_require__(110);

	var _iterator2 = _interopRequireDefault(_iterator);

	var _symbol = __webpack_require__(113);

	var _symbol2 = _interopRequireDefault(_symbol);

	var _typeof = typeof _symbol2.default === "function" && typeof _iterator2.default === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof _symbol2.default === "function" && obj.constructor === _symbol2.default && obj !== _symbol2.default.prototype ? "symbol" : typeof obj; };

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	exports.default = typeof _symbol2.default === "function" && _typeof(_iterator2.default) === "symbol" ? function (obj) {
	  return typeof obj === "undefined" ? "undefined" : _typeof(obj);
	} : function (obj) {
	  return obj && typeof _symbol2.default === "function" && obj.constructor === _symbol2.default && obj !== _symbol2.default.prototype ? "symbol" : typeof obj === "undefined" ? "undefined" : _typeof(obj);
	};

/***/ }),
/* 110 */
/***/ (function(module, exports, __webpack_require__) {

	module.exports = { "default": __webpack_require__(111), __esModule: true };

/***/ }),
/* 111 */
/***/ (function(module, exports, __webpack_require__) {

	__webpack_require__(66);
	__webpack_require__(52);
	module.exports = __webpack_require__(112).f('iterator');


/***/ }),
/* 112 */
/***/ (function(module, exports, __webpack_require__) {

	exports.f = __webpack_require__(64);


/***/ }),
/* 113 */
/***/ (function(module, exports, __webpack_require__) {

	module.exports = { "default": __webpack_require__(114), __esModule: true };

/***/ }),
/* 114 */
/***/ (function(module, exports, __webpack_require__) {

	__webpack_require__(115);
	__webpack_require__(76);
	__webpack_require__(123);
	__webpack_require__(124);
	module.exports = __webpack_require__(20).Symbol;


/***/ }),
/* 115 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	// ECMAScript 6 symbols shim
	var global = __webpack_require__(21);
	var has = __webpack_require__(10);
	var DESCRIPTORS = __webpack_require__(34);
	var $export = __webpack_require__(26);
	var redefine = __webpack_require__(58);
	var META = __webpack_require__(116).KEY;
	var $fails = __webpack_require__(35);
	var shared = __webpack_require__(19);
	var setToStringTag = __webpack_require__(63);
	var uid = __webpack_require__(23);
	var wks = __webpack_require__(64);
	var wksExt = __webpack_require__(112);
	var wksDefine = __webpack_require__(117);
	var enumKeys = __webpack_require__(118);
	var isArray = __webpack_require__(119);
	var anObject = __webpack_require__(31);
	var isObject = __webpack_require__(32);
	var toIObject = __webpack_require__(11);
	var toPrimitive = __webpack_require__(37);
	var createDesc = __webpack_require__(38);
	var _create = __webpack_require__(60);
	var gOPNExt = __webpack_require__(120);
	var $GOPD = __webpack_require__(122);
	var $DP = __webpack_require__(30);
	var $keys = __webpack_require__(8);
	var gOPD = $GOPD.f;
	var dP = $DP.f;
	var gOPN = gOPNExt.f;
	var $Symbol = global.Symbol;
	var $JSON = global.JSON;
	var _stringify = $JSON && $JSON.stringify;
	var PROTOTYPE = 'prototype';
	var HIDDEN = wks('_hidden');
	var TO_PRIMITIVE = wks('toPrimitive');
	var isEnum = {}.propertyIsEnumerable;
	var SymbolRegistry = shared('symbol-registry');
	var AllSymbols = shared('symbols');
	var OPSymbols = shared('op-symbols');
	var ObjectProto = Object[PROTOTYPE];
	var USE_NATIVE = typeof $Symbol == 'function';
	var QObject = global.QObject;
	// Don't use setters in Qt Script, https://github.com/zloirock/core-js/issues/173
	var setter = !QObject || !QObject[PROTOTYPE] || !QObject[PROTOTYPE].findChild;

	// fallback for old Android, https://code.google.com/p/v8/issues/detail?id=687
	var setSymbolDesc = DESCRIPTORS && $fails(function () {
	  return _create(dP({}, 'a', {
	    get: function () { return dP(this, 'a', { value: 7 }).a; }
	  })).a != 7;
	}) ? function (it, key, D) {
	  var protoDesc = gOPD(ObjectProto, key);
	  if (protoDesc) delete ObjectProto[key];
	  dP(it, key, D);
	  if (protoDesc && it !== ObjectProto) dP(ObjectProto, key, protoDesc);
	} : dP;

	var wrap = function (tag) {
	  var sym = AllSymbols[tag] = _create($Symbol[PROTOTYPE]);
	  sym._k = tag;
	  return sym;
	};

	var isSymbol = USE_NATIVE && typeof $Symbol.iterator == 'symbol' ? function (it) {
	  return typeof it == 'symbol';
	} : function (it) {
	  return it instanceof $Symbol;
	};

	var $defineProperty = function defineProperty(it, key, D) {
	  if (it === ObjectProto) $defineProperty(OPSymbols, key, D);
	  anObject(it);
	  key = toPrimitive(key, true);
	  anObject(D);
	  if (has(AllSymbols, key)) {
	    if (!D.enumerable) {
	      if (!has(it, HIDDEN)) dP(it, HIDDEN, createDesc(1, {}));
	      it[HIDDEN][key] = true;
	    } else {
	      if (has(it, HIDDEN) && it[HIDDEN][key]) it[HIDDEN][key] = false;
	      D = _create(D, { enumerable: createDesc(0, false) });
	    } return setSymbolDesc(it, key, D);
	  } return dP(it, key, D);
	};
	var $defineProperties = function defineProperties(it, P) {
	  anObject(it);
	  var keys = enumKeys(P = toIObject(P));
	  var i = 0;
	  var l = keys.length;
	  var key;
	  while (l > i) $defineProperty(it, key = keys[i++], P[key]);
	  return it;
	};
	var $create = function create(it, P) {
	  return P === undefined ? _create(it) : $defineProperties(_create(it), P);
	};
	var $propertyIsEnumerable = function propertyIsEnumerable(key) {
	  var E = isEnum.call(this, key = toPrimitive(key, true));
	  if (this === ObjectProto && has(AllSymbols, key) && !has(OPSymbols, key)) return false;
	  return E || !has(this, key) || !has(AllSymbols, key) || has(this, HIDDEN) && this[HIDDEN][key] ? E : true;
	};
	var $getOwnPropertyDescriptor = function getOwnPropertyDescriptor(it, key) {
	  it = toIObject(it);
	  key = toPrimitive(key, true);
	  if (it === ObjectProto && has(AllSymbols, key) && !has(OPSymbols, key)) return;
	  var D = gOPD(it, key);
	  if (D && has(AllSymbols, key) && !(has(it, HIDDEN) && it[HIDDEN][key])) D.enumerable = true;
	  return D;
	};
	var $getOwnPropertyNames = function getOwnPropertyNames(it) {
	  var names = gOPN(toIObject(it));
	  var result = [];
	  var i = 0;
	  var key;
	  while (names.length > i) {
	    if (!has(AllSymbols, key = names[i++]) && key != HIDDEN && key != META) result.push(key);
	  } return result;
	};
	var $getOwnPropertySymbols = function getOwnPropertySymbols(it) {
	  var IS_OP = it === ObjectProto;
	  var names = gOPN(IS_OP ? OPSymbols : toIObject(it));
	  var result = [];
	  var i = 0;
	  var key;
	  while (names.length > i) {
	    if (has(AllSymbols, key = names[i++]) && (IS_OP ? has(ObjectProto, key) : true)) result.push(AllSymbols[key]);
	  } return result;
	};

	// 19.4.1.1 Symbol([description])
	if (!USE_NATIVE) {
	  $Symbol = function Symbol() {
	    if (this instanceof $Symbol) throw TypeError('Symbol is not a constructor!');
	    var tag = uid(arguments.length > 0 ? arguments[0] : undefined);
	    var $set = function (value) {
	      if (this === ObjectProto) $set.call(OPSymbols, value);
	      if (has(this, HIDDEN) && has(this[HIDDEN], tag)) this[HIDDEN][tag] = false;
	      setSymbolDesc(this, tag, createDesc(1, value));
	    };
	    if (DESCRIPTORS && setter) setSymbolDesc(ObjectProto, tag, { configurable: true, set: $set });
	    return wrap(tag);
	  };
	  redefine($Symbol[PROTOTYPE], 'toString', function toString() {
	    return this._k;
	  });

	  $GOPD.f = $getOwnPropertyDescriptor;
	  $DP.f = $defineProperty;
	  __webpack_require__(121).f = gOPNExt.f = $getOwnPropertyNames;
	  __webpack_require__(48).f = $propertyIsEnumerable;
	  __webpack_require__(47).f = $getOwnPropertySymbols;

	  if (DESCRIPTORS && !__webpack_require__(22)) {
	    redefine(ObjectProto, 'propertyIsEnumerable', $propertyIsEnumerable, true);
	  }

	  wksExt.f = function (name) {
	    return wrap(wks(name));
	  };
	}

	$export($export.G + $export.W + $export.F * !USE_NATIVE, { Symbol: $Symbol });

	for (var es6Symbols = (
	  // 19.4.2.2, 19.4.2.3, 19.4.2.4, 19.4.2.6, 19.4.2.8, 19.4.2.9, 19.4.2.10, 19.4.2.11, 19.4.2.12, 19.4.2.13, 19.4.2.14
	  'hasInstance,isConcatSpreadable,iterator,match,replace,search,species,split,toPrimitive,toStringTag,unscopables'
	).split(','), j = 0; es6Symbols.length > j;)wks(es6Symbols[j++]);

	for (var wellKnownSymbols = $keys(wks.store), k = 0; wellKnownSymbols.length > k;) wksDefine(wellKnownSymbols[k++]);

	$export($export.S + $export.F * !USE_NATIVE, 'Symbol', {
	  // 19.4.2.1 Symbol.for(key)
	  'for': function (key) {
	    return has(SymbolRegistry, key += '')
	      ? SymbolRegistry[key]
	      : SymbolRegistry[key] = $Symbol(key);
	  },
	  // 19.4.2.5 Symbol.keyFor(sym)
	  keyFor: function keyFor(sym) {
	    if (!isSymbol(sym)) throw TypeError(sym + ' is not a symbol!');
	    for (var key in SymbolRegistry) if (SymbolRegistry[key] === sym) return key;
	  },
	  useSetter: function () { setter = true; },
	  useSimple: function () { setter = false; }
	});

	$export($export.S + $export.F * !USE_NATIVE, 'Object', {
	  // 19.1.2.2 Object.create(O [, Properties])
	  create: $create,
	  // 19.1.2.4 Object.defineProperty(O, P, Attributes)
	  defineProperty: $defineProperty,
	  // 19.1.2.3 Object.defineProperties(O, Properties)
	  defineProperties: $defineProperties,
	  // 19.1.2.6 Object.getOwnPropertyDescriptor(O, P)
	  getOwnPropertyDescriptor: $getOwnPropertyDescriptor,
	  // 19.1.2.7 Object.getOwnPropertyNames(O)
	  getOwnPropertyNames: $getOwnPropertyNames,
	  // 19.1.2.8 Object.getOwnPropertySymbols(O)
	  getOwnPropertySymbols: $getOwnPropertySymbols
	});

	// 24.3.2 JSON.stringify(value [, replacer [, space]])
	$JSON && $export($export.S + $export.F * (!USE_NATIVE || $fails(function () {
	  var S = $Symbol();
	  // MS Edge converts symbol values to JSON as {}
	  // WebKit converts symbol values to JSON as null
	  // V8 throws on boxed symbols
	  return _stringify([S]) != '[null]' || _stringify({ a: S }) != '{}' || _stringify(Object(S)) != '{}';
	})), 'JSON', {
	  stringify: function stringify(it) {
	    var args = [it];
	    var i = 1;
	    var replacer, $replacer;
	    while (arguments.length > i) args.push(arguments[i++]);
	    $replacer = replacer = args[1];
	    if (!isObject(replacer) && it === undefined || isSymbol(it)) return; // IE8 returns string on undefined
	    if (!isArray(replacer)) replacer = function (key, value) {
	      if (typeof $replacer == 'function') value = $replacer.call(this, key, value);
	      if (!isSymbol(value)) return value;
	    };
	    args[1] = replacer;
	    return _stringify.apply($JSON, args);
	  }
	});

	// 19.4.3.4 Symbol.prototype[@@toPrimitive](hint)
	$Symbol[PROTOTYPE][TO_PRIMITIVE] || __webpack_require__(29)($Symbol[PROTOTYPE], TO_PRIMITIVE, $Symbol[PROTOTYPE].valueOf);
	// 19.4.3.5 Symbol.prototype[@@toStringTag]
	setToStringTag($Symbol, 'Symbol');
	// 20.2.1.9 Math[@@toStringTag]
	setToStringTag(Math, 'Math', true);
	// 24.3.3 JSON[@@toStringTag]
	setToStringTag(global.JSON, 'JSON', true);


/***/ }),
/* 116 */
/***/ (function(module, exports, __webpack_require__) {

	var META = __webpack_require__(23)('meta');
	var isObject = __webpack_require__(32);
	var has = __webpack_require__(10);
	var setDesc = __webpack_require__(30).f;
	var id = 0;
	var isExtensible = Object.isExtensible || function () {
	  return true;
	};
	var FREEZE = !__webpack_require__(35)(function () {
	  return isExtensible(Object.preventExtensions({}));
	});
	var setMeta = function (it) {
	  setDesc(it, META, { value: {
	    i: 'O' + ++id, // object ID
	    w: {}          // weak collections IDs
	  } });
	};
	var fastKey = function (it, create) {
	  // return primitive with prefix
	  if (!isObject(it)) return typeof it == 'symbol' ? it : (typeof it == 'string' ? 'S' : 'P') + it;
	  if (!has(it, META)) {
	    // can't set metadata to uncaught frozen object
	    if (!isExtensible(it)) return 'F';
	    // not necessary to add metadata
	    if (!create) return 'E';
	    // add missing metadata
	    setMeta(it);
	  // return object ID
	  } return it[META].i;
	};
	var getWeak = function (it, create) {
	  if (!has(it, META)) {
	    // can't set metadata to uncaught frozen object
	    if (!isExtensible(it)) return true;
	    // not necessary to add metadata
	    if (!create) return false;
	    // add missing metadata
	    setMeta(it);
	  // return hash weak collections IDs
	  } return it[META].w;
	};
	// add metadata on freeze-family methods calling
	var onFreeze = function (it) {
	  if (FREEZE && meta.NEED && isExtensible(it) && !has(it, META)) setMeta(it);
	  return it;
	};
	var meta = module.exports = {
	  KEY: META,
	  NEED: false,
	  fastKey: fastKey,
	  getWeak: getWeak,
	  onFreeze: onFreeze
	};


/***/ }),
/* 117 */
/***/ (function(module, exports, __webpack_require__) {

	var global = __webpack_require__(21);
	var core = __webpack_require__(20);
	var LIBRARY = __webpack_require__(22);
	var wksExt = __webpack_require__(112);
	var defineProperty = __webpack_require__(30).f;
	module.exports = function (name) {
	  var $Symbol = core.Symbol || (core.Symbol = LIBRARY ? {} : global.Symbol || {});
	  if (name.charAt(0) != '_' && !(name in $Symbol)) defineProperty($Symbol, name, { value: wksExt.f(name) });
	};


/***/ }),
/* 118 */
/***/ (function(module, exports, __webpack_require__) {

	// all enumerable object keys, includes symbols
	var getKeys = __webpack_require__(8);
	var gOPS = __webpack_require__(47);
	var pIE = __webpack_require__(48);
	module.exports = function (it) {
	  var result = getKeys(it);
	  var getSymbols = gOPS.f;
	  if (getSymbols) {
	    var symbols = getSymbols(it);
	    var isEnum = pIE.f;
	    var i = 0;
	    var key;
	    while (symbols.length > i) if (isEnum.call(it, key = symbols[i++])) result.push(key);
	  } return result;
	};


/***/ }),
/* 119 */
/***/ (function(module, exports, __webpack_require__) {

	// 7.2.2 IsArray(argument)
	var cof = __webpack_require__(13);
	module.exports = Array.isArray || function isArray(arg) {
	  return cof(arg) == 'Array';
	};


/***/ }),
/* 120 */
/***/ (function(module, exports, __webpack_require__) {

	// fallback for IE11 buggy Object.getOwnPropertyNames with iframe and window
	var toIObject = __webpack_require__(11);
	var gOPN = __webpack_require__(121).f;
	var toString = {}.toString;

	var windowNames = typeof window == 'object' && window && Object.getOwnPropertyNames
	  ? Object.getOwnPropertyNames(window) : [];

	var getWindowNames = function (it) {
	  try {
	    return gOPN(it);
	  } catch (e) {
	    return windowNames.slice();
	  }
	};

	module.exports.f = function getOwnPropertyNames(it) {
	  return windowNames && toString.call(it) == '[object Window]' ? getWindowNames(it) : gOPN(toIObject(it));
	};


/***/ }),
/* 121 */
/***/ (function(module, exports, __webpack_require__) {

	// 19.1.2.7 / 15.2.3.4 Object.getOwnPropertyNames(O)
	var $keys = __webpack_require__(9);
	var hiddenKeys = __webpack_require__(24).concat('length', 'prototype');

	exports.f = Object.getOwnPropertyNames || function getOwnPropertyNames(O) {
	  return $keys(O, hiddenKeys);
	};


/***/ }),
/* 122 */
/***/ (function(module, exports, __webpack_require__) {

	var pIE = __webpack_require__(48);
	var createDesc = __webpack_require__(38);
	var toIObject = __webpack_require__(11);
	var toPrimitive = __webpack_require__(37);
	var has = __webpack_require__(10);
	var IE8_DOM_DEFINE = __webpack_require__(33);
	var gOPD = Object.getOwnPropertyDescriptor;

	exports.f = __webpack_require__(34) ? gOPD : function getOwnPropertyDescriptor(O, P) {
	  O = toIObject(O);
	  P = toPrimitive(P, true);
	  if (IE8_DOM_DEFINE) try {
	    return gOPD(O, P);
	  } catch (e) { /* empty */ }
	  if (has(O, P)) return createDesc(!pIE.f.call(O, P), O[P]);
	};


/***/ }),
/* 123 */
/***/ (function(module, exports, __webpack_require__) {

	__webpack_require__(117)('asyncIterator');


/***/ }),
/* 124 */
/***/ (function(module, exports, __webpack_require__) {

	__webpack_require__(117)('observable');


/***/ }),
/* 125 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	exports.__esModule = true;

	var _setPrototypeOf = __webpack_require__(126);

	var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

	var _create = __webpack_require__(130);

	var _create2 = _interopRequireDefault(_create);

	var _typeof2 = __webpack_require__(109);

	var _typeof3 = _interopRequireDefault(_typeof2);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	exports.default = function (subClass, superClass) {
	  if (typeof superClass !== "function" && superClass !== null) {
	    throw new TypeError("Super expression must either be null or a function, not " + (typeof superClass === "undefined" ? "undefined" : (0, _typeof3.default)(superClass)));
	  }

	  subClass.prototype = (0, _create2.default)(superClass && superClass.prototype, {
	    constructor: {
	      value: subClass,
	      enumerable: false,
	      writable: true,
	      configurable: true
	    }
	  });
	  if (superClass) _setPrototypeOf2.default ? (0, _setPrototypeOf2.default)(subClass, superClass) : subClass.__proto__ = superClass;
	};

/***/ }),
/* 126 */
/***/ (function(module, exports, __webpack_require__) {

	module.exports = { "default": __webpack_require__(127), __esModule: true };

/***/ }),
/* 127 */
/***/ (function(module, exports, __webpack_require__) {

	__webpack_require__(128);
	module.exports = __webpack_require__(20).Object.setPrototypeOf;


/***/ }),
/* 128 */
/***/ (function(module, exports, __webpack_require__) {

	// 19.1.3.19 Object.setPrototypeOf(O, proto)
	var $export = __webpack_require__(26);
	$export($export.S, 'Object', { setPrototypeOf: __webpack_require__(129).set });


/***/ }),
/* 129 */
/***/ (function(module, exports, __webpack_require__) {

	// Works with __proto__ only. Old v8 can't work with null proto objects.
	/* eslint-disable no-proto */
	var isObject = __webpack_require__(32);
	var anObject = __webpack_require__(31);
	var check = function (O, proto) {
	  anObject(O);
	  if (!isObject(proto) && proto !== null) throw TypeError(proto + ": can't set as prototype!");
	};
	module.exports = {
	  set: Object.setPrototypeOf || ('__proto__' in {} ? // eslint-disable-line
	    function (test, buggy, set) {
	      try {
	        set = __webpack_require__(27)(Function.call, __webpack_require__(122).f(Object.prototype, '__proto__').set, 2);
	        set(test, []);
	        buggy = !(test instanceof Array);
	      } catch (e) { buggy = true; }
	      return function setPrototypeOf(O, proto) {
	        check(O, proto);
	        if (buggy) O.__proto__ = proto;
	        else set(O, proto);
	        return O;
	      };
	    }({}, false) : undefined),
	  check: check
	};


/***/ }),
/* 130 */
/***/ (function(module, exports, __webpack_require__) {

	module.exports = { "default": __webpack_require__(131), __esModule: true };

/***/ }),
/* 131 */
/***/ (function(module, exports, __webpack_require__) {

	__webpack_require__(132);
	var $Object = __webpack_require__(20).Object;
	module.exports = function create(P, D) {
	  return $Object.create(P, D);
	};


/***/ }),
/* 132 */
/***/ (function(module, exports, __webpack_require__) {

	var $export = __webpack_require__(26);
	// 19.1.2.2 / 15.2.3.5 Object.create(O [, Properties])
	$export($export.S, 'Object', { create: __webpack_require__(60) });


/***/ }),
/* 133 */
/***/ (function(module, exports) {

	module.exports = __WEBPACK_EXTERNAL_MODULE_133__;

/***/ }),
/* 134 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {/**
	 * Copyright (c) 2013-present, Facebook, Inc.
	 *
	 * This source code is licensed under the MIT license found in the
	 * LICENSE file in the root directory of this source tree.
	 */

	if (process.env.NODE_ENV !== 'production') {
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
	  module.exports = __webpack_require__(135)(isValidElement, throwOnDirectAccess);
	} else {
	  // By explicitly using `prop-types` you are opting into new production behavior.
	  // http://fb.me/prop-types-in-prod
	  module.exports = __webpack_require__(142)();
	}

	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(40)))

/***/ }),
/* 135 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {/**
	 * Copyright (c) 2013-present, Facebook, Inc.
	 *
	 * This source code is licensed under the MIT license found in the
	 * LICENSE file in the root directory of this source tree.
	 */

	'use strict';

	var emptyFunction = __webpack_require__(136);
	var invariant = __webpack_require__(137);
	var warning = __webpack_require__(138);
	var assign = __webpack_require__(139);

	var ReactPropTypesSecret = __webpack_require__(140);
	var checkPropTypes = __webpack_require__(141);

	module.exports = function(isValidElement, throwOnDirectAccess) {
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
	    if (process.env.NODE_ENV !== 'production') {
	      var manualPropTypeCallCache = {};
	      var manualPropTypeWarningCount = 0;
	    }
	    function checkType(isRequired, props, propName, componentName, location, propFullName, secret) {
	      componentName = componentName || ANONYMOUS;
	      propFullName = propFullName || propName;

	      if (secret !== ReactPropTypesSecret) {
	        if (throwOnDirectAccess) {
	          // New behavior only for users of `prop-types` package
	          invariant(
	            false,
	            'Calling PropTypes validators directly is not supported by the `prop-types` package. ' +
	            'Use `PropTypes.checkPropTypes()` to call them. ' +
	            'Read more at http://fb.me/use-check-prop-types'
	          );
	        } else if (process.env.NODE_ENV !== 'production' && typeof console !== 'undefined') {
	          // Old behavior for people using React.PropTypes
	          var cacheKey = componentName + ':' + propName;
	          if (
	            !manualPropTypeCallCache[cacheKey] &&
	            // Avoid spamming the console because they are often not actionable except for lib authors
	            manualPropTypeWarningCount < 3
	          ) {
	            warning(
	              false,
	              'You are manually calling a React.PropTypes validation ' +
	              'function for the `%s` prop on `%s`. This is deprecated ' +
	              'and will throw in the standalone `prop-types` package. ' +
	              'You may be seeing this warning due to a third-party PropTypes ' +
	              'library. See https://fb.me/react-warning-dont-call-proptypes ' + 'for details.',
	              propFullName,
	              componentName
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
	    return createChainableTypeChecker(emptyFunction.thatReturnsNull);
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
	        var error = typeChecker(propValue, i, componentName, location, propFullName + '[' + i + ']', ReactPropTypesSecret);
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
	      process.env.NODE_ENV !== 'production' ? warning(false, 'Invalid argument supplied to oneOf, expected an instance of array.') : void 0;
	      return emptyFunction.thatReturnsNull;
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
	          var error = typeChecker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret);
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
	      process.env.NODE_ENV !== 'production' ? warning(false, 'Invalid argument supplied to oneOfType, expected an instance of array.') : void 0;
	      return emptyFunction.thatReturnsNull;
	    }

	    for (var i = 0; i < arrayOfTypeCheckers.length; i++) {
	      var checker = arrayOfTypeCheckers[i];
	      if (typeof checker !== 'function') {
	        warning(
	          false,
	          'Invalid argument supplied to oneOfType. Expected an array of check functions, but ' +
	          'received %s at index %s.',
	          getPostfixForTypeWarning(checker),
	          i
	        );
	        return emptyFunction.thatReturnsNull;
	      }
	    }

	    function validate(props, propName, componentName, location, propFullName) {
	      for (var i = 0; i < arrayOfTypeCheckers.length; i++) {
	        var checker = arrayOfTypeCheckers[i];
	        if (checker(props, propName, componentName, location, propFullName, ReactPropTypesSecret) == null) {
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
	        var error = checker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret);
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
	      var allKeys = assign({}, props[propName], shapeTypes);
	      for (var key in allKeys) {
	        var checker = shapeTypes[key];
	        if (!checker) {
	          return new PropTypeError(
	            'Invalid ' + location + ' `' + propFullName + '` key `' + key + '` supplied to `' + componentName + '`.' +
	            '\nBad object: ' + JSON.stringify(props[propName], null, '  ') +
	            '\nValid keys: ' +  JSON.stringify(Object.keys(shapeTypes), null, '  ')
	          );
	        }
	        var error = checker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret);
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

	  ReactPropTypes.checkPropTypes = checkPropTypes;
	  ReactPropTypes.PropTypes = ReactPropTypes;

	  return ReactPropTypes;
	};

	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(40)))

/***/ }),
/* 136 */
/***/ (function(module, exports) {

	"use strict";

	/**
	 * Copyright (c) 2013-present, Facebook, Inc.
	 *
	 * This source code is licensed under the MIT license found in the
	 * LICENSE file in the root directory of this source tree.
	 *
	 * 
	 */

	function makeEmptyFunction(arg) {
	  return function () {
	    return arg;
	  };
	}

	/**
	 * This function accepts and discards inputs; it has no side effects. This is
	 * primarily useful idiomatically for overridable function endpoints which
	 * always need to be callable, since JS lacks a null-call idiom ala Cocoa.
	 */
	var emptyFunction = function emptyFunction() {};

	emptyFunction.thatReturns = makeEmptyFunction;
	emptyFunction.thatReturnsFalse = makeEmptyFunction(false);
	emptyFunction.thatReturnsTrue = makeEmptyFunction(true);
	emptyFunction.thatReturnsNull = makeEmptyFunction(null);
	emptyFunction.thatReturnsThis = function () {
	  return this;
	};
	emptyFunction.thatReturnsArgument = function (arg) {
	  return arg;
	};

	module.exports = emptyFunction;

/***/ }),
/* 137 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {/**
	 * Copyright (c) 2013-present, Facebook, Inc.
	 *
	 * This source code is licensed under the MIT license found in the
	 * LICENSE file in the root directory of this source tree.
	 *
	 */

	'use strict';

	/**
	 * Use invariant() to assert state which your program assumes to be true.
	 *
	 * Provide sprintf-style format (only %s is supported) and arguments
	 * to provide information about what broke and what you were
	 * expecting.
	 *
	 * The invariant message will be stripped in production, but the invariant
	 * will remain to ensure logic does not differ in production.
	 */

	var validateFormat = function validateFormat(format) {};

	if (process.env.NODE_ENV !== 'production') {
	  validateFormat = function validateFormat(format) {
	    if (format === undefined) {
	      throw new Error('invariant requires an error message argument');
	    }
	  };
	}

	function invariant(condition, format, a, b, c, d, e, f) {
	  validateFormat(format);

	  if (!condition) {
	    var error;
	    if (format === undefined) {
	      error = new Error('Minified exception occurred; use the non-minified dev environment ' + 'for the full error message and additional helpful warnings.');
	    } else {
	      var args = [a, b, c, d, e, f];
	      var argIndex = 0;
	      error = new Error(format.replace(/%s/g, function () {
	        return args[argIndex++];
	      }));
	      error.name = 'Invariant Violation';
	    }

	    error.framesToPop = 1; // we don't care about invariant's own frame
	    throw error;
	  }
	}

	module.exports = invariant;
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(40)))

/***/ }),
/* 138 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {/**
	 * Copyright (c) 2014-present, Facebook, Inc.
	 *
	 * This source code is licensed under the MIT license found in the
	 * LICENSE file in the root directory of this source tree.
	 *
	 */

	'use strict';

	var emptyFunction = __webpack_require__(136);

	/**
	 * Similar to invariant but only logs a warning if the condition is not met.
	 * This can be used to log issues in development environments in critical
	 * paths. Removing the logging code for production environments will keep the
	 * same logic and follow the same code paths.
	 */

	var warning = emptyFunction;

	if (process.env.NODE_ENV !== 'production') {
	  var printWarning = function printWarning(format) {
	    for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
	      args[_key - 1] = arguments[_key];
	    }

	    var argIndex = 0;
	    var message = 'Warning: ' + format.replace(/%s/g, function () {
	      return args[argIndex++];
	    });
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

	  warning = function warning(condition, format) {
	    if (format === undefined) {
	      throw new Error('`warning(condition, format, ...args)` requires a warning ' + 'message argument');
	    }

	    if (format.indexOf('Failed Composite propType: ') === 0) {
	      return; // Ignore CompositeComponent proptype check.
	    }

	    if (!condition) {
	      for (var _len2 = arguments.length, args = Array(_len2 > 2 ? _len2 - 2 : 0), _key2 = 2; _key2 < _len2; _key2++) {
	        args[_key2 - 2] = arguments[_key2];
	      }

	      printWarning.apply(undefined, [format].concat(args));
	    }
	  };
	}

	module.exports = warning;
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(40)))

/***/ }),
/* 139 */
/***/ (function(module, exports) {

	/*
	object-assign
	(c) Sindre Sorhus
	@license MIT
	*/

	'use strict';
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

	module.exports = shouldUseNative() ? Object.assign : function (target, source) {
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


/***/ }),
/* 140 */
/***/ (function(module, exports) {

	/**
	 * Copyright (c) 2013-present, Facebook, Inc.
	 *
	 * This source code is licensed under the MIT license found in the
	 * LICENSE file in the root directory of this source tree.
	 */

	'use strict';

	var ReactPropTypesSecret = 'SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED';

	module.exports = ReactPropTypesSecret;


/***/ }),
/* 141 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {/**
	 * Copyright (c) 2013-present, Facebook, Inc.
	 *
	 * This source code is licensed under the MIT license found in the
	 * LICENSE file in the root directory of this source tree.
	 */

	'use strict';

	if (process.env.NODE_ENV !== 'production') {
	  var invariant = __webpack_require__(137);
	  var warning = __webpack_require__(138);
	  var ReactPropTypesSecret = __webpack_require__(140);
	  var loggedTypeFailures = {};
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
	  if (process.env.NODE_ENV !== 'production') {
	    for (var typeSpecName in typeSpecs) {
	      if (typeSpecs.hasOwnProperty(typeSpecName)) {
	        var error;
	        // Prop type validation may throw. In case they do, we don't want to
	        // fail the render phase where it didn't fail before. So we log it.
	        // After these have been cleaned up, we'll let them throw.
	        try {
	          // This is intentionally an invariant that gets caught. It's the same
	          // behavior as without this statement except with a better message.
	          invariant(typeof typeSpecs[typeSpecName] === 'function', '%s: %s type `%s` is invalid; it must be a function, usually from ' + 'the `prop-types` package, but received `%s`.', componentName || 'React class', location, typeSpecName, typeof typeSpecs[typeSpecName]);
	          error = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, ReactPropTypesSecret);
	        } catch (ex) {
	          error = ex;
	        }
	        warning(!error || error instanceof Error, '%s: type specification of %s `%s` is invalid; the type checker ' + 'function must return `null` or an `Error` but returned a %s. ' + 'You may have forgotten to pass an argument to the type checker ' + 'creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and ' + 'shape all require an argument).', componentName || 'React class', location, typeSpecName, typeof error);
	        if (error instanceof Error && !(error.message in loggedTypeFailures)) {
	          // Only monitor this failure once because there tends to be a lot of the
	          // same error.
	          loggedTypeFailures[error.message] = true;

	          var stack = getStack ? getStack() : '';

	          warning(false, 'Failed %s type: %s%s', location, error.message, stack != null ? stack : '');
	        }
	      }
	    }
	  }
	}

	module.exports = checkPropTypes;

	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(40)))

/***/ }),
/* 142 */
/***/ (function(module, exports, __webpack_require__) {

	/**
	 * Copyright (c) 2013-present, Facebook, Inc.
	 *
	 * This source code is licensed under the MIT license found in the
	 * LICENSE file in the root directory of this source tree.
	 */

	'use strict';

	var emptyFunction = __webpack_require__(136);
	var invariant = __webpack_require__(137);
	var ReactPropTypesSecret = __webpack_require__(140);

	module.exports = function() {
	  function shim(props, propName, componentName, location, propFullName, secret) {
	    if (secret === ReactPropTypesSecret) {
	      // It is still safe when called from React.
	      return;
	    }
	    invariant(
	      false,
	      'Calling PropTypes validators directly is not supported by the `prop-types` package. ' +
	      'Use PropTypes.checkPropTypes() to call them. ' +
	      'Read more at http://fb.me/use-check-prop-types'
	    );
	  };
	  shim.isRequired = shim;
	  function getShim() {
	    return shim;
	  };
	  // Important!
	  // Keep this list in sync with production version in `./factoryWithTypeCheckers.js`.
	  var ReactPropTypes = {
	    array: shim,
	    bool: shim,
	    func: shim,
	    number: shim,
	    object: shim,
	    string: shim,
	    symbol: shim,

	    any: shim,
	    arrayOf: getShim,
	    element: shim,
	    instanceOf: getShim,
	    node: shim,
	    objectOf: getShim,
	    oneOf: getShim,
	    oneOfType: getShim,
	    shape: getShim,
	    exact: getShim
	  };

	  ReactPropTypes.checkPropTypes = emptyFunction;
	  ReactPropTypes.PropTypes = ReactPropTypes;

	  return ReactPropTypes;
	};


/***/ }),
/* 143 */
/***/ (function(module, exports) {

	module.exports = __WEBPACK_EXTERNAL_MODULE_143__;

/***/ }),
/* 144 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});

	var _classCallCheck2 = __webpack_require__(103);

	var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

	var _createClass2 = __webpack_require__(104);

	var _createClass3 = _interopRequireDefault(_createClass2);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	var Manager = function () {
	  function Manager() {
	    (0, _classCallCheck3.default)(this, Manager);
	    this.refs = {};
	  }

	  (0, _createClass3.default)(Manager, [{
	    key: "add",
	    value: function add(collection, ref) {
	      if (!this.refs[collection]) {
	        this.refs[collection] = [];
	      }

	      this.refs[collection].push(ref);
	    }
	  }, {
	    key: "remove",
	    value: function remove(collection, ref) {
	      var index = this.getIndex(collection, ref);

	      if (index !== -1) {
	        this.refs[collection].splice(index, 1);
	      }
	    }
	  }, {
	    key: "isActive",
	    value: function isActive() {
	      return this.active;
	    }
	  }, {
	    key: "getActive",
	    value: function getActive() {
	      var _this = this;

	      return this.refs[this.active.collection].find(
	      // eslint-disable-next-line eqeqeq
	      function (_ref) {
	        var node = _ref.node;
	        return node.sortableInfo.index == _this.active.index;
	      });
	    }
	  }, {
	    key: "getIndex",
	    value: function getIndex(collection, ref) {
	      return this.refs[collection].indexOf(ref);
	    }
	  }, {
	    key: "getOrderedRefs",
	    value: function getOrderedRefs() {
	      var collection = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this.active.collection;

	      return this.refs[collection].sort(sortByIndex);
	    }
	  }]);
	  return Manager;
	}();

	exports.default = Manager;


	function sortByIndex(_ref2, _ref3) {
	  var index1 = _ref2.node.sortableInfo.index;
	  var index2 = _ref3.node.sortableInfo.index;

	  return index1 - index2;
	}

/***/ }),
/* 145 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});

	var _extends2 = __webpack_require__(42);

	var _extends3 = _interopRequireDefault(_extends2);

	var _getPrototypeOf = __webpack_require__(100);

	var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

	var _classCallCheck2 = __webpack_require__(103);

	var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

	var _createClass2 = __webpack_require__(104);

	var _createClass3 = _interopRequireDefault(_createClass2);

	var _possibleConstructorReturn2 = __webpack_require__(108);

	var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

	var _inherits2 = __webpack_require__(125);

	var _inherits3 = _interopRequireDefault(_inherits2);

	exports.default = sortableElement;

	var _react = __webpack_require__(133);

	var _react2 = _interopRequireDefault(_react);

	var _propTypes = __webpack_require__(134);

	var _propTypes2 = _interopRequireDefault(_propTypes);

	var _reactDom = __webpack_require__(143);

	var _invariant = __webpack_require__(39);

	var _invariant2 = _interopRequireDefault(_invariant);

	var _utils = __webpack_require__(2);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	// Export Higher Order Sortable Element Component
	function sortableElement(WrappedComponent) {
	  var _class, _temp;

	  var config = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { withRef: false };

	  return _temp = _class = function (_Component) {
	    (0, _inherits3.default)(_class, _Component);

	    function _class() {
	      (0, _classCallCheck3.default)(this, _class);
	      return (0, _possibleConstructorReturn3.default)(this, (_class.__proto__ || (0, _getPrototypeOf2.default)(_class)).apply(this, arguments));
	    }

	    (0, _createClass3.default)(_class, [{
	      key: 'componentDidMount',
	      value: function componentDidMount() {
	        var _props = this.props,
	            collection = _props.collection,
	            disabled = _props.disabled,
	            index = _props.index;


	        if (!disabled) {
	          this.setDraggable(collection, index);
	        }
	      }
	    }, {
	      key: 'componentWillReceiveProps',
	      value: function componentWillReceiveProps(nextProps) {
	        if (this.props.index !== nextProps.index && this.node) {
	          this.node.sortableInfo.index = nextProps.index;
	        }
	        if (this.props.disabled !== nextProps.disabled) {
	          var collection = nextProps.collection,
	              disabled = nextProps.disabled,
	              index = nextProps.index;

	          if (disabled) {
	            this.removeDraggable(collection);
	          } else {
	            this.setDraggable(collection, index);
	          }
	        } else if (this.props.collection !== nextProps.collection) {
	          this.removeDraggable(this.props.collection);
	          this.setDraggable(nextProps.collection, nextProps.index);
	        }
	      }
	    }, {
	      key: 'componentWillUnmount',
	      value: function componentWillUnmount() {
	        var _props2 = this.props,
	            collection = _props2.collection,
	            disabled = _props2.disabled;


	        if (!disabled) this.removeDraggable(collection);
	      }
	    }, {
	      key: 'setDraggable',
	      value: function setDraggable(collection, index) {
	        var node = this.node = (0, _reactDom.findDOMNode)(this);

	        node.sortableInfo = {
	          index: index,
	          collection: collection,
	          manager: this.context.manager
	        };

	        this.ref = { node: node };
	        this.context.manager.add(collection, this.ref);
	      }
	    }, {
	      key: 'removeDraggable',
	      value: function removeDraggable(collection) {
	        this.context.manager.remove(collection, this.ref);
	      }
	    }, {
	      key: 'getWrappedInstance',
	      value: function getWrappedInstance() {
	        (0, _invariant2.default)(config.withRef, 'To access the wrapped instance, you need to pass in {withRef: true} as the second argument of the SortableElement() call');
	        return this.refs.wrappedInstance;
	      }
	    }, {
	      key: 'render',
	      value: function render() {
	        var ref = config.withRef ? 'wrappedInstance' : null;

	        return _react2.default.createElement(WrappedComponent, (0, _extends3.default)({
	          ref: ref
	        }, (0, _utils.omit)(this.props, 'collection', 'disabled', 'index')));
	      }
	    }]);
	    return _class;
	  }(_react.Component), _class.displayName = (0, _utils.provideDisplayName)('sortableElement', WrappedComponent), _class.contextTypes = {
	    manager: _propTypes2.default.object.isRequired
	  }, _class.propTypes = {
	    index: _propTypes2.default.number.isRequired,
	    collection: _propTypes2.default.oneOfType([_propTypes2.default.number, _propTypes2.default.string]),
	    disabled: _propTypes2.default.bool
	  }, _class.defaultProps = {
	    collection: 0
	  }, _temp;
	}

/***/ }),
/* 146 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});

	var _extends2 = __webpack_require__(42);

	var _extends3 = _interopRequireDefault(_extends2);

	var _getPrototypeOf = __webpack_require__(100);

	var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

	var _classCallCheck2 = __webpack_require__(103);

	var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

	var _createClass2 = __webpack_require__(104);

	var _createClass3 = _interopRequireDefault(_createClass2);

	var _possibleConstructorReturn2 = __webpack_require__(108);

	var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

	var _inherits2 = __webpack_require__(125);

	var _inherits3 = _interopRequireDefault(_inherits2);

	exports.default = sortableHandle;

	var _react = __webpack_require__(133);

	var _react2 = _interopRequireDefault(_react);

	var _reactDom = __webpack_require__(143);

	var _invariant = __webpack_require__(39);

	var _invariant2 = _interopRequireDefault(_invariant);

	var _utils = __webpack_require__(2);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	// Export Higher Order Sortable Element Component
	function sortableHandle(WrappedComponent) {
	  var _class, _temp;

	  var config = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { withRef: false };

	  return _temp = _class = function (_Component) {
	    (0, _inherits3.default)(_class, _Component);

	    function _class() {
	      (0, _classCallCheck3.default)(this, _class);
	      return (0, _possibleConstructorReturn3.default)(this, (_class.__proto__ || (0, _getPrototypeOf2.default)(_class)).apply(this, arguments));
	    }

	    (0, _createClass3.default)(_class, [{
	      key: 'componentDidMount',
	      value: function componentDidMount() {
	        var node = (0, _reactDom.findDOMNode)(this);
	        node.sortableHandle = true;
	      }
	    }, {
	      key: 'getWrappedInstance',
	      value: function getWrappedInstance() {
	        (0, _invariant2.default)(config.withRef, 'To access the wrapped instance, you need to pass in {withRef: true} as the second argument of the SortableHandle() call');
	        return this.refs.wrappedInstance;
	      }
	    }, {
	      key: 'render',
	      value: function render() {
	        var ref = config.withRef ? 'wrappedInstance' : null;

	        return _react2.default.createElement(WrappedComponent, (0, _extends3.default)({ ref: ref }, this.props));
	      }
	    }]);
	    return _class;
	  }(_react.Component), _class.displayName = (0, _utils.provideDisplayName)('sortableHandle', WrappedComponent), _temp;
	}

/***/ })
/******/ ])
});
;