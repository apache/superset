(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["aphrodite"] = factory();
	else
		root["aphrodite"] = factory();
})(this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
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
	
	Object.defineProperty(exports, '__esModule', {
	    value: true
	});
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }
	
	var _generate = __webpack_require__(2);
	
	var _exports2 = __webpack_require__(28);
	
	var _exports3 = _interopRequireDefault(_exports2);
	
	var useImportant = true; // Add !important to all style definitions
	exports['default'] = (0, _exports3['default'])(useImportant, _generate.defaultSelectorHandlers);
	module.exports = exports['default'];

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	Object.defineProperty(exports, '__esModule', {
	    value: true
	});
	
	var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }
	
	var _inlineStylePrefixerStaticCreatePrefixer = __webpack_require__(3);
	
	var _inlineStylePrefixerStaticCreatePrefixer2 = _interopRequireDefault(_inlineStylePrefixerStaticCreatePrefixer);
	
	var _libStaticPrefixData = __webpack_require__(9);
	
	var _libStaticPrefixData2 = _interopRequireDefault(_libStaticPrefixData);
	
	var _orderedElements = __webpack_require__(25);
	
	var _orderedElements2 = _interopRequireDefault(_orderedElements);
	
	var _util = __webpack_require__(26);
	
	var prefixAll = (0, _inlineStylePrefixerStaticCreatePrefixer2['default'])(_libStaticPrefixData2['default']);
	
	/* ::
	import type { SheetDefinition } from './index.js';
	type StringHandlers = { [id:string]: Function };
	type SelectorCallback = (selector: string) => any;
	export type SelectorHandler = (
	    selector: string,
	    baseSelector: string,
	    callback: SelectorCallback
	) => string | null;
	*/
	
	/**
	 * `selectorHandlers` are functions which handle special selectors which act
	 * differently than normal style definitions. These functions look at the
	 * current selector and can generate CSS for the styles in their subtree by
	 * calling the callback with a new selector.
	 *
	 * For example, when generating styles with a base selector of '.foo' and the
	 * following styles object:
	 *
	 *   {
	 *     ':nth-child(2n)': {
	 *       ':hover': {
	 *         color: 'red'
	 *       }
	 *     }
	 *   }
	 *
	 * when we reach the ':hover' style, we would call our selector handlers like
	 *
	 *   handler(':hover', '.foo:nth-child(2n)', callback)
	 *
	 * Since our `pseudoSelectors` handles ':hover' styles, that handler would call
	 * the callback like
	 *
	 *   callback('.foo:nth-child(2n):hover')
	 *
	 * to generate its subtree `{ color: 'red' }` styles with a
	 * '.foo:nth-child(2n):hover' selector. The callback would return CSS like
	 *
	 *   '.foo:nth-child(2n):hover{color:red !important;}'
	 *
	 * and the handler would then return that resulting CSS.
	 *
	 * `defaultSelectorHandlers` is the list of default handlers used in a call to
	 * `generateCSS`.
	 *
	 * @name SelectorHandler
	 * @function
	 * @param {string} selector: The currently inspected selector. ':hover' in the
	 *     example above.
	 * @param {string} baseSelector: The selector of the parent styles.
	 *     '.foo:nth-child(2n)' in the example above.
	 * @param {function} generateSubtreeStyles: A function which can be called to
	 *     generate CSS for the subtree of styles corresponding to the selector.
	 *     Accepts a new baseSelector to use for generating those styles.
	 * @returns {?string} The generated CSS for this selector, or null if we don't
	 *     handle this selector.
	 */
	var defaultSelectorHandlers = [
	// Handle pseudo-selectors, like :hover and :nth-child(3n)
	function pseudoSelectors(selector, /* : string */
	baseSelector, /* : string */
	generateSubtreeStyles /* : Function */
	) /* */{
	    if (selector[0] !== ":") {
	        return null;
	    }
	    return generateSubtreeStyles(baseSelector + selector);
	},
	
	// Handle media queries (or font-faces)
	function mediaQueries(selector, /* : string */
	baseSelector, /* : string */
	generateSubtreeStyles /* : Function */
	) /* */{
	    if (selector[0] !== "@") {
	        return null;
	    }
	    // Generate the styles normally, and then wrap them in the media query.
	    var generated = generateSubtreeStyles(baseSelector);
	    return selector + '{' + generated + '}';
	}];
	
	exports.defaultSelectorHandlers = defaultSelectorHandlers;
	/**
	 * Generate CSS for a selector and some styles.
	 *
	 * This function handles the media queries and pseudo selectors that can be used
	 * in aphrodite styles.
	 *
	 * @param {string} selector: A base CSS selector for the styles to be generated
	 *     with.
	 * @param {Object} styleTypes: A list of properties of the return type of
	 *     StyleSheet.create, e.g. [styles.red, styles.blue].
	 * @param {Array.<SelectorHandler>} selectorHandlers: A list of selector
	 *     handlers to use for handling special selectors. See
	 *     `defaultSelectorHandlers`.
	 * @param stringHandlers: See `generateCSSRuleset`
	 * @param useImportant: See `generateCSSRuleset`
	 *
	 * To actually generate the CSS special-construct-less styles are passed to
	 * `generateCSSRuleset`.
	 *
	 * For instance, a call to
	 *
	 *     generateCSS(".foo", [{
	 *       color: "red",
	 *       "@media screen": {
	 *         height: 20,
	 *         ":hover": {
	 *           backgroundColor: "black"
	 *         }
	 *       },
	 *       ":active": {
	 *         fontWeight: "bold"
	 *       }
	 *     }], defaultSelectorHandlers);
	 *
	 * with the default `selectorHandlers` will make 5 calls to
	 * `generateCSSRuleset`:
	 *
	 *     generateCSSRuleset(".foo", { color: "red" }, ...)
	 *     generateCSSRuleset(".foo:active", { fontWeight: "bold" }, ...)
	 *     // These 2 will be wrapped in @media screen {}
	 *     generateCSSRuleset(".foo", { height: 20 }, ...)
	 *     generateCSSRuleset(".foo:hover", { backgroundColor: "black" }, ...)
	 */
	var generateCSS = function generateCSS(selector, /* : string */
	styleTypes, /* : SheetDefinition[] */
	selectorHandlers, /* : SelectorHandler[] */
	stringHandlers, /* : StringHandlers */
	useImportant /* : boolean */
	) /* : string */{
	    var merged = new _orderedElements2['default']();
	
	    for (var i = 0; i < styleTypes.length; i++) {
	        merged.addStyleType(styleTypes[i]);
	    }
	
	    var plainDeclarations = new _orderedElements2['default']();
	    var generatedStyles = "";
	
	    // TODO(emily): benchmark this to see if a plain for loop would be faster.
	    merged.forEach(function (val, key) {
	        // For each key, see if one of the selector handlers will handle these
	        // styles.
	        var foundHandler = selectorHandlers.some(function (handler) {
	            var result = handler(key, selector, function (newSelector) {
	                return generateCSS(newSelector, [val], selectorHandlers, stringHandlers, useImportant);
	            });
	            if (result != null) {
	                // If the handler returned something, add it to the generated
	                // CSS and stop looking for another handler.
	                generatedStyles += result;
	                return true;
	            }
	        });
	        // If none of the handlers handled it, add it to the list of plain
	        // style declarations.
	        if (!foundHandler) {
	            plainDeclarations.set(key, val, true);
	        }
	    });
	
	    return generateCSSRuleset(selector, plainDeclarations, stringHandlers, useImportant, selectorHandlers) + generatedStyles;
	};
	
	exports.generateCSS = generateCSS;
	/**
	 * Helper method of generateCSSRuleset to facilitate custom handling of certain
	 * CSS properties. Used for e.g. font families.
	 *
	 * See generateCSSRuleset for usage and documentation of paramater types.
	 */
	var runStringHandlers = function runStringHandlers(declarations, /* : OrderedElements */
	stringHandlers, /* : StringHandlers */
	selectorHandlers /* : SelectorHandler[] */
	) /* : void */{
	    if (!stringHandlers) {
	        return;
	    }
	
	    var stringHandlerKeys = Object.keys(stringHandlers);
	    for (var i = 0; i < stringHandlerKeys.length; i++) {
	        var key = stringHandlerKeys[i];
	        if (declarations.has(key)) {
	            // A declaration exists for this particular string handler, so we
	            // need to let the string handler interpret the declaration first
	            // before proceeding.
	            //
	            // TODO(emily): Pass in a callback which generates CSS, similar to
	            // how our selector handlers work, instead of passing in
	            // `selectorHandlers` and have them make calls to `generateCSS`
	            // themselves. Right now, this is impractical because our string
	            // handlers are very specialized and do complex things.
	            declarations.set(key, stringHandlers[key](declarations.get(key), selectorHandlers),
	
	            // Preserve order here, since we are really replacing an
	            // unprocessed style with a processed style, not overriding an
	            // earlier style
	            false);
	        }
	    }
	};
	
	var transformRule = function transformRule(key, /* : string */
	value, /* : string */
	transformValue /* : function */
	) {
	    return (/* : string */(0, _util.kebabifyStyleName)(key) + ':' + transformValue(key, value) + ';'
	    );
	};
	
	/**
	 * Generate a CSS ruleset with the selector and containing the declarations.
	 *
	 * This function assumes that the given declarations don't contain any special
	 * children (such as media queries, pseudo-selectors, or descendant styles).
	 *
	 * Note that this method does not deal with nesting used for e.g.
	 * psuedo-selectors or media queries. That responsibility is left to  the
	 * `generateCSS` function.
	 *
	 * @param {string} selector: the selector associated with the ruleset
	 * @param {Object} declarations: a map from camelCased CSS property name to CSS
	 *     property value.
	 * @param {Object.<string, function>} stringHandlers: a map from camelCased CSS
	 *     property name to a function which will map the given value to the value
	 *     that is output.
	 * @param {bool} useImportant: A boolean saying whether to append "!important"
	 *     to each of the CSS declarations.
	 * @returns {string} A string of raw CSS.
	 *
	 * Examples:
	 *
	 *    generateCSSRuleset(".blah", { color: "red" })
	 *    -> ".blah{color: red !important;}"
	 *    generateCSSRuleset(".blah", { color: "red" }, {}, false)
	 *    -> ".blah{color: red}"
	 *    generateCSSRuleset(".blah", { color: "red" }, {color: c => c.toUpperCase})
	 *    -> ".blah{color: RED}"
	 *    generateCSSRuleset(".blah:hover", { color: "red" })
	 *    -> ".blah:hover{color: red}"
	 */
	var generateCSSRuleset = function generateCSSRuleset(selector, /* : string */
	declarations, /* : OrderedElements */
	stringHandlers, /* : StringHandlers */
	useImportant, /* : boolean */
	selectorHandlers /* : SelectorHandler[] */
	) /* : string */{
	    // Mutates declarations
	    runStringHandlers(declarations, stringHandlers, selectorHandlers);
	
	    var originalElements = _extends({}, declarations.elements);
	
	    // NOTE(emily): This mutates handledDeclarations.elements.
	    var prefixedElements = prefixAll(declarations.elements);
	
	    var elementNames = Object.keys(prefixedElements);
	    if (elementNames.length !== declarations.keyOrder.length) {
	        // There are some prefixed values, so we need to figure out how to sort
	        // them.
	        //
	        // Loop through prefixedElements, looking for anything that is not in
	        // sortOrder, which means it was added by prefixAll. This means that we
	        // need to figure out where it should appear in the sortOrder.
	        for (var i = 0; i < elementNames.length; i++) {
	            if (!originalElements.hasOwnProperty(elementNames[i])) {
	                // This element is not in the sortOrder, which means it is a prefixed
	                // value that was added by prefixAll. Let's try to figure out where it
	                // goes.
	                var originalStyle = undefined;
	                if (elementNames[i][0] === 'W') {
	                    // This is a Webkit-prefixed style, like "WebkitTransition". Let's
	                    // find its original style's sort order.
	                    originalStyle = elementNames[i][6].toLowerCase() + elementNames[i].slice(7);
	                } else if (elementNames[i][1] === 'o') {
	                    // This is a Moz-prefixed style, like "MozTransition". We check
	                    // the second character to avoid colliding with Ms-prefixed
	                    // styles. Let's find its original style's sort order.
	                    originalStyle = elementNames[i][3].toLowerCase() + elementNames[i].slice(4);
	                } else {
	                    // if (elementNames[i][1] === 's') {
	                    // This is a Ms-prefixed style, like "MsTransition".
	                    originalStyle = elementNames[i][2].toLowerCase() + elementNames[i].slice(3);
	                }
	
	                if (originalStyle && originalElements.hasOwnProperty(originalStyle)) {
	                    var originalIndex = declarations.keyOrder.indexOf(originalStyle);
	                    declarations.keyOrder.splice(originalIndex, 0, elementNames[i]);
	                } else {
	                    // We don't know what the original style was, so sort it to
	                    // top. This can happen for styles that are added that don't
	                    // have the same base name as the original style.
	                    declarations.keyOrder.unshift(elementNames[i]);
	                }
	            }
	        }
	    }
	
	    var transformValue = useImportant === false ? _util.stringifyValue : _util.stringifyAndImportantifyValue;
	
	    var rules = [];
	    for (var i = 0; i < declarations.keyOrder.length; i++) {
	        var key = declarations.keyOrder[i];
	        var value = prefixedElements[key];
	        if (Array.isArray(value)) {
	            // inline-style-prefixer returns an array when there should be
	            // multiple rules for the same key. Here we flatten to multiple
	            // pairs with the same key.
	            for (var j = 0; j < value.length; j++) {
	                rules.push(transformRule(key, value[j], transformValue));
	            }
	        } else {
	            rules.push(transformRule(key, value, transformValue));
	        }
	    }
	
	    if (rules.length) {
	        return selector + '{' + rules.join("") + '}';
	    } else {
	        return "";
	    }
	};
	exports.generateCSSRuleset = generateCSSRuleset;

/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.default = createPrefixer;
	
	var _prefixProperty = __webpack_require__(4);
	
	var _prefixProperty2 = _interopRequireDefault(_prefixProperty);
	
	var _prefixValue = __webpack_require__(6);
	
	var _prefixValue2 = _interopRequireDefault(_prefixValue);
	
	var _addNewValuesOnly = __webpack_require__(7);
	
	var _addNewValuesOnly2 = _interopRequireDefault(_addNewValuesOnly);
	
	var _isObject = __webpack_require__(8);
	
	var _isObject2 = _interopRequireDefault(_isObject);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	function createPrefixer(_ref) {
	  var prefixMap = _ref.prefixMap,
	      plugins = _ref.plugins;
	
	  function prefixAll(style) {
	    for (var property in style) {
	      var value = style[property];
	
	      // handle nested objects
	      if ((0, _isObject2.default)(value)) {
	        style[property] = prefixAll(value);
	        // handle array values
	      } else if (Array.isArray(value)) {
	        var combinedValue = [];
	
	        for (var i = 0, len = value.length; i < len; ++i) {
	          var processedValue = (0, _prefixValue2.default)(plugins, property, value[i], style, prefixMap);
	          (0, _addNewValuesOnly2.default)(combinedValue, processedValue || value[i]);
	        }
	
	        // only modify the value if it was touched
	        // by any plugin to prevent unnecessary mutations
	        if (combinedValue.length > 0) {
	          style[property] = combinedValue;
	        }
	      } else {
	        var _processedValue = (0, _prefixValue2.default)(plugins, property, value, style, prefixMap);
	
	        // only modify the value if it was touched
	        // by any plugin to prevent unnecessary mutations
	        if (_processedValue) {
	          style[property] = _processedValue;
	        }
	
	        (0, _prefixProperty2.default)(prefixMap, property, style);
	      }
	    }
	
	    return style;
	  }
	
	  return prefixAll;
	}
	module.exports = exports['default'];

/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.default = prefixProperty;
	
	var _capitalizeString = __webpack_require__(5);
	
	var _capitalizeString2 = _interopRequireDefault(_capitalizeString);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	function prefixProperty(prefixProperties, property, style) {
	  if (prefixProperties.hasOwnProperty(property)) {
	    var requiredPrefixes = prefixProperties[property];
	    for (var i = 0, len = requiredPrefixes.length; i < len; ++i) {
	      style[requiredPrefixes[i] + (0, _capitalizeString2.default)(property)] = style[property];
	    }
	  }
	}
	module.exports = exports['default'];

/***/ }),
/* 5 */
/***/ (function(module, exports) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.default = capitalizeString;
	function capitalizeString(str) {
	  return str.charAt(0).toUpperCase() + str.slice(1);
	}
	module.exports = exports["default"];

/***/ }),
/* 6 */
/***/ (function(module, exports) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.default = prefixValue;
	function prefixValue(plugins, property, value, style, metaData) {
	  for (var i = 0, len = plugins.length; i < len; ++i) {
	    var processedValue = plugins[i](property, value, style, metaData);
	
	    // we can stop processing if a value is returned
	    // as all plugin criteria are unique
	    if (processedValue) {
	      return processedValue;
	    }
	  }
	}
	module.exports = exports["default"];

/***/ }),
/* 7 */
/***/ (function(module, exports) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.default = addNewValuesOnly;
	function addIfNew(list, value) {
	  if (list.indexOf(value) === -1) {
	    list.push(value);
	  }
	}
	
	function addNewValuesOnly(list, values) {
	  if (Array.isArray(values)) {
	    for (var i = 0, len = values.length; i < len; ++i) {
	      addIfNew(list, values[i]);
	    }
	  } else {
	    addIfNew(list, values);
	  }
	}
	module.exports = exports["default"];

/***/ }),
/* 8 */
/***/ (function(module, exports) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.default = isObject;
	function isObject(value) {
	  return value instanceof Object && !Array.isArray(value);
	}
	module.exports = exports["default"];

/***/ }),
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

	var calc = __webpack_require__(10)
	var crossFade = __webpack_require__(12)
	var cursor = __webpack_require__(13)
	var filter = __webpack_require__(14)
	var flex = __webpack_require__(15)
	var flexboxIE = __webpack_require__(16)
	var flexboxOld = __webpack_require__(17)
	var gradient = __webpack_require__(18)
	var imageSet = __webpack_require__(19)
	var position = __webpack_require__(20)
	var sizing = __webpack_require__(21)
	var transition = __webpack_require__(22)
	
	module.exports =  {
	  plugins: [calc,crossFade,cursor,filter,flex,flexboxIE,flexboxOld,gradient,imageSet,position,sizing,transition],
	  prefixMap: {"transform":["Webkit","ms"],"transformOrigin":["Webkit","ms"],"transformOriginX":["Webkit","ms"],"transformOriginY":["Webkit","ms"],"backfaceVisibility":["Webkit"],"perspective":["Webkit"],"perspectiveOrigin":["Webkit"],"transformStyle":["Webkit"],"transformOriginZ":["Webkit"],"animation":["Webkit"],"animationDelay":["Webkit"],"animationDirection":["Webkit"],"animationFillMode":["Webkit"],"animationDuration":["Webkit"],"animationIterationCount":["Webkit"],"animationName":["Webkit"],"animationPlayState":["Webkit"],"animationTimingFunction":["Webkit"],"appearance":["Webkit","Moz"],"userSelect":["Webkit","Moz","ms"],"fontKerning":["Webkit"],"textEmphasisPosition":["Webkit"],"textEmphasis":["Webkit"],"textEmphasisStyle":["Webkit"],"textEmphasisColor":["Webkit"],"boxDecorationBreak":["Webkit"],"clipPath":["Webkit"],"maskImage":["Webkit"],"maskMode":["Webkit"],"maskRepeat":["Webkit"],"maskPosition":["Webkit"],"maskClip":["Webkit"],"maskOrigin":["Webkit"],"maskSize":["Webkit"],"maskComposite":["Webkit"],"mask":["Webkit"],"maskBorderSource":["Webkit"],"maskBorderMode":["Webkit"],"maskBorderSlice":["Webkit"],"maskBorderWidth":["Webkit"],"maskBorderOutset":["Webkit"],"maskBorderRepeat":["Webkit"],"maskBorder":["Webkit"],"maskType":["Webkit"],"textDecorationStyle":["Webkit","Moz"],"textDecorationSkip":["Webkit","Moz"],"textDecorationLine":["Webkit","Moz"],"textDecorationColor":["Webkit","Moz"],"filter":["Webkit"],"fontFeatureSettings":["Webkit","Moz"],"breakAfter":["Webkit","Moz","ms"],"breakBefore":["Webkit","Moz","ms"],"breakInside":["Webkit","Moz","ms"],"columnCount":["Webkit","Moz"],"columnFill":["Webkit","Moz"],"columnGap":["Webkit","Moz"],"columnRule":["Webkit","Moz"],"columnRuleColor":["Webkit","Moz"],"columnRuleStyle":["Webkit","Moz"],"columnRuleWidth":["Webkit","Moz"],"columns":["Webkit","Moz"],"columnSpan":["Webkit","Moz"],"columnWidth":["Webkit","Moz"],"flex":["Webkit","ms"],"flexBasis":["Webkit"],"flexDirection":["Webkit","ms"],"flexGrow":["Webkit"],"flexFlow":["Webkit","ms"],"flexShrink":["Webkit"],"flexWrap":["Webkit","ms"],"alignContent":["Webkit"],"alignItems":["Webkit"],"alignSelf":["Webkit"],"justifyContent":["Webkit"],"order":["Webkit"],"transitionDelay":["Webkit"],"transitionDuration":["Webkit"],"transitionProperty":["Webkit"],"transitionTimingFunction":["Webkit"],"backdropFilter":["Webkit"],"scrollSnapType":["Webkit","ms"],"scrollSnapPointsX":["Webkit","ms"],"scrollSnapPointsY":["Webkit","ms"],"scrollSnapDestination":["Webkit","ms"],"scrollSnapCoordinate":["Webkit","ms"],"shapeImageThreshold":["Webkit"],"shapeImageMargin":["Webkit"],"shapeImageOutside":["Webkit"],"hyphens":["Webkit","Moz","ms"],"flowInto":["Webkit","ms"],"flowFrom":["Webkit","ms"],"regionFragment":["Webkit","ms"],"boxSizing":["Moz"],"textAlignLast":["Moz"],"tabSize":["Moz"],"wrapFlow":["ms"],"wrapThrough":["ms"],"wrapMargin":["ms"],"touchAction":["ms"],"gridTemplateColumns":["ms"],"gridTemplateRows":["ms"],"gridTemplateAreas":["ms"],"gridTemplate":["ms"],"gridAutoColumns":["ms"],"gridAutoRows":["ms"],"gridAutoFlow":["ms"],"grid":["ms"],"gridRowStart":["ms"],"gridColumnStart":["ms"],"gridRowEnd":["ms"],"gridRow":["ms"],"gridColumn":["ms"],"gridColumnEnd":["ms"],"gridColumnGap":["ms"],"gridRowGap":["ms"],"gridArea":["ms"],"gridGap":["ms"],"textSizeAdjust":["Webkit","ms"],"borderImage":["Webkit"],"borderImageOutset":["Webkit"],"borderImageRepeat":["Webkit"],"borderImageSlice":["Webkit"],"borderImageSource":["Webkit"],"borderImageWidth":["Webkit"]}
	}

/***/ }),
/* 10 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.default = calc;
	
	var _isPrefixedValue = __webpack_require__(11);
	
	var _isPrefixedValue2 = _interopRequireDefault(_isPrefixedValue);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	var prefixes = ['-webkit-', '-moz-', ''];
	function calc(property, value) {
	  if (typeof value === 'string' && !(0, _isPrefixedValue2.default)(value) && value.indexOf('calc(') > -1) {
	    return prefixes.map(function (prefix) {
	      return value.replace(/calc\(/g, prefix + 'calc(');
	    });
	  }
	}
	module.exports = exports['default'];

/***/ }),
/* 11 */
/***/ (function(module, exports) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.default = isPrefixedValue;
	
	var regex = /-webkit-|-moz-|-ms-/;
	
	function isPrefixedValue(value) {
	  return typeof value === 'string' && regex.test(value);
	}
	module.exports = exports['default'];

/***/ }),
/* 12 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.default = crossFade;
	
	var _isPrefixedValue = __webpack_require__(11);
	
	var _isPrefixedValue2 = _interopRequireDefault(_isPrefixedValue);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	// http://caniuse.com/#search=cross-fade
	var prefixes = ['-webkit-', ''];
	function crossFade(property, value) {
	  if (typeof value === 'string' && !(0, _isPrefixedValue2.default)(value) && value.indexOf('cross-fade(') > -1) {
	    return prefixes.map(function (prefix) {
	      return value.replace(/cross-fade\(/g, prefix + 'cross-fade(');
	    });
	  }
	}
	module.exports = exports['default'];

/***/ }),
/* 13 */
/***/ (function(module, exports) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.default = cursor;
	var prefixes = ['-webkit-', '-moz-', ''];
	
	var values = {
	  'zoom-in': true,
	  'zoom-out': true,
	  grab: true,
	  grabbing: true
	};
	
	function cursor(property, value) {
	  if (property === 'cursor' && values.hasOwnProperty(value)) {
	    return prefixes.map(function (prefix) {
	      return prefix + value;
	    });
	  }
	}
	module.exports = exports['default'];

/***/ }),
/* 14 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.default = filter;
	
	var _isPrefixedValue = __webpack_require__(11);
	
	var _isPrefixedValue2 = _interopRequireDefault(_isPrefixedValue);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	// http://caniuse.com/#feat=css-filter-function
	var prefixes = ['-webkit-', ''];
	function filter(property, value) {
	  if (typeof value === 'string' && !(0, _isPrefixedValue2.default)(value) && value.indexOf('filter(') > -1) {
	    return prefixes.map(function (prefix) {
	      return value.replace(/filter\(/g, prefix + 'filter(');
	    });
	  }
	}
	module.exports = exports['default'];

/***/ }),
/* 15 */
/***/ (function(module, exports) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.default = flex;
	var values = {
	  flex: true,
	  'inline-flex': true
	};
	
	function flex(property, value) {
	  if (property === 'display' && values.hasOwnProperty(value)) {
	    return ['-webkit-box', '-moz-box', '-ms-' + value + 'box', '-webkit-' + value, value];
	  }
	}
	module.exports = exports['default'];

/***/ }),
/* 16 */
/***/ (function(module, exports) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.default = flexboxIE;
	var alternativeValues = {
	  'space-around': 'distribute',
	  'space-between': 'justify',
	  'flex-start': 'start',
	  'flex-end': 'end'
	};
	var alternativeProps = {
	  alignContent: 'msFlexLinePack',
	  alignSelf: 'msFlexItemAlign',
	  alignItems: 'msFlexAlign',
	  justifyContent: 'msFlexPack',
	  order: 'msFlexOrder',
	  flexGrow: 'msFlexPositive',
	  flexShrink: 'msFlexNegative',
	  flexBasis: 'msPreferredSize'
	};
	
	function flexboxIE(property, value, style) {
	  if (alternativeProps.hasOwnProperty(property)) {
	    style[alternativeProps[property]] = alternativeValues[value] || value;
	  }
	}
	module.exports = exports['default'];

/***/ }),
/* 17 */
/***/ (function(module, exports) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.default = flexboxOld;
	var alternativeValues = {
	  'space-around': 'justify',
	  'space-between': 'justify',
	  'flex-start': 'start',
	  'flex-end': 'end',
	  'wrap-reverse': 'multiple',
	  wrap: 'multiple'
	};
	
	var alternativeProps = {
	  alignItems: 'WebkitBoxAlign',
	  justifyContent: 'WebkitBoxPack',
	  flexWrap: 'WebkitBoxLines'
	};
	
	function flexboxOld(property, value, style) {
	  if (property === 'flexDirection' && typeof value === 'string') {
	    if (value.indexOf('column') > -1) {
	      style.WebkitBoxOrient = 'vertical';
	    } else {
	      style.WebkitBoxOrient = 'horizontal';
	    }
	    if (value.indexOf('reverse') > -1) {
	      style.WebkitBoxDirection = 'reverse';
	    } else {
	      style.WebkitBoxDirection = 'normal';
	    }
	  }
	  if (alternativeProps.hasOwnProperty(property)) {
	    style[alternativeProps[property]] = alternativeValues[value] || value;
	  }
	}
	module.exports = exports['default'];

/***/ }),
/* 18 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.default = gradient;
	
	var _isPrefixedValue = __webpack_require__(11);
	
	var _isPrefixedValue2 = _interopRequireDefault(_isPrefixedValue);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	var prefixes = ['-webkit-', '-moz-', ''];
	
	var values = /linear-gradient|radial-gradient|repeating-linear-gradient|repeating-radial-gradient/;
	
	function gradient(property, value) {
	  if (typeof value === 'string' && !(0, _isPrefixedValue2.default)(value) && values.test(value)) {
	    return prefixes.map(function (prefix) {
	      return prefix + value;
	    });
	  }
	}
	module.exports = exports['default'];

/***/ }),
/* 19 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.default = imageSet;
	
	var _isPrefixedValue = __webpack_require__(11);
	
	var _isPrefixedValue2 = _interopRequireDefault(_isPrefixedValue);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	// http://caniuse.com/#feat=css-image-set
	var prefixes = ['-webkit-', ''];
	function imageSet(property, value) {
	  if (typeof value === 'string' && !(0, _isPrefixedValue2.default)(value) && value.indexOf('image-set(') > -1) {
	    return prefixes.map(function (prefix) {
	      return value.replace(/image-set\(/g, prefix + 'image-set(');
	    });
	  }
	}
	module.exports = exports['default'];

/***/ }),
/* 20 */
/***/ (function(module, exports) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.default = position;
	function position(property, value) {
	  if (property === 'position' && value === 'sticky') {
	    return ['-webkit-sticky', 'sticky'];
	  }
	}
	module.exports = exports['default'];

/***/ }),
/* 21 */
/***/ (function(module, exports) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.default = sizing;
	var prefixes = ['-webkit-', '-moz-', ''];
	
	var properties = {
	  maxHeight: true,
	  maxWidth: true,
	  width: true,
	  height: true,
	  columnWidth: true,
	  minWidth: true,
	  minHeight: true
	};
	var values = {
	  'min-content': true,
	  'max-content': true,
	  'fill-available': true,
	  'fit-content': true,
	  'contain-floats': true
	};
	
	function sizing(property, value) {
	  if (properties.hasOwnProperty(property) && values.hasOwnProperty(value)) {
	    return prefixes.map(function (prefix) {
	      return prefix + value;
	    });
	  }
	}
	module.exports = exports['default'];

/***/ }),
/* 22 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.default = transition;
	
	var _hyphenateProperty = __webpack_require__(23);
	
	var _hyphenateProperty2 = _interopRequireDefault(_hyphenateProperty);
	
	var _isPrefixedValue = __webpack_require__(11);
	
	var _isPrefixedValue2 = _interopRequireDefault(_isPrefixedValue);
	
	var _capitalizeString = __webpack_require__(5);
	
	var _capitalizeString2 = _interopRequireDefault(_capitalizeString);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	var properties = {
	  transition: true,
	  transitionProperty: true,
	  WebkitTransition: true,
	  WebkitTransitionProperty: true,
	  MozTransition: true,
	  MozTransitionProperty: true
	};
	
	
	var prefixMapping = {
	  Webkit: '-webkit-',
	  Moz: '-moz-',
	  ms: '-ms-'
	};
	
	function prefixValue(value, propertyPrefixMap) {
	  if ((0, _isPrefixedValue2.default)(value)) {
	    return value;
	  }
	
	  // only split multi values, not cubic beziers
	  var multipleValues = value.split(/,(?![^()]*(?:\([^()]*\))?\))/g);
	
	  for (var i = 0, len = multipleValues.length; i < len; ++i) {
	    var singleValue = multipleValues[i];
	    var values = [singleValue];
	    for (var property in propertyPrefixMap) {
	      var dashCaseProperty = (0, _hyphenateProperty2.default)(property);
	
	      if (singleValue.indexOf(dashCaseProperty) > -1 && dashCaseProperty !== 'order') {
	        var prefixes = propertyPrefixMap[property];
	        for (var j = 0, pLen = prefixes.length; j < pLen; ++j) {
	          // join all prefixes and create a new value
	          values.unshift(singleValue.replace(dashCaseProperty, prefixMapping[prefixes[j]] + dashCaseProperty));
	        }
	      }
	    }
	
	    multipleValues[i] = values.join(',');
	  }
	
	  return multipleValues.join(',');
	}
	
	function transition(property, value, style, propertyPrefixMap) {
	  // also check for already prefixed transitions
	  if (typeof value === 'string' && properties.hasOwnProperty(property)) {
	    var outputValue = prefixValue(value, propertyPrefixMap);
	    // if the property is already prefixed
	    var webkitOutput = outputValue.split(/,(?![^()]*(?:\([^()]*\))?\))/g).filter(function (val) {
	      return !/-moz-|-ms-/.test(val);
	    }).join(',');
	
	    if (property.indexOf('Webkit') > -1) {
	      return webkitOutput;
	    }
	
	    var mozOutput = outputValue.split(/,(?![^()]*(?:\([^()]*\))?\))/g).filter(function (val) {
	      return !/-webkit-|-ms-/.test(val);
	    }).join(',');
	
	    if (property.indexOf('Moz') > -1) {
	      return mozOutput;
	    }
	
	    style['Webkit' + (0, _capitalizeString2.default)(property)] = webkitOutput;
	    style['Moz' + (0, _capitalizeString2.default)(property)] = mozOutput;
	    return outputValue;
	  }
	}
	module.exports = exports['default'];

/***/ }),
/* 23 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.default = hyphenateProperty;
	
	var _hyphenateStyleName = __webpack_require__(24);
	
	var _hyphenateStyleName2 = _interopRequireDefault(_hyphenateStyleName);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	function hyphenateProperty(property) {
	  return (0, _hyphenateStyleName2.default)(property);
	}
	module.exports = exports['default'];

/***/ }),
/* 24 */
/***/ (function(module, exports) {

	'use strict';
	
	var uppercasePattern = /[A-Z]/g;
	var msPattern = /^ms-/;
	var cache = {};
	
	function hyphenateStyleName(string) {
	    return string in cache
	    ? cache[string]
	    : cache[string] = string
	      .replace(uppercasePattern, '-$&')
	      .toLowerCase()
	      .replace(msPattern, '-ms-');
	}
	
	module.exports = hyphenateStyleName;


/***/ }),
/* 25 */
/***/ (function(module, exports) {

	'use strict';
	
	Object.defineProperty(exports, '__esModule', {
	    value: true
	});
	
	var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();
	
	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }
	
	var MAP_EXISTS = typeof Map !== 'undefined';
	
	var OrderedElements = (function () {
	    /* ::
	    elements: {[string]: any};
	    keyOrder: string[];
	    */
	
	    function OrderedElements() {
	        _classCallCheck(this, OrderedElements);
	
	        this.elements = {};
	        this.keyOrder = [];
	    }
	
	    _createClass(OrderedElements, [{
	        key: 'forEach',
	        value: function forEach(callback /* : (string, any) => void */) {
	            for (var i = 0; i < this.keyOrder.length; i++) {
	                // (value, key) to match Map's API
	                callback(this.elements[this.keyOrder[i]], this.keyOrder[i]);
	            }
	        }
	    }, {
	        key: 'set',
	        value: function set(key, /* : string */value, /* : any */shouldReorder /* : ?boolean */) {
	            var _this = this;
	
	            if (!this.elements.hasOwnProperty(key)) {
	                this.keyOrder.push(key);
	            } else if (shouldReorder) {
	                var index = this.keyOrder.indexOf(key);
	                this.keyOrder.splice(index, 1);
	                this.keyOrder.push(key);
	            }
	
	            if (value == null) {
	                this.elements[key] = value;
	                return;
	            }
	
	            if (MAP_EXISTS && value instanceof Map || value instanceof OrderedElements) {
	                var _ret = (function () {
	                    // We have found a nested Map, so we need to recurse so that all
	                    // of the nested objects and Maps are merged properly.
	                    var nested = _this.elements.hasOwnProperty(key) ? _this.elements[key] : new OrderedElements();
	                    value.forEach(function (value, key) {
	                        nested.set(key, value, shouldReorder);
	                    });
	                    _this.elements[key] = nested;
	                    return {
	                        v: undefined
	                    };
	                })();
	
	                if (typeof _ret === 'object') return _ret.v;
	            }
	
	            if (!Array.isArray(value) && typeof value === 'object') {
	                // We have found a nested object, so we need to recurse so that all
	                // of the nested objects and Maps are merged properly.
	                var nested = this.elements.hasOwnProperty(key) ? this.elements[key] : new OrderedElements();
	                var keys = Object.keys(value);
	                for (var i = 0; i < keys.length; i += 1) {
	                    nested.set(keys[i], value[keys[i]], shouldReorder);
	                }
	                this.elements[key] = nested;
	                return;
	            }
	
	            this.elements[key] = value;
	        }
	    }, {
	        key: 'get',
	        value: function get(key /* : string */) /* : any */{
	            return this.elements[key];
	        }
	    }, {
	        key: 'has',
	        value: function has(key /* : string */) /* : boolean */{
	            return this.elements.hasOwnProperty(key);
	        }
	    }, {
	        key: 'addStyleType',
	        value: function addStyleType(styleType /* : any */) /* : void */{
	            var _this2 = this;
	
	            if (MAP_EXISTS && styleType instanceof Map || styleType instanceof OrderedElements) {
	                styleType.forEach(function (value, key) {
	                    _this2.set(key, value, true);
	                });
	            } else {
	                var keys = Object.keys(styleType);
	                for (var i = 0; i < keys.length; i++) {
	                    this.set(keys[i], styleType[keys[i]], true);
	                }
	            }
	        }
	    }]);
	
	    return OrderedElements;
	})();
	
	exports['default'] = OrderedElements;
	module.exports = exports['default'];

/***/ }),
/* 26 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	Object.defineProperty(exports, '__esModule', {
	    value: true
	});
	
	var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }
	
	var _stringHash = __webpack_require__(27);
	
	var _stringHash2 = _interopRequireDefault(_stringHash);
	
	/* ::
	type Pair = [ string, any ];
	type Pairs = Pair[];
	type PairsMapper = (pair: Pair) => Pair;
	type ObjectMap = { [id:string]: any };
	*/
	
	var mapObj = function mapObj(obj, /* : ObjectMap */
	fn /* : PairsMapper */
	) /* : ObjectMap */{
	    var keys = Object.keys(obj);
	    var mappedObj = {};
	    for (var i = 0; i < keys.length; i += 1) {
	        var _fn = fn([keys[i], obj[keys[i]]]);
	
	        var _fn2 = _slicedToArray(_fn, 2);
	
	        var newKey = _fn2[0];
	        var newValue = _fn2[1];
	
	        mappedObj[newKey] = newValue;
	    }
	    return mappedObj;
	};
	
	exports.mapObj = mapObj;
	var UPPERCASE_RE = /([A-Z])/g;
	var UPPERCASE_RE_TO_KEBAB = function UPPERCASE_RE_TO_KEBAB(match /* : string */) {
	    return (/* : string */'-' + match.toLowerCase()
	    );
	};
	
	var kebabifyStyleName = function kebabifyStyleName(string /* : string */) /* : string */{
	    var result = string.replace(UPPERCASE_RE, UPPERCASE_RE_TO_KEBAB);
	    if (result[0] === 'm' && result[1] === 's' && result[2] === '-') {
	        return '-' + result;
	    }
	    return result;
	};
	
	exports.kebabifyStyleName = kebabifyStyleName;
	/**
	 * CSS properties which accept numbers but are not in units of "px".
	 * Taken from React's CSSProperty.js
	 */
	var isUnitlessNumber = {
	    animationIterationCount: true,
	    borderImageOutset: true,
	    borderImageSlice: true,
	    borderImageWidth: true,
	    boxFlex: true,
	    boxFlexGroup: true,
	    boxOrdinalGroup: true,
	    columnCount: true,
	    flex: true,
	    flexGrow: true,
	    flexPositive: true,
	    flexShrink: true,
	    flexNegative: true,
	    flexOrder: true,
	    gridRow: true,
	    gridColumn: true,
	    fontWeight: true,
	    lineClamp: true,
	    lineHeight: true,
	    opacity: true,
	    order: true,
	    orphans: true,
	    tabSize: true,
	    widows: true,
	    zIndex: true,
	    zoom: true,
	
	    // SVG-related properties
	    fillOpacity: true,
	    floodOpacity: true,
	    stopOpacity: true,
	    strokeDasharray: true,
	    strokeDashoffset: true,
	    strokeMiterlimit: true,
	    strokeOpacity: true,
	    strokeWidth: true
	};
	
	/**
	 * Taken from React's CSSProperty.js
	 *
	 * @param {string} prefix vendor-specific prefix, eg: Webkit
	 * @param {string} key style name, eg: transitionDuration
	 * @return {string} style name prefixed with `prefix`, properly camelCased, eg:
	 * WebkitTransitionDuration
	 */
	function prefixKey(prefix, key) {
	    return prefix + key.charAt(0).toUpperCase() + key.substring(1);
	}
	
	/**
	 * Support style names that may come passed in prefixed by adding permutations
	 * of vendor prefixes.
	 * Taken from React's CSSProperty.js
	 */
	var prefixes = ['Webkit', 'ms', 'Moz', 'O'];
	
	// Using Object.keys here, or else the vanilla for-in loop makes IE8 go into an
	// infinite loop, because it iterates over the newly added props too.
	// Taken from React's CSSProperty.js
	Object.keys(isUnitlessNumber).forEach(function (prop) {
	    prefixes.forEach(function (prefix) {
	        isUnitlessNumber[prefixKey(prefix, prop)] = isUnitlessNumber[prop];
	    });
	});
	
	var stringifyValue = function stringifyValue(key, /* : string */
	prop /* : any */
	) /* : string */{
	    if (typeof prop === "number") {
	        if (isUnitlessNumber[key]) {
	            return "" + prop;
	        } else {
	            return prop + "px";
	        }
	    } else {
	        return '' + prop;
	    }
	};
	
	exports.stringifyValue = stringifyValue;
	var stringifyAndImportantifyValue = function stringifyAndImportantifyValue(key, /* : string */
	prop /* : any */
	) {
	    return (/* : string */importantify(stringifyValue(key, prop))
	    );
	};
	
	exports.stringifyAndImportantifyValue = stringifyAndImportantifyValue;
	// Turn a string into a hash string of base-36 values (using letters and numbers)
	var hashString = function hashString(string /* : string */) {
	    return (/* string */(0, _stringHash2['default'])(string).toString(36)
	    );
	};
	
	exports.hashString = hashString;
	// Hash a javascript object using JSON.stringify. This is very fast, about 3
	// microseconds on my computer for a sample object:
	// http://jsperf.com/test-hashfnv32a-hash/5
	//
	// Note that this uses JSON.stringify to stringify the objects so in order for
	// this to produce consistent hashes browsers need to have a consistent
	// ordering of objects. Ben Alpert says that Facebook depends on this, so we
	// can probably depend on this too.
	var hashObject = function hashObject(object /* : ObjectMap */) {
	    return (/* : string */hashString(JSON.stringify(object))
	    );
	};
	
	exports.hashObject = hashObject;
	// Given a single style value string like the "b" from "a: b;", adds !important
	// to generate "b !important".
	var importantify = function importantify(string /* : string */) {
	    return (/* : string */
	        // Bracket string character access is very fast, and in the default case we
	        // normally don't expect there to be "!important" at the end of the string
	        // so we can use this simple check to take an optimized path. If there
	        // happens to be a "!" in this position, we follow up with a more thorough
	        // check.
	        string[string.length - 10] === '!' && string.slice(-11) === ' !important' ? string : string + ' !important'
	    );
	};

/***/ }),
/* 27 */
/***/ (function(module, exports) {

	"use strict";
	
	function hash(str) {
	  var hash = 5381,
	      i    = str.length;
	
	  while(i) {
	    hash = (hash * 33) ^ str.charCodeAt(--i);
	  }
	
	  /* JavaScript does bitwise operations (like XOR, above) on 32-bit signed
	   * integers. Since we want the results to be always positive, convert the
	   * signed int to an unsigned by doing an unsigned bitshift. */
	  return hash >>> 0;
	}
	
	module.exports = hash;


/***/ }),
/* 28 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {'use strict';
	
	var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();
	
	var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };
	
	var _util = __webpack_require__(26);
	
	var _inject = __webpack_require__(30);
	
	/* ::
	import type { SelectorHandler } from './generate.js';
	export type SheetDefinition = { [id:string]: any };
	export type SheetDefinitions = SheetDefinition | SheetDefinition[];
	type RenderFunction = () => string;
	type Extension = {
	    selectorHandler: SelectorHandler
	};
	export type MaybeSheetDefinition = SheetDefinition | false | null | void
	*/
	
	var StyleSheet = {
	    create: function create(sheetDefinition /* : SheetDefinition */) {
	        return (0, _util.mapObj)(sheetDefinition, function (_ref) {
	            var _ref2 = _slicedToArray(_ref, 2);
	
	            var key = _ref2[0];
	            var val = _ref2[1];
	
	            var stringVal = JSON.stringify(val);
	            return [key, {
	                _len: stringVal.length,
	                _name: process.env.NODE_ENV === 'production' ? (0, _util.hashString)(stringVal) : key + '_' + (0, _util.hashString)(stringVal),
	                _definition: val
	            }];
	        });
	    },
	
	    rehydrate: function rehydrate() {
	        var renderedClassNames /* : string[] */ = arguments.length <= 0 || arguments[0] === undefined ? [] : arguments[0];
	
	        (0, _inject.addRenderedClassNames)(renderedClassNames);
	    }
	};
	
	/**
	 * Utilities for using Aphrodite server-side.
	 */
	var StyleSheetServer = {
	    renderStatic: function renderStatic(renderFunc /* : RenderFunction */) {
	        (0, _inject.reset)();
	        (0, _inject.startBuffering)();
	        var html = renderFunc();
	        var cssContent = (0, _inject.flushToString)();
	
	        return {
	            html: html,
	            css: {
	                content: cssContent,
	                renderedClassNames: (0, _inject.getRenderedClassNames)()
	            }
	        };
	    }
	};
	
	/**
	 * Utilities for using Aphrodite in tests.
	 *
	 * Not meant to be used in production.
	 */
	var StyleSheetTestUtils = {
	    /**
	     * Prevent styles from being injected into the DOM.
	     *
	     * This is useful in situations where you'd like to test rendering UI
	     * components which use Aphrodite without any of the side-effects of
	     * Aphrodite happening. Particularly useful for testing the output of
	     * components when you have no DOM, e.g. testing in Node without a fake DOM.
	     *
	     * Should be paired with a subsequent call to
	     * clearBufferAndResumeStyleInjection.
	     */
	    suppressStyleInjection: function suppressStyleInjection() {
	        (0, _inject.reset)();
	        (0, _inject.startBuffering)();
	    },
	
	    /**
	     * Opposite method of preventStyleInject.
	     */
	    clearBufferAndResumeStyleInjection: function clearBufferAndResumeStyleInjection() {
	        (0, _inject.reset)();
	    }
	};
	
	/**
	 * Generate the Aphrodite API exports, with given `selectorHandlers` and
	 * `useImportant` state.
	 */
	var makeExports = function makeExports(useImportant, /* : boolean */
	selectorHandlers /* : SelectorHandler[] */
	) {
	    return {
	        StyleSheet: _extends({}, StyleSheet, {
	
	            /**
	             * Returns a version of the exports of Aphrodite (i.e. an object
	             * with `css` and `StyleSheet` properties) which have some
	             * extensions included.
	             *
	             * @param {Array.<Object>} extensions: An array of extensions to
	             *     add to this instance of Aphrodite. Each object should have a
	             *     single property on it, defining which kind of extension to
	             *     add.
	             * @param {SelectorHandler} [extensions[].selectorHandler]: A
	             *     selector handler extension. See `defaultSelectorHandlers` in
	             *     generate.js.
	             *
	             * @returns {Object} An object containing the exports of the new
	             *     instance of Aphrodite.
	             */
	            extend: function extend(extensions /* : Extension[] */) {
	                var extensionSelectorHandlers = extensions
	                // Pull out extensions with a selectorHandler property
	                .map(function (extension) {
	                    return extension.selectorHandler;
	                })
	                // Remove nulls (i.e. extensions without a selectorHandler
	                // property).
	                .filter(function (handler) {
	                    return handler;
	                });
	
	                return makeExports(useImportant, selectorHandlers.concat(extensionSelectorHandlers));
	            }
	        }),
	
	        StyleSheetServer: StyleSheetServer,
	        StyleSheetTestUtils: StyleSheetTestUtils,
	
	        css: function css() /* : MaybeSheetDefinition[] */{
	            for (var _len = arguments.length, styleDefinitions = Array(_len), _key = 0; _key < _len; _key++) {
	                styleDefinitions[_key] = arguments[_key];
	            }
	
	            return (0, _inject.injectAndGetClassName)(useImportant, styleDefinitions, selectorHandlers);
	        }
	    };
	};
	
	module.exports = makeExports;
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(29)))

/***/ }),
/* 29 */
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
/* 30 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {'use strict';
	
	Object.defineProperty(exports, '__esModule', {
	    value: true
	});
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }
	
	var _asap = __webpack_require__(31);
	
	var _asap2 = _interopRequireDefault(_asap);
	
	var _orderedElements = __webpack_require__(25);
	
	var _orderedElements2 = _interopRequireDefault(_orderedElements);
	
	var _generate = __webpack_require__(2);
	
	var _util = __webpack_require__(26);
	
	/* ::
	import type { SheetDefinition, SheetDefinitions } from './index.js';
	import type { MaybeSheetDefinition } from './exports.js';
	import type { SelectorHandler } from './generate.js';
	type ProcessedStyleDefinitions = {
	  classNameBits: Array<string>,
	  definitionBits: Array<Object>,
	};
	*/
	
	// The current <style> tag we are inserting into, or null if we haven't
	// inserted anything yet. We could find this each time using
	// `document.querySelector("style[data-aphrodite"])`, but holding onto it is
	// faster.
	var styleTag = null;
	
	// Inject a string of styles into a <style> tag in the head of the document. This
	// will automatically create a style tag and then continue to use it for
	// multiple injections. It will also use a style tag with the `data-aphrodite`
	// tag on it if that exists in the DOM. This could be used for e.g. reusing the
	// same style tag that server-side rendering inserts.
	var injectStyleTag = function injectStyleTag(cssContents /* : string */) {
	    if (styleTag == null) {
	        // Try to find a style tag with the `data-aphrodite` attribute first.
	        styleTag = document.querySelector("style[data-aphrodite]");
	
	        // If that doesn't work, generate a new style tag.
	        if (styleTag == null) {
	            // Taken from
	            // http://stackoverflow.com/questions/524696/how-to-create-a-style-tag-with-javascript
	            var head = document.head || document.getElementsByTagName('head')[0];
	            styleTag = document.createElement('style');
	
	            styleTag.type = 'text/css';
	            styleTag.setAttribute("data-aphrodite", "");
	            head.appendChild(styleTag);
	        }
	    }
	
	    if (styleTag.styleSheet) {
	        // $FlowFixMe: legacy Internet Explorer compatibility
	        styleTag.styleSheet.cssText += cssContents;
	    } else {
	        styleTag.appendChild(document.createTextNode(cssContents));
	    }
	};
	
	// Custom handlers for stringifying CSS values that have side effects
	// (such as fontFamily, which can cause @font-face rules to be injected)
	var stringHandlers = {
	    // With fontFamily we look for objects that are passed in and interpret
	    // them as @font-face rules that we need to inject. The value of fontFamily
	    // can either be a string (as normal), an object (a single font face), or
	    // an array of objects and strings.
	    fontFamily: function fontFamily(val) {
	        if (Array.isArray(val)) {
	            return val.map(fontFamily).join(",");
	        } else if (typeof val === "object") {
	            injectStyleOnce(val.src, "@font-face", [val], false);
	            return '"' + val.fontFamily + '"';
	        } else {
	            return val;
	        }
	    },
	
	    // With animationName we look for an object that contains keyframes and
	    // inject them as an `@keyframes` block, returning a uniquely generated
	    // name. The keyframes object should look like
	    //  animationName: {
	    //    from: {
	    //      left: 0,
	    //      top: 0,
	    //    },
	    //    '50%': {
	    //      left: 15,
	    //      top: 5,
	    //    },
	    //    to: {
	    //      left: 20,
	    //      top: 20,
	    //    }
	    //  }
	    // TODO(emily): `stringHandlers` doesn't let us rename the key, so I have
	    // to use `animationName` here. Improve that so we can call this
	    // `animation` instead of `animationName`.
	    animationName: function animationName(val, selectorHandlers) {
	        if (Array.isArray(val)) {
	            return val.map(function (v) {
	                return animationName(v, selectorHandlers);
	            }).join(",");
	        } else if (typeof val === "object") {
	            // Generate a unique name based on the hash of the object. We can't
	            // just use the hash because the name can't start with a number.
	            // TODO(emily): this probably makes debugging hard, allow a custom
	            // name?
	            var _name = 'keyframe_' + (0, _util.hashObject)(val);
	
	            // Since keyframes need 3 layers of nesting, we use `generateCSS` to
	            // build the inner layers and wrap it in `@keyframes` ourselves.
	            var finalVal = '@keyframes ' + _name + '{';
	
	            // TODO see if we can find a way where checking for OrderedElements
	            // here is not necessary. Alternatively, perhaps we should have a
	            // utility method that can iterate over either a plain object, an
	            // instance of OrderedElements, or a Map, and then use that here and
	            // elsewhere.
	            if (val instanceof _orderedElements2['default']) {
	                val.forEach(function (valVal, valKey) {
	                    finalVal += (0, _generate.generateCSS)(valKey, [valVal], selectorHandlers, stringHandlers, false);
	                });
	            } else {
	                Object.keys(val).forEach(function (key) {
	                    finalVal += (0, _generate.generateCSS)(key, [val[key]], selectorHandlers, stringHandlers, false);
	                });
	            }
	            finalVal += '}';
	
	            injectGeneratedCSSOnce(_name, finalVal);
	
	            return _name;
	        } else {
	            return val;
	        }
	    }
	};
	
	// This is a map from Aphrodite's generated class names to `true` (acting as a
	// set of class names)
	var alreadyInjected = {};
	
	// This is the buffer of styles which have not yet been flushed.
	var injectionBuffer = "";
	
	// A flag to tell if we are already buffering styles. This could happen either
	// because we scheduled a flush call already, so newly added styles will
	// already be flushed, or because we are statically buffering on the server.
	var isBuffering = false;
	
	var injectGeneratedCSSOnce = function injectGeneratedCSSOnce(key, generatedCSS) {
	    if (alreadyInjected[key]) {
	        return;
	    }
	
	    if (!isBuffering) {
	        // We should never be automatically buffering on the server (or any
	        // place without a document), so guard against that.
	        if (typeof document === "undefined") {
	            throw new Error("Cannot automatically buffer without a document");
	        }
	
	        // If we're not already buffering, schedule a call to flush the
	        // current styles.
	        isBuffering = true;
	        (0, _asap2['default'])(flushToStyleTag);
	    }
	
	    injectionBuffer += generatedCSS;
	    alreadyInjected[key] = true;
	};
	
	var injectStyleOnce = function injectStyleOnce(key, /* : string */
	selector, /* : string */
	definitions, /* : SheetDefinition[] */
	useImportant /* : boolean */
	) {
	    var selectorHandlers /* : SelectorHandler[] */ = arguments.length <= 4 || arguments[4] === undefined ? [] : arguments[4];
	
	    if (alreadyInjected[key]) {
	        return;
	    }
	
	    var generated = (0, _generate.generateCSS)(selector, definitions, selectorHandlers, stringHandlers, useImportant);
	
	    injectGeneratedCSSOnce(key, generated);
	};
	
	exports.injectStyleOnce = injectStyleOnce;
	var reset = function reset() {
	    injectionBuffer = "";
	    alreadyInjected = {};
	    isBuffering = false;
	    styleTag = null;
	};
	
	exports.reset = reset;
	var startBuffering = function startBuffering() {
	    if (isBuffering) {
	        throw new Error("Cannot buffer while already buffering");
	    }
	    isBuffering = true;
	};
	
	exports.startBuffering = startBuffering;
	var flushToString = function flushToString() {
	    isBuffering = false;
	    var ret = injectionBuffer;
	    injectionBuffer = "";
	    return ret;
	};
	
	exports.flushToString = flushToString;
	var flushToStyleTag = function flushToStyleTag() {
	    var cssContent = flushToString();
	    if (cssContent.length > 0) {
	        injectStyleTag(cssContent);
	    }
	};
	
	exports.flushToStyleTag = flushToStyleTag;
	var getRenderedClassNames = function getRenderedClassNames() {
	    return Object.keys(alreadyInjected);
	};
	
	exports.getRenderedClassNames = getRenderedClassNames;
	var addRenderedClassNames = function addRenderedClassNames(classNames /* : string[] */) {
	    classNames.forEach(function (className) {
	        alreadyInjected[className] = true;
	    });
	};
	
	exports.addRenderedClassNames = addRenderedClassNames;
	var processStyleDefinitions = function processStyleDefinitions(styleDefinitions, /* : any[] */
	result /* : ProcessedStyleDefinitions */
	) /* : void */{
	    for (var i = 0; i < styleDefinitions.length; i += 1) {
	        // Filter out falsy values from the input, to allow for
	        // `css(a, test && c)`
	        if (styleDefinitions[i]) {
	            if (Array.isArray(styleDefinitions[i])) {
	                // We've encountered an array, so let's recurse
	                processStyleDefinitions(styleDefinitions[i], result);
	            } else {
	                result.classNameBits.push(styleDefinitions[i]._name);
	                result.definitionBits.push(styleDefinitions[i]._definition);
	            }
	        }
	    }
	};
	
	// Sum up the lengths of the stringified style definitions (which was saved as _len property)
	// and use modulus to return a single byte hash value.
	// We append this extra byte to the 32bit hash to decrease the chance of hash collisions.
	var getStyleDefinitionsLengthHash = function getStyleDefinitionsLengthHash(styleDefinitions /* : any[] */) {
	    return (/* : string */(styleDefinitions.reduce(function (length, styleDefinition) {
	            return length + (styleDefinition ? styleDefinition._len : 0);
	        }, 0) % 36).toString(36)
	    );
	};
	
	/**
	 * Inject styles associated with the passed style definition objects, and return
	 * an associated CSS class name.
	 *
	 * @param {boolean} useImportant If true, will append !important to generated
	 *     CSS output. e.g. {color: red} -> "color: red !important".
	 * @param {(Object|Object[])[]} styleDefinitions style definition objects, or
	 *     arbitrarily nested arrays of them, as returned as properties of the
	 *     return value of StyleSheet.create().
	 */
	var injectAndGetClassName = function injectAndGetClassName(useImportant, /* : boolean */
	styleDefinitions, /* : MaybeSheetDefinition[] */
	selectorHandlers /* : SelectorHandler[] */
	) /* : string */{
	    var processedStyleDefinitions /* : ProcessedStyleDefinitions */ = {
	        classNameBits: [],
	        definitionBits: []
	    };
	    // Mutates processedStyleDefinitions
	    processStyleDefinitions(styleDefinitions, processedStyleDefinitions);
	
	    // Break if there aren't any valid styles.
	    if (processedStyleDefinitions.classNameBits.length === 0) {
	        return "";
	    }
	
	    var className = undefined;
	    if (process.env.NODE_ENV === 'production') {
	        className = processedStyleDefinitions.classNameBits.length === 1 ? '_' + processedStyleDefinitions.classNameBits[0] : '_' + (0, _util.hashString)(processedStyleDefinitions.classNameBits.join()) + getStyleDefinitionsLengthHash(styleDefinitions);
	    } else {
	        className = processedStyleDefinitions.classNameBits.join("-o_O-");
	    }
	
	    injectStyleOnce(className, '.' + className, processedStyleDefinitions.definitionBits, useImportant, selectorHandlers);
	
	    return className;
	};
	exports.injectAndGetClassName = injectAndGetClassName;
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(29)))

/***/ }),
/* 31 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	// rawAsap provides everything we need except exception management.
	var rawAsap = __webpack_require__(32);
	// RawTasks are recycled to reduce GC churn.
	var freeTasks = [];
	// We queue errors to ensure they are thrown in right order (FIFO).
	// Array-as-queue is good enough here, since we are just dealing with exceptions.
	var pendingErrors = [];
	var requestErrorThrow = rawAsap.makeRequestCallFromTimer(throwFirstError);
	
	function throwFirstError() {
	    if (pendingErrors.length) {
	        throw pendingErrors.shift();
	    }
	}
	
	/**
	 * Calls a task as soon as possible after returning, in its own event, with priority
	 * over other events like animation, reflow, and repaint. An error thrown from an
	 * event will not interrupt, nor even substantially slow down the processing of
	 * other events, but will be rather postponed to a lower priority event.
	 * @param {{call}} task A callable object, typically a function that takes no
	 * arguments.
	 */
	module.exports = asap;
	function asap(task) {
	    var rawTask;
	    if (freeTasks.length) {
	        rawTask = freeTasks.pop();
	    } else {
	        rawTask = new RawTask();
	    }
	    rawTask.task = task;
	    rawAsap(rawTask);
	}
	
	// We wrap tasks with recyclable task objects.  A task object implements
	// `call`, just like a function.
	function RawTask() {
	    this.task = null;
	}
	
	// The sole purpose of wrapping the task is to catch the exception and recycle
	// the task object after its single use.
	RawTask.prototype.call = function () {
	    try {
	        this.task.call();
	    } catch (error) {
	        if (asap.onerror) {
	            // This hook exists purely for testing purposes.
	            // Its name will be periodically randomized to break any code that
	            // depends on its existence.
	            asap.onerror(error);
	        } else {
	            // In a web browser, exceptions are not fatal. However, to avoid
	            // slowing down the queue of pending tasks, we rethrow the error in a
	            // lower priority turn.
	            pendingErrors.push(error);
	            requestErrorThrow();
	        }
	    } finally {
	        this.task = null;
	        freeTasks[freeTasks.length] = this;
	    }
	};


/***/ }),
/* 32 */
/***/ (function(module, exports) {

	/* WEBPACK VAR INJECTION */(function(global) {"use strict";
	
	// Use the fastest means possible to execute a task in its own turn, with
	// priority over other events including IO, animation, reflow, and redraw
	// events in browsers.
	//
	// An exception thrown by a task will permanently interrupt the processing of
	// subsequent tasks. The higher level `asap` function ensures that if an
	// exception is thrown by a task, that the task queue will continue flushing as
	// soon as possible, but if you use `rawAsap` directly, you are responsible to
	// either ensure that no exceptions are thrown from your task, or to manually
	// call `rawAsap.requestFlush` if an exception is thrown.
	module.exports = rawAsap;
	function rawAsap(task) {
	    if (!queue.length) {
	        requestFlush();
	        flushing = true;
	    }
	    // Equivalent to push, but avoids a function call.
	    queue[queue.length] = task;
	}
	
	var queue = [];
	// Once a flush has been requested, no further calls to `requestFlush` are
	// necessary until the next `flush` completes.
	var flushing = false;
	// `requestFlush` is an implementation-specific method that attempts to kick
	// off a `flush` event as quickly as possible. `flush` will attempt to exhaust
	// the event queue before yielding to the browser's own event loop.
	var requestFlush;
	// The position of the next task to execute in the task queue. This is
	// preserved between calls to `flush` so that it can be resumed if
	// a task throws an exception.
	var index = 0;
	// If a task schedules additional tasks recursively, the task queue can grow
	// unbounded. To prevent memory exhaustion, the task queue will periodically
	// truncate already-completed tasks.
	var capacity = 1024;
	
	// The flush function processes all tasks that have been scheduled with
	// `rawAsap` unless and until one of those tasks throws an exception.
	// If a task throws an exception, `flush` ensures that its state will remain
	// consistent and will resume where it left off when called again.
	// However, `flush` does not make any arrangements to be called again if an
	// exception is thrown.
	function flush() {
	    while (index < queue.length) {
	        var currentIndex = index;
	        // Advance the index before calling the task. This ensures that we will
	        // begin flushing on the next task the task throws an error.
	        index = index + 1;
	        queue[currentIndex].call();
	        // Prevent leaking memory for long chains of recursive calls to `asap`.
	        // If we call `asap` within tasks scheduled by `asap`, the queue will
	        // grow, but to avoid an O(n) walk for every task we execute, we don't
	        // shift tasks off the queue after they have been executed.
	        // Instead, we periodically shift 1024 tasks off the queue.
	        if (index > capacity) {
	            // Manually shift all values starting at the index back to the
	            // beginning of the queue.
	            for (var scan = 0, newLength = queue.length - index; scan < newLength; scan++) {
	                queue[scan] = queue[scan + index];
	            }
	            queue.length -= index;
	            index = 0;
	        }
	    }
	    queue.length = 0;
	    index = 0;
	    flushing = false;
	}
	
	// `requestFlush` is implemented using a strategy based on data collected from
	// every available SauceLabs Selenium web driver worker at time of writing.
	// https://docs.google.com/spreadsheets/d/1mG-5UYGup5qxGdEMWkhP6BWCz053NUb2E1QoUTU16uA/edit#gid=783724593
	
	// Safari 6 and 6.1 for desktop, iPad, and iPhone are the only browsers that
	// have WebKitMutationObserver but not un-prefixed MutationObserver.
	// Must use `global` or `self` instead of `window` to work in both frames and web
	// workers. `global` is a provision of Browserify, Mr, Mrs, or Mop.
	
	/* globals self */
	var scope = typeof global !== "undefined" ? global : self;
	var BrowserMutationObserver = scope.MutationObserver || scope.WebKitMutationObserver;
	
	// MutationObservers are desirable because they have high priority and work
	// reliably everywhere they are implemented.
	// They are implemented in all modern browsers.
	//
	// - Android 4-4.3
	// - Chrome 26-34
	// - Firefox 14-29
	// - Internet Explorer 11
	// - iPad Safari 6-7.1
	// - iPhone Safari 7-7.1
	// - Safari 6-7
	if (typeof BrowserMutationObserver === "function") {
	    requestFlush = makeRequestCallFromMutationObserver(flush);
	
	// MessageChannels are desirable because they give direct access to the HTML
	// task queue, are implemented in Internet Explorer 10, Safari 5.0-1, and Opera
	// 11-12, and in web workers in many engines.
	// Although message channels yield to any queued rendering and IO tasks, they
	// would be better than imposing the 4ms delay of timers.
	// However, they do not work reliably in Internet Explorer or Safari.
	
	// Internet Explorer 10 is the only browser that has setImmediate but does
	// not have MutationObservers.
	// Although setImmediate yields to the browser's renderer, it would be
	// preferrable to falling back to setTimeout since it does not have
	// the minimum 4ms penalty.
	// Unfortunately there appears to be a bug in Internet Explorer 10 Mobile (and
	// Desktop to a lesser extent) that renders both setImmediate and
	// MessageChannel useless for the purposes of ASAP.
	// https://github.com/kriskowal/q/issues/396
	
	// Timers are implemented universally.
	// We fall back to timers in workers in most engines, and in foreground
	// contexts in the following browsers.
	// However, note that even this simple case requires nuances to operate in a
	// broad spectrum of browsers.
	//
	// - Firefox 3-13
	// - Internet Explorer 6-9
	// - iPad Safari 4.3
	// - Lynx 2.8.7
	} else {
	    requestFlush = makeRequestCallFromTimer(flush);
	}
	
	// `requestFlush` requests that the high priority event queue be flushed as
	// soon as possible.
	// This is useful to prevent an error thrown in a task from stalling the event
	// queue if the exception handled by Node.js’s
	// `process.on("uncaughtException")` or by a domain.
	rawAsap.requestFlush = requestFlush;
	
	// To request a high priority event, we induce a mutation observer by toggling
	// the text of a text node between "1" and "-1".
	function makeRequestCallFromMutationObserver(callback) {
	    var toggle = 1;
	    var observer = new BrowserMutationObserver(callback);
	    var node = document.createTextNode("");
	    observer.observe(node, {characterData: true});
	    return function requestCall() {
	        toggle = -toggle;
	        node.data = toggle;
	    };
	}
	
	// The message channel technique was discovered by Malte Ubl and was the
	// original foundation for this library.
	// http://www.nonblocking.io/2011/06/windownexttick.html
	
	// Safari 6.0.5 (at least) intermittently fails to create message ports on a
	// page's first load. Thankfully, this version of Safari supports
	// MutationObservers, so we don't need to fall back in that case.
	
	// function makeRequestCallFromMessageChannel(callback) {
	//     var channel = new MessageChannel();
	//     channel.port1.onmessage = callback;
	//     return function requestCall() {
	//         channel.port2.postMessage(0);
	//     };
	// }
	
	// For reasons explained above, we are also unable to use `setImmediate`
	// under any circumstances.
	// Even if we were, there is another bug in Internet Explorer 10.
	// It is not sufficient to assign `setImmediate` to `requestFlush` because
	// `setImmediate` must be called *by name* and therefore must be wrapped in a
	// closure.
	// Never forget.
	
	// function makeRequestCallFromSetImmediate(callback) {
	//     return function requestCall() {
	//         setImmediate(callback);
	//     };
	// }
	
	// Safari 6.0 has a problem where timers will get lost while the user is
	// scrolling. This problem does not impact ASAP because Safari 6.0 supports
	// mutation observers, so that implementation is used instead.
	// However, if we ever elect to use timers in Safari, the prevalent work-around
	// is to add a scroll event listener that calls for a flush.
	
	// `setTimeout` does not call the passed callback if the delay is less than
	// approximately 7 in web workers in Firefox 8 through 18, and sometimes not
	// even then.
	
	function makeRequestCallFromTimer(callback) {
	    return function requestCall() {
	        // We dispatch a timeout with a specified delay of 0 for engines that
	        // can reliably accommodate that request. This will usually be snapped
	        // to a 4 milisecond delay, but once we're flushing, there's no delay
	        // between events.
	        var timeoutHandle = setTimeout(handleTimer, 0);
	        // However, since this timer gets frequently dropped in Firefox
	        // workers, we enlist an interval handle that will try to fire
	        // an event 20 times per second until it succeeds.
	        var intervalHandle = setInterval(handleTimer, 50);
	
	        function handleTimer() {
	            // Whichever timer succeeds will cancel both timers and
	            // execute the callback.
	            clearTimeout(timeoutHandle);
	            clearInterval(intervalHandle);
	            callback();
	        }
	    };
	}
	
	// This is for `asap.js` only.
	// Its name will be periodically randomized to break any code that depends on
	// its existence.
	rawAsap.makeRequestCallFromTimer = makeRequestCallFromTimer;
	
	// ASAP was originally a nextTick shim included in Q. This was factored out
	// into this ASAP package. It was later adapted to RSVP which made further
	// amendments. These decisions, particularly to marginalize MessageChannel and
	// to capture the MutationObserver implementation in a closure, were integrated
	// back into ASAP proper.
	// https://github.com/tildeio/rsvp.js/blob/cddf7232546a9cf858524b75cde6f9edf72620a7/lib/rsvp/asap.js
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ })
/******/ ])
});
;
//# sourceMappingURL=aphrodite.umd.js.map