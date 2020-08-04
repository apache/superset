(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["expect"] = factory();
	else
		root["expect"] = factory();
})(window, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
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
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./packages/expect/src/index.ts");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./node_modules/@babel/code-frame/lib/index.js":
/*!*****************************************************!*\
  !*** ./node_modules/@babel/code-frame/lib/index.js ***!
  \*****************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(process) {

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.codeFrameColumns = codeFrameColumns;
exports.default = _default;

var _highlight = _interopRequireWildcard(__webpack_require__(/*! @babel/highlight */ "./node_modules/@babel/highlight/lib/index.js"));

function _getRequireWildcardCache() {
  if (typeof WeakMap !== "function") return null;
  var cache = new WeakMap();

  _getRequireWildcardCache = function _getRequireWildcardCache() {
    return cache;
  };

  return cache;
}

function _interopRequireWildcard(obj) {
  if (obj && obj.__esModule) {
    return obj;
  }

  if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") {
    return {
      default: obj
    };
  }

  var cache = _getRequireWildcardCache();

  if (cache && cache.has(obj)) {
    return cache.get(obj);
  }

  var newObj = {};
  var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;

  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;

      if (desc && (desc.get || desc.set)) {
        Object.defineProperty(newObj, key, desc);
      } else {
        newObj[key] = obj[key];
      }
    }
  }

  newObj.default = obj;

  if (cache) {
    cache.set(obj, newObj);
  }

  return newObj;
}

var deprecationWarningShown = false;

function getDefs(chalk) {
  return {
    gutter: chalk.grey,
    marker: chalk.red.bold,
    message: chalk.red.bold
  };
}

var NEWLINE = /\r\n|[\n\r\u2028\u2029]/;

function getMarkerLines(loc, source, opts) {
  var startLoc = Object.assign({
    column: 0,
    line: -1
  }, loc.start);
  var endLoc = Object.assign({}, startLoc, {}, loc.end);

  var _ref = opts || {},
      _ref$linesAbove = _ref.linesAbove,
      linesAbove = _ref$linesAbove === void 0 ? 2 : _ref$linesAbove,
      _ref$linesBelow = _ref.linesBelow,
      linesBelow = _ref$linesBelow === void 0 ? 3 : _ref$linesBelow;

  var startLine = startLoc.line;
  var startColumn = startLoc.column;
  var endLine = endLoc.line;
  var endColumn = endLoc.column;
  var start = Math.max(startLine - (linesAbove + 1), 0);
  var end = Math.min(source.length, endLine + linesBelow);

  if (startLine === -1) {
    start = 0;
  }

  if (endLine === -1) {
    end = source.length;
  }

  var lineDiff = endLine - startLine;
  var markerLines = {};

  if (lineDiff) {
    for (var i = 0; i <= lineDiff; i++) {
      var lineNumber = i + startLine;

      if (!startColumn) {
        markerLines[lineNumber] = true;
      } else if (i === 0) {
        var sourceLength = source[lineNumber - 1].length;
        markerLines[lineNumber] = [startColumn, sourceLength - startColumn + 1];
      } else if (i === lineDiff) {
        markerLines[lineNumber] = [0, endColumn];
      } else {
        var _sourceLength = source[lineNumber - i].length;
        markerLines[lineNumber] = [0, _sourceLength];
      }
    }
  } else {
    if (startColumn === endColumn) {
      if (startColumn) {
        markerLines[startLine] = [startColumn, 0];
      } else {
        markerLines[startLine] = true;
      }
    } else {
      markerLines[startLine] = [startColumn, endColumn - startColumn];
    }
  }

  return {
    start: start,
    end: end,
    markerLines: markerLines
  };
}

function codeFrameColumns(rawLines, loc) {
  var opts = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var highlighted = (opts.highlightCode || opts.forceColor) && (0, _highlight.shouldHighlight)(opts);
  var chalk = (0, _highlight.getChalk)(opts);
  var defs = getDefs(chalk);

  var maybeHighlight = function maybeHighlight(chalkFn, string) {
    return highlighted ? chalkFn(string) : string;
  };

  var lines = rawLines.split(NEWLINE);

  var _getMarkerLines = getMarkerLines(loc, lines, opts),
      start = _getMarkerLines.start,
      end = _getMarkerLines.end,
      markerLines = _getMarkerLines.markerLines;

  var hasColumns = loc.start && typeof loc.start.column === "number";
  var numberMaxWidth = String(end).length;
  var highlightedLines = highlighted ? (0, _highlight.default)(rawLines, opts) : rawLines;
  var frame = highlightedLines.split(NEWLINE).slice(start, end).map(function (line, index) {
    var number = start + 1 + index;
    var paddedNumber = " ".concat(number).slice(-numberMaxWidth);
    var gutter = " ".concat(paddedNumber, " | ");
    var hasMarker = markerLines[number];
    var lastMarkerLine = !markerLines[number + 1];

    if (hasMarker) {
      var markerLine = "";

      if (Array.isArray(hasMarker)) {
        var markerSpacing = line.slice(0, Math.max(hasMarker[0] - 1, 0)).replace(/[^\t]/g, " ");
        var numberOfMarkers = hasMarker[1] || 1;
        markerLine = ["\n ", maybeHighlight(defs.gutter, gutter.replace(/\d/g, " ")), markerSpacing, maybeHighlight(defs.marker, "^").repeat(numberOfMarkers)].join("");

        if (lastMarkerLine && opts.message) {
          markerLine += " " + maybeHighlight(defs.message, opts.message);
        }
      }

      return [maybeHighlight(defs.marker, ">"), maybeHighlight(defs.gutter, gutter), line, markerLine].join("");
    } else {
      return " ".concat(maybeHighlight(defs.gutter, gutter)).concat(line);
    }
  }).join("\n");

  if (opts.message && !hasColumns) {
    frame = "".concat(" ".repeat(numberMaxWidth + 1)).concat(opts.message, "\n").concat(frame);
  }

  if (highlighted) {
    return chalk.reset(frame);
  } else {
    return frame;
  }
}

function _default(rawLines, lineNumber, colNumber) {
  var opts = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

  if (!deprecationWarningShown) {
    deprecationWarningShown = true;
    var message = "Passing lineNumber and colNumber is deprecated to @babel/code-frame. Please use `codeFrameColumns`.";

    if (process.emitWarning) {
      process.emitWarning(message, "DeprecationWarning");
    } else {
      var deprecationError = new Error(message);
      deprecationError.name = "DeprecationWarning";
      console.warn(new Error(message));
    }
  }

  colNumber = Math.max(colNumber, 0);
  var location = {
    start: {
      column: colNumber,
      line: lineNumber
    }
  };
  return codeFrameColumns(rawLines, location, opts);
}
/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../../../process/browser.js */ "./node_modules/process/browser.js")))

/***/ }),

/***/ "./node_modules/@babel/helper-validator-identifier/lib/identifier.js":
/*!***************************************************************************!*\
  !*** ./node_modules/@babel/helper-validator-identifier/lib/identifier.js ***!
  \***************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isIdentifierStart = isIdentifierStart;
exports.isIdentifierChar = isIdentifierChar;
exports.isIdentifierName = isIdentifierName;
var nonASCIIidentifierStartChars = "\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0560-\u0588\u05D0-\u05EA\u05EF-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u08A0-\u08B4\u08B6-\u08C7\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D04-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E86-\u0E8A\u0E8C-\u0EA3\u0EA5\u0EA7-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1878\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C88\u1C90-\u1CBA\u1CBD-\u1CBF\u1CE9-\u1CEC\u1CEE-\u1CF3\u1CF5\u1CF6\u1CFA\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309B-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312F\u3131-\u318E\u31A0-\u31BF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\u9FFC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7BF\uA7C2-\uA7CA\uA7F5-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA8FE\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB69\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC";
var nonASCIIidentifierChars = "\u200C\u200D\xB7\u0300-\u036F\u0387\u0483-\u0487\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u0669\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u06F0-\u06F9\u0711\u0730-\u074A\u07A6-\u07B0\u07C0-\u07C9\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08D3-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0966-\u096F\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09E6-\u09EF\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A66-\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AE6-\u0AEF\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B55-\u0B57\u0B62\u0B63\u0B66-\u0B6F\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0BE6-\u0BEF\u0C00-\u0C04\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0CE6-\u0CEF\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D66-\u0D6F\u0D81-\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0E50-\u0E59\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECD\u0ED0-\u0ED9\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1040-\u1049\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F-\u109D\u135D-\u135F\u1369-\u1371\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u18A9\u1920-\u192B\u1930-\u193B\u1946-\u194F\u19D0-\u19DA\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AB0-\u1ABD\u1ABF\u1AC0\u1B00-\u1B04\u1B34-\u1B44\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BB0-\u1BB9\u1BE6-\u1BF3\u1C24-\u1C37\u1C40-\u1C49\u1C50-\u1C59\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DF9\u1DFB-\u1DFF\u203F\u2040\u2054\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA620-\uA629\uA66F\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA82C\uA880\uA881\uA8B4-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F1\uA8FF-\uA909\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9D0-\uA9D9\uA9E5\uA9F0-\uA9F9\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA50-\uAA59\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uABF0-\uABF9\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFF10-\uFF19\uFF3F";
var nonASCIIidentifierStart = new RegExp("[" + nonASCIIidentifierStartChars + "]");
var nonASCIIidentifier = new RegExp("[" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + "]");
nonASCIIidentifierStartChars = nonASCIIidentifierChars = null;
var astralIdentifierStartCodes = [0, 11, 2, 25, 2, 18, 2, 1, 2, 14, 3, 13, 35, 122, 70, 52, 268, 28, 4, 48, 48, 31, 14, 29, 6, 37, 11, 29, 3, 35, 5, 7, 2, 4, 43, 157, 19, 35, 5, 35, 5, 39, 9, 51, 157, 310, 10, 21, 11, 7, 153, 5, 3, 0, 2, 43, 2, 1, 4, 0, 3, 22, 11, 22, 10, 30, 66, 18, 2, 1, 11, 21, 11, 25, 71, 55, 7, 1, 65, 0, 16, 3, 2, 2, 2, 28, 43, 28, 4, 28, 36, 7, 2, 27, 28, 53, 11, 21, 11, 18, 14, 17, 111, 72, 56, 50, 14, 50, 14, 35, 349, 41, 7, 1, 79, 28, 11, 0, 9, 21, 107, 20, 28, 22, 13, 52, 76, 44, 33, 24, 27, 35, 30, 0, 3, 0, 9, 34, 4, 0, 13, 47, 15, 3, 22, 0, 2, 0, 36, 17, 2, 24, 85, 6, 2, 0, 2, 3, 2, 14, 2, 9, 8, 46, 39, 7, 3, 1, 3, 21, 2, 6, 2, 1, 2, 4, 4, 0, 19, 0, 13, 4, 159, 52, 19, 3, 21, 2, 31, 47, 21, 1, 2, 0, 185, 46, 42, 3, 37, 47, 21, 0, 60, 42, 14, 0, 72, 26, 230, 43, 117, 63, 32, 7, 3, 0, 3, 7, 2, 1, 2, 23, 16, 0, 2, 0, 95, 7, 3, 38, 17, 0, 2, 0, 29, 0, 11, 39, 8, 0, 22, 0, 12, 45, 20, 0, 35, 56, 264, 8, 2, 36, 18, 0, 50, 29, 113, 6, 2, 1, 2, 37, 22, 0, 26, 5, 2, 1, 2, 31, 15, 0, 328, 18, 190, 0, 80, 921, 103, 110, 18, 195, 2749, 1070, 4050, 582, 8634, 568, 8, 30, 114, 29, 19, 47, 17, 3, 32, 20, 6, 18, 689, 63, 129, 74, 6, 0, 67, 12, 65, 1, 2, 0, 29, 6135, 9, 1237, 43, 8, 8952, 286, 50, 2, 18, 3, 9, 395, 2309, 106, 6, 12, 4, 8, 8, 9, 5991, 84, 2, 70, 2, 1, 3, 0, 3, 1, 3, 3, 2, 11, 2, 0, 2, 6, 2, 64, 2, 3, 3, 7, 2, 6, 2, 27, 2, 3, 2, 4, 2, 0, 4, 6, 2, 339, 3, 24, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 7, 2357, 44, 11, 6, 17, 0, 370, 43, 1301, 196, 60, 67, 8, 0, 1205, 3, 2, 26, 2, 1, 2, 0, 3, 0, 2, 9, 2, 3, 2, 0, 2, 0, 7, 0, 5, 0, 2, 0, 2, 0, 2, 2, 2, 1, 2, 0, 3, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 3, 3, 2, 6, 2, 3, 2, 3, 2, 0, 2, 9, 2, 16, 6, 2, 2, 4, 2, 16, 4421, 42717, 35, 4148, 12, 221, 3, 5761, 15, 7472, 3104, 541, 1507, 4938];
var astralIdentifierCodes = [509, 0, 227, 0, 150, 4, 294, 9, 1368, 2, 2, 1, 6, 3, 41, 2, 5, 0, 166, 1, 574, 3, 9, 9, 370, 1, 154, 10, 176, 2, 54, 14, 32, 9, 16, 3, 46, 10, 54, 9, 7, 2, 37, 13, 2, 9, 6, 1, 45, 0, 13, 2, 49, 13, 9, 3, 2, 11, 83, 11, 7, 0, 161, 11, 6, 9, 7, 3, 56, 1, 2, 6, 3, 1, 3, 2, 10, 0, 11, 1, 3, 6, 4, 4, 193, 17, 10, 9, 5, 0, 82, 19, 13, 9, 214, 6, 3, 8, 28, 1, 83, 16, 16, 9, 82, 12, 9, 9, 84, 14, 5, 9, 243, 14, 166, 9, 71, 5, 2, 1, 3, 3, 2, 0, 2, 1, 13, 9, 120, 6, 3, 6, 4, 0, 29, 9, 41, 6, 2, 3, 9, 0, 10, 10, 47, 15, 406, 7, 2, 7, 17, 9, 57, 21, 2, 13, 123, 5, 4, 0, 2, 1, 2, 6, 2, 0, 9, 9, 49, 4, 2, 1, 2, 4, 9, 9, 330, 3, 19306, 9, 135, 4, 60, 6, 26, 9, 1014, 0, 2, 54, 8, 3, 82, 0, 12, 1, 19628, 1, 5319, 4, 4, 5, 9, 7, 3, 6, 31, 3, 149, 2, 1418, 49, 513, 54, 5, 49, 9, 0, 15, 0, 23, 4, 2, 14, 1361, 6, 2, 16, 3, 6, 2, 1, 2, 4, 262, 6, 10, 9, 419, 13, 1495, 6, 110, 6, 6, 9, 4759, 9, 787719, 239];

function isInAstralSet(code, set) {
  var pos = 0x10000;

  for (var i = 0, length = set.length; i < length; i += 2) {
    pos += set[i];
    if (pos > code) return false;
    pos += set[i + 1];
    if (pos >= code) return true;
  }

  return false;
}

function isIdentifierStart(code) {
  if (code < 65) return code === 36;
  if (code <= 90) return true;
  if (code < 97) return code === 95;
  if (code <= 122) return true;

  if (code <= 0xffff) {
    return code >= 0xaa && nonASCIIidentifierStart.test(String.fromCharCode(code));
  }

  return isInAstralSet(code, astralIdentifierStartCodes);
}

function isIdentifierChar(code) {
  if (code < 48) return code === 36;
  if (code < 58) return true;
  if (code < 65) return false;
  if (code <= 90) return true;
  if (code < 97) return code === 95;
  if (code <= 122) return true;

  if (code <= 0xffff) {
    return code >= 0xaa && nonASCIIidentifier.test(String.fromCharCode(code));
  }

  return isInAstralSet(code, astralIdentifierStartCodes) || isInAstralSet(code, astralIdentifierCodes);
}

function isIdentifierName(name) {
  var isFirst = true;

  for (var _i = 0, _Array$from = Array.from(name); _i < _Array$from.length; _i++) {
    var char = _Array$from[_i];
    var cp = char.codePointAt(0);

    if (isFirst) {
      if (!isIdentifierStart(cp)) {
        return false;
      }

      isFirst = false;
    } else if (!isIdentifierChar(cp)) {
      return false;
    }
  }

  return !isFirst;
}

/***/ }),

/***/ "./node_modules/@babel/helper-validator-identifier/lib/index.js":
/*!**********************************************************************!*\
  !*** ./node_modules/@babel/helper-validator-identifier/lib/index.js ***!
  \**********************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "isIdentifierName", {
  enumerable: true,
  get: function get() {
    return _identifier.isIdentifierName;
  }
});
Object.defineProperty(exports, "isIdentifierChar", {
  enumerable: true,
  get: function get() {
    return _identifier.isIdentifierChar;
  }
});
Object.defineProperty(exports, "isIdentifierStart", {
  enumerable: true,
  get: function get() {
    return _identifier.isIdentifierStart;
  }
});
Object.defineProperty(exports, "isReservedWord", {
  enumerable: true,
  get: function get() {
    return _keyword.isReservedWord;
  }
});
Object.defineProperty(exports, "isStrictBindOnlyReservedWord", {
  enumerable: true,
  get: function get() {
    return _keyword.isStrictBindOnlyReservedWord;
  }
});
Object.defineProperty(exports, "isStrictBindReservedWord", {
  enumerable: true,
  get: function get() {
    return _keyword.isStrictBindReservedWord;
  }
});
Object.defineProperty(exports, "isStrictReservedWord", {
  enumerable: true,
  get: function get() {
    return _keyword.isStrictReservedWord;
  }
});
Object.defineProperty(exports, "isKeyword", {
  enumerable: true,
  get: function get() {
    return _keyword.isKeyword;
  }
});

var _identifier = __webpack_require__(/*! ./identifier */ "./node_modules/@babel/helper-validator-identifier/lib/identifier.js");

var _keyword = __webpack_require__(/*! ./keyword */ "./node_modules/@babel/helper-validator-identifier/lib/keyword.js");

/***/ }),

/***/ "./node_modules/@babel/helper-validator-identifier/lib/keyword.js":
/*!************************************************************************!*\
  !*** ./node_modules/@babel/helper-validator-identifier/lib/keyword.js ***!
  \************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isReservedWord = isReservedWord;
exports.isStrictReservedWord = isStrictReservedWord;
exports.isStrictBindOnlyReservedWord = isStrictBindOnlyReservedWord;
exports.isStrictBindReservedWord = isStrictBindReservedWord;
exports.isKeyword = isKeyword;
var reservedWords = {
  keyword: ["break", "case", "catch", "continue", "debugger", "default", "do", "else", "finally", "for", "function", "if", "return", "switch", "throw", "try", "var", "const", "while", "with", "new", "this", "super", "class", "extends", "export", "import", "null", "true", "false", "in", "instanceof", "typeof", "void", "delete"],
  strict: ["implements", "interface", "let", "package", "private", "protected", "public", "static", "yield"],
  strictBind: ["eval", "arguments"]
};
var keywords = new Set(reservedWords.keyword);
var reservedWordsStrictSet = new Set(reservedWords.strict);
var reservedWordsStrictBindSet = new Set(reservedWords.strictBind);

function isReservedWord(word, inModule) {
  return inModule && word === "await" || word === "enum";
}

function isStrictReservedWord(word, inModule) {
  return isReservedWord(word, inModule) || reservedWordsStrictSet.has(word);
}

function isStrictBindOnlyReservedWord(word) {
  return reservedWordsStrictBindSet.has(word);
}

function isStrictBindReservedWord(word, inModule) {
  return isStrictReservedWord(word, inModule) || isStrictBindOnlyReservedWord(word);
}

function isKeyword(word) {
  return keywords.has(word);
}

/***/ }),

/***/ "./node_modules/@babel/highlight/lib/index.js":
/*!****************************************************!*\
  !*** ./node_modules/@babel/highlight/lib/index.js ***!
  \****************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _iterableToArrayLimit(arr, i) { if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return; var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.shouldHighlight = shouldHighlight;
exports.getChalk = getChalk;
exports.default = highlight;

var _jsTokens = _interopRequireWildcard(__webpack_require__(/*! js-tokens */ "./node_modules/js-tokens/index.js"));

var _helperValidatorIdentifier = __webpack_require__(/*! @babel/helper-validator-identifier */ "./node_modules/@babel/helper-validator-identifier/lib/index.js");

var _chalk = _interopRequireDefault(__webpack_require__(/*! chalk */ "./packages/expect/build/fakeChalk.js"));

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : {
    default: obj
  };
}

function _getRequireWildcardCache() {
  if (typeof WeakMap !== "function") return null;
  var cache = new WeakMap();

  _getRequireWildcardCache = function _getRequireWildcardCache() {
    return cache;
  };

  return cache;
}

function _interopRequireWildcard(obj) {
  if (obj && obj.__esModule) {
    return obj;
  }

  if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") {
    return {
      default: obj
    };
  }

  var cache = _getRequireWildcardCache();

  if (cache && cache.has(obj)) {
    return cache.get(obj);
  }

  var newObj = {};
  var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;

  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;

      if (desc && (desc.get || desc.set)) {
        Object.defineProperty(newObj, key, desc);
      } else {
        newObj[key] = obj[key];
      }
    }
  }

  newObj.default = obj;

  if (cache) {
    cache.set(obj, newObj);
  }

  return newObj;
}

function getDefs(chalk) {
  return {
    keyword: chalk.cyan,
    capitalized: chalk.yellow,
    jsx_tag: chalk.yellow,
    punctuator: chalk.yellow,
    number: chalk.magenta,
    string: chalk.green,
    regex: chalk.magenta,
    comment: chalk.grey,
    invalid: chalk.white.bgRed.bold
  };
}

var NEWLINE = /\r\n|[\n\r\u2028\u2029]/;
var JSX_TAG = /^[a-z][\w-]*$/i;
var BRACKET = /^[()[\]{}]$/;

function getTokenType(match) {
  var _match$slice = match.slice(-2),
      _match$slice2 = _slicedToArray(_match$slice, 2),
      offset = _match$slice2[0],
      text = _match$slice2[1];

  var token = (0, _jsTokens.matchToToken)(match);

  if (token.type === "name") {
    if ((0, _helperValidatorIdentifier.isKeyword)(token.value) || (0, _helperValidatorIdentifier.isReservedWord)(token.value)) {
      return "keyword";
    }

    if (JSX_TAG.test(token.value) && (text[offset - 1] === "<" || text.substr(offset - 2, 2) == "</")) {
      return "jsx_tag";
    }

    if (token.value[0] !== token.value[0].toLowerCase()) {
      return "capitalized";
    }
  }

  if (token.type === "punctuator" && BRACKET.test(token.value)) {
    return "bracket";
  }

  if (token.type === "invalid" && (token.value === "@" || token.value === "#")) {
    return "punctuator";
  }

  return token.type;
}

function highlightTokens(defs, text) {
  return text.replace(_jsTokens.default, function () {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    var type = getTokenType(args);
    var colorize = defs[type];

    if (colorize) {
      return args[0].split(NEWLINE).map(function (str) {
        return colorize(str);
      }).join("\n");
    } else {
      return args[0];
    }
  });
}

function shouldHighlight(options) {
  return _chalk.default.supportsColor || options.forceColor;
}

function getChalk(options) {
  var chalk = _chalk.default;

  if (options.forceColor) {
    chalk = new _chalk.default.constructor({
      enabled: true,
      level: 1
    });
  }

  return chalk;
}

function highlight(code) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  if (shouldHighlight(options)) {
    var chalk = getChalk(options);
    var defs = getDefs(chalk);
    return highlightTokens(defs, code);
  } else {
    return code;
  }
}

/***/ }),

/***/ "./node_modules/ansi-regex/index.js":
/*!******************************************!*\
  !*** ./node_modules/ansi-regex/index.js ***!
  \******************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = function () {
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      _ref$onlyFirst = _ref.onlyFirst,
      onlyFirst = _ref$onlyFirst === void 0 ? false : _ref$onlyFirst;

  var pattern = ["[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)", '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'].join('|');
  return new RegExp(pattern, onlyFirst ? undefined : 'g');
};

/***/ }),

/***/ "./node_modules/ansi-styles/index.js":
/*!*******************************************!*\
  !*** ./node_modules/ansi-styles/index.js ***!
  \*******************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(module) {

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _iterableToArrayLimit(arr, i) { if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return; var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

var wrapAnsi16 = function wrapAnsi16(fn, offset) {
  return function () {
    var code = fn.apply(void 0, arguments);
    return "\x1B[".concat(code + offset, "m");
  };
};

var wrapAnsi256 = function wrapAnsi256(fn, offset) {
  return function () {
    var code = fn.apply(void 0, arguments);
    return "\x1B[".concat(38 + offset, ";5;").concat(code, "m");
  };
};

var wrapAnsi16m = function wrapAnsi16m(fn, offset) {
  return function () {
    var rgb = fn.apply(void 0, arguments);
    return "\x1B[".concat(38 + offset, ";2;").concat(rgb[0], ";").concat(rgb[1], ";").concat(rgb[2], "m");
  };
};

var ansi2ansi = function ansi2ansi(n) {
  return n;
};

var rgb2rgb = function rgb2rgb(r, g, b) {
  return [r, g, b];
};

var setLazyProperty = function setLazyProperty(object, property, _get) {
  Object.defineProperty(object, property, {
    get: function get() {
      var value = _get();

      Object.defineProperty(object, property, {
        value: value,
        enumerable: true,
        configurable: true
      });
      return value;
    },
    enumerable: true,
    configurable: true
  });
};
/** @type {typeof import('color-convert')} */


var colorConvert;

var makeDynamicStyles = function makeDynamicStyles(wrap, targetSpace, identity, isBackground) {
  if (colorConvert === undefined) {
    colorConvert = __webpack_require__(/*! color-convert */ "./node_modules/ansi-styles/node_modules/color-convert/index.js");
  }

  var offset = isBackground ? 10 : 0;
  var styles = {};

  for (var _i = 0, _Object$entries = Object.entries(colorConvert); _i < _Object$entries.length; _i++) {
    var _Object$entries$_i = _slicedToArray(_Object$entries[_i], 2),
        sourceSpace = _Object$entries$_i[0],
        suite = _Object$entries$_i[1];

    var name = sourceSpace === 'ansi16' ? 'ansi' : sourceSpace;

    if (sourceSpace === targetSpace) {
      styles[name] = wrap(identity, offset);
    } else if (_typeof(suite) === 'object') {
      styles[name] = wrap(suite[targetSpace], offset);
    }
  }

  return styles;
};

function assembleStyles() {
  var codes = new Map();
  var styles = {
    modifier: {
      reset: [0, 0],
      // 21 isn't widely supported and 22 does the same thing
      bold: [1, 22],
      dim: [2, 22],
      italic: [3, 23],
      underline: [4, 24],
      inverse: [7, 27],
      hidden: [8, 28],
      strikethrough: [9, 29]
    },
    color: {
      black: [30, 39],
      red: [31, 39],
      green: [32, 39],
      yellow: [33, 39],
      blue: [34, 39],
      magenta: [35, 39],
      cyan: [36, 39],
      white: [37, 39],
      // Bright color
      blackBright: [90, 39],
      redBright: [91, 39],
      greenBright: [92, 39],
      yellowBright: [93, 39],
      blueBright: [94, 39],
      magentaBright: [95, 39],
      cyanBright: [96, 39],
      whiteBright: [97, 39]
    },
    bgColor: {
      bgBlack: [40, 49],
      bgRed: [41, 49],
      bgGreen: [42, 49],
      bgYellow: [43, 49],
      bgBlue: [44, 49],
      bgMagenta: [45, 49],
      bgCyan: [46, 49],
      bgWhite: [47, 49],
      // Bright color
      bgBlackBright: [100, 49],
      bgRedBright: [101, 49],
      bgGreenBright: [102, 49],
      bgYellowBright: [103, 49],
      bgBlueBright: [104, 49],
      bgMagentaBright: [105, 49],
      bgCyanBright: [106, 49],
      bgWhiteBright: [107, 49]
    }
  }; // Alias bright black as gray (and grey)

  styles.color.gray = styles.color.blackBright;
  styles.bgColor.bgGray = styles.bgColor.bgBlackBright;
  styles.color.grey = styles.color.blackBright;
  styles.bgColor.bgGrey = styles.bgColor.bgBlackBright;

  for (var _i2 = 0, _Object$entries2 = Object.entries(styles); _i2 < _Object$entries2.length; _i2++) {
    var _Object$entries2$_i = _slicedToArray(_Object$entries2[_i2], 2),
        groupName = _Object$entries2$_i[0],
        group = _Object$entries2$_i[1];

    for (var _i3 = 0, _Object$entries3 = Object.entries(group); _i3 < _Object$entries3.length; _i3++) {
      var _Object$entries3$_i = _slicedToArray(_Object$entries3[_i3], 2),
          styleName = _Object$entries3$_i[0],
          style = _Object$entries3$_i[1];

      styles[styleName] = {
        open: "\x1B[".concat(style[0], "m"),
        close: "\x1B[".concat(style[1], "m")
      };
      group[styleName] = styles[styleName];
      codes.set(style[0], style[1]);
    }

    Object.defineProperty(styles, groupName, {
      value: group,
      enumerable: false
    });
  }

  Object.defineProperty(styles, 'codes', {
    value: codes,
    enumerable: false
  });
  styles.color.close = "\x1B[39m";
  styles.bgColor.close = "\x1B[49m";
  setLazyProperty(styles.color, 'ansi', function () {
    return makeDynamicStyles(wrapAnsi16, 'ansi16', ansi2ansi, false);
  });
  setLazyProperty(styles.color, 'ansi256', function () {
    return makeDynamicStyles(wrapAnsi256, 'ansi256', ansi2ansi, false);
  });
  setLazyProperty(styles.color, 'ansi16m', function () {
    return makeDynamicStyles(wrapAnsi16m, 'rgb', rgb2rgb, false);
  });
  setLazyProperty(styles.bgColor, 'ansi', function () {
    return makeDynamicStyles(wrapAnsi16, 'ansi16', ansi2ansi, true);
  });
  setLazyProperty(styles.bgColor, 'ansi256', function () {
    return makeDynamicStyles(wrapAnsi256, 'ansi256', ansi2ansi, true);
  });
  setLazyProperty(styles.bgColor, 'ansi16m', function () {
    return makeDynamicStyles(wrapAnsi16m, 'rgb', rgb2rgb, true);
  });
  return styles;
} // Make the export immutable


Object.defineProperty(module, 'exports', {
  enumerable: true,
  get: assembleStyles
});
/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../webpack/buildin/module.js */ "./node_modules/webpack/buildin/module.js")(module)))

/***/ }),

/***/ "./node_modules/ansi-styles/node_modules/color-convert/conversions.js":
/*!****************************************************************************!*\
  !*** ./node_modules/ansi-styles/node_modules/color-convert/conversions.js ***!
  \****************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _iterableToArrayLimit(arr, i) { if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return; var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

/* MIT license */

/* eslint-disable no-mixed-operators */
var cssKeywords = __webpack_require__(/*! color-name */ "./node_modules/color-name/index.js"); // NOTE: conversions should only return primitive values (i.e. arrays, or
//       values that give correct `typeof` results).
//       do not use box values types (i.e. Number(), String(), etc.)


var reverseKeywords = {};

for (var _i = 0, _Object$keys = Object.keys(cssKeywords); _i < _Object$keys.length; _i++) {
  var key = _Object$keys[_i];
  reverseKeywords[cssKeywords[key]] = key;
}

var convert = {
  rgb: {
    channels: 3,
    labels: 'rgb'
  },
  hsl: {
    channels: 3,
    labels: 'hsl'
  },
  hsv: {
    channels: 3,
    labels: 'hsv'
  },
  hwb: {
    channels: 3,
    labels: 'hwb'
  },
  cmyk: {
    channels: 4,
    labels: 'cmyk'
  },
  xyz: {
    channels: 3,
    labels: 'xyz'
  },
  lab: {
    channels: 3,
    labels: 'lab'
  },
  lch: {
    channels: 3,
    labels: 'lch'
  },
  hex: {
    channels: 1,
    labels: ['hex']
  },
  keyword: {
    channels: 1,
    labels: ['keyword']
  },
  ansi16: {
    channels: 1,
    labels: ['ansi16']
  },
  ansi256: {
    channels: 1,
    labels: ['ansi256']
  },
  hcg: {
    channels: 3,
    labels: ['h', 'c', 'g']
  },
  apple: {
    channels: 3,
    labels: ['r16', 'g16', 'b16']
  },
  gray: {
    channels: 1,
    labels: ['gray']
  }
};
module.exports = convert; // Hide .channels and .labels properties

for (var _i2 = 0, _Object$keys2 = Object.keys(convert); _i2 < _Object$keys2.length; _i2++) {
  var model = _Object$keys2[_i2];

  if (!('channels' in convert[model])) {
    throw new Error('missing channels property: ' + model);
  }

  if (!('labels' in convert[model])) {
    throw new Error('missing channel labels property: ' + model);
  }

  if (convert[model].labels.length !== convert[model].channels) {
    throw new Error('channel and label counts mismatch: ' + model);
  }

  var _convert$model = convert[model],
      channels = _convert$model.channels,
      labels = _convert$model.labels;
  delete convert[model].channels;
  delete convert[model].labels;
  Object.defineProperty(convert[model], 'channels', {
    value: channels
  });
  Object.defineProperty(convert[model], 'labels', {
    value: labels
  });
}

convert.rgb.hsl = function (rgb) {
  var r = rgb[0] / 255;
  var g = rgb[1] / 255;
  var b = rgb[2] / 255;
  var min = Math.min(r, g, b);
  var max = Math.max(r, g, b);
  var delta = max - min;
  var h;
  var s;

  if (max === min) {
    h = 0;
  } else if (r === max) {
    h = (g - b) / delta;
  } else if (g === max) {
    h = 2 + (b - r) / delta;
  } else if (b === max) {
    h = 4 + (r - g) / delta;
  }

  h = Math.min(h * 60, 360);

  if (h < 0) {
    h += 360;
  }

  var l = (min + max) / 2;

  if (max === min) {
    s = 0;
  } else if (l <= 0.5) {
    s = delta / (max + min);
  } else {
    s = delta / (2 - max - min);
  }

  return [h, s * 100, l * 100];
};

convert.rgb.hsv = function (rgb) {
  var rdif;
  var gdif;
  var bdif;
  var h;
  var s;
  var r = rgb[0] / 255;
  var g = rgb[1] / 255;
  var b = rgb[2] / 255;
  var v = Math.max(r, g, b);
  var diff = v - Math.min(r, g, b);

  var diffc = function diffc(c) {
    return (v - c) / 6 / diff + 1 / 2;
  };

  if (diff === 0) {
    h = 0;
    s = 0;
  } else {
    s = diff / v;
    rdif = diffc(r);
    gdif = diffc(g);
    bdif = diffc(b);

    if (r === v) {
      h = bdif - gdif;
    } else if (g === v) {
      h = 1 / 3 + rdif - bdif;
    } else if (b === v) {
      h = 2 / 3 + gdif - rdif;
    }

    if (h < 0) {
      h += 1;
    } else if (h > 1) {
      h -= 1;
    }
  }

  return [h * 360, s * 100, v * 100];
};

convert.rgb.hwb = function (rgb) {
  var r = rgb[0];
  var g = rgb[1];
  var b = rgb[2];
  var h = convert.rgb.hsl(rgb)[0];
  var w = 1 / 255 * Math.min(r, Math.min(g, b));
  b = 1 - 1 / 255 * Math.max(r, Math.max(g, b));
  return [h, w * 100, b * 100];
};

convert.rgb.cmyk = function (rgb) {
  var r = rgb[0] / 255;
  var g = rgb[1] / 255;
  var b = rgb[2] / 255;
  var k = Math.min(1 - r, 1 - g, 1 - b);
  var c = (1 - r - k) / (1 - k) || 0;
  var m = (1 - g - k) / (1 - k) || 0;
  var y = (1 - b - k) / (1 - k) || 0;
  return [c * 100, m * 100, y * 100, k * 100];
};

function comparativeDistance(x, y) {
  /*
  	See https://en.m.wikipedia.org/wiki/Euclidean_distance#Squared_Euclidean_distance
  */
  return Math.pow(x[0] - y[0], 2) + Math.pow(x[1] - y[1], 2) + Math.pow(x[2] - y[2], 2);
}

convert.rgb.keyword = function (rgb) {
  var reversed = reverseKeywords[rgb];

  if (reversed) {
    return reversed;
  }

  var currentClosestDistance = Infinity;
  var currentClosestKeyword;

  for (var _i3 = 0, _Object$keys3 = Object.keys(cssKeywords); _i3 < _Object$keys3.length; _i3++) {
    var keyword = _Object$keys3[_i3];
    var value = cssKeywords[keyword]; // Compute comparative distance

    var distance = comparativeDistance(rgb, value); // Check if its less, if so set as closest

    if (distance < currentClosestDistance) {
      currentClosestDistance = distance;
      currentClosestKeyword = keyword;
    }
  }

  return currentClosestKeyword;
};

convert.keyword.rgb = function (keyword) {
  return cssKeywords[keyword];
};

convert.rgb.xyz = function (rgb) {
  var r = rgb[0] / 255;
  var g = rgb[1] / 255;
  var b = rgb[2] / 255; // Assume sRGB

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
  var x = r * 0.4124 + g * 0.3576 + b * 0.1805;
  var y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  var z = r * 0.0193 + g * 0.1192 + b * 0.9505;
  return [x * 100, y * 100, z * 100];
};

convert.rgb.lab = function (rgb) {
  var xyz = convert.rgb.xyz(rgb);
  var x = xyz[0];
  var y = xyz[1];
  var z = xyz[2];
  x /= 95.047;
  y /= 100;
  z /= 108.883;
  x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;
  var l = 116 * y - 16;
  var a = 500 * (x - y);
  var b = 200 * (y - z);
  return [l, a, b];
};

convert.hsl.rgb = function (hsl) {
  var h = hsl[0] / 360;
  var s = hsl[1] / 100;
  var l = hsl[2] / 100;
  var t2;
  var t3;
  var val;

  if (s === 0) {
    val = l * 255;
    return [val, val, val];
  }

  if (l < 0.5) {
    t2 = l * (1 + s);
  } else {
    t2 = l + s - l * s;
  }

  var t1 = 2 * l - t2;
  var rgb = [0, 0, 0];

  for (var i = 0; i < 3; i++) {
    t3 = h + 1 / 3 * -(i - 1);

    if (t3 < 0) {
      t3++;
    }

    if (t3 > 1) {
      t3--;
    }

    if (6 * t3 < 1) {
      val = t1 + (t2 - t1) * 6 * t3;
    } else if (2 * t3 < 1) {
      val = t2;
    } else if (3 * t3 < 2) {
      val = t1 + (t2 - t1) * (2 / 3 - t3) * 6;
    } else {
      val = t1;
    }

    rgb[i] = val * 255;
  }

  return rgb;
};

convert.hsl.hsv = function (hsl) {
  var h = hsl[0];
  var s = hsl[1] / 100;
  var l = hsl[2] / 100;
  var smin = s;
  var lmin = Math.max(l, 0.01);
  l *= 2;
  s *= l <= 1 ? l : 2 - l;
  smin *= lmin <= 1 ? lmin : 2 - lmin;
  var v = (l + s) / 2;
  var sv = l === 0 ? 2 * smin / (lmin + smin) : 2 * s / (l + s);
  return [h, sv * 100, v * 100];
};

convert.hsv.rgb = function (hsv) {
  var h = hsv[0] / 60;
  var s = hsv[1] / 100;
  var v = hsv[2] / 100;
  var hi = Math.floor(h) % 6;
  var f = h - Math.floor(h);
  var p = 255 * v * (1 - s);
  var q = 255 * v * (1 - s * f);
  var t = 255 * v * (1 - s * (1 - f));
  v *= 255;

  switch (hi) {
    case 0:
      return [v, t, p];

    case 1:
      return [q, v, p];

    case 2:
      return [p, v, t];

    case 3:
      return [p, q, v];

    case 4:
      return [t, p, v];

    case 5:
      return [v, p, q];
  }
};

convert.hsv.hsl = function (hsv) {
  var h = hsv[0];
  var s = hsv[1] / 100;
  var v = hsv[2] / 100;
  var vmin = Math.max(v, 0.01);
  var sl;
  var l;
  l = (2 - s) * v;
  var lmin = (2 - s) * vmin;
  sl = s * vmin;
  sl /= lmin <= 1 ? lmin : 2 - lmin;
  sl = sl || 0;
  l /= 2;
  return [h, sl * 100, l * 100];
}; // http://dev.w3.org/csswg/css-color/#hwb-to-rgb


convert.hwb.rgb = function (hwb) {
  var h = hwb[0] / 360;
  var wh = hwb[1] / 100;
  var bl = hwb[2] / 100;
  var ratio = wh + bl;
  var f; // Wh + bl cant be > 1

  if (ratio > 1) {
    wh /= ratio;
    bl /= ratio;
  }

  var i = Math.floor(6 * h);
  var v = 1 - bl;
  f = 6 * h - i;

  if ((i & 0x01) !== 0) {
    f = 1 - f;
  }

  var n = wh + f * (v - wh); // Linear interpolation

  var r;
  var g;
  var b;
  /* eslint-disable max-statements-per-line,no-multi-spaces */

  switch (i) {
    default:
    case 6:
    case 0:
      r = v;
      g = n;
      b = wh;
      break;

    case 1:
      r = n;
      g = v;
      b = wh;
      break;

    case 2:
      r = wh;
      g = v;
      b = n;
      break;

    case 3:
      r = wh;
      g = n;
      b = v;
      break;

    case 4:
      r = n;
      g = wh;
      b = v;
      break;

    case 5:
      r = v;
      g = wh;
      b = n;
      break;
  }
  /* eslint-enable max-statements-per-line,no-multi-spaces */


  return [r * 255, g * 255, b * 255];
};

convert.cmyk.rgb = function (cmyk) {
  var c = cmyk[0] / 100;
  var m = cmyk[1] / 100;
  var y = cmyk[2] / 100;
  var k = cmyk[3] / 100;
  var r = 1 - Math.min(1, c * (1 - k) + k);
  var g = 1 - Math.min(1, m * (1 - k) + k);
  var b = 1 - Math.min(1, y * (1 - k) + k);
  return [r * 255, g * 255, b * 255];
};

convert.xyz.rgb = function (xyz) {
  var x = xyz[0] / 100;
  var y = xyz[1] / 100;
  var z = xyz[2] / 100;
  var r;
  var g;
  var b;
  r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  b = x * 0.0557 + y * -0.2040 + z * 1.0570; // Assume sRGB

  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1.0 / 2.4) - 0.055 : r * 12.92;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1.0 / 2.4) - 0.055 : g * 12.92;
  b = b > 0.0031308 ? 1.055 * Math.pow(b, 1.0 / 2.4) - 0.055 : b * 12.92;
  r = Math.min(Math.max(0, r), 1);
  g = Math.min(Math.max(0, g), 1);
  b = Math.min(Math.max(0, b), 1);
  return [r * 255, g * 255, b * 255];
};

convert.xyz.lab = function (xyz) {
  var x = xyz[0];
  var y = xyz[1];
  var z = xyz[2];
  x /= 95.047;
  y /= 100;
  z /= 108.883;
  x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;
  var l = 116 * y - 16;
  var a = 500 * (x - y);
  var b = 200 * (y - z);
  return [l, a, b];
};

convert.lab.xyz = function (lab) {
  var l = lab[0];
  var a = lab[1];
  var b = lab[2];
  var x;
  var y;
  var z;
  y = (l + 16) / 116;
  x = a / 500 + y;
  z = y - b / 200;
  var y2 = Math.pow(y, 3);
  var x2 = Math.pow(x, 3);
  var z2 = Math.pow(z, 3);
  y = y2 > 0.008856 ? y2 : (y - 16 / 116) / 7.787;
  x = x2 > 0.008856 ? x2 : (x - 16 / 116) / 7.787;
  z = z2 > 0.008856 ? z2 : (z - 16 / 116) / 7.787;
  x *= 95.047;
  y *= 100;
  z *= 108.883;
  return [x, y, z];
};

convert.lab.lch = function (lab) {
  var l = lab[0];
  var a = lab[1];
  var b = lab[2];
  var h;
  var hr = Math.atan2(b, a);
  h = hr * 360 / 2 / Math.PI;

  if (h < 0) {
    h += 360;
  }

  var c = Math.sqrt(a * a + b * b);
  return [l, c, h];
};

convert.lch.lab = function (lch) {
  var l = lch[0];
  var c = lch[1];
  var h = lch[2];
  var hr = h / 360 * 2 * Math.PI;
  var a = c * Math.cos(hr);
  var b = c * Math.sin(hr);
  return [l, a, b];
};

convert.rgb.ansi16 = function (args) {
  var saturation = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

  var _args = _slicedToArray(args, 3),
      r = _args[0],
      g = _args[1],
      b = _args[2];

  var value = saturation === null ? convert.rgb.hsv(args)[2] : saturation; // Hsv -> ansi16 optimization

  value = Math.round(value / 50);

  if (value === 0) {
    return 30;
  }

  var ansi = 30 + (Math.round(b / 255) << 2 | Math.round(g / 255) << 1 | Math.round(r / 255));

  if (value === 2) {
    ansi += 60;
  }

  return ansi;
};

convert.hsv.ansi16 = function (args) {
  // Optimization here; we already know the value and don't need to get
  // it converted for us.
  return convert.rgb.ansi16(convert.hsv.rgb(args), args[2]);
};

convert.rgb.ansi256 = function (args) {
  var r = args[0];
  var g = args[1];
  var b = args[2]; // We use the extended greyscale palette here, with the exception of
  // black and white. normal palette only has 4 greyscale shades.

  if (r === g && g === b) {
    if (r < 8) {
      return 16;
    }

    if (r > 248) {
      return 231;
    }

    return Math.round((r - 8) / 247 * 24) + 232;
  }

  var ansi = 16 + 36 * Math.round(r / 255 * 5) + 6 * Math.round(g / 255 * 5) + Math.round(b / 255 * 5);
  return ansi;
};

convert.ansi16.rgb = function (args) {
  var color = args % 10; // Handle greyscale

  if (color === 0 || color === 7) {
    if (args > 50) {
      color += 3.5;
    }

    color = color / 10.5 * 255;
    return [color, color, color];
  }

  var mult = (~~(args > 50) + 1) * 0.5;
  var r = (color & 1) * mult * 255;
  var g = (color >> 1 & 1) * mult * 255;
  var b = (color >> 2 & 1) * mult * 255;
  return [r, g, b];
};

convert.ansi256.rgb = function (args) {
  // Handle greyscale
  if (args >= 232) {
    var c = (args - 232) * 10 + 8;
    return [c, c, c];
  }

  args -= 16;
  var rem;
  var r = Math.floor(args / 36) / 5 * 255;
  var g = Math.floor((rem = args % 36) / 6) / 5 * 255;
  var b = rem % 6 / 5 * 255;
  return [r, g, b];
};

convert.rgb.hex = function (args) {
  var integer = ((Math.round(args[0]) & 0xFF) << 16) + ((Math.round(args[1]) & 0xFF) << 8) + (Math.round(args[2]) & 0xFF);
  var string = integer.toString(16).toUpperCase();
  return '000000'.substring(string.length) + string;
};

convert.hex.rgb = function (args) {
  var match = args.toString(16).match(/[a-f0-9]{6}|[a-f0-9]{3}/i);

  if (!match) {
    return [0, 0, 0];
  }

  var colorString = match[0];

  if (match[0].length === 3) {
    colorString = colorString.split('').map(function (char) {
      return char + char;
    }).join('');
  }

  var integer = parseInt(colorString, 16);
  var r = integer >> 16 & 0xFF;
  var g = integer >> 8 & 0xFF;
  var b = integer & 0xFF;
  return [r, g, b];
};

convert.rgb.hcg = function (rgb) {
  var r = rgb[0] / 255;
  var g = rgb[1] / 255;
  var b = rgb[2] / 255;
  var max = Math.max(Math.max(r, g), b);
  var min = Math.min(Math.min(r, g), b);
  var chroma = max - min;
  var grayscale;
  var hue;

  if (chroma < 1) {
    grayscale = min / (1 - chroma);
  } else {
    grayscale = 0;
  }

  if (chroma <= 0) {
    hue = 0;
  } else if (max === r) {
    hue = (g - b) / chroma % 6;
  } else if (max === g) {
    hue = 2 + (b - r) / chroma;
  } else {
    hue = 4 + (r - g) / chroma;
  }

  hue /= 6;
  hue %= 1;
  return [hue * 360, chroma * 100, grayscale * 100];
};

convert.hsl.hcg = function (hsl) {
  var s = hsl[1] / 100;
  var l = hsl[2] / 100;
  var c = l < 0.5 ? 2.0 * s * l : 2.0 * s * (1.0 - l);
  var f = 0;

  if (c < 1.0) {
    f = (l - 0.5 * c) / (1.0 - c);
  }

  return [hsl[0], c * 100, f * 100];
};

convert.hsv.hcg = function (hsv) {
  var s = hsv[1] / 100;
  var v = hsv[2] / 100;
  var c = s * v;
  var f = 0;

  if (c < 1.0) {
    f = (v - c) / (1 - c);
  }

  return [hsv[0], c * 100, f * 100];
};

convert.hcg.rgb = function (hcg) {
  var h = hcg[0] / 360;
  var c = hcg[1] / 100;
  var g = hcg[2] / 100;

  if (c === 0.0) {
    return [g * 255, g * 255, g * 255];
  }

  var pure = [0, 0, 0];
  var hi = h % 1 * 6;
  var v = hi % 1;
  var w = 1 - v;
  var mg = 0;
  /* eslint-disable max-statements-per-line */

  switch (Math.floor(hi)) {
    case 0:
      pure[0] = 1;
      pure[1] = v;
      pure[2] = 0;
      break;

    case 1:
      pure[0] = w;
      pure[1] = 1;
      pure[2] = 0;
      break;

    case 2:
      pure[0] = 0;
      pure[1] = 1;
      pure[2] = v;
      break;

    case 3:
      pure[0] = 0;
      pure[1] = w;
      pure[2] = 1;
      break;

    case 4:
      pure[0] = v;
      pure[1] = 0;
      pure[2] = 1;
      break;

    default:
      pure[0] = 1;
      pure[1] = 0;
      pure[2] = w;
  }
  /* eslint-enable max-statements-per-line */


  mg = (1.0 - c) * g;
  return [(c * pure[0] + mg) * 255, (c * pure[1] + mg) * 255, (c * pure[2] + mg) * 255];
};

convert.hcg.hsv = function (hcg) {
  var c = hcg[1] / 100;
  var g = hcg[2] / 100;
  var v = c + g * (1.0 - c);
  var f = 0;

  if (v > 0.0) {
    f = c / v;
  }

  return [hcg[0], f * 100, v * 100];
};

convert.hcg.hsl = function (hcg) {
  var c = hcg[1] / 100;
  var g = hcg[2] / 100;
  var l = g * (1.0 - c) + 0.5 * c;
  var s = 0;

  if (l > 0.0 && l < 0.5) {
    s = c / (2 * l);
  } else if (l >= 0.5 && l < 1.0) {
    s = c / (2 * (1 - l));
  }

  return [hcg[0], s * 100, l * 100];
};

convert.hcg.hwb = function (hcg) {
  var c = hcg[1] / 100;
  var g = hcg[2] / 100;
  var v = c + g * (1.0 - c);
  return [hcg[0], (v - c) * 100, (1 - v) * 100];
};

convert.hwb.hcg = function (hwb) {
  var w = hwb[1] / 100;
  var b = hwb[2] / 100;
  var v = 1 - b;
  var c = v - w;
  var g = 0;

  if (c < 1) {
    g = (v - c) / (1 - c);
  }

  return [hwb[0], c * 100, g * 100];
};

convert.apple.rgb = function (apple) {
  return [apple[0] / 65535 * 255, apple[1] / 65535 * 255, apple[2] / 65535 * 255];
};

convert.rgb.apple = function (rgb) {
  return [rgb[0] / 255 * 65535, rgb[1] / 255 * 65535, rgb[2] / 255 * 65535];
};

convert.gray.rgb = function (args) {
  return [args[0] / 100 * 255, args[0] / 100 * 255, args[0] / 100 * 255];
};

convert.gray.hsl = function (args) {
  return [0, 0, args[0]];
};

convert.gray.hsv = convert.gray.hsl;

convert.gray.hwb = function (gray) {
  return [0, 100, gray[0]];
};

convert.gray.cmyk = function (gray) {
  return [0, 0, 0, gray[0]];
};

convert.gray.lab = function (gray) {
  return [gray[0], 0, 0];
};

convert.gray.hex = function (gray) {
  var val = Math.round(gray[0] / 100 * 255) & 0xFF;
  var integer = (val << 16) + (val << 8) + val;
  var string = integer.toString(16).toUpperCase();
  return '000000'.substring(string.length) + string;
};

convert.rgb.gray = function (rgb) {
  var val = (rgb[0] + rgb[1] + rgb[2]) / 3;
  return [val / 255 * 100];
};

/***/ }),

/***/ "./node_modules/ansi-styles/node_modules/color-convert/index.js":
/*!**********************************************************************!*\
  !*** ./node_modules/ansi-styles/node_modules/color-convert/index.js ***!
  \**********************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

var conversions = __webpack_require__(/*! ./conversions */ "./node_modules/ansi-styles/node_modules/color-convert/conversions.js");

var route = __webpack_require__(/*! ./route */ "./node_modules/ansi-styles/node_modules/color-convert/route.js");

var convert = {};
var models = Object.keys(conversions);

function wrapRaw(fn) {
  var wrappedFn = function wrappedFn() {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    var arg0 = args[0];

    if (arg0 === undefined || arg0 === null) {
      return arg0;
    }

    if (arg0.length > 1) {
      args = arg0;
    }

    return fn(args);
  }; // Preserve .conversion property if there is one


  if ('conversion' in fn) {
    wrappedFn.conversion = fn.conversion;
  }

  return wrappedFn;
}

function wrapRounded(fn) {
  var wrappedFn = function wrappedFn() {
    for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    var arg0 = args[0];

    if (arg0 === undefined || arg0 === null) {
      return arg0;
    }

    if (arg0.length > 1) {
      args = arg0;
    }

    var result = fn(args); // We're assuming the result is an array here.
    // see notice in conversions.js; don't use box types
    // in conversion functions.

    if (_typeof(result) === 'object') {
      for (var len = result.length, i = 0; i < len; i++) {
        result[i] = Math.round(result[i]);
      }
    }

    return result;
  }; // Preserve .conversion property if there is one


  if ('conversion' in fn) {
    wrappedFn.conversion = fn.conversion;
  }

  return wrappedFn;
}

models.forEach(function (fromModel) {
  convert[fromModel] = {};
  Object.defineProperty(convert[fromModel], 'channels', {
    value: conversions[fromModel].channels
  });
  Object.defineProperty(convert[fromModel], 'labels', {
    value: conversions[fromModel].labels
  });
  var routes = route(fromModel);
  var routeModels = Object.keys(routes);
  routeModels.forEach(function (toModel) {
    var fn = routes[toModel];
    convert[fromModel][toModel] = wrapRounded(fn);
    convert[fromModel][toModel].raw = wrapRaw(fn);
  });
});
module.exports = convert;

/***/ }),

/***/ "./node_modules/ansi-styles/node_modules/color-convert/route.js":
/*!**********************************************************************!*\
  !*** ./node_modules/ansi-styles/node_modules/color-convert/route.js ***!
  \**********************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var conversions = __webpack_require__(/*! ./conversions */ "./node_modules/ansi-styles/node_modules/color-convert/conversions.js");
/*
	This function routes a model to all other models.

	all functions that are routed have a property `.conversion` attached
	to the returned synthetic function. This property is an array
	of strings, each with the steps in between the 'from' and 'to'
	color models (inclusive).

	conversions that are not possible simply are not included.
*/


function buildGraph() {
  var graph = {}; // https://jsperf.com/object-keys-vs-for-in-with-closure/3

  var models = Object.keys(conversions);

  for (var len = models.length, i = 0; i < len; i++) {
    graph[models[i]] = {
      // http://jsperf.com/1-vs-infinity
      // micro-opt, but this is simple.
      distance: -1,
      parent: null
    };
  }

  return graph;
} // https://en.wikipedia.org/wiki/Breadth-first_search


function deriveBFS(fromModel) {
  var graph = buildGraph();
  var queue = [fromModel]; // Unshift -> queue -> pop

  graph[fromModel].distance = 0;

  while (queue.length) {
    var current = queue.pop();
    var adjacents = Object.keys(conversions[current]);

    for (var len = adjacents.length, i = 0; i < len; i++) {
      var adjacent = adjacents[i];
      var node = graph[adjacent];

      if (node.distance === -1) {
        node.distance = graph[current].distance + 1;
        node.parent = current;
        queue.unshift(adjacent);
      }
    }
  }

  return graph;
}

function link(from, to) {
  return function (args) {
    return to(from(args));
  };
}

function wrapConversion(toModel, graph) {
  var path = [graph[toModel].parent, toModel];
  var fn = conversions[graph[toModel].parent][toModel];
  var cur = graph[toModel].parent;

  while (graph[cur].parent) {
    path.unshift(graph[cur].parent);
    fn = link(conversions[graph[cur].parent][cur], fn);
    cur = graph[cur].parent;
  }

  fn.conversion = path;
  return fn;
}

module.exports = function (fromModel) {
  var graph = deriveBFS(fromModel);
  var conversion = {};
  var models = Object.keys(graph);

  for (var len = models.length, i = 0; i < len; i++) {
    var toModel = models[i];
    var node = graph[toModel];

    if (node.parent === null) {
      // No possible conversion, or this node is the source model.
      continue;
    }

    conversion[toModel] = wrapConversion(toModel, graph);
  }

  return conversion;
};

/***/ }),

/***/ "./node_modules/base64-js/index.js":
/*!*****************************************!*\
  !*** ./node_modules/base64-js/index.js ***!
  \*****************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.byteLength = byteLength;
exports.toByteArray = toByteArray;
exports.fromByteArray = fromByteArray;
var lookup = [];
var revLookup = [];
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;
var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i];
  revLookup[code.charCodeAt(i)] = i;
} // Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications


revLookup['-'.charCodeAt(0)] = 62;
revLookup['_'.charCodeAt(0)] = 63;

function getLens(b64) {
  var len = b64.length;

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4');
  } // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42


  var validLen = b64.indexOf('=');
  if (validLen === -1) validLen = len;
  var placeHoldersLen = validLen === len ? 0 : 4 - validLen % 4;
  return [validLen, placeHoldersLen];
} // base64 is 4/3 + up to two characters of the original data


function byteLength(b64) {
  var lens = getLens(b64);
  var validLen = lens[0];
  var placeHoldersLen = lens[1];
  return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
}

function _byteLength(b64, validLen, placeHoldersLen) {
  return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
}

function toByteArray(b64) {
  var tmp;
  var lens = getLens(b64);
  var validLen = lens[0];
  var placeHoldersLen = lens[1];
  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));
  var curByte = 0; // if there are placeholders, only get up to the last complete 4 chars

  var len = placeHoldersLen > 0 ? validLen - 4 : validLen;
  var i;

  for (i = 0; i < len; i += 4) {
    tmp = revLookup[b64.charCodeAt(i)] << 18 | revLookup[b64.charCodeAt(i + 1)] << 12 | revLookup[b64.charCodeAt(i + 2)] << 6 | revLookup[b64.charCodeAt(i + 3)];
    arr[curByte++] = tmp >> 16 & 0xFF;
    arr[curByte++] = tmp >> 8 & 0xFF;
    arr[curByte++] = tmp & 0xFF;
  }

  if (placeHoldersLen === 2) {
    tmp = revLookup[b64.charCodeAt(i)] << 2 | revLookup[b64.charCodeAt(i + 1)] >> 4;
    arr[curByte++] = tmp & 0xFF;
  }

  if (placeHoldersLen === 1) {
    tmp = revLookup[b64.charCodeAt(i)] << 10 | revLookup[b64.charCodeAt(i + 1)] << 4 | revLookup[b64.charCodeAt(i + 2)] >> 2;
    arr[curByte++] = tmp >> 8 & 0xFF;
    arr[curByte++] = tmp & 0xFF;
  }

  return arr;
}

function tripletToBase64(num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F];
}

function encodeChunk(uint8, start, end) {
  var tmp;
  var output = [];

  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16 & 0xFF0000) + (uint8[i + 1] << 8 & 0xFF00) + (uint8[i + 2] & 0xFF);
    output.push(tripletToBase64(tmp));
  }

  return output.join('');
}

function fromByteArray(uint8) {
  var tmp;
  var len = uint8.length;
  var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes

  var parts = [];
  var maxChunkLength = 16383; // must be multiple of 3
  // go through the array every three bytes, we'll deal with trailing stuff later

  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, i + maxChunkLength > len2 ? len2 : i + maxChunkLength));
  } // pad the end with zeros, but make sure to not forget the extra bytes


  if (extraBytes === 1) {
    tmp = uint8[len - 1];
    parts.push(lookup[tmp >> 2] + lookup[tmp << 4 & 0x3F] + '==');
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1];
    parts.push(lookup[tmp >> 10] + lookup[tmp >> 4 & 0x3F] + lookup[tmp << 2 & 0x3F] + '=');
  }

  return parts.join('');
}

/***/ }),

/***/ "./node_modules/braces/index.js":
/*!**************************************!*\
  !*** ./node_modules/braces/index.js ***!
  \**************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _createForOfIteratorHelper(o) { if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (o = _unsupportedIterableToArray(o))) { var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var it, normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

var stringify = __webpack_require__(/*! ./lib/stringify */ "./node_modules/braces/lib/stringify.js");

var compile = __webpack_require__(/*! ./lib/compile */ "./node_modules/braces/lib/compile.js");

var expand = __webpack_require__(/*! ./lib/expand */ "./node_modules/braces/lib/expand.js");

var parse = __webpack_require__(/*! ./lib/parse */ "./node_modules/braces/lib/parse.js");
/**
 * Expand the given pattern or create a regex-compatible string.
 *
 * ```js
 * const braces = require('braces');
 * console.log(braces('{a,b,c}', { compile: true })); //=> ['(a|b|c)']
 * console.log(braces('{a,b,c}')); //=> ['a', 'b', 'c']
 * ```
 * @param {String} `str`
 * @param {Object} `options`
 * @return {String}
 * @api public
 */


var braces = function braces(input) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var output = [];

  if (Array.isArray(input)) {
    var _iterator = _createForOfIteratorHelper(input),
        _step;

    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        var pattern = _step.value;
        var result = braces.create(pattern, options);

        if (Array.isArray(result)) {
          var _output;

          (_output = output).push.apply(_output, _toConsumableArray(result));
        } else {
          output.push(result);
        }
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }
  } else {
    output = [].concat(braces.create(input, options));
  }

  if (options && options.expand === true && options.nodupes === true) {
    output = _toConsumableArray(new Set(output));
  }

  return output;
};
/**
 * Parse the given `str` with the given `options`.
 *
 * ```js
 * // braces.parse(pattern, [, options]);
 * const ast = braces.parse('a/{b,c}/d');
 * console.log(ast);
 * ```
 * @param {String} pattern Brace pattern to parse
 * @param {Object} options
 * @return {Object} Returns an AST
 * @api public
 */


braces.parse = function (input) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  return parse(input, options);
};
/**
 * Creates a braces string from an AST, or an AST node.
 *
 * ```js
 * const braces = require('braces');
 * let ast = braces.parse('foo/{a,b}/bar');
 * console.log(stringify(ast.nodes[2])); //=> '{a,b}'
 * ```
 * @param {String} `input` Brace pattern or AST.
 * @param {Object} `options`
 * @return {Array} Returns an array of expanded values.
 * @api public
 */


braces.stringify = function (input) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  if (typeof input === 'string') {
    return stringify(braces.parse(input, options), options);
  }

  return stringify(input, options);
};
/**
 * Compiles a brace pattern into a regex-compatible, optimized string.
 * This method is called by the main [braces](#braces) function by default.
 *
 * ```js
 * const braces = require('braces');
 * console.log(braces.compile('a/{b,c}/d'));
 * //=> ['a/(b|c)/d']
 * ```
 * @param {String} `input` Brace pattern or AST.
 * @param {Object} `options`
 * @return {Array} Returns an array of expanded values.
 * @api public
 */


braces.compile = function (input) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  if (typeof input === 'string') {
    input = braces.parse(input, options);
  }

  return compile(input, options);
};
/**
 * Expands a brace pattern into an array. This method is called by the
 * main [braces](#braces) function when `options.expand` is true. Before
 * using this method it's recommended that you read the [performance notes](#performance))
 * and advantages of using [.compile](#compile) instead.
 *
 * ```js
 * const braces = require('braces');
 * console.log(braces.expand('a/{b,c}/d'));
 * //=> ['a/b/d', 'a/c/d'];
 * ```
 * @param {String} `pattern` Brace pattern
 * @param {Object} `options`
 * @return {Array} Returns an array of expanded values.
 * @api public
 */


braces.expand = function (input) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  if (typeof input === 'string') {
    input = braces.parse(input, options);
  }

  var result = expand(input, options); // filter out empty strings if specified

  if (options.noempty === true) {
    result = result.filter(Boolean);
  } // filter out duplicates if specified


  if (options.nodupes === true) {
    result = _toConsumableArray(new Set(result));
  }

  return result;
};
/**
 * Processes a brace pattern and returns either an expanded array
 * (if `options.expand` is true), a highly optimized regex-compatible string.
 * This method is called by the main [braces](#braces) function.
 *
 * ```js
 * const braces = require('braces');
 * console.log(braces.create('user-{200..300}/project-{a,b,c}-{1..10}'))
 * //=> 'user-(20[0-9]|2[1-9][0-9]|300)/project-(a|b|c)-([1-9]|10)'
 * ```
 * @param {String} `pattern` Brace pattern
 * @param {Object} `options`
 * @return {Array} Returns an array of expanded values.
 * @api public
 */


braces.create = function (input) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  if (input === '' || input.length < 3) {
    return [input];
  }

  return options.expand !== true ? braces.compile(input, options) : braces.expand(input, options);
};
/**
 * Expose "braces"
 */


module.exports = braces;

/***/ }),

/***/ "./node_modules/braces/lib/compile.js":
/*!********************************************!*\
  !*** ./node_modules/braces/lib/compile.js ***!
  \********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _createForOfIteratorHelper(o) { if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (o = _unsupportedIterableToArray(o))) { var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var it, normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

var fill = __webpack_require__(/*! fill-range */ "./node_modules/fill-range/index.js");

var utils = __webpack_require__(/*! ./utils */ "./node_modules/braces/lib/utils.js");

var compile = function compile(ast) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var walk = function walk(node) {
    var parent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var invalidBlock = utils.isInvalidBrace(parent);
    var invalidNode = node.invalid === true && options.escapeInvalid === true;
    var invalid = invalidBlock === true || invalidNode === true;
    var prefix = options.escapeInvalid === true ? '\\' : '';
    var output = '';

    if (node.isOpen === true) {
      return prefix + node.value;
    }

    if (node.isClose === true) {
      return prefix + node.value;
    }

    if (node.type === 'open') {
      return invalid ? prefix + node.value : '(';
    }

    if (node.type === 'close') {
      return invalid ? prefix + node.value : ')';
    }

    if (node.type === 'comma') {
      return node.prev.type === 'comma' ? '' : invalid ? node.value : '|';
    }

    if (node.value) {
      return node.value;
    }

    if (node.nodes && node.ranges > 0) {
      var args = utils.reduce(node.nodes);
      var range = fill.apply(void 0, _toConsumableArray(args).concat([_objectSpread({}, options, {
        wrap: false,
        toRegex: true
      })]));

      if (range.length !== 0) {
        return args.length > 1 && range.length > 1 ? "(".concat(range, ")") : range;
      }
    }

    if (node.nodes) {
      var _iterator = _createForOfIteratorHelper(node.nodes),
          _step;

      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var child = _step.value;
          output += walk(child, node);
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
    }

    return output;
  };

  return walk(ast);
};

module.exports = compile;

/***/ }),

/***/ "./node_modules/braces/lib/constants.js":
/*!**********************************************!*\
  !*** ./node_modules/braces/lib/constants.js ***!
  \**********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = {
  MAX_LENGTH: 1024 * 64,
  // Digits
  CHAR_0: '0',

  /* 0 */
  CHAR_9: '9',

  /* 9 */
  // Alphabet chars.
  CHAR_UPPERCASE_A: 'A',

  /* A */
  CHAR_LOWERCASE_A: 'a',

  /* a */
  CHAR_UPPERCASE_Z: 'Z',

  /* Z */
  CHAR_LOWERCASE_Z: 'z',

  /* z */
  CHAR_LEFT_PARENTHESES: '(',

  /* ( */
  CHAR_RIGHT_PARENTHESES: ')',

  /* ) */
  CHAR_ASTERISK: '*',

  /* * */
  // Non-alphabetic chars.
  CHAR_AMPERSAND: '&',

  /* & */
  CHAR_AT: '@',

  /* @ */
  CHAR_BACKSLASH: '\\',

  /* \ */
  CHAR_BACKTICK: '`',

  /* ` */
  CHAR_CARRIAGE_RETURN: '\r',

  /* \r */
  CHAR_CIRCUMFLEX_ACCENT: '^',

  /* ^ */
  CHAR_COLON: ':',

  /* : */
  CHAR_COMMA: ',',

  /* , */
  CHAR_DOLLAR: '$',

  /* . */
  CHAR_DOT: '.',

  /* . */
  CHAR_DOUBLE_QUOTE: '"',

  /* " */
  CHAR_EQUAL: '=',

  /* = */
  CHAR_EXCLAMATION_MARK: '!',

  /* ! */
  CHAR_FORM_FEED: '\f',

  /* \f */
  CHAR_FORWARD_SLASH: '/',

  /* / */
  CHAR_HASH: '#',

  /* # */
  CHAR_HYPHEN_MINUS: '-',

  /* - */
  CHAR_LEFT_ANGLE_BRACKET: '<',

  /* < */
  CHAR_LEFT_CURLY_BRACE: '{',

  /* { */
  CHAR_LEFT_SQUARE_BRACKET: '[',

  /* [ */
  CHAR_LINE_FEED: '\n',

  /* \n */
  CHAR_NO_BREAK_SPACE: "\xA0",

  /* \u00A0 */
  CHAR_PERCENT: '%',

  /* % */
  CHAR_PLUS: '+',

  /* + */
  CHAR_QUESTION_MARK: '?',

  /* ? */
  CHAR_RIGHT_ANGLE_BRACKET: '>',

  /* > */
  CHAR_RIGHT_CURLY_BRACE: '}',

  /* } */
  CHAR_RIGHT_SQUARE_BRACKET: ']',

  /* ] */
  CHAR_SEMICOLON: ';',

  /* ; */
  CHAR_SINGLE_QUOTE: '\'',

  /* ' */
  CHAR_SPACE: ' ',

  /*   */
  CHAR_TAB: '\t',

  /* \t */
  CHAR_UNDERSCORE: '_',

  /* _ */
  CHAR_VERTICAL_LINE: '|',

  /* | */
  CHAR_ZERO_WIDTH_NOBREAK_SPACE: "\uFEFF"
  /* \uFEFF */

};

/***/ }),

/***/ "./node_modules/braces/lib/expand.js":
/*!*******************************************!*\
  !*** ./node_modules/braces/lib/expand.js ***!
  \*******************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _createForOfIteratorHelper(o) { if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (o = _unsupportedIterableToArray(o))) { var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var it, normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

var fill = __webpack_require__(/*! fill-range */ "./node_modules/fill-range/index.js");

var stringify = __webpack_require__(/*! ./stringify */ "./node_modules/braces/lib/stringify.js");

var utils = __webpack_require__(/*! ./utils */ "./node_modules/braces/lib/utils.js");

var append = function append() {
  var queue = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  var stash = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
  var enclose = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  var result = [];
  queue = [].concat(queue);
  stash = [].concat(stash);
  if (!stash.length) return queue;

  if (!queue.length) {
    return enclose ? utils.flatten(stash).map(function (ele) {
      return "{".concat(ele, "}");
    }) : stash;
  }

  var _iterator = _createForOfIteratorHelper(queue),
      _step;

  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var item = _step.value;

      if (Array.isArray(item)) {
        var _iterator2 = _createForOfIteratorHelper(item),
            _step2;

        try {
          for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
            var value = _step2.value;
            result.push(append(value, stash, enclose));
          }
        } catch (err) {
          _iterator2.e(err);
        } finally {
          _iterator2.f();
        }
      } else {
        var _iterator3 = _createForOfIteratorHelper(stash),
            _step3;

        try {
          for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
            var ele = _step3.value;
            if (enclose === true && typeof ele === 'string') ele = "{".concat(ele, "}");
            result.push(Array.isArray(ele) ? append(item, ele, enclose) : item + ele);
          }
        } catch (err) {
          _iterator3.e(err);
        } finally {
          _iterator3.f();
        }
      }
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }

  return utils.flatten(result);
};

var expand = function expand(ast) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var rangeLimit = options.rangeLimit === void 0 ? 1000 : options.rangeLimit;

  var walk = function walk(node) {
    var parent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    node.queue = [];
    var p = parent;
    var q = parent.queue;

    while (p.type !== 'brace' && p.type !== 'root' && p.parent) {
      p = p.parent;
      q = p.queue;
    }

    if (node.invalid || node.dollar) {
      q.push(append(q.pop(), stringify(node, options)));
      return;
    }

    if (node.type === 'brace' && node.invalid !== true && node.nodes.length === 2) {
      q.push(append(q.pop(), ['{}']));
      return;
    }

    if (node.nodes && node.ranges > 0) {
      var args = utils.reduce(node.nodes);

      if (utils.exceedsLimit.apply(utils, _toConsumableArray(args).concat([options.step, rangeLimit]))) {
        throw new RangeError('expanded array length exceeds range limit. Use options.rangeLimit to increase or disable the limit.');
      }

      var range = fill.apply(void 0, _toConsumableArray(args).concat([options]));

      if (range.length === 0) {
        range = stringify(node, options);
      }

      q.push(append(q.pop(), range));
      node.nodes = [];
      return;
    }

    var enclose = utils.encloseBrace(node);
    var queue = node.queue;
    var block = node;

    while (block.type !== 'brace' && block.type !== 'root' && block.parent) {
      block = block.parent;
      queue = block.queue;
    }

    for (var i = 0; i < node.nodes.length; i++) {
      var child = node.nodes[i];

      if (child.type === 'comma' && node.type === 'brace') {
        if (i === 1) queue.push('');
        queue.push('');
        continue;
      }

      if (child.type === 'close') {
        q.push(append(q.pop(), queue, enclose));
        continue;
      }

      if (child.value && child.type !== 'open') {
        queue.push(append(queue.pop(), child.value));
        continue;
      }

      if (child.nodes) {
        walk(child, node);
      }
    }

    return queue;
  };

  return utils.flatten(walk(ast));
};

module.exports = expand;

/***/ }),

/***/ "./node_modules/braces/lib/parse.js":
/*!******************************************!*\
  !*** ./node_modules/braces/lib/parse.js ***!
  \******************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

var stringify = __webpack_require__(/*! ./stringify */ "./node_modules/braces/lib/stringify.js");
/**
 * Constants
 */


var _require = __webpack_require__(/*! ./constants */ "./node_modules/braces/lib/constants.js"),
    MAX_LENGTH = _require.MAX_LENGTH,
    CHAR_BACKSLASH = _require.CHAR_BACKSLASH,
    CHAR_BACKTICK = _require.CHAR_BACKTICK,
    CHAR_COMMA = _require.CHAR_COMMA,
    CHAR_DOT = _require.CHAR_DOT,
    CHAR_LEFT_PARENTHESES = _require.CHAR_LEFT_PARENTHESES,
    CHAR_RIGHT_PARENTHESES = _require.CHAR_RIGHT_PARENTHESES,
    CHAR_LEFT_CURLY_BRACE = _require.CHAR_LEFT_CURLY_BRACE,
    CHAR_RIGHT_CURLY_BRACE = _require.CHAR_RIGHT_CURLY_BRACE,
    CHAR_LEFT_SQUARE_BRACKET = _require.CHAR_LEFT_SQUARE_BRACKET,
    CHAR_RIGHT_SQUARE_BRACKET = _require.CHAR_RIGHT_SQUARE_BRACKET,
    CHAR_DOUBLE_QUOTE = _require.CHAR_DOUBLE_QUOTE,
    CHAR_SINGLE_QUOTE = _require.CHAR_SINGLE_QUOTE,
    CHAR_NO_BREAK_SPACE = _require.CHAR_NO_BREAK_SPACE,
    CHAR_ZERO_WIDTH_NOBREAK_SPACE = _require.CHAR_ZERO_WIDTH_NOBREAK_SPACE;
/**
 * parse
 */


var parse = function parse(input) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  if (typeof input !== 'string') {
    throw new TypeError('Expected a string');
  }

  var opts = options || {};
  var max = typeof opts.maxLength === 'number' ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;

  if (input.length > max) {
    throw new SyntaxError("Input length (".concat(input.length, "), exceeds max characters (").concat(max, ")"));
  }

  var ast = {
    type: 'root',
    input: input,
    nodes: []
  };
  var stack = [ast];
  var block = ast;
  var prev = ast;
  var brackets = 0;
  var length = input.length;
  var index = 0;
  var depth = 0;
  var value;
  var memo = {};
  /**
   * Helpers
   */

  var advance = function advance() {
    return input[index++];
  };

  var push = function push(node) {
    if (node.type === 'text' && prev.type === 'dot') {
      prev.type = 'text';
    }

    if (prev && prev.type === 'text' && node.type === 'text') {
      prev.value += node.value;
      return;
    }

    block.nodes.push(node);
    node.parent = block;
    node.prev = prev;
    prev = node;
    return node;
  };

  push({
    type: 'bos'
  });

  while (index < length) {
    block = stack[stack.length - 1];
    value = advance();
    /**
     * Invalid chars
     */

    if (value === CHAR_ZERO_WIDTH_NOBREAK_SPACE || value === CHAR_NO_BREAK_SPACE) {
      continue;
    }
    /**
     * Escaped chars
     */


    if (value === CHAR_BACKSLASH) {
      push({
        type: 'text',
        value: (options.keepEscaping ? value : '') + advance()
      });
      continue;
    }
    /**
     * Right square bracket (literal): ']'
     */


    if (value === CHAR_RIGHT_SQUARE_BRACKET) {
      push({
        type: 'text',
        value: '\\' + value
      });
      continue;
    }
    /**
     * Left square bracket: '['
     */


    if (value === CHAR_LEFT_SQUARE_BRACKET) {
      brackets++;
      var closed = true;
      var next = void 0;

      while (index < length && (next = advance())) {
        value += next;

        if (next === CHAR_LEFT_SQUARE_BRACKET) {
          brackets++;
          continue;
        }

        if (next === CHAR_BACKSLASH) {
          value += advance();
          continue;
        }

        if (next === CHAR_RIGHT_SQUARE_BRACKET) {
          brackets--;

          if (brackets === 0) {
            break;
          }
        }
      }

      push({
        type: 'text',
        value: value
      });
      continue;
    }
    /**
     * Parentheses
     */


    if (value === CHAR_LEFT_PARENTHESES) {
      block = push({
        type: 'paren',
        nodes: []
      });
      stack.push(block);
      push({
        type: 'text',
        value: value
      });
      continue;
    }

    if (value === CHAR_RIGHT_PARENTHESES) {
      if (block.type !== 'paren') {
        push({
          type: 'text',
          value: value
        });
        continue;
      }

      block = stack.pop();
      push({
        type: 'text',
        value: value
      });
      block = stack[stack.length - 1];
      continue;
    }
    /**
     * Quotes: '|"|`
     */


    if (value === CHAR_DOUBLE_QUOTE || value === CHAR_SINGLE_QUOTE || value === CHAR_BACKTICK) {
      var open = value;

      var _next = void 0;

      if (options.keepQuotes !== true) {
        value = '';
      }

      while (index < length && (_next = advance())) {
        if (_next === CHAR_BACKSLASH) {
          value += _next + advance();
          continue;
        }

        if (_next === open) {
          if (options.keepQuotes === true) value += _next;
          break;
        }

        value += _next;
      }

      push({
        type: 'text',
        value: value
      });
      continue;
    }
    /**
     * Left curly brace: '{'
     */


    if (value === CHAR_LEFT_CURLY_BRACE) {
      depth++;
      var dollar = prev.value && prev.value.slice(-1) === '$' || block.dollar === true;
      var brace = {
        type: 'brace',
        open: true,
        close: false,
        dollar: dollar,
        depth: depth,
        commas: 0,
        ranges: 0,
        nodes: []
      };
      block = push(brace);
      stack.push(block);
      push({
        type: 'open',
        value: value
      });
      continue;
    }
    /**
     * Right curly brace: '}'
     */


    if (value === CHAR_RIGHT_CURLY_BRACE) {
      if (block.type !== 'brace') {
        push({
          type: 'text',
          value: value
        });
        continue;
      }

      var type = 'close';
      block = stack.pop();
      block.close = true;
      push({
        type: type,
        value: value
      });
      depth--;
      block = stack[stack.length - 1];
      continue;
    }
    /**
     * Comma: ','
     */


    if (value === CHAR_COMMA && depth > 0) {
      if (block.ranges > 0) {
        block.ranges = 0;

        var _open = block.nodes.shift();

        block.nodes = [_open, {
          type: 'text',
          value: stringify(block)
        }];
      }

      push({
        type: 'comma',
        value: value
      });
      block.commas++;
      continue;
    }
    /**
     * Dot: '.'
     */


    if (value === CHAR_DOT && depth > 0 && block.commas === 0) {
      var siblings = block.nodes;

      if (depth === 0 || siblings.length === 0) {
        push({
          type: 'text',
          value: value
        });
        continue;
      }

      if (prev.type === 'dot') {
        block.range = [];
        prev.value += value;
        prev.type = 'range';

        if (block.nodes.length !== 3 && block.nodes.length !== 5) {
          block.invalid = true;
          block.ranges = 0;
          prev.type = 'text';
          continue;
        }

        block.ranges++;
        block.args = [];
        continue;
      }

      if (prev.type === 'range') {
        siblings.pop();
        var before = siblings[siblings.length - 1];
        before.value += prev.value + value;
        prev = before;
        block.ranges--;
        continue;
      }

      push({
        type: 'dot',
        value: value
      });
      continue;
    }
    /**
     * Text
     */


    push({
      type: 'text',
      value: value
    });
  } // Mark imbalanced braces and brackets as invalid


  do {
    block = stack.pop();

    if (block.type !== 'root') {
      var _parent$nodes;

      block.nodes.forEach(function (node) {
        if (!node.nodes) {
          if (node.type === 'open') node.isOpen = true;
          if (node.type === 'close') node.isClose = true;
          if (!node.nodes) node.type = 'text';
          node.invalid = true;
        }
      }); // get the location of the block on parent.nodes (block's siblings)

      var parent = stack[stack.length - 1];

      var _index = parent.nodes.indexOf(block); // replace the (invalid) block with it's nodes


      (_parent$nodes = parent.nodes).splice.apply(_parent$nodes, [_index, 1].concat(_toConsumableArray(block.nodes)));
    }
  } while (stack.length > 0);

  push({
    type: 'eos'
  });
  return ast;
};

module.exports = parse;

/***/ }),

/***/ "./node_modules/braces/lib/stringify.js":
/*!**********************************************!*\
  !*** ./node_modules/braces/lib/stringify.js ***!
  \**********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _createForOfIteratorHelper(o) { if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (o = _unsupportedIterableToArray(o))) { var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var it, normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

var utils = __webpack_require__(/*! ./utils */ "./node_modules/braces/lib/utils.js");

module.exports = function (ast) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var stringify = function stringify(node) {
    var parent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var invalidBlock = options.escapeInvalid && utils.isInvalidBrace(parent);
    var invalidNode = node.invalid === true && options.escapeInvalid === true;
    var output = '';

    if (node.value) {
      if ((invalidBlock || invalidNode) && utils.isOpenOrClose(node)) {
        return '\\' + node.value;
      }

      return node.value;
    }

    if (node.value) {
      return node.value;
    }

    if (node.nodes) {
      var _iterator = _createForOfIteratorHelper(node.nodes),
          _step;

      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var child = _step.value;
          output += stringify(child);
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
    }

    return output;
  };

  return stringify(ast);
};

/***/ }),

/***/ "./node_modules/braces/lib/utils.js":
/*!******************************************!*\
  !*** ./node_modules/braces/lib/utils.js ***!
  \******************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.isInteger = function (num) {
  if (typeof num === 'number') {
    return Number.isInteger(num);
  }

  if (typeof num === 'string' && num.trim() !== '') {
    return Number.isInteger(Number(num));
  }

  return false;
};
/**
 * Find a node of the given type
 */


exports.find = function (node, type) {
  return node.nodes.find(function (node) {
    return node.type === type;
  });
};
/**
 * Find a node of the given type
 */


exports.exceedsLimit = function (min, max) {
  var step = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;
  var limit = arguments.length > 3 ? arguments[3] : undefined;
  if (limit === false) return false;
  if (!exports.isInteger(min) || !exports.isInteger(max)) return false;
  return (Number(max) - Number(min)) / Number(step) >= limit;
};
/**
 * Escape the given node with '\\' before node.value
 */


exports.escapeNode = function (block) {
  var n = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  var type = arguments.length > 2 ? arguments[2] : undefined;
  var node = block.nodes[n];
  if (!node) return;

  if (type && node.type === type || node.type === 'open' || node.type === 'close') {
    if (node.escaped !== true) {
      node.value = '\\' + node.value;
      node.escaped = true;
    }
  }
};
/**
 * Returns true if the given brace node should be enclosed in literal braces
 */


exports.encloseBrace = function (node) {
  if (node.type !== 'brace') return false;

  if (node.commas >> 0 + node.ranges >> 0 === 0) {
    node.invalid = true;
    return true;
  }

  return false;
};
/**
 * Returns true if a brace node is invalid.
 */


exports.isInvalidBrace = function (block) {
  if (block.type !== 'brace') return false;
  if (block.invalid === true || block.dollar) return true;

  if (block.commas >> 0 + block.ranges >> 0 === 0) {
    block.invalid = true;
    return true;
  }

  if (block.open !== true || block.close !== true) {
    block.invalid = true;
    return true;
  }

  return false;
};
/**
 * Returns true if a node is an open or close node
 */


exports.isOpenOrClose = function (node) {
  if (node.type === 'open' || node.type === 'close') {
    return true;
  }

  return node.open === true || node.close === true;
};
/**
 * Reduce an array of text nodes.
 */


exports.reduce = function (nodes) {
  return nodes.reduce(function (acc, node) {
    if (node.type === 'text') acc.push(node.value);
    if (node.type === 'range') node.type = 'text';
    return acc;
  }, []);
};
/**
 * Flatten an array
 */


exports.flatten = function () {
  var result = [];

  var flat = function flat(arr) {
    for (var i = 0; i < arr.length; i++) {
      var ele = arr[i];
      Array.isArray(ele) ? flat(ele, result) : ele !== void 0 && result.push(ele);
    }

    return result;
  };

  for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  flat(args);
  return result;
};

/***/ }),

/***/ "./node_modules/buffer/index.js":
/*!**************************************!*\
  !*** ./node_modules/buffer/index.js ***!
  \**************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(global) {/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <http://feross.org>
 * @license  MIT
 */

/* eslint-disable no-proto */


var base64 = __webpack_require__(/*! base64-js */ "./node_modules/base64-js/index.js");

var ieee754 = __webpack_require__(/*! ieee754 */ "./node_modules/ieee754/index.js");

var isArray = __webpack_require__(/*! isarray */ "./node_modules/isarray/index.js");

exports.Buffer = Buffer;
exports.SlowBuffer = SlowBuffer;
exports.INSPECT_MAX_BYTES = 50;
/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */

Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined ? global.TYPED_ARRAY_SUPPORT : typedArraySupport();
/*
 * Export kMaxLength after typed array support is determined.
 */

exports.kMaxLength = kMaxLength();

function typedArraySupport() {
  try {
    var arr = new Uint8Array(1);
    arr.__proto__ = {
      __proto__: Uint8Array.prototype,
      foo: function foo() {
        return 42;
      }
    };
    return arr.foo() === 42 && // typed array instances can be augmented
    typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
    arr.subarray(1, 1).byteLength === 0; // ie10 has broken `subarray`
  } catch (e) {
    return false;
  }
}

function kMaxLength() {
  return Buffer.TYPED_ARRAY_SUPPORT ? 0x7fffffff : 0x3fffffff;
}

function createBuffer(that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length');
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length);
    that.__proto__ = Buffer.prototype;
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length);
    }

    that.length = length;
  }

  return that;
}
/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */


function Buffer(arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length);
  } // Common case.


  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error('If encoding is specified then the first argument must be a string');
    }

    return allocUnsafe(this, arg);
  }

  return from(this, arg, encodingOrOffset, length);
}

Buffer.poolSize = 8192; // not used by this implementation
// TODO: Legacy, not needed anymore. Remove in next major version.

Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype;
  return arr;
};

function from(that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number');
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length);
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset);
  }

  return fromObject(that, value);
}
/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/


Buffer.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length);
};

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype;
  Buffer.__proto__ = Uint8Array;

  if (typeof Symbol !== 'undefined' && Symbol.species && Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    });
  }
}

function assertSize(size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number');
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative');
  }
}

function alloc(that, size, fill, encoding) {
  assertSize(size);

  if (size <= 0) {
    return createBuffer(that, size);
  }

  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string' ? createBuffer(that, size).fill(fill, encoding) : createBuffer(that, size).fill(fill);
  }

  return createBuffer(that, size);
}
/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/


Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding);
};

function allocUnsafe(that, size) {
  assertSize(size);
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0);

  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0;
    }
  }

  return that;
}
/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */


Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size);
};
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */


Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size);
};

function fromString(that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8';
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding');
  }

  var length = byteLength(string, encoding) | 0;
  that = createBuffer(that, length);
  var actual = that.write(string, encoding);

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    that = that.slice(0, actual);
  }

  return that;
}

function fromArrayLike(that, array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0;
  that = createBuffer(that, length);

  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255;
  }

  return that;
}

function fromArrayBuffer(that, array, byteOffset, length) {
  array.byteLength; // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds');
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds');
  }

  if (byteOffset === undefined && length === undefined) {
    array = new Uint8Array(array);
  } else if (length === undefined) {
    array = new Uint8Array(array, byteOffset);
  } else {
    array = new Uint8Array(array, byteOffset, length);
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array;
    that.__proto__ = Buffer.prototype;
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array);
  }

  return that;
}

function fromObject(that, obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0;
    that = createBuffer(that, len);

    if (that.length === 0) {
      return that;
    }

    obj.copy(that, 0, 0, len);
    return that;
  }

  if (obj) {
    if (typeof ArrayBuffer !== 'undefined' && obj.buffer instanceof ArrayBuffer || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0);
      }

      return fromArrayLike(that, obj);
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data);
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.');
}

function checked(length) {
  // Note: cannot use `length < kMaxLength()` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' + 'size: 0x' + kMaxLength().toString(16) + ' bytes');
  }

  return length | 0;
}

function SlowBuffer(length) {
  if (+length != length) {
    // eslint-disable-line eqeqeq
    length = 0;
  }

  return Buffer.alloc(+length);
}

Buffer.isBuffer = function isBuffer(b) {
  return !!(b != null && b._isBuffer);
};

Buffer.compare = function compare(a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers');
  }

  if (a === b) return 0;
  var x = a.length;
  var y = b.length;

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break;
    }
  }

  if (x < y) return -1;
  if (y < x) return 1;
  return 0;
};

Buffer.isEncoding = function isEncoding(encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true;

    default:
      return false;
  }
};

Buffer.concat = function concat(list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers');
  }

  if (list.length === 0) {
    return Buffer.alloc(0);
  }

  var i;

  if (length === undefined) {
    length = 0;

    for (i = 0; i < list.length; ++i) {
      length += list[i].length;
    }
  }

  var buffer = Buffer.allocUnsafe(length);
  var pos = 0;

  for (i = 0; i < list.length; ++i) {
    var buf = list[i];

    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers');
    }

    buf.copy(buffer, pos);
    pos += buf.length;
  }

  return buffer;
};

function byteLength(string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length;
  }

  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' && (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength;
  }

  if (typeof string !== 'string') {
    string = '' + string;
  }

  var len = string.length;
  if (len === 0) return 0; // Use a for loop to avoid recursion

  var loweredCase = false;

  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len;

      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length;

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2;

      case 'hex':
        return len >>> 1;

      case 'base64':
        return base64ToBytes(string).length;

      default:
        if (loweredCase) return utf8ToBytes(string).length; // assume utf8

        encoding = ('' + encoding).toLowerCase();
        loweredCase = true;
    }
  }
}

Buffer.byteLength = byteLength;

function slowToString(encoding, start, end) {
  var loweredCase = false; // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.
  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.

  if (start === undefined || start < 0) {
    start = 0;
  } // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.


  if (start > this.length) {
    return '';
  }

  if (end === undefined || end > this.length) {
    end = this.length;
  }

  if (end <= 0) {
    return '';
  } // Force coersion to uint32. This will also coerce falsey/NaN values to 0.


  end >>>= 0;
  start >>>= 0;

  if (end <= start) {
    return '';
  }

  if (!encoding) encoding = 'utf8';

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end);

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end);

      case 'ascii':
        return asciiSlice(this, start, end);

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end);

      case 'base64':
        return base64Slice(this, start, end);

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end);

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding);
        encoding = (encoding + '').toLowerCase();
        loweredCase = true;
    }
  }
} // The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.


Buffer.prototype._isBuffer = true;

function swap(b, n, m) {
  var i = b[n];
  b[n] = b[m];
  b[m] = i;
}

Buffer.prototype.swap16 = function swap16() {
  var len = this.length;

  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits');
  }

  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1);
  }

  return this;
};

Buffer.prototype.swap32 = function swap32() {
  var len = this.length;

  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits');
  }

  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3);
    swap(this, i + 1, i + 2);
  }

  return this;
};

Buffer.prototype.swap64 = function swap64() {
  var len = this.length;

  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits');
  }

  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7);
    swap(this, i + 1, i + 6);
    swap(this, i + 2, i + 5);
    swap(this, i + 3, i + 4);
  }

  return this;
};

Buffer.prototype.toString = function toString() {
  var length = this.length | 0;
  if (length === 0) return '';
  if (arguments.length === 0) return utf8Slice(this, 0, length);
  return slowToString.apply(this, arguments);
};

Buffer.prototype.equals = function equals(b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer');
  if (this === b) return true;
  return Buffer.compare(this, b) === 0;
};

Buffer.prototype.inspect = function inspect() {
  var str = '';
  var max = exports.INSPECT_MAX_BYTES;

  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ');
    if (this.length > max) str += ' ... ';
  }

  return '<Buffer ' + str + '>';
};

Buffer.prototype.compare = function compare(target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer');
  }

  if (start === undefined) {
    start = 0;
  }

  if (end === undefined) {
    end = target ? target.length : 0;
  }

  if (thisStart === undefined) {
    thisStart = 0;
  }

  if (thisEnd === undefined) {
    thisEnd = this.length;
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index');
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0;
  }

  if (thisStart >= thisEnd) {
    return -1;
  }

  if (start >= end) {
    return 1;
  }

  start >>>= 0;
  end >>>= 0;
  thisStart >>>= 0;
  thisEnd >>>= 0;
  if (this === target) return 0;
  var x = thisEnd - thisStart;
  var y = end - start;
  var len = Math.min(x, y);
  var thisCopy = this.slice(thisStart, thisEnd);
  var targetCopy = target.slice(start, end);

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i];
      y = targetCopy[i];
      break;
    }
  }

  if (x < y) return -1;
  if (y < x) return 1;
  return 0;
}; // Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf


function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1; // Normalize byteOffset

  if (typeof byteOffset === 'string') {
    encoding = byteOffset;
    byteOffset = 0;
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff;
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000;
  }

  byteOffset = +byteOffset; // Coerce to Number.

  if (isNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : buffer.length - 1;
  } // Normalize byteOffset: negative offsets start from the end of the buffer


  if (byteOffset < 0) byteOffset = buffer.length + byteOffset;

  if (byteOffset >= buffer.length) {
    if (dir) return -1;else byteOffset = buffer.length - 1;
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0;else return -1;
  } // Normalize val


  if (typeof val === 'string') {
    val = Buffer.from(val, encoding);
  } // Finally, search either indexOf (if dir is true) or lastIndexOf


  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1;
    }

    return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
  } else if (typeof val === 'number') {
    val = val & 0xFF; // Search for a byte value [0-255]

    if (Buffer.TYPED_ARRAY_SUPPORT && typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);
      }
    }

    return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
  }

  throw new TypeError('val must be string, number or Buffer');
}

function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
  var indexSize = 1;
  var arrLength = arr.length;
  var valLength = val.length;

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase();

    if (encoding === 'ucs2' || encoding === 'ucs-2' || encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1;
      }

      indexSize = 2;
      arrLength /= 2;
      valLength /= 2;
      byteOffset /= 2;
    }
  }

  function read(buf, i) {
    if (indexSize === 1) {
      return buf[i];
    } else {
      return buf.readUInt16BE(i * indexSize);
    }
  }

  var i;

  if (dir) {
    var foundIndex = -1;

    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i;
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize;
      } else {
        if (foundIndex !== -1) i -= i - foundIndex;
        foundIndex = -1;
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;

    for (i = byteOffset; i >= 0; i--) {
      var found = true;

      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false;
          break;
        }
      }

      if (found) return i;
    }
  }

  return -1;
}

Buffer.prototype.includes = function includes(val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1;
};

Buffer.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
};

Buffer.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
};

function hexWrite(buf, string, offset, length) {
  offset = Number(offset) || 0;
  var remaining = buf.length - offset;

  if (!length) {
    length = remaining;
  } else {
    length = Number(length);

    if (length > remaining) {
      length = remaining;
    }
  } // must be an even number of digits


  var strLen = string.length;
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string');

  if (length > strLen / 2) {
    length = strLen / 2;
  }

  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16);
    if (isNaN(parsed)) return i;
    buf[offset + i] = parsed;
  }

  return i;
}

function utf8Write(buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
}

function asciiWrite(buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length);
}

function latin1Write(buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length);
}

function base64Write(buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length);
}

function ucs2Write(buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
}

Buffer.prototype.write = function write(string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8';
    length = this.length;
    offset = 0; // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset;
    length = this.length;
    offset = 0; // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0;

    if (isFinite(length)) {
      length = length | 0;
      if (encoding === undefined) encoding = 'utf8';
    } else {
      encoding = length;
      length = undefined;
    } // legacy write(string, encoding, offset, length) - remove in v0.13

  } else {
    throw new Error('Buffer.write(string, encoding, offset[, length]) is no longer supported');
  }

  var remaining = this.length - offset;
  if (length === undefined || length > remaining) length = remaining;

  if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds');
  }

  if (!encoding) encoding = 'utf8';
  var loweredCase = false;

  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length);

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length);

      case 'ascii':
        return asciiWrite(this, string, offset, length);

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length);

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length);

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length);

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding);
        encoding = ('' + encoding).toLowerCase();
        loweredCase = true;
    }
  }
};

Buffer.prototype.toJSON = function toJSON() {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  };
};

function base64Slice(buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf);
  } else {
    return base64.fromByteArray(buf.slice(start, end));
  }
}

function utf8Slice(buf, start, end) {
  end = Math.min(buf.length, end);
  var res = [];
  var i = start;

  while (i < end) {
    var firstByte = buf[i];
    var codePoint = null;
    var bytesPerSequence = firstByte > 0xEF ? 4 : firstByte > 0xDF ? 3 : firstByte > 0xBF ? 2 : 1;

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint;

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte;
          }

          break;

        case 2:
          secondByte = buf[i + 1];

          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | secondByte & 0x3F;

            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint;
            }
          }

          break;

        case 3:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];

          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | thirdByte & 0x3F;

            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint;
            }
          }

          break;

        case 4:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          fourthByte = buf[i + 3];

          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | fourthByte & 0x3F;

            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint;
            }
          }

      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD;
      bytesPerSequence = 1;
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000;
      res.push(codePoint >>> 10 & 0x3FF | 0xD800);
      codePoint = 0xDC00 | codePoint & 0x3FF;
    }

    res.push(codePoint);
    i += bytesPerSequence;
  }

  return decodeCodePointsArray(res);
} // Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety


var MAX_ARGUMENTS_LENGTH = 0x1000;

function decodeCodePointsArray(codePoints) {
  var len = codePoints.length;

  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints); // avoid extra slice()
  } // Decode in chunks to avoid "call stack size exceeded".


  var res = '';
  var i = 0;

  while (i < len) {
    res += String.fromCharCode.apply(String, codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH));
  }

  return res;
}

function asciiSlice(buf, start, end) {
  var ret = '';
  end = Math.min(buf.length, end);

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F);
  }

  return ret;
}

function latin1Slice(buf, start, end) {
  var ret = '';
  end = Math.min(buf.length, end);

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i]);
  }

  return ret;
}

function hexSlice(buf, start, end) {
  var len = buf.length;
  if (!start || start < 0) start = 0;
  if (!end || end < 0 || end > len) end = len;
  var out = '';

  for (var i = start; i < end; ++i) {
    out += toHex(buf[i]);
  }

  return out;
}

function utf16leSlice(buf, start, end) {
  var bytes = buf.slice(start, end);
  var res = '';

  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
  }

  return res;
}

Buffer.prototype.slice = function slice(start, end) {
  var len = this.length;
  start = ~~start;
  end = end === undefined ? len : ~~end;

  if (start < 0) {
    start += len;
    if (start < 0) start = 0;
  } else if (start > len) {
    start = len;
  }

  if (end < 0) {
    end += len;
    if (end < 0) end = 0;
  } else if (end > len) {
    end = len;
  }

  if (end < start) end = start;
  var newBuf;

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end);
    newBuf.__proto__ = Buffer.prototype;
  } else {
    var sliceLen = end - start;
    newBuf = new Buffer(sliceLen, undefined);

    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start];
    }
  }

  return newBuf;
};
/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */


function checkOffset(offset, ext, length) {
  if (offset % 1 !== 0 || offset < 0) throw new RangeError('offset is not uint');
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length');
}

Buffer.prototype.readUIntLE = function readUIntLE(offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);
  var val = this[offset];
  var mul = 1;
  var i = 0;

  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul;
  }

  return val;
};

Buffer.prototype.readUIntBE = function readUIntBE(offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;

  if (!noAssert) {
    checkOffset(offset, byteLength, this.length);
  }

  var val = this[offset + --byteLength];
  var mul = 1;

  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul;
  }

  return val;
};

Buffer.prototype.readUInt8 = function readUInt8(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length);
  return this[offset];
};

Buffer.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  return this[offset] | this[offset + 1] << 8;
};

Buffer.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  return this[offset] << 8 | this[offset + 1];
};

Buffer.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);
  return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 0x1000000;
};

Buffer.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);
  return this[offset] * 0x1000000 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
};

Buffer.prototype.readIntLE = function readIntLE(offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);
  var val = this[offset];
  var mul = 1;
  var i = 0;

  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul;
  }

  mul *= 0x80;
  if (val >= mul) val -= Math.pow(2, 8 * byteLength);
  return val;
};

Buffer.prototype.readIntBE = function readIntBE(offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);
  var i = byteLength;
  var mul = 1;
  var val = this[offset + --i];

  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul;
  }

  mul *= 0x80;
  if (val >= mul) val -= Math.pow(2, 8 * byteLength);
  return val;
};

Buffer.prototype.readInt8 = function readInt8(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length);
  if (!(this[offset] & 0x80)) return this[offset];
  return (0xff - this[offset] + 1) * -1;
};

Buffer.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  var val = this[offset] | this[offset + 1] << 8;
  return val & 0x8000 ? val | 0xFFFF0000 : val;
};

Buffer.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  var val = this[offset + 1] | this[offset] << 8;
  return val & 0x8000 ? val | 0xFFFF0000 : val;
};

Buffer.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);
  return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
};

Buffer.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);
  return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
};

Buffer.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);
  return ieee754.read(this, offset, true, 23, 4);
};

Buffer.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);
  return ieee754.read(this, offset, false, 23, 4);
};

Buffer.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length);
  return ieee754.read(this, offset, true, 52, 8);
};

Buffer.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length);
  return ieee754.read(this, offset, false, 52, 8);
};

function checkInt(buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance');
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds');
  if (offset + ext > buf.length) throw new RangeError('Index out of range');
}

Buffer.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  byteLength = byteLength | 0;

  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1;
    checkInt(this, value, offset, byteLength, maxBytes, 0);
  }

  var mul = 1;
  var i = 0;
  this[offset] = value & 0xFF;

  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = value / mul & 0xFF;
  }

  return offset + byteLength;
};

Buffer.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  byteLength = byteLength | 0;

  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1;
    checkInt(this, value, offset, byteLength, maxBytes, 0);
  }

  var i = byteLength - 1;
  var mul = 1;
  this[offset + i] = value & 0xFF;

  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = value / mul & 0xFF;
  }

  return offset + byteLength;
};

Buffer.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
  this[offset] = value & 0xff;
  return offset + 1;
};

function objectWriteUInt16(buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1;

  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & 0xff << 8 * (littleEndian ? i : 1 - i)) >>> (littleEndian ? i : 1 - i) * 8;
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value & 0xff;
    this[offset + 1] = value >>> 8;
  } else {
    objectWriteUInt16(this, value, offset, true);
  }

  return offset + 2;
};

Buffer.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value >>> 8;
    this[offset + 1] = value & 0xff;
  } else {
    objectWriteUInt16(this, value, offset, false);
  }

  return offset + 2;
};

function objectWriteUInt32(buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1;

  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = value >>> (littleEndian ? i : 3 - i) * 8 & 0xff;
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = value >>> 24;
    this[offset + 2] = value >>> 16;
    this[offset + 1] = value >>> 8;
    this[offset] = value & 0xff;
  } else {
    objectWriteUInt32(this, value, offset, true);
  }

  return offset + 4;
};

Buffer.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value >>> 24;
    this[offset + 1] = value >>> 16;
    this[offset + 2] = value >>> 8;
    this[offset + 3] = value & 0xff;
  } else {
    objectWriteUInt32(this, value, offset, false);
  }

  return offset + 4;
};

Buffer.prototype.writeIntLE = function writeIntLE(value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;

  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1);
    checkInt(this, value, offset, byteLength, limit - 1, -limit);
  }

  var i = 0;
  var mul = 1;
  var sub = 0;
  this[offset] = value & 0xFF;

  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1;
    }

    this[offset + i] = (value / mul >> 0) - sub & 0xFF;
  }

  return offset + byteLength;
};

Buffer.prototype.writeIntBE = function writeIntBE(value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;

  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1);
    checkInt(this, value, offset, byteLength, limit - 1, -limit);
  }

  var i = byteLength - 1;
  var mul = 1;
  var sub = 0;
  this[offset + i] = value & 0xFF;

  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1;
    }

    this[offset + i] = (value / mul >> 0) - sub & 0xFF;
  }

  return offset + byteLength;
};

Buffer.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
  if (value < 0) value = 0xff + value + 1;
  this[offset] = value & 0xff;
  return offset + 1;
};

Buffer.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value & 0xff;
    this[offset + 1] = value >>> 8;
  } else {
    objectWriteUInt16(this, value, offset, true);
  }

  return offset + 2;
};

Buffer.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value >>> 8;
    this[offset + 1] = value & 0xff;
  } else {
    objectWriteUInt16(this, value, offset, false);
  }

  return offset + 2;
};

Buffer.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value & 0xff;
    this[offset + 1] = value >>> 8;
    this[offset + 2] = value >>> 16;
    this[offset + 3] = value >>> 24;
  } else {
    objectWriteUInt32(this, value, offset, true);
  }

  return offset + 4;
};

Buffer.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
  if (value < 0) value = 0xffffffff + value + 1;

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value >>> 24;
    this[offset + 1] = value >>> 16;
    this[offset + 2] = value >>> 8;
    this[offset + 3] = value & 0xff;
  } else {
    objectWriteUInt32(this, value, offset, false);
  }

  return offset + 4;
};

function checkIEEE754(buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range');
  if (offset < 0) throw new RangeError('Index out of range');
}

function writeFloat(buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38);
  }

  ieee754.write(buf, value, offset, littleEndian, 23, 4);
  return offset + 4;
}

Buffer.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert);
};

Buffer.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert);
};

function writeDouble(buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308);
  }

  ieee754.write(buf, value, offset, littleEndian, 52, 8);
  return offset + 8;
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert);
};

Buffer.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert);
}; // copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)


Buffer.prototype.copy = function copy(target, targetStart, start, end) {
  if (!start) start = 0;
  if (!end && end !== 0) end = this.length;
  if (targetStart >= target.length) targetStart = target.length;
  if (!targetStart) targetStart = 0;
  if (end > 0 && end < start) end = start; // Copy 0 bytes; we're done

  if (end === start) return 0;
  if (target.length === 0 || this.length === 0) return 0; // Fatal error conditions

  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds');
  }

  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds');
  if (end < 0) throw new RangeError('sourceEnd out of bounds'); // Are we oob?

  if (end > this.length) end = this.length;

  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start;
  }

  var len = end - start;
  var i;

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start];
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start];
    }
  } else {
    Uint8Array.prototype.set.call(target, this.subarray(start, start + len), targetStart);
  }

  return len;
}; // Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])


Buffer.prototype.fill = function fill(val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start;
      start = 0;
      end = this.length;
    } else if (typeof end === 'string') {
      encoding = end;
      end = this.length;
    }

    if (val.length === 1) {
      var code = val.charCodeAt(0);

      if (code < 256) {
        val = code;
      }
    }

    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string');
    }

    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding);
    }
  } else if (typeof val === 'number') {
    val = val & 255;
  } // Invalid ranges are not set to a default, so can range check early.


  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index');
  }

  if (end <= start) {
    return this;
  }

  start = start >>> 0;
  end = end === undefined ? this.length : end >>> 0;
  if (!val) val = 0;
  var i;

  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val;
    }
  } else {
    var bytes = Buffer.isBuffer(val) ? val : utf8ToBytes(new Buffer(val, encoding).toString());
    var len = bytes.length;

    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len];
    }
  }

  return this;
}; // HELPER FUNCTIONS
// ================


var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g;

function base64clean(str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, ''); // Node converts strings with length < 2 to ''

  if (str.length < 2) return ''; // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not

  while (str.length % 4 !== 0) {
    str = str + '=';
  }

  return str;
}

function stringtrim(str) {
  if (str.trim) return str.trim();
  return str.replace(/^\s+|\s+$/g, '');
}

function toHex(n) {
  if (n < 16) return '0' + n.toString(16);
  return n.toString(16);
}

function utf8ToBytes(string, units) {
  units = units || Infinity;
  var codePoint;
  var length = string.length;
  var leadSurrogate = null;
  var bytes = [];

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i); // is surrogate component

    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
          continue;
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
          continue;
        } // valid lead


        leadSurrogate = codePoint;
        continue;
      } // 2 leads in a row


      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
        leadSurrogate = codePoint;
        continue;
      } // valid surrogate pair


      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
    }

    leadSurrogate = null; // encode utf8

    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break;
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break;
      bytes.push(codePoint >> 0x6 | 0xC0, codePoint & 0x3F | 0x80);
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break;
      bytes.push(codePoint >> 0xC | 0xE0, codePoint >> 0x6 & 0x3F | 0x80, codePoint & 0x3F | 0x80);
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break;
      bytes.push(codePoint >> 0x12 | 0xF0, codePoint >> 0xC & 0x3F | 0x80, codePoint >> 0x6 & 0x3F | 0x80, codePoint & 0x3F | 0x80);
    } else {
      throw new Error('Invalid code point');
    }
  }

  return bytes;
}

function asciiToBytes(str) {
  var byteArray = [];

  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF);
  }

  return byteArray;
}

function utf16leToBytes(str, units) {
  var c, hi, lo;
  var byteArray = [];

  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break;
    c = str.charCodeAt(i);
    hi = c >> 8;
    lo = c % 256;
    byteArray.push(lo);
    byteArray.push(hi);
  }

  return byteArray;
}

function base64ToBytes(str) {
  return base64.toByteArray(base64clean(str));
}

function blitBuffer(src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if (i + offset >= dst.length || i >= src.length) break;
    dst[i + offset] = src[i];
  }

  return i;
}

function isnan(val) {
  return val !== val; // eslint-disable-line no-self-compare
}
/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../webpack/buildin/global.js */ "./node_modules/webpack/buildin/global.js")))

/***/ }),

/***/ "./node_modules/color-name/index.js":
/*!******************************************!*\
  !*** ./node_modules/color-name/index.js ***!
  \******************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = {
  "aliceblue": [240, 248, 255],
  "antiquewhite": [250, 235, 215],
  "aqua": [0, 255, 255],
  "aquamarine": [127, 255, 212],
  "azure": [240, 255, 255],
  "beige": [245, 245, 220],
  "bisque": [255, 228, 196],
  "black": [0, 0, 0],
  "blanchedalmond": [255, 235, 205],
  "blue": [0, 0, 255],
  "blueviolet": [138, 43, 226],
  "brown": [165, 42, 42],
  "burlywood": [222, 184, 135],
  "cadetblue": [95, 158, 160],
  "chartreuse": [127, 255, 0],
  "chocolate": [210, 105, 30],
  "coral": [255, 127, 80],
  "cornflowerblue": [100, 149, 237],
  "cornsilk": [255, 248, 220],
  "crimson": [220, 20, 60],
  "cyan": [0, 255, 255],
  "darkblue": [0, 0, 139],
  "darkcyan": [0, 139, 139],
  "darkgoldenrod": [184, 134, 11],
  "darkgray": [169, 169, 169],
  "darkgreen": [0, 100, 0],
  "darkgrey": [169, 169, 169],
  "darkkhaki": [189, 183, 107],
  "darkmagenta": [139, 0, 139],
  "darkolivegreen": [85, 107, 47],
  "darkorange": [255, 140, 0],
  "darkorchid": [153, 50, 204],
  "darkred": [139, 0, 0],
  "darksalmon": [233, 150, 122],
  "darkseagreen": [143, 188, 143],
  "darkslateblue": [72, 61, 139],
  "darkslategray": [47, 79, 79],
  "darkslategrey": [47, 79, 79],
  "darkturquoise": [0, 206, 209],
  "darkviolet": [148, 0, 211],
  "deeppink": [255, 20, 147],
  "deepskyblue": [0, 191, 255],
  "dimgray": [105, 105, 105],
  "dimgrey": [105, 105, 105],
  "dodgerblue": [30, 144, 255],
  "firebrick": [178, 34, 34],
  "floralwhite": [255, 250, 240],
  "forestgreen": [34, 139, 34],
  "fuchsia": [255, 0, 255],
  "gainsboro": [220, 220, 220],
  "ghostwhite": [248, 248, 255],
  "gold": [255, 215, 0],
  "goldenrod": [218, 165, 32],
  "gray": [128, 128, 128],
  "green": [0, 128, 0],
  "greenyellow": [173, 255, 47],
  "grey": [128, 128, 128],
  "honeydew": [240, 255, 240],
  "hotpink": [255, 105, 180],
  "indianred": [205, 92, 92],
  "indigo": [75, 0, 130],
  "ivory": [255, 255, 240],
  "khaki": [240, 230, 140],
  "lavender": [230, 230, 250],
  "lavenderblush": [255, 240, 245],
  "lawngreen": [124, 252, 0],
  "lemonchiffon": [255, 250, 205],
  "lightblue": [173, 216, 230],
  "lightcoral": [240, 128, 128],
  "lightcyan": [224, 255, 255],
  "lightgoldenrodyellow": [250, 250, 210],
  "lightgray": [211, 211, 211],
  "lightgreen": [144, 238, 144],
  "lightgrey": [211, 211, 211],
  "lightpink": [255, 182, 193],
  "lightsalmon": [255, 160, 122],
  "lightseagreen": [32, 178, 170],
  "lightskyblue": [135, 206, 250],
  "lightslategray": [119, 136, 153],
  "lightslategrey": [119, 136, 153],
  "lightsteelblue": [176, 196, 222],
  "lightyellow": [255, 255, 224],
  "lime": [0, 255, 0],
  "limegreen": [50, 205, 50],
  "linen": [250, 240, 230],
  "magenta": [255, 0, 255],
  "maroon": [128, 0, 0],
  "mediumaquamarine": [102, 205, 170],
  "mediumblue": [0, 0, 205],
  "mediumorchid": [186, 85, 211],
  "mediumpurple": [147, 112, 219],
  "mediumseagreen": [60, 179, 113],
  "mediumslateblue": [123, 104, 238],
  "mediumspringgreen": [0, 250, 154],
  "mediumturquoise": [72, 209, 204],
  "mediumvioletred": [199, 21, 133],
  "midnightblue": [25, 25, 112],
  "mintcream": [245, 255, 250],
  "mistyrose": [255, 228, 225],
  "moccasin": [255, 228, 181],
  "navajowhite": [255, 222, 173],
  "navy": [0, 0, 128],
  "oldlace": [253, 245, 230],
  "olive": [128, 128, 0],
  "olivedrab": [107, 142, 35],
  "orange": [255, 165, 0],
  "orangered": [255, 69, 0],
  "orchid": [218, 112, 214],
  "palegoldenrod": [238, 232, 170],
  "palegreen": [152, 251, 152],
  "paleturquoise": [175, 238, 238],
  "palevioletred": [219, 112, 147],
  "papayawhip": [255, 239, 213],
  "peachpuff": [255, 218, 185],
  "peru": [205, 133, 63],
  "pink": [255, 192, 203],
  "plum": [221, 160, 221],
  "powderblue": [176, 224, 230],
  "purple": [128, 0, 128],
  "rebeccapurple": [102, 51, 153],
  "red": [255, 0, 0],
  "rosybrown": [188, 143, 143],
  "royalblue": [65, 105, 225],
  "saddlebrown": [139, 69, 19],
  "salmon": [250, 128, 114],
  "sandybrown": [244, 164, 96],
  "seagreen": [46, 139, 87],
  "seashell": [255, 245, 238],
  "sienna": [160, 82, 45],
  "silver": [192, 192, 192],
  "skyblue": [135, 206, 235],
  "slateblue": [106, 90, 205],
  "slategray": [112, 128, 144],
  "slategrey": [112, 128, 144],
  "snow": [255, 250, 250],
  "springgreen": [0, 255, 127],
  "steelblue": [70, 130, 180],
  "tan": [210, 180, 140],
  "teal": [0, 128, 128],
  "thistle": [216, 191, 216],
  "tomato": [255, 99, 71],
  "turquoise": [64, 224, 208],
  "violet": [238, 130, 238],
  "wheat": [245, 222, 179],
  "white": [255, 255, 255],
  "whitesmoke": [245, 245, 245],
  "yellow": [255, 255, 0],
  "yellowgreen": [154, 205, 50]
};

/***/ }),

/***/ "./node_modules/fill-range/index.js":
/*!******************************************!*\
  !*** ./node_modules/fill-range/index.js ***!
  \******************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*!
 * fill-range <https://github.com/jonschlinkert/fill-range>
 *
 * Copyright (c) 2014-present, Jon Schlinkert.
 * Licensed under the MIT License.
 */


function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

var util = __webpack_require__(/*! util */ "./node_modules/util/util.js");

var toRegexRange = __webpack_require__(/*! to-regex-range */ "./node_modules/to-regex-range/index.js");

var isObject = function isObject(val) {
  return val !== null && _typeof(val) === 'object' && !Array.isArray(val);
};

var transform = function transform(toNumber) {
  return function (value) {
    return toNumber === true ? Number(value) : String(value);
  };
};

var isValidValue = function isValidValue(value) {
  return typeof value === 'number' || typeof value === 'string' && value !== '';
};

var isNumber = function isNumber(num) {
  return Number.isInteger(+num);
};

var zeros = function zeros(input) {
  var value = "".concat(input);
  var index = -1;
  if (value[0] === '-') value = value.slice(1);
  if (value === '0') return false;

  while (value[++index] === '0') {
    ;
  }

  return index > 0;
};

var stringify = function stringify(start, end, options) {
  if (typeof start === 'string' || typeof end === 'string') {
    return true;
  }

  return options.stringify === true;
};

var pad = function pad(input, maxLength, toNumber) {
  if (maxLength > 0) {
    var dash = input[0] === '-' ? '-' : '';
    if (dash) input = input.slice(1);
    input = dash + input.padStart(dash ? maxLength - 1 : maxLength, '0');
  }

  if (toNumber === false) {
    return String(input);
  }

  return input;
};

var toMaxLen = function toMaxLen(input, maxLength) {
  var negative = input[0] === '-' ? '-' : '';

  if (negative) {
    input = input.slice(1);
    maxLength--;
  }

  while (input.length < maxLength) {
    input = '0' + input;
  }

  return negative ? '-' + input : input;
};

var toSequence = function toSequence(parts, options) {
  parts.negatives.sort(function (a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  });
  parts.positives.sort(function (a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  });
  var prefix = options.capture ? '' : '?:';
  var positives = '';
  var negatives = '';
  var result;

  if (parts.positives.length) {
    positives = parts.positives.join('|');
  }

  if (parts.negatives.length) {
    negatives = "-(".concat(prefix).concat(parts.negatives.join('|'), ")");
  }

  if (positives && negatives) {
    result = "".concat(positives, "|").concat(negatives);
  } else {
    result = positives || negatives;
  }

  if (options.wrap) {
    return "(".concat(prefix).concat(result, ")");
  }

  return result;
};

var toRange = function toRange(a, b, isNumbers, options) {
  if (isNumbers) {
    return toRegexRange(a, b, _objectSpread({
      wrap: false
    }, options));
  }

  var start = String.fromCharCode(a);
  if (a === b) return start;
  var stop = String.fromCharCode(b);
  return "[".concat(start, "-").concat(stop, "]");
};

var toRegex = function toRegex(start, end, options) {
  if (Array.isArray(start)) {
    var wrap = options.wrap === true;
    var prefix = options.capture ? '' : '?:';
    return wrap ? "(".concat(prefix).concat(start.join('|'), ")") : start.join('|');
  }

  return toRegexRange(start, end, options);
};

var rangeError = function rangeError() {
  return new RangeError('Invalid range arguments: ' + util.inspect.apply(util, arguments));
};

var invalidRange = function invalidRange(start, end, options) {
  if (options.strictRanges === true) throw rangeError([start, end]);
  return [];
};

var invalidStep = function invalidStep(step, options) {
  if (options.strictRanges === true) {
    throw new TypeError("Expected step \"".concat(step, "\" to be a number"));
  }

  return [];
};

var fillNumbers = function fillNumbers(start, end) {
  var step = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;
  var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  var a = Number(start);
  var b = Number(end);

  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    if (options.strictRanges === true) throw rangeError([start, end]);
    return [];
  } // fix negative zero


  if (a === 0) a = 0;
  if (b === 0) b = 0;
  var descending = a > b;
  var startString = String(start);
  var endString = String(end);
  var stepString = String(step);
  step = Math.max(Math.abs(step), 1);
  var padded = zeros(startString) || zeros(endString) || zeros(stepString);
  var maxLen = padded ? Math.max(startString.length, endString.length, stepString.length) : 0;
  var toNumber = padded === false && stringify(start, end, options) === false;
  var format = options.transform || transform(toNumber);

  if (options.toRegex && step === 1) {
    return toRange(toMaxLen(start, maxLen), toMaxLen(end, maxLen), true, options);
  }

  var parts = {
    negatives: [],
    positives: []
  };

  var push = function push(num) {
    return parts[num < 0 ? 'negatives' : 'positives'].push(Math.abs(num));
  };

  var range = [];
  var index = 0;

  while (descending ? a >= b : a <= b) {
    if (options.toRegex === true && step > 1) {
      push(a);
    } else {
      range.push(pad(format(a, index), maxLen, toNumber));
    }

    a = descending ? a - step : a + step;
    index++;
  }

  if (options.toRegex === true) {
    return step > 1 ? toSequence(parts, options) : toRegex(range, null, _objectSpread({
      wrap: false
    }, options));
  }

  return range;
};

var fillLetters = function fillLetters(start, end) {
  var step = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;
  var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

  if (!isNumber(start) && start.length > 1 || !isNumber(end) && end.length > 1) {
    return invalidRange(start, end, options);
  }

  var format = options.transform || function (val) {
    return String.fromCharCode(val);
  };

  var a = "".concat(start).charCodeAt(0);
  var b = "".concat(end).charCodeAt(0);
  var descending = a > b;
  var min = Math.min(a, b);
  var max = Math.max(a, b);

  if (options.toRegex && step === 1) {
    return toRange(min, max, false, options);
  }

  var range = [];
  var index = 0;

  while (descending ? a >= b : a <= b) {
    range.push(format(a, index));
    a = descending ? a - step : a + step;
    index++;
  }

  if (options.toRegex === true) {
    return toRegex(range, null, {
      wrap: false,
      options: options
    });
  }

  return range;
};

var fill = function fill(start, end, step) {
  var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

  if (end == null && isValidValue(start)) {
    return [start];
  }

  if (!isValidValue(start) || !isValidValue(end)) {
    return invalidRange(start, end, options);
  }

  if (typeof step === 'function') {
    return fill(start, end, 1, {
      transform: step
    });
  }

  if (isObject(step)) {
    return fill(start, end, 0, step);
  }

  var opts = _objectSpread({}, options);

  if (opts.capture === true) opts.wrap = true;
  step = step || opts.step || 1;

  if (!isNumber(step)) {
    if (step != null && !isObject(step)) return invalidStep(step, opts);
    return fill(start, end, 1, step);
  }

  if (isNumber(start) && isNumber(end)) {
    return fillNumbers(start, end, step, opts);
  }

  return fillLetters(start, end, Math.max(Math.abs(step), 1), opts);
};

module.exports = fill;

/***/ }),

/***/ "./node_modules/ieee754/index.js":
/*!***************************************!*\
  !*** ./node_modules/ieee754/index.js ***!
  \***************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m;
  var eLen = nBytes * 8 - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var nBits = -7;
  var i = isLE ? nBytes - 1 : 0;
  var d = isLE ? -1 : 1;
  var s = buffer[offset + i];
  i += d;
  e = s & (1 << -nBits) - 1;
  s >>= -nBits;
  nBits += eLen;

  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & (1 << -nBits) - 1;
  e >>= -nBits;
  nBits += mLen;

  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : (s ? -1 : 1) * Infinity;
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }

  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c;
  var eLen = nBytes * 8 - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
  var i = isLE ? 0 : nBytes - 1;
  var d = isLE ? 1 : -1;
  var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);

    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }

    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }

    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = e << mLen | m;
  eLen += mLen;

  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128;
};

/***/ }),

/***/ "./node_modules/isarray/index.js":
/*!***************************************!*\
  !*** ./node_modules/isarray/index.js ***!
  \***************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

/***/ }),

/***/ "./node_modules/js-tokens/index.js":
/*!*****************************************!*\
  !*** ./node_modules/js-tokens/index.js ***!
  \*****************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


// Copyright 2014, 2015, 2016, 2017, 2018 Simon Lydell
// License: MIT. (See LICENSE.)
Object.defineProperty(exports, "__esModule", {
  value: true
}); // This regex comes from regex.coffee, and is inserted here by generate-index.js
// (run `npm run build`).

exports.default = /((['"])(?:(?!\2|\\).|\\(?:\r\n|[\s\S]))*(\2)?|`(?:[^`\\$]|\\[\s\S]|\$(?!\{)|\$\{(?:[^{}]|\{[^}]*\}?)*\}?)*(`)?)|(\/\/.*)|(\/\*(?:[^*]|\*(?!\/))*(\*\/)?)|(\/(?!\*)(?:\[(?:(?![\]\\]).|\\.)*\]|(?![\/\]\\]).|\\.)+\/(?:(?!\s*(?:\b|[\u0080-\uFFFF$\\'"~({]|[+\-!](?!=)|\.?\d))|[gmiyus]{1,6}\b(?![\u0080-\uFFFF$\\]|\s*(?:[+\-*%&|^<>!=?({]|\/(?![\/*])))))|(0[xX][\da-fA-F]+|0[oO][0-7]+|0[bB][01]+|(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?)|((?!\d)(?:(?!\s)[$\w\u0080-\uFFFF]|\\u[\da-fA-F]{4}|\\u\{[\da-fA-F]+\})+)|(--|\+\+|&&|\|\||=>|\.{3}|(?:[+\-\/%&|^]|\*{1,2}|<{1,2}|>{1,3}|!=?|={1,2})=?|[?~.,:;[\](){}])|(\s+)|(^$|[\s\S])/g;

exports.matchToToken = function (match) {
  var token = {
    type: "invalid",
    value: match[0],
    closed: undefined
  };
  if (match[1]) token.type = "string", token.closed = !!(match[3] || match[4]);else if (match[5]) token.type = "comment";else if (match[6]) token.type = "comment", token.closed = !!match[7];else if (match[8]) token.type = "regex";else if (match[9]) token.type = "number";else if (match[10]) token.type = "name";else if (match[11]) token.type = "punctuator";else if (match[12]) token.type = "whitespace";
  return token;
};

/***/ }),

/***/ "./node_modules/micromatch/index.js":
/*!******************************************!*\
  !*** ./node_modules/micromatch/index.js ***!
  \******************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _createForOfIteratorHelper(o) { if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (o = _unsupportedIterableToArray(o))) { var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var it, normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var util = __webpack_require__(/*! util */ "./node_modules/util/util.js");

var braces = __webpack_require__(/*! braces */ "./node_modules/braces/index.js");

var picomatch = __webpack_require__(/*! picomatch */ "./node_modules/picomatch/index.js");

var utils = __webpack_require__(/*! picomatch/lib/utils */ "./node_modules/picomatch/lib/utils.js");

var isEmptyString = function isEmptyString(val) {
  return typeof val === 'string' && (val === '' || val === './');
};
/**
 * Returns an array of strings that match one or more glob patterns.
 *
 * ```js
 * const mm = require('micromatch');
 * // mm(list, patterns[, options]);
 *
 * console.log(mm(['a.js', 'a.txt'], ['*.js']));
 * //=> [ 'a.js' ]
 * ```
 * @param {String|Array<string>} list List of strings to match.
 * @param {String|Array<string>} patterns One or more glob patterns to use for matching.
 * @param {Object} options See available [options](#options)
 * @return {Array} Returns an array of matches
 * @summary false
 * @api public
 */


var micromatch = function micromatch(list, patterns, options) {
  patterns = [].concat(patterns);
  list = [].concat(list);
  var omit = new Set();
  var keep = new Set();
  var items = new Set();
  var negatives = 0;

  var onResult = function onResult(state) {
    items.add(state.output);

    if (options && options.onResult) {
      options.onResult(state);
    }
  };

  for (var i = 0; i < patterns.length; i++) {
    var isMatch = picomatch(String(patterns[i]), _objectSpread({}, options, {
      onResult: onResult
    }), true);
    var negated = isMatch.state.negated || isMatch.state.negatedExtglob;
    if (negated) negatives++;

    var _iterator = _createForOfIteratorHelper(list),
        _step;

    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        var item = _step.value;
        var matched = isMatch(item, true);
        var match = negated ? !matched.isMatch : matched.isMatch;
        if (!match) continue;

        if (negated) {
          omit.add(matched.output);
        } else {
          omit.delete(matched.output);
          keep.add(matched.output);
        }
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }
  }

  var result = negatives === patterns.length ? _toConsumableArray(items) : _toConsumableArray(keep);
  var matches = result.filter(function (item) {
    return !omit.has(item);
  });

  if (options && matches.length === 0) {
    if (options.failglob === true) {
      throw new Error("No matches found for \"".concat(patterns.join(', '), "\""));
    }

    if (options.nonull === true || options.nullglob === true) {
      return options.unescape ? patterns.map(function (p) {
        return p.replace(/\\/g, '');
      }) : patterns;
    }
  }

  return matches;
};
/**
 * Backwards compatibility
 */


micromatch.match = micromatch;
/**
 * Returns a matcher function from the given glob `pattern` and `options`.
 * The returned function takes a string to match as its only argument and returns
 * true if the string is a match.
 *
 * ```js
 * const mm = require('micromatch');
 * // mm.matcher(pattern[, options]);
 *
 * const isMatch = mm.matcher('*.!(*a)');
 * console.log(isMatch('a.a')); //=> false
 * console.log(isMatch('a.b')); //=> true
 * ```
 * @param {String} `pattern` Glob pattern
 * @param {Object} `options`
 * @return {Function} Returns a matcher function.
 * @api public
 */

micromatch.matcher = function (pattern, options) {
  return picomatch(pattern, options);
};
/**
 * Returns true if **any** of the given glob `patterns` match the specified `string`.
 *
 * ```js
 * const mm = require('micromatch');
 * // mm.isMatch(string, patterns[, options]);
 *
 * console.log(mm.isMatch('a.a', ['b.*', '*.a'])); //=> true
 * console.log(mm.isMatch('a.a', 'b.*')); //=> false
 * ```
 * @param {String} str The string to test.
 * @param {String|Array} patterns One or more glob patterns to use for matching.
 * @param {Object} [options] See available [options](#options).
 * @return {Boolean} Returns true if any patterns match `str`
 * @api public
 */


micromatch.isMatch = function (str, patterns, options) {
  return picomatch(patterns, options)(str);
};
/**
 * Backwards compatibility
 */


micromatch.any = micromatch.isMatch;
/**
 * Returns a list of strings that _**do not match any**_ of the given `patterns`.
 *
 * ```js
 * const mm = require('micromatch');
 * // mm.not(list, patterns[, options]);
 *
 * console.log(mm.not(['a.a', 'b.b', 'c.c'], '*.a'));
 * //=> ['b.b', 'c.c']
 * ```
 * @param {Array} `list` Array of strings to match.
 * @param {String|Array} `patterns` One or more glob pattern to use for matching.
 * @param {Object} `options` See available [options](#options) for changing how matches are performed
 * @return {Array} Returns an array of strings that **do not match** the given patterns.
 * @api public
 */

micromatch.not = function (list, patterns) {
  var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  patterns = [].concat(patterns).map(String);
  var result = new Set();
  var items = [];

  var onResult = function onResult(state) {
    if (options.onResult) options.onResult(state);
    items.push(state.output);
  };

  var matches = micromatch(list, patterns, _objectSpread({}, options, {
    onResult: onResult
  }));

  for (var _i = 0, _items = items; _i < _items.length; _i++) {
    var item = _items[_i];

    if (!matches.includes(item)) {
      result.add(item);
    }
  }

  return _toConsumableArray(result);
};
/**
 * Returns true if the given `string` contains the given pattern. Similar
 * to [.isMatch](#isMatch) but the pattern can match any part of the string.
 *
 * ```js
 * var mm = require('micromatch');
 * // mm.contains(string, pattern[, options]);
 *
 * console.log(mm.contains('aa/bb/cc', '*b'));
 * //=> true
 * console.log(mm.contains('aa/bb/cc', '*d'));
 * //=> false
 * ```
 * @param {String} `str` The string to match.
 * @param {String|Array} `patterns` Glob pattern to use for matching.
 * @param {Object} `options` See available [options](#options) for changing how matches are performed
 * @return {Boolean} Returns true if the patter matches any part of `str`.
 * @api public
 */


micromatch.contains = function (str, pattern, options) {
  if (typeof str !== 'string') {
    throw new TypeError("Expected a string: \"".concat(util.inspect(str), "\""));
  }

  if (Array.isArray(pattern)) {
    return pattern.some(function (p) {
      return micromatch.contains(str, p, options);
    });
  }

  if (typeof pattern === 'string') {
    if (isEmptyString(str) || isEmptyString(pattern)) {
      return false;
    }

    if (str.includes(pattern) || str.startsWith('./') && str.slice(2).includes(pattern)) {
      return true;
    }
  }

  return micromatch.isMatch(str, pattern, _objectSpread({}, options, {
    contains: true
  }));
};
/**
 * Filter the keys of the given object with the given `glob` pattern
 * and `options`. Does not attempt to match nested keys. If you need this feature,
 * use [glob-object][] instead.
 *
 * ```js
 * const mm = require('micromatch');
 * // mm.matchKeys(object, patterns[, options]);
 *
 * const obj = { aa: 'a', ab: 'b', ac: 'c' };
 * console.log(mm.matchKeys(obj, '*b'));
 * //=> { ab: 'b' }
 * ```
 * @param {Object} `object` The object with keys to filter.
 * @param {String|Array} `patterns` One or more glob patterns to use for matching.
 * @param {Object} `options` See available [options](#options) for changing how matches are performed
 * @return {Object} Returns an object with only keys that match the given patterns.
 * @api public
 */


micromatch.matchKeys = function (obj, patterns, options) {
  if (!utils.isObject(obj)) {
    throw new TypeError('Expected the first argument to be an object');
  }

  var keys = micromatch(Object.keys(obj), patterns, options);
  var res = {};

  var _iterator2 = _createForOfIteratorHelper(keys),
      _step2;

  try {
    for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
      var key = _step2.value;
      res[key] = obj[key];
    }
  } catch (err) {
    _iterator2.e(err);
  } finally {
    _iterator2.f();
  }

  return res;
};
/**
 * Returns true if some of the strings in the given `list` match any of the given glob `patterns`.
 *
 * ```js
 * const mm = require('micromatch');
 * // mm.some(list, patterns[, options]);
 *
 * console.log(mm.some(['foo.js', 'bar.js'], ['*.js', '!foo.js']));
 * // true
 * console.log(mm.some(['foo.js'], ['*.js', '!foo.js']));
 * // false
 * ```
 * @param {String|Array} `list` The string or array of strings to test. Returns as soon as the first match is found.
 * @param {String|Array} `patterns` One or more glob patterns to use for matching.
 * @param {Object} `options` See available [options](#options) for changing how matches are performed
 * @return {Boolean} Returns true if any patterns match `str`
 * @api public
 */


micromatch.some = function (list, patterns, options) {
  var items = [].concat(list);

  var _iterator3 = _createForOfIteratorHelper([].concat(patterns)),
      _step3;

  try {
    var _loop = function _loop() {
      var pattern = _step3.value;
      var isMatch = picomatch(String(pattern), options);

      if (items.some(function (item) {
        return isMatch(item);
      })) {
        return {
          v: true
        };
      }
    };

    for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
      var _ret = _loop();

      if (_typeof(_ret) === "object") return _ret.v;
    }
  } catch (err) {
    _iterator3.e(err);
  } finally {
    _iterator3.f();
  }

  return false;
};
/**
 * Returns true if every string in the given `list` matches
 * any of the given glob `patterns`.
 *
 * ```js
 * const mm = require('micromatch');
 * // mm.every(list, patterns[, options]);
 *
 * console.log(mm.every('foo.js', ['foo.js']));
 * // true
 * console.log(mm.every(['foo.js', 'bar.js'], ['*.js']));
 * // true
 * console.log(mm.every(['foo.js', 'bar.js'], ['*.js', '!foo.js']));
 * // false
 * console.log(mm.every(['foo.js'], ['*.js', '!foo.js']));
 * // false
 * ```
 * @param {String|Array} `list` The string or array of strings to test.
 * @param {String|Array} `patterns` One or more glob patterns to use for matching.
 * @param {Object} `options` See available [options](#options) for changing how matches are performed
 * @return {Boolean} Returns true if any patterns match `str`
 * @api public
 */


micromatch.every = function (list, patterns, options) {
  var items = [].concat(list);

  var _iterator4 = _createForOfIteratorHelper([].concat(patterns)),
      _step4;

  try {
    var _loop2 = function _loop2() {
      var pattern = _step4.value;
      var isMatch = picomatch(String(pattern), options);

      if (!items.every(function (item) {
        return isMatch(item);
      })) {
        return {
          v: false
        };
      }
    };

    for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
      var _ret2 = _loop2();

      if (_typeof(_ret2) === "object") return _ret2.v;
    }
  } catch (err) {
    _iterator4.e(err);
  } finally {
    _iterator4.f();
  }

  return true;
};
/**
 * Returns true if **all** of the given `patterns` match
 * the specified string.
 *
 * ```js
 * const mm = require('micromatch');
 * // mm.all(string, patterns[, options]);
 *
 * console.log(mm.all('foo.js', ['foo.js']));
 * // true
 *
 * console.log(mm.all('foo.js', ['*.js', '!foo.js']));
 * // false
 *
 * console.log(mm.all('foo.js', ['*.js', 'foo.js']));
 * // true
 *
 * console.log(mm.all('foo.js', ['*.js', 'f*', '*o*', '*o.js']));
 * // true
 * ```
 * @param {String|Array} `str` The string to test.
 * @param {String|Array} `patterns` One or more glob patterns to use for matching.
 * @param {Object} `options` See available [options](#options) for changing how matches are performed
 * @return {Boolean} Returns true if any patterns match `str`
 * @api public
 */


micromatch.all = function (str, patterns, options) {
  if (typeof str !== 'string') {
    throw new TypeError("Expected a string: \"".concat(util.inspect(str), "\""));
  }

  return [].concat(patterns).every(function (p) {
    return picomatch(p, options)(str);
  });
};
/**
 * Returns an array of matches captured by `pattern` in `string, or `null` if the pattern did not match.
 *
 * ```js
 * const mm = require('micromatch');
 * // mm.capture(pattern, string[, options]);
 *
 * console.log(mm.capture('test/*.js', 'test/foo.js'));
 * //=> ['foo']
 * console.log(mm.capture('test/*.js', 'foo/bar.css'));
 * //=> null
 * ```
 * @param {String} `glob` Glob pattern to use for matching.
 * @param {String} `input` String to match
 * @param {Object} `options` See available [options](#options) for changing how matches are performed
 * @return {Boolean} Returns an array of captures if the input matches the glob pattern, otherwise `null`.
 * @api public
 */


micromatch.capture = function (glob, input, options) {
  var posix = utils.isWindows(options);
  var regex = picomatch.makeRe(String(glob), _objectSpread({}, options, {
    capture: true
  }));
  var match = regex.exec(posix ? utils.toPosixSlashes(input) : input);

  if (match) {
    return match.slice(1).map(function (v) {
      return v === void 0 ? '' : v;
    });
  }
};
/**
 * Create a regular expression from the given glob `pattern`.
 *
 * ```js
 * const mm = require('micromatch');
 * // mm.makeRe(pattern[, options]);
 *
 * console.log(mm.makeRe('*.js'));
 * //=> /^(?:(\.[\\\/])?(?!\.)(?=.)[^\/]*?\.js)$/
 * ```
 * @param {String} `pattern` A glob pattern to convert to regex.
 * @param {Object} `options`
 * @return {RegExp} Returns a regex created from the given pattern.
 * @api public
 */


micromatch.makeRe = function () {
  return picomatch.makeRe.apply(picomatch, arguments);
};
/**
 * Scan a glob pattern to separate the pattern into segments. Used
 * by the [split](#split) method.
 *
 * ```js
 * const mm = require('micromatch');
 * const state = mm.scan(pattern[, options]);
 * ```
 * @param {String} `pattern`
 * @param {Object} `options`
 * @return {Object} Returns an object with
 * @api public
 */


micromatch.scan = function () {
  return picomatch.scan.apply(picomatch, arguments);
};
/**
 * Parse a glob pattern to create the source string for a regular
 * expression.
 *
 * ```js
 * const mm = require('micromatch');
 * const state = mm(pattern[, options]);
 * ```
 * @param {String} `glob`
 * @param {Object} `options`
 * @return {Object} Returns an object with useful properties and output to be used as regex source string.
 * @api public
 */


micromatch.parse = function (patterns, options) {
  var res = [];

  var _iterator5 = _createForOfIteratorHelper([].concat(patterns || [])),
      _step5;

  try {
    for (_iterator5.s(); !(_step5 = _iterator5.n()).done;) {
      var pattern = _step5.value;

      var _iterator6 = _createForOfIteratorHelper(braces(String(pattern), options)),
          _step6;

      try {
        for (_iterator6.s(); !(_step6 = _iterator6.n()).done;) {
          var str = _step6.value;
          res.push(picomatch.parse(str, options));
        }
      } catch (err) {
        _iterator6.e(err);
      } finally {
        _iterator6.f();
      }
    }
  } catch (err) {
    _iterator5.e(err);
  } finally {
    _iterator5.f();
  }

  return res;
};
/**
 * Process the given brace `pattern`.
 *
 * ```js
 * const { braces } = require('micromatch');
 * console.log(braces('foo/{a,b,c}/bar'));
 * //=> [ 'foo/(a|b|c)/bar' ]
 *
 * console.log(braces('foo/{a,b,c}/bar', { expand: true }));
 * //=> [ 'foo/a/bar', 'foo/b/bar', 'foo/c/bar' ]
 * ```
 * @param {String} `pattern` String with brace pattern to process.
 * @param {Object} `options` Any [options](#options) to change how expansion is performed. See the [braces][] library for all available options.
 * @return {Array}
 * @api public
 */


micromatch.braces = function (pattern, options) {
  if (typeof pattern !== 'string') throw new TypeError('Expected a string');

  if (options && options.nobrace === true || !/\{.*\}/.test(pattern)) {
    return [pattern];
  }

  return braces(pattern, options);
};
/**
 * Expand braces
 */


micromatch.braceExpand = function (pattern, options) {
  if (typeof pattern !== 'string') throw new TypeError('Expected a string');
  return micromatch.braces(pattern, _objectSpread({}, options, {
    expand: true
  }));
};
/**
 * Expose micromatch
 */


module.exports = micromatch;

/***/ }),

/***/ "./node_modules/node-libs-browser/mock/empty.js":
/*!******************************************************!*\
  !*** ./node_modules/node-libs-browser/mock/empty.js ***!
  \******************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/***/ }),

/***/ "./node_modules/path-browserify/index.js":
/*!***********************************************!*\
  !*** ./node_modules/path-browserify/index.js ***!
  \***********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(process) {

// .dirname, .basename, and .extname methods are extracted from Node.js v8.11.1,
// backported and transplited with Babel, with backwards-compat fixes
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.
// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;

  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];

    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  } // if the path is allowed to go above the root, restore leading ..s


  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
} // path.resolve([from ...], to)
// posix version


exports.resolve = function () {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = i >= 0 ? arguments[i] : process.cwd(); // Skip empty and invalid entries

    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  } // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)
  // Normalize the path


  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function (p) {
    return !!p;
  }), !resolvedAbsolute).join('/');
  return (resolvedAbsolute ? '/' : '') + resolvedPath || '.';
}; // path.normalize(path)
// posix version


exports.normalize = function (path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/'; // Normalize the path

  path = normalizeArray(filter(path.split('/'), function (p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }

  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
}; // posix version


exports.isAbsolute = function (path) {
  return path.charAt(0) === '/';
}; // posix version


exports.join = function () {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function (p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }

    return p;
  }).join('/'));
}; // path.relative(from, to)
// posix version


exports.relative = function (from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;

    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;

    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));
  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;

  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];

  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));
  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function (path) {
  if (typeof path !== 'string') path = path + '';
  if (path.length === 0) return '.';
  var code = path.charCodeAt(0);
  var hasRoot = code === 47
  /*/*/
  ;
  var end = -1;
  var matchedSlash = true;

  for (var i = path.length - 1; i >= 1; --i) {
    code = path.charCodeAt(i);

    if (code === 47
    /*/*/
    ) {
        if (!matchedSlash) {
          end = i;
          break;
        }
      } else {
      // We saw the first non-path separator
      matchedSlash = false;
    }
  }

  if (end === -1) return hasRoot ? '/' : '.';

  if (hasRoot && end === 1) {
    // return '//';
    // Backwards-compat fix:
    return '/';
  }

  return path.slice(0, end);
};

function basename(path) {
  if (typeof path !== 'string') path = path + '';
  var start = 0;
  var end = -1;
  var matchedSlash = true;
  var i;

  for (i = path.length - 1; i >= 0; --i) {
    if (path.charCodeAt(i) === 47
    /*/*/
    ) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // path component
      matchedSlash = false;
      end = i + 1;
    }
  }

  if (end === -1) return '';
  return path.slice(start, end);
} // Uses a mixed approach for backwards-compatibility, as ext behavior changed
// in new Node.js versions, so only basename() above is backported here


exports.basename = function (path, ext) {
  var f = basename(path);

  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }

  return f;
};

exports.extname = function (path) {
  if (typeof path !== 'string') path = path + '';
  var startDot = -1;
  var startPart = 0;
  var end = -1;
  var matchedSlash = true; // Track the state of characters (if any) we see before our first dot and
  // after any path separator we find

  var preDotState = 0;

  for (var i = path.length - 1; i >= 0; --i) {
    var code = path.charCodeAt(i);

    if (code === 47
    /*/*/
    ) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }

        continue;
      }

    if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // extension
      matchedSlash = false;
      end = i + 1;
    }

    if (code === 46
    /*.*/
    ) {
        // If this is our first dot, mark it as the start of our extension
        if (startDot === -1) startDot = i;else if (preDotState !== 1) preDotState = 1;
      } else if (startDot !== -1) {
      // We saw a non-dot and non-path separator before our dot, so we should
      // have a good chance at having a non-empty extension
      preDotState = -1;
    }
  }

  if (startDot === -1 || end === -1 || // We saw a non-dot character immediately before the dot
  preDotState === 0 || // The (right-most) trimmed path component is exactly '..'
  preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
    return '';
  }

  return path.slice(startDot, end);
};

function filter(xs, f) {
  if (xs.filter) return xs.filter(f);
  var res = [];

  for (var i = 0; i < xs.length; i++) {
    if (f(xs[i], i, xs)) res.push(xs[i]);
  }

  return res;
} // String.prototype.substr - negative index don't work in IE8


var substr = 'ab'.substr(-1) === 'b' ? function (str, start, len) {
  return str.substr(start, len);
} : function (str, start, len) {
  if (start < 0) start = str.length + start;
  return str.substr(start, len);
};
/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../process/browser.js */ "./node_modules/process/browser.js")))

/***/ }),

/***/ "./node_modules/picomatch/index.js":
/*!*****************************************!*\
  !*** ./node_modules/picomatch/index.js ***!
  \*****************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = __webpack_require__(/*! ./lib/picomatch */ "./node_modules/picomatch/lib/picomatch.js");

/***/ }),

/***/ "./node_modules/picomatch/lib/constants.js":
/*!*************************************************!*\
  !*** ./node_modules/picomatch/lib/constants.js ***!
  \*************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var path = __webpack_require__(/*! path */ "./node_modules/path-browserify/index.js");

var WIN_SLASH = '\\\\/';
var WIN_NO_SLASH = "[^".concat(WIN_SLASH, "]");
/**
 * Posix glob regex
 */

var DOT_LITERAL = '\\.';
var PLUS_LITERAL = '\\+';
var QMARK_LITERAL = '\\?';
var SLASH_LITERAL = '\\/';
var ONE_CHAR = '(?=.)';
var QMARK = '[^/]';
var END_ANCHOR = "(?:".concat(SLASH_LITERAL, "|$)");
var START_ANCHOR = "(?:^|".concat(SLASH_LITERAL, ")");
var DOTS_SLASH = "".concat(DOT_LITERAL, "{1,2}").concat(END_ANCHOR);
var NO_DOT = "(?!".concat(DOT_LITERAL, ")");
var NO_DOTS = "(?!".concat(START_ANCHOR).concat(DOTS_SLASH, ")");
var NO_DOT_SLASH = "(?!".concat(DOT_LITERAL, "{0,1}").concat(END_ANCHOR, ")");
var NO_DOTS_SLASH = "(?!".concat(DOTS_SLASH, ")");
var QMARK_NO_DOT = "[^.".concat(SLASH_LITERAL, "]");
var STAR = "".concat(QMARK, "*?");
var POSIX_CHARS = {
  DOT_LITERAL: DOT_LITERAL,
  PLUS_LITERAL: PLUS_LITERAL,
  QMARK_LITERAL: QMARK_LITERAL,
  SLASH_LITERAL: SLASH_LITERAL,
  ONE_CHAR: ONE_CHAR,
  QMARK: QMARK,
  END_ANCHOR: END_ANCHOR,
  DOTS_SLASH: DOTS_SLASH,
  NO_DOT: NO_DOT,
  NO_DOTS: NO_DOTS,
  NO_DOT_SLASH: NO_DOT_SLASH,
  NO_DOTS_SLASH: NO_DOTS_SLASH,
  QMARK_NO_DOT: QMARK_NO_DOT,
  STAR: STAR,
  START_ANCHOR: START_ANCHOR
};
/**
 * Windows glob regex
 */

var WINDOWS_CHARS = _objectSpread({}, POSIX_CHARS, {
  SLASH_LITERAL: "[".concat(WIN_SLASH, "]"),
  QMARK: WIN_NO_SLASH,
  STAR: "".concat(WIN_NO_SLASH, "*?"),
  DOTS_SLASH: "".concat(DOT_LITERAL, "{1,2}(?:[").concat(WIN_SLASH, "]|$)"),
  NO_DOT: "(?!".concat(DOT_LITERAL, ")"),
  NO_DOTS: "(?!(?:^|[".concat(WIN_SLASH, "])").concat(DOT_LITERAL, "{1,2}(?:[").concat(WIN_SLASH, "]|$))"),
  NO_DOT_SLASH: "(?!".concat(DOT_LITERAL, "{0,1}(?:[").concat(WIN_SLASH, "]|$))"),
  NO_DOTS_SLASH: "(?!".concat(DOT_LITERAL, "{1,2}(?:[").concat(WIN_SLASH, "]|$))"),
  QMARK_NO_DOT: "[^.".concat(WIN_SLASH, "]"),
  START_ANCHOR: "(?:^|[".concat(WIN_SLASH, "])"),
  END_ANCHOR: "(?:[".concat(WIN_SLASH, "]|$)")
});
/**
 * POSIX Bracket Regex
 */


var POSIX_REGEX_SOURCE = {
  alnum: 'a-zA-Z0-9',
  alpha: 'a-zA-Z',
  ascii: '\\x00-\\x7F',
  blank: ' \\t',
  cntrl: '\\x00-\\x1F\\x7F',
  digit: '0-9',
  graph: '\\x21-\\x7E',
  lower: 'a-z',
  print: '\\x20-\\x7E ',
  punct: '\\-!"#$%&\'()\\*+,./:;<=>?@[\\]^_`{|}~',
  space: ' \\t\\r\\n\\v\\f',
  upper: 'A-Z',
  word: 'A-Za-z0-9_',
  xdigit: 'A-Fa-f0-9'
};
module.exports = {
  MAX_LENGTH: 1024 * 64,
  POSIX_REGEX_SOURCE: POSIX_REGEX_SOURCE,
  // regular expressions
  REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
  REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
  REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
  REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
  REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
  REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,
  // Replace globs with equivalent patterns to reduce parsing time.
  REPLACEMENTS: {
    '***': '*',
    '**/**': '**',
    '**/**/**': '**'
  },
  // Digits
  CHAR_0: 48,

  /* 0 */
  CHAR_9: 57,

  /* 9 */
  // Alphabet chars.
  CHAR_UPPERCASE_A: 65,

  /* A */
  CHAR_LOWERCASE_A: 97,

  /* a */
  CHAR_UPPERCASE_Z: 90,

  /* Z */
  CHAR_LOWERCASE_Z: 122,

  /* z */
  CHAR_LEFT_PARENTHESES: 40,

  /* ( */
  CHAR_RIGHT_PARENTHESES: 41,

  /* ) */
  CHAR_ASTERISK: 42,

  /* * */
  // Non-alphabetic chars.
  CHAR_AMPERSAND: 38,

  /* & */
  CHAR_AT: 64,

  /* @ */
  CHAR_BACKWARD_SLASH: 92,

  /* \ */
  CHAR_CARRIAGE_RETURN: 13,

  /* \r */
  CHAR_CIRCUMFLEX_ACCENT: 94,

  /* ^ */
  CHAR_COLON: 58,

  /* : */
  CHAR_COMMA: 44,

  /* , */
  CHAR_DOT: 46,

  /* . */
  CHAR_DOUBLE_QUOTE: 34,

  /* " */
  CHAR_EQUAL: 61,

  /* = */
  CHAR_EXCLAMATION_MARK: 33,

  /* ! */
  CHAR_FORM_FEED: 12,

  /* \f */
  CHAR_FORWARD_SLASH: 47,

  /* / */
  CHAR_GRAVE_ACCENT: 96,

  /* ` */
  CHAR_HASH: 35,

  /* # */
  CHAR_HYPHEN_MINUS: 45,

  /* - */
  CHAR_LEFT_ANGLE_BRACKET: 60,

  /* < */
  CHAR_LEFT_CURLY_BRACE: 123,

  /* { */
  CHAR_LEFT_SQUARE_BRACKET: 91,

  /* [ */
  CHAR_LINE_FEED: 10,

  /* \n */
  CHAR_NO_BREAK_SPACE: 160,

  /* \u00A0 */
  CHAR_PERCENT: 37,

  /* % */
  CHAR_PLUS: 43,

  /* + */
  CHAR_QUESTION_MARK: 63,

  /* ? */
  CHAR_RIGHT_ANGLE_BRACKET: 62,

  /* > */
  CHAR_RIGHT_CURLY_BRACE: 125,

  /* } */
  CHAR_RIGHT_SQUARE_BRACKET: 93,

  /* ] */
  CHAR_SEMICOLON: 59,

  /* ; */
  CHAR_SINGLE_QUOTE: 39,

  /* ' */
  CHAR_SPACE: 32,

  /*   */
  CHAR_TAB: 9,

  /* \t */
  CHAR_UNDERSCORE: 95,

  /* _ */
  CHAR_VERTICAL_LINE: 124,

  /* | */
  CHAR_ZERO_WIDTH_NOBREAK_SPACE: 65279,

  /* \uFEFF */
  SEP: path.sep,

  /**
   * Create EXTGLOB_CHARS
   */
  extglobChars: function extglobChars(chars) {
    return {
      '!': {
        type: 'negate',
        open: '(?:(?!(?:',
        close: "))".concat(chars.STAR, ")")
      },
      '?': {
        type: 'qmark',
        open: '(?:',
        close: ')?'
      },
      '+': {
        type: 'plus',
        open: '(?:',
        close: ')+'
      },
      '*': {
        type: 'star',
        open: '(?:',
        close: ')*'
      },
      '@': {
        type: 'at',
        open: '(?:',
        close: ')'
      }
    };
  },

  /**
   * Create GLOB_CHARS
   */
  globChars: function globChars(win32) {
    return win32 === true ? WINDOWS_CHARS : POSIX_CHARS;
  }
};

/***/ }),

/***/ "./node_modules/picomatch/lib/parse.js":
/*!*********************************************!*\
  !*** ./node_modules/picomatch/lib/parse.js ***!
  \*********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _createForOfIteratorHelper(o) { if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (o = _unsupportedIterableToArray(o))) { var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var it, normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

var constants = __webpack_require__(/*! ./constants */ "./node_modules/picomatch/lib/constants.js");

var utils = __webpack_require__(/*! ./utils */ "./node_modules/picomatch/lib/utils.js");
/**
 * Constants
 */


var MAX_LENGTH = constants.MAX_LENGTH,
    POSIX_REGEX_SOURCE = constants.POSIX_REGEX_SOURCE,
    REGEX_NON_SPECIAL_CHARS = constants.REGEX_NON_SPECIAL_CHARS,
    REGEX_SPECIAL_CHARS_BACKREF = constants.REGEX_SPECIAL_CHARS_BACKREF,
    REPLACEMENTS = constants.REPLACEMENTS;
/**
 * Helpers
 */

var expandRange = function expandRange(args, options) {
  if (typeof options.expandRange === 'function') {
    return options.expandRange.apply(options, _toConsumableArray(args).concat([options]));
  }

  args.sort();
  var value = "[".concat(args.join('-'), "]");

  try {
    /* eslint-disable-next-line no-new */
    new RegExp(value);
  } catch (ex) {
    return args.map(function (v) {
      return utils.escapeRegex(v);
    }).join('..');
  }

  return value;
};
/**
 * Create the message for a syntax error
 */


var syntaxError = function syntaxError(type, char) {
  return "Missing ".concat(type, ": \"").concat(char, "\" - use \"\\\\").concat(char, "\" to match literal characters");
};
/**
 * Parse the given input string.
 * @param {String} input
 * @param {Object} options
 * @return {Object}
 */


var parse = function parse(input, options) {
  if (typeof input !== 'string') {
    throw new TypeError('Expected a string');
  }

  input = REPLACEMENTS[input] || input;

  var opts = _objectSpread({}, options);

  var max = typeof opts.maxLength === 'number' ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
  var len = input.length;

  if (len > max) {
    throw new SyntaxError("Input length: ".concat(len, ", exceeds maximum allowed length: ").concat(max));
  }

  var bos = {
    type: 'bos',
    value: '',
    output: opts.prepend || ''
  };
  var tokens = [bos];
  var capture = opts.capture ? '' : '?:';
  var win32 = utils.isWindows(options); // create constants based on platform, for windows or posix

  var PLATFORM_CHARS = constants.globChars(win32);
  var EXTGLOB_CHARS = constants.extglobChars(PLATFORM_CHARS);
  var DOT_LITERAL = PLATFORM_CHARS.DOT_LITERAL,
      PLUS_LITERAL = PLATFORM_CHARS.PLUS_LITERAL,
      SLASH_LITERAL = PLATFORM_CHARS.SLASH_LITERAL,
      ONE_CHAR = PLATFORM_CHARS.ONE_CHAR,
      DOTS_SLASH = PLATFORM_CHARS.DOTS_SLASH,
      NO_DOT = PLATFORM_CHARS.NO_DOT,
      NO_DOT_SLASH = PLATFORM_CHARS.NO_DOT_SLASH,
      NO_DOTS_SLASH = PLATFORM_CHARS.NO_DOTS_SLASH,
      QMARK = PLATFORM_CHARS.QMARK,
      QMARK_NO_DOT = PLATFORM_CHARS.QMARK_NO_DOT,
      STAR = PLATFORM_CHARS.STAR,
      START_ANCHOR = PLATFORM_CHARS.START_ANCHOR;

  var globstar = function globstar(opts) {
    return "(".concat(capture, "(?:(?!").concat(START_ANCHOR).concat(opts.dot ? DOTS_SLASH : DOT_LITERAL, ").)*?)");
  };

  var nodot = opts.dot ? '' : NO_DOT;
  var qmarkNoDot = opts.dot ? QMARK : QMARK_NO_DOT;
  var star = opts.bash === true ? globstar(opts) : STAR;

  if (opts.capture) {
    star = "(".concat(star, ")");
  } // minimatch options support


  if (typeof opts.noext === 'boolean') {
    opts.noextglob = opts.noext;
  }

  var state = {
    input: input,
    index: -1,
    start: 0,
    dot: opts.dot === true,
    consumed: '',
    output: '',
    prefix: '',
    backtrack: false,
    negated: false,
    brackets: 0,
    braces: 0,
    parens: 0,
    quotes: 0,
    globstar: false,
    tokens: tokens
  };
  input = utils.removePrefix(input, state);
  len = input.length;
  var extglobs = [];
  var braces = [];
  var stack = [];
  var prev = bos;
  var value;
  /**
   * Tokenizing helpers
   */

  var eos = function eos() {
    return state.index === len - 1;
  };

  var peek = state.peek = function () {
    var n = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
    return input[state.index + n];
  };

  var advance = state.advance = function () {
    return input[++state.index];
  };

  var remaining = function remaining() {
    return input.slice(state.index + 1);
  };

  var consume = function consume() {
    var value = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
    var num = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    state.consumed += value;
    state.index += num;
  };

  var append = function append(token) {
    state.output += token.output != null ? token.output : token.value;
    consume(token.value);
  };

  var negate = function negate() {
    var count = 1;

    while (peek() === '!' && (peek(2) !== '(' || peek(3) === '?')) {
      advance();
      state.start++;
      count++;
    }

    if (count % 2 === 0) {
      return false;
    }

    state.negated = true;
    state.start++;
    return true;
  };

  var increment = function increment(type) {
    state[type]++;
    stack.push(type);
  };

  var decrement = function decrement(type) {
    state[type]--;
    stack.pop();
  };
  /**
   * Push tokens onto the tokens array. This helper speeds up
   * tokenizing by 1) helping us avoid backtracking as much as possible,
   * and 2) helping us avoid creating extra tokens when consecutive
   * characters are plain text. This improves performance and simplifies
   * lookbehinds.
   */


  var push = function push(tok) {
    if (prev.type === 'globstar') {
      var isBrace = state.braces > 0 && (tok.type === 'comma' || tok.type === 'brace');
      var isExtglob = tok.extglob === true || extglobs.length && (tok.type === 'pipe' || tok.type === 'paren');

      if (tok.type !== 'slash' && tok.type !== 'paren' && !isBrace && !isExtglob) {
        state.output = state.output.slice(0, -prev.output.length);
        prev.type = 'star';
        prev.value = '*';
        prev.output = star;
        state.output += prev.output;
      }
    }

    if (extglobs.length && tok.type !== 'paren' && !EXTGLOB_CHARS[tok.value]) {
      extglobs[extglobs.length - 1].inner += tok.value;
    }

    if (tok.value || tok.output) append(tok);

    if (prev && prev.type === 'text' && tok.type === 'text') {
      prev.value += tok.value;
      prev.output = (prev.output || '') + tok.value;
      return;
    }

    tok.prev = prev;
    tokens.push(tok);
    prev = tok;
  };

  var extglobOpen = function extglobOpen(type, value) {
    var token = _objectSpread({}, EXTGLOB_CHARS[value], {
      conditions: 1,
      inner: ''
    });

    token.prev = prev;
    token.parens = state.parens;
    token.output = state.output;
    var output = (opts.capture ? '(' : '') + token.open;
    increment('parens');
    push({
      type: type,
      value: value,
      output: state.output ? '' : ONE_CHAR
    });
    push({
      type: 'paren',
      extglob: true,
      value: advance(),
      output: output
    });
    extglobs.push(token);
  };

  var extglobClose = function extglobClose(token) {
    var output = token.close + (opts.capture ? ')' : '');

    if (token.type === 'negate') {
      var extglobStar = star;

      if (token.inner && token.inner.length > 1 && token.inner.includes('/')) {
        extglobStar = globstar(opts);
      }

      if (extglobStar !== star || eos() || /^\)+$/.test(remaining())) {
        output = token.close = ")$))".concat(extglobStar);
      }

      if (token.prev.type === 'bos' && eos()) {
        state.negatedExtglob = true;
      }
    }

    push({
      type: 'paren',
      extglob: true,
      value: value,
      output: output
    });
    decrement('parens');
  };
  /**
   * Fast paths
   */


  if (opts.fastpaths !== false && !/(^[*!]|[/()[\]{}"])/.test(input)) {
    var backslashes = false;
    var output = input.replace(REGEX_SPECIAL_CHARS_BACKREF, function (m, esc, chars, first, rest, index) {
      if (first === '\\') {
        backslashes = true;
        return m;
      }

      if (first === '?') {
        if (esc) {
          return esc + first + (rest ? QMARK.repeat(rest.length) : '');
        }

        if (index === 0) {
          return qmarkNoDot + (rest ? QMARK.repeat(rest.length) : '');
        }

        return QMARK.repeat(chars.length);
      }

      if (first === '.') {
        return DOT_LITERAL.repeat(chars.length);
      }

      if (first === '*') {
        if (esc) {
          return esc + first + (rest ? star : '');
        }

        return star;
      }

      return esc ? m : "\\".concat(m);
    });

    if (backslashes === true) {
      if (opts.unescape === true) {
        output = output.replace(/\\/g, '');
      } else {
        output = output.replace(/\\+/g, function (m) {
          return m.length % 2 === 0 ? '\\\\' : m ? '\\' : '';
        });
      }
    }

    if (output === input && opts.contains === true) {
      state.output = input;
      return state;
    }

    state.output = utils.wrapOutput(output, state, options);
    return state;
  }
  /**
   * Tokenize input until we reach end-of-string
   */


  while (!eos()) {
    value = advance();

    if (value === "\0") {
      continue;
    }
    /**
     * Escaped characters
     */


    if (value === '\\') {
      var next = peek();

      if (next === '/' && opts.bash !== true) {
        continue;
      }

      if (next === '.' || next === ';') {
        continue;
      }

      if (!next) {
        value += '\\';
        push({
          type: 'text',
          value: value
        });
        continue;
      } // collapse slashes to reduce potential for exploits


      var match = /^\\+/.exec(remaining());
      var slashes = 0;

      if (match && match[0].length > 2) {
        slashes = match[0].length;
        state.index += slashes;

        if (slashes % 2 !== 0) {
          value += '\\';
        }
      }

      if (opts.unescape === true) {
        value = advance() || '';
      } else {
        value += advance() || '';
      }

      if (state.brackets === 0) {
        push({
          type: 'text',
          value: value
        });
        continue;
      }
    }
    /**
     * If we're inside a regex character class, continue
     * until we reach the closing bracket.
     */


    if (state.brackets > 0 && (value !== ']' || prev.value === '[' || prev.value === '[^')) {
      if (opts.posix !== false && value === ':') {
        var inner = prev.value.slice(1);

        if (inner.includes('[')) {
          prev.posix = true;

          if (inner.includes(':')) {
            var idx = prev.value.lastIndexOf('[');
            var pre = prev.value.slice(0, idx);

            var _rest = prev.value.slice(idx + 2);

            var posix = POSIX_REGEX_SOURCE[_rest];

            if (posix) {
              prev.value = pre + posix;
              state.backtrack = true;
              advance();

              if (!bos.output && tokens.indexOf(prev) === 1) {
                bos.output = ONE_CHAR;
              }

              continue;
            }
          }
        }
      }

      if (value === '[' && peek() !== ':' || value === '-' && peek() === ']') {
        value = "\\".concat(value);
      }

      if (value === ']' && (prev.value === '[' || prev.value === '[^')) {
        value = "\\".concat(value);
      }

      if (opts.posix === true && value === '!' && prev.value === '[') {
        value = '^';
      }

      prev.value += value;
      append({
        value: value
      });
      continue;
    }
    /**
     * If we're inside a quoted string, continue
     * until we reach the closing double quote.
     */


    if (state.quotes === 1 && value !== '"') {
      value = utils.escapeRegex(value);
      prev.value += value;
      append({
        value: value
      });
      continue;
    }
    /**
     * Double quotes
     */


    if (value === '"') {
      state.quotes = state.quotes === 1 ? 0 : 1;

      if (opts.keepQuotes === true) {
        push({
          type: 'text',
          value: value
        });
      }

      continue;
    }
    /**
     * Parentheses
     */


    if (value === '(') {
      increment('parens');
      push({
        type: 'paren',
        value: value
      });
      continue;
    }

    if (value === ')') {
      if (state.parens === 0 && opts.strictBrackets === true) {
        throw new SyntaxError(syntaxError('opening', '('));
      }

      var extglob = extglobs[extglobs.length - 1];

      if (extglob && state.parens === extglob.parens + 1) {
        extglobClose(extglobs.pop());
        continue;
      }

      push({
        type: 'paren',
        value: value,
        output: state.parens ? ')' : '\\)'
      });
      decrement('parens');
      continue;
    }
    /**
     * Square brackets
     */


    if (value === '[') {
      if (opts.nobracket === true || !remaining().includes(']')) {
        if (opts.nobracket !== true && opts.strictBrackets === true) {
          throw new SyntaxError(syntaxError('closing', ']'));
        }

        value = "\\".concat(value);
      } else {
        increment('brackets');
      }

      push({
        type: 'bracket',
        value: value
      });
      continue;
    }

    if (value === ']') {
      if (opts.nobracket === true || prev && prev.type === 'bracket' && prev.value.length === 1) {
        push({
          type: 'text',
          value: value,
          output: "\\".concat(value)
        });
        continue;
      }

      if (state.brackets === 0) {
        if (opts.strictBrackets === true) {
          throw new SyntaxError(syntaxError('opening', '['));
        }

        push({
          type: 'text',
          value: value,
          output: "\\".concat(value)
        });
        continue;
      }

      decrement('brackets');
      var prevValue = prev.value.slice(1);

      if (prev.posix !== true && prevValue[0] === '^' && !prevValue.includes('/')) {
        value = "/".concat(value);
      }

      prev.value += value;
      append({
        value: value
      }); // when literal brackets are explicitly disabled
      // assume we should match with a regex character class

      if (opts.literalBrackets === false || utils.hasRegexChars(prevValue)) {
        continue;
      }

      var escaped = utils.escapeRegex(prev.value);
      state.output = state.output.slice(0, -prev.value.length); // when literal brackets are explicitly enabled
      // assume we should escape the brackets to match literal characters

      if (opts.literalBrackets === true) {
        state.output += escaped;
        prev.value = escaped;
        continue;
      } // when the user specifies nothing, try to match both


      prev.value = "(".concat(capture).concat(escaped, "|").concat(prev.value, ")");
      state.output += prev.value;
      continue;
    }
    /**
     * Braces
     */


    if (value === '{' && opts.nobrace !== true) {
      increment('braces');
      var open = {
        type: 'brace',
        value: value,
        output: '(',
        outputIndex: state.output.length,
        tokensIndex: state.tokens.length
      };
      braces.push(open);
      push(open);
      continue;
    }

    if (value === '}') {
      var brace = braces[braces.length - 1];

      if (opts.nobrace === true || !brace) {
        push({
          type: 'text',
          value: value,
          output: value
        });
        continue;
      }

      var _output = ')';

      if (brace.dots === true) {
        var arr = tokens.slice();
        var range = [];

        for (var i = arr.length - 1; i >= 0; i--) {
          tokens.pop();

          if (arr[i].type === 'brace') {
            break;
          }

          if (arr[i].type !== 'dots') {
            range.unshift(arr[i].value);
          }
        }

        _output = expandRange(range, opts);
        state.backtrack = true;
      }

      if (brace.comma !== true && brace.dots !== true) {
        var out = state.output.slice(0, brace.outputIndex);
        var toks = state.tokens.slice(brace.tokensIndex);
        brace.value = brace.output = '\\{';
        value = _output = '\\}';
        state.output = out;

        var _iterator = _createForOfIteratorHelper(toks),
            _step;

        try {
          for (_iterator.s(); !(_step = _iterator.n()).done;) {
            var t = _step.value;
            state.output += t.output || t.value;
          }
        } catch (err) {
          _iterator.e(err);
        } finally {
          _iterator.f();
        }
      }

      push({
        type: 'brace',
        value: value,
        output: _output
      });
      decrement('braces');
      braces.pop();
      continue;
    }
    /**
     * Pipes
     */


    if (value === '|') {
      if (extglobs.length > 0) {
        extglobs[extglobs.length - 1].conditions++;
      }

      push({
        type: 'text',
        value: value
      });
      continue;
    }
    /**
     * Commas
     */


    if (value === ',') {
      var _output2 = value;
      var _brace = braces[braces.length - 1];

      if (_brace && stack[stack.length - 1] === 'braces') {
        _brace.comma = true;
        _output2 = '|';
      }

      push({
        type: 'comma',
        value: value,
        output: _output2
      });
      continue;
    }
    /**
     * Slashes
     */


    if (value === '/') {
      // if the beginning of the glob is "./", advance the start
      // to the current index, and don't add the "./" characters
      // to the state. This greatly simplifies lookbehinds when
      // checking for BOS characters like "!" and "." (not "./")
      if (prev.type === 'dot' && state.index === state.start + 1) {
        state.start = state.index + 1;
        state.consumed = '';
        state.output = '';
        tokens.pop();
        prev = bos; // reset "prev" to the first token

        continue;
      }

      push({
        type: 'slash',
        value: value,
        output: SLASH_LITERAL
      });
      continue;
    }
    /**
     * Dots
     */


    if (value === '.') {
      if (state.braces > 0 && prev.type === 'dot') {
        if (prev.value === '.') prev.output = DOT_LITERAL;
        var _brace2 = braces[braces.length - 1];
        prev.type = 'dots';
        prev.output += value;
        prev.value += value;
        _brace2.dots = true;
        continue;
      }

      if (state.braces + state.parens === 0 && prev.type !== 'bos' && prev.type !== 'slash') {
        push({
          type: 'text',
          value: value,
          output: DOT_LITERAL
        });
        continue;
      }

      push({
        type: 'dot',
        value: value,
        output: DOT_LITERAL
      });
      continue;
    }
    /**
     * Question marks
     */


    if (value === '?') {
      var isGroup = prev && prev.value === '(';

      if (!isGroup && opts.noextglob !== true && peek() === '(' && peek(2) !== '?') {
        extglobOpen('qmark', value);
        continue;
      }

      if (prev && prev.type === 'paren') {
        var _next = peek();

        var _output3 = value;

        if (_next === '<' && !utils.supportsLookbehinds()) {
          throw new Error('Node.js v10 or higher is required for regex lookbehinds');
        }

        if (prev.value === '(' && !/[!=<:]/.test(_next) || _next === '<' && !/<([!=]|\w+>)/.test(remaining())) {
          _output3 = "\\".concat(value);
        }

        push({
          type: 'text',
          value: value,
          output: _output3
        });
        continue;
      }

      if (opts.dot !== true && (prev.type === 'slash' || prev.type === 'bos')) {
        push({
          type: 'qmark',
          value: value,
          output: QMARK_NO_DOT
        });
        continue;
      }

      push({
        type: 'qmark',
        value: value,
        output: QMARK
      });
      continue;
    }
    /**
     * Exclamation
     */


    if (value === '!') {
      if (opts.noextglob !== true && peek() === '(') {
        if (peek(2) !== '?' || !/[!=<:]/.test(peek(3))) {
          extglobOpen('negate', value);
          continue;
        }
      }

      if (opts.nonegate !== true && state.index === 0) {
        negate();
        continue;
      }
    }
    /**
     * Plus
     */


    if (value === '+') {
      if (opts.noextglob !== true && peek() === '(' && peek(2) !== '?') {
        extglobOpen('plus', value);
        continue;
      }

      if (prev && prev.value === '(' || opts.regex === false) {
        push({
          type: 'plus',
          value: value,
          output: PLUS_LITERAL
        });
        continue;
      }

      if (prev && (prev.type === 'bracket' || prev.type === 'paren' || prev.type === 'brace') || state.parens > 0) {
        push({
          type: 'plus',
          value: value
        });
        continue;
      }

      push({
        type: 'plus',
        value: PLUS_LITERAL
      });
      continue;
    }
    /**
     * Plain text
     */


    if (value === '@') {
      if (opts.noextglob !== true && peek() === '(' && peek(2) !== '?') {
        push({
          type: 'at',
          extglob: true,
          value: value,
          output: ''
        });
        continue;
      }

      push({
        type: 'text',
        value: value
      });
      continue;
    }
    /**
     * Plain text
     */


    if (value !== '*') {
      if (value === '$' || value === '^') {
        value = "\\".concat(value);
      }

      var _match = REGEX_NON_SPECIAL_CHARS.exec(remaining());

      if (_match) {
        value += _match[0];
        state.index += _match[0].length;
      }

      push({
        type: 'text',
        value: value
      });
      continue;
    }
    /**
     * Stars
     */


    if (prev && (prev.type === 'globstar' || prev.star === true)) {
      prev.type = 'star';
      prev.star = true;
      prev.value += value;
      prev.output = star;
      state.backtrack = true;
      state.globstar = true;
      consume(value);
      continue;
    }

    var rest = remaining();

    if (opts.noextglob !== true && /^\([^?]/.test(rest)) {
      extglobOpen('star', value);
      continue;
    }

    if (prev.type === 'star') {
      if (opts.noglobstar === true) {
        consume(value);
        continue;
      }

      var prior = prev.prev;
      var before = prior.prev;
      var isStart = prior.type === 'slash' || prior.type === 'bos';
      var afterStar = before && (before.type === 'star' || before.type === 'globstar');

      if (opts.bash === true && (!isStart || rest[0] && rest[0] !== '/')) {
        push({
          type: 'star',
          value: value,
          output: ''
        });
        continue;
      }

      var isBrace = state.braces > 0 && (prior.type === 'comma' || prior.type === 'brace');
      var isExtglob = extglobs.length && (prior.type === 'pipe' || prior.type === 'paren');

      if (!isStart && prior.type !== 'paren' && !isBrace && !isExtglob) {
        push({
          type: 'star',
          value: value,
          output: ''
        });
        continue;
      } // strip consecutive `/**/`


      while (rest.slice(0, 3) === '/**') {
        var after = input[state.index + 4];

        if (after && after !== '/') {
          break;
        }

        rest = rest.slice(3);
        consume('/**', 3);
      }

      if (prior.type === 'bos' && eos()) {
        prev.type = 'globstar';
        prev.value += value;
        prev.output = globstar(opts);
        state.output = prev.output;
        state.globstar = true;
        consume(value);
        continue;
      }

      if (prior.type === 'slash' && prior.prev.type !== 'bos' && !afterStar && eos()) {
        state.output = state.output.slice(0, -(prior.output + prev.output).length);
        prior.output = "(?:".concat(prior.output);
        prev.type = 'globstar';
        prev.output = globstar(opts) + (opts.strictSlashes ? ')' : '|$)');
        prev.value += value;
        state.globstar = true;
        state.output += prior.output + prev.output;
        consume(value);
        continue;
      }

      if (prior.type === 'slash' && prior.prev.type !== 'bos' && rest[0] === '/') {
        var end = rest[1] !== void 0 ? '|$' : '';
        state.output = state.output.slice(0, -(prior.output + prev.output).length);
        prior.output = "(?:".concat(prior.output);
        prev.type = 'globstar';
        prev.output = "".concat(globstar(opts)).concat(SLASH_LITERAL, "|").concat(SLASH_LITERAL).concat(end, ")");
        prev.value += value;
        state.output += prior.output + prev.output;
        state.globstar = true;
        consume(value + advance());
        push({
          type: 'slash',
          value: '/',
          output: ''
        });
        continue;
      }

      if (prior.type === 'bos' && rest[0] === '/') {
        prev.type = 'globstar';
        prev.value += value;
        prev.output = "(?:^|".concat(SLASH_LITERAL, "|").concat(globstar(opts)).concat(SLASH_LITERAL, ")");
        state.output = prev.output;
        state.globstar = true;
        consume(value + advance());
        push({
          type: 'slash',
          value: '/',
          output: ''
        });
        continue;
      } // remove single star from output


      state.output = state.output.slice(0, -prev.output.length); // reset previous token to globstar

      prev.type = 'globstar';
      prev.output = globstar(opts);
      prev.value += value; // reset output with globstar

      state.output += prev.output;
      state.globstar = true;
      consume(value);
      continue;
    }

    var token = {
      type: 'star',
      value: value,
      output: star
    };

    if (opts.bash === true) {
      token.output = '.*?';

      if (prev.type === 'bos' || prev.type === 'slash') {
        token.output = nodot + token.output;
      }

      push(token);
      continue;
    }

    if (prev && (prev.type === 'bracket' || prev.type === 'paren') && opts.regex === true) {
      token.output = value;
      push(token);
      continue;
    }

    if (state.index === state.start || prev.type === 'slash' || prev.type === 'dot') {
      if (prev.type === 'dot') {
        state.output += NO_DOT_SLASH;
        prev.output += NO_DOT_SLASH;
      } else if (opts.dot === true) {
        state.output += NO_DOTS_SLASH;
        prev.output += NO_DOTS_SLASH;
      } else {
        state.output += nodot;
        prev.output += nodot;
      }

      if (peek() !== '*') {
        state.output += ONE_CHAR;
        prev.output += ONE_CHAR;
      }
    }

    push(token);
  }

  while (state.brackets > 0) {
    if (opts.strictBrackets === true) throw new SyntaxError(syntaxError('closing', ']'));
    state.output = utils.escapeLast(state.output, '[');
    decrement('brackets');
  }

  while (state.parens > 0) {
    if (opts.strictBrackets === true) throw new SyntaxError(syntaxError('closing', ')'));
    state.output = utils.escapeLast(state.output, '(');
    decrement('parens');
  }

  while (state.braces > 0) {
    if (opts.strictBrackets === true) throw new SyntaxError(syntaxError('closing', '}'));
    state.output = utils.escapeLast(state.output, '{');
    decrement('braces');
  }

  if (opts.strictSlashes !== true && (prev.type === 'star' || prev.type === 'bracket')) {
    push({
      type: 'maybe_slash',
      value: '',
      output: "".concat(SLASH_LITERAL, "?")
    });
  } // rebuild the output if we had to backtrack at any point


  if (state.backtrack === true) {
    state.output = '';

    var _iterator2 = _createForOfIteratorHelper(state.tokens),
        _step2;

    try {
      for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
        var _token = _step2.value;
        state.output += _token.output != null ? _token.output : _token.value;

        if (_token.suffix) {
          state.output += _token.suffix;
        }
      }
    } catch (err) {
      _iterator2.e(err);
    } finally {
      _iterator2.f();
    }
  }

  return state;
};
/**
 * Fast paths for creating regular expressions for common glob patterns.
 * This can significantly speed up processing and has very little downside
 * impact when none of the fast paths match.
 */


parse.fastpaths = function (input, options) {
  var opts = _objectSpread({}, options);

  var max = typeof opts.maxLength === 'number' ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
  var len = input.length;

  if (len > max) {
    throw new SyntaxError("Input length: ".concat(len, ", exceeds maximum allowed length: ").concat(max));
  }

  input = REPLACEMENTS[input] || input;
  var win32 = utils.isWindows(options); // create constants based on platform, for windows or posix

  var _constants$globChars = constants.globChars(win32),
      DOT_LITERAL = _constants$globChars.DOT_LITERAL,
      SLASH_LITERAL = _constants$globChars.SLASH_LITERAL,
      ONE_CHAR = _constants$globChars.ONE_CHAR,
      DOTS_SLASH = _constants$globChars.DOTS_SLASH,
      NO_DOT = _constants$globChars.NO_DOT,
      NO_DOTS = _constants$globChars.NO_DOTS,
      NO_DOTS_SLASH = _constants$globChars.NO_DOTS_SLASH,
      STAR = _constants$globChars.STAR,
      START_ANCHOR = _constants$globChars.START_ANCHOR;

  var nodot = opts.dot ? NO_DOTS : NO_DOT;
  var slashDot = opts.dot ? NO_DOTS_SLASH : NO_DOT;
  var capture = opts.capture ? '' : '?:';
  var state = {
    negated: false,
    prefix: ''
  };
  var star = opts.bash === true ? '.*?' : STAR;

  if (opts.capture) {
    star = "(".concat(star, ")");
  }

  var globstar = function globstar(opts) {
    if (opts.noglobstar === true) return star;
    return "(".concat(capture, "(?:(?!").concat(START_ANCHOR).concat(opts.dot ? DOTS_SLASH : DOT_LITERAL, ").)*?)");
  };

  var create = function create(str) {
    switch (str) {
      case '*':
        return "".concat(nodot).concat(ONE_CHAR).concat(star);

      case '.*':
        return "".concat(DOT_LITERAL).concat(ONE_CHAR).concat(star);

      case '*.*':
        return "".concat(nodot).concat(star).concat(DOT_LITERAL).concat(ONE_CHAR).concat(star);

      case '*/*':
        return "".concat(nodot).concat(star).concat(SLASH_LITERAL).concat(ONE_CHAR).concat(slashDot).concat(star);

      case '**':
        return nodot + globstar(opts);

      case '**/*':
        return "(?:".concat(nodot).concat(globstar(opts)).concat(SLASH_LITERAL, ")?").concat(slashDot).concat(ONE_CHAR).concat(star);

      case '**/*.*':
        return "(?:".concat(nodot).concat(globstar(opts)).concat(SLASH_LITERAL, ")?").concat(slashDot).concat(star).concat(DOT_LITERAL).concat(ONE_CHAR).concat(star);

      case '**/.*':
        return "(?:".concat(nodot).concat(globstar(opts)).concat(SLASH_LITERAL, ")?").concat(DOT_LITERAL).concat(ONE_CHAR).concat(star);

      default:
        {
          var match = /^(.*?)\.(\w+)$/.exec(str);
          if (!match) return;

          var _source = create(match[1]);

          if (!_source) return;
          return _source + DOT_LITERAL + match[2];
        }
    }
  };

  var output = utils.removePrefix(input, state);
  var source = create(output);

  if (source && opts.strictSlashes !== true) {
    source += "".concat(SLASH_LITERAL, "?");
  }

  return source;
};

module.exports = parse;

/***/ }),

/***/ "./node_modules/picomatch/lib/picomatch.js":
/*!*************************************************!*\
  !*** ./node_modules/picomatch/lib/picomatch.js ***!
  \*************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _createForOfIteratorHelper(o) { if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (o = _unsupportedIterableToArray(o))) { var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var it, normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

var path = __webpack_require__(/*! path */ "./node_modules/path-browserify/index.js");

var scan = __webpack_require__(/*! ./scan */ "./node_modules/picomatch/lib/scan.js");

var parse = __webpack_require__(/*! ./parse */ "./node_modules/picomatch/lib/parse.js");

var utils = __webpack_require__(/*! ./utils */ "./node_modules/picomatch/lib/utils.js");

var constants = __webpack_require__(/*! ./constants */ "./node_modules/picomatch/lib/constants.js");

var isObject = function isObject(val) {
  return val && _typeof(val) === 'object' && !Array.isArray(val);
};
/**
 * Creates a matcher function from one or more glob patterns. The
 * returned function takes a string to match as its first argument,
 * and returns true if the string is a match. The returned matcher
 * function also takes a boolean as the second argument that, when true,
 * returns an object with additional information.
 *
 * ```js
 * const picomatch = require('picomatch');
 * // picomatch(glob[, options]);
 *
 * const isMatch = picomatch('*.!(*a)');
 * console.log(isMatch('a.a')); //=> false
 * console.log(isMatch('a.b')); //=> true
 * ```
 * @name picomatch
 * @param {String|Array} `globs` One or more glob patterns.
 * @param {Object=} `options`
 * @return {Function=} Returns a matcher function.
 * @api public
 */


var picomatch = function picomatch(glob, options) {
  var returnState = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

  if (Array.isArray(glob)) {
    var fns = glob.map(function (input) {
      return picomatch(input, options, returnState);
    });

    var arrayMatcher = function arrayMatcher(str) {
      var _iterator = _createForOfIteratorHelper(fns),
          _step;

      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var isMatch = _step.value;

          var _state = isMatch(str);

          if (_state) return _state;
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }

      return false;
    };

    return arrayMatcher;
  }

  var isState = isObject(glob) && glob.tokens && glob.input;

  if (glob === '' || typeof glob !== 'string' && !isState) {
    throw new TypeError('Expected pattern to be a non-empty string');
  }

  var opts = options || {};
  var posix = utils.isWindows(options);
  var regex = isState ? picomatch.compileRe(glob, options) : picomatch.makeRe(glob, options, false, true);
  var state = regex.state;
  delete regex.state;

  var isIgnored = function isIgnored() {
    return false;
  };

  if (opts.ignore) {
    var ignoreOpts = _objectSpread({}, options, {
      ignore: null,
      onMatch: null,
      onResult: null
    });

    isIgnored = picomatch(opts.ignore, ignoreOpts, returnState);
  }

  var matcher = function matcher(input) {
    var returnObject = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

    var _picomatch$test = picomatch.test(input, regex, options, {
      glob: glob,
      posix: posix
    }),
        isMatch = _picomatch$test.isMatch,
        match = _picomatch$test.match,
        output = _picomatch$test.output;

    var result = {
      glob: glob,
      state: state,
      regex: regex,
      posix: posix,
      input: input,
      output: output,
      match: match,
      isMatch: isMatch
    };

    if (typeof opts.onResult === 'function') {
      opts.onResult(result);
    }

    if (isMatch === false) {
      result.isMatch = false;
      return returnObject ? result : false;
    }

    if (isIgnored(input)) {
      if (typeof opts.onIgnore === 'function') {
        opts.onIgnore(result);
      }

      result.isMatch = false;
      return returnObject ? result : false;
    }

    if (typeof opts.onMatch === 'function') {
      opts.onMatch(result);
    }

    return returnObject ? result : true;
  };

  if (returnState) {
    matcher.state = state;
  }

  return matcher;
};
/**
 * Test `input` with the given `regex`. This is used by the main
 * `picomatch()` function to test the input string.
 *
 * ```js
 * const picomatch = require('picomatch');
 * // picomatch.test(input, regex[, options]);
 *
 * console.log(picomatch.test('foo/bar', /^(?:([^/]*?)\/([^/]*?))$/));
 * // { isMatch: true, match: [ 'foo/', 'foo', 'bar' ], output: 'foo/bar' }
 * ```
 * @param {String} `input` String to test.
 * @param {RegExp} `regex`
 * @return {Object} Returns an object with matching info.
 * @api public
 */


picomatch.test = function (input, regex, options) {
  var _ref = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {},
      glob = _ref.glob,
      posix = _ref.posix;

  if (typeof input !== 'string') {
    throw new TypeError('Expected input to be a string');
  }

  if (input === '') {
    return {
      isMatch: false,
      output: ''
    };
  }

  var opts = options || {};
  var format = opts.format || (posix ? utils.toPosixSlashes : null);
  var match = input === glob;
  var output = match && format ? format(input) : input;

  if (match === false) {
    output = format ? format(input) : input;
    match = output === glob;
  }

  if (match === false || opts.capture === true) {
    if (opts.matchBase === true || opts.basename === true) {
      match = picomatch.matchBase(input, regex, options, posix);
    } else {
      match = regex.exec(output);
    }
  }

  return {
    isMatch: Boolean(match),
    match: match,
    output: output
  };
};
/**
 * Match the basename of a filepath.
 *
 * ```js
 * const picomatch = require('picomatch');
 * // picomatch.matchBase(input, glob[, options]);
 * console.log(picomatch.matchBase('foo/bar.js', '*.js'); // true
 * ```
 * @param {String} `input` String to test.
 * @param {RegExp|String} `glob` Glob pattern or regex created by [.makeRe](#makeRe).
 * @return {Boolean}
 * @api public
 */


picomatch.matchBase = function (input, glob, options) {
  var posix = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : utils.isWindows(options);
  var regex = glob instanceof RegExp ? glob : picomatch.makeRe(glob, options);
  return regex.test(path.basename(input));
};
/**
 * Returns true if **any** of the given glob `patterns` match the specified `string`.
 *
 * ```js
 * const picomatch = require('picomatch');
 * // picomatch.isMatch(string, patterns[, options]);
 *
 * console.log(picomatch.isMatch('a.a', ['b.*', '*.a'])); //=> true
 * console.log(picomatch.isMatch('a.a', 'b.*')); //=> false
 * ```
 * @param {String|Array} str The string to test.
 * @param {String|Array} patterns One or more glob patterns to use for matching.
 * @param {Object} [options] See available [options](#options).
 * @return {Boolean} Returns true if any patterns match `str`
 * @api public
 */


picomatch.isMatch = function (str, patterns, options) {
  return picomatch(patterns, options)(str);
};
/**
 * Parse a glob pattern to create the source string for a regular
 * expression.
 *
 * ```js
 * const picomatch = require('picomatch');
 * const result = picomatch.parse(pattern[, options]);
 * ```
 * @param {String} `pattern`
 * @param {Object} `options`
 * @return {Object} Returns an object with useful properties and output to be used as a regex source string.
 * @api public
 */


picomatch.parse = function (pattern, options) {
  if (Array.isArray(pattern)) return pattern.map(function (p) {
    return picomatch.parse(p, options);
  });
  return parse(pattern, _objectSpread({}, options, {
    fastpaths: false
  }));
};
/**
 * Scan a glob pattern to separate the pattern into segments.
 *
 * ```js
 * const picomatch = require('picomatch');
 * // picomatch.scan(input[, options]);
 *
 * const result = picomatch.scan('!./foo/*.js');
 * console.log(result);
 * { prefix: '!./',
 *   input: '!./foo/*.js',
 *   start: 3,
 *   base: 'foo',
 *   glob: '*.js',
 *   isBrace: false,
 *   isBracket: false,
 *   isGlob: true,
 *   isExtglob: false,
 *   isGlobstar: false,
 *   negated: true }
 * ```
 * @param {String} `input` Glob pattern to scan.
 * @param {Object} `options`
 * @return {Object} Returns an object with
 * @api public
 */


picomatch.scan = function (input, options) {
  return scan(input, options);
};
/**
 * Create a regular expression from a parsed glob pattern.
 *
 * ```js
 * const picomatch = require('picomatch');
 * const state = picomatch.parse('*.js');
 * // picomatch.compileRe(state[, options]);
 *
 * console.log(picomatch.compileRe(state));
 * //=> /^(?:(?!\.)(?=.)[^/]*?\.js)$/
 * ```
 * @param {String} `state` The object returned from the `.parse` method.
 * @param {Object} `options`
 * @return {RegExp} Returns a regex created from the given pattern.
 * @api public
 */


picomatch.compileRe = function (parsed, options) {
  var returnOutput = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  var returnState = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;

  if (returnOutput === true) {
    return parsed.output;
  }

  var opts = options || {};
  var prepend = opts.contains ? '' : '^';
  var append = opts.contains ? '' : '$';
  var source = "".concat(prepend, "(?:").concat(parsed.output, ")").concat(append);

  if (parsed && parsed.negated === true) {
    source = "^(?!".concat(source, ").*$");
  }

  var regex = picomatch.toRegex(source, options);

  if (returnState === true) {
    regex.state = parsed;
  }

  return regex;
};

picomatch.makeRe = function (input, options) {
  var returnOutput = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  var returnState = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;

  if (!input || typeof input !== 'string') {
    throw new TypeError('Expected a non-empty string');
  }

  var opts = options || {};
  var parsed = {
    negated: false,
    fastpaths: true
  };
  var prefix = '';
  var output;

  if (input.startsWith('./')) {
    input = input.slice(2);
    prefix = parsed.prefix = './';
  }

  if (opts.fastpaths !== false && (input[0] === '.' || input[0] === '*')) {
    output = parse.fastpaths(input, options);
  }

  if (output === undefined) {
    parsed = parse(input, options);
    parsed.prefix = prefix + (parsed.prefix || '');
  } else {
    parsed.output = output;
  }

  return picomatch.compileRe(parsed, options, returnOutput, returnState);
};
/**
 * Create a regular expression from the given regex source string.
 *
 * ```js
 * const picomatch = require('picomatch');
 * // picomatch.toRegex(source[, options]);
 *
 * const { output } = picomatch.parse('*.js');
 * console.log(picomatch.toRegex(output));
 * //=> /^(?:(?!\.)(?=.)[^/]*?\.js)$/
 * ```
 * @param {String} `source` Regular expression source string.
 * @param {Object} `options`
 * @return {RegExp}
 * @api public
 */


picomatch.toRegex = function (source, options) {
  try {
    var opts = options || {};
    return new RegExp(source, opts.flags || (opts.nocase ? 'i' : ''));
  } catch (err) {
    if (options && options.debug === true) throw err;
    return /$^/;
  }
};
/**
 * Picomatch constants.
 * @return {Object}
 */


picomatch.constants = constants;
/**
 * Expose "picomatch"
 */

module.exports = picomatch;

/***/ }),

/***/ "./node_modules/picomatch/lib/scan.js":
/*!********************************************!*\
  !*** ./node_modules/picomatch/lib/scan.js ***!
  \********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(/*! ./utils */ "./node_modules/picomatch/lib/utils.js");

var _require = __webpack_require__(/*! ./constants */ "./node_modules/picomatch/lib/constants.js"),
    CHAR_ASTERISK = _require.CHAR_ASTERISK,
    CHAR_AT = _require.CHAR_AT,
    CHAR_BACKWARD_SLASH = _require.CHAR_BACKWARD_SLASH,
    CHAR_COMMA = _require.CHAR_COMMA,
    CHAR_DOT = _require.CHAR_DOT,
    CHAR_EXCLAMATION_MARK = _require.CHAR_EXCLAMATION_MARK,
    CHAR_FORWARD_SLASH = _require.CHAR_FORWARD_SLASH,
    CHAR_LEFT_CURLY_BRACE = _require.CHAR_LEFT_CURLY_BRACE,
    CHAR_LEFT_PARENTHESES = _require.CHAR_LEFT_PARENTHESES,
    CHAR_LEFT_SQUARE_BRACKET = _require.CHAR_LEFT_SQUARE_BRACKET,
    CHAR_PLUS = _require.CHAR_PLUS,
    CHAR_QUESTION_MARK = _require.CHAR_QUESTION_MARK,
    CHAR_RIGHT_CURLY_BRACE = _require.CHAR_RIGHT_CURLY_BRACE,
    CHAR_RIGHT_PARENTHESES = _require.CHAR_RIGHT_PARENTHESES,
    CHAR_RIGHT_SQUARE_BRACKET = _require.CHAR_RIGHT_SQUARE_BRACKET;

var isPathSeparator = function isPathSeparator(code) {
  return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
};

var depth = function depth(token) {
  if (token.isPrefix !== true) {
    token.depth = token.isGlobstar ? Infinity : 1;
  }
};
/**
 * Quickly scans a glob pattern and returns an object with a handful of
 * useful properties, like `isGlob`, `path` (the leading non-glob, if it exists),
 * `glob` (the actual pattern), and `negated` (true if the path starts with `!`).
 *
 * ```js
 * const pm = require('picomatch');
 * console.log(pm.scan('foo/bar/*.js'));
 * { isGlob: true, input: 'foo/bar/*.js', base: 'foo/bar', glob: '*.js' }
 * ```
 * @param {String} `str`
 * @param {Object} `options`
 * @return {Object} Returns an object with tokens and regex source string.
 * @api public
 */


var scan = function scan(input, options) {
  var opts = options || {};
  var length = input.length - 1;
  var scanToEnd = opts.parts === true || opts.scanToEnd === true;
  var slashes = [];
  var tokens = [];
  var parts = [];
  var str = input;
  var index = -1;
  var start = 0;
  var lastIndex = 0;
  var isBrace = false;
  var isBracket = false;
  var isGlob = false;
  var isExtglob = false;
  var isGlobstar = false;
  var braceEscaped = false;
  var backslashes = false;
  var negated = false;
  var finished = false;
  var braces = 0;
  var prev;
  var code;
  var token = {
    value: '',
    depth: 0,
    isGlob: false
  };

  var eos = function eos() {
    return index >= length;
  };

  var peek = function peek() {
    return str.charCodeAt(index + 1);
  };

  var advance = function advance() {
    prev = code;
    return str.charCodeAt(++index);
  };

  while (index < length) {
    code = advance();
    var next = void 0;

    if (code === CHAR_BACKWARD_SLASH) {
      backslashes = token.backslashes = true;
      code = advance();

      if (code === CHAR_LEFT_CURLY_BRACE) {
        braceEscaped = true;
      }

      continue;
    }

    if (braceEscaped === true || code === CHAR_LEFT_CURLY_BRACE) {
      braces++;

      while (eos() !== true && (code = advance())) {
        if (code === CHAR_BACKWARD_SLASH) {
          backslashes = token.backslashes = true;
          advance();
          continue;
        }

        if (code === CHAR_LEFT_CURLY_BRACE) {
          braces++;
          continue;
        }

        if (braceEscaped !== true && code === CHAR_DOT && (code = advance()) === CHAR_DOT) {
          isBrace = token.isBrace = true;
          isGlob = token.isGlob = true;
          finished = true;

          if (scanToEnd === true) {
            continue;
          }

          break;
        }

        if (braceEscaped !== true && code === CHAR_COMMA) {
          isBrace = token.isBrace = true;
          isGlob = token.isGlob = true;
          finished = true;

          if (scanToEnd === true) {
            continue;
          }

          break;
        }

        if (code === CHAR_RIGHT_CURLY_BRACE) {
          braces--;

          if (braces === 0) {
            braceEscaped = false;
            isBrace = token.isBrace = true;
            finished = true;
            break;
          }
        }
      }

      if (scanToEnd === true) {
        continue;
      }

      break;
    }

    if (code === CHAR_FORWARD_SLASH) {
      slashes.push(index);
      tokens.push(token);
      token = {
        value: '',
        depth: 0,
        isGlob: false
      };
      if (finished === true) continue;

      if (prev === CHAR_DOT && index === start + 1) {
        start += 2;
        continue;
      }

      lastIndex = index + 1;
      continue;
    }

    if (opts.noext !== true) {
      var isExtglobChar = code === CHAR_PLUS || code === CHAR_AT || code === CHAR_ASTERISK || code === CHAR_QUESTION_MARK || code === CHAR_EXCLAMATION_MARK;

      if (isExtglobChar === true && peek() === CHAR_LEFT_PARENTHESES) {
        isGlob = token.isGlob = true;
        isExtglob = token.isExtglob = true;
        finished = true;

        if (scanToEnd === true) {
          while (eos() !== true && (code = advance())) {
            if (code === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              code = advance();
              continue;
            }

            if (code === CHAR_RIGHT_PARENTHESES) {
              isGlob = token.isGlob = true;
              finished = true;
              break;
            }
          }

          continue;
        }

        break;
      }
    }

    if (code === CHAR_ASTERISK) {
      if (prev === CHAR_ASTERISK) isGlobstar = token.isGlobstar = true;
      isGlob = token.isGlob = true;
      finished = true;

      if (scanToEnd === true) {
        continue;
      }

      break;
    }

    if (code === CHAR_QUESTION_MARK) {
      isGlob = token.isGlob = true;
      finished = true;

      if (scanToEnd === true) {
        continue;
      }

      break;
    }

    if (code === CHAR_LEFT_SQUARE_BRACKET) {
      while (eos() !== true && (next = advance())) {
        if (next === CHAR_BACKWARD_SLASH) {
          backslashes = token.backslashes = true;
          advance();
          continue;
        }

        if (next === CHAR_RIGHT_SQUARE_BRACKET) {
          isBracket = token.isBracket = true;
          isGlob = token.isGlob = true;
          finished = true;

          if (scanToEnd === true) {
            continue;
          }

          break;
        }
      }
    }

    if (opts.nonegate !== true && code === CHAR_EXCLAMATION_MARK && index === start) {
      negated = token.negated = true;
      start++;
      continue;
    }

    if (opts.noparen !== true && code === CHAR_LEFT_PARENTHESES) {
      isGlob = token.isGlob = true;

      if (scanToEnd === true) {
        while (eos() !== true && (code = advance())) {
          if (code === CHAR_LEFT_PARENTHESES) {
            backslashes = token.backslashes = true;
            code = advance();
            continue;
          }

          if (code === CHAR_RIGHT_PARENTHESES) {
            finished = true;
            break;
          }
        }

        continue;
      }

      break;
    }

    if (isGlob === true) {
      finished = true;

      if (scanToEnd === true) {
        continue;
      }

      break;
    }
  }

  if (opts.noext === true) {
    isExtglob = false;
    isGlob = false;
  }

  var base = str;
  var prefix = '';
  var glob = '';

  if (start > 0) {
    prefix = str.slice(0, start);
    str = str.slice(start);
    lastIndex -= start;
  }

  if (base && isGlob === true && lastIndex > 0) {
    base = str.slice(0, lastIndex);
    glob = str.slice(lastIndex);
  } else if (isGlob === true) {
    base = '';
    glob = str;
  } else {
    base = str;
  }

  if (base && base !== '' && base !== '/' && base !== str) {
    if (isPathSeparator(base.charCodeAt(base.length - 1))) {
      base = base.slice(0, -1);
    }
  }

  if (opts.unescape === true) {
    if (glob) glob = utils.removeBackslashes(glob);

    if (base && backslashes === true) {
      base = utils.removeBackslashes(base);
    }
  }

  var state = {
    prefix: prefix,
    input: input,
    start: start,
    base: base,
    glob: glob,
    isBrace: isBrace,
    isBracket: isBracket,
    isGlob: isGlob,
    isExtglob: isExtglob,
    isGlobstar: isGlobstar,
    negated: negated
  };

  if (opts.tokens === true) {
    state.maxDepth = 0;

    if (!isPathSeparator(code)) {
      tokens.push(token);
    }

    state.tokens = tokens;
  }

  if (opts.parts === true || opts.tokens === true) {
    var prevIndex;

    for (var idx = 0; idx < slashes.length; idx++) {
      var n = prevIndex ? prevIndex + 1 : start;
      var i = slashes[idx];
      var value = input.slice(n, i);

      if (opts.tokens) {
        if (idx === 0 && start !== 0) {
          tokens[idx].isPrefix = true;
          tokens[idx].value = prefix;
        } else {
          tokens[idx].value = value;
        }

        depth(tokens[idx]);
        state.maxDepth += tokens[idx].depth;
      }

      if (idx !== 0 || value !== '') {
        parts.push(value);
      }

      prevIndex = i;
    }

    if (prevIndex && prevIndex + 1 < input.length) {
      var _value = input.slice(prevIndex + 1);

      parts.push(_value);

      if (opts.tokens) {
        tokens[tokens.length - 1].value = _value;
        depth(tokens[tokens.length - 1]);
        state.maxDepth += tokens[tokens.length - 1].depth;
      }
    }

    state.slashes = slashes;
    state.parts = parts;
  }

  return state;
};

module.exports = scan;

/***/ }),

/***/ "./node_modules/picomatch/lib/utils.js":
/*!*********************************************!*\
  !*** ./node_modules/picomatch/lib/utils.js ***!
  \*********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(process) {

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

var path = __webpack_require__(/*! path */ "./node_modules/path-browserify/index.js");

var win32 = process.platform === 'win32';

var _require = __webpack_require__(/*! ./constants */ "./node_modules/picomatch/lib/constants.js"),
    REGEX_BACKSLASH = _require.REGEX_BACKSLASH,
    REGEX_REMOVE_BACKSLASH = _require.REGEX_REMOVE_BACKSLASH,
    REGEX_SPECIAL_CHARS = _require.REGEX_SPECIAL_CHARS,
    REGEX_SPECIAL_CHARS_GLOBAL = _require.REGEX_SPECIAL_CHARS_GLOBAL;

exports.isObject = function (val) {
  return val !== null && _typeof(val) === 'object' && !Array.isArray(val);
};

exports.hasRegexChars = function (str) {
  return REGEX_SPECIAL_CHARS.test(str);
};

exports.isRegexChar = function (str) {
  return str.length === 1 && exports.hasRegexChars(str);
};

exports.escapeRegex = function (str) {
  return str.replace(REGEX_SPECIAL_CHARS_GLOBAL, '\\$1');
};

exports.toPosixSlashes = function (str) {
  return str.replace(REGEX_BACKSLASH, '/');
};

exports.removeBackslashes = function (str) {
  return str.replace(REGEX_REMOVE_BACKSLASH, function (match) {
    return match === '\\' ? '' : match;
  });
};

exports.supportsLookbehinds = function () {
  var segs = process.version.slice(1).split('.').map(Number);

  if (segs.length === 3 && segs[0] >= 9 || segs[0] === 8 && segs[1] >= 10) {
    return true;
  }

  return false;
};

exports.isWindows = function (options) {
  if (options && typeof options.windows === 'boolean') {
    return options.windows;
  }

  return win32 === true || path.sep === '\\';
};

exports.escapeLast = function (input, char, lastIdx) {
  var idx = input.lastIndexOf(char, lastIdx);
  if (idx === -1) return input;
  if (input[idx - 1] === '\\') return exports.escapeLast(input, char, idx - 1);
  return "".concat(input.slice(0, idx), "\\").concat(input.slice(idx));
};

exports.removePrefix = function (input) {
  var state = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var output = input;

  if (output.startsWith('./')) {
    output = output.slice(2);
    state.prefix = './';
  }

  return output;
};

exports.wrapOutput = function (input) {
  var state = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var prepend = options.contains ? '' : '^';
  var append = options.contains ? '' : '$';
  var output = "".concat(prepend, "(?:").concat(input, ")").concat(append);

  if (state.negated === true) {
    output = "(?:^(?!".concat(output, ").*$)");
  }

  return output;
};
/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../../process/browser.js */ "./node_modules/process/browser.js")))

/***/ }),

/***/ "./node_modules/process/browser.js":
/*!*****************************************!*\
  !*** ./node_modules/process/browser.js ***!
  \*****************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


// shim for using process in browser
var process = module.exports = {}; // cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
  throw new Error('setTimeout has not been defined');
}

function defaultClearTimeout() {
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
})();

function runTimeout(fun) {
  if (cachedSetTimeout === setTimeout) {
    //normal enviroments in sane situations
    return setTimeout(fun, 0);
  } // if setTimeout wasn't available but was latter defined


  if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
    cachedSetTimeout = setTimeout;
    return setTimeout(fun, 0);
  }

  try {
    // when when somebody has screwed with setTimeout but no I.E. maddness
    return cachedSetTimeout(fun, 0);
  } catch (e) {
    try {
      // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
      return cachedSetTimeout.call(null, fun, 0);
    } catch (e) {
      // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
      return cachedSetTimeout.call(this, fun, 0);
    }
  }
}

function runClearTimeout(marker) {
  if (cachedClearTimeout === clearTimeout) {
    //normal enviroments in sane situations
    return clearTimeout(marker);
  } // if clearTimeout wasn't available but was latter defined


  if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
    cachedClearTimeout = clearTimeout;
    return clearTimeout(marker);
  }

  try {
    // when when somebody has screwed with setTimeout but no I.E. maddness
    return cachedClearTimeout(marker);
  } catch (e) {
    try {
      // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
      return cachedClearTimeout.call(null, marker);
    } catch (e) {
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

  while (len) {
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
}; // v8 likes predictible objects


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

process.listeners = function (name) {
  return [];
};

process.binding = function (name) {
  throw new Error('process.binding is not supported');
};

process.cwd = function () {
  return '/';
};

process.chdir = function (dir) {
  throw new Error('process.chdir is not supported');
};

process.umask = function () {
  return 0;
};

/***/ }),

/***/ "./node_modules/react-is/cjs/react-is.development.js":
/*!***********************************************************!*\
  !*** ./node_modules/react-is/cjs/react-is.development.js ***!
  \***********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/** @license React v16.13.1
 * react-is.development.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */


function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

if (true) {
  (function () {
    'use strict'; // The Symbol used to tag the ReactElement-like types. If there is no native Symbol
    // nor polyfill, then a plain number is used for performance.

    var hasSymbol = typeof Symbol === 'function' && Symbol.for;
    var REACT_ELEMENT_TYPE = hasSymbol ? Symbol.for('react.element') : 0xeac7;
    var REACT_PORTAL_TYPE = hasSymbol ? Symbol.for('react.portal') : 0xeaca;
    var REACT_FRAGMENT_TYPE = hasSymbol ? Symbol.for('react.fragment') : 0xeacb;
    var REACT_STRICT_MODE_TYPE = hasSymbol ? Symbol.for('react.strict_mode') : 0xeacc;
    var REACT_PROFILER_TYPE = hasSymbol ? Symbol.for('react.profiler') : 0xead2;
    var REACT_PROVIDER_TYPE = hasSymbol ? Symbol.for('react.provider') : 0xeacd;
    var REACT_CONTEXT_TYPE = hasSymbol ? Symbol.for('react.context') : 0xeace; // TODO: We don't use AsyncMode or ConcurrentMode anymore. They were temporary
    // (unstable) APIs that have been removed. Can we remove the symbols?

    var REACT_ASYNC_MODE_TYPE = hasSymbol ? Symbol.for('react.async_mode') : 0xeacf;
    var REACT_CONCURRENT_MODE_TYPE = hasSymbol ? Symbol.for('react.concurrent_mode') : 0xeacf;
    var REACT_FORWARD_REF_TYPE = hasSymbol ? Symbol.for('react.forward_ref') : 0xead0;
    var REACT_SUSPENSE_TYPE = hasSymbol ? Symbol.for('react.suspense') : 0xead1;
    var REACT_SUSPENSE_LIST_TYPE = hasSymbol ? Symbol.for('react.suspense_list') : 0xead8;
    var REACT_MEMO_TYPE = hasSymbol ? Symbol.for('react.memo') : 0xead3;
    var REACT_LAZY_TYPE = hasSymbol ? Symbol.for('react.lazy') : 0xead4;
    var REACT_BLOCK_TYPE = hasSymbol ? Symbol.for('react.block') : 0xead9;
    var REACT_FUNDAMENTAL_TYPE = hasSymbol ? Symbol.for('react.fundamental') : 0xead5;
    var REACT_RESPONDER_TYPE = hasSymbol ? Symbol.for('react.responder') : 0xead6;
    var REACT_SCOPE_TYPE = hasSymbol ? Symbol.for('react.scope') : 0xead7;

    function isValidElementType(type) {
      return typeof type === 'string' || typeof type === 'function' || // Note: its typeof might be other than 'symbol' or 'number' if it's a polyfill.
      type === REACT_FRAGMENT_TYPE || type === REACT_CONCURRENT_MODE_TYPE || type === REACT_PROFILER_TYPE || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || _typeof(type) === 'object' && type !== null && (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_PROVIDER_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || type.$$typeof === REACT_FUNDAMENTAL_TYPE || type.$$typeof === REACT_RESPONDER_TYPE || type.$$typeof === REACT_SCOPE_TYPE || type.$$typeof === REACT_BLOCK_TYPE);
    }

    function typeOf(object) {
      if (_typeof(object) === 'object' && object !== null) {
        var $$typeof = object.$$typeof;

        switch ($$typeof) {
          case REACT_ELEMENT_TYPE:
            var type = object.type;

            switch (type) {
              case REACT_ASYNC_MODE_TYPE:
              case REACT_CONCURRENT_MODE_TYPE:
              case REACT_FRAGMENT_TYPE:
              case REACT_PROFILER_TYPE:
              case REACT_STRICT_MODE_TYPE:
              case REACT_SUSPENSE_TYPE:
                return type;

              default:
                var $$typeofType = type && type.$$typeof;

                switch ($$typeofType) {
                  case REACT_CONTEXT_TYPE:
                  case REACT_FORWARD_REF_TYPE:
                  case REACT_LAZY_TYPE:
                  case REACT_MEMO_TYPE:
                  case REACT_PROVIDER_TYPE:
                    return $$typeofType;

                  default:
                    return $$typeof;
                }

            }

          case REACT_PORTAL_TYPE:
            return $$typeof;
        }
      }

      return undefined;
    } // AsyncMode is deprecated along with isAsyncMode


    var AsyncMode = REACT_ASYNC_MODE_TYPE;
    var ConcurrentMode = REACT_CONCURRENT_MODE_TYPE;
    var ContextConsumer = REACT_CONTEXT_TYPE;
    var ContextProvider = REACT_PROVIDER_TYPE;
    var Element = REACT_ELEMENT_TYPE;
    var ForwardRef = REACT_FORWARD_REF_TYPE;
    var Fragment = REACT_FRAGMENT_TYPE;
    var Lazy = REACT_LAZY_TYPE;
    var Memo = REACT_MEMO_TYPE;
    var Portal = REACT_PORTAL_TYPE;
    var Profiler = REACT_PROFILER_TYPE;
    var StrictMode = REACT_STRICT_MODE_TYPE;
    var Suspense = REACT_SUSPENSE_TYPE;
    var hasWarnedAboutDeprecatedIsAsyncMode = false; // AsyncMode should be deprecated

    function isAsyncMode(object) {
      {
        if (!hasWarnedAboutDeprecatedIsAsyncMode) {
          hasWarnedAboutDeprecatedIsAsyncMode = true; // Using console['warn'] to evade Babel and ESLint

          console['warn']('The ReactIs.isAsyncMode() alias has been deprecated, ' + 'and will be removed in React 17+. Update your code to use ' + 'ReactIs.isConcurrentMode() instead. It has the exact same API.');
        }
      }
      return isConcurrentMode(object) || typeOf(object) === REACT_ASYNC_MODE_TYPE;
    }

    function isConcurrentMode(object) {
      return typeOf(object) === REACT_CONCURRENT_MODE_TYPE;
    }

    function isContextConsumer(object) {
      return typeOf(object) === REACT_CONTEXT_TYPE;
    }

    function isContextProvider(object) {
      return typeOf(object) === REACT_PROVIDER_TYPE;
    }

    function isElement(object) {
      return _typeof(object) === 'object' && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
    }

    function isForwardRef(object) {
      return typeOf(object) === REACT_FORWARD_REF_TYPE;
    }

    function isFragment(object) {
      return typeOf(object) === REACT_FRAGMENT_TYPE;
    }

    function isLazy(object) {
      return typeOf(object) === REACT_LAZY_TYPE;
    }

    function isMemo(object) {
      return typeOf(object) === REACT_MEMO_TYPE;
    }

    function isPortal(object) {
      return typeOf(object) === REACT_PORTAL_TYPE;
    }

    function isProfiler(object) {
      return typeOf(object) === REACT_PROFILER_TYPE;
    }

    function isStrictMode(object) {
      return typeOf(object) === REACT_STRICT_MODE_TYPE;
    }

    function isSuspense(object) {
      return typeOf(object) === REACT_SUSPENSE_TYPE;
    }

    exports.AsyncMode = AsyncMode;
    exports.ConcurrentMode = ConcurrentMode;
    exports.ContextConsumer = ContextConsumer;
    exports.ContextProvider = ContextProvider;
    exports.Element = Element;
    exports.ForwardRef = ForwardRef;
    exports.Fragment = Fragment;
    exports.Lazy = Lazy;
    exports.Memo = Memo;
    exports.Portal = Portal;
    exports.Profiler = Profiler;
    exports.StrictMode = StrictMode;
    exports.Suspense = Suspense;
    exports.isAsyncMode = isAsyncMode;
    exports.isConcurrentMode = isConcurrentMode;
    exports.isContextConsumer = isContextConsumer;
    exports.isContextProvider = isContextProvider;
    exports.isElement = isElement;
    exports.isForwardRef = isForwardRef;
    exports.isFragment = isFragment;
    exports.isLazy = isLazy;
    exports.isMemo = isMemo;
    exports.isPortal = isPortal;
    exports.isProfiler = isProfiler;
    exports.isStrictMode = isStrictMode;
    exports.isSuspense = isSuspense;
    exports.isValidElementType = isValidElementType;
    exports.typeOf = typeOf;
  })();
}

/***/ }),

/***/ "./node_modules/react-is/index.js":
/*!****************************************!*\
  !*** ./node_modules/react-is/index.js ***!
  \****************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


if (false) {} else {
  module.exports = __webpack_require__(/*! ./cjs/react-is.development.js */ "./node_modules/react-is/cjs/react-is.development.js");
}

/***/ }),

/***/ "./node_modules/slash/index.js":
/*!*************************************!*\
  !*** ./node_modules/slash/index.js ***!
  \*************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = function (path) {
  var isExtendedLengthPath = /^\\\\\?\\/.test(path);
  var hasNonAscii = /[^\u0000-\u0080]+/.test(path); // eslint-disable-line no-control-regex

  if (isExtendedLengthPath || hasNonAscii) {
    return path;
  }

  return path.replace(/\\/g, '/');
};

/***/ }),

/***/ "./node_modules/stack-utils/index.js":
/*!*******************************************!*\
  !*** ./node_modules/stack-utils/index.js ***!
  \*******************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(process) {

module.exports = StackUtils;

function StackUtils(opts) {
  if (!(this instanceof StackUtils)) {
    throw new Error('StackUtils constructor must be called with new');
  }

  opts = opts || {};
  this._cwd = (opts.cwd || process.cwd()).replace(/\\/g, '/');
  this._internals = opts.internals || [];
  this._wrapCallSite = opts.wrapCallSite || false;
}

module.exports.nodeInternals = nodeInternals;

function nodeInternals() {
  if (!module.exports.natives) {
    module.exports.natives = Object.keys(process.binding('natives'));
    module.exports.natives.push('bootstrap_node', 'node', 'internal/bootstrap/node');
  }

  return module.exports.natives.map(function (n) {
    return new RegExp('\\(' + n + '\\.js:\\d+:\\d+\\)$');
  }).concat([/\s*at (bootstrap_)?node\.js:\d+:\d+?$/, /\(internal\/[^:]+:\d+:\d+\)$/, /\/\.node-spawn-wrap-\w+-\w+\/node:\d+:\d+\)?$/]);
}

StackUtils.prototype.clean = function (stack) {
  if (!Array.isArray(stack)) {
    stack = stack.split('\n');
  }

  if (!/^\s*at /.test(stack[0]) && /^\s*at /.test(stack[1])) {
    stack = stack.slice(1);
  }

  var outdent = false;
  var lastNonAtLine = null;
  var result = [];
  stack.forEach(function (st) {
    st = st.replace(/\\/g, '/');

    var isInternal = this._internals.some(function (internal) {
      return internal.test(st);
    });

    if (isInternal) {
      return null;
    }

    var isAtLine = /^\s*at /.test(st);

    if (outdent) {
      st = st.replace(/\s+$/, '').replace(/^(\s+)at /, '$1');
    } else {
      st = st.trim();

      if (isAtLine) {
        st = st.substring(3);
      }
    }

    st = st.replace(this._cwd + '/', '');

    if (st) {
      if (isAtLine) {
        if (lastNonAtLine) {
          result.push(lastNonAtLine);
          lastNonAtLine = null;
        }

        result.push(st);
      } else {
        outdent = true;
        lastNonAtLine = st;
      }
    }
  }, this);
  stack = result.join('\n').trim();

  if (stack) {
    return stack + '\n';
  }

  return '';
};

StackUtils.prototype.captureString = function (limit, fn) {
  if (typeof limit === 'function') {
    fn = limit;
    limit = Infinity;
  }

  if (!fn) {
    fn = this.captureString;
  }

  var limitBefore = Error.stackTraceLimit;

  if (limit) {
    Error.stackTraceLimit = limit;
  }

  var obj = {};
  Error.captureStackTrace(obj, fn);
  var stack = obj.stack;
  Error.stackTraceLimit = limitBefore;
  return this.clean(stack);
};

StackUtils.prototype.capture = function (limit, fn) {
  if (typeof limit === 'function') {
    fn = limit;
    limit = Infinity;
  }

  if (!fn) {
    fn = this.capture;
  }

  var prepBefore = Error.prepareStackTrace;
  var limitBefore = Error.stackTraceLimit;
  var wrapCallSite = this._wrapCallSite;

  Error.prepareStackTrace = function (obj, site) {
    if (wrapCallSite) {
      return site.map(wrapCallSite);
    }

    return site;
  };

  if (limit) {
    Error.stackTraceLimit = limit;
  }

  var obj = {};
  Error.captureStackTrace(obj, fn);
  var stack = obj.stack;
  Error.prepareStackTrace = prepBefore;
  Error.stackTraceLimit = limitBefore;
  return stack;
};

StackUtils.prototype.at = function at(fn) {
  if (!fn) {
    fn = at;
  }

  var site = this.capture(1, fn)[0];

  if (!site) {
    return {};
  }

  var res = {
    line: site.getLineNumber(),
    column: site.getColumnNumber()
  };

  this._setFile(res, site.getFileName());

  if (site.isConstructor()) {
    res.constructor = true;
  }

  if (site.isEval()) {
    res.evalOrigin = site.getEvalOrigin();
  } // Node v10 stopped with the isNative() on callsites, apparently

  /* istanbul ignore next */


  if (site.isNative()) {
    res.native = true;
  }

  var typename = null;

  try {
    typename = site.getTypeName();
  } catch (er) {}

  if (typename && typename !== 'Object' && typename !== '[object Object]') {
    res.type = typename;
  }

  var fname = site.getFunctionName();

  if (fname) {
    res.function = fname;
  }

  var meth = site.getMethodName();

  if (meth && fname !== meth) {
    res.method = meth;
  }

  return res;
};

StackUtils.prototype._setFile = function (result, filename) {
  if (filename) {
    filename = filename.replace(/\\/g, '/');

    if (filename.indexOf(this._cwd + '/') === 0) {
      filename = filename.substr(this._cwd.length + 1);
    }

    result.file = filename;
  }
};

var re = new RegExp('^' + // Sometimes we strip out the '    at' because it's noisy
'(?:\\s*at )?' + // $1 = ctor if 'new'
'(?:(new) )?' + // $2 = function name (can be literally anything)
// May contain method at the end as [as xyz]
'(?:(.*?) \\()?' + // (eval at <anonymous> (file.js:1:1),
// $3 = eval origin
// $4:$5:$6 are eval file/line/col, but not normally reported
'(?:eval at ([^ ]+) \\((.+?):(\\d+):(\\d+)\\), )?' + // file:line:col
// $7:$8:$9
// $10 = 'native' if native
'(?:(.+?):(\\d+):(\\d+)|(native))' + // maybe close the paren, then end
// if $11 is ), then we only allow balanced parens in the filename
// any imbalance is placed on the fname.  This is a heuristic, and
// bound to be incorrect in some edge cases.  The bet is that
// having weird characters in method names is more common than
// having weird characters in filenames, which seems reasonable.
'(\\)?)$');
var methodRe = /^(.*?) \[as (.*?)\]$/;

StackUtils.prototype.parseLine = function parseLine(line) {
  var match = line && line.match(re);

  if (!match) {
    return null;
  }

  var ctor = match[1] === 'new';
  var fname = match[2];
  var evalOrigin = match[3];
  var evalFile = match[4];
  var evalLine = Number(match[5]);
  var evalCol = Number(match[6]);
  var file = match[7];
  var lnum = match[8];
  var col = match[9];
  var native = match[10] === 'native';
  var closeParen = match[11] === ')';
  var res = {};

  if (lnum) {
    res.line = Number(lnum);
  }

  if (col) {
    res.column = Number(col);
  }

  if (closeParen && file) {
    // make sure parens are balanced
    // if we have a file like "asdf) [as foo] (xyz.js", then odds are
    // that the fname should be += " (asdf) [as foo]" and the file
    // should be just "xyz.js"
    // walk backwards from the end to find the last unbalanced (
    var closes = 0;

    for (var i = file.length - 1; i > 0; i--) {
      if (file.charAt(i) === ')') {
        closes++;
      } else if (file.charAt(i) === '(' && file.charAt(i - 1) === ' ') {
        closes--;

        if (closes === -1 && file.charAt(i - 1) === ' ') {
          var before = file.substr(0, i - 1);
          var after = file.substr(i + 1);
          file = after;
          fname += ' (' + before;
          break;
        }
      }
    }
  }

  if (fname) {
    var methodMatch = fname.match(methodRe);

    if (methodMatch) {
      fname = methodMatch[1];
      var meth = methodMatch[2];
    }
  }

  this._setFile(res, file);

  if (ctor) {
    res.constructor = true;
  }

  if (evalOrigin) {
    res.evalOrigin = evalOrigin;
    res.evalLine = evalLine;
    res.evalColumn = evalCol;
    res.evalFile = evalFile && evalFile.replace(/\\/g, '/');
  }

  if (native) {
    res.native = true;
  }

  if (fname) {
    res.function = fname;
  }

  if (meth && fname !== meth) {
    res.method = meth;
  }

  return res;
};

var bound = new StackUtils();
Object.keys(StackUtils.prototype).forEach(function (key) {
  StackUtils[key] = bound[key].bind(bound);
});
/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../process/browser.js */ "./node_modules/process/browser.js")))

/***/ }),

/***/ "./node_modules/to-regex-range/index.js":
/*!**********************************************!*\
  !*** ./node_modules/to-regex-range/index.js ***!
  \**********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*!
 * to-regex-range <https://github.com/micromatch/to-regex-range>
 *
 * Copyright (c) 2015-present, Jon Schlinkert.
 * Released under the MIT License.
 */


function _createForOfIteratorHelper(o) { if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (o = _unsupportedIterableToArray(o))) { var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e2) { throw _e2; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var it, normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e3) { didErr = true; err = _e3; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _iterableToArrayLimit(arr, i) { if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return; var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var isNumber = __webpack_require__(/*! is-number */ "./node_modules/to-regex-range/node_modules/is-number/index.js");

var toRegexRange = function toRegexRange(min, max, options) {
  if (isNumber(min) === false) {
    throw new TypeError('toRegexRange: expected the first argument to be a number');
  }

  if (max === void 0 || min === max) {
    return String(min);
  }

  if (isNumber(max) === false) {
    throw new TypeError('toRegexRange: expected the second argument to be a number.');
  }

  var opts = _objectSpread({
    relaxZeros: true
  }, options);

  if (typeof opts.strictZeros === 'boolean') {
    opts.relaxZeros = opts.strictZeros === false;
  }

  var relax = String(opts.relaxZeros);
  var shorthand = String(opts.shorthand);
  var capture = String(opts.capture);
  var wrap = String(opts.wrap);
  var cacheKey = min + ':' + max + '=' + relax + shorthand + capture + wrap;

  if (toRegexRange.cache.hasOwnProperty(cacheKey)) {
    return toRegexRange.cache[cacheKey].result;
  }

  var a = Math.min(min, max);
  var b = Math.max(min, max);

  if (Math.abs(a - b) === 1) {
    var result = min + '|' + max;

    if (opts.capture) {
      return "(".concat(result, ")");
    }

    if (opts.wrap === false) {
      return result;
    }

    return "(?:".concat(result, ")");
  }

  var isPadded = hasPadding(min) || hasPadding(max);
  var state = {
    min: min,
    max: max,
    a: a,
    b: b
  };
  var positives = [];
  var negatives = [];

  if (isPadded) {
    state.isPadded = isPadded;
    state.maxLen = String(state.max).length;
  }

  if (a < 0) {
    var newMin = b < 0 ? Math.abs(b) : 1;
    negatives = splitToPatterns(newMin, Math.abs(a), state, opts);
    a = state.a = 0;
  }

  if (b >= 0) {
    positives = splitToPatterns(a, b, state, opts);
  }

  state.negatives = negatives;
  state.positives = positives;
  state.result = collatePatterns(negatives, positives, opts);

  if (opts.capture === true) {
    state.result = "(".concat(state.result, ")");
  } else if (opts.wrap !== false && positives.length + negatives.length > 1) {
    state.result = "(?:".concat(state.result, ")");
  }

  toRegexRange.cache[cacheKey] = state;
  return state.result;
};

function collatePatterns(neg, pos, options) {
  var onlyNegative = filterPatterns(neg, pos, '-', false, options) || [];
  var onlyPositive = filterPatterns(pos, neg, '', false, options) || [];
  var intersected = filterPatterns(neg, pos, '-?', true, options) || [];
  var subpatterns = onlyNegative.concat(intersected).concat(onlyPositive);
  return subpatterns.join('|');
}

function splitToRanges(min, max) {
  var nines = 1;
  var zeros = 1;
  var stop = countNines(min, nines);
  var stops = new Set([max]);

  while (min <= stop && stop <= max) {
    stops.add(stop);
    nines += 1;
    stop = countNines(min, nines);
  }

  stop = countZeros(max + 1, zeros) - 1;

  while (min < stop && stop <= max) {
    stops.add(stop);
    zeros += 1;
    stop = countZeros(max + 1, zeros) - 1;
  }

  stops = _toConsumableArray(stops);
  stops.sort(compare);
  return stops;
}
/**
 * Convert a range to a regex pattern
 * @param {Number} `start`
 * @param {Number} `stop`
 * @return {String}
 */


function rangeToPattern(start, stop, options) {
  if (start === stop) {
    return {
      pattern: start,
      count: [],
      digits: 0
    };
  }

  var zipped = zip(start, stop);
  var digits = zipped.length;
  var pattern = '';
  var count = 0;

  for (var i = 0; i < digits; i++) {
    var _zipped$i = _slicedToArray(zipped[i], 2),
        startDigit = _zipped$i[0],
        stopDigit = _zipped$i[1];

    if (startDigit === stopDigit) {
      pattern += startDigit;
    } else if (startDigit !== '0' || stopDigit !== '9') {
      pattern += toCharacterClass(startDigit, stopDigit, options);
    } else {
      count++;
    }
  }

  if (count) {
    pattern += options.shorthand === true ? '\\d' : '[0-9]';
  }

  return {
    pattern: pattern,
    count: [count],
    digits: digits
  };
}

function splitToPatterns(min, max, tok, options) {
  var ranges = splitToRanges(min, max);
  var tokens = [];
  var start = min;
  var prev;

  for (var i = 0; i < ranges.length; i++) {
    var _max = ranges[i];
    var obj = rangeToPattern(String(start), String(_max), options);
    var zeros = '';

    if (!tok.isPadded && prev && prev.pattern === obj.pattern) {
      if (prev.count.length > 1) {
        prev.count.pop();
      }

      prev.count.push(obj.count[0]);
      prev.string = prev.pattern + toQuantifier(prev.count);
      start = _max + 1;
      continue;
    }

    if (tok.isPadded) {
      zeros = padZeros(_max, tok, options);
    }

    obj.string = zeros + obj.pattern + toQuantifier(obj.count);
    tokens.push(obj);
    start = _max + 1;
    prev = obj;
  }

  return tokens;
}

function filterPatterns(arr, comparison, prefix, intersection, options) {
  var result = [];

  var _iterator = _createForOfIteratorHelper(arr),
      _step;

  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var ele = _step.value;
      var string = ele.string; // only push if _both_ are negative...

      if (!intersection && !contains(comparison, 'string', string)) {
        result.push(prefix + string);
      } // or _both_ are positive


      if (intersection && contains(comparison, 'string', string)) {
        result.push(prefix + string);
      }
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }

  return result;
}
/**
 * Zip strings
 */


function zip(a, b) {
  var arr = [];

  for (var i = 0; i < a.length; i++) {
    arr.push([a[i], b[i]]);
  }

  return arr;
}

function compare(a, b) {
  return a > b ? 1 : b > a ? -1 : 0;
}

function contains(arr, key, val) {
  return arr.some(function (ele) {
    return ele[key] === val;
  });
}

function countNines(min, len) {
  return Number(String(min).slice(0, -len) + '9'.repeat(len));
}

function countZeros(integer, zeros) {
  return integer - integer % Math.pow(10, zeros);
}

function toQuantifier(digits) {
  var _digits = _slicedToArray(digits, 2),
      _digits$ = _digits[0],
      start = _digits$ === void 0 ? 0 : _digits$,
      _digits$2 = _digits[1],
      stop = _digits$2 === void 0 ? '' : _digits$2;

  if (stop || start > 1) {
    return "{".concat(start + (stop ? ',' + stop : ''), "}");
  }

  return '';
}

function toCharacterClass(a, b, options) {
  return "[".concat(a).concat(b - a === 1 ? '' : '-').concat(b, "]");
}

function hasPadding(str) {
  return /^-?(0+)\d/.test(str);
}

function padZeros(value, tok, options) {
  if (!tok.isPadded) {
    return value;
  }

  var diff = Math.abs(tok.maxLen - String(value).length);
  var relax = options.relaxZeros !== false;

  switch (diff) {
    case 0:
      return '';

    case 1:
      return relax ? '0?' : '0';

    case 2:
      return relax ? '0{0,2}' : '00';

    default:
      {
        return relax ? "0{0,".concat(diff, "}") : "0{".concat(diff, "}");
      }
  }
}
/**
 * Cache
 */


toRegexRange.cache = {};

toRegexRange.clearCache = function () {
  return toRegexRange.cache = {};
};
/**
 * Expose `toRegexRange`
 */


module.exports = toRegexRange;

/***/ }),

/***/ "./node_modules/to-regex-range/node_modules/is-number/index.js":
/*!*********************************************************************!*\
  !*** ./node_modules/to-regex-range/node_modules/is-number/index.js ***!
  \*********************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*!
 * is-number <https://github.com/jonschlinkert/is-number>
 *
 * Copyright (c) 2014-present, Jon Schlinkert.
 * Released under the MIT License.
 */


module.exports = function (num) {
  if (typeof num === 'number') {
    return num - num === 0;
  }

  if (typeof num === 'string' && num.trim() !== '') {
    return Number.isFinite ? Number.isFinite(+num) : isFinite(+num);
  }

  return false;
};

/***/ }),

/***/ "./node_modules/util/node_modules/inherits/inherits_browser.js":
/*!*********************************************************************!*\
  !*** ./node_modules/util/node_modules/inherits/inherits_browser.js ***!
  \*********************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor;

    var TempCtor = function TempCtor() {};

    TempCtor.prototype = superCtor.prototype;
    ctor.prototype = new TempCtor();
    ctor.prototype.constructor = ctor;
  };
}

/***/ }),

/***/ "./node_modules/util/support/isBufferBrowser.js":
/*!******************************************************!*\
  !*** ./node_modules/util/support/isBufferBrowser.js ***!
  \******************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

module.exports = function isBuffer(arg) {
  return arg && _typeof(arg) === 'object' && typeof arg.copy === 'function' && typeof arg.fill === 'function' && typeof arg.readUInt8 === 'function';
};

/***/ }),

/***/ "./node_modules/util/util.js":
/*!***********************************!*\
  !*** ./node_modules/util/util.js ***!
  \***********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(process) {

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.
var getOwnPropertyDescriptors = Object.getOwnPropertyDescriptors || function getOwnPropertyDescriptors(obj) {
  var keys = Object.keys(obj);
  var descriptors = {};

  for (var i = 0; i < keys.length; i++) {
    descriptors[keys[i]] = Object.getOwnPropertyDescriptor(obj, keys[i]);
  }

  return descriptors;
};

var formatRegExp = /%[sdj%]/g;

exports.format = function (f) {
  if (!isString(f)) {
    var objects = [];

    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }

    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function (x) {
    if (x === '%%') return '%';
    if (i >= len) return x;

    switch (x) {
      case '%s':
        return String(args[i++]);

      case '%d':
        return Number(args[i++]);

      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }

      default:
        return x;
    }
  });

  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }

  return str;
}; // Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.


exports.deprecate = function (fn, msg) {
  if (typeof process !== 'undefined' && process.noDeprecation === true) {
    return fn;
  } // Allow for deprecating things in the process of starting up.


  if (typeof process === 'undefined') {
    return function () {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  var warned = false;

  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }

      warned = true;
    }

    return fn.apply(this, arguments);
  }

  return deprecated;
};

var debugs = {};
var debugEnviron;

exports.debuglog = function (set) {
  if (isUndefined(debugEnviron)) debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();

  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;

      debugs[set] = function () {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function () {};
    }
  }

  return debugs[set];
};
/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */

/* legacy: obj, showHidden, depth, colors*/


function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  }; // legacy...

  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];

  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  } // set default options


  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}

exports.inspect = inspect; // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics

inspect.colors = {
  'bold': [1, 22],
  'italic': [3, 23],
  'underline': [4, 24],
  'inverse': [7, 27],
  'white': [37, 39],
  'grey': [90, 39],
  'black': [30, 39],
  'blue': [34, 39],
  'cyan': [36, 39],
  'green': [32, 39],
  'magenta': [35, 39],
  'red': [31, 39],
  'yellow': [33, 39]
}; // Don't use 'blue' not visible on cmd.exe

inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};

function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return "\x1B[" + inspect.colors[style][0] + 'm' + str + "\x1B[" + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}

function stylizeNoColor(str, styleType) {
  return str;
}

function arrayToHash(array) {
  var hash = {};
  array.forEach(function (val, idx) {
    hash[val] = true;
  });
  return hash;
}

function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect && value && isFunction(value.inspect) && // Filter out the util module, it's inspect function is special
  value.inspect !== exports.inspect && // Also filter out any prototype objects using the circular check.
  !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);

    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }

    return ret;
  } // Primitive types cannot have properties


  var primitive = formatPrimitive(ctx, value);

  if (primitive) {
    return primitive;
  } // Look up the keys of the object.


  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  } // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx


  if (isError(value) && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  } // Some type of object without properties can be shortcutted.


  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }

    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }

    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }

    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '',
      array = false,
      braces = ['{', '}']; // Make Array say that they are Array

  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  } // Make functions say that they are functions


  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  } // Make RegExps say that they are RegExps


  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  } // Make dates with properties first say the date


  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  } // Make error with message first say the error


  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);
  var output;

  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function (key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();
  return reduceToSingleString(output, base, braces);
}

function formatPrimitive(ctx, value) {
  if (isUndefined(value)) return ctx.stylize('undefined', 'undefined');

  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '').replace(/'/g, "\\'").replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }

  if (isNumber(value)) return ctx.stylize('' + value, 'number');
  if (isBoolean(value)) return ctx.stylize('' + value, 'boolean'); // For some reason typeof null is "object", so special case here.

  if (isNull(value)) return ctx.stylize('null', 'null');
}

function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}

function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];

  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, String(i), true));
    } else {
      output.push('');
    }
  }

  keys.forEach(function (key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, key, true));
    }
  });
  return output;
}

function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || {
    value: value[key]
  };

  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }

  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }

  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }

      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function (line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function (line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }

  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }

    name = JSON.stringify('' + key);

    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'").replace(/\\"/g, '"').replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}

function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function (prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] + (base === '' ? '' : base + '\n ') + ' ' + output.join(',\n  ') + ' ' + braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
} // NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.


function isArray(ar) {
  return Array.isArray(ar);
}

exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}

exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}

exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}

exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}

exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}

exports.isString = isString;

function isSymbol(arg) {
  return _typeof(arg) === 'symbol';
}

exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}

exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}

exports.isRegExp = isRegExp;

function isObject(arg) {
  return _typeof(arg) === 'object' && arg !== null;
}

exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}

exports.isDate = isDate;

function isError(e) {
  return isObject(e) && (objectToString(e) === '[object Error]' || e instanceof Error);
}

exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}

exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null || typeof arg === 'boolean' || typeof arg === 'number' || typeof arg === 'string' || _typeof(arg) === 'symbol' || // ES6 symbol
  typeof arg === 'undefined';
}

exports.isPrimitive = isPrimitive;
exports.isBuffer = __webpack_require__(/*! ./support/isBuffer */ "./node_modules/util/support/isBufferBrowser.js");

function objectToString(o) {
  return Object.prototype.toString.call(o);
}

function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}

var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; // 26 Feb 16:19:34

function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
} // log is just a thin wrapper to console.log that prepends a timestamp


exports.log = function () {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};
/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */


exports.inherits = __webpack_require__(/*! inherits */ "./node_modules/util/node_modules/inherits/inherits_browser.js");

exports._extend = function (origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;
  var keys = Object.keys(add);
  var i = keys.length;

  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }

  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

var kCustomPromisifiedSymbol = typeof Symbol !== 'undefined' ? Symbol('util.promisify.custom') : undefined;

exports.promisify = function promisify(original) {
  if (typeof original !== 'function') throw new TypeError('The "original" argument must be of type Function');

  if (kCustomPromisifiedSymbol && original[kCustomPromisifiedSymbol]) {
    var fn = original[kCustomPromisifiedSymbol];

    if (typeof fn !== 'function') {
      throw new TypeError('The "util.promisify.custom" argument must be of type Function');
    }

    Object.defineProperty(fn, kCustomPromisifiedSymbol, {
      value: fn,
      enumerable: false,
      writable: false,
      configurable: true
    });
    return fn;
  }

  function fn() {
    var promiseResolve, promiseReject;
    var promise = new Promise(function (resolve, reject) {
      promiseResolve = resolve;
      promiseReject = reject;
    });
    var args = [];

    for (var i = 0; i < arguments.length; i++) {
      args.push(arguments[i]);
    }

    args.push(function (err, value) {
      if (err) {
        promiseReject(err);
      } else {
        promiseResolve(value);
      }
    });

    try {
      original.apply(this, args);
    } catch (err) {
      promiseReject(err);
    }

    return promise;
  }

  Object.setPrototypeOf(fn, Object.getPrototypeOf(original));
  if (kCustomPromisifiedSymbol) Object.defineProperty(fn, kCustomPromisifiedSymbol, {
    value: fn,
    enumerable: false,
    writable: false,
    configurable: true
  });
  return Object.defineProperties(fn, getOwnPropertyDescriptors(original));
};

exports.promisify.custom = kCustomPromisifiedSymbol;

function callbackifyOnRejected(reason, cb) {
  // `!reason` guard inspired by bluebird (Ref: https://goo.gl/t5IS6M).
  // Because `null` is a special error value in callbacks which means "no error
  // occurred", we error-wrap so the callback consumer can distinguish between
  // "the promise rejected with null" or "the promise fulfilled with undefined".
  if (!reason) {
    var newReason = new Error('Promise was rejected with a falsy value');
    newReason.reason = reason;
    reason = newReason;
  }

  return cb(reason);
}

function callbackify(original) {
  if (typeof original !== 'function') {
    throw new TypeError('The "original" argument must be of type Function');
  } // We DO NOT return the promise as it gives the user a false sense that
  // the promise is actually somehow related to the callback's execution
  // and that the callback throwing will reject the promise.


  function callbackified() {
    var args = [];

    for (var i = 0; i < arguments.length; i++) {
      args.push(arguments[i]);
    }

    var maybeCb = args.pop();

    if (typeof maybeCb !== 'function') {
      throw new TypeError('The last argument must be of type Function');
    }

    var self = this;

    var cb = function cb() {
      return maybeCb.apply(self, arguments);
    }; // In true node style we process the callback on `nextTick` with all the
    // implications (stack, `uncaughtException`, `async_hooks`)


    original.apply(this, args).then(function (ret) {
      process.nextTick(cb, null, ret);
    }, function (rej) {
      process.nextTick(callbackifyOnRejected, rej, cb);
    });
  }

  Object.setPrototypeOf(callbackified, Object.getPrototypeOf(original));
  Object.defineProperties(callbackified, getOwnPropertyDescriptors(original));
  return callbackified;
}

exports.callbackify = callbackify;
/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../process/browser.js */ "./node_modules/process/browser.js")))

/***/ }),

/***/ "./node_modules/webpack/buildin/global.js":
/*!***********************************!*\
  !*** (webpack)/buildin/global.js ***!
  \***********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

var g; // This works in non-strict mode

g = function () {
  return this;
}();

try {
  // This works if eval is allowed (see CSP)
  g = g || new Function("return this")();
} catch (e) {
  // This works if the window reference is available
  if ((typeof window === "undefined" ? "undefined" : _typeof(window)) === "object") g = window;
} // g can still be undefined, but nothing to do about it...
// We return undefined, instead of nothing here, so it's
// easier to handle this case. if(!global) { ...}


module.exports = g;

/***/ }),

/***/ "./node_modules/webpack/buildin/module.js":
/*!***********************************!*\
  !*** (webpack)/buildin/module.js ***!
  \***********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = function (module) {
  if (!module.webpackPolyfill) {
    module.deprecate = function () {};

    module.paths = []; // module.parent = undefined by default

    if (!module.children) module.children = [];
    Object.defineProperty(module, "loaded", {
      enumerable: true,
      get: function get() {
        return module.l;
      }
    });
    Object.defineProperty(module, "id", {
      enumerable: true,
      get: function get() {
        return module.i;
      }
    });
    module.webpackPolyfill = 1;
  }

  return module;
};

/***/ }),

/***/ "./packages/diff-sequences/build/index.js":
/*!************************************************!*\
  !*** ./packages/diff-sequences/build/index.js ***!
  \************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.default = void 0;
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
// This diff-sequences package implements the linear space variation in
// An O(ND) Difference Algorithm and Its Variations by Eugene W. Myers
// Relationship in notation between Myers paper and this package:
// A is a
// N is aLength, aEnd - aStart, and so on
// x is aIndex, aFirst, aLast, and so on
// B is b
// M is bLength, bEnd - bStart, and so on
// y is bIndex, bFirst, bLast, and so on
// Δ = N - M is negative of baDeltaLength = bLength - aLength
// D is d
// k is kF
// k + Δ is kF = kR - baDeltaLength
// V is aIndexesF or aIndexesR (see comment below about Indexes type)
// index intervals [1, N] and [1, M] are [0, aLength) and [0, bLength)
// starting point in forward direction (0, 0) is (-1, -1)
// starting point in reverse direction (N + 1, M + 1) is (aLength, bLength)
// The “edit graph” for sequences a and b corresponds to items:
// in a on the horizontal axis
// in b on the vertical axis
//
// Given a-coordinate of a point in a diagonal, you can compute b-coordinate.
//
// Forward diagonals kF:
// zero diagonal intersects top left corner
// positive diagonals intersect top edge
// negative diagonals insersect left edge
//
// Reverse diagonals kR:
// zero diagonal intersects bottom right corner
// positive diagonals intersect right edge
// negative diagonals intersect bottom edge
// The graph contains a directed acyclic graph of edges:
// horizontal: delete an item from a
// vertical: insert an item from b
// diagonal: common item in a and b
//
// The algorithm solves dual problems in the graph analogy:
// Find longest common subsequence: path with maximum number of diagonal edges
// Find shortest edit script: path with minimum number of non-diagonal edges
// Input callback function compares items at indexes in the sequences.
// Output callback function receives the number of adjacent items
// and starting indexes of each common subsequence.
// Either original functions or wrapped to swap indexes if graph is transposed.
// Indexes in sequence a of last point of forward or reverse paths in graph.
// Myers algorithm indexes by diagonal k which for negative is bad deopt in V8.
// This package indexes by iF and iR which are greater than or equal to zero.
// and also updates the index arrays in place to cut memory in half.
// kF = 2 * iF - d
// kR = d - 2 * iR
// Division of index intervals in sequences a and b at the middle change.
// Invariant: intervals do not have common items at the start or end.

var pkg = 'diff-sequences'; // for error messages

var NOT_YET_SET = 0; // small int instead of undefined to avoid deopt in V8
// Return the number of common items that follow in forward direction.
// The length of what Myers paper calls a “snake” in a forward path.

var countCommonItemsF = function countCommonItemsF(aIndex, aEnd, bIndex, bEnd, isCommon) {
  var nCommon = 0;

  while (aIndex < aEnd && bIndex < bEnd && isCommon(aIndex, bIndex)) {
    aIndex += 1;
    bIndex += 1;
    nCommon += 1;
  }

  return nCommon;
}; // Return the number of common items that precede in reverse direction.
// The length of what Myers paper calls a “snake” in a reverse path.


var countCommonItemsR = function countCommonItemsR(aStart, aIndex, bStart, bIndex, isCommon) {
  var nCommon = 0;

  while (aStart <= aIndex && bStart <= bIndex && isCommon(aIndex, bIndex)) {
    aIndex -= 1;
    bIndex -= 1;
    nCommon += 1;
  }

  return nCommon;
}; // A simple function to extend forward paths from (d - 1) to d changes
// when forward and reverse paths cannot yet overlap.


var extendPathsF = function extendPathsF(d, aEnd, bEnd, bF, isCommon, aIndexesF, iMaxF) {
  // Unroll the first iteration.
  var iF = 0;
  var kF = -d; // kF = 2 * iF - d

  var aFirst = aIndexesF[iF]; // in first iteration always insert

  var aIndexPrev1 = aFirst; // prev value of [iF - 1] in next iteration

  aIndexesF[iF] += countCommonItemsF(aFirst + 1, aEnd, bF + aFirst - kF + 1, bEnd, isCommon); // Optimization: skip diagonals in which paths cannot ever overlap.

  var nF = d < iMaxF ? d : iMaxF; // The diagonals kF are odd when d is odd and even when d is even.

  for (iF += 1, kF += 2; iF <= nF; iF += 1, kF += 2) {
    // To get first point of path segment, move one change in forward direction
    // from last point of previous path segment in an adjacent diagonal.
    // In last possible iteration when iF === d and kF === d always delete.
    if (iF !== d && aIndexPrev1 < aIndexesF[iF]) {
      aFirst = aIndexesF[iF]; // vertical to insert from b
    } else {
      aFirst = aIndexPrev1 + 1; // horizontal to delete from a

      if (aEnd <= aFirst) {
        // Optimization: delete moved past right of graph.
        return iF - 1;
      }
    } // To get last point of path segment, move along diagonal of common items.


    aIndexPrev1 = aIndexesF[iF];
    aIndexesF[iF] = aFirst + countCommonItemsF(aFirst + 1, aEnd, bF + aFirst - kF + 1, bEnd, isCommon);
  }

  return iMaxF;
}; // A simple function to extend reverse paths from (d - 1) to d changes
// when reverse and forward paths cannot yet overlap.


var extendPathsR = function extendPathsR(d, aStart, bStart, bR, isCommon, aIndexesR, iMaxR) {
  // Unroll the first iteration.
  var iR = 0;
  var kR = d; // kR = d - 2 * iR

  var aFirst = aIndexesR[iR]; // in first iteration always insert

  var aIndexPrev1 = aFirst; // prev value of [iR - 1] in next iteration

  aIndexesR[iR] -= countCommonItemsR(aStart, aFirst - 1, bStart, bR + aFirst - kR - 1, isCommon); // Optimization: skip diagonals in which paths cannot ever overlap.

  var nR = d < iMaxR ? d : iMaxR; // The diagonals kR are odd when d is odd and even when d is even.

  for (iR += 1, kR -= 2; iR <= nR; iR += 1, kR -= 2) {
    // To get first point of path segment, move one change in reverse direction
    // from last point of previous path segment in an adjacent diagonal.
    // In last possible iteration when iR === d and kR === -d always delete.
    if (iR !== d && aIndexesR[iR] < aIndexPrev1) {
      aFirst = aIndexesR[iR]; // vertical to insert from b
    } else {
      aFirst = aIndexPrev1 - 1; // horizontal to delete from a

      if (aFirst < aStart) {
        // Optimization: delete moved past left of graph.
        return iR - 1;
      }
    } // To get last point of path segment, move along diagonal of common items.


    aIndexPrev1 = aIndexesR[iR];
    aIndexesR[iR] = aFirst - countCommonItemsR(aStart, aFirst - 1, bStart, bR + aFirst - kR - 1, isCommon);
  }

  return iMaxR;
}; // A complete function to extend forward paths from (d - 1) to d changes.
// Return true if a path overlaps reverse path of (d - 1) changes in its diagonal.


var extendOverlappablePathsF = function extendOverlappablePathsF(d, aStart, aEnd, bStart, bEnd, isCommon, aIndexesF, iMaxF, aIndexesR, iMaxR, division) {
  var bF = bStart - aStart; // bIndex = bF + aIndex - kF

  var aLength = aEnd - aStart;
  var bLength = bEnd - bStart;
  var baDeltaLength = bLength - aLength; // kF = kR - baDeltaLength
  // Range of diagonals in which forward and reverse paths might overlap.

  var kMinOverlapF = -baDeltaLength - (d - 1); // -(d - 1) <= kR

  var kMaxOverlapF = -baDeltaLength + (d - 1); // kR <= (d - 1)

  var aIndexPrev1 = NOT_YET_SET; // prev value of [iF - 1] in next iteration
  // Optimization: skip diagonals in which paths cannot ever overlap.

  var nF = d < iMaxF ? d : iMaxF; // The diagonals kF = 2 * iF - d are odd when d is odd and even when d is even.

  for (var iF = 0, kF = -d; iF <= nF; iF += 1, kF += 2) {
    // To get first point of path segment, move one change in forward direction
    // from last point of previous path segment in an adjacent diagonal.
    // In first iteration when iF === 0 and kF === -d always insert.
    // In last possible iteration when iF === d and kF === d always delete.
    var insert = iF === 0 || iF !== d && aIndexPrev1 < aIndexesF[iF];
    var aLastPrev = insert ? aIndexesF[iF] : aIndexPrev1;
    var aFirst = insert ? aLastPrev // vertical to insert from b
    : aLastPrev + 1; // horizontal to delete from a
    // To get last point of path segment, move along diagonal of common items.

    var bFirst = bF + aFirst - kF;
    var nCommonF = countCommonItemsF(aFirst + 1, aEnd, bFirst + 1, bEnd, isCommon);
    var aLast = aFirst + nCommonF;
    aIndexPrev1 = aIndexesF[iF];
    aIndexesF[iF] = aLast;

    if (kMinOverlapF <= kF && kF <= kMaxOverlapF) {
      // Solve for iR of reverse path with (d - 1) changes in diagonal kF:
      // kR = kF + baDeltaLength
      // kR = (d - 1) - 2 * iR
      var iR = (d - 1 - (kF + baDeltaLength)) / 2; // If this forward path overlaps the reverse path in this diagonal,
      // then this is the middle change of the index intervals.

      if (iR <= iMaxR && aIndexesR[iR] - 1 <= aLast) {
        // Unlike the Myers algorithm which finds only the middle “snake”
        // this package can find two common subsequences per division.
        // Last point of previous path segment is on an adjacent diagonal.
        var bLastPrev = bF + aLastPrev - (insert ? kF + 1 : kF - 1); // Because of invariant that intervals preceding the middle change
        // cannot have common items at the end,
        // move in reverse direction along a diagonal of common items.

        var nCommonR = countCommonItemsR(aStart, aLastPrev, bStart, bLastPrev, isCommon);
        var aIndexPrevFirst = aLastPrev - nCommonR;
        var bIndexPrevFirst = bLastPrev - nCommonR;
        var aEndPreceding = aIndexPrevFirst + 1;
        var bEndPreceding = bIndexPrevFirst + 1;
        division.nChangePreceding = d - 1;

        if (d - 1 === aEndPreceding + bEndPreceding - aStart - bStart) {
          // Optimization: number of preceding changes in forward direction
          // is equal to number of items in preceding interval,
          // therefore it cannot contain any common items.
          division.aEndPreceding = aStart;
          division.bEndPreceding = bStart;
        } else {
          division.aEndPreceding = aEndPreceding;
          division.bEndPreceding = bEndPreceding;
        }

        division.nCommonPreceding = nCommonR;

        if (nCommonR !== 0) {
          division.aCommonPreceding = aEndPreceding;
          division.bCommonPreceding = bEndPreceding;
        }

        division.nCommonFollowing = nCommonF;

        if (nCommonF !== 0) {
          division.aCommonFollowing = aFirst + 1;
          division.bCommonFollowing = bFirst + 1;
        }

        var aStartFollowing = aLast + 1;
        var bStartFollowing = bFirst + nCommonF + 1;
        division.nChangeFollowing = d - 1;

        if (d - 1 === aEnd + bEnd - aStartFollowing - bStartFollowing) {
          // Optimization: number of changes in reverse direction
          // is equal to number of items in following interval,
          // therefore it cannot contain any common items.
          division.aStartFollowing = aEnd;
          division.bStartFollowing = bEnd;
        } else {
          division.aStartFollowing = aStartFollowing;
          division.bStartFollowing = bStartFollowing;
        }

        return true;
      }
    }
  }

  return false;
}; // A complete function to extend reverse paths from (d - 1) to d changes.
// Return true if a path overlaps forward path of d changes in its diagonal.


var extendOverlappablePathsR = function extendOverlappablePathsR(d, aStart, aEnd, bStart, bEnd, isCommon, aIndexesF, iMaxF, aIndexesR, iMaxR, division) {
  var bR = bEnd - aEnd; // bIndex = bR + aIndex - kR

  var aLength = aEnd - aStart;
  var bLength = bEnd - bStart;
  var baDeltaLength = bLength - aLength; // kR = kF + baDeltaLength
  // Range of diagonals in which forward and reverse paths might overlap.

  var kMinOverlapR = baDeltaLength - d; // -d <= kF

  var kMaxOverlapR = baDeltaLength + d; // kF <= d

  var aIndexPrev1 = NOT_YET_SET; // prev value of [iR - 1] in next iteration
  // Optimization: skip diagonals in which paths cannot ever overlap.

  var nR = d < iMaxR ? d : iMaxR; // The diagonals kR = d - 2 * iR are odd when d is odd and even when d is even.

  for (var iR = 0, kR = d; iR <= nR; iR += 1, kR -= 2) {
    // To get first point of path segment, move one change in reverse direction
    // from last point of previous path segment in an adjacent diagonal.
    // In first iteration when iR === 0 and kR === d always insert.
    // In last possible iteration when iR === d and kR === -d always delete.
    var insert = iR === 0 || iR !== d && aIndexesR[iR] < aIndexPrev1;
    var aLastPrev = insert ? aIndexesR[iR] : aIndexPrev1;
    var aFirst = insert ? aLastPrev // vertical to insert from b
    : aLastPrev - 1; // horizontal to delete from a
    // To get last point of path segment, move along diagonal of common items.

    var bFirst = bR + aFirst - kR;
    var nCommonR = countCommonItemsR(aStart, aFirst - 1, bStart, bFirst - 1, isCommon);
    var aLast = aFirst - nCommonR;
    aIndexPrev1 = aIndexesR[iR];
    aIndexesR[iR] = aLast;

    if (kMinOverlapR <= kR && kR <= kMaxOverlapR) {
      // Solve for iF of forward path with d changes in diagonal kR:
      // kF = kR - baDeltaLength
      // kF = 2 * iF - d
      var iF = (d + (kR - baDeltaLength)) / 2; // If this reverse path overlaps the forward path in this diagonal,
      // then this is a middle change of the index intervals.

      if (iF <= iMaxF && aLast - 1 <= aIndexesF[iF]) {
        var bLast = bFirst - nCommonR;
        division.nChangePreceding = d;

        if (d === aLast + bLast - aStart - bStart) {
          // Optimization: number of changes in reverse direction
          // is equal to number of items in preceding interval,
          // therefore it cannot contain any common items.
          division.aEndPreceding = aStart;
          division.bEndPreceding = bStart;
        } else {
          division.aEndPreceding = aLast;
          division.bEndPreceding = bLast;
        }

        division.nCommonPreceding = nCommonR;

        if (nCommonR !== 0) {
          // The last point of reverse path segment is start of common subsequence.
          division.aCommonPreceding = aLast;
          division.bCommonPreceding = bLast;
        }

        division.nChangeFollowing = d - 1;

        if (d === 1) {
          // There is no previous path segment.
          division.nCommonFollowing = 0;
          division.aStartFollowing = aEnd;
          division.bStartFollowing = bEnd;
        } else {
          // Unlike the Myers algorithm which finds only the middle “snake”
          // this package can find two common subsequences per division.
          // Last point of previous path segment is on an adjacent diagonal.
          var bLastPrev = bR + aLastPrev - (insert ? kR - 1 : kR + 1); // Because of invariant that intervals following the middle change
          // cannot have common items at the start,
          // move in forward direction along a diagonal of common items.

          var nCommonF = countCommonItemsF(aLastPrev, aEnd, bLastPrev, bEnd, isCommon);
          division.nCommonFollowing = nCommonF;

          if (nCommonF !== 0) {
            // The last point of reverse path segment is start of common subsequence.
            division.aCommonFollowing = aLastPrev;
            division.bCommonFollowing = bLastPrev;
          }

          var aStartFollowing = aLastPrev + nCommonF; // aFirstPrev

          var bStartFollowing = bLastPrev + nCommonF; // bFirstPrev

          if (d - 1 === aEnd + bEnd - aStartFollowing - bStartFollowing) {
            // Optimization: number of changes in forward direction
            // is equal to number of items in following interval,
            // therefore it cannot contain any common items.
            division.aStartFollowing = aEnd;
            division.bStartFollowing = bEnd;
          } else {
            division.aStartFollowing = aStartFollowing;
            division.bStartFollowing = bStartFollowing;
          }
        }

        return true;
      }
    }
  }

  return false;
}; // Given index intervals and input function to compare items at indexes,
// divide at the middle change.
//
// DO NOT CALL if start === end, because interval cannot contain common items
// and because this function will throw the “no overlap” error.


var divide = function divide(nChange, aStart, aEnd, bStart, bEnd, isCommon, aIndexesF, aIndexesR, division // output
) {
  var bF = bStart - aStart; // bIndex = bF + aIndex - kF

  var bR = bEnd - aEnd; // bIndex = bR + aIndex - kR

  var aLength = aEnd - aStart;
  var bLength = bEnd - bStart; // Because graph has square or portrait orientation,
  // length difference is minimum number of items to insert from b.
  // Corresponding forward and reverse diagonals in graph
  // depend on length difference of the sequences:
  // kF = kR - baDeltaLength
  // kR = kF + baDeltaLength

  var baDeltaLength = bLength - aLength; // Optimization: max diagonal in graph intersects corner of shorter side.

  var iMaxF = aLength;
  var iMaxR = aLength; // Initialize no changes yet in forward or reverse direction:

  aIndexesF[0] = aStart - 1; // at open start of interval, outside closed start

  aIndexesR[0] = aEnd; // at open end of interval

  if (baDeltaLength % 2 === 0) {
    // The number of changes in paths is 2 * d if length difference is even.
    var dMin = (nChange || baDeltaLength) / 2;
    var dMax = (aLength + bLength) / 2;

    for (var d = 1; d <= dMax; d += 1) {
      iMaxF = extendPathsF(d, aEnd, bEnd, bF, isCommon, aIndexesF, iMaxF);

      if (d < dMin) {
        iMaxR = extendPathsR(d, aStart, bStart, bR, isCommon, aIndexesR, iMaxR);
      } else if ( // If a reverse path overlaps a forward path in the same diagonal,
      // return a division of the index intervals at the middle change.
      extendOverlappablePathsR(d, aStart, aEnd, bStart, bEnd, isCommon, aIndexesF, iMaxF, aIndexesR, iMaxR, division)) {
        return;
      }
    }
  } else {
    // The number of changes in paths is 2 * d - 1 if length difference is odd.
    var _dMin = ((nChange || baDeltaLength) + 1) / 2;

    var _dMax = (aLength + bLength + 1) / 2; // Unroll first half iteration so loop extends the relevant pairs of paths.
    // Because of invariant that intervals have no common items at start or end,
    // and limitation not to call divide with empty intervals,
    // therefore it cannot be called if a forward path with one change
    // would overlap a reverse path with no changes, even if dMin === 1.


    var _d = 1;
    iMaxF = extendPathsF(_d, aEnd, bEnd, bF, isCommon, aIndexesF, iMaxF);

    for (_d += 1; _d <= _dMax; _d += 1) {
      iMaxR = extendPathsR(_d - 1, aStart, bStart, bR, isCommon, aIndexesR, iMaxR);

      if (_d < _dMin) {
        iMaxF = extendPathsF(_d, aEnd, bEnd, bF, isCommon, aIndexesF, iMaxF);
      } else if ( // If a forward path overlaps a reverse path in the same diagonal,
      // return a division of the index intervals at the middle change.
      extendOverlappablePathsF(_d, aStart, aEnd, bStart, bEnd, isCommon, aIndexesF, iMaxF, aIndexesR, iMaxR, division)) {
        return;
      }
    }
  }
  /* istanbul ignore next */


  throw new Error("".concat(pkg, ": no overlap aStart=").concat(aStart, " aEnd=").concat(aEnd, " bStart=").concat(bStart, " bEnd=").concat(bEnd));
}; // Given index intervals and input function to compare items at indexes,
// return by output function the number of adjacent items and starting indexes
// of each common subsequence. Divide and conquer with only linear space.
//
// The index intervals are half open [start, end) like array slice method.
// DO NOT CALL if start === end, because interval cannot contain common items
// and because divide function will throw the “no overlap” error.


var findSubsequences = function findSubsequences(nChange, aStart, aEnd, bStart, bEnd, transposed, callbacks, aIndexesF, aIndexesR, division // temporary memory, not input nor output
) {
  if (bEnd - bStart < aEnd - aStart) {
    // Transpose graph so it has portrait instead of landscape orientation.
    // Always compare shorter to longer sequence for consistency and optimization.
    transposed = !transposed;

    if (transposed && callbacks.length === 1) {
      // Lazily wrap callback functions to swap args if graph is transposed.
      var _callbacks$ = callbacks[0],
          _foundSubsequence = _callbacks$.foundSubsequence,
          _isCommon = _callbacks$.isCommon;
      callbacks[1] = {
        foundSubsequence: function foundSubsequence(nCommon, bCommon, aCommon) {
          _foundSubsequence(nCommon, aCommon, bCommon);
        },
        isCommon: function isCommon(bIndex, aIndex) {
          return _isCommon(aIndex, bIndex);
        }
      };
    }

    var tStart = aStart;
    var tEnd = aEnd;
    aStart = bStart;
    aEnd = bEnd;
    bStart = tStart;
    bEnd = tEnd;
  }

  var _callbacks = callbacks[transposed ? 1 : 0],
      foundSubsequence = _callbacks.foundSubsequence,
      isCommon = _callbacks.isCommon; // Divide the index intervals at the middle change.

  divide(nChange, aStart, aEnd, bStart, bEnd, isCommon, aIndexesF, aIndexesR, division);
  var nChangePreceding = division.nChangePreceding,
      aEndPreceding = division.aEndPreceding,
      bEndPreceding = division.bEndPreceding,
      nCommonPreceding = division.nCommonPreceding,
      aCommonPreceding = division.aCommonPreceding,
      bCommonPreceding = division.bCommonPreceding,
      nCommonFollowing = division.nCommonFollowing,
      aCommonFollowing = division.aCommonFollowing,
      bCommonFollowing = division.bCommonFollowing,
      nChangeFollowing = division.nChangeFollowing,
      aStartFollowing = division.aStartFollowing,
      bStartFollowing = division.bStartFollowing; // Unless either index interval is empty, they might contain common items.

  if (aStart < aEndPreceding && bStart < bEndPreceding) {
    // Recursely find and return common subsequences preceding the division.
    findSubsequences(nChangePreceding, aStart, aEndPreceding, bStart, bEndPreceding, transposed, callbacks, aIndexesF, aIndexesR, division);
  } // Return common subsequences that are adjacent to the middle change.


  if (nCommonPreceding !== 0) {
    foundSubsequence(nCommonPreceding, aCommonPreceding, bCommonPreceding);
  }

  if (nCommonFollowing !== 0) {
    foundSubsequence(nCommonFollowing, aCommonFollowing, bCommonFollowing);
  } // Unless either index interval is empty, they might contain common items.


  if (aStartFollowing < aEnd && bStartFollowing < bEnd) {
    // Recursely find and return common subsequences following the division.
    findSubsequences(nChangeFollowing, aStartFollowing, aEnd, bStartFollowing, bEnd, transposed, callbacks, aIndexesF, aIndexesR, division);
  }
};

var validateLength = function validateLength(name, arg) {
  var type = _typeof(arg);

  if (type !== 'number') {
    throw new TypeError("".concat(pkg, ": ").concat(name, " typeof ").concat(type, " is not a number"));
  }

  if (!Number.isSafeInteger(arg)) {
    throw new RangeError("".concat(pkg, ": ").concat(name, " value ").concat(arg, " is not a safe integer"));
  }

  if (arg < 0) {
    throw new RangeError("".concat(pkg, ": ").concat(name, " value ").concat(arg, " is a negative integer"));
  }
};

var validateCallback = function validateCallback(name, arg) {
  var type = _typeof(arg);

  if (type !== 'function') {
    throw new TypeError("".concat(pkg, ": ").concat(name, " typeof ").concat(type, " is not a function"));
  }
}; // Compare items in two sequences to find a longest common subsequence.
// Given lengths of sequences and input function to compare items at indexes,
// return by output function the number of adjacent items and starting indexes
// of each common subsequence.


var _default = function _default(aLength, bLength, isCommon, foundSubsequence) {
  validateLength('aLength', aLength);
  validateLength('bLength', bLength);
  validateCallback('isCommon', isCommon);
  validateCallback('foundSubsequence', foundSubsequence); // Count common items from the start in the forward direction.

  var nCommonF = countCommonItemsF(0, aLength, 0, bLength, isCommon);

  if (nCommonF !== 0) {
    foundSubsequence(nCommonF, 0, 0);
  } // Unless both sequences consist of common items only,
  // find common items in the half-trimmed index intervals.


  if (aLength !== nCommonF || bLength !== nCommonF) {
    // Invariant: intervals do not have common items at the start.
    // The start of an index interval is closed like array slice method.
    var aStart = nCommonF;
    var bStart = nCommonF; // Count common items from the end in the reverse direction.

    var nCommonR = countCommonItemsR(aStart, aLength - 1, bStart, bLength - 1, isCommon); // Invariant: intervals do not have common items at the end.
    // The end of an index interval is open like array slice method.

    var aEnd = aLength - nCommonR;
    var bEnd = bLength - nCommonR; // Unless one sequence consists of common items only,
    // therefore the other trimmed index interval consists of changes only,
    // find common items in the trimmed index intervals.

    var nCommonFR = nCommonF + nCommonR;

    if (aLength !== nCommonFR && bLength !== nCommonFR) {
      var nChange = 0; // number of change items is not yet known

      var transposed = false; // call the original unwrapped functions

      var callbacks = [{
        foundSubsequence: foundSubsequence,
        isCommon: isCommon
      }]; // Indexes in sequence a of last points in furthest reaching paths
      // from outside the start at top left in the forward direction:

      var aIndexesF = [NOT_YET_SET]; // from the end at bottom right in the reverse direction:

      var aIndexesR = [NOT_YET_SET]; // Initialize one object as output of all calls to divide function.

      var division = {
        aCommonFollowing: NOT_YET_SET,
        aCommonPreceding: NOT_YET_SET,
        aEndPreceding: NOT_YET_SET,
        aStartFollowing: NOT_YET_SET,
        bCommonFollowing: NOT_YET_SET,
        bCommonPreceding: NOT_YET_SET,
        bEndPreceding: NOT_YET_SET,
        bStartFollowing: NOT_YET_SET,
        nChangeFollowing: NOT_YET_SET,
        nChangePreceding: NOT_YET_SET,
        nCommonFollowing: NOT_YET_SET,
        nCommonPreceding: NOT_YET_SET
      }; // Find and return common subsequences in the trimmed index intervals.

      findSubsequences(nChange, aStart, aEnd, bStart, bEnd, transposed, callbacks, aIndexesF, aIndexesR, division);
    }

    if (nCommonR !== 0) {
      foundSubsequence(nCommonR, aEnd, bEnd);
    }
  }
};

exports.default = _default;

/***/ }),

/***/ "./packages/expect/build/fakeChalk.js":
/*!********************************************!*\
  !*** ./packages/expect/build/fakeChalk.js ***!
  \********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var _ansiStyles = _interopRequireDefault(__webpack_require__(/*! ansi-styles */ "./node_modules/ansi-styles/index.js"));

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : {
    default: obj
  };
}
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */


var returnInput = function returnInput(str) {
  return str;
};

var allColorsAsFunc = Object.keys(_ansiStyles.default).map(function (style) {
  return _defineProperty({}, style, returnInput);
}).reduce(function (acc, cur) {
  return Object.assign(acc, cur);
});
Object.keys(allColorsAsFunc).map(function (color) {
  return allColorsAsFunc[color];
}).forEach(function (style) {
  Object.assign(style, allColorsAsFunc);
  Object.assign(returnInput, style);
});
module.exports = allColorsAsFunc;

/***/ }),

/***/ "./packages/expect/src/asymmetricMatchers.ts":
/*!***************************************************!*\
  !*** ./packages/expect/src/asymmetricMatchers.ts ***!
  \***************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.stringNotMatching = exports.stringMatching = exports.stringNotContaining = exports.stringContaining = exports.objectNotContaining = exports.objectContaining = exports.arrayNotContaining = exports.arrayContaining = exports.anything = exports.any = exports.AsymmetricMatcher = void 0;

var _jasmineUtils = __webpack_require__(/*! ./jasmineUtils */ "./packages/expect/src/jasmineUtils.ts");

var _utils = __webpack_require__(/*! ./utils */ "./packages/expect/src/utils.ts");

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _createSuper(Derived) { return function () { var Super = _getPrototypeOf(Derived), result; if (_isNativeReflectConstruct()) { var NewTarget = _getPrototypeOf(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn(this, result); }; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Date.prototype.toString.call(Reflect.construct(Date, [], function () {})); return true; } catch (e) { return false; } }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var AsymmetricMatcher = function AsymmetricMatcher(sample) {
  _classCallCheck(this, AsymmetricMatcher);

  this.$$typeof = Symbol.for('jest.asymmetricMatcher');
  this.sample = sample;
};

exports.AsymmetricMatcher = AsymmetricMatcher;

var Any = /*#__PURE__*/function (_AsymmetricMatcher) {
  _inherits(Any, _AsymmetricMatcher);

  var _super = _createSuper(Any);

  function Any(sample) {
    _classCallCheck(this, Any);

    if (typeof sample === 'undefined') {
      throw new TypeError('any() expects to be passed a constructor function. ' + 'Please pass one or use anything() to match any object.');
    }

    return _super.call(this, sample);
  }

  _createClass(Any, [{
    key: "asymmetricMatch",
    value: function asymmetricMatch(other) {
      if (this.sample == String) {
        return typeof other == 'string' || other instanceof String;
      }

      if (this.sample == Number) {
        return typeof other == 'number' || other instanceof Number;
      }

      if (this.sample == Function) {
        return typeof other == 'function' || other instanceof Function;
      }

      if (this.sample == Object) {
        return _typeof(other) == 'object';
      }

      if (this.sample == Boolean) {
        return typeof other == 'boolean';
      }

      return other instanceof this.sample;
    }
  }, {
    key: "toString",
    value: function toString() {
      return 'Any';
    }
  }, {
    key: "getExpectedType",
    value: function getExpectedType() {
      if (this.sample == String) {
        return 'string';
      }

      if (this.sample == Number) {
        return 'number';
      }

      if (this.sample == Function) {
        return 'function';
      }

      if (this.sample == Object) {
        return 'object';
      }

      if (this.sample == Boolean) {
        return 'boolean';
      }

      return (0, _jasmineUtils.fnNameFor)(this.sample);
    }
  }, {
    key: "toAsymmetricMatcher",
    value: function toAsymmetricMatcher() {
      return 'Any<' + (0, _jasmineUtils.fnNameFor)(this.sample) + '>';
    }
  }]);

  return Any;
}(AsymmetricMatcher);

var Anything = /*#__PURE__*/function (_AsymmetricMatcher2) {
  _inherits(Anything, _AsymmetricMatcher2);

  var _super2 = _createSuper(Anything);

  function Anything() {
    _classCallCheck(this, Anything);

    return _super2.apply(this, arguments);
  }

  _createClass(Anything, [{
    key: "asymmetricMatch",
    value: function asymmetricMatch(other) {
      return !(0, _jasmineUtils.isUndefined)(other) && other !== null;
    }
  }, {
    key: "toString",
    value: function toString() {
      return 'Anything';
    } // No getExpectedType method, because it matches either null or undefined.

  }, {
    key: "toAsymmetricMatcher",
    value: function toAsymmetricMatcher() {
      return 'Anything';
    }
  }]);

  return Anything;
}(AsymmetricMatcher);

var ArrayContaining = /*#__PURE__*/function (_AsymmetricMatcher3) {
  _inherits(ArrayContaining, _AsymmetricMatcher3);

  var _super3 = _createSuper(ArrayContaining);

  function ArrayContaining(sample) {
    var _this;

    var inverse = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

    _classCallCheck(this, ArrayContaining);

    _this = _super3.call(this, sample);
    _this.inverse = inverse;
    return _this;
  }

  _createClass(ArrayContaining, [{
    key: "asymmetricMatch",
    value: function asymmetricMatch(other) {
      if (!Array.isArray(this.sample)) {
        throw new Error("You must provide an array to ".concat(this.toString(), ", not '") + _typeof(this.sample) + "'.");
      }

      var result = this.sample.length === 0 || Array.isArray(other) && this.sample.every(function (item) {
        return other.some(function (another) {
          return (0, _jasmineUtils.equals)(item, another);
        });
      });
      return this.inverse ? !result : result;
    }
  }, {
    key: "toString",
    value: function toString() {
      return "Array".concat(this.inverse ? 'Not' : '', "Containing");
    }
  }, {
    key: "getExpectedType",
    value: function getExpectedType() {
      return 'array';
    }
  }]);

  return ArrayContaining;
}(AsymmetricMatcher);

var ObjectContaining = /*#__PURE__*/function (_AsymmetricMatcher4) {
  _inherits(ObjectContaining, _AsymmetricMatcher4);

  var _super4 = _createSuper(ObjectContaining);

  function ObjectContaining(sample) {
    var _this2;

    var inverse = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

    _classCallCheck(this, ObjectContaining);

    _this2 = _super4.call(this, sample);
    _this2.inverse = inverse;
    return _this2;
  }

  _createClass(ObjectContaining, [{
    key: "asymmetricMatch",
    value: function asymmetricMatch(other) {
      if (_typeof(this.sample) !== 'object') {
        throw new Error("You must provide an object to ".concat(this.toString(), ", not '") + _typeof(this.sample) + "'.");
      }

      if (this.inverse) {
        for (var property in this.sample) {
          if ((0, _jasmineUtils.hasProperty)(other, property) && (0, _jasmineUtils.equals)(this.sample[property], other[property]) && !(0, _utils.emptyObject)(this.sample[property]) && !(0, _utils.emptyObject)(other[property])) {
            return false;
          }
        }

        return true;
      } else {
        for (var _property in this.sample) {
          if (!(0, _jasmineUtils.hasProperty)(other, _property) || !(0, _jasmineUtils.equals)(this.sample[_property], other[_property])) {
            return false;
          }
        }

        return true;
      }
    }
  }, {
    key: "toString",
    value: function toString() {
      return "Object".concat(this.inverse ? 'Not' : '', "Containing");
    }
  }, {
    key: "getExpectedType",
    value: function getExpectedType() {
      return 'object';
    }
  }]);

  return ObjectContaining;
}(AsymmetricMatcher);

var StringContaining = /*#__PURE__*/function (_AsymmetricMatcher5) {
  _inherits(StringContaining, _AsymmetricMatcher5);

  var _super5 = _createSuper(StringContaining);

  function StringContaining(sample) {
    var _this3;

    var inverse = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

    _classCallCheck(this, StringContaining);

    if (!(0, _jasmineUtils.isA)('String', sample)) {
      throw new Error('Expected is not a string');
    }

    _this3 = _super5.call(this, sample);
    _this3.inverse = inverse;
    return _this3;
  }

  _createClass(StringContaining, [{
    key: "asymmetricMatch",
    value: function asymmetricMatch(other) {
      var result = (0, _jasmineUtils.isA)('String', other) && other.includes(this.sample);
      return this.inverse ? !result : result;
    }
  }, {
    key: "toString",
    value: function toString() {
      return "String".concat(this.inverse ? 'Not' : '', "Containing");
    }
  }, {
    key: "getExpectedType",
    value: function getExpectedType() {
      return 'string';
    }
  }]);

  return StringContaining;
}(AsymmetricMatcher);

var StringMatching = /*#__PURE__*/function (_AsymmetricMatcher6) {
  _inherits(StringMatching, _AsymmetricMatcher6);

  var _super6 = _createSuper(StringMatching);

  function StringMatching(sample) {
    var _this4;

    var inverse = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

    _classCallCheck(this, StringMatching);

    if (!(0, _jasmineUtils.isA)('String', sample) && !(0, _jasmineUtils.isA)('RegExp', sample)) {
      throw new Error('Expected is not a String or a RegExp');
    }

    _this4 = _super6.call(this, new RegExp(sample));
    _this4.inverse = inverse;
    return _this4;
  }

  _createClass(StringMatching, [{
    key: "asymmetricMatch",
    value: function asymmetricMatch(other) {
      var result = (0, _jasmineUtils.isA)('String', other) && this.sample.test(other);
      return this.inverse ? !result : result;
    }
  }, {
    key: "toString",
    value: function toString() {
      return "String".concat(this.inverse ? 'Not' : '', "Matching");
    }
  }, {
    key: "getExpectedType",
    value: function getExpectedType() {
      return 'string';
    }
  }]);

  return StringMatching;
}(AsymmetricMatcher);

var any = function any(expectedObject) {
  return new Any(expectedObject);
};

exports.any = any;

var anything = function anything() {
  return new Anything();
};

exports.anything = anything;

var arrayContaining = function arrayContaining(sample) {
  return new ArrayContaining(sample);
};

exports.arrayContaining = arrayContaining;

var arrayNotContaining = function arrayNotContaining(sample) {
  return new ArrayContaining(sample, true);
};

exports.arrayNotContaining = arrayNotContaining;

var objectContaining = function objectContaining(sample) {
  return new ObjectContaining(sample);
};

exports.objectContaining = objectContaining;

var objectNotContaining = function objectNotContaining(sample) {
  return new ObjectContaining(sample, true);
};

exports.objectNotContaining = objectNotContaining;

var stringContaining = function stringContaining(expected) {
  return new StringContaining(expected);
};

exports.stringContaining = stringContaining;

var stringNotContaining = function stringNotContaining(expected) {
  return new StringContaining(expected, true);
};

exports.stringNotContaining = stringNotContaining;

var stringMatching = function stringMatching(expected) {
  return new StringMatching(expected);
};

exports.stringMatching = stringMatching;

var stringNotMatching = function stringNotMatching(expected) {
  return new StringMatching(expected, true);
};

exports.stringNotMatching = stringNotMatching;

/***/ }),

/***/ "./packages/expect/src/extractExpectedAssertionsErrors.ts":
/*!****************************************************************!*\
  !*** ./packages/expect/src/extractExpectedAssertionsErrors.ts ***!
  \****************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _jestMatcherUtils = __webpack_require__(/*! jest-matcher-utils */ "./packages/jest-matcher-utils/build/index.js");

var _jestMatchersObject = __webpack_require__(/*! ./jestMatchersObject */ "./packages/expect/src/jestMatchersObject.ts");

/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
var resetAssertionsLocalState = function resetAssertionsLocalState() {
  (0, _jestMatchersObject.setState)({
    assertionCalls: 0,
    expectedAssertionsNumber: null,
    isExpectingAssertions: false
  });
}; // Create and format all errors related to the mismatched number of `expect`
// calls and reset the matcher's state.


var extractExpectedAssertionsErrors = function extractExpectedAssertionsErrors() {
  var result = [];

  var _getState = (0, _jestMatchersObject.getState)(),
      assertionCalls = _getState.assertionCalls,
      expectedAssertionsNumber = _getState.expectedAssertionsNumber,
      expectedAssertionsNumberError = _getState.expectedAssertionsNumberError,
      isExpectingAssertions = _getState.isExpectingAssertions,
      isExpectingAssertionsError = _getState.isExpectingAssertionsError;

  resetAssertionsLocalState();

  if (typeof expectedAssertionsNumber === 'number' && assertionCalls !== expectedAssertionsNumber) {
    var numOfAssertionsExpected = (0, _jestMatcherUtils.EXPECTED_COLOR)((0, _jestMatcherUtils.pluralize)('assertion', expectedAssertionsNumber));
    expectedAssertionsNumberError.message = (0, _jestMatcherUtils.matcherHint)('.assertions', '', String(expectedAssertionsNumber), {
      isDirectExpectCall: true
    }) + '\n\n' + "Expected ".concat(numOfAssertionsExpected, " to be called but received ") + (0, _jestMatcherUtils.RECEIVED_COLOR)((0, _jestMatcherUtils.pluralize)('assertion call', assertionCalls || 0)) + '.';
    result.push({
      actual: assertionCalls,
      error: expectedAssertionsNumberError,
      expected: expectedAssertionsNumber
    });
  }

  if (isExpectingAssertions && assertionCalls === 0) {
    var expected = (0, _jestMatcherUtils.EXPECTED_COLOR)('at least one assertion');
    var received = (0, _jestMatcherUtils.RECEIVED_COLOR)('received none');
    isExpectingAssertionsError.message = (0, _jestMatcherUtils.matcherHint)('.hasAssertions', '', '', {
      isDirectExpectCall: true
    }) + '\n\n' + "Expected ".concat(expected, " to be called but ").concat(received, ".");
    result.push({
      actual: 'none',
      error: isExpectingAssertionsError,
      expected: 'at least one'
    });
  }

  return result;
};

var _default = extractExpectedAssertionsErrors;
exports.default = _default;

/***/ }),

/***/ "./packages/expect/src/index.ts":
/*!**************************************!*\
  !*** ./packages/expect/src/index.ts ***!
  \**************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var matcherUtils = _interopRequireWildcard(__webpack_require__(/*! jest-matcher-utils */ "./packages/jest-matcher-utils/build/index.js"));

var _utils = __webpack_require__(/*! ./utils */ "./packages/expect/src/utils.ts");

var _matchers = _interopRequireDefault(__webpack_require__(/*! ./matchers */ "./packages/expect/src/matchers.ts"));

var _spyMatchers = _interopRequireDefault(__webpack_require__(/*! ./spyMatchers */ "./packages/expect/src/spyMatchers.ts"));

var _toThrowMatchers = _interopRequireWildcard(__webpack_require__(/*! ./toThrowMatchers */ "./packages/expect/src/toThrowMatchers.ts"));

var _jasmineUtils = __webpack_require__(/*! ./jasmineUtils */ "./packages/expect/src/jasmineUtils.ts");

var _asymmetricMatchers = __webpack_require__(/*! ./asymmetricMatchers */ "./packages/expect/src/asymmetricMatchers.ts");

var _jestMatchersObject = __webpack_require__(/*! ./jestMatchersObject */ "./packages/expect/src/jestMatchersObject.ts");

var _extractExpectedAssertionsErrors = _interopRequireDefault(__webpack_require__(/*! ./extractExpectedAssertionsErrors */ "./packages/expect/src/extractExpectedAssertionsErrors.ts"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _createSuper(Derived) { return function () { var Super = _getPrototypeOf(Derived), result; if (_isNativeReflectConstruct()) { var NewTarget = _getPrototypeOf(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn(this, result); }; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _wrapNativeSuper(Class) { var _cache = typeof Map === "function" ? new Map() : undefined; _wrapNativeSuper = function _wrapNativeSuper(Class) { if (Class === null || !_isNativeFunction(Class)) return Class; if (typeof Class !== "function") { throw new TypeError("Super expression must either be null or a function"); } if (typeof _cache !== "undefined") { if (_cache.has(Class)) return _cache.get(Class); _cache.set(Class, Wrapper); } function Wrapper() { return _construct(Class, arguments, _getPrototypeOf(this).constructor); } Wrapper.prototype = Object.create(Class.prototype, { constructor: { value: Wrapper, enumerable: false, writable: true, configurable: true } }); return _setPrototypeOf(Wrapper, Class); }; return _wrapNativeSuper(Class); }

function _construct(Parent, args, Class) { if (_isNativeReflectConstruct()) { _construct = Reflect.construct; } else { _construct = function _construct(Parent, args, Class) { var a = [null]; a.push.apply(a, args); var Constructor = Function.bind.apply(Parent, a); var instance = new Constructor(); if (Class) _setPrototypeOf(instance, Class.prototype); return instance; }; } return _construct.apply(null, arguments); }

function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Date.prototype.toString.call(Reflect.construct(Date, [], function () {})); return true; } catch (e) { return false; } }

function _isNativeFunction(fn) { return Function.toString.call(fn).indexOf("[native code]") !== -1; }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

var JestAssertionError = /*#__PURE__*/function (_Error) {
  _inherits(JestAssertionError, _Error);

  var _super = _createSuper(JestAssertionError);

  function JestAssertionError() {
    _classCallCheck(this, JestAssertionError);

    return _super.apply(this, arguments);
  }

  return JestAssertionError;
}( /*#__PURE__*/_wrapNativeSuper(Error));

var isPromise = function isPromise(obj) {
  return !!obj && (_typeof(obj) === 'object' || typeof obj === 'function') && typeof obj.then === 'function';
};

var createToThrowErrorMatchingSnapshotMatcher = function createToThrowErrorMatchingSnapshotMatcher(matcher) {
  return function (received, testNameOrInlineSnapshot) {
    return matcher.apply(this, [received, testNameOrInlineSnapshot, true]);
  };
};

var getPromiseMatcher = function getPromiseMatcher(name, matcher) {
  if (name === 'toThrow' || name === 'toThrowError') {
    return (0, _toThrowMatchers.createMatcher)(name, true);
  } else if (name === 'toThrowErrorMatchingSnapshot' || name === 'toThrowErrorMatchingInlineSnapshot') {
    return createToThrowErrorMatchingSnapshotMatcher(matcher);
  }

  return null;
};

var expect = function expect(actual) {
  if ((arguments.length <= 1 ? 0 : arguments.length - 1) !== 0) {
    throw new Error('Expect takes at most one argument.');
  }

  var allMatchers = (0, _jestMatchersObject.getMatchers)();
  var expectation = {
    not: {},
    rejects: {
      not: {}
    },
    resolves: {
      not: {}
    }
  };
  var err = new JestAssertionError();
  Object.keys(allMatchers).forEach(function (name) {
    var matcher = allMatchers[name];
    var promiseMatcher = getPromiseMatcher(name, matcher) || matcher;
    expectation[name] = makeThrowingMatcher(matcher, false, '', actual);
    expectation.not[name] = makeThrowingMatcher(matcher, true, '', actual);
    expectation.resolves[name] = makeResolveMatcher(name, promiseMatcher, false, actual, err);
    expectation.resolves.not[name] = makeResolveMatcher(name, promiseMatcher, true, actual, err);
    expectation.rejects[name] = makeRejectMatcher(name, promiseMatcher, false, actual, err);
    expectation.rejects.not[name] = makeRejectMatcher(name, promiseMatcher, true, actual, err);
  });
  return expectation;
};

var getMessage = function getMessage(message) {
  return message && message() || matcherUtils.RECEIVED_COLOR('No message was specified for this matcher.');
};

var makeResolveMatcher = function makeResolveMatcher(matcherName, matcher, isNot, actual, outerErr) {
  return function () {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    var options = {
      isNot: isNot,
      promise: 'resolves'
    };

    if (!isPromise(actual)) {
      throw new JestAssertionError(matcherUtils.matcherErrorMessage(matcherUtils.matcherHint(matcherName, undefined, '', options), "".concat(matcherUtils.RECEIVED_COLOR('received'), " value must be a promise"), matcherUtils.printWithType('Received', actual, matcherUtils.printReceived)));
    }

    var innerErr = new JestAssertionError();
    return actual.then(function (result) {
      return makeThrowingMatcher(matcher, isNot, 'resolves', result, innerErr).apply(null, args);
    }, function (reason) {
      outerErr.message = matcherUtils.matcherHint(matcherName, undefined, '', options) + '\n\n' + "Received promise rejected instead of resolved\n" + "Rejected to value: ".concat(matcherUtils.printReceived(reason));
      return Promise.reject(outerErr);
    });
  };
};

var makeRejectMatcher = function makeRejectMatcher(matcherName, matcher, isNot, actual, outerErr) {
  return function () {
    for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    var options = {
      isNot: isNot,
      promise: 'rejects'
    };
    var actualWrapper = typeof actual === 'function' ? actual() : actual;

    if (!isPromise(actualWrapper)) {
      throw new JestAssertionError(matcherUtils.matcherErrorMessage(matcherUtils.matcherHint(matcherName, undefined, '', options), "".concat(matcherUtils.RECEIVED_COLOR('received'), " value must be a promise or a function returning a promise"), matcherUtils.printWithType('Received', actual, matcherUtils.printReceived)));
    }

    var innerErr = new JestAssertionError();
    return actualWrapper.then(function (result) {
      outerErr.message = matcherUtils.matcherHint(matcherName, undefined, '', options) + '\n\n' + "Received promise resolved instead of rejected\n" + "Resolved to value: ".concat(matcherUtils.printReceived(result));
      return Promise.reject(outerErr);
    }, function (reason) {
      return makeThrowingMatcher(matcher, isNot, 'rejects', reason, innerErr).apply(null, args);
    });
  };
};

var makeThrowingMatcher = function makeThrowingMatcher(matcher, isNot, promise, actual, err) {
  return function throwingMatcher() {
    for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
      args[_key3] = arguments[_key3];
    }

    var throws = true;

    var utils = _objectSpread({}, matcherUtils, {
      iterableEquality: _utils.iterableEquality,
      subsetEquality: _utils.subsetEquality
    });

    var matcherContext = _objectSpread({
      // When throws is disabled, the matcher will not throw errors during test
      // execution but instead add them to the global matcher state. If a
      // matcher throws, test execution is normally stopped immediately. The
      // snapshot matcher uses it because we want to log all snapshot
      // failures in a test.
      dontThrow: function dontThrow() {
        return throws = false;
      }
    }, (0, _jestMatchersObject.getState)(), {
      equals: _jasmineUtils.equals,
      error: err,
      isNot: isNot,
      promise: promise,
      utils: utils
    });

    var processResult = function processResult(result, asyncError) {
      _validateResult(result);

      (0, _jestMatchersObject.getState)().assertionCalls++;

      if (result.pass && isNot || !result.pass && !isNot) {
        // XOR
        var message = getMessage(result.message);
        var error;

        if (err) {
          error = err;
          error.message = message;
        } else if (asyncError) {
          error = asyncError;
          error.message = message;
        } else {
          error = new JestAssertionError(message); // Try to remove this function from the stack trace frame.
          // Guard for some environments (browsers) that do not support this feature.

          if (Error.captureStackTrace) {
            Error.captureStackTrace(error, throwingMatcher);
          }
        } // Passing the result of the matcher with the error so that a custom
        // reporter could access the actual and expected objects of the result
        // for example in order to display a custom visual diff


        error.matcherResult = result;

        if (throws) {
          throw error;
        } else {
          (0, _jestMatchersObject.getState)().suppressedErrors.push(error);
        }
      }
    };

    var handleError = function handleError(error) {
      if (matcher[_jestMatchersObject.INTERNAL_MATCHER_FLAG] === true && !(error instanceof JestAssertionError) && error.name !== 'PrettyFormatPluginError' && // Guard for some environments (browsers) that do not support this feature.
      Error.captureStackTrace) {
        // Try to remove this and deeper functions from the stack trace frame.
        Error.captureStackTrace(error, throwingMatcher);
      }

      throw error;
    };

    var potentialResult;

    try {
      potentialResult = matcher[_jestMatchersObject.INTERNAL_MATCHER_FLAG] === true ? matcher.call.apply(matcher, [matcherContext, actual].concat(args)) : // It's a trap specifically for inline snapshot to capture this name
      // in the stack trace, so that it can correctly get the custom matcher
      // function call.
      function __EXTERNAL_MATCHER_TRAP__() {
        return matcher.call.apply(matcher, [matcherContext, actual].concat(args));
      }();

      if (isPromise(potentialResult)) {
        var asyncResult = potentialResult;
        var asyncError = new JestAssertionError();

        if (Error.captureStackTrace) {
          Error.captureStackTrace(asyncError, throwingMatcher);
        }

        return asyncResult.then(function (aResult) {
          return processResult(aResult, asyncError);
        }).catch(function (error) {
          return handleError(error);
        });
      } else {
        var syncResult = potentialResult;
        return processResult(syncResult);
      }
    } catch (error) {
      return handleError(error);
    }
  };
};

expect.extend = function (matchers) {
  return (0, _jestMatchersObject.setMatchers)(matchers, false, expect);
};

expect.anything = _asymmetricMatchers.anything;
expect.any = _asymmetricMatchers.any;
expect.not = {
  arrayContaining: _asymmetricMatchers.arrayNotContaining,
  objectContaining: _asymmetricMatchers.objectNotContaining,
  stringContaining: _asymmetricMatchers.stringNotContaining,
  stringMatching: _asymmetricMatchers.stringNotMatching
};
expect.objectContaining = _asymmetricMatchers.objectContaining;
expect.arrayContaining = _asymmetricMatchers.arrayContaining;
expect.stringContaining = _asymmetricMatchers.stringContaining;
expect.stringMatching = _asymmetricMatchers.stringMatching;

var _validateResult = function _validateResult(result) {
  if (_typeof(result) !== 'object' || typeof result.pass !== 'boolean' || result.message && typeof result.message !== 'string' && typeof result.message !== 'function') {
    throw new Error('Unexpected return from a matcher function.\n' + 'Matcher functions should ' + 'return an object in the following format:\n' + '  {message?: string | function, pass: boolean}\n' + "'".concat(matcherUtils.stringify(result), "' was returned"));
  }
};

function assertions(expected) {
  var error = new Error();

  if (Error.captureStackTrace) {
    Error.captureStackTrace(error, assertions);
  }

  (0, _jestMatchersObject.getState)().expectedAssertionsNumber = expected;
  (0, _jestMatchersObject.getState)().expectedAssertionsNumberError = error;
}

function hasAssertions() {
  var error = new Error();

  if (Error.captureStackTrace) {
    Error.captureStackTrace(error, hasAssertions);
  }

  matcherUtils.ensureNoExpected(arguments.length <= 0 ? undefined : arguments[0], '.hasAssertions');
  (0, _jestMatchersObject.getState)().isExpectingAssertions = true;
  (0, _jestMatchersObject.getState)().isExpectingAssertionsError = error;
} // add default jest matchers


(0, _jestMatchersObject.setMatchers)(_matchers.default, true, expect);
(0, _jestMatchersObject.setMatchers)(_spyMatchers.default, true, expect);
(0, _jestMatchersObject.setMatchers)(_toThrowMatchers.default, true, expect);

expect.addSnapshotSerializer = function () {
  return void 0;
};

expect.assertions = assertions;
expect.hasAssertions = hasAssertions;
expect.getState = _jestMatchersObject.getState;
expect.setState = _jestMatchersObject.setState;
expect.extractExpectedAssertionsErrors = _extractExpectedAssertionsErrors.default;
var expectExport = expect; // eslint-disable-next-line no-redeclare

module.exports = expectExport;

/***/ }),

/***/ "./packages/expect/src/jasmineUtils.ts":
/*!*********************************************!*\
  !*** ./packages/expect/src/jasmineUtils.ts ***!
  \*********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.equals = equals;
exports.isA = isA;
exports.fnNameFor = fnNameFor;
exports.isUndefined = isUndefined;
exports.hasProperty = hasProperty;
exports.isImmutableUnorderedKeyed = isImmutableUnorderedKeyed;
exports.isImmutableUnorderedSet = isImmutableUnorderedSet;

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

/*
Copyright (c) 2008-2016 Pivotal Labs

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

/* eslint-disable */
// Extracted out of jasmine 2.5.2
function equals(a, b, customTesters, strictCheck) {
  customTesters = customTesters || [];
  return eq(a, b, [], [], customTesters, strictCheck ? hasKey : hasDefinedKey);
}

var functionToString = Function.prototype.toString;

function isAsymmetric(obj) {
  return !!obj && isA('Function', obj.asymmetricMatch);
}

function asymmetricMatch(a, b) {
  var asymmetricA = isAsymmetric(a),
      asymmetricB = isAsymmetric(b);

  if (asymmetricA && asymmetricB) {
    return undefined;
  }

  if (asymmetricA) {
    return a.asymmetricMatch(b);
  }

  if (asymmetricB) {
    return b.asymmetricMatch(a);
  }
} // Equality function lovingly adapted from isEqual in
//   [Underscore](http://underscorejs.org)


function eq(a, b, aStack, bStack, customTesters, hasKey) {
  var result = true;
  var asymmetricResult = asymmetricMatch(a, b);

  if (asymmetricResult !== undefined) {
    return asymmetricResult;
  }

  for (var i = 0; i < customTesters.length; i++) {
    var customTesterResult = customTesters[i](a, b);

    if (customTesterResult !== undefined) {
      return customTesterResult;
    }
  }

  if (a instanceof Error && b instanceof Error) {
    return a.message == b.message;
  }

  if (Object.is(a, b)) {
    return true;
  } // A strict comparison is necessary because `null == undefined`.


  if (a === null || b === null) {
    return a === b;
  }

  var className = Object.prototype.toString.call(a);

  if (className != Object.prototype.toString.call(b)) {
    return false;
  }

  switch (className) {
    case '[object Boolean]':
    case '[object String]':
    case '[object Number]':
      if (_typeof(a) !== _typeof(b)) {
        // One is a primitive, one a `new Primitive()`
        return false;
      } else if (_typeof(a) !== 'object' && _typeof(b) !== 'object') {
        // both are proper primitives
        return Object.is(a, b);
      } else {
        // both are `new Primitive()`s
        return Object.is(a.valueOf(), b.valueOf());
      }

    case '[object Date]':
      // Coerce dates to numeric primitive values. Dates are compared by their
      // millisecond representations. Note that invalid dates with millisecond representations
      // of `NaN` are not equivalent.
      return +a == +b;
    // RegExps are compared by their source patterns and flags.

    case '[object RegExp]':
      return a.source === b.source && a.flags === b.flags;
  }

  if (_typeof(a) !== 'object' || _typeof(b) !== 'object') {
    return false;
  } // Use DOM3 method isEqualNode (IE>=9)


  if (isDomNode(a) && isDomNode(b)) {
    return a.isEqualNode(b);
  } // Used to detect circular references.


  var length = aStack.length;

  while (length--) {
    // Linear search. Performance is inversely proportional to the number of
    // unique nested structures.
    // circular references at same depth are equal
    // circular reference is not equal to non-circular one
    if (aStack[length] === a) {
      return bStack[length] === b;
    } else if (bStack[length] === b) {
      return false;
    }
  } // Add the first object to the stack of traversed objects.


  aStack.push(a);
  bStack.push(b);
  var size = 0; // Recursively compare objects and arrays.
  // Compare array lengths to determine if a deep comparison is necessary.

  if (className == '[object Array]') {
    size = a.length;

    if (size !== b.length) {
      return false;
    }

    while (size--) {
      result = eq(a[size], b[size], aStack, bStack, customTesters, hasKey);

      if (!result) {
        return false;
      }
    }
  } // Deep compare objects.


  var aKeys = keys(a, className == '[object Array]', hasKey),
      key;
  size = aKeys.length; // Ensure that both objects contain the same number of properties before comparing deep equality.

  if (keys(b, className == '[object Array]', hasKey).length !== size) {
    return false;
  }

  while (size--) {
    key = aKeys[size]; // Deep compare each member

    result = hasKey(b, key) && eq(a[key], b[key], aStack, bStack, customTesters, hasKey);

    if (!result) {
      return false;
    }
  } // Remove the first object from the stack of traversed objects.


  aStack.pop();
  bStack.pop();
  return result;
}

function keys(obj, isArray, hasKey) {
  var allKeys = function (o) {
    var keys = [];

    for (var key in o) {
      if (hasKey(o, key)) {
        keys.push(key);
      }
    }

    return keys.concat(Object.getOwnPropertySymbols(o).filter(function (symbol) {
      return Object.getOwnPropertyDescriptor(o, symbol).enumerable;
    }));
  }(obj);

  if (!isArray) {
    return allKeys;
  }

  var extraKeys = [];

  if (allKeys.length === 0) {
    return allKeys;
  }

  for (var x = 0; x < allKeys.length; x++) {
    if (_typeof(allKeys[x]) === 'symbol' || !allKeys[x].match(/^[0-9]+$/)) {
      extraKeys.push(allKeys[x]);
    }
  }

  return extraKeys;
}

function hasDefinedKey(obj, key) {
  return hasKey(obj, key) && obj[key] !== undefined;
}

function hasKey(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isA(typeName, value) {
  return Object.prototype.toString.apply(value) === '[object ' + typeName + ']';
}

function isDomNode(obj) {
  return obj !== null && _typeof(obj) === 'object' && typeof obj.nodeType === 'number' && typeof obj.nodeName === 'string' && typeof obj.isEqualNode === 'function';
}

function fnNameFor(func) {
  if (func.name) {
    return func.name;
  }

  var matches = functionToString.call(func).match(/^(?:async)?\s*function\s*\*?\s*([\w$]+)\s*\(/);
  return matches ? matches[1] : '<anonymous>';
}

function isUndefined(obj) {
  return obj === void 0;
}

function getPrototype(obj) {
  if (Object.getPrototypeOf) {
    return Object.getPrototypeOf(obj);
  }

  if (obj.constructor.prototype == obj) {
    return null;
  }

  return obj.constructor.prototype;
}

function hasProperty(obj, property) {
  if (!obj) {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(obj, property)) {
    return true;
  }

  return hasProperty(getPrototype(obj), property);
} // SENTINEL constants are from https://github.com/facebook/immutable-js


var IS_KEYED_SENTINEL = '@@__IMMUTABLE_KEYED__@@';
var IS_SET_SENTINEL = '@@__IMMUTABLE_SET__@@';
var IS_ORDERED_SENTINEL = '@@__IMMUTABLE_ORDERED__@@';

function isImmutableUnorderedKeyed(maybeKeyed) {
  return !!(maybeKeyed && maybeKeyed[IS_KEYED_SENTINEL] && !maybeKeyed[IS_ORDERED_SENTINEL]);
}

function isImmutableUnorderedSet(maybeSet) {
  return !!(maybeSet && maybeSet[IS_SET_SENTINEL] && !maybeSet[IS_ORDERED_SENTINEL]);
}

/***/ }),

/***/ "./packages/expect/src/jestMatchersObject.ts":
/*!***************************************************!*\
  !*** ./packages/expect/src/jestMatchersObject.ts ***!
  \***************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(global) {

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.setMatchers = exports.getMatchers = exports.setState = exports.getState = exports.INTERNAL_MATCHER_FLAG = void 0;

var _asymmetricMatchers = __webpack_require__(/*! ./asymmetricMatchers */ "./packages/expect/src/asymmetricMatchers.ts");

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _construct(Parent, args, Class) { if (_isNativeReflectConstruct()) { _construct = Reflect.construct; } else { _construct = function _construct(Parent, args, Class) { var a = [null]; a.push.apply(a, args); var Constructor = Function.bind.apply(Parent, a); var instance = new Constructor(); if (Class) _setPrototypeOf(instance, Class.prototype); return instance; }; } return _construct.apply(null, arguments); }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _createSuper(Derived) { return function () { var Super = _getPrototypeOf(Derived), result; if (_isNativeReflectConstruct()) { var NewTarget = _getPrototypeOf(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn(this, result); }; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Date.prototype.toString.call(Reflect.construct(Date, [], function () {})); return true; } catch (e) { return false; } }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

// Global matchers object holds the list of available matchers and
// the state, that can hold matcher specific values that change over time.
var JEST_MATCHERS_OBJECT = Symbol.for('$$jest-matchers-object'); // Notes a built-in/internal Jest matcher.
// Jest may override the stack trace of Errors thrown by internal matchers.

var INTERNAL_MATCHER_FLAG = Symbol.for('$$jest-internal-matcher');
exports.INTERNAL_MATCHER_FLAG = INTERNAL_MATCHER_FLAG;

if (!global.hasOwnProperty(JEST_MATCHERS_OBJECT)) {
  Object.defineProperty(global, JEST_MATCHERS_OBJECT, {
    value: {
      matchers: Object.create(null),
      state: {
        assertionCalls: 0,
        expectedAssertionsNumber: null,
        isExpectingAssertions: false,
        suppressedErrors: [] // errors that are not thrown immediately.

      }
    }
  });
}

var getState = function getState() {
  return global[JEST_MATCHERS_OBJECT].state;
};

exports.getState = getState;

var setState = function setState(state) {
  Object.assign(global[JEST_MATCHERS_OBJECT].state, state);
};

exports.setState = setState;

var getMatchers = function getMatchers() {
  return global[JEST_MATCHERS_OBJECT].matchers;
};

exports.getMatchers = getMatchers;

var setMatchers = function setMatchers(matchers, isInternal, expect) {
  Object.keys(matchers).forEach(function (key) {
    var matcher = matchers[key];
    Object.defineProperty(matcher, INTERNAL_MATCHER_FLAG, {
      value: isInternal
    });

    if (!isInternal) {
      // expect is defined
      var CustomMatcher = /*#__PURE__*/function (_AsymmetricMatcher) {
        _inherits(CustomMatcher, _AsymmetricMatcher);

        var _super = _createSuper(CustomMatcher);

        function CustomMatcher() {
          var _this;

          var inverse = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

          _classCallCheck(this, CustomMatcher);

          for (var _len = arguments.length, sample = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
            sample[_key - 1] = arguments[_key];
          }

          _this = _super.call(this, sample);
          _this.inverse = inverse;
          return _this;
        }

        _createClass(CustomMatcher, [{
          key: "asymmetricMatch",
          value: function asymmetricMatch(other) {
            var _ref = matcher.apply(void 0, [other].concat(_toConsumableArray(this.sample))),
                pass = _ref.pass;

            return this.inverse ? !pass : pass;
          }
        }, {
          key: "toString",
          value: function toString() {
            return "".concat(this.inverse ? 'not.' : '').concat(key);
          }
        }, {
          key: "getExpectedType",
          value: function getExpectedType() {
            return 'any';
          }
        }, {
          key: "toAsymmetricMatcher",
          value: function toAsymmetricMatcher() {
            return "".concat(this.toString(), "<").concat(this.sample.map(String).join(', '), ">");
          }
        }]);

        return CustomMatcher;
      }(_asymmetricMatchers.AsymmetricMatcher);

      expect[key] = function () {
        for (var _len2 = arguments.length, sample = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
          sample[_key2] = arguments[_key2];
        }

        return _construct(CustomMatcher, [false].concat(sample));
      };

      if (!expect.not) {
        expect.not = {};
      }

      expect.not[key] = function () {
        for (var _len3 = arguments.length, sample = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
          sample[_key3] = arguments[_key3];
        }

        return _construct(CustomMatcher, [true].concat(sample));
      };
    }
  });
  Object.assign(global[JEST_MATCHERS_OBJECT].matchers, matchers);
};

exports.setMatchers = setMatchers;
/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../../../node_modules/webpack/buildin/global.js */ "./node_modules/webpack/buildin/global.js")))

/***/ }),

/***/ "./packages/expect/src/matchers.ts":
/*!*****************************************!*\
  !*** ./packages/expect/src/matchers.ts ***!
  \*****************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _jestGetType = _interopRequireDefault(__webpack_require__(/*! jest-get-type */ "./packages/jest-get-type/build/index.js"));

var _jestMatcherUtils = __webpack_require__(/*! jest-matcher-utils */ "./packages/jest-matcher-utils/build/index.js");

var _print = __webpack_require__(/*! ./print */ "./packages/expect/src/print.ts");

var _utils = __webpack_require__(/*! ./utils */ "./packages/expect/src/utils.ts");

var _jasmineUtils = __webpack_require__(/*! ./jasmineUtils */ "./packages/expect/src/jasmineUtils.ts");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

// Omit colon and one or more spaces, so can call getLabelPrinter.
var EXPECTED_LABEL = 'Expected';
var RECEIVED_LABEL = 'Received';
var EXPECTED_VALUE_LABEL = 'Expected value';
var RECEIVED_VALUE_LABEL = 'Received value'; // The optional property of matcher context is true if undefined.

var isExpand = function isExpand(expand) {
  return expand !== false;
};

var toStrictEqualTesters = [_utils.iterableEquality, _utils.typeEquality, _utils.sparseArrayEquality];
var matchers = {
  toBe: function toBe(received, expected) {
    var _this = this;

    var matcherName = 'toBe';
    var options = {
      comment: 'Object.is equality',
      isNot: this.isNot,
      promise: this.promise
    };
    var pass = Object.is(received, expected);
    var message = pass ? function () {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + "Expected: not ".concat((0, _jestMatcherUtils.printExpected)(expected));
    } : function () {
      var expectedType = (0, _jestGetType.default)(expected);
      var deepEqualityName = null;

      if (expectedType !== 'map' && expectedType !== 'set') {
        // If deep equality passes when referential identity fails,
        // but exclude map and set until review of their equality logic.
        if ((0, _jasmineUtils.equals)(received, expected, toStrictEqualTesters, true)) {
          deepEqualityName = 'toStrictEqual';
        } else if ((0, _jasmineUtils.equals)(received, expected, [_utils.iterableEquality])) {
          deepEqualityName = 'toEqual';
        }
      }

      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + (deepEqualityName !== null ? (0, _jestMatcherUtils.DIM_COLOR)("If it should pass with deep equality, replace \"".concat(matcherName, "\" with \"").concat(deepEqualityName, "\"")) + '\n\n' : '') + (0, _jestMatcherUtils.printDiffOrStringify)(expected, received, EXPECTED_LABEL, RECEIVED_LABEL, isExpand(_this.expand));
    }; // Passing the actual and expected objects so that a custom reporter
    // could access them, for example in order to display a custom visual diff,
    // or create a different error message

    return {
      actual: received,
      expected: expected,
      message: message,
      name: matcherName,
      pass: pass
    };
  },
  toBeCloseTo: function toBeCloseTo(received, expected) {
    var precision = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 2;
    var matcherName = 'toBeCloseTo';
    var secondArgument = arguments.length === 3 ? 'precision' : undefined;
    var isNot = this.isNot;
    var options = {
      isNot: isNot,
      promise: this.promise,
      secondArgument: secondArgument,
      secondArgumentColor: function secondArgumentColor(arg) {
        return arg;
      }
    };

    if (typeof expected !== 'number') {
      throw new Error((0, _jestMatcherUtils.matcherErrorMessage)((0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options), "".concat((0, _jestMatcherUtils.EXPECTED_COLOR)('expected'), " value must be a number"), (0, _jestMatcherUtils.printWithType)('Expected', expected, _jestMatcherUtils.printExpected)));
    }

    if (typeof received !== 'number') {
      throw new Error((0, _jestMatcherUtils.matcherErrorMessage)((0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options), "".concat((0, _jestMatcherUtils.RECEIVED_COLOR)('received'), " value must be a number"), (0, _jestMatcherUtils.printWithType)('Received', received, _jestMatcherUtils.printReceived)));
    }

    var pass = false;
    var expectedDiff = 0;
    var receivedDiff = 0;

    if (received === Infinity && expected === Infinity) {
      pass = true; // Infinity - Infinity is NaN
    } else if (received === -Infinity && expected === -Infinity) {
      pass = true; // -Infinity - -Infinity is NaN
    } else {
      expectedDiff = Math.pow(10, -precision) / 2;
      receivedDiff = Math.abs(expected - received);
      pass = receivedDiff < expectedDiff;
    }

    var message = pass ? function () {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + "Expected: not ".concat((0, _jestMatcherUtils.printExpected)(expected), "\n") + (receivedDiff === 0 ? '' : "Received:     ".concat((0, _jestMatcherUtils.printReceived)(received), "\n") + '\n' + (0, _print.printCloseTo)(receivedDiff, expectedDiff, precision, isNot));
    } : function () {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + "Expected: ".concat((0, _jestMatcherUtils.printExpected)(expected), "\n") + "Received: ".concat((0, _jestMatcherUtils.printReceived)(received), "\n") + '\n' + (0, _print.printCloseTo)(receivedDiff, expectedDiff, precision, isNot);
    };
    return {
      message: message,
      pass: pass
    };
  },
  toBeDefined: function toBeDefined(received, expected) {
    var matcherName = 'toBeDefined';
    var options = {
      isNot: this.isNot,
      promise: this.promise
    };
    (0, _jestMatcherUtils.ensureNoExpected)(expected, matcherName, options);
    var pass = received !== void 0;

    var message = function message() {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, '', options) + '\n\n' + "Received: ".concat((0, _jestMatcherUtils.printReceived)(received));
    };

    return {
      message: message,
      pass: pass
    };
  },
  toBeFalsy: function toBeFalsy(received, expected) {
    var matcherName = 'toBeFalsy';
    var options = {
      isNot: this.isNot,
      promise: this.promise
    };
    (0, _jestMatcherUtils.ensureNoExpected)(expected, matcherName, options);
    var pass = !received;

    var message = function message() {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, '', options) + '\n\n' + "Received: ".concat((0, _jestMatcherUtils.printReceived)(received));
    };

    return {
      message: message,
      pass: pass
    };
  },
  toBeGreaterThan: function toBeGreaterThan(received, expected) {
    var matcherName = 'toBeGreaterThan';
    var isNot = this.isNot;
    var options = {
      isNot: isNot,
      promise: this.promise
    };
    (0, _jestMatcherUtils.ensureNumbers)(received, expected, matcherName, options);
    var pass = received > expected;

    var message = function message() {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + "Expected:".concat(isNot ? ' not' : '', " > ").concat((0, _jestMatcherUtils.printExpected)(expected), "\n") + "Received:".concat(isNot ? '    ' : '', "   ").concat((0, _jestMatcherUtils.printReceived)(received));
    };

    return {
      message: message,
      pass: pass
    };
  },
  toBeGreaterThanOrEqual: function toBeGreaterThanOrEqual(received, expected) {
    var matcherName = 'toBeGreaterThanOrEqual';
    var isNot = this.isNot;
    var options = {
      isNot: isNot,
      promise: this.promise
    };
    (0, _jestMatcherUtils.ensureNumbers)(received, expected, matcherName, options);
    var pass = received >= expected;

    var message = function message() {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + "Expected:".concat(isNot ? ' not' : '', " >= ").concat((0, _jestMatcherUtils.printExpected)(expected), "\n") + "Received:".concat(isNot ? '    ' : '', "    ").concat((0, _jestMatcherUtils.printReceived)(received));
    };

    return {
      message: message,
      pass: pass
    };
  },
  toBeInstanceOf: function toBeInstanceOf(received, expected) {
    var matcherName = 'toBeInstanceOf';
    var options = {
      isNot: this.isNot,
      promise: this.promise
    };

    if (typeof expected !== 'function') {
      throw new Error((0, _jestMatcherUtils.matcherErrorMessage)((0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options), "".concat((0, _jestMatcherUtils.EXPECTED_COLOR)('expected'), " value must be a function"), (0, _jestMatcherUtils.printWithType)('Expected', expected, _jestMatcherUtils.printExpected)));
    }

    var pass = received instanceof expected;
    var message = pass ? function () {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + (0, _print.printExpectedConstructorNameNot)('Expected constructor', expected) + (typeof received.constructor === 'function' && received.constructor !== expected ? (0, _print.printReceivedConstructorNameNot)('Received constructor', received.constructor, expected) : '');
    } : function () {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + (0, _print.printExpectedConstructorName)('Expected constructor', expected) + (_jestGetType.default.isPrimitive(received) || Object.getPrototypeOf(received) === null ? "\nReceived value has no prototype\nReceived value: ".concat((0, _jestMatcherUtils.printReceived)(received)) : typeof received.constructor !== 'function' ? "\nReceived value: ".concat((0, _jestMatcherUtils.printReceived)(received)) : (0, _print.printReceivedConstructorName)('Received constructor', received.constructor));
    };
    return {
      message: message,
      pass: pass
    };
  },
  toBeLessThan: function toBeLessThan(received, expected) {
    var matcherName = 'toBeLessThan';
    var isNot = this.isNot;
    var options = {
      isNot: isNot,
      promise: this.promise
    };
    (0, _jestMatcherUtils.ensureNumbers)(received, expected, matcherName, options);
    var pass = received < expected;

    var message = function message() {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + "Expected:".concat(isNot ? ' not' : '', " < ").concat((0, _jestMatcherUtils.printExpected)(expected), "\n") + "Received:".concat(isNot ? '    ' : '', "   ").concat((0, _jestMatcherUtils.printReceived)(received));
    };

    return {
      message: message,
      pass: pass
    };
  },
  toBeLessThanOrEqual: function toBeLessThanOrEqual(received, expected) {
    var matcherName = 'toBeLessThanOrEqual';
    var isNot = this.isNot;
    var options = {
      isNot: isNot,
      promise: this.promise
    };
    (0, _jestMatcherUtils.ensureNumbers)(received, expected, matcherName, options);
    var pass = received <= expected;

    var message = function message() {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + "Expected:".concat(isNot ? ' not' : '', " <= ").concat((0, _jestMatcherUtils.printExpected)(expected), "\n") + "Received:".concat(isNot ? '    ' : '', "    ").concat((0, _jestMatcherUtils.printReceived)(received));
    };

    return {
      message: message,
      pass: pass
    };
  },
  toBeNaN: function toBeNaN(received, expected) {
    var matcherName = 'toBeNaN';
    var options = {
      isNot: this.isNot,
      promise: this.promise
    };
    (0, _jestMatcherUtils.ensureNoExpected)(expected, matcherName, options);
    var pass = Number.isNaN(received);

    var message = function message() {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, '', options) + '\n\n' + "Received: ".concat((0, _jestMatcherUtils.printReceived)(received));
    };

    return {
      message: message,
      pass: pass
    };
  },
  toBeNull: function toBeNull(received, expected) {
    var matcherName = 'toBeNull';
    var options = {
      isNot: this.isNot,
      promise: this.promise
    };
    (0, _jestMatcherUtils.ensureNoExpected)(expected, matcherName, options);
    var pass = received === null;

    var message = function message() {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, '', options) + '\n\n' + "Received: ".concat((0, _jestMatcherUtils.printReceived)(received));
    };

    return {
      message: message,
      pass: pass
    };
  },
  toBeTruthy: function toBeTruthy(received, expected) {
    var matcherName = 'toBeTruthy';
    var options = {
      isNot: this.isNot,
      promise: this.promise
    };
    (0, _jestMatcherUtils.ensureNoExpected)(expected, matcherName, options);
    var pass = !!received;

    var message = function message() {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, '', options) + '\n\n' + "Received: ".concat((0, _jestMatcherUtils.printReceived)(received));
    };

    return {
      message: message,
      pass: pass
    };
  },
  toBeUndefined: function toBeUndefined(received, expected) {
    var matcherName = 'toBeUndefined';
    var options = {
      isNot: this.isNot,
      promise: this.promise
    };
    (0, _jestMatcherUtils.ensureNoExpected)(expected, matcherName, options);
    var pass = received === void 0;

    var message = function message() {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, '', options) + '\n\n' + "Received: ".concat((0, _jestMatcherUtils.printReceived)(received));
    };

    return {
      message: message,
      pass: pass
    };
  },
  toContain: function toContain(received, expected) {
    var matcherName = 'toContain';
    var isNot = this.isNot;
    var options = {
      comment: 'indexOf',
      isNot: isNot,
      promise: this.promise
    };

    if (received == null) {
      throw new Error((0, _jestMatcherUtils.matcherErrorMessage)((0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options), "".concat((0, _jestMatcherUtils.RECEIVED_COLOR)('received'), " value must not be null nor undefined"), (0, _jestMatcherUtils.printWithType)('Received', received, _jestMatcherUtils.printReceived)));
    }

    if (typeof received === 'string') {
      var _index = received.indexOf(String(expected));

      var _pass = _index !== -1;

      var _message = function _message() {
        var labelExpected = "Expected ".concat(typeof expected === 'string' ? 'substring' : 'value');
        var labelReceived = 'Received string';
        var printLabel = (0, _jestMatcherUtils.getLabelPrinter)(labelExpected, labelReceived);
        return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + "".concat(printLabel(labelExpected)).concat(isNot ? 'not ' : '').concat((0, _jestMatcherUtils.printExpected)(expected), "\n") + "".concat(printLabel(labelReceived)).concat(isNot ? '    ' : '').concat(isNot ? (0, _print.printReceivedStringContainExpectedSubstring)(received, _index, String(expected).length) : (0, _jestMatcherUtils.printReceived)(received));
      };

      return {
        message: _message,
        pass: _pass
      };
    }

    var indexable = Array.from(received);
    var index = indexable.indexOf(expected);
    var pass = index !== -1;

    var message = function message() {
      var labelExpected = 'Expected value';
      var labelReceived = "Received ".concat((0, _jestGetType.default)(received));
      var printLabel = (0, _jestMatcherUtils.getLabelPrinter)(labelExpected, labelReceived);
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + "".concat(printLabel(labelExpected)).concat(isNot ? 'not ' : '').concat((0, _jestMatcherUtils.printExpected)(expected), "\n") + "".concat(printLabel(labelReceived)).concat(isNot ? '    ' : '').concat(isNot && Array.isArray(received) ? (0, _print.printReceivedArrayContainExpectedItem)(received, index) : (0, _jestMatcherUtils.printReceived)(received)) + (!isNot && indexable.findIndex(function (item) {
        return (0, _jasmineUtils.equals)(item, expected, [_utils.iterableEquality]);
      }) !== -1 ? "\n\n".concat(_jestMatcherUtils.SUGGEST_TO_CONTAIN_EQUAL) : '');
    };

    return {
      message: message,
      pass: pass
    };
  },
  toContainEqual: function toContainEqual(received, expected) {
    var matcherName = 'toContainEqual';
    var isNot = this.isNot;
    var options = {
      comment: 'deep equality',
      isNot: isNot,
      promise: this.promise
    };

    if (received == null) {
      throw new Error((0, _jestMatcherUtils.matcherErrorMessage)((0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options), "".concat((0, _jestMatcherUtils.RECEIVED_COLOR)('received'), " value must not be null nor undefined"), (0, _jestMatcherUtils.printWithType)('Received', received, _jestMatcherUtils.printReceived)));
    }

    var index = Array.from(received).findIndex(function (item) {
      return (0, _jasmineUtils.equals)(item, expected, [_utils.iterableEquality]);
    });
    var pass = index !== -1;

    var message = function message() {
      var labelExpected = 'Expected value';
      var labelReceived = "Received ".concat((0, _jestGetType.default)(received));
      var printLabel = (0, _jestMatcherUtils.getLabelPrinter)(labelExpected, labelReceived);
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + "".concat(printLabel(labelExpected)).concat(isNot ? 'not ' : '').concat((0, _jestMatcherUtils.printExpected)(expected), "\n") + "".concat(printLabel(labelReceived)).concat(isNot ? '    ' : '').concat(isNot && Array.isArray(received) ? (0, _print.printReceivedArrayContainExpectedItem)(received, index) : (0, _jestMatcherUtils.printReceived)(received));
    };

    return {
      message: message,
      pass: pass
    };
  },
  toEqual: function toEqual(received, expected) {
    var _this2 = this;

    var matcherName = 'toEqual';
    var options = {
      comment: 'deep equality',
      isNot: this.isNot,
      promise: this.promise
    };
    var pass = (0, _jasmineUtils.equals)(received, expected, [_utils.iterableEquality]);
    var message = pass ? function () {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + "Expected: not ".concat((0, _jestMatcherUtils.printExpected)(expected), "\n") + ((0, _jestMatcherUtils.stringify)(expected) !== (0, _jestMatcherUtils.stringify)(received) ? "Received:     ".concat((0, _jestMatcherUtils.printReceived)(received)) : '');
    } : function () {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + (0, _jestMatcherUtils.printDiffOrStringify)(expected, received, EXPECTED_LABEL, RECEIVED_LABEL, isExpand(_this2.expand));
    }; // Passing the actual and expected objects so that a custom reporter
    // could access them, for example in order to display a custom visual diff,
    // or create a different error message

    return {
      actual: received,
      expected: expected,
      message: message,
      name: matcherName,
      pass: pass
    };
  },
  toHaveLength: function toHaveLength(received, expected) {
    var matcherName = 'toHaveLength';
    var isNot = this.isNot;
    var options = {
      isNot: isNot,
      promise: this.promise
    };

    if (typeof (received === null || received === void 0 ? void 0 : received.length) !== 'number') {
      throw new Error((0, _jestMatcherUtils.matcherErrorMessage)((0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options), "".concat((0, _jestMatcherUtils.RECEIVED_COLOR)('received'), " value must have a length property whose value must be a number"), (0, _jestMatcherUtils.printWithType)('Received', received, _jestMatcherUtils.printReceived)));
    }

    (0, _jestMatcherUtils.ensureExpectedIsNonNegativeInteger)(expected, matcherName, options);
    var pass = received.length === expected;

    var message = function message() {
      var labelExpected = 'Expected length';
      var labelReceivedLength = 'Received length';
      var labelReceivedValue = "Received ".concat((0, _jestGetType.default)(received));
      var printLabel = (0, _jestMatcherUtils.getLabelPrinter)(labelExpected, labelReceivedLength, labelReceivedValue);
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + "".concat(printLabel(labelExpected)).concat(isNot ? 'not ' : '').concat((0, _jestMatcherUtils.printExpected)(expected), "\n") + (isNot ? '' : "".concat(printLabel(labelReceivedLength)).concat((0, _jestMatcherUtils.printReceived)(received.length), "\n")) + "".concat(printLabel(labelReceivedValue)).concat(isNot ? '    ' : '').concat((0, _jestMatcherUtils.printReceived)(received));
    };

    return {
      message: message,
      pass: pass
    };
  },
  toHaveProperty: function toHaveProperty(received, expectedPath, expectedValue) {
    var _this3 = this;

    var matcherName = 'toHaveProperty';
    var expectedArgument = 'path';
    var hasValue = arguments.length === 3;
    var options = {
      isNot: this.isNot,
      promise: this.promise,
      secondArgument: hasValue ? 'value' : ''
    };

    if (received === null || received === undefined) {
      throw new Error((0, _jestMatcherUtils.matcherErrorMessage)((0, _jestMatcherUtils.matcherHint)(matcherName, undefined, expectedArgument, options), "".concat((0, _jestMatcherUtils.RECEIVED_COLOR)('received'), " value must not be null nor undefined"), (0, _jestMatcherUtils.printWithType)('Received', received, _jestMatcherUtils.printReceived)));
    }

    var expectedPathType = (0, _jestGetType.default)(expectedPath);

    if (expectedPathType !== 'string' && expectedPathType !== 'array') {
      throw new Error((0, _jestMatcherUtils.matcherErrorMessage)((0, _jestMatcherUtils.matcherHint)(matcherName, undefined, expectedArgument, options), "".concat((0, _jestMatcherUtils.EXPECTED_COLOR)('expected'), " path must be a string or array"), (0, _jestMatcherUtils.printWithType)('Expected', expectedPath, _jestMatcherUtils.printExpected)));
    }

    var expectedPathLength = typeof expectedPath === 'string' ? expectedPath.split('.').length : expectedPath.length;

    if (expectedPathType === 'array' && expectedPathLength === 0) {
      throw new Error((0, _jestMatcherUtils.matcherErrorMessage)((0, _jestMatcherUtils.matcherHint)(matcherName, undefined, expectedArgument, options), "".concat((0, _jestMatcherUtils.EXPECTED_COLOR)('expected'), " path must not be an empty array"), (0, _jestMatcherUtils.printWithType)('Expected', expectedPath, _jestMatcherUtils.printExpected)));
    }

    var result = (0, _utils.getPath)(received, expectedPath);
    var lastTraversedObject = result.lastTraversedObject,
        hasEndProp = result.hasEndProp;
    var receivedPath = result.traversedPath;
    var hasCompletePath = receivedPath.length === expectedPathLength;
    var receivedValue = hasCompletePath ? result.value : lastTraversedObject;
    var pass = hasValue ? (0, _jasmineUtils.equals)(result.value, expectedValue, [_utils.iterableEquality]) : Boolean(hasEndProp); // theoretically undefined if empty path
    // Remove type cast if we rewrite getPath as iterative algorithm.
    // Delete this unique report if future breaking change
    // removes the edge case that expected value undefined
    // also matches absence of a property with the key path.

    if (pass && !hasCompletePath) {
      var _message2 = function _message2() {
        return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, expectedArgument, options) + '\n\n' + "Expected path: ".concat((0, _jestMatcherUtils.printExpected)(expectedPath), "\n") + "Received path: ".concat((0, _jestMatcherUtils.printReceived)(expectedPathType === 'array' || receivedPath.length === 0 ? receivedPath : receivedPath.join('.')), "\n\n") + "Expected value: not ".concat((0, _jestMatcherUtils.printExpected)(expectedValue), "\n") + "Received value:     ".concat((0, _jestMatcherUtils.printReceived)(receivedValue), "\n\n") + (0, _jestMatcherUtils.DIM_COLOR)('Because a positive assertion passes for expected value undefined if the property does not exist, this negative assertion fails unless the property does exist and has a defined value');
      };

      return {
        message: _message2,
        pass: pass
      };
    }

    var message = pass ? function () {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, expectedArgument, options) + '\n\n' + (hasValue ? "Expected path: ".concat((0, _jestMatcherUtils.printExpected)(expectedPath), "\n\n") + "Expected value: not ".concat((0, _jestMatcherUtils.printExpected)(expectedValue)) + ((0, _jestMatcherUtils.stringify)(expectedValue) !== (0, _jestMatcherUtils.stringify)(receivedValue) ? "\nReceived value:     ".concat((0, _jestMatcherUtils.printReceived)(receivedValue)) : '') : "Expected path: not ".concat((0, _jestMatcherUtils.printExpected)(expectedPath), "\n\n") + "Received value: ".concat((0, _jestMatcherUtils.printReceived)(receivedValue)));
    } : function () {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, expectedArgument, options) + '\n\n' + "Expected path: ".concat((0, _jestMatcherUtils.printExpected)(expectedPath), "\n") + (hasCompletePath ? '\n' + (0, _jestMatcherUtils.printDiffOrStringify)(expectedValue, receivedValue, EXPECTED_VALUE_LABEL, RECEIVED_VALUE_LABEL, isExpand(_this3.expand)) : "Received path: ".concat((0, _jestMatcherUtils.printReceived)(expectedPathType === 'array' || receivedPath.length === 0 ? receivedPath : receivedPath.join('.')), "\n\n") + (hasValue ? "Expected value: ".concat((0, _jestMatcherUtils.printExpected)(expectedValue), "\n") : '') + "Received value: ".concat((0, _jestMatcherUtils.printReceived)(receivedValue)));
    };
    return {
      message: message,
      pass: pass
    };
  },
  toMatch: function toMatch(received, expected) {
    var matcherName = 'toMatch';
    var options = {
      isNot: this.isNot,
      promise: this.promise
    };

    if (typeof received !== 'string') {
      throw new Error((0, _jestMatcherUtils.matcherErrorMessage)((0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options), "".concat((0, _jestMatcherUtils.RECEIVED_COLOR)('received'), " value must be a string"), (0, _jestMatcherUtils.printWithType)('Received', received, _jestMatcherUtils.printReceived)));
    }

    if (!(typeof expected === 'string') && !(expected && typeof expected.test === 'function')) {
      throw new Error((0, _jestMatcherUtils.matcherErrorMessage)((0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options), "".concat((0, _jestMatcherUtils.EXPECTED_COLOR)('expected'), " value must be a string or regular expression"), (0, _jestMatcherUtils.printWithType)('Expected', expected, _jestMatcherUtils.printExpected)));
    }

    var pass = typeof expected === 'string' ? received.includes(expected) : new RegExp(expected).test(received);
    var message = pass ? function () {
      return typeof expected === 'string' ? (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + "Expected substring: not ".concat((0, _jestMatcherUtils.printExpected)(expected), "\n") + "Received string:        ".concat((0, _print.printReceivedStringContainExpectedSubstring)(received, received.indexOf(expected), expected.length)) : (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + "Expected pattern: not ".concat((0, _jestMatcherUtils.printExpected)(expected), "\n") + "Received string:      ".concat((0, _print.printReceivedStringContainExpectedResult)(received, typeof expected.exec === 'function' ? expected.exec(received) : null));
    } : function () {
      var labelExpected = "Expected ".concat(typeof expected === 'string' ? 'substring' : 'pattern');
      var labelReceived = 'Received string';
      var printLabel = (0, _jestMatcherUtils.getLabelPrinter)(labelExpected, labelReceived);
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + "".concat(printLabel(labelExpected)).concat((0, _jestMatcherUtils.printExpected)(expected), "\n") + "".concat(printLabel(labelReceived)).concat((0, _jestMatcherUtils.printReceived)(received));
    };
    return {
      message: message,
      pass: pass
    };
  },
  toMatchObject: function toMatchObject(received, expected) {
    var _this4 = this;

    var matcherName = 'toMatchObject';
    var options = {
      isNot: this.isNot,
      promise: this.promise
    };

    if (_typeof(received) !== 'object' || received === null) {
      throw new Error((0, _jestMatcherUtils.matcherErrorMessage)((0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options), "".concat((0, _jestMatcherUtils.RECEIVED_COLOR)('received'), " value must be a non-null object"), (0, _jestMatcherUtils.printWithType)('Received', received, _jestMatcherUtils.printReceived)));
    }

    if (_typeof(expected) !== 'object' || expected === null) {
      throw new Error((0, _jestMatcherUtils.matcherErrorMessage)((0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options), "".concat((0, _jestMatcherUtils.EXPECTED_COLOR)('expected'), " value must be a non-null object"), (0, _jestMatcherUtils.printWithType)('Expected', expected, _jestMatcherUtils.printExpected)));
    }

    var pass = (0, _jasmineUtils.equals)(received, expected, [_utils.iterableEquality, _utils.subsetEquality]);
    var message = pass ? function () {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + "Expected: not ".concat((0, _jestMatcherUtils.printExpected)(expected)) + ((0, _jestMatcherUtils.stringify)(expected) !== (0, _jestMatcherUtils.stringify)(received) ? "\nReceived:     ".concat((0, _jestMatcherUtils.printReceived)(received)) : '');
    } : function () {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + (0, _jestMatcherUtils.printDiffOrStringify)(expected, (0, _utils.getObjectSubset)(received, expected), EXPECTED_LABEL, RECEIVED_LABEL, isExpand(_this4.expand));
    };
    return {
      message: message,
      pass: pass
    };
  },
  toStrictEqual: function toStrictEqual(received, expected) {
    var _this5 = this;

    var matcherName = 'toStrictEqual';
    var options = {
      comment: 'deep equality',
      isNot: this.isNot,
      promise: this.promise
    };
    var pass = (0, _jasmineUtils.equals)(received, expected, toStrictEqualTesters, true);
    var message = pass ? function () {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + "Expected: not ".concat((0, _jestMatcherUtils.printExpected)(expected), "\n") + ((0, _jestMatcherUtils.stringify)(expected) !== (0, _jestMatcherUtils.stringify)(received) ? "Received:     ".concat((0, _jestMatcherUtils.printReceived)(received)) : '');
    } : function () {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + (0, _jestMatcherUtils.printDiffOrStringify)(expected, received, EXPECTED_LABEL, RECEIVED_LABEL, isExpand(_this5.expand));
    }; // Passing the actual and expected objects so that a custom reporter
    // could access them, for example in order to display a custom visual diff,
    // or create a different error message

    return {
      actual: received,
      expected: expected,
      message: message,
      name: matcherName,
      pass: pass
    };
  }
};
var _default = matchers;
exports.default = _default;

/***/ }),

/***/ "./packages/expect/src/print.ts":
/*!**************************************!*\
  !*** ./packages/expect/src/print.ts ***!
  \**************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.printReceivedConstructorNameNot = exports.printReceivedConstructorName = exports.printExpectedConstructorNameNot = exports.printExpectedConstructorName = exports.printCloseTo = exports.printReceivedArrayContainExpectedItem = exports.printReceivedStringContainExpectedResult = exports.printReceivedStringContainExpectedSubstring = void 0;

var _jestMatcherUtils = __webpack_require__(/*! jest-matcher-utils */ "./packages/jest-matcher-utils/build/index.js");

/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
// Format substring but do not enclose in double quote marks.
// The replacement is compatible with pretty-format package.
var printSubstring = function printSubstring(val) {
  return val.replace(/"|\\/g, '\\$&');
};

var printReceivedStringContainExpectedSubstring = function printReceivedStringContainExpectedSubstring(received, start, length) {
  return (0, _jestMatcherUtils.RECEIVED_COLOR)('"' + printSubstring(received.slice(0, start)) + (0, _jestMatcherUtils.INVERTED_COLOR)(printSubstring(received.slice(start, start + length))) + printSubstring(received.slice(start + length)) + '"');
};

exports.printReceivedStringContainExpectedSubstring = printReceivedStringContainExpectedSubstring;

var printReceivedStringContainExpectedResult = function printReceivedStringContainExpectedResult(received, result) {
  return result === null ? (0, _jestMatcherUtils.printReceived)(received) : printReceivedStringContainExpectedSubstring(received, result.index, result[0].length);
}; // The serialized array is compatible with pretty-format package min option.
// However, items have default stringify depth (instead of depth - 1)
// so expected item looks consistent by itself and enclosed in the array.


exports.printReceivedStringContainExpectedResult = printReceivedStringContainExpectedResult;

var printReceivedArrayContainExpectedItem = function printReceivedArrayContainExpectedItem(received, index) {
  return (0, _jestMatcherUtils.RECEIVED_COLOR)('[' + received.map(function (item, i) {
    var stringified = (0, _jestMatcherUtils.stringify)(item);
    return i === index ? (0, _jestMatcherUtils.INVERTED_COLOR)(stringified) : stringified;
  }).join(', ') + ']');
};

exports.printReceivedArrayContainExpectedItem = printReceivedArrayContainExpectedItem;

var printCloseTo = function printCloseTo(receivedDiff, expectedDiff, precision, isNot) {
  var receivedDiffString = (0, _jestMatcherUtils.stringify)(receivedDiff);
  var expectedDiffString = receivedDiffString.includes('e') ? // toExponential arg is number of digits after the decimal point.
  expectedDiff.toExponential(0) : 0 <= precision && precision < 20 ? // toFixed arg is number of digits after the decimal point.
  // It may be a value between 0 and 20 inclusive.
  // Implementations may optionally support a larger range of values.
  expectedDiff.toFixed(precision + 1) : (0, _jestMatcherUtils.stringify)(expectedDiff);
  return "Expected precision:  ".concat(isNot ? '    ' : '', "  ").concat((0, _jestMatcherUtils.stringify)(precision), "\n") + "Expected difference: ".concat(isNot ? 'not ' : '', "< ").concat((0, _jestMatcherUtils.EXPECTED_COLOR)(expectedDiffString), "\n") + "Received difference: ".concat(isNot ? '    ' : '', "  ").concat((0, _jestMatcherUtils.RECEIVED_COLOR)(receivedDiffString));
};

exports.printCloseTo = printCloseTo;

var printExpectedConstructorName = function printExpectedConstructorName(label, expected) {
  return printConstructorName(label, expected, false, true) + '\n';
};

exports.printExpectedConstructorName = printExpectedConstructorName;

var printExpectedConstructorNameNot = function printExpectedConstructorNameNot(label, expected) {
  return printConstructorName(label, expected, true, true) + '\n';
};

exports.printExpectedConstructorNameNot = printExpectedConstructorNameNot;

var printReceivedConstructorName = function printReceivedConstructorName(label, received) {
  return printConstructorName(label, received, false, false) + '\n';
}; // Do not call function if received is equal to expected.


exports.printReceivedConstructorName = printReceivedConstructorName;

var printReceivedConstructorNameNot = function printReceivedConstructorNameNot(label, received, expected) {
  return typeof expected.name === 'string' && expected.name.length !== 0 && typeof received.name === 'string' && received.name.length !== 0 ? printConstructorName(label, received, true, false) + " ".concat(Object.getPrototypeOf(received) === expected ? 'extends' : 'extends … extends', " ").concat((0, _jestMatcherUtils.EXPECTED_COLOR)(expected.name)) + '\n' : printConstructorName(label, received, false, false) + '\n';
};

exports.printReceivedConstructorNameNot = printReceivedConstructorNameNot;

var printConstructorName = function printConstructorName(label, constructor, isNot, isExpected) {
  return typeof constructor.name !== 'string' ? "".concat(label, " name is not a string") : constructor.name.length === 0 ? "".concat(label, " name is an empty string") : "".concat(label, ": ").concat(!isNot ? '' : isExpected ? 'not ' : '    ').concat(isExpected ? (0, _jestMatcherUtils.EXPECTED_COLOR)(constructor.name) : (0, _jestMatcherUtils.RECEIVED_COLOR)(constructor.name));
};

/***/ }),

/***/ "./packages/expect/src/spyMatchers.ts":
/*!********************************************!*\
  !*** ./packages/expect/src/spyMatchers.ts ***!
  \********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _jestGetType = _interopRequireDefault(__webpack_require__(/*! jest-get-type */ "./packages/jest-get-type/build/index.js"));

var _jestMatcherUtils = __webpack_require__(/*! jest-matcher-utils */ "./packages/jest-matcher-utils/build/index.js");

var _jasmineUtils = __webpack_require__(/*! ./jasmineUtils */ "./packages/expect/src/jasmineUtils.ts");

var _utils = __webpack_require__(/*! ./utils */ "./packages/expect/src/utils.ts");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _iterableToArrayLimit(arr, i) { if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return; var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

// The optional property of matcher context is true if undefined.
var isExpand = function isExpand(expand) {
  return expand !== false;
};

var PRINT_LIMIT = 3;
var NO_ARGUMENTS = 'called with 0 arguments';

var printExpectedArgs = function printExpectedArgs(expected) {
  return expected.length === 0 ? NO_ARGUMENTS : expected.map(function (arg) {
    return (0, _jestMatcherUtils.printExpected)(arg);
  }).join(', ');
};

var printReceivedArgs = function printReceivedArgs(received, expected) {
  return received.length === 0 ? NO_ARGUMENTS : received.map(function (arg, i) {
    return Array.isArray(expected) && i < expected.length && isEqualValue(expected[i], arg) ? printCommon(arg) : (0, _jestMatcherUtils.printReceived)(arg);
  }).join(', ');
};

var printCommon = function printCommon(val) {
  return (0, _jestMatcherUtils.DIM_COLOR)((0, _jestMatcherUtils.stringify)(val));
};

var isEqualValue = function isEqualValue(expected, received) {
  return (0, _jasmineUtils.equals)(expected, received, [_utils.iterableEquality]);
};

var isEqualCall = function isEqualCall(expected, received) {
  return isEqualValue(expected, received);
};

var isEqualReturn = function isEqualReturn(expected, result) {
  return result.type === 'return' && isEqualValue(expected, result.value);
};

var countReturns = function countReturns(results) {
  return results.reduce(function (n, result) {
    return result.type === 'return' ? n + 1 : n;
  }, 0);
};

var printNumberOfReturns = function printNumberOfReturns(countReturns, countCalls) {
  return "\nNumber of returns: ".concat((0, _jestMatcherUtils.printReceived)(countReturns)) + (countCalls !== countReturns ? "\nNumber of calls:   ".concat((0, _jestMatcherUtils.printReceived)(countCalls)) : '');
};

// Given a label, return a function which given a string,
// right-aligns it preceding the colon in the label.
var getRightAlignedPrinter = function getRightAlignedPrinter(label) {
  // Assume that the label contains a colon.
  var index = label.indexOf(':');
  var suffix = label.slice(index);
  return function (string, isExpectedCall) {
    return (isExpectedCall ? '->' + ' '.repeat(Math.max(0, index - 2 - string.length)) : ' '.repeat(Math.max(index - string.length))) + string + suffix;
  };
};

var printReceivedCallsNegative = function printReceivedCallsNegative(expected, indexedCalls, isOnlyCall, iExpectedCall) {
  if (indexedCalls.length === 0) {
    return '';
  }

  var label = 'Received:     ';

  if (isOnlyCall) {
    return label + printReceivedArgs(indexedCalls[0], expected) + '\n';
  }

  var printAligned = getRightAlignedPrinter(label);
  return 'Received\n' + indexedCalls.reduce(function (printed, _ref) {
    var _ref2 = _slicedToArray(_ref, 2),
        i = _ref2[0],
        args = _ref2[1];

    return printed + printAligned(String(i + 1), i === iExpectedCall) + printReceivedArgs(args, expected) + '\n';
  }, '');
};

var printExpectedReceivedCallsPositive = function printExpectedReceivedCallsPositive(expected, indexedCalls, expand, isOnlyCall, iExpectedCall) {
  var expectedLine = "Expected: ".concat(printExpectedArgs(expected), "\n");

  if (indexedCalls.length === 0) {
    return expectedLine;
  }

  var label = 'Received: ';

  if (isOnlyCall && (iExpectedCall === 0 || iExpectedCall === undefined)) {
    var received = indexedCalls[0][1];

    if (isLineDiffableCall(expected, received)) {
      // Display diff without indentation.
      var lines = [(0, _jestMatcherUtils.EXPECTED_COLOR)('- Expected'), (0, _jestMatcherUtils.RECEIVED_COLOR)('+ Received'), ''];
      var length = Math.max(expected.length, received.length);

      for (var i = 0; i < length; i += 1) {
        if (i < expected.length && i < received.length) {
          if (isEqualValue(expected[i], received[i])) {
            lines.push("  ".concat(printCommon(received[i]), ","));
            continue;
          }

          if (isLineDiffableArg(expected[i], received[i])) {
            var difference = (0, _jestMatcherUtils.diff)(expected[i], received[i], {
              expand: expand
            });

            if (typeof difference === 'string' && difference.includes('- Expected') && difference.includes('+ Received')) {
              // Omit annotation in case multiple args have diff.
              lines.push(difference.split('\n').slice(3).join('\n') + ',');
              continue;
            }
          }
        }

        if (i < expected.length) {
          lines.push((0, _jestMatcherUtils.EXPECTED_COLOR)('- ' + (0, _jestMatcherUtils.stringify)(expected[i])) + ',');
        }

        if (i < received.length) {
          lines.push((0, _jestMatcherUtils.RECEIVED_COLOR)('+ ' + (0, _jestMatcherUtils.stringify)(received[i])) + ',');
        }
      }

      return lines.join('\n') + '\n';
    }

    return expectedLine + label + printReceivedArgs(received, expected) + '\n';
  }

  var printAligned = getRightAlignedPrinter(label);
  return expectedLine + 'Received\n' + indexedCalls.reduce(function (printed, _ref3) {
    var _ref4 = _slicedToArray(_ref3, 2),
        i = _ref4[0],
        received = _ref4[1];

    var aligned = printAligned(String(i + 1), i === iExpectedCall);
    return printed + ((i === iExpectedCall || iExpectedCall === undefined) && isLineDiffableCall(expected, received) ? aligned.replace(': ', '\n') + printDiffCall(expected, received, expand) : aligned + printReceivedArgs(received, expected)) + '\n';
  }, '');
};

var indentation = 'Received'.replace(/\w/g, ' ');

var printDiffCall = function printDiffCall(expected, received, expand) {
  return received.map(function (arg, i) {
    if (i < expected.length) {
      if (isEqualValue(expected[i], arg)) {
        return indentation + '  ' + printCommon(arg) + ',';
      }

      if (isLineDiffableArg(expected[i], arg)) {
        var difference = (0, _jestMatcherUtils.diff)(expected[i], arg, {
          expand: expand
        });

        if (typeof difference === 'string' && difference.includes('- Expected') && difference.includes('+ Received')) {
          // Display diff with indentation.
          // Omit annotation in case multiple args have diff.
          return difference.split('\n').slice(3).map(function (line) {
            return indentation + line;
          }).join('\n') + ',';
        }
      }
    } // Display + only if received arg has no corresponding expected arg.


    return indentation + (i < expected.length ? '  ' + (0, _jestMatcherUtils.printReceived)(arg) : (0, _jestMatcherUtils.RECEIVED_COLOR)('+ ' + (0, _jestMatcherUtils.stringify)(arg))) + ',';
  }).join('\n');
};

var isLineDiffableCall = function isLineDiffableCall(expected, received) {
  return expected.some(function (arg, i) {
    return i < received.length && isLineDiffableArg(arg, received[i]);
  });
}; // Almost redundant with function in jest-matcher-utils,
// except no line diff for any strings.


var isLineDiffableArg = function isLineDiffableArg(expected, received) {
  var expectedType = (0, _jestGetType.default)(expected);
  var receivedType = (0, _jestGetType.default)(received);

  if (expectedType !== receivedType) {
    return false;
  }

  if (_jestGetType.default.isPrimitive(expected)) {
    return false;
  }

  if (expectedType === 'date' || expectedType === 'function' || expectedType === 'regexp') {
    return false;
  }

  if (expected instanceof Error && received instanceof Error) {
    return false;
  }

  if (expectedType === 'object' && typeof expected.asymmetricMatch === 'function') {
    return false;
  }

  if (receivedType === 'object' && typeof received.asymmetricMatch === 'function') {
    return false;
  }

  return true;
};

var printResult = function printResult(result, expected) {
  return result.type === 'throw' ? 'function call threw an error' : result.type === 'incomplete' ? 'function call has not returned yet' : isEqualValue(expected, result.value) ? printCommon(result.value) : (0, _jestMatcherUtils.printReceived)(result.value);
};

// Return either empty string or one line per indexed result,
// so additional empty line can separate from `Number of returns` which follows.
var printReceivedResults = function printReceivedResults(label, expected, indexedResults, isOnlyCall, iExpectedCall) {
  if (indexedResults.length === 0) {
    return '';
  }

  if (isOnlyCall && (iExpectedCall === 0 || iExpectedCall === undefined)) {
    return label + printResult(indexedResults[0][1], expected) + '\n';
  }

  var printAligned = getRightAlignedPrinter(label);
  return label.replace(':', '').trim() + '\n' + indexedResults.reduce(function (printed, _ref5) {
    var _ref6 = _slicedToArray(_ref5, 2),
        i = _ref6[0],
        result = _ref6[1];

    return printed + printAligned(String(i + 1), i === iExpectedCall) + printResult(result, expected) + '\n';
  }, '');
};

var createToBeCalledMatcher = function createToBeCalledMatcher(matcherName) {
  return function (received, expected) {
    var expectedArgument = '';
    var options = {
      isNot: this.isNot,
      promise: this.promise
    };
    (0, _jestMatcherUtils.ensureNoExpected)(expected, matcherName, options);
    ensureMockOrSpy(received, matcherName, expectedArgument, options);
    var receivedIsSpy = isSpy(received);
    var receivedName = receivedIsSpy ? 'spy' : received.getMockName();
    var count = receivedIsSpy ? received.calls.count() : received.mock.calls.length;
    var calls = receivedIsSpy ? received.calls.all().map(function (x) {
      return x.args;
    }) : received.mock.calls;
    var pass = count > 0;
    var message = pass ? function () {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, receivedName, expectedArgument, options) + '\n\n' + "Expected number of calls: ".concat((0, _jestMatcherUtils.printExpected)(0), "\n") + "Received number of calls: ".concat((0, _jestMatcherUtils.printReceived)(count), "\n\n") + calls.reduce(function (lines, args, i) {
        if (lines.length < PRINT_LIMIT) {
          lines.push("".concat(i + 1, ": ").concat(printReceivedArgs(args)));
        }

        return lines;
      }, []).join('\n');
    } : function () {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, receivedName, expectedArgument, options) + '\n\n' + "Expected number of calls: >= ".concat((0, _jestMatcherUtils.printExpected)(1), "\n") + "Received number of calls:    ".concat((0, _jestMatcherUtils.printReceived)(count));
    };
    return {
      message: message,
      pass: pass
    };
  };
};

var createToReturnMatcher = function createToReturnMatcher(matcherName) {
  return function (received, expected) {
    var expectedArgument = '';
    var options = {
      isNot: this.isNot,
      promise: this.promise
    };
    (0, _jestMatcherUtils.ensureNoExpected)(expected, matcherName, options);
    ensureMock(received, matcherName, expectedArgument, options);
    var receivedName = received.getMockName(); // Count return values that correspond only to calls that returned

    var count = received.mock.results.reduce(function (n, result) {
      return result.type === 'return' ? n + 1 : n;
    }, 0);
    var pass = count > 0;
    var message = pass ? function () {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, receivedName, expectedArgument, options) + '\n\n' + "Expected number of returns: ".concat((0, _jestMatcherUtils.printExpected)(0), "\n") + "Received number of returns: ".concat((0, _jestMatcherUtils.printReceived)(count), "\n\n") + received.mock.results.reduce(function (lines, result, i) {
        if (result.type === 'return' && lines.length < PRINT_LIMIT) {
          lines.push("".concat(i + 1, ": ").concat((0, _jestMatcherUtils.printReceived)(result.value)));
        }

        return lines;
      }, []).join('\n') + (received.mock.calls.length !== count ? "\n\nReceived number of calls:   ".concat((0, _jestMatcherUtils.printReceived)(received.mock.calls.length)) : '');
    } : function () {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, receivedName, expectedArgument, options) + '\n\n' + "Expected number of returns: >= ".concat((0, _jestMatcherUtils.printExpected)(1), "\n") + "Received number of returns:    ".concat((0, _jestMatcherUtils.printReceived)(count)) + (received.mock.calls.length !== count ? "\nReceived number of calls:      ".concat((0, _jestMatcherUtils.printReceived)(received.mock.calls.length)) : '');
    };
    return {
      message: message,
      pass: pass
    };
  };
};

var createToBeCalledTimesMatcher = function createToBeCalledTimesMatcher(matcherName) {
  return function (received, expected) {
    var expectedArgument = 'expected';
    var options = {
      isNot: this.isNot,
      promise: this.promise
    };
    (0, _jestMatcherUtils.ensureExpectedIsNonNegativeInteger)(expected, matcherName, options);
    ensureMockOrSpy(received, matcherName, expectedArgument, options);
    var receivedIsSpy = isSpy(received);
    var receivedName = receivedIsSpy ? 'spy' : received.getMockName();
    var count = receivedIsSpy ? received.calls.count() : received.mock.calls.length;
    var pass = count === expected;
    var message = pass ? function () {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, receivedName, expectedArgument, options) + "\n\n" + "Expected number of calls: not ".concat((0, _jestMatcherUtils.printExpected)(expected));
    } : function () {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, receivedName, expectedArgument, options) + '\n\n' + "Expected number of calls: ".concat((0, _jestMatcherUtils.printExpected)(expected), "\n") + "Received number of calls: ".concat((0, _jestMatcherUtils.printReceived)(count));
    };
    return {
      message: message,
      pass: pass
    };
  };
};

var createToReturnTimesMatcher = function createToReturnTimesMatcher(matcherName) {
  return function (received, expected) {
    var expectedArgument = 'expected';
    var options = {
      isNot: this.isNot,
      promise: this.promise
    };
    (0, _jestMatcherUtils.ensureExpectedIsNonNegativeInteger)(expected, matcherName, options);
    ensureMock(received, matcherName, expectedArgument, options);
    var receivedName = received.getMockName(); // Count return values that correspond only to calls that returned

    var count = received.mock.results.reduce(function (n, result) {
      return result.type === 'return' ? n + 1 : n;
    }, 0);
    var pass = count === expected;
    var message = pass ? function () {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, receivedName, expectedArgument, options) + "\n\n" + "Expected number of returns: not ".concat((0, _jestMatcherUtils.printExpected)(expected)) + (received.mock.calls.length !== count ? "\n\nReceived number of calls:       ".concat((0, _jestMatcherUtils.printReceived)(received.mock.calls.length)) : '');
    } : function () {
      return (0, _jestMatcherUtils.matcherHint)(matcherName, receivedName, expectedArgument, options) + '\n\n' + "Expected number of returns: ".concat((0, _jestMatcherUtils.printExpected)(expected), "\n") + "Received number of returns: ".concat((0, _jestMatcherUtils.printReceived)(count)) + (received.mock.calls.length !== count ? "\nReceived number of calls:   ".concat((0, _jestMatcherUtils.printReceived)(received.mock.calls.length)) : '');
    };
    return {
      message: message,
      pass: pass
    };
  };
};

var createToBeCalledWithMatcher = function createToBeCalledWithMatcher(matcherName) {
  return function (received) {
    var _this = this;

    for (var _len = arguments.length, expected = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      expected[_key - 1] = arguments[_key];
    }

    var expectedArgument = '...expected';
    var options = {
      isNot: this.isNot,
      promise: this.promise
    };
    ensureMockOrSpy(received, matcherName, expectedArgument, options);
    var receivedIsSpy = isSpy(received);
    var receivedName = receivedIsSpy ? 'spy' : received.getMockName();
    var calls = receivedIsSpy ? received.calls.all().map(function (x) {
      return x.args;
    }) : received.mock.calls;
    var pass = calls.some(function (call) {
      return isEqualCall(expected, call);
    });
    var message = pass ? function () {
      // Some examples of calls that are equal to expected value.
      var indexedCalls = [];
      var i = 0;

      while (i < calls.length && indexedCalls.length < PRINT_LIMIT) {
        if (isEqualCall(expected, calls[i])) {
          indexedCalls.push([i, calls[i]]);
        }

        i += 1;
      }

      return (0, _jestMatcherUtils.matcherHint)(matcherName, receivedName, expectedArgument, options) + '\n\n' + "Expected: not ".concat(printExpectedArgs(expected), "\n") + (calls.length === 1 && (0, _jestMatcherUtils.stringify)(calls[0]) === (0, _jestMatcherUtils.stringify)(expected) ? '' : printReceivedCallsNegative(expected, indexedCalls, calls.length === 1)) + "\nNumber of calls: ".concat((0, _jestMatcherUtils.printReceived)(calls.length));
    } : function () {
      // Some examples of calls that are not equal to expected value.
      var indexedCalls = [];
      var i = 0;

      while (i < calls.length && indexedCalls.length < PRINT_LIMIT) {
        indexedCalls.push([i, calls[i]]);
        i += 1;
      }

      return (0, _jestMatcherUtils.matcherHint)(matcherName, receivedName, expectedArgument, options) + '\n\n' + printExpectedReceivedCallsPositive(expected, indexedCalls, isExpand(_this.expand), calls.length === 1) + "\nNumber of calls: ".concat((0, _jestMatcherUtils.printReceived)(calls.length));
    };
    return {
      message: message,
      pass: pass
    };
  };
};

var createToReturnWithMatcher = function createToReturnWithMatcher(matcherName) {
  return function (received, expected) {
    var expectedArgument = 'expected';
    var options = {
      isNot: this.isNot,
      promise: this.promise
    };
    ensureMock(received, matcherName, expectedArgument, options);
    var receivedName = received.getMockName();
    var _received$mock = received.mock,
        calls = _received$mock.calls,
        results = _received$mock.results;
    var pass = results.some(function (result) {
      return isEqualReturn(expected, result);
    });
    var message = pass ? function () {
      // Some examples of results that are equal to expected value.
      var indexedResults = [];
      var i = 0;

      while (i < results.length && indexedResults.length < PRINT_LIMIT) {
        if (isEqualReturn(expected, results[i])) {
          indexedResults.push([i, results[i]]);
        }

        i += 1;
      }

      return (0, _jestMatcherUtils.matcherHint)(matcherName, receivedName, expectedArgument, options) + '\n\n' + "Expected: not ".concat((0, _jestMatcherUtils.printExpected)(expected), "\n") + (results.length === 1 && results[0].type === 'return' && (0, _jestMatcherUtils.stringify)(results[0].value) === (0, _jestMatcherUtils.stringify)(expected) ? '' : printReceivedResults('Received:     ', expected, indexedResults, results.length === 1)) + printNumberOfReturns(countReturns(results), calls.length);
    } : function () {
      // Some examples of results that are not equal to expected value.
      var indexedResults = [];
      var i = 0;

      while (i < results.length && indexedResults.length < PRINT_LIMIT) {
        indexedResults.push([i, results[i]]);
        i += 1;
      }

      return (0, _jestMatcherUtils.matcherHint)(matcherName, receivedName, expectedArgument, options) + '\n\n' + "Expected: ".concat((0, _jestMatcherUtils.printExpected)(expected), "\n") + printReceivedResults('Received: ', expected, indexedResults, results.length === 1) + printNumberOfReturns(countReturns(results), calls.length);
    };
    return {
      message: message,
      pass: pass
    };
  };
};

var createLastCalledWithMatcher = function createLastCalledWithMatcher(matcherName) {
  return function (received) {
    var _this2 = this;

    for (var _len2 = arguments.length, expected = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      expected[_key2 - 1] = arguments[_key2];
    }

    var expectedArgument = '...expected';
    var options = {
      isNot: this.isNot,
      promise: this.promise
    };
    ensureMockOrSpy(received, matcherName, expectedArgument, options);
    var receivedIsSpy = isSpy(received);
    var receivedName = receivedIsSpy ? 'spy' : received.getMockName();
    var calls = receivedIsSpy ? received.calls.all().map(function (x) {
      return x.args;
    }) : received.mock.calls;
    var iLast = calls.length - 1;
    var pass = iLast >= 0 && isEqualCall(expected, calls[iLast]);
    var message = pass ? function () {
      var indexedCalls = [];

      if (iLast > 0) {
        // Display preceding call as context.
        indexedCalls.push([iLast - 1, calls[iLast - 1]]);
      }

      indexedCalls.push([iLast, calls[iLast]]);
      return (0, _jestMatcherUtils.matcherHint)(matcherName, receivedName, expectedArgument, options) + '\n\n' + "Expected: not ".concat(printExpectedArgs(expected), "\n") + (calls.length === 1 && (0, _jestMatcherUtils.stringify)(calls[0]) === (0, _jestMatcherUtils.stringify)(expected) ? '' : printReceivedCallsNegative(expected, indexedCalls, calls.length === 1, iLast)) + "\nNumber of calls: ".concat((0, _jestMatcherUtils.printReceived)(calls.length));
    } : function () {
      var indexedCalls = [];

      if (iLast >= 0) {
        if (iLast > 0) {
          var i = iLast - 1; // Is there a preceding call that is equal to expected args?

          while (i >= 0 && !isEqualCall(expected, calls[i])) {
            i -= 1;
          }

          if (i < 0) {
            i = iLast - 1; // otherwise, preceding call
          }

          indexedCalls.push([i, calls[i]]);
        }

        indexedCalls.push([iLast, calls[iLast]]);
      }

      return (0, _jestMatcherUtils.matcherHint)(matcherName, receivedName, expectedArgument, options) + '\n\n' + printExpectedReceivedCallsPositive(expected, indexedCalls, isExpand(_this2.expand), calls.length === 1, iLast) + "\nNumber of calls: ".concat((0, _jestMatcherUtils.printReceived)(calls.length));
    };
    return {
      message: message,
      pass: pass
    };
  };
};

var createLastReturnedMatcher = function createLastReturnedMatcher(matcherName) {
  return function (received, expected) {
    var expectedArgument = 'expected';
    var options = {
      isNot: this.isNot,
      promise: this.promise
    };
    ensureMock(received, matcherName, expectedArgument, options);
    var receivedName = received.getMockName();
    var _received$mock2 = received.mock,
        calls = _received$mock2.calls,
        results = _received$mock2.results;
    var iLast = results.length - 1;
    var pass = iLast >= 0 && isEqualReturn(expected, results[iLast]);
    var message = pass ? function () {
      var indexedResults = [];

      if (iLast > 0) {
        // Display preceding result as context.
        indexedResults.push([iLast - 1, results[iLast - 1]]);
      }

      indexedResults.push([iLast, results[iLast]]);
      return (0, _jestMatcherUtils.matcherHint)(matcherName, receivedName, expectedArgument, options) + '\n\n' + "Expected: not ".concat((0, _jestMatcherUtils.printExpected)(expected), "\n") + (results.length === 1 && results[0].type === 'return' && (0, _jestMatcherUtils.stringify)(results[0].value) === (0, _jestMatcherUtils.stringify)(expected) ? '' : printReceivedResults('Received:     ', expected, indexedResults, results.length === 1, iLast)) + printNumberOfReturns(countReturns(results), calls.length);
    } : function () {
      var indexedResults = [];

      if (iLast >= 0) {
        if (iLast > 0) {
          var i = iLast - 1; // Is there a preceding result that is equal to expected value?

          while (i >= 0 && !isEqualReturn(expected, results[i])) {
            i -= 1;
          }

          if (i < 0) {
            i = iLast - 1; // otherwise, preceding result
          }

          indexedResults.push([i, results[i]]);
        }

        indexedResults.push([iLast, results[iLast]]);
      }

      return (0, _jestMatcherUtils.matcherHint)(matcherName, receivedName, expectedArgument, options) + '\n\n' + "Expected: ".concat((0, _jestMatcherUtils.printExpected)(expected), "\n") + printReceivedResults('Received: ', expected, indexedResults, results.length === 1, iLast) + printNumberOfReturns(countReturns(results), calls.length);
    };
    return {
      message: message,
      pass: pass
    };
  };
};

var createNthCalledWithMatcher = function createNthCalledWithMatcher(matcherName) {
  return function (received, nth) {
    var _this3 = this;

    for (var _len3 = arguments.length, expected = new Array(_len3 > 2 ? _len3 - 2 : 0), _key3 = 2; _key3 < _len3; _key3++) {
      expected[_key3 - 2] = arguments[_key3];
    }

    var expectedArgument = 'n';
    var options = {
      expectedColor: function expectedColor(arg) {
        return arg;
      },
      isNot: this.isNot,
      promise: this.promise,
      secondArgument: '...expected'
    };
    ensureMockOrSpy(received, matcherName, expectedArgument, options);

    if (!Number.isSafeInteger(nth) || nth < 1) {
      throw new Error((0, _jestMatcherUtils.matcherErrorMessage)((0, _jestMatcherUtils.matcherHint)(matcherName, undefined, expectedArgument, options), "".concat(expectedArgument, " must be a positive integer"), (0, _jestMatcherUtils.printWithType)(expectedArgument, nth, _jestMatcherUtils.stringify)));
    }

    var receivedIsSpy = isSpy(received);
    var receivedName = receivedIsSpy ? 'spy' : received.getMockName();
    var calls = receivedIsSpy ? received.calls.all().map(function (x) {
      return x.args;
    }) : received.mock.calls;
    var length = calls.length;
    var iNth = nth - 1;
    var pass = iNth < length && isEqualCall(expected, calls[iNth]);
    var message = pass ? function () {
      // Display preceding and following calls,
      // in case assertions fails because index is off by one.
      var indexedCalls = [];

      if (iNth - 1 >= 0) {
        indexedCalls.push([iNth - 1, calls[iNth - 1]]);
      }

      indexedCalls.push([iNth, calls[iNth]]);

      if (iNth + 1 < length) {
        indexedCalls.push([iNth + 1, calls[iNth + 1]]);
      }

      return (0, _jestMatcherUtils.matcherHint)(matcherName, receivedName, expectedArgument, options) + '\n\n' + "n: ".concat(nth, "\n") + "Expected: not ".concat(printExpectedArgs(expected), "\n") + (calls.length === 1 && (0, _jestMatcherUtils.stringify)(calls[0]) === (0, _jestMatcherUtils.stringify)(expected) ? '' : printReceivedCallsNegative(expected, indexedCalls, calls.length === 1, iNth)) + "\nNumber of calls: ".concat((0, _jestMatcherUtils.printReceived)(calls.length));
    } : function () {
      // Display preceding and following calls:
      // * nearest call that is equal to expected args
      // * otherwise, adjacent call
      // in case assertions fails because of index, especially off by one.
      var indexedCalls = [];

      if (iNth < length) {
        if (iNth - 1 >= 0) {
          var i = iNth - 1; // Is there a preceding call that is equal to expected args?

          while (i >= 0 && !isEqualCall(expected, calls[i])) {
            i -= 1;
          }

          if (i < 0) {
            i = iNth - 1; // otherwise, adjacent call
          }

          indexedCalls.push([i, calls[i]]);
        }

        indexedCalls.push([iNth, calls[iNth]]);

        if (iNth + 1 < length) {
          var _i2 = iNth + 1; // Is there a following call that is equal to expected args?


          while (_i2 < length && !isEqualCall(expected, calls[_i2])) {
            _i2 += 1;
          }

          if (_i2 >= length) {
            _i2 = iNth + 1; // otherwise, adjacent call
          }

          indexedCalls.push([_i2, calls[_i2]]);
        }
      } else if (length > 0) {
        // The number of received calls is fewer than the expected number.
        var _i3 = length - 1; // Is there a call that is equal to expected args?


        while (_i3 >= 0 && !isEqualCall(expected, calls[_i3])) {
          _i3 -= 1;
        }

        if (_i3 < 0) {
          _i3 = length - 1; // otherwise, last call
        }

        indexedCalls.push([_i3, calls[_i3]]);
      }

      return (0, _jestMatcherUtils.matcherHint)(matcherName, receivedName, expectedArgument, options) + '\n\n' + "n: ".concat(nth, "\n") + printExpectedReceivedCallsPositive(expected, indexedCalls, isExpand(_this3.expand), calls.length === 1, iNth) + "\nNumber of calls: ".concat((0, _jestMatcherUtils.printReceived)(calls.length));
    };
    return {
      message: message,
      pass: pass
    };
  };
};

var createNthReturnedWithMatcher = function createNthReturnedWithMatcher(matcherName) {
  return function (received, nth, expected) {
    var expectedArgument = 'n';
    var options = {
      expectedColor: function expectedColor(arg) {
        return arg;
      },
      isNot: this.isNot,
      promise: this.promise,
      secondArgument: 'expected'
    };
    ensureMock(received, matcherName, expectedArgument, options);

    if (!Number.isSafeInteger(nth) || nth < 1) {
      throw new Error((0, _jestMatcherUtils.matcherErrorMessage)((0, _jestMatcherUtils.matcherHint)(matcherName, undefined, expectedArgument, options), "".concat(expectedArgument, " must be a positive integer"), (0, _jestMatcherUtils.printWithType)(expectedArgument, nth, _jestMatcherUtils.stringify)));
    }

    var receivedName = received.getMockName();
    var _received$mock3 = received.mock,
        calls = _received$mock3.calls,
        results = _received$mock3.results;
    var length = results.length;
    var iNth = nth - 1;
    var pass = iNth < length && isEqualReturn(expected, results[iNth]);
    var message = pass ? function () {
      // Display preceding and following results,
      // in case assertions fails because index is off by one.
      var indexedResults = [];

      if (iNth - 1 >= 0) {
        indexedResults.push([iNth - 1, results[iNth - 1]]);
      }

      indexedResults.push([iNth, results[iNth]]);

      if (iNth + 1 < length) {
        indexedResults.push([iNth + 1, results[iNth + 1]]);
      }

      return (0, _jestMatcherUtils.matcherHint)(matcherName, receivedName, expectedArgument, options) + '\n\n' + "n: ".concat(nth, "\n") + "Expected: not ".concat((0, _jestMatcherUtils.printExpected)(expected), "\n") + (results.length === 1 && results[0].type === 'return' && (0, _jestMatcherUtils.stringify)(results[0].value) === (0, _jestMatcherUtils.stringify)(expected) ? '' : printReceivedResults('Received:     ', expected, indexedResults, results.length === 1, iNth)) + printNumberOfReturns(countReturns(results), calls.length);
    } : function () {
      // Display preceding and following results:
      // * nearest result that is equal to expected value
      // * otherwise, adjacent result
      // in case assertions fails because of index, especially off by one.
      var indexedResults = [];

      if (iNth < length) {
        if (iNth - 1 >= 0) {
          var i = iNth - 1; // Is there a preceding result that is equal to expected value?

          while (i >= 0 && !isEqualReturn(expected, results[i])) {
            i -= 1;
          }

          if (i < 0) {
            i = iNth - 1; // otherwise, adjacent result
          }

          indexedResults.push([i, results[i]]);
        }

        indexedResults.push([iNth, results[iNth]]);

        if (iNth + 1 < length) {
          var _i4 = iNth + 1; // Is there a following result that is equal to expected value?


          while (_i4 < length && !isEqualReturn(expected, results[_i4])) {
            _i4 += 1;
          }

          if (_i4 >= length) {
            _i4 = iNth + 1; // otherwise, adjacent result
          }

          indexedResults.push([_i4, results[_i4]]);
        }
      } else if (length > 0) {
        // The number of received calls is fewer than the expected number.
        var _i5 = length - 1; // Is there a result that is equal to expected value?


        while (_i5 >= 0 && !isEqualReturn(expected, results[_i5])) {
          _i5 -= 1;
        }

        if (_i5 < 0) {
          _i5 = length - 1; // otherwise, last result
        }

        indexedResults.push([_i5, results[_i5]]);
      }

      return (0, _jestMatcherUtils.matcherHint)(matcherName, receivedName, expectedArgument, options) + '\n\n' + "n: ".concat(nth, "\n") + "Expected: ".concat((0, _jestMatcherUtils.printExpected)(expected), "\n") + printReceivedResults('Received: ', expected, indexedResults, results.length === 1, iNth) + printNumberOfReturns(countReturns(results), calls.length);
    };
    return {
      message: message,
      pass: pass
    };
  };
};

var spyMatchers = {
  lastCalledWith: createLastCalledWithMatcher('lastCalledWith'),
  lastReturnedWith: createLastReturnedMatcher('lastReturnedWith'),
  nthCalledWith: createNthCalledWithMatcher('nthCalledWith'),
  nthReturnedWith: createNthReturnedWithMatcher('nthReturnedWith'),
  toBeCalled: createToBeCalledMatcher('toBeCalled'),
  toBeCalledTimes: createToBeCalledTimesMatcher('toBeCalledTimes'),
  toBeCalledWith: createToBeCalledWithMatcher('toBeCalledWith'),
  toHaveBeenCalled: createToBeCalledMatcher('toHaveBeenCalled'),
  toHaveBeenCalledTimes: createToBeCalledTimesMatcher('toHaveBeenCalledTimes'),
  toHaveBeenCalledWith: createToBeCalledWithMatcher('toHaveBeenCalledWith'),
  toHaveBeenLastCalledWith: createLastCalledWithMatcher('toHaveBeenLastCalledWith'),
  toHaveBeenNthCalledWith: createNthCalledWithMatcher('toHaveBeenNthCalledWith'),
  toHaveLastReturnedWith: createLastReturnedMatcher('toHaveLastReturnedWith'),
  toHaveNthReturnedWith: createNthReturnedWithMatcher('toHaveNthReturnedWith'),
  toHaveReturned: createToReturnMatcher('toHaveReturned'),
  toHaveReturnedTimes: createToReturnTimesMatcher('toHaveReturnedTimes'),
  toHaveReturnedWith: createToReturnWithMatcher('toHaveReturnedWith'),
  toReturn: createToReturnMatcher('toReturn'),
  toReturnTimes: createToReturnTimesMatcher('toReturnTimes'),
  toReturnWith: createToReturnWithMatcher('toReturnWith')
};

var isMock = function isMock(received) {
  return received != null && received._isMockFunction === true;
};

var isSpy = function isSpy(received) {
  return received != null && received.calls != null && typeof received.calls.all === 'function' && typeof received.calls.count === 'function';
};

var ensureMockOrSpy = function ensureMockOrSpy(received, matcherName, expectedArgument, options) {
  if (!isMock(received) && !isSpy(received)) {
    throw new Error((0, _jestMatcherUtils.matcherErrorMessage)((0, _jestMatcherUtils.matcherHint)(matcherName, undefined, expectedArgument, options), "".concat((0, _jestMatcherUtils.RECEIVED_COLOR)('received'), " value must be a mock or spy function"), (0, _jestMatcherUtils.printWithType)('Received', received, _jestMatcherUtils.printReceived)));
  }
};

var ensureMock = function ensureMock(received, matcherName, expectedArgument, options) {
  if (!isMock(received)) {
    throw new Error((0, _jestMatcherUtils.matcherErrorMessage)((0, _jestMatcherUtils.matcherHint)(matcherName, undefined, expectedArgument, options), "".concat((0, _jestMatcherUtils.RECEIVED_COLOR)('received'), " value must be a mock function"), (0, _jestMatcherUtils.printWithType)('Received', received, _jestMatcherUtils.printReceived)));
  }
};

var _default = spyMatchers;
exports.default = _default;

/***/ }),

/***/ "./packages/expect/src/toThrowMatchers.ts":
/*!************************************************!*\
  !*** ./packages/expect/src/toThrowMatchers.ts ***!
  \************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(process) {

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.createMatcher = void 0;

var _jestMessageUtil = __webpack_require__(/*! jest-message-util */ "./packages/jest-message-util/build/index.js");

var _jestMatcherUtils = __webpack_require__(/*! jest-matcher-utils */ "./packages/jest-matcher-utils/build/index.js");

var _print = __webpack_require__(/*! ./print */ "./packages/expect/src/print.ts");

var _utils = __webpack_require__(/*! ./utils */ "./packages/expect/src/utils.ts");

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

var DID_NOT_THROW = 'Received function did not throw';

var getThrown = function getThrown(e) {
  var hasMessage = e !== null && e !== undefined && typeof e.message === 'string';

  if (hasMessage && typeof e.name === 'string' && typeof e.stack === 'string') {
    return {
      hasMessage: hasMessage,
      isError: true,
      message: e.message,
      value: e
    };
  }

  return {
    hasMessage: hasMessage,
    isError: false,
    message: hasMessage ? e.message : String(e),
    value: e
  };
};

var createMatcher = function createMatcher(matcherName, fromPromise) {
  return (// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    function (received, expected) {
      var options = {
        isNot: this.isNot,
        promise: this.promise
      };
      var thrown = null;

      if (fromPromise && (0, _utils.isError)(received)) {
        thrown = getThrown(received);
      } else {
        if (typeof received !== 'function') {
          if (!fromPromise) {
            var placeholder = expected === undefined ? '' : 'expected';
            throw new Error((0, _jestMatcherUtils.matcherErrorMessage)((0, _jestMatcherUtils.matcherHint)(matcherName, undefined, placeholder, options), "".concat((0, _jestMatcherUtils.RECEIVED_COLOR)('received'), " value must be a function"), (0, _jestMatcherUtils.printWithType)('Received', received, _jestMatcherUtils.printReceived)));
          }
        } else {
          try {
            received();
          } catch (e) {
            thrown = getThrown(e);
          }
        }
      }

      if (expected === undefined) {
        return toThrow(matcherName, options, thrown);
      } else if (typeof expected === 'function') {
        return toThrowExpectedClass(matcherName, options, thrown, expected);
      } else if (typeof expected === 'string') {
        return toThrowExpectedString(matcherName, options, thrown, expected);
      } else if (expected !== null && typeof expected.test === 'function') {
        return toThrowExpectedRegExp(matcherName, options, thrown, expected);
      } else if (expected !== null && typeof expected.asymmetricMatch === 'function') {
        return toThrowExpectedAsymmetric(matcherName, options, thrown, expected);
      } else if (expected !== null && _typeof(expected) === 'object') {
        return toThrowExpectedObject(matcherName, options, thrown, expected);
      } else {
        throw new Error((0, _jestMatcherUtils.matcherErrorMessage)((0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options), "".concat((0, _jestMatcherUtils.EXPECTED_COLOR)('expected'), " value must be a string or regular expression or class or error"), (0, _jestMatcherUtils.printWithType)('Expected', expected, _jestMatcherUtils.printExpected)));
      }
    }
  );
};

exports.createMatcher = createMatcher;
var matchers = {
  toThrow: createMatcher('toThrow'),
  toThrowError: createMatcher('toThrowError')
};

var toThrowExpectedRegExp = function toThrowExpectedRegExp(matcherName, options, thrown, expected) {
  var pass = thrown !== null && expected.test(thrown.message);
  var message = pass ? function () {
    return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + formatExpected('Expected pattern: not ', expected) + (thrown !== null && thrown.hasMessage ? formatReceived('Received message:     ', thrown, 'message', expected) + formatStack(thrown) : formatReceived('Received value:       ', thrown, 'value'));
  } : function () {
    return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + formatExpected('Expected pattern: ', expected) + (thrown === null ? '\n' + DID_NOT_THROW : thrown.hasMessage ? formatReceived('Received message: ', thrown, 'message') + formatStack(thrown) : formatReceived('Received value:   ', thrown, 'value'));
  };
  return {
    message: message,
    pass: pass
  };
};

var toThrowExpectedAsymmetric = function toThrowExpectedAsymmetric(matcherName, options, thrown, expected) {
  var pass = thrown !== null && expected.asymmetricMatch(thrown.value);
  var message = pass ? function () {
    return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + formatExpected('Expected asymmetric matcher: not ', expected) + '\n' + (thrown !== null && thrown.hasMessage ? formatReceived('Received name:    ', thrown, 'name') + formatReceived('Received message: ', thrown, 'message') + formatStack(thrown) : formatReceived('Thrown value: ', thrown, 'value'));
  } : function () {
    return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + formatExpected('Expected asymmetric matcher: ', expected) + '\n' + (thrown === null ? DID_NOT_THROW : thrown.hasMessage ? formatReceived('Received name:    ', thrown, 'name') + formatReceived('Received message: ', thrown, 'message') + formatStack(thrown) : formatReceived('Thrown value: ', thrown, 'value'));
  };
  return {
    message: message,
    pass: pass
  };
};

var toThrowExpectedObject = function toThrowExpectedObject(matcherName, options, thrown, expected) {
  var pass = thrown !== null && thrown.message === expected.message;
  var message = pass ? function () {
    return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + formatExpected('Expected message: not ', expected.message) + (thrown !== null && thrown.hasMessage ? formatStack(thrown) : formatReceived('Received value:       ', thrown, 'value'));
  } : function () {
    return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + (thrown === null ? formatExpected('Expected message: ', expected.message) + '\n' + DID_NOT_THROW : thrown.hasMessage ? (0, _jestMatcherUtils.printDiffOrStringify)(expected.message, thrown.message, 'Expected message', 'Received message', true) + '\n' + formatStack(thrown) : formatExpected('Expected message: ', expected.message) + formatReceived('Received value:   ', thrown, 'value'));
  };
  return {
    message: message,
    pass: pass
  };
};

var toThrowExpectedClass = function toThrowExpectedClass(matcherName, options, thrown, expected) {
  var pass = thrown !== null && thrown.value instanceof expected;
  var message = pass ? function () {
    return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + (0, _print.printExpectedConstructorNameNot)('Expected constructor', expected) + (thrown !== null && thrown.value != null && typeof thrown.value.constructor === 'function' && thrown.value.constructor !== expected ? (0, _print.printReceivedConstructorNameNot)('Received constructor', thrown.value.constructor, expected) : '') + '\n' + (thrown !== null && thrown.hasMessage ? formatReceived('Received message: ', thrown, 'message') + formatStack(thrown) : formatReceived('Received value: ', thrown, 'value'));
  } : function () {
    return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + (0, _print.printExpectedConstructorName)('Expected constructor', expected) + (thrown === null ? '\n' + DID_NOT_THROW : (thrown.value != null && typeof thrown.value.constructor === 'function' ? (0, _print.printReceivedConstructorName)('Received constructor', thrown.value.constructor) : '') + '\n' + (thrown.hasMessage ? formatReceived('Received message: ', thrown, 'message') + formatStack(thrown) : formatReceived('Received value: ', thrown, 'value')));
  };
  return {
    message: message,
    pass: pass
  };
};

var toThrowExpectedString = function toThrowExpectedString(matcherName, options, thrown, expected) {
  var pass = thrown !== null && thrown.message.includes(expected);
  var message = pass ? function () {
    return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + formatExpected('Expected substring: not ', expected) + (thrown !== null && thrown.hasMessage ? formatReceived('Received message:       ', thrown, 'message', expected) + formatStack(thrown) : formatReceived('Received value:         ', thrown, 'value'));
  } : function () {
    return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, undefined, options) + '\n\n' + formatExpected('Expected substring: ', expected) + (thrown === null ? '\n' + DID_NOT_THROW : thrown.hasMessage ? formatReceived('Received message:   ', thrown, 'message') + formatStack(thrown) : formatReceived('Received value:     ', thrown, 'value'));
  };
  return {
    message: message,
    pass: pass
  };
};

var toThrow = function toThrow(matcherName, options, thrown) {
  var pass = thrown !== null;
  var message = pass ? function () {
    return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, '', options) + '\n\n' + (thrown !== null && thrown.hasMessage ? formatReceived('Error name:    ', thrown, 'name') + formatReceived('Error message: ', thrown, 'message') + formatStack(thrown) : formatReceived('Thrown value: ', thrown, 'value'));
  } : function () {
    return (0, _jestMatcherUtils.matcherHint)(matcherName, undefined, '', options) + '\n\n' + DID_NOT_THROW;
  };
  return {
    message: message,
    pass: pass
  };
};

var formatExpected = function formatExpected(label, expected) {
  return label + (0, _jestMatcherUtils.printExpected)(expected) + '\n';
};

var formatReceived = function formatReceived(label, thrown, key, expected) {
  if (thrown === null) {
    return '';
  }

  if (key === 'message') {
    var message = thrown.message;

    if (typeof expected === 'string') {
      var index = message.indexOf(expected);

      if (index !== -1) {
        return label + (0, _print.printReceivedStringContainExpectedSubstring)(message, index, expected.length) + '\n';
      }
    } else if (expected instanceof RegExp) {
      return label + (0, _print.printReceivedStringContainExpectedResult)(message, typeof expected.exec === 'function' ? expected.exec(message) : null) + '\n';
    }

    return label + (0, _jestMatcherUtils.printReceived)(message) + '\n';
  }

  if (key === 'name') {
    return thrown.isError ? label + (0, _jestMatcherUtils.printReceived)(thrown.value.name) + '\n' : '';
  }

  if (key === 'value') {
    return thrown.isError ? '' : label + (0, _jestMatcherUtils.printReceived)(thrown.value) + '\n';
  }

  return '';
};

var formatStack = function formatStack(thrown) {
  return thrown === null || !thrown.isError ? '' : (0, _jestMessageUtil.formatStackTrace)((0, _jestMessageUtil.separateMessageFromStack)(thrown.value.stack).stack, {
    rootDir: process.cwd(),
    testMatch: []
  }, {
    noStackTrace: false
  });
};

var _default = matchers;
exports.default = _default;
/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../../../node_modules/process/browser.js */ "./node_modules/process/browser.js")))

/***/ }),

/***/ "./packages/expect/src/utils.ts":
/*!**************************************!*\
  !*** ./packages/expect/src/utils.ts ***!
  \**************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.emptyObject = emptyObject;
exports.isOneline = exports.isError = exports.partition = exports.sparseArrayEquality = exports.typeEquality = exports.subsetEquality = exports.iterableEquality = exports.getObjectSubset = exports.getPath = exports.hasOwnProperty = void 0;

var _jestGetType = __webpack_require__(/*! jest-get-type */ "./packages/jest-get-type/build/index.js");

var _jasmineUtils = __webpack_require__(/*! ./jasmineUtils */ "./packages/expect/src/jasmineUtils.ts");

function _createForOfIteratorHelper(o) { if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (o = _unsupportedIterableToArray(o))) { var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var it, normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

// Return whether object instance inherits getter from its class.
var hasGetterFromConstructor = function hasGetterFromConstructor(object, key) {
  var constructor = object.constructor;

  if (constructor === Object) {
    // A literal object has Object as constructor.
    // Therefore, it cannot inherit application-specific getters.
    // Furthermore, Object has __proto__ getter which is not relevant.
    // Array, Boolean, Number, String constructors don’t have any getters.
    return false;
  }

  if (typeof constructor !== 'function') {
    // Object.create(null) constructs object with no constructor nor prototype.
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create#Custom_and_Null_objects
    return false;
  }

  var descriptor = Object.getOwnPropertyDescriptor(constructor.prototype, key);
  return descriptor !== undefined && typeof descriptor.get === 'function';
};

var hasOwnProperty = function hasOwnProperty(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key) || hasGetterFromConstructor(object, key);
};

exports.hasOwnProperty = hasOwnProperty;

var getPath = function getPath(object, propertyPath) {
  if (!Array.isArray(propertyPath)) {
    propertyPath = propertyPath.split('.');
  }

  if (propertyPath.length) {
    var lastProp = propertyPath.length === 1;
    var prop = propertyPath[0];
    var newObject = object[prop];

    if (!lastProp && (newObject === null || newObject === undefined)) {
      // This is not the last prop in the chain. If we keep recursing it will
      // hit a `can't access property X of undefined | null`. At this point we
      // know that the chain has broken and we can return right away.
      return {
        hasEndProp: false,
        lastTraversedObject: object,
        traversedPath: []
      };
    }

    var result = getPath(newObject, propertyPath.slice(1));

    if (result.lastTraversedObject === null) {
      result.lastTraversedObject = object;
    }

    result.traversedPath.unshift(prop);

    if (lastProp) {
      // Does object have the property with an undefined value?
      // Although primitive values support bracket notation (above)
      // they would throw TypeError for in operator (below).
      result.hasEndProp = newObject !== undefined || !(0, _jestGetType.isPrimitive)(object) && prop in object;

      if (!result.hasEndProp) {
        result.traversedPath.shift();
      }
    }

    return result;
  }

  return {
    lastTraversedObject: null,
    traversedPath: [],
    value: object
  };
}; // Strip properties from object that are not present in the subset. Useful for
// printing the diff for toMatchObject() without adding unrelated noise.
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types


exports.getPath = getPath;

var getObjectSubset = function getObjectSubset(object, subset) {
  var seenReferences = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : new WeakMap();

  if (Array.isArray(object)) {
    if (Array.isArray(subset) && subset.length === object.length) {
      // The map method returns correct subclass of subset.
      return subset.map(function (sub, i) {
        return getObjectSubset(object[i], sub);
      });
    }
  } else if (object instanceof Date) {
    return object;
  } else if (isObject(object) && isObject(subset)) {
    if ((0, _jasmineUtils.equals)(object, subset, [iterableEquality, subsetEquality])) {
      // Avoid unnecessary copy which might return Object instead of subclass.
      return subset;
    }

    var trimmed = {};
    seenReferences.set(object, trimmed);
    Object.keys(object).filter(function (key) {
      return hasOwnProperty(subset, key);
    }).forEach(function (key) {
      trimmed[key] = seenReferences.has(object[key]) ? seenReferences.get(object[key]) : getObjectSubset(object[key], subset[key], seenReferences);
    });

    if (Object.keys(trimmed).length > 0) {
      return trimmed;
    }
  }

  return object;
};

exports.getObjectSubset = getObjectSubset;
var IteratorSymbol = Symbol.iterator;

var hasIterator = function hasIterator(object) {
  return !!(object != null && object[IteratorSymbol]);
}; // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types


var iterableEquality = function iterableEquality(a, b) {
  var aStack = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
  var bStack = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];

  if (_typeof(a) !== 'object' || _typeof(b) !== 'object' || Array.isArray(a) || Array.isArray(b) || !hasIterator(a) || !hasIterator(b)) {
    return undefined;
  }

  if (a.constructor !== b.constructor) {
    return false;
  }

  var length = aStack.length;

  while (length--) {
    // Linear search. Performance is inversely proportional to the number of
    // unique nested structures.
    // circular references at same depth are equal
    // circular reference is not equal to non-circular one
    if (aStack[length] === a) {
      return bStack[length] === b;
    }
  }

  aStack.push(a);
  bStack.push(b);

  var iterableEqualityWithStack = function iterableEqualityWithStack(a, b) {
    return iterableEquality(a, b, _toConsumableArray(aStack), _toConsumableArray(bStack));
  };

  if (a.size !== undefined) {
    if (a.size !== b.size) {
      return false;
    } else if ((0, _jasmineUtils.isA)('Set', a) || (0, _jasmineUtils.isImmutableUnorderedSet)(a)) {
      var allFound = true;

      var _iterator = _createForOfIteratorHelper(a),
          _step;

      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var aValue = _step.value;

          if (!b.has(aValue)) {
            var has = false;

            var _iterator2 = _createForOfIteratorHelper(b),
                _step2;

            try {
              for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
                var bValue = _step2.value;
                var isEqual = (0, _jasmineUtils.equals)(aValue, bValue, [iterableEqualityWithStack]);

                if (isEqual === true) {
                  has = true;
                }
              }
            } catch (err) {
              _iterator2.e(err);
            } finally {
              _iterator2.f();
            }

            if (has === false) {
              allFound = false;
              break;
            }
          }
        } // Remove the first value from the stack of traversed values.

      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }

      aStack.pop();
      bStack.pop();
      return allFound;
    } else if ((0, _jasmineUtils.isA)('Map', a) || (0, _jasmineUtils.isImmutableUnorderedKeyed)(a)) {
      var _allFound = true;

      var _iterator3 = _createForOfIteratorHelper(a),
          _step3;

      try {
        for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
          var aEntry = _step3.value;

          if (!b.has(aEntry[0]) || !(0, _jasmineUtils.equals)(aEntry[1], b.get(aEntry[0]), [iterableEqualityWithStack])) {
            var _has = false;

            var _iterator4 = _createForOfIteratorHelper(b),
                _step4;

            try {
              for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
                var bEntry = _step4.value;
                var matchedKey = (0, _jasmineUtils.equals)(aEntry[0], bEntry[0], [iterableEqualityWithStack]);
                var matchedValue = false;

                if (matchedKey === true) {
                  matchedValue = (0, _jasmineUtils.equals)(aEntry[1], bEntry[1], [iterableEqualityWithStack]);
                }

                if (matchedValue === true) {
                  _has = true;
                }
              }
            } catch (err) {
              _iterator4.e(err);
            } finally {
              _iterator4.f();
            }

            if (_has === false) {
              _allFound = false;
              break;
            }
          }
        } // Remove the first value from the stack of traversed values.

      } catch (err) {
        _iterator3.e(err);
      } finally {
        _iterator3.f();
      }

      aStack.pop();
      bStack.pop();
      return _allFound;
    }
  }

  var bIterator = b[IteratorSymbol]();

  var _iterator5 = _createForOfIteratorHelper(a),
      _step5;

  try {
    for (_iterator5.s(); !(_step5 = _iterator5.n()).done;) {
      var _aValue = _step5.value;
      var nextB = bIterator.next();

      if (nextB.done || !(0, _jasmineUtils.equals)(_aValue, nextB.value, [iterableEqualityWithStack])) {
        return false;
      }
    }
  } catch (err) {
    _iterator5.e(err);
  } finally {
    _iterator5.f();
  }

  if (!bIterator.next().done) {
    return false;
  } // Remove the first value from the stack of traversed values.


  aStack.pop();
  bStack.pop();
  return true;
};

exports.iterableEquality = iterableEquality;

var isObject = function isObject(a) {
  return a !== null && _typeof(a) === 'object';
};

var isObjectWithKeys = function isObjectWithKeys(a) {
  return isObject(a) && !(a instanceof Error) && !(a instanceof Array) && !(a instanceof Date);
}; // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types


var subsetEquality = function subsetEquality(object, subset) {
  // subsetEquality needs to keep track of the references
  // it has already visited to avoid infinite loops in case
  // there are circular references in the subset passed to it.
  var subsetEqualityWithContext = function subsetEqualityWithContext() {
    var seenReferences = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : new WeakMap();
    return function (object, subset) {
      if (!isObjectWithKeys(subset)) {
        return undefined;
      }

      return Object.keys(subset).every(function (key) {
        if (isObjectWithKeys(subset[key])) {
          if (seenReferences.has(subset[key])) {
            return (0, _jasmineUtils.equals)(object[key], subset[key], [iterableEquality]);
          }

          seenReferences.set(subset[key], true);
        }

        var result = object != null && hasOwnProperty(object, key) && (0, _jasmineUtils.equals)(object[key], subset[key], [iterableEquality, subsetEqualityWithContext(seenReferences)]); // The main goal of using seenReference is to avoid circular node on tree.
        // It will only happen within a parent and its child, not a node and nodes next to it (same level)
        // We should keep the reference for a parent and its child only
        // Thus we should delete the reference immediately so that it doesn't interfere
        // other nodes within the same level on tree.

        seenReferences.delete(subset[key]);
        return result;
      });
    };
  };

  return subsetEqualityWithContext()(object, subset);
}; // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types


exports.subsetEquality = subsetEquality;

var typeEquality = function typeEquality(a, b) {
  if (a == null || b == null || a.constructor === b.constructor) {
    return undefined;
  }

  return false;
};

exports.typeEquality = typeEquality;

var sparseArrayEquality = function sparseArrayEquality(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    return undefined;
  } // A sparse array [, , 1] will have keys ["2"] whereas [undefined, undefined, 1] will have keys ["0", "1", "2"]


  var aKeys = Object.keys(a);
  var bKeys = Object.keys(b);
  return (0, _jasmineUtils.equals)(a, b, [iterableEquality, typeEquality], true) && (0, _jasmineUtils.equals)(aKeys, bKeys);
};

exports.sparseArrayEquality = sparseArrayEquality;

var partition = function partition(items, predicate) {
  var result = [[], []];
  items.forEach(function (item) {
    return result[predicate(item) ? 0 : 1].push(item);
  });
  return result;
}; // Copied from https://github.com/graingert/angular.js/blob/a43574052e9775cbc1d7dd8a086752c979b0f020/src/Angular.js#L685-L693


exports.partition = partition;

var isError = function isError(value) {
  switch (Object.prototype.toString.call(value)) {
    case '[object Error]':
      return true;

    case '[object Exception]':
      return true;

    case '[object DOMException]':
      return true;

    default:
      return value instanceof Error;
  }
}; // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types


exports.isError = isError;

function emptyObject(obj) {
  return obj && _typeof(obj) === 'object' ? !Object.keys(obj).length : false;
}

var MULTILINE_REGEXP = /[\r\n]/;

var isOneline = function isOneline(expected, received) {
  return typeof expected === 'string' && typeof received === 'string' && (!MULTILINE_REGEXP.test(expected) || !MULTILINE_REGEXP.test(received));
};

exports.isOneline = isOneline;

/***/ }),

/***/ "./packages/jest-diff/build/cleanupSemantic.js":
/*!*****************************************************!*\
  !*** ./packages/jest-diff/build/cleanupSemantic.js ***!
  \*****************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.cleanupSemantic = exports.DIFF_INSERT = exports.DIFF_DELETE = exports.DIFF_EQUAL = exports.Diff = void 0;

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
/**
 * Diff Match and Patch
 * Copyright 2018 The diff-match-patch Authors.
 * https://github.com/google/diff-match-patch
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Computes the difference between two texts to create a patch.
 * Applies the patch onto another text, allowing for errors.
 * @author fraser@google.com (Neil Fraser)
 */

/**
 * CHANGES by pedrottimark to diff_match_patch_uncompressed.ts file:
 *
 * 1. Delete anything not needed to use diff_cleanupSemantic method
 * 2. Convert from prototype properties to var declarations
 * 3. Convert Diff to class from constructor and prototype
 * 4. Add type annotations for arguments and return values
 * 5. Add exports
 */

/**
 * The data structure representing a diff is an array of tuples:
 * [[DIFF_DELETE, 'Hello'], [DIFF_INSERT, 'Goodbye'], [DIFF_EQUAL, ' world.']]
 * which means: delete 'Hello', add 'Goodbye' and keep ' world.'
 */


var DIFF_DELETE = -1;
exports.DIFF_DELETE = DIFF_DELETE;
var DIFF_INSERT = 1;
exports.DIFF_INSERT = DIFF_INSERT;
var DIFF_EQUAL = 0;
/**
 * Class representing one diff tuple.
 * Attempts to look like a two-element array (which is what this used to be).
 * @param {number} op Operation, one of: DIFF_DELETE, DIFF_INSERT, DIFF_EQUAL.
 * @param {string} text Text to be deleted, inserted, or retained.
 * @constructor
 */

exports.DIFF_EQUAL = DIFF_EQUAL;

var Diff = function Diff(op, text) {
  _classCallCheck(this, Diff);

  _defineProperty(this, 0, void 0);

  _defineProperty(this, 1, void 0);

  this[0] = op;
  this[1] = text;
};
/**
 * Determine the common prefix of two strings.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {number} The number of characters common to the start of each
 *     string.
 */


exports.Diff = Diff;

var diff_commonPrefix = function diff_commonPrefix(text1, text2) {
  // Quick check for common null cases.
  if (!text1 || !text2 || text1.charAt(0) != text2.charAt(0)) {
    return 0;
  } // Binary search.
  // Performance analysis: https://neil.fraser.name/news/2007/10/09/


  var pointermin = 0;
  var pointermax = Math.min(text1.length, text2.length);
  var pointermid = pointermax;
  var pointerstart = 0;

  while (pointermin < pointermid) {
    if (text1.substring(pointerstart, pointermid) == text2.substring(pointerstart, pointermid)) {
      pointermin = pointermid;
      pointerstart = pointermin;
    } else {
      pointermax = pointermid;
    }

    pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
  }

  return pointermid;
};
/**
 * Determine the common suffix of two strings.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {number} The number of characters common to the end of each string.
 */


var diff_commonSuffix = function diff_commonSuffix(text1, text2) {
  // Quick check for common null cases.
  if (!text1 || !text2 || text1.charAt(text1.length - 1) != text2.charAt(text2.length - 1)) {
    return 0;
  } // Binary search.
  // Performance analysis: https://neil.fraser.name/news/2007/10/09/


  var pointermin = 0;
  var pointermax = Math.min(text1.length, text2.length);
  var pointermid = pointermax;
  var pointerend = 0;

  while (pointermin < pointermid) {
    if (text1.substring(text1.length - pointermid, text1.length - pointerend) == text2.substring(text2.length - pointermid, text2.length - pointerend)) {
      pointermin = pointermid;
      pointerend = pointermin;
    } else {
      pointermax = pointermid;
    }

    pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
  }

  return pointermid;
};
/**
 * Determine if the suffix of one string is the prefix of another.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {number} The number of characters common to the end of the first
 *     string and the start of the second string.
 * @private
 */


var diff_commonOverlap_ = function diff_commonOverlap_(text1, text2) {
  // Cache the text lengths to prevent multiple calls.
  var text1_length = text1.length;
  var text2_length = text2.length; // Eliminate the null case.

  if (text1_length == 0 || text2_length == 0) {
    return 0;
  } // Truncate the longer string.


  if (text1_length > text2_length) {
    text1 = text1.substring(text1_length - text2_length);
  } else if (text1_length < text2_length) {
    text2 = text2.substring(0, text1_length);
  }

  var text_length = Math.min(text1_length, text2_length); // Quick check for the worst case.

  if (text1 == text2) {
    return text_length;
  } // Start by looking for a single character match
  // and increase length until no match is found.
  // Performance analysis: https://neil.fraser.name/news/2010/11/04/


  var best = 0;
  var length = 1;

  while (true) {
    var pattern = text1.substring(text_length - length);
    var found = text2.indexOf(pattern);

    if (found == -1) {
      return best;
    }

    length += found;

    if (found == 0 || text1.substring(text_length - length) == text2.substring(0, length)) {
      best = length;
      length++;
    }
  }
};
/**
 * Reduce the number of edits by eliminating semantically trivial equalities.
 * @param {!Array.<!diff_match_patch.Diff>} diffs Array of diff tuples.
 */


var diff_cleanupSemantic = function diff_cleanupSemantic(diffs) {
  var changes = false;
  var equalities = []; // Stack of indices where equalities are found.

  var equalitiesLength = 0; // Keeping our own length var is faster in JS.

  /** @type {?string} */

  var lastEquality = null; // Always equal to diffs[equalities[equalitiesLength - 1]][1]

  var pointer = 0; // Index of current position.
  // Number of characters that changed prior to the equality.

  var length_insertions1 = 0;
  var length_deletions1 = 0; // Number of characters that changed after the equality.

  var length_insertions2 = 0;
  var length_deletions2 = 0;

  while (pointer < diffs.length) {
    if (diffs[pointer][0] == DIFF_EQUAL) {
      // Equality found.
      equalities[equalitiesLength++] = pointer;
      length_insertions1 = length_insertions2;
      length_deletions1 = length_deletions2;
      length_insertions2 = 0;
      length_deletions2 = 0;
      lastEquality = diffs[pointer][1];
    } else {
      // An insertion or deletion.
      if (diffs[pointer][0] == DIFF_INSERT) {
        length_insertions2 += diffs[pointer][1].length;
      } else {
        length_deletions2 += diffs[pointer][1].length;
      } // Eliminate an equality that is smaller or equal to the edits on both
      // sides of it.


      if (lastEquality && lastEquality.length <= Math.max(length_insertions1, length_deletions1) && lastEquality.length <= Math.max(length_insertions2, length_deletions2)) {
        // Duplicate record.
        diffs.splice(equalities[equalitiesLength - 1], 0, new Diff(DIFF_DELETE, lastEquality)); // Change second copy to insert.

        diffs[equalities[equalitiesLength - 1] + 1][0] = DIFF_INSERT; // Throw away the equality we just deleted.

        equalitiesLength--; // Throw away the previous equality (it needs to be reevaluated).

        equalitiesLength--;
        pointer = equalitiesLength > 0 ? equalities[equalitiesLength - 1] : -1;
        length_insertions1 = 0; // Reset the counters.

        length_deletions1 = 0;
        length_insertions2 = 0;
        length_deletions2 = 0;
        lastEquality = null;
        changes = true;
      }
    }

    pointer++;
  } // Normalize the diff.


  if (changes) {
    diff_cleanupMerge(diffs);
  }

  diff_cleanupSemanticLossless(diffs); // Find any overlaps between deletions and insertions.
  // e.g: <del>abcxxx</del><ins>xxxdef</ins>
  //   -> <del>abc</del>xxx<ins>def</ins>
  // e.g: <del>xxxabc</del><ins>defxxx</ins>
  //   -> <ins>def</ins>xxx<del>abc</del>
  // Only extract an overlap if it is as big as the edit ahead or behind it.

  pointer = 1;

  while (pointer < diffs.length) {
    if (diffs[pointer - 1][0] == DIFF_DELETE && diffs[pointer][0] == DIFF_INSERT) {
      var deletion = diffs[pointer - 1][1];
      var insertion = diffs[pointer][1];
      var overlap_length1 = diff_commonOverlap_(deletion, insertion);
      var overlap_length2 = diff_commonOverlap_(insertion, deletion);

      if (overlap_length1 >= overlap_length2) {
        if (overlap_length1 >= deletion.length / 2 || overlap_length1 >= insertion.length / 2) {
          // Overlap found.  Insert an equality and trim the surrounding edits.
          diffs.splice(pointer, 0, new Diff(DIFF_EQUAL, insertion.substring(0, overlap_length1)));
          diffs[pointer - 1][1] = deletion.substring(0, deletion.length - overlap_length1);
          diffs[pointer + 1][1] = insertion.substring(overlap_length1);
          pointer++;
        }
      } else {
        if (overlap_length2 >= deletion.length / 2 || overlap_length2 >= insertion.length / 2) {
          // Reverse overlap found.
          // Insert an equality and swap and trim the surrounding edits.
          diffs.splice(pointer, 0, new Diff(DIFF_EQUAL, deletion.substring(0, overlap_length2)));
          diffs[pointer - 1][0] = DIFF_INSERT;
          diffs[pointer - 1][1] = insertion.substring(0, insertion.length - overlap_length2);
          diffs[pointer + 1][0] = DIFF_DELETE;
          diffs[pointer + 1][1] = deletion.substring(overlap_length2);
          pointer++;
        }
      }

      pointer++;
    }

    pointer++;
  }
};
/**
 * Look for single edits surrounded on both sides by equalities
 * which can be shifted sideways to align the edit to a word boundary.
 * e.g: The c<ins>at c</ins>ame. -> The <ins>cat </ins>came.
 * @param {!Array.<!diff_match_patch.Diff>} diffs Array of diff tuples.
 */


exports.cleanupSemantic = diff_cleanupSemantic;

var diff_cleanupSemanticLossless = function diff_cleanupSemanticLossless(diffs) {
  /**
   * Given two strings, compute a score representing whether the internal
   * boundary falls on logical boundaries.
   * Scores range from 6 (best) to 0 (worst).
   * Closure, but does not reference any external variables.
   * @param {string} one First string.
   * @param {string} two Second string.
   * @return {number} The score.
   * @private
   */
  function diff_cleanupSemanticScore_(one, two) {
    if (!one || !two) {
      // Edges are the best.
      return 6;
    } // Each port of this function behaves slightly differently due to
    // subtle differences in each language's definition of things like
    // 'whitespace'.  Since this function's purpose is largely cosmetic,
    // the choice has been made to use each language's native features
    // rather than force total conformity.


    var char1 = one.charAt(one.length - 1);
    var char2 = two.charAt(0);
    var nonAlphaNumeric1 = char1.match(nonAlphaNumericRegex_);
    var nonAlphaNumeric2 = char2.match(nonAlphaNumericRegex_);
    var whitespace1 = nonAlphaNumeric1 && char1.match(whitespaceRegex_);
    var whitespace2 = nonAlphaNumeric2 && char2.match(whitespaceRegex_);
    var lineBreak1 = whitespace1 && char1.match(linebreakRegex_);
    var lineBreak2 = whitespace2 && char2.match(linebreakRegex_);
    var blankLine1 = lineBreak1 && one.match(blanklineEndRegex_);
    var blankLine2 = lineBreak2 && two.match(blanklineStartRegex_);

    if (blankLine1 || blankLine2) {
      // Five points for blank lines.
      return 5;
    } else if (lineBreak1 || lineBreak2) {
      // Four points for line breaks.
      return 4;
    } else if (nonAlphaNumeric1 && !whitespace1 && whitespace2) {
      // Three points for end of sentences.
      return 3;
    } else if (whitespace1 || whitespace2) {
      // Two points for whitespace.
      return 2;
    } else if (nonAlphaNumeric1 || nonAlphaNumeric2) {
      // One point for non-alphanumeric.
      return 1;
    }

    return 0;
  }

  var pointer = 1; // Intentionally ignore the first and last element (don't need checking).

  while (pointer < diffs.length - 1) {
    if (diffs[pointer - 1][0] == DIFF_EQUAL && diffs[pointer + 1][0] == DIFF_EQUAL) {
      // This is a single edit surrounded by equalities.
      var equality1 = diffs[pointer - 1][1];
      var edit = diffs[pointer][1];
      var equality2 = diffs[pointer + 1][1]; // First, shift the edit as far left as possible.

      var commonOffset = diff_commonSuffix(equality1, edit);

      if (commonOffset) {
        var commonString = edit.substring(edit.length - commonOffset);
        equality1 = equality1.substring(0, equality1.length - commonOffset);
        edit = commonString + edit.substring(0, edit.length - commonOffset);
        equality2 = commonString + equality2;
      } // Second, step character by character right, looking for the best fit.


      var bestEquality1 = equality1;
      var bestEdit = edit;
      var bestEquality2 = equality2;
      var bestScore = diff_cleanupSemanticScore_(equality1, edit) + diff_cleanupSemanticScore_(edit, equality2);

      while (edit.charAt(0) === equality2.charAt(0)) {
        equality1 += edit.charAt(0);
        edit = edit.substring(1) + equality2.charAt(0);
        equality2 = equality2.substring(1);
        var score = diff_cleanupSemanticScore_(equality1, edit) + diff_cleanupSemanticScore_(edit, equality2); // The >= encourages trailing rather than leading whitespace on edits.

        if (score >= bestScore) {
          bestScore = score;
          bestEquality1 = equality1;
          bestEdit = edit;
          bestEquality2 = equality2;
        }
      }

      if (diffs[pointer - 1][1] != bestEquality1) {
        // We have an improvement, save it back to the diff.
        if (bestEquality1) {
          diffs[pointer - 1][1] = bestEquality1;
        } else {
          diffs.splice(pointer - 1, 1);
          pointer--;
        }

        diffs[pointer][1] = bestEdit;

        if (bestEquality2) {
          diffs[pointer + 1][1] = bestEquality2;
        } else {
          diffs.splice(pointer + 1, 1);
          pointer--;
        }
      }
    }

    pointer++;
  }
}; // Define some regex patterns for matching boundaries.


var nonAlphaNumericRegex_ = /[^a-zA-Z0-9]/;
var whitespaceRegex_ = /\s/;
var linebreakRegex_ = /[\r\n]/;
var blanklineEndRegex_ = /\n\r?\n$/;
var blanklineStartRegex_ = /^\r?\n\r?\n/;
/**
 * Reorder and merge like edit sections.  Merge equalities.
 * Any edit section can move as long as it doesn't cross an equality.
 * @param {!Array.<!diff_match_patch.Diff>} diffs Array of diff tuples.
 */

var diff_cleanupMerge = function diff_cleanupMerge(diffs) {
  // Add a dummy entry at the end.
  diffs.push(new Diff(DIFF_EQUAL, ''));
  var pointer = 0;
  var count_delete = 0;
  var count_insert = 0;
  var text_delete = '';
  var text_insert = '';
  var commonlength;

  while (pointer < diffs.length) {
    switch (diffs[pointer][0]) {
      case DIFF_INSERT:
        count_insert++;
        text_insert += diffs[pointer][1];
        pointer++;
        break;

      case DIFF_DELETE:
        count_delete++;
        text_delete += diffs[pointer][1];
        pointer++;
        break;

      case DIFF_EQUAL:
        // Upon reaching an equality, check for prior redundancies.
        if (count_delete + count_insert > 1) {
          if (count_delete !== 0 && count_insert !== 0) {
            // Factor out any common prefixies.
            commonlength = diff_commonPrefix(text_insert, text_delete);

            if (commonlength !== 0) {
              if (pointer - count_delete - count_insert > 0 && diffs[pointer - count_delete - count_insert - 1][0] == DIFF_EQUAL) {
                diffs[pointer - count_delete - count_insert - 1][1] += text_insert.substring(0, commonlength);
              } else {
                diffs.splice(0, 0, new Diff(DIFF_EQUAL, text_insert.substring(0, commonlength)));
                pointer++;
              }

              text_insert = text_insert.substring(commonlength);
              text_delete = text_delete.substring(commonlength);
            } // Factor out any common suffixies.


            commonlength = diff_commonSuffix(text_insert, text_delete);

            if (commonlength !== 0) {
              diffs[pointer][1] = text_insert.substring(text_insert.length - commonlength) + diffs[pointer][1];
              text_insert = text_insert.substring(0, text_insert.length - commonlength);
              text_delete = text_delete.substring(0, text_delete.length - commonlength);
            }
          } // Delete the offending records and add the merged ones.


          pointer -= count_delete + count_insert;
          diffs.splice(pointer, count_delete + count_insert);

          if (text_delete.length) {
            diffs.splice(pointer, 0, new Diff(DIFF_DELETE, text_delete));
            pointer++;
          }

          if (text_insert.length) {
            diffs.splice(pointer, 0, new Diff(DIFF_INSERT, text_insert));
            pointer++;
          }

          pointer++;
        } else if (pointer !== 0 && diffs[pointer - 1][0] == DIFF_EQUAL) {
          // Merge this equality with the previous one.
          diffs[pointer - 1][1] += diffs[pointer][1];
          diffs.splice(pointer, 1);
        } else {
          pointer++;
        }

        count_insert = 0;
        count_delete = 0;
        text_delete = '';
        text_insert = '';
        break;
    }
  }

  if (diffs[diffs.length - 1][1] === '') {
    diffs.pop(); // Remove the dummy entry at the end.
  } // Second pass: look for single edits surrounded on both sides by equalities
  // which can be shifted sideways to eliminate an equality.
  // e.g: A<ins>BA</ins>C -> <ins>AB</ins>AC


  var changes = false;
  pointer = 1; // Intentionally ignore the first and last element (don't need checking).

  while (pointer < diffs.length - 1) {
    if (diffs[pointer - 1][0] == DIFF_EQUAL && diffs[pointer + 1][0] == DIFF_EQUAL) {
      // This is a single edit surrounded by equalities.
      if (diffs[pointer][1].substring(diffs[pointer][1].length - diffs[pointer - 1][1].length) == diffs[pointer - 1][1]) {
        // Shift the edit over the previous equality.
        diffs[pointer][1] = diffs[pointer - 1][1] + diffs[pointer][1].substring(0, diffs[pointer][1].length - diffs[pointer - 1][1].length);
        diffs[pointer + 1][1] = diffs[pointer - 1][1] + diffs[pointer + 1][1];
        diffs.splice(pointer - 1, 1);
        changes = true;
      } else if (diffs[pointer][1].substring(0, diffs[pointer + 1][1].length) == diffs[pointer + 1][1]) {
        // Shift the edit over the next equality.
        diffs[pointer - 1][1] += diffs[pointer + 1][1];
        diffs[pointer][1] = diffs[pointer][1].substring(diffs[pointer + 1][1].length) + diffs[pointer + 1][1];
        diffs.splice(pointer + 1, 1);
        changes = true;
      }
    }

    pointer++;
  } // If shifts were made, the diff needs reordering and another shift sweep.


  if (changes) {
    diff_cleanupMerge(diffs);
  }
};

/***/ }),

/***/ "./packages/jest-diff/build/constants.js":
/*!***********************************************!*\
  !*** ./packages/jest-diff/build/constants.js ***!
  \***********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.SIMILAR_MESSAGE = exports.NO_DIFF_MESSAGE = void 0;

var _chalk = _interopRequireDefault(__webpack_require__(/*! chalk */ "./packages/expect/build/fakeChalk.js"));

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : {
    default: obj
  };
}
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */


var NO_DIFF_MESSAGE = _chalk.default.dim('Compared values have no visual difference.');

exports.NO_DIFF_MESSAGE = NO_DIFF_MESSAGE;

var SIMILAR_MESSAGE = _chalk.default.dim('Compared values serialize to the same structure.\n' + 'Printing internal object structure without calling `toJSON` instead.');

exports.SIMILAR_MESSAGE = SIMILAR_MESSAGE;

/***/ }),

/***/ "./packages/jest-diff/build/diffLines.js":
/*!***********************************************!*\
  !*** ./packages/jest-diff/build/diffLines.js ***!
  \***********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.diffLinesRaw = exports.diffLinesUnified2 = exports.diffLinesUnified = void 0;

var _diffSequences = _interopRequireDefault(__webpack_require__(/*! diff-sequences */ "./packages/diff-sequences/build/index.js"));

var _cleanupSemantic = __webpack_require__(/*! ./cleanupSemantic */ "./packages/jest-diff/build/cleanupSemantic.js");

var _normalizeDiffOptions = __webpack_require__(/*! ./normalizeDiffOptions */ "./packages/jest-diff/build/normalizeDiffOptions.js");

var _printDiffs = __webpack_require__(/*! ./printDiffs */ "./packages/jest-diff/build/printDiffs.js");

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : {
    default: obj
  };
}
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */


var isEmptyString = function isEmptyString(lines) {
  return lines.length === 1 && lines[0].length === 0;
}; // Compare two arrays of strings line-by-line. Format as comparison lines.


var diffLinesUnified = function diffLinesUnified(aLines, bLines, options) {
  return (0, _printDiffs.printDiffLines)(diffLinesRaw(isEmptyString(aLines) ? [] : aLines, isEmptyString(bLines) ? [] : bLines), (0, _normalizeDiffOptions.normalizeDiffOptions)(options));
}; // Given two pairs of arrays of strings:
// Compare the pair of comparison arrays line-by-line.
// Format the corresponding lines in the pair of displayable arrays.


exports.diffLinesUnified = diffLinesUnified;

var diffLinesUnified2 = function diffLinesUnified2(aLinesDisplay, bLinesDisplay, aLinesCompare, bLinesCompare, options) {
  if (isEmptyString(aLinesDisplay) && isEmptyString(aLinesCompare)) {
    aLinesDisplay = [];
    aLinesCompare = [];
  }

  if (isEmptyString(bLinesDisplay) && isEmptyString(bLinesCompare)) {
    bLinesDisplay = [];
    bLinesCompare = [];
  }

  if (aLinesDisplay.length !== aLinesCompare.length || bLinesDisplay.length !== bLinesCompare.length) {
    // Fall back to diff of display lines.
    return diffLinesUnified(aLinesDisplay, bLinesDisplay, options);
  }

  var diffs = diffLinesRaw(aLinesCompare, bLinesCompare); // Replace comparison lines with displayable lines.

  var aIndex = 0;
  var bIndex = 0;
  diffs.forEach(function (diff) {
    switch (diff[0]) {
      case _cleanupSemantic.DIFF_DELETE:
        diff[1] = aLinesDisplay[aIndex];
        aIndex += 1;
        break;

      case _cleanupSemantic.DIFF_INSERT:
        diff[1] = bLinesDisplay[bIndex];
        bIndex += 1;
        break;

      default:
        diff[1] = bLinesDisplay[bIndex];
        aIndex += 1;
        bIndex += 1;
    }
  });
  return (0, _printDiffs.printDiffLines)(diffs, (0, _normalizeDiffOptions.normalizeDiffOptions)(options));
}; // Compare two arrays of strings line-by-line.


exports.diffLinesUnified2 = diffLinesUnified2;

var diffLinesRaw = function diffLinesRaw(aLines, bLines) {
  var aLength = aLines.length;
  var bLength = bLines.length;

  var isCommon = function isCommon(aIndex, bIndex) {
    return aLines[aIndex] === bLines[bIndex];
  };

  var diffs = [];
  var aIndex = 0;
  var bIndex = 0;

  var foundSubsequence = function foundSubsequence(nCommon, aCommon, bCommon) {
    for (; aIndex !== aCommon; aIndex += 1) {
      diffs.push(new _cleanupSemantic.Diff(_cleanupSemantic.DIFF_DELETE, aLines[aIndex]));
    }

    for (; bIndex !== bCommon; bIndex += 1) {
      diffs.push(new _cleanupSemantic.Diff(_cleanupSemantic.DIFF_INSERT, bLines[bIndex]));
    }

    for (; nCommon !== 0; nCommon -= 1, aIndex += 1, bIndex += 1) {
      diffs.push(new _cleanupSemantic.Diff(_cleanupSemantic.DIFF_EQUAL, bLines[bIndex]));
    }
  };

  (0, _diffSequences.default)(aLength, bLength, isCommon, foundSubsequence); // After the last common subsequence, push remaining change items.

  for (; aIndex !== aLength; aIndex += 1) {
    diffs.push(new _cleanupSemantic.Diff(_cleanupSemantic.DIFF_DELETE, aLines[aIndex]));
  }

  for (; bIndex !== bLength; bIndex += 1) {
    diffs.push(new _cleanupSemantic.Diff(_cleanupSemantic.DIFF_INSERT, bLines[bIndex]));
  }

  return diffs;
};

exports.diffLinesRaw = diffLinesRaw;

/***/ }),

/***/ "./packages/jest-diff/build/diffStrings.js":
/*!*************************************************!*\
  !*** ./packages/jest-diff/build/diffStrings.js ***!
  \*************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.default = void 0;

var _diffSequences = _interopRequireDefault(__webpack_require__(/*! diff-sequences */ "./packages/diff-sequences/build/index.js"));

var _cleanupSemantic = __webpack_require__(/*! ./cleanupSemantic */ "./packages/jest-diff/build/cleanupSemantic.js");

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : {
    default: obj
  };
}
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */


var diffStrings = function diffStrings(a, b) {
  var isCommon = function isCommon(aIndex, bIndex) {
    return a[aIndex] === b[bIndex];
  };

  var aIndex = 0;
  var bIndex = 0;
  var diffs = [];

  var foundSubsequence = function foundSubsequence(nCommon, aCommon, bCommon) {
    if (aIndex !== aCommon) {
      diffs.push(new _cleanupSemantic.Diff(_cleanupSemantic.DIFF_DELETE, a.slice(aIndex, aCommon)));
    }

    if (bIndex !== bCommon) {
      diffs.push(new _cleanupSemantic.Diff(_cleanupSemantic.DIFF_INSERT, b.slice(bIndex, bCommon)));
    }

    aIndex = aCommon + nCommon; // number of characters compared in a

    bIndex = bCommon + nCommon; // number of characters compared in b

    diffs.push(new _cleanupSemantic.Diff(_cleanupSemantic.DIFF_EQUAL, b.slice(bCommon, bIndex)));
  };

  (0, _diffSequences.default)(a.length, b.length, isCommon, foundSubsequence); // After the last common subsequence, push remaining change items.

  if (aIndex !== a.length) {
    diffs.push(new _cleanupSemantic.Diff(_cleanupSemantic.DIFF_DELETE, a.slice(aIndex)));
  }

  if (bIndex !== b.length) {
    diffs.push(new _cleanupSemantic.Diff(_cleanupSemantic.DIFF_INSERT, b.slice(bIndex)));
  }

  return diffs;
};

var _default = diffStrings;
exports.default = _default;

/***/ }),

/***/ "./packages/jest-diff/build/getAlignedDiffs.js":
/*!*****************************************************!*\
  !*** ./packages/jest-diff/build/getAlignedDiffs.js ***!
  \*****************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.default = void 0;

var _cleanupSemantic = __webpack_require__(/*! ./cleanupSemantic */ "./packages/jest-diff/build/cleanupSemantic.js");

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
} // Given change op and array of diffs, return concatenated string:
// * include common strings
// * include change strings which have argument op with changeColor
// * exclude change strings which have opposite op


var concatenateRelevantDiffs = function concatenateRelevantDiffs(op, diffs, changeColor) {
  return diffs.reduce(function (reduced, diff) {
    return reduced + (diff[0] === _cleanupSemantic.DIFF_EQUAL ? diff[1] : diff[0] === op && diff[1].length !== 0 // empty if change is newline
    ? changeColor(diff[1]) : '');
  }, '');
}; // Encapsulate change lines until either a common newline or the end.


var ChangeBuffer = /*#__PURE__*/function () {
  // incomplete line
  // complete lines
  function ChangeBuffer(op, changeColor) {
    _classCallCheck(this, ChangeBuffer);

    _defineProperty(this, 'op', void 0);

    _defineProperty(this, 'line', void 0);

    _defineProperty(this, 'lines', void 0);

    _defineProperty(this, 'changeColor', void 0);

    this.op = op;
    this.line = [];
    this.lines = [];
    this.changeColor = changeColor;
  }

  _createClass(ChangeBuffer, [{
    key: "pushSubstring",
    value: function pushSubstring(substring) {
      this.pushDiff(new _cleanupSemantic.Diff(this.op, substring));
    }
  }, {
    key: "pushLine",
    value: function pushLine() {
      // Assume call only if line has at least one diff,
      // therefore an empty line must have a diff which has an empty string.
      // If line has multiple diffs, then assume it has a common diff,
      // therefore change diffs have change color;
      // otherwise then it has line color only.
      this.lines.push(this.line.length !== 1 ? new _cleanupSemantic.Diff(this.op, concatenateRelevantDiffs(this.op, this.line, this.changeColor)) : this.line[0][0] === this.op ? this.line[0] // can use instance
      : new _cleanupSemantic.Diff(this.op, this.line[0][1]) // was common diff
      );
      this.line.length = 0;
    }
  }, {
    key: "isLineEmpty",
    value: function isLineEmpty() {
      return this.line.length === 0;
    } // Minor input to buffer.

  }, {
    key: "pushDiff",
    value: function pushDiff(diff) {
      this.line.push(diff);
    } // Main input to buffer.

  }, {
    key: "align",
    value: function align(diff) {
      var _this = this;

      var string = diff[1];

      if (string.includes('\n')) {
        var substrings = string.split('\n');
        var iLast = substrings.length - 1;
        substrings.forEach(function (substring, i) {
          if (i < iLast) {
            // The first substring completes the current change line.
            // A middle substring is a change line.
            _this.pushSubstring(substring);

            _this.pushLine();
          } else if (substring.length !== 0) {
            // The last substring starts a change line, if it is not empty.
            // Important: This non-empty condition also automatically omits
            // the newline appended to the end of expected and received strings.
            _this.pushSubstring(substring);
          }
        });
      } else {
        // Append non-multiline string to current change line.
        this.pushDiff(diff);
      }
    } // Output from buffer.

  }, {
    key: "moveLinesTo",
    value: function moveLinesTo(lines) {
      if (!this.isLineEmpty()) {
        this.pushLine();
      }

      lines.push.apply(lines, _toConsumableArray(this.lines));
      this.lines.length = 0;
    }
  }]);

  return ChangeBuffer;
}(); // Encapsulate common and change lines.


var CommonBuffer = /*#__PURE__*/function () {
  function CommonBuffer(deleteBuffer, insertBuffer) {
    _classCallCheck(this, CommonBuffer);

    _defineProperty(this, 'deleteBuffer', void 0);

    _defineProperty(this, 'insertBuffer', void 0);

    _defineProperty(this, 'lines', void 0);

    this.deleteBuffer = deleteBuffer;
    this.insertBuffer = insertBuffer;
    this.lines = [];
  }

  _createClass(CommonBuffer, [{
    key: "pushDiffCommonLine",
    value: function pushDiffCommonLine(diff) {
      this.lines.push(diff);
    }
  }, {
    key: "pushDiffChangeLines",
    value: function pushDiffChangeLines(diff) {
      var isDiffEmpty = diff[1].length === 0; // An empty diff string is redundant, unless a change line is empty.

      if (!isDiffEmpty || this.deleteBuffer.isLineEmpty()) {
        this.deleteBuffer.pushDiff(diff);
      }

      if (!isDiffEmpty || this.insertBuffer.isLineEmpty()) {
        this.insertBuffer.pushDiff(diff);
      }
    }
  }, {
    key: "flushChangeLines",
    value: function flushChangeLines() {
      this.deleteBuffer.moveLinesTo(this.lines);
      this.insertBuffer.moveLinesTo(this.lines);
    } // Input to buffer.

  }, {
    key: "align",
    value: function align(diff) {
      var _this2 = this;

      var op = diff[0];
      var string = diff[1];

      if (string.includes('\n')) {
        var substrings = string.split('\n');
        var iLast = substrings.length - 1;
        substrings.forEach(function (substring, i) {
          if (i === 0) {
            var subdiff = new _cleanupSemantic.Diff(op, substring);

            if (_this2.deleteBuffer.isLineEmpty() && _this2.insertBuffer.isLineEmpty()) {
              // If both current change lines are empty,
              // then the first substring is a common line.
              _this2.flushChangeLines();

              _this2.pushDiffCommonLine(subdiff);
            } else {
              // If either current change line is non-empty,
              // then the first substring completes the change lines.
              _this2.pushDiffChangeLines(subdiff);

              _this2.flushChangeLines();
            }
          } else if (i < iLast) {
            // A middle substring is a common line.
            _this2.pushDiffCommonLine(new _cleanupSemantic.Diff(op, substring));
          } else if (substring.length !== 0) {
            // The last substring starts a change line, if it is not empty.
            // Important: This non-empty condition also automatically omits
            // the newline appended to the end of expected and received strings.
            _this2.pushDiffChangeLines(new _cleanupSemantic.Diff(op, substring));
          }
        });
      } else {
        // Append non-multiline string to current change lines.
        // Important: It cannot be at the end following empty change lines,
        // because newline appended to the end of expected and received strings.
        this.pushDiffChangeLines(diff);
      }
    } // Output from buffer.

  }, {
    key: "getLines",
    value: function getLines() {
      this.flushChangeLines();
      return this.lines;
    }
  }]);

  return CommonBuffer;
}(); // Given diffs from expected and received strings,
// return new array of diffs split or joined into lines.
//
// To correctly align a change line at the end, the algorithm:
// * assumes that a newline was appended to the strings
// * omits the last newline from the output array
//
// Assume the function is not called:
// * if either expected or received is empty string
// * if neither expected nor received is multiline string


var getAlignedDiffs = function getAlignedDiffs(diffs, changeColor) {
  var deleteBuffer = new ChangeBuffer(_cleanupSemantic.DIFF_DELETE, changeColor);
  var insertBuffer = new ChangeBuffer(_cleanupSemantic.DIFF_INSERT, changeColor);
  var commonBuffer = new CommonBuffer(deleteBuffer, insertBuffer);
  diffs.forEach(function (diff) {
    switch (diff[0]) {
      case _cleanupSemantic.DIFF_DELETE:
        deleteBuffer.align(diff);
        break;

      case _cleanupSemantic.DIFF_INSERT:
        insertBuffer.align(diff);
        break;

      default:
        commonBuffer.align(diff);
    }
  });
  return commonBuffer.getLines();
};

var _default = getAlignedDiffs;
exports.default = _default;

/***/ }),

/***/ "./packages/jest-diff/build/index.js":
/*!*******************************************!*\
  !*** ./packages/jest-diff/build/index.js ***!
  \*******************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(global) {

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

Object.defineProperty(exports, '__esModule', {
  value: true
});
Object.defineProperty(exports, 'DIFF_DELETE', {
  enumerable: true,
  get: function get() {
    return _cleanupSemantic.DIFF_DELETE;
  }
});
Object.defineProperty(exports, 'DIFF_EQUAL', {
  enumerable: true,
  get: function get() {
    return _cleanupSemantic.DIFF_EQUAL;
  }
});
Object.defineProperty(exports, 'DIFF_INSERT', {
  enumerable: true,
  get: function get() {
    return _cleanupSemantic.DIFF_INSERT;
  }
});
Object.defineProperty(exports, 'Diff', {
  enumerable: true,
  get: function get() {
    return _cleanupSemantic.Diff;
  }
});
Object.defineProperty(exports, 'diffLinesRaw', {
  enumerable: true,
  get: function get() {
    return _diffLines.diffLinesRaw;
  }
});
Object.defineProperty(exports, 'diffLinesUnified', {
  enumerable: true,
  get: function get() {
    return _diffLines.diffLinesUnified;
  }
});
Object.defineProperty(exports, 'diffLinesUnified2', {
  enumerable: true,
  get: function get() {
    return _diffLines.diffLinesUnified2;
  }
});
Object.defineProperty(exports, 'diffStringsRaw', {
  enumerable: true,
  get: function get() {
    return _printDiffs.diffStringsRaw;
  }
});
Object.defineProperty(exports, 'diffStringsUnified', {
  enumerable: true,
  get: function get() {
    return _printDiffs.diffStringsUnified;
  }
});
exports.default = void 0;

var _prettyFormat = _interopRequireDefault(__webpack_require__(/*! pretty-format */ "./packages/pretty-format/build/index.js"));

var _chalk = _interopRequireDefault(__webpack_require__(/*! chalk */ "./packages/expect/build/fakeChalk.js"));

var _jestGetType = _interopRequireDefault(__webpack_require__(/*! jest-get-type */ "./packages/jest-get-type/build/index.js"));

var _cleanupSemantic = __webpack_require__(/*! ./cleanupSemantic */ "./packages/jest-diff/build/cleanupSemantic.js");

var _diffLines = __webpack_require__(/*! ./diffLines */ "./packages/jest-diff/build/diffLines.js");

var _printDiffs = __webpack_require__(/*! ./printDiffs */ "./packages/jest-diff/build/printDiffs.js");

var _constants = __webpack_require__(/*! ./constants */ "./packages/jest-diff/build/constants.js");

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : {
    default: obj
  };
}

var _Symbol = global['jest-symbol-do-not-touch'] || global.Symbol;

var _prettyFormat$default = _prettyFormat.default.plugins,
    AsymmetricMatcher = _prettyFormat$default.AsymmetricMatcher,
    DOMCollection = _prettyFormat$default.DOMCollection,
    DOMElement = _prettyFormat$default.DOMElement,
    Immutable = _prettyFormat$default.Immutable,
    ReactElement = _prettyFormat$default.ReactElement,
    ReactTestComponent = _prettyFormat$default.ReactTestComponent;
var PLUGINS = [ReactTestComponent, ReactElement, DOMElement, DOMCollection, Immutable, AsymmetricMatcher];
var FORMAT_OPTIONS = {
  plugins: PLUGINS
};

var FORMAT_OPTIONS_0 = _objectSpread({}, FORMAT_OPTIONS, {
  indent: 0
});

var FALLBACK_FORMAT_OPTIONS = {
  callToJSON: false,
  maxDepth: 10,
  plugins: PLUGINS
};

var FALLBACK_FORMAT_OPTIONS_0 = _objectSpread({}, FALLBACK_FORMAT_OPTIONS, {
  indent: 0
}); // Generate a string that will highlight the difference between two values
// with green and red. (similar to how github does code diffing)


function diff(a, b, options) {
  if (Object.is(a, b)) {
    return _constants.NO_DIFF_MESSAGE;
  }

  var aType = (0, _jestGetType.default)(a);
  var expectedType = aType;
  var omitDifference = false;

  if (aType === 'object' && typeof a.asymmetricMatch === 'function') {
    if (a.$$typeof !== _Symbol.for('jest.asymmetricMatcher')) {
      // Do not know expected type of user-defined asymmetric matcher.
      return null;
    }

    if (typeof a.getExpectedType !== 'function') {
      // For example, expect.anything() matches either null or undefined
      return null;
    }

    expectedType = a.getExpectedType(); // Primitive types boolean and number omit difference below.
    // For example, omit difference for expect.stringMatching(regexp)

    omitDifference = expectedType === 'string';
  }

  if (expectedType !== (0, _jestGetType.default)(b)) {
    return '  Comparing two different types of values.' + " Expected ".concat(_chalk.default.green(expectedType), " but ") + "received ".concat(_chalk.default.red((0, _jestGetType.default)(b)), ".");
  }

  if (omitDifference) {
    return null;
  }

  switch (aType) {
    case 'string':
      return (0, _diffLines.diffLinesUnified)(a.split('\n'), b.split('\n'), options);

    case 'boolean':
    case 'number':
      return comparePrimitive(a, b, options);

    case 'map':
      return compareObjects(sortMap(a), sortMap(b), options);

    case 'set':
      return compareObjects(sortSet(a), sortSet(b), options);

    default:
      return compareObjects(a, b, options);
  }
}

function comparePrimitive(a, b, options) {
  var aFormat = (0, _prettyFormat.default)(a, FORMAT_OPTIONS);
  var bFormat = (0, _prettyFormat.default)(b, FORMAT_OPTIONS);
  return aFormat === bFormat ? _constants.NO_DIFF_MESSAGE : (0, _diffLines.diffLinesUnified)(aFormat.split('\n'), bFormat.split('\n'), options);
}

function sortMap(map) {
  return new Map(Array.from(map.entries()).sort());
}

function sortSet(set) {
  return new Set(Array.from(set.values()).sort());
}

function compareObjects(a, b, options) {
  var difference;
  var hasThrown = false;

  try {
    var aCompare = (0, _prettyFormat.default)(a, FORMAT_OPTIONS_0);
    var bCompare = (0, _prettyFormat.default)(b, FORMAT_OPTIONS_0);

    if (aCompare === bCompare) {
      difference = _constants.NO_DIFF_MESSAGE;
    } else {
      var aDisplay = (0, _prettyFormat.default)(a, FORMAT_OPTIONS);
      var bDisplay = (0, _prettyFormat.default)(b, FORMAT_OPTIONS);
      difference = (0, _diffLines.diffLinesUnified2)(aDisplay.split('\n'), bDisplay.split('\n'), aCompare.split('\n'), bCompare.split('\n'), options);
    }
  } catch (e) {
    hasThrown = true;
  } // If the comparison yields no results, compare again but this time
  // without calling `toJSON`. It's also possible that toJSON might throw.


  if (difference === undefined || difference === _constants.NO_DIFF_MESSAGE) {
    var _aCompare = (0, _prettyFormat.default)(a, FALLBACK_FORMAT_OPTIONS_0);

    var _bCompare = (0, _prettyFormat.default)(b, FALLBACK_FORMAT_OPTIONS_0);

    if (_aCompare === _bCompare) {
      difference = _constants.NO_DIFF_MESSAGE;
    } else {
      var _aDisplay = (0, _prettyFormat.default)(a, FALLBACK_FORMAT_OPTIONS);

      var _bDisplay = (0, _prettyFormat.default)(b, FALLBACK_FORMAT_OPTIONS);

      difference = (0, _diffLines.diffLinesUnified2)(_aDisplay.split('\n'), _bDisplay.split('\n'), _aCompare.split('\n'), _bCompare.split('\n'), options);
    }

    if (difference !== _constants.NO_DIFF_MESSAGE && !hasThrown) {
      difference = _constants.SIMILAR_MESSAGE + '\n\n' + difference;
    }
  }

  return difference;
}

var _default = diff;
exports.default = _default;
/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../../../node_modules/webpack/buildin/global.js */ "./node_modules/webpack/buildin/global.js")))

/***/ }),

/***/ "./packages/jest-diff/build/joinAlignedDiffs.js":
/*!******************************************************!*\
  !*** ./packages/jest-diff/build/joinAlignedDiffs.js ***!
  \******************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.joinAlignedDiffsExpand = exports.joinAlignedDiffsNoExpand = void 0;

var _cleanupSemantic = __webpack_require__(/*! ./cleanupSemantic */ "./packages/jest-diff/build/cleanupSemantic.js");

var _printDiffs = __webpack_require__(/*! ./printDiffs */ "./packages/jest-diff/build/printDiffs.js");
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// jest --no-expand
//
// Given array of aligned strings with inverse highlight formatting,
// return joined lines with diff formatting (and patch marks, if needed).


var joinAlignedDiffsNoExpand = function joinAlignedDiffsNoExpand(diffs, options) {
  var iLength = diffs.length;
  var nContextLines = options.contextLines;
  var nContextLines2 = nContextLines + nContextLines; // First pass: count output lines and see if it has patches.

  var jLength = iLength;
  var hasExcessAtStartOrEnd = false;
  var nExcessesBetweenChanges = 0;
  var i = 0;

  while (i !== iLength) {
    var iStart = i;

    while (i !== iLength && diffs[i][0] === _cleanupSemantic.DIFF_EQUAL) {
      i += 1;
    }

    if (iStart !== i) {
      if (iStart === 0) {
        // at start
        if (i > nContextLines) {
          jLength -= i - nContextLines; // subtract excess common lines

          hasExcessAtStartOrEnd = true;
        }
      } else if (i === iLength) {
        // at end
        var n = i - iStart;

        if (n > nContextLines) {
          jLength -= n - nContextLines; // subtract excess common lines

          hasExcessAtStartOrEnd = true;
        }
      } else {
        // between changes
        var _n = i - iStart;

        if (_n > nContextLines2) {
          jLength -= _n - nContextLines2; // subtract excess common lines

          nExcessesBetweenChanges += 1;
        }
      }
    }

    while (i !== iLength && diffs[i][0] !== _cleanupSemantic.DIFF_EQUAL) {
      i += 1;
    }
  }

  var hasPatch = nExcessesBetweenChanges !== 0 || hasExcessAtStartOrEnd;

  if (nExcessesBetweenChanges !== 0) {
    jLength += nExcessesBetweenChanges + 1; // add patch lines
  } else if (hasExcessAtStartOrEnd) {
    jLength += 1; // add patch line
  }

  var jLast = jLength - 1;
  var lines = [];
  var jPatchMark = 0; // index of placeholder line for current patch mark

  if (hasPatch) {
    lines.push(''); // placeholder line for first patch mark
  } // Indexes of expected or received lines in current patch:


  var aStart = 0;
  var bStart = 0;
  var aEnd = 0;
  var bEnd = 0;

  var pushCommonLine = function pushCommonLine(line) {
    var j = lines.length;
    lines.push((0, _printDiffs.printCommonLine)(line, j === 0 || j === jLast, options));
    aEnd += 1;
    bEnd += 1;
  };

  var pushDeleteLine = function pushDeleteLine(line) {
    var j = lines.length;
    lines.push((0, _printDiffs.printDeleteLine)(line, j === 0 || j === jLast, options));
    aEnd += 1;
  };

  var pushInsertLine = function pushInsertLine(line) {
    var j = lines.length;
    lines.push((0, _printDiffs.printInsertLine)(line, j === 0 || j === jLast, options));
    bEnd += 1;
  }; // Second pass: push lines with diff formatting (and patch marks, if needed).


  i = 0;

  while (i !== iLength) {
    var _iStart = i;

    while (i !== iLength && diffs[i][0] === _cleanupSemantic.DIFF_EQUAL) {
      i += 1;
    }

    if (_iStart !== i) {
      if (_iStart === 0) {
        // at beginning
        if (i > nContextLines) {
          _iStart = i - nContextLines;
          aStart = _iStart;
          bStart = _iStart;
          aEnd = aStart;
          bEnd = bStart;
        }

        for (var iCommon = _iStart; iCommon !== i; iCommon += 1) {
          pushCommonLine(diffs[iCommon][1]);
        }
      } else if (i === iLength) {
        // at end
        var iEnd = i - _iStart > nContextLines ? _iStart + nContextLines : i;

        for (var _iCommon = _iStart; _iCommon !== iEnd; _iCommon += 1) {
          pushCommonLine(diffs[_iCommon][1]);
        }
      } else {
        // between changes
        var nCommon = i - _iStart;

        if (nCommon > nContextLines2) {
          var _iEnd = _iStart + nContextLines;

          for (var _iCommon2 = _iStart; _iCommon2 !== _iEnd; _iCommon2 += 1) {
            pushCommonLine(diffs[_iCommon2][1]);
          }

          lines[jPatchMark] = (0, _printDiffs.createPatchMark)(aStart, aEnd, bStart, bEnd, options);
          jPatchMark = lines.length;
          lines.push(''); // placeholder line for next patch mark

          var nOmit = nCommon - nContextLines2;
          aStart = aEnd + nOmit;
          bStart = bEnd + nOmit;
          aEnd = aStart;
          bEnd = bStart;

          for (var _iCommon3 = i - nContextLines; _iCommon3 !== i; _iCommon3 += 1) {
            pushCommonLine(diffs[_iCommon3][1]);
          }
        } else {
          for (var _iCommon4 = _iStart; _iCommon4 !== i; _iCommon4 += 1) {
            pushCommonLine(diffs[_iCommon4][1]);
          }
        }
      }
    }

    while (i !== iLength && diffs[i][0] === _cleanupSemantic.DIFF_DELETE) {
      pushDeleteLine(diffs[i][1]);
      i += 1;
    }

    while (i !== iLength && diffs[i][0] === _cleanupSemantic.DIFF_INSERT) {
      pushInsertLine(diffs[i][1]);
      i += 1;
    }
  }

  if (hasPatch) {
    lines[jPatchMark] = (0, _printDiffs.createPatchMark)(aStart, aEnd, bStart, bEnd, options);
  }

  return lines.join('\n');
}; // jest --expand
//
// Given array of aligned strings with inverse highlight formatting,
// return joined lines with diff formatting.


exports.joinAlignedDiffsNoExpand = joinAlignedDiffsNoExpand;

var joinAlignedDiffsExpand = function joinAlignedDiffsExpand(diffs, options) {
  return diffs.map(function (diff, i, diffs) {
    var line = diff[1];
    var isFirstOrLast = i === 0 || i === diffs.length - 1;

    switch (diff[0]) {
      case _cleanupSemantic.DIFF_DELETE:
        return (0, _printDiffs.printDeleteLine)(line, isFirstOrLast, options);

      case _cleanupSemantic.DIFF_INSERT:
        return (0, _printDiffs.printInsertLine)(line, isFirstOrLast, options);

      default:
        return (0, _printDiffs.printCommonLine)(line, isFirstOrLast, options);
    }
  }).join('\n');
};

exports.joinAlignedDiffsExpand = joinAlignedDiffsExpand;

/***/ }),

/***/ "./packages/jest-diff/build/normalizeDiffOptions.js":
/*!**********************************************************!*\
  !*** ./packages/jest-diff/build/normalizeDiffOptions.js ***!
  \**********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.normalizeDiffOptions = exports.noColor = void 0;

var _chalk = _interopRequireDefault(__webpack_require__(/*! chalk */ "./packages/expect/build/fakeChalk.js"));

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : {
    default: obj
  };
}
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */


var noColor = function noColor(string) {
  return string;
};

exports.noColor = noColor;
var DIFF_CONTEXT_DEFAULT = 5;
var OPTIONS_DEFAULT = {
  aAnnotation: 'Expected',
  aColor: _chalk.default.green,
  aIndicator: '-',
  bAnnotation: 'Received',
  bColor: _chalk.default.red,
  bIndicator: '+',
  changeColor: _chalk.default.inverse,
  changeLineTrailingSpaceColor: noColor,
  commonColor: _chalk.default.dim,
  commonIndicator: ' ',
  commonLineTrailingSpaceColor: noColor,
  contextLines: DIFF_CONTEXT_DEFAULT,
  emptyFirstOrLastLinePlaceholder: '',
  expand: true,
  includeChangeCounts: false,
  omitAnnotationLines: false,
  patchColor: _chalk.default.yellow
};

var getContextLines = function getContextLines(contextLines) {
  return typeof contextLines === 'number' && Number.isSafeInteger(contextLines) && contextLines >= 0 ? contextLines : DIFF_CONTEXT_DEFAULT;
}; // Pure function returns options with all properties.


var normalizeDiffOptions = function normalizeDiffOptions() {
  var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  return _objectSpread({}, OPTIONS_DEFAULT, {}, options, {
    contextLines: getContextLines(options.contextLines)
  });
};

exports.normalizeDiffOptions = normalizeDiffOptions;

/***/ }),

/***/ "./packages/jest-diff/build/printDiffs.js":
/*!************************************************!*\
  !*** ./packages/jest-diff/build/printDiffs.js ***!
  \************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.diffStringsRaw = exports.diffStringsUnified = exports.createPatchMark = exports.printDiffLines = exports.printAnnotation = exports.countChanges = exports.hasCommonDiff = exports.printCommonLine = exports.printInsertLine = exports.printDeleteLine = void 0;

var _cleanupSemantic = __webpack_require__(/*! ./cleanupSemantic */ "./packages/jest-diff/build/cleanupSemantic.js");

var _diffLines = __webpack_require__(/*! ./diffLines */ "./packages/jest-diff/build/diffLines.js");

var _diffStrings = _interopRequireDefault(__webpack_require__(/*! ./diffStrings */ "./packages/jest-diff/build/diffStrings.js"));

var _getAlignedDiffs = _interopRequireDefault(__webpack_require__(/*! ./getAlignedDiffs */ "./packages/jest-diff/build/getAlignedDiffs.js"));

var _joinAlignedDiffs = __webpack_require__(/*! ./joinAlignedDiffs */ "./packages/jest-diff/build/joinAlignedDiffs.js");

var _normalizeDiffOptions = __webpack_require__(/*! ./normalizeDiffOptions */ "./packages/jest-diff/build/normalizeDiffOptions.js");

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : {
    default: obj
  };
}
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */


var formatTrailingSpaces = function formatTrailingSpaces(line, trailingSpaceFormatter) {
  return line.replace(/\s+$/, function (match) {
    return trailingSpaceFormatter(match);
  });
};

var printDiffLine = function printDiffLine(line, isFirstOrLast, color, indicator, trailingSpaceFormatter, emptyFirstOrLastLinePlaceholder) {
  return line.length !== 0 ? color(indicator + ' ' + formatTrailingSpaces(line, trailingSpaceFormatter)) : indicator !== ' ' ? color(indicator) : isFirstOrLast && emptyFirstOrLastLinePlaceholder.length !== 0 ? color(indicator + ' ' + emptyFirstOrLastLinePlaceholder) : '';
};

var printDeleteLine = function printDeleteLine(line, isFirstOrLast, _ref) {
  var aColor = _ref.aColor,
      aIndicator = _ref.aIndicator,
      changeLineTrailingSpaceColor = _ref.changeLineTrailingSpaceColor,
      emptyFirstOrLastLinePlaceholder = _ref.emptyFirstOrLastLinePlaceholder;
  return printDiffLine(line, isFirstOrLast, aColor, aIndicator, changeLineTrailingSpaceColor, emptyFirstOrLastLinePlaceholder);
};

exports.printDeleteLine = printDeleteLine;

var printInsertLine = function printInsertLine(line, isFirstOrLast, _ref2) {
  var bColor = _ref2.bColor,
      bIndicator = _ref2.bIndicator,
      changeLineTrailingSpaceColor = _ref2.changeLineTrailingSpaceColor,
      emptyFirstOrLastLinePlaceholder = _ref2.emptyFirstOrLastLinePlaceholder;
  return printDiffLine(line, isFirstOrLast, bColor, bIndicator, changeLineTrailingSpaceColor, emptyFirstOrLastLinePlaceholder);
};

exports.printInsertLine = printInsertLine;

var printCommonLine = function printCommonLine(line, isFirstOrLast, _ref3) {
  var commonColor = _ref3.commonColor,
      commonIndicator = _ref3.commonIndicator,
      commonLineTrailingSpaceColor = _ref3.commonLineTrailingSpaceColor,
      emptyFirstOrLastLinePlaceholder = _ref3.emptyFirstOrLastLinePlaceholder;
  return printDiffLine(line, isFirstOrLast, commonColor, commonIndicator, commonLineTrailingSpaceColor, emptyFirstOrLastLinePlaceholder);
};

exports.printCommonLine = printCommonLine;

var hasCommonDiff = function hasCommonDiff(diffs, isMultiline) {
  if (isMultiline) {
    // Important: Ignore common newline that was appended to multiline strings!
    var iLast = diffs.length - 1;
    return diffs.some(function (diff, i) {
      return diff[0] === _cleanupSemantic.DIFF_EQUAL && (i !== iLast || diff[1] !== '\n');
    });
  }

  return diffs.some(function (diff) {
    return diff[0] === _cleanupSemantic.DIFF_EQUAL;
  });
};

exports.hasCommonDiff = hasCommonDiff;

var countChanges = function countChanges(diffs) {
  var a = 0;
  var b = 0;
  diffs.forEach(function (diff) {
    switch (diff[0]) {
      case _cleanupSemantic.DIFF_DELETE:
        a += 1;
        break;

      case _cleanupSemantic.DIFF_INSERT:
        b += 1;
        break;
    }
  });
  return {
    a: a,
    b: b
  };
};

exports.countChanges = countChanges;

var printAnnotation = function printAnnotation(_ref4, changeCounts) {
  var aAnnotation = _ref4.aAnnotation,
      aColor = _ref4.aColor,
      aIndicator = _ref4.aIndicator,
      bAnnotation = _ref4.bAnnotation,
      bColor = _ref4.bColor,
      bIndicator = _ref4.bIndicator,
      includeChangeCounts = _ref4.includeChangeCounts,
      omitAnnotationLines = _ref4.omitAnnotationLines;

  if (omitAnnotationLines) {
    return '';
  }

  var aRest = '';
  var bRest = '';

  if (includeChangeCounts) {
    var aCount = String(changeCounts.a);
    var bCount = String(changeCounts.b); // Padding right aligns the ends of the annotations.

    var baAnnotationLengthDiff = bAnnotation.length - aAnnotation.length;
    var aAnnotationPadding = ' '.repeat(Math.max(0, baAnnotationLengthDiff));
    var bAnnotationPadding = ' '.repeat(Math.max(0, -baAnnotationLengthDiff)); // Padding left aligns the ends of the counts.

    var baCountLengthDiff = bCount.length - aCount.length;
    var aCountPadding = ' '.repeat(Math.max(0, baCountLengthDiff));
    var bCountPadding = ' '.repeat(Math.max(0, -baCountLengthDiff));
    aRest = aAnnotationPadding + '  ' + aIndicator + ' ' + aCountPadding + aCount;
    bRest = bAnnotationPadding + '  ' + bIndicator + ' ' + bCountPadding + bCount;
  }

  return aColor(aIndicator + ' ' + aAnnotation + aRest) + '\n' + bColor(bIndicator + ' ' + bAnnotation + bRest) + '\n\n';
};

exports.printAnnotation = printAnnotation;

var printDiffLines = function printDiffLines(diffs, options) {
  return printAnnotation(options, countChanges(diffs)) + (options.expand ? (0, _joinAlignedDiffs.joinAlignedDiffsExpand)(diffs, options) : (0, _joinAlignedDiffs.joinAlignedDiffsNoExpand)(diffs, options));
}; // In GNU diff format, indexes are one-based instead of zero-based.


exports.printDiffLines = printDiffLines;

var createPatchMark = function createPatchMark(aStart, aEnd, bStart, bEnd, _ref5) {
  var patchColor = _ref5.patchColor;
  return patchColor("@@ -".concat(aStart + 1, ",").concat(aEnd - aStart, " +").concat(bStart + 1, ",").concat(bEnd - bStart, " @@"));
}; // Compare two strings character-by-character.
// Format as comparison lines in which changed substrings have inverse colors.


exports.createPatchMark = createPatchMark;

var diffStringsUnified = function diffStringsUnified(a, b, options) {
  if (a !== b && a.length !== 0 && b.length !== 0) {
    var isMultiline = a.includes('\n') || b.includes('\n'); // getAlignedDiffs assumes that a newline was appended to the strings.

    var diffs = diffStringsRaw(isMultiline ? a + '\n' : a, isMultiline ? b + '\n' : b, true // cleanupSemantic
    );

    if (hasCommonDiff(diffs, isMultiline)) {
      var optionsNormalized = (0, _normalizeDiffOptions.normalizeDiffOptions)(options);
      var lines = (0, _getAlignedDiffs.default)(diffs, optionsNormalized.changeColor);
      return printDiffLines(lines, optionsNormalized);
    }
  } // Fall back to line-by-line diff.


  return (0, _diffLines.diffLinesUnified)(a.split('\n'), b.split('\n'), options);
}; // Compare two strings character-by-character.
// Optionally clean up small common substrings, also known as chaff.


exports.diffStringsUnified = diffStringsUnified;

var diffStringsRaw = function diffStringsRaw(a, b, cleanup) {
  var diffs = (0, _diffStrings.default)(a, b);

  if (cleanup) {
    (0, _cleanupSemantic.cleanupSemantic)(diffs); // impure function
  }

  return diffs;
};

exports.diffStringsRaw = diffStringsRaw;

/***/ }),

/***/ "./packages/jest-get-type/build/index.js":
/*!***********************************************!*\
  !*** ./packages/jest-get-type/build/index.js ***!
  \***********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// get the type of a value with handling the edge cases like `typeof []`
// and `typeof null`

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function getType(value) {
  if (value === undefined) {
    return 'undefined';
  } else if (value === null) {
    return 'null';
  } else if (Array.isArray(value)) {
    return 'array';
  } else if (typeof value === 'boolean') {
    return 'boolean';
  } else if (typeof value === 'function') {
    return 'function';
  } else if (typeof value === 'number') {
    return 'number';
  } else if (typeof value === 'string') {
    return 'string';
  } else if (typeof value === 'bigint') {
    return 'bigint';
  } else if (_typeof(value) === 'object') {
    if (value != null) {
      if (value.constructor === RegExp) {
        return 'regexp';
      } else if (value.constructor === Map) {
        return 'map';
      } else if (value.constructor === Set) {
        return 'set';
      } else if (value.constructor === Date) {
        return 'date';
      }
    }

    return 'object';
  } else if (_typeof(value) === 'symbol') {
    return 'symbol';
  }

  throw new Error("value of unknown type: ".concat(value));
}

getType.isPrimitive = function (value) {
  return Object(value) !== value;
};

module.exports = getType;

/***/ }),

/***/ "./packages/jest-matcher-utils/build/Replaceable.js":
/*!**********************************************************!*\
  !*** ./packages/jest-matcher-utils/build/Replaceable.js ***!
  \**********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _iterableToArrayLimit(arr, i) { if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return; var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.default = void 0;

var _jestGetType = _interopRequireDefault(__webpack_require__(/*! jest-get-type */ "./packages/jest-get-type/build/index.js"));

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : {
    default: obj
  };
}

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

var supportTypes = ['map', 'array', 'object'];
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

var Replaceable = /*#__PURE__*/function () {
  function Replaceable(object) {
    _classCallCheck(this, Replaceable);

    _defineProperty(this, 'object', void 0);

    _defineProperty(this, 'type', void 0);

    this.object = object;
    this.type = (0, _jestGetType.default)(object);

    if (!supportTypes.includes(this.type)) {
      throw new Error("Type ".concat(this.type, " is not support in Replaceable!"));
    }
  }

  _createClass(Replaceable, [{
    key: "forEach",
    value: function forEach(cb) {
      var _this = this;

      if (this.type === 'object') {
        Object.entries(this.object).forEach(function (_ref) {
          var _ref2 = _slicedToArray(_ref, 2),
              key = _ref2[0],
              value = _ref2[1];

          cb(value, key, _this.object);
        });
        Object.getOwnPropertySymbols(this.object).forEach(function (key) {
          cb(_this.object[key], key, _this.object);
        });
      } else {
        this.object.forEach(cb);
      }
    }
  }, {
    key: "get",
    value: function get(key) {
      if (this.type === 'map') {
        return this.object.get(key);
      }

      return this.object[key];
    }
  }, {
    key: "set",
    value: function set(key, value) {
      if (this.type === 'map') {
        this.object.set(key, value);
      } else {
        this.object[key] = value;
      }
    }
  }], [{
    key: "isReplaceable",
    value: function isReplaceable(obj1, obj2) {
      var obj1Type = (0, _jestGetType.default)(obj1);
      var obj2Type = (0, _jestGetType.default)(obj2);
      return obj1Type === obj2Type && supportTypes.includes(obj1Type);
    }
  }]);

  return Replaceable;
}();
/* eslint-enable */


exports.default = Replaceable;

/***/ }),

/***/ "./packages/jest-matcher-utils/build/deepCyclicCopyReplaceable.js":
/*!************************************************************************!*\
  !*** ./packages/jest-matcher-utils/build/deepCyclicCopyReplaceable.js ***!
  \************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(Buffer) {

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.default = deepCyclicCopyReplaceable;
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var builtInObject = [Array, Buffer, Date, Float32Array, Float64Array, Int16Array, Int32Array, Int8Array, Map, Set, RegExp, Uint16Array, Uint32Array, Uint8Array, Uint8ClampedArray];

var isBuiltInObject = function isBuiltInObject(object) {
  return builtInObject.includes(object.constructor);
};

var isMap = function isMap(value) {
  return value.constructor === Map;
};

function deepCyclicCopyReplaceable(value) {
  var cycles = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : new WeakMap();

  if (_typeof(value) !== 'object' || value === null) {
    return value;
  } else if (cycles.has(value)) {
    return cycles.get(value);
  } else if (Array.isArray(value)) {
    return deepCyclicCopyArray(value, cycles);
  } else if (isMap(value)) {
    return deepCyclicCopyMap(value, cycles);
  } else if (isBuiltInObject(value)) {
    return value;
  } else {
    return deepCyclicCopyObject(value, cycles);
  }
}

function deepCyclicCopyObject(object, cycles) {
  var newObject = Object.create(Object.getPrototypeOf(object));
  var descriptors = Object.getOwnPropertyDescriptors(object);
  cycles.set(object, newObject);
  Object.keys(descriptors).forEach(function (key) {
    if (descriptors[key].enumerable) {
      descriptors[key] = {
        configurable: true,
        enumerable: true,
        value: deepCyclicCopyReplaceable( // this accesses the value or getter, depending. We just care about the value anyways, and this allows us to not mess with accessors
        // it has the side effect of invoking the getter here though, rather than copying it over
        object[key], cycles),
        writable: true
      };
    } else {
      delete descriptors[key];
    }
  });
  return Object.defineProperties(newObject, descriptors);
}

function deepCyclicCopyArray(array, cycles) {
  var newArray = new (Object.getPrototypeOf(array).constructor)(array.length);
  var length = array.length;
  cycles.set(array, newArray);

  for (var i = 0; i < length; i++) {
    newArray[i] = deepCyclicCopyReplaceable(array[i], cycles);
  }

  return newArray;
}

function deepCyclicCopyMap(map, cycles) {
  var newMap = new Map();
  cycles.set(map, newMap);
  map.forEach(function (value, key) {
    newMap.set(key, deepCyclicCopyReplaceable(value, cycles));
  });
  return newMap;
}
/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../../../node_modules/buffer/index.js */ "./node_modules/buffer/index.js").Buffer))

/***/ }),

/***/ "./packages/jest-matcher-utils/build/index.js":
/*!****************************************************!*\
  !*** ./packages/jest-matcher-utils/build/index.js ***!
  \****************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.matcherHint = exports.matcherErrorMessage = exports.getLabelPrinter = exports.pluralize = exports.diff = exports.printDiffOrStringify = exports.ensureExpectedIsNonNegativeInteger = exports.ensureNumbers = exports.ensureExpectedIsNumber = exports.ensureActualIsNumber = exports.ensureNoExpected = exports.printWithType = exports.printExpected = exports.printReceived = exports.highlightTrailingWhitespace = exports.stringify = exports.SUGGEST_TO_CONTAIN_EQUAL = exports.DIM_COLOR = exports.BOLD_WEIGHT = exports.INVERTED_COLOR = exports.RECEIVED_COLOR = exports.EXPECTED_COLOR = void 0;

var _chalk = _interopRequireDefault(__webpack_require__(/*! chalk */ "./packages/expect/build/fakeChalk.js"));

var _jestDiff = _interopRequireWildcard(__webpack_require__(/*! jest-diff */ "./packages/jest-diff/build/index.js"));

var _jestGetType = _interopRequireDefault(__webpack_require__(/*! jest-get-type */ "./packages/jest-get-type/build/index.js"));

var _prettyFormat = _interopRequireDefault(__webpack_require__(/*! pretty-format */ "./packages/pretty-format/build/index.js"));

var _Replaceable = _interopRequireDefault(__webpack_require__(/*! ./Replaceable */ "./packages/jest-matcher-utils/build/Replaceable.js"));

var _deepCyclicCopyReplaceable = _interopRequireDefault(__webpack_require__(/*! ./deepCyclicCopyReplaceable */ "./packages/jest-matcher-utils/build/deepCyclicCopyReplaceable.js"));

function _getRequireWildcardCache() {
  if (typeof WeakMap !== 'function') return null;
  var cache = new WeakMap();

  _getRequireWildcardCache = function _getRequireWildcardCache() {
    return cache;
  };

  return cache;
}

function _interopRequireWildcard(obj) {
  if (obj && obj.__esModule) {
    return obj;
  }

  if (obj === null || _typeof(obj) !== 'object' && typeof obj !== 'function') {
    return {
      default: obj
    };
  }

  var cache = _getRequireWildcardCache();

  if (cache && cache.has(obj)) {
    return cache.get(obj);
  }

  var newObj = {};
  var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;

  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;

      if (desc && (desc.get || desc.set)) {
        Object.defineProperty(newObj, key, desc);
      } else {
        newObj[key] = obj[key];
      }
    }
  }

  newObj.default = obj;

  if (cache) {
    cache.set(obj, newObj);
  }

  return newObj;
}

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : {
    default: obj
  };
}
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */


var _prettyFormat$default = _prettyFormat.default.plugins,
    AsymmetricMatcher = _prettyFormat$default.AsymmetricMatcher,
    DOMCollection = _prettyFormat$default.DOMCollection,
    DOMElement = _prettyFormat$default.DOMElement,
    Immutable = _prettyFormat$default.Immutable,
    ReactElement = _prettyFormat$default.ReactElement,
    ReactTestComponent = _prettyFormat$default.ReactTestComponent;
var PLUGINS = [ReactTestComponent, ReactElement, DOMElement, DOMCollection, Immutable, AsymmetricMatcher];
var EXPECTED_COLOR = _chalk.default.green;
exports.EXPECTED_COLOR = EXPECTED_COLOR;
var RECEIVED_COLOR = _chalk.default.red;
exports.RECEIVED_COLOR = RECEIVED_COLOR;
var INVERTED_COLOR = _chalk.default.inverse;
exports.INVERTED_COLOR = INVERTED_COLOR;
var BOLD_WEIGHT = _chalk.default.bold;
exports.BOLD_WEIGHT = BOLD_WEIGHT;
var DIM_COLOR = _chalk.default.dim;
exports.DIM_COLOR = DIM_COLOR;
var MULTILINE_REGEXP = /\n/;
var SPACE_SYMBOL = "\xB7"; // middle dot

var NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen'];

var SUGGEST_TO_CONTAIN_EQUAL = _chalk.default.dim('Looks like you wanted to test for object/array equality with the stricter `toContain` matcher. You probably need to use `toContainEqual` instead.');

exports.SUGGEST_TO_CONTAIN_EQUAL = SUGGEST_TO_CONTAIN_EQUAL;

var stringify = function stringify(object) {
  var maxDepth = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 10;
  var MAX_LENGTH = 10000;
  var result;

  try {
    result = (0, _prettyFormat.default)(object, {
      maxDepth: maxDepth,
      min: true,
      plugins: PLUGINS
    });
  } catch (e) {
    result = (0, _prettyFormat.default)(object, {
      callToJSON: false,
      maxDepth: maxDepth,
      min: true,
      plugins: PLUGINS
    });
  }

  return result.length >= MAX_LENGTH && maxDepth > 1 ? stringify(object, Math.floor(maxDepth / 2)) : result;
};

exports.stringify = stringify;

var highlightTrailingWhitespace = function highlightTrailingWhitespace(text) {
  return text.replace(/\s+$/gm, _chalk.default.inverse('$&'));
}; // Instead of inverse highlight which now implies a change,
// replace common spaces with middle dot at the end of any line.


exports.highlightTrailingWhitespace = highlightTrailingWhitespace;

var replaceTrailingSpaces = function replaceTrailingSpaces(text) {
  return text.replace(/\s+$/gm, function (spaces) {
    return SPACE_SYMBOL.repeat(spaces.length);
  });
};

var printReceived = function printReceived(object) {
  return RECEIVED_COLOR(replaceTrailingSpaces(stringify(object)));
};

exports.printReceived = printReceived;

var printExpected = function printExpected(value) {
  return EXPECTED_COLOR(replaceTrailingSpaces(stringify(value)));
};

exports.printExpected = printExpected;

var printWithType = function printWithType(name, value, print) {
  var type = (0, _jestGetType.default)(value);
  var hasType = type !== 'null' && type !== 'undefined' ? "".concat(name, " has type:  ").concat(type, "\n") : '';
  var hasValue = "".concat(name, " has value: ").concat(print(value));
  return hasType + hasValue;
};

exports.printWithType = printWithType;

var ensureNoExpected = function ensureNoExpected(expected, matcherName, options) {
  if (typeof expected !== 'undefined') {
    // Prepend maybe not only for backward compatibility.
    var matcherString = (options ? '' : '[.not]') + matcherName;
    throw new Error(matcherErrorMessage(matcherHint(matcherString, undefined, '', options), // Because expected is omitted in hint above,
    // expected is black instead of green in message below.
    'this matcher must not have an expected argument', printWithType('Expected', expected, printExpected)));
  }
};
/**
 * Ensures that `actual` is of type `number | bigint`
 */


exports.ensureNoExpected = ensureNoExpected;

var ensureActualIsNumber = function ensureActualIsNumber(actual, matcherName, options) {
  if (typeof actual !== 'number' && typeof actual !== 'bigint') {
    // Prepend maybe not only for backward compatibility.
    var matcherString = (options ? '' : '[.not]') + matcherName;
    throw new Error(matcherErrorMessage(matcherHint(matcherString, undefined, undefined, options), "".concat(RECEIVED_COLOR('received'), " value must be a number or bigint"), printWithType('Received', actual, printReceived)));
  }
};
/**
 * Ensures that `expected` is of type `number | bigint`
 */


exports.ensureActualIsNumber = ensureActualIsNumber;

var ensureExpectedIsNumber = function ensureExpectedIsNumber(expected, matcherName, options) {
  if (typeof expected !== 'number' && typeof expected !== 'bigint') {
    // Prepend maybe not only for backward compatibility.
    var matcherString = (options ? '' : '[.not]') + matcherName;
    throw new Error(matcherErrorMessage(matcherHint(matcherString, undefined, undefined, options), "".concat(EXPECTED_COLOR('expected'), " value must be a number or bigint"), printWithType('Expected', expected, printExpected)));
  }
};
/**
 * Ensures that `actual` & `expected` are of type `number | bigint`
 */


exports.ensureExpectedIsNumber = ensureExpectedIsNumber;

var ensureNumbers = function ensureNumbers(actual, expected, matcherName, options) {
  ensureActualIsNumber(actual, matcherName, options);
  ensureExpectedIsNumber(expected, matcherName, options);
};

exports.ensureNumbers = ensureNumbers;

var ensureExpectedIsNonNegativeInteger = function ensureExpectedIsNonNegativeInteger(expected, matcherName, options) {
  if (typeof expected !== 'number' || !Number.isSafeInteger(expected) || expected < 0) {
    // Prepend maybe not only for backward compatibility.
    var matcherString = (options ? '' : '[.not]') + matcherName;
    throw new Error(matcherErrorMessage(matcherHint(matcherString, undefined, undefined, options), "".concat(EXPECTED_COLOR('expected'), " value must be a non-negative integer"), printWithType('Expected', expected, printExpected)));
  }
}; // Given array of diffs, return concatenated string:
// * include common substrings
// * exclude change substrings which have opposite op
// * include change substrings which have argument op
//   with inverse highlight only if there is a common substring


exports.ensureExpectedIsNonNegativeInteger = ensureExpectedIsNonNegativeInteger;

var getCommonAndChangedSubstrings = function getCommonAndChangedSubstrings(diffs, op, hasCommonDiff) {
  return diffs.reduce(function (reduced, diff) {
    return reduced + (diff[0] === _jestDiff.DIFF_EQUAL ? diff[1] : diff[0] !== op ? '' : hasCommonDiff ? INVERTED_COLOR(diff[1]) : diff[1]);
  }, '');
};

var isLineDiffable = function isLineDiffable(expected, received) {
  var expectedType = (0, _jestGetType.default)(expected);
  var receivedType = (0, _jestGetType.default)(received);

  if (expectedType !== receivedType) {
    return false;
  }

  if (_jestGetType.default.isPrimitive(expected)) {
    // Print generic line diff for strings only:
    // * if neither string is empty
    // * if either string has more than one line
    return typeof expected === 'string' && typeof received === 'string' && expected.length !== 0 && received.length !== 0 && (MULTILINE_REGEXP.test(expected) || MULTILINE_REGEXP.test(received));
  }

  if (expectedType === 'date' || expectedType === 'function' || expectedType === 'regexp') {
    return false;
  }

  if (expected instanceof Error && received instanceof Error) {
    return false;
  }

  if (expectedType === 'object' && typeof expected.asymmetricMatch === 'function') {
    return false;
  }

  if (receivedType === 'object' && typeof received.asymmetricMatch === 'function') {
    return false;
  }

  return true;
};

var MAX_DIFF_STRING_LENGTH = 20000;

var printDiffOrStringify = function printDiffOrStringify(expected, received, expectedLabel, receivedLabel, expand) {
  if (typeof expected === 'string' && typeof received === 'string' && expected.length !== 0 && received.length !== 0 && expected.length <= MAX_DIFF_STRING_LENGTH && received.length <= MAX_DIFF_STRING_LENGTH && expected !== received) {
    if (expected.includes('\n') || received.includes('\n')) {
      return (0, _jestDiff.diffStringsUnified)(expected, received, {
        aAnnotation: expectedLabel,
        bAnnotation: receivedLabel,
        changeLineTrailingSpaceColor: _chalk.default.bgYellow,
        commonLineTrailingSpaceColor: _chalk.default.bgYellow,
        emptyFirstOrLastLinePlaceholder: '↵',
        // U+21B5
        expand: expand,
        includeChangeCounts: true
      });
    }

    var diffs = (0, _jestDiff.diffStringsRaw)(expected, received, true);
    var hasCommonDiff = diffs.some(function (diff) {
      return diff[0] === _jestDiff.DIFF_EQUAL;
    });

    var _printLabel = getLabelPrinter(expectedLabel, receivedLabel);

    var _expectedLine = _printLabel(expectedLabel) + printExpected(getCommonAndChangedSubstrings(diffs, _jestDiff.DIFF_DELETE, hasCommonDiff));

    var _receivedLine = _printLabel(receivedLabel) + printReceived(getCommonAndChangedSubstrings(diffs, _jestDiff.DIFF_INSERT, hasCommonDiff));

    return _expectedLine + '\n' + _receivedLine;
  }

  if (isLineDiffable(expected, received)) {
    var _replaceMatchedToAsym = replaceMatchedToAsymmetricMatcher((0, _deepCyclicCopyReplaceable.default)(expected), (0, _deepCyclicCopyReplaceable.default)(received), [], []),
        replacedExpected = _replaceMatchedToAsym.replacedExpected,
        replacedReceived = _replaceMatchedToAsym.replacedReceived;

    var difference = (0, _jestDiff.default)(replacedExpected, replacedReceived, {
      aAnnotation: expectedLabel,
      bAnnotation: receivedLabel,
      expand: expand,
      includeChangeCounts: true
    });

    if (typeof difference === 'string' && difference.includes('- ' + expectedLabel) && difference.includes('+ ' + receivedLabel)) {
      return difference;
    }
  }

  var printLabel = getLabelPrinter(expectedLabel, receivedLabel);
  var expectedLine = printLabel(expectedLabel) + printExpected(expected);
  var receivedLine = printLabel(receivedLabel) + (stringify(expected) === stringify(received) ? 'serializes to the same string' : printReceived(received));
  return expectedLine + '\n' + receivedLine;
}; // Sometimes, e.g. when comparing two numbers, the output from jest-diff
// does not contain more information than the `Expected:` / `Received:` already gives.
// In those cases, we do not print a diff to make the output shorter and not redundant.


exports.printDiffOrStringify = printDiffOrStringify;

var shouldPrintDiff = function shouldPrintDiff(actual, expected) {
  if (typeof actual === 'number' && typeof expected === 'number') {
    return false;
  }

  if (typeof actual === 'bigint' && typeof expected === 'bigint') {
    return false;
  }

  if (typeof actual === 'boolean' && typeof expected === 'boolean') {
    return false;
  }

  return true;
};

function replaceMatchedToAsymmetricMatcher(replacedExpected, replacedReceived, expectedCycles, receivedCycles) {
  if (!_Replaceable.default.isReplaceable(replacedExpected, replacedReceived)) {
    return {
      replacedExpected: replacedExpected,
      replacedReceived: replacedReceived
    };
  }

  if (expectedCycles.includes(replacedExpected) || receivedCycles.includes(replacedReceived)) {
    return {
      replacedExpected: replacedExpected,
      replacedReceived: replacedReceived
    };
  }

  expectedCycles.push(replacedExpected);
  receivedCycles.push(replacedReceived);
  var expectedReplaceable = new _Replaceable.default(replacedExpected);
  var receivedReplaceable = new _Replaceable.default(replacedReceived);
  expectedReplaceable.forEach(function (expectedValue, key) {
    var receivedValue = receivedReplaceable.get(key);

    if (isAsymmetricMatcher(expectedValue)) {
      if (expectedValue.asymmetricMatch(receivedValue)) {
        receivedReplaceable.set(key, expectedValue);
      }
    } else if (isAsymmetricMatcher(receivedValue)) {
      if (receivedValue.asymmetricMatch(expectedValue)) {
        expectedReplaceable.set(key, receivedValue);
      }
    } else if (_Replaceable.default.isReplaceable(expectedValue, receivedValue)) {
      var replaced = replaceMatchedToAsymmetricMatcher(expectedValue, receivedValue, expectedCycles, receivedCycles);
      expectedReplaceable.set(key, replaced.replacedExpected);
      receivedReplaceable.set(key, replaced.replacedReceived);
    }
  });
  return {
    replacedExpected: expectedReplaceable.object,
    replacedReceived: receivedReplaceable.object
  };
}

function isAsymmetricMatcher(data) {
  var type = (0, _jestGetType.default)(data);
  return type === 'object' && typeof data.asymmetricMatch === 'function';
}

var diff = function diff(a, b, options) {
  return shouldPrintDiff(a, b) ? (0, _jestDiff.default)(a, b, options) : null;
};

exports.diff = diff;

var pluralize = function pluralize(word, count) {
  return (NUMBERS[count] || count) + ' ' + word + (count === 1 ? '' : 's');
}; // To display lines of labeled values as two columns with monospace alignment:
// given the strings which will describe the values,
// return function which given each string, returns the label:
// string, colon, space, and enough padding spaces to align the value.


exports.pluralize = pluralize;

var getLabelPrinter = function getLabelPrinter() {
  for (var _len = arguments.length, strings = new Array(_len), _key = 0; _key < _len; _key++) {
    strings[_key] = arguments[_key];
  }

  var maxLength = strings.reduce(function (max, string) {
    return string.length > max ? string.length : max;
  }, 0);
  return function (string) {
    return "".concat(string, ": ").concat(' '.repeat(maxLength - string.length));
  };
};

exports.getLabelPrinter = getLabelPrinter;

var matcherErrorMessage = function matcherErrorMessage(hint, generic, specific) {
  return "".concat(hint, "\n\n").concat(_chalk.default.bold('Matcher error'), ": ").concat(generic).concat(typeof specific === 'string' ? '\n\n' + specific : '');
}; // Display assertion for the report when a test fails.
// New format: rejects/resolves, not, and matcher name have black color
// Old format: matcher name has dim color


exports.matcherErrorMessage = matcherErrorMessage;

var matcherHint = function matcherHint(matcherName) {
  var received = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'received';
  var expected = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'expected';
  var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  var _options$comment = options.comment,
      comment = _options$comment === void 0 ? '' : _options$comment,
      _options$expectedColo = options.expectedColor,
      expectedColor = _options$expectedColo === void 0 ? EXPECTED_COLOR : _options$expectedColo,
      _options$isDirectExpe = options.isDirectExpectCall,
      isDirectExpectCall = _options$isDirectExpe === void 0 ? false : _options$isDirectExpe,
      _options$isNot = options.isNot,
      isNot = _options$isNot === void 0 ? false : _options$isNot,
      _options$promise = options.promise,
      promise = _options$promise === void 0 ? '' : _options$promise,
      _options$receivedColo = options.receivedColor,
      receivedColor = _options$receivedColo === void 0 ? RECEIVED_COLOR : _options$receivedColo,
      _options$secondArgume = options.secondArgument,
      secondArgument = _options$secondArgume === void 0 ? '' : _options$secondArgume,
      _options$secondArgume2 = options.secondArgumentColor,
      secondArgumentColor = _options$secondArgume2 === void 0 ? EXPECTED_COLOR : _options$secondArgume2;
  var hint = '';
  var dimString = 'expect'; // concatenate adjacent dim substrings

  if (!isDirectExpectCall && received !== '') {
    hint += DIM_COLOR(dimString + '(') + receivedColor(received);
    dimString = ')';
  }

  if (promise !== '') {
    hint += DIM_COLOR(dimString + '.') + promise;
    dimString = '';
  }

  if (isNot) {
    hint += DIM_COLOR(dimString + '.') + 'not';
    dimString = '';
  }

  if (matcherName.includes('.')) {
    // Old format: for backward compatibility,
    // especially without promise or isNot options
    dimString += matcherName;
  } else {
    // New format: omit period from matcherName arg
    hint += DIM_COLOR(dimString + '.') + matcherName;
    dimString = '';
  }

  if (expected === '') {
    dimString += '()';
  } else {
    hint += DIM_COLOR(dimString + '(') + expectedColor(expected);

    if (secondArgument) {
      hint += DIM_COLOR(', ') + secondArgumentColor(secondArgument);
    }

    dimString = ')';
  }

  if (comment !== '') {
    dimString += ' // ' + comment;
  }

  if (dimString !== '') {
    hint += DIM_COLOR(dimString);
  }

  return hint;
};

exports.matcherHint = matcherHint;

/***/ }),

/***/ "./packages/jest-message-util/build/index.js":
/*!***************************************************!*\
  !*** ./packages/jest-message-util/build/index.js ***!
  \***************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(global) {

function _createForOfIteratorHelper(o) { if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (o = _unsupportedIterableToArray(o))) { var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var it, normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.separateMessageFromStack = exports.formatResultsErrors = exports.formatStackTrace = exports.getTopFrame = exports.getStackTraceLines = exports.formatExecError = void 0;

var path = _interopRequireWildcard(__webpack_require__(/*! path */ "./node_modules/path-browserify/index.js"));

var fs = _interopRequireWildcard(__webpack_require__(/*! graceful-fs */ "./node_modules/node-libs-browser/mock/empty.js"));

var _chalk = _interopRequireDefault(__webpack_require__(/*! chalk */ "./packages/expect/build/fakeChalk.js"));

var _micromatch = _interopRequireDefault(__webpack_require__(/*! micromatch */ "./node_modules/micromatch/index.js"));

var _slash = _interopRequireDefault(__webpack_require__(/*! slash */ "./node_modules/slash/index.js"));

var _codeFrame = __webpack_require__(/*! @babel/code-frame */ "./node_modules/@babel/code-frame/lib/index.js");

var _stackUtils = _interopRequireDefault(__webpack_require__(/*! stack-utils */ "./node_modules/stack-utils/index.js"));

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : {
    default: obj
  };
}

function _getRequireWildcardCache() {
  if (typeof WeakMap !== 'function') return null;
  var cache = new WeakMap();

  _getRequireWildcardCache = function _getRequireWildcardCache() {
    return cache;
  };

  return cache;
}

function _interopRequireWildcard(obj) {
  if (obj && obj.__esModule) {
    return obj;
  }

  if (obj === null || _typeof(obj) !== 'object' && typeof obj !== 'function') {
    return {
      default: obj
    };
  }

  var cache = _getRequireWildcardCache();

  if (cache && cache.has(obj)) {
    return cache.get(obj);
  }

  var newObj = {};
  var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;

  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;

      if (desc && (desc.get || desc.set)) {
        Object.defineProperty(newObj, key, desc);
      } else {
        newObj[key] = obj[key];
      }
    }
  }

  newObj.default = obj;

  if (cache) {
    cache.set(obj, newObj);
  }

  return newObj;
}

var _Symbol = global['jest-symbol-do-not-touch'] || global.Symbol;

var _Symbol = global['jest-symbol-do-not-touch'] || global.Symbol;

var jestReadFile = global[_Symbol.for('jest-native-read-file')] || fs.readFileSync; // stack utils tries to create pretty stack by making paths relative.

var stackUtils = new _stackUtils.default({
  cwd: 'something which does not exist'
});
var nodeInternals = [];

try {
  nodeInternals = _stackUtils.default.nodeInternals();
} catch (e) {// `StackUtils.nodeInternals()` fails in browsers. We don't need to remove
  // node internals in the browser though, so no issue.
}

var PATH_NODE_MODULES = "".concat(path.sep, "node_modules").concat(path.sep);
var PATH_JEST_PACKAGES = "".concat(path.sep, "jest").concat(path.sep, "packages").concat(path.sep); // filter for noisy stack trace lines

var JASMINE_IGNORE = /^\s+at(?:(?:.jasmine\-)|\s+jasmine\.buildExpectationResult)/;
var JEST_INTERNALS_IGNORE = /^\s+at.*?jest(-.*?)?(\/|\\)(build|node_modules|packages)(\/|\\)/;
var ANONYMOUS_FN_IGNORE = /^\s+at <anonymous>.*$/;
var ANONYMOUS_PROMISE_IGNORE = /^\s+at (new )?Promise \(<anonymous>\).*$/;
var ANONYMOUS_GENERATOR_IGNORE = /^\s+at Generator.next \(<anonymous>\).*$/;
var NATIVE_NEXT_IGNORE = /^\s+at next \(native\).*$/;
var TITLE_INDENT = '  ';
var MESSAGE_INDENT = '    ';
var STACK_INDENT = '      ';
var ANCESTRY_SEPARATOR = " \u203A ";

var TITLE_BULLET = _chalk.default.bold("\u25CF ");

var STACK_TRACE_COLOR = _chalk.default.dim;
var STACK_PATH_REGEXP = /\s*at.*\(?(\:\d*\:\d*|native)\)?/;
var EXEC_ERROR_MESSAGE = 'Test suite failed to run';
var NOT_EMPTY_LINE_REGEXP = /^(?!$)/gm;

var indentAllLines = function indentAllLines(lines, indent) {
  return lines.replace(NOT_EMPTY_LINE_REGEXP, indent);
};

var trim = function trim(string) {
  return (string || '').trim();
}; // Some errors contain not only line numbers in stack traces
// e.g. SyntaxErrors can contain snippets of code, and we don't
// want to trim those, because they may have pointers to the column/character
// which will get misaligned.


var trimPaths = function trimPaths(string) {
  return string.match(STACK_PATH_REGEXP) ? trim(string) : string;
};

var getRenderedCallsite = function getRenderedCallsite(fileContent, line, column) {
  var renderedCallsite = (0, _codeFrame.codeFrameColumns)(fileContent, {
    start: {
      column: column,
      line: line
    }
  }, {
    highlightCode: true
  });
  renderedCallsite = indentAllLines(renderedCallsite, MESSAGE_INDENT);
  renderedCallsite = "\n".concat(renderedCallsite, "\n");
  return renderedCallsite;
};

var blankStringRegexp = /^\s*$/;

function checkForCommonEnvironmentErrors(error) {
  if (error.includes('ReferenceError: document is not defined') || error.includes('ReferenceError: window is not defined') || error.includes('ReferenceError: navigator is not defined')) {
    return warnAboutWrongTestEnvironment(error, 'jsdom');
  } else if (error.includes('.unref is not a function')) {
    return warnAboutWrongTestEnvironment(error, 'node');
  }

  return error;
}

function warnAboutWrongTestEnvironment(error, env) {
  return _chalk.default.bold.red("The error below may be caused by using the wrong test environment, see ".concat(_chalk.default.dim.underline('https://jestjs.io/docs/en/configuration#testenvironment-string'), ".\nConsider using the \"").concat(env, "\" test environment.\n\n")) + error;
} // ExecError is an error thrown outside of the test suite (not inside an `it` or
// `before/after each` hooks). If it's thrown, none of the tests in the file
// are executed.


var formatExecError = function formatExecError(error, config, options, testPath, reuseMessage) {
  if (!error || typeof error === 'number') {
    error = new Error("Expected an Error, but \"".concat(String(error), "\" was thrown"));
    error.stack = '';
  }

  var message, stack;

  if (typeof error === 'string' || !error) {
    error || (error = 'EMPTY ERROR');
    message = '';
    stack = error;
  } else {
    message = error.message;
    stack = error.stack;
  }

  var separated = separateMessageFromStack(stack || '');
  stack = separated.stack;

  if (separated.message.includes(trim(message))) {
    // Often stack trace already contains the duplicate of the message
    message = separated.message;
  }

  message = checkForCommonEnvironmentErrors(message);
  message = indentAllLines(message, MESSAGE_INDENT);
  stack = stack && !options.noStackTrace ? '\n' + formatStackTrace(stack, config, options, testPath) : '';

  if (blankStringRegexp.test(message) && blankStringRegexp.test(stack)) {
    // this can happen if an empty object is thrown.
    message = MESSAGE_INDENT + 'Error: No message was provided';
  }

  var messageToUse;

  if (reuseMessage) {
    messageToUse = " ".concat(message.trim());
  } else {
    messageToUse = "".concat(EXEC_ERROR_MESSAGE, "\n\n").concat(message);
  }

  return TITLE_INDENT + TITLE_BULLET + messageToUse + stack + '\n';
};

exports.formatExecError = formatExecError;

var removeInternalStackEntries = function removeInternalStackEntries(lines, options) {
  var pathCounter = 0;
  return lines.filter(function (line) {
    if (ANONYMOUS_FN_IGNORE.test(line)) {
      return false;
    }

    if (ANONYMOUS_PROMISE_IGNORE.test(line)) {
      return false;
    }

    if (ANONYMOUS_GENERATOR_IGNORE.test(line)) {
      return false;
    }

    if (NATIVE_NEXT_IGNORE.test(line)) {
      return false;
    }

    if (nodeInternals.some(function (internal) {
      return internal.test(line);
    })) {
      return false;
    }

    if (!STACK_PATH_REGEXP.test(line)) {
      return true;
    }

    if (JASMINE_IGNORE.test(line)) {
      return false;
    }

    if (++pathCounter === 1) {
      return true; // always keep the first line even if it's from Jest
    }

    if (options.noStackTrace) {
      return false;
    }

    if (JEST_INTERNALS_IGNORE.test(line)) {
      return false;
    }

    return true;
  });
};

var formatPaths = function formatPaths(config, relativeTestPath, line) {
  // Extract the file path from the trace line.
  var match = line.match(/(^\s*at .*?\(?)([^()]+)(:[0-9]+:[0-9]+\)?.*$)/);

  if (!match) {
    return line;
  }

  var filePath = (0, _slash.default)(path.relative(config.rootDir, match[2])); // highlight paths from the current test file

  if (config.testMatch && config.testMatch.length && (0, _micromatch.default)([filePath], config.testMatch).length > 0 || filePath === relativeTestPath) {
    filePath = _chalk.default.reset.cyan(filePath);
  }

  return STACK_TRACE_COLOR(match[1]) + filePath + STACK_TRACE_COLOR(match[3]);
};

var getStackTraceLines = function getStackTraceLines(stack) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {
    noCodeFrame: false,
    noStackTrace: false
  };
  return removeInternalStackEntries(stack.split(/\n/), options);
};

exports.getStackTraceLines = getStackTraceLines;

var getTopFrame = function getTopFrame(lines) {
  var _iterator = _createForOfIteratorHelper(lines),
      _step;

  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var line = _step.value;

      if (line.includes(PATH_NODE_MODULES) || line.includes(PATH_JEST_PACKAGES)) {
        continue;
      }

      var parsedFrame = stackUtils.parseLine(line.trim());

      if (parsedFrame && parsedFrame.file) {
        return parsedFrame;
      }
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }

  return null;
};

exports.getTopFrame = getTopFrame;

var formatStackTrace = function formatStackTrace(stack, config, options, testPath) {
  var lines = getStackTraceLines(stack, options);
  var renderedCallsite = '';
  var relativeTestPath = testPath ? (0, _slash.default)(path.relative(config.rootDir, testPath)) : null;

  if (!options.noStackTrace && !options.noCodeFrame) {
    var topFrame = getTopFrame(lines);

    if (topFrame) {
      var column = topFrame.column,
          filename = topFrame.file,
          line = topFrame.line;

      if (line && filename && path.isAbsolute(filename)) {
        var fileContent;

        try {
          // TODO: check & read HasteFS instead of reading the filesystem:
          // see: https://github.com/facebook/jest/pull/5405#discussion_r164281696
          fileContent = jestReadFile(filename, 'utf8');
          renderedCallsite = getRenderedCallsite(fileContent, line, column);
        } catch (e) {// the file does not exist or is inaccessible, we ignore
        }
      }
    }
  }

  var stacktrace = lines.filter(Boolean).map(function (line) {
    return STACK_INDENT + formatPaths(config, relativeTestPath, trimPaths(line));
  }).join('\n');
  return renderedCallsite ? "".concat(renderedCallsite, "\n").concat(stacktrace) : "\n".concat(stacktrace);
};

exports.formatStackTrace = formatStackTrace;

var formatResultsErrors = function formatResultsErrors(testResults, config, options, testPath) {
  var failedResults = testResults.reduce(function (errors, result) {
    result.failureMessages.map(checkForCommonEnvironmentErrors).forEach(function (content) {
      return errors.push({
        content: content,
        result: result
      });
    });
    return errors;
  }, []);

  if (!failedResults.length) {
    return null;
  }

  return failedResults.map(function (_ref) {
    var result = _ref.result,
        content = _ref.content;

    var _separateMessageFromS = separateMessageFromStack(content),
        message = _separateMessageFromS.message,
        stack = _separateMessageFromS.stack;

    stack = options.noStackTrace ? '' : STACK_TRACE_COLOR(formatStackTrace(stack, config, options, testPath)) + '\n';
    message = indentAllLines(message, MESSAGE_INDENT);
    var title = _chalk.default.bold.red(TITLE_INDENT + TITLE_BULLET + result.ancestorTitles.join(ANCESTRY_SEPARATOR) + (result.ancestorTitles.length ? ANCESTRY_SEPARATOR : '') + result.title) + '\n';
    return title + '\n' + message + '\n' + stack;
  }).join('\n');
};

exports.formatResultsErrors = formatResultsErrors;
var errorRegexp = /^Error:?\s*$/;

var removeBlankErrorLine = function removeBlankErrorLine(str) {
  return str.split('\n') // Lines saying just `Error:` are useless
  .filter(function (line) {
    return !errorRegexp.test(line);
  }).join('\n').trimRight();
}; // jasmine and worker farm sometimes don't give us access to the actual
// Error object, so we have to regexp out the message from the stack string
// to format it.


var separateMessageFromStack = function separateMessageFromStack(content) {
  if (!content) {
    return {
      message: '',
      stack: ''
    };
  } // All lines up to what looks like a stack -- or if nothing looks like a stack
  // (maybe it's a code frame instead), just the first non-empty line.
  // If the error is a plain "Error:" instead of a SyntaxError or TypeError we
  // remove the prefix from the message because it is generally not useful.


  var messageMatch = content.match(/^(?:Error: )?([\s\S]*?(?=\n\s*at\s.*:\d*:\d*)|\s*.*)([\s\S]*)$/);

  if (!messageMatch) {
    // For typescript
    throw new Error('If you hit this error, the regex above is buggy.');
  }

  var message = removeBlankErrorLine(messageMatch[1]);
  var stack = removeBlankErrorLine(messageMatch[2]);
  return {
    message: message,
    stack: stack
  };
};

exports.separateMessageFromStack = separateMessageFromStack;
/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../../../node_modules/webpack/buildin/global.js */ "./node_modules/webpack/buildin/global.js")))

/***/ }),

/***/ "./packages/pretty-format/build/collections.js":
/*!*****************************************************!*\
  !*** ./packages/pretty-format/build/collections.js ***!
  \*****************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.printIteratorEntries = printIteratorEntries;
exports.printIteratorValues = printIteratorValues;
exports.printListItems = printListItems;
exports.printObjectProperties = printObjectProperties;
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

var getKeysOfEnumerableProperties = function getKeysOfEnumerableProperties(object) {
  var keys = Object.keys(object).sort();

  if (Object.getOwnPropertySymbols) {
    Object.getOwnPropertySymbols(object).forEach(function (symbol) {
      if (Object.getOwnPropertyDescriptor(object, symbol).enumerable) {
        keys.push(symbol);
      }
    });
  }

  return keys;
};
/**
 * Return entries (for example, of a map)
 * with spacing, indentation, and comma
 * without surrounding punctuation (for example, braces)
 */


function printIteratorEntries(iterator, config, indentation, depth, refs, printer) {
  var separator = arguments.length > 6 && arguments[6] !== undefined ? arguments[6] : ': ';
  var result = '';
  var current = iterator.next();

  if (!current.done) {
    result += config.spacingOuter;
    var indentationNext = indentation + config.indent;

    while (!current.done) {
      var name = printer(current.value[0], config, indentationNext, depth, refs);
      var value = printer(current.value[1], config, indentationNext, depth, refs);
      result += indentationNext + name + separator + value;
      current = iterator.next();

      if (!current.done) {
        result += ',' + config.spacingInner;
      } else if (!config.min) {
        result += ',';
      }
    }

    result += config.spacingOuter + indentation;
  }

  return result;
}
/**
 * Return values (for example, of a set)
 * with spacing, indentation, and comma
 * without surrounding punctuation (braces or brackets)
 */


function printIteratorValues(iterator, config, indentation, depth, refs, printer) {
  var result = '';
  var current = iterator.next();

  if (!current.done) {
    result += config.spacingOuter;
    var indentationNext = indentation + config.indent;

    while (!current.done) {
      result += indentationNext + printer(current.value, config, indentationNext, depth, refs);
      current = iterator.next();

      if (!current.done) {
        result += ',' + config.spacingInner;
      } else if (!config.min) {
        result += ',';
      }
    }

    result += config.spacingOuter + indentation;
  }

  return result;
}
/**
 * Return items (for example, of an array)
 * with spacing, indentation, and comma
 * without surrounding punctuation (for example, brackets)
 **/


function printListItems(list, config, indentation, depth, refs, printer) {
  var result = '';

  if (list.length) {
    result += config.spacingOuter;
    var indentationNext = indentation + config.indent;

    for (var i = 0; i < list.length; i++) {
      result += indentationNext + printer(list[i], config, indentationNext, depth, refs);

      if (i < list.length - 1) {
        result += ',' + config.spacingInner;
      } else if (!config.min) {
        result += ',';
      }
    }

    result += config.spacingOuter + indentation;
  }

  return result;
}
/**
 * Return properties of an object
 * with spacing, indentation, and comma
 * without surrounding punctuation (for example, braces)
 */


function printObjectProperties(val, config, indentation, depth, refs, printer) {
  var result = '';
  var keys = getKeysOfEnumerableProperties(val);

  if (keys.length) {
    result += config.spacingOuter;
    var indentationNext = indentation + config.indent;

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var name = printer(key, config, indentationNext, depth, refs);
      var value = printer(val[key], config, indentationNext, depth, refs);
      result += indentationNext + name + ': ' + value;

      if (i < keys.length - 1) {
        result += ',' + config.spacingInner;
      } else if (!config.min) {
        result += ',';
      }
    }

    result += config.spacingOuter + indentation;
  }

  return result;
}

/***/ }),

/***/ "./packages/pretty-format/build/index.js":
/*!***********************************************!*\
  !*** ./packages/pretty-format/build/index.js ***!
  \***********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _createSuper(Derived) { return function () { var Super = _getPrototypeOf(Derived), result; if (_isNativeReflectConstruct()) { var NewTarget = _getPrototypeOf(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn(this, result); }; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _wrapNativeSuper(Class) { var _cache = typeof Map === "function" ? new Map() : undefined; _wrapNativeSuper = function _wrapNativeSuper(Class) { if (Class === null || !_isNativeFunction(Class)) return Class; if (typeof Class !== "function") { throw new TypeError("Super expression must either be null or a function"); } if (typeof _cache !== "undefined") { if (_cache.has(Class)) return _cache.get(Class); _cache.set(Class, Wrapper); } function Wrapper() { return _construct(Class, arguments, _getPrototypeOf(this).constructor); } Wrapper.prototype = Object.create(Class.prototype, { constructor: { value: Wrapper, enumerable: false, writable: true, configurable: true } }); return _setPrototypeOf(Wrapper, Class); }; return _wrapNativeSuper(Class); }

function _construct(Parent, args, Class) { if (_isNativeReflectConstruct()) { _construct = Reflect.construct; } else { _construct = function _construct(Parent, args, Class) { var a = [null]; a.push.apply(a, args); var Constructor = Function.bind.apply(Parent, a); var instance = new Constructor(); if (Class) _setPrototypeOf(instance, Class.prototype); return instance; }; } return _construct.apply(null, arguments); }

function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Date.prototype.toString.call(Reflect.construct(Date, [], function () {})); return true; } catch (e) { return false; } }

function _isNativeFunction(fn) { return Function.toString.call(fn).indexOf("[native code]") !== -1; }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

var _ansiStyles = _interopRequireDefault(__webpack_require__(/*! ansi-styles */ "./node_modules/ansi-styles/index.js"));

var _collections = __webpack_require__(/*! ./collections */ "./packages/pretty-format/build/collections.js");

var _AsymmetricMatcher = _interopRequireDefault(__webpack_require__(/*! ./plugins/AsymmetricMatcher */ "./packages/pretty-format/build/plugins/AsymmetricMatcher.js"));

var _ConvertAnsi = _interopRequireDefault(__webpack_require__(/*! ./plugins/ConvertAnsi */ "./packages/pretty-format/build/plugins/ConvertAnsi.js"));

var _DOMCollection = _interopRequireDefault(__webpack_require__(/*! ./plugins/DOMCollection */ "./packages/pretty-format/build/plugins/DOMCollection.js"));

var _DOMElement = _interopRequireDefault(__webpack_require__(/*! ./plugins/DOMElement */ "./packages/pretty-format/build/plugins/DOMElement.js"));

var _Immutable = _interopRequireDefault(__webpack_require__(/*! ./plugins/Immutable */ "./packages/pretty-format/build/plugins/Immutable.js"));

var _ReactElement = _interopRequireDefault(__webpack_require__(/*! ./plugins/ReactElement */ "./packages/pretty-format/build/plugins/ReactElement.js"));

var _ReactTestComponent = _interopRequireDefault(__webpack_require__(/*! ./plugins/ReactTestComponent */ "./packages/pretty-format/build/plugins/ReactTestComponent.js"));

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : {
    default: obj
  };
}
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */


var toString = Object.prototype.toString;
var toISOString = Date.prototype.toISOString;
var errorToString = Error.prototype.toString;
var regExpToString = RegExp.prototype.toString;
/**
 * Explicitly comparing typeof constructor to function avoids undefined as name
 * when mock identity-obj-proxy returns the key as the value for any key.
 */

var getConstructorName = function getConstructorName(val) {
  return typeof val.constructor === 'function' && val.constructor.name || 'Object';
};
/* global window */

/** Is val is equal to global window object? Works even if it does not exist :) */


var isWindow = function isWindow(val) {
  return typeof window !== 'undefined' && val === window;
};

var SYMBOL_REGEXP = /^Symbol\((.*)\)(.*)$/;
var NEWLINE_REGEXP = /\n/gi;

var PrettyFormatPluginError = /*#__PURE__*/function (_Error) {
  _inherits(PrettyFormatPluginError, _Error);

  var _super = _createSuper(PrettyFormatPluginError);

  function PrettyFormatPluginError(message, stack) {
    var _this;

    _classCallCheck(this, PrettyFormatPluginError);

    _this = _super.call(this, message);
    _this.stack = stack;
    _this.name = _this.constructor.name;
    return _this;
  }

  return PrettyFormatPluginError;
}( /*#__PURE__*/_wrapNativeSuper(Error));

function isToStringedArrayType(toStringed) {
  return toStringed === '[object Array]' || toStringed === '[object ArrayBuffer]' || toStringed === '[object DataView]' || toStringed === '[object Float32Array]' || toStringed === '[object Float64Array]' || toStringed === '[object Int8Array]' || toStringed === '[object Int16Array]' || toStringed === '[object Int32Array]' || toStringed === '[object Uint8Array]' || toStringed === '[object Uint8ClampedArray]' || toStringed === '[object Uint16Array]' || toStringed === '[object Uint32Array]';
}

function printNumber(val) {
  return Object.is(val, -0) ? '-0' : String(val);
}

function printBigInt(val) {
  return String("".concat(val, "n"));
}

function printFunction(val, printFunctionName) {
  if (!printFunctionName) {
    return '[Function]';
  }

  return '[Function ' + (val.name || 'anonymous') + ']';
}

function printSymbol(val) {
  return String(val).replace(SYMBOL_REGEXP, 'Symbol($1)');
}

function printError(val) {
  return '[' + errorToString.call(val) + ']';
}
/**
 * The first port of call for printing an object, handles most of the
 * data-types in JS.
 */


function printBasicValue(val, printFunctionName, escapeRegex, escapeString) {
  if (val === true || val === false) {
    return '' + val;
  }

  if (val === undefined) {
    return 'undefined';
  }

  if (val === null) {
    return 'null';
  }

  var typeOf = _typeof(val);

  if (typeOf === 'number') {
    return printNumber(val);
  }

  if (typeOf === 'bigint') {
    return printBigInt(val);
  }

  if (typeOf === 'string') {
    if (escapeString) {
      return '"' + val.replace(/"|\\/g, '\\$&') + '"';
    }

    return '"' + val + '"';
  }

  if (typeOf === 'function') {
    return printFunction(val, printFunctionName);
  }

  if (typeOf === 'symbol') {
    return printSymbol(val);
  }

  var toStringed = toString.call(val);

  if (toStringed === '[object WeakMap]') {
    return 'WeakMap {}';
  }

  if (toStringed === '[object WeakSet]') {
    return 'WeakSet {}';
  }

  if (toStringed === '[object Function]' || toStringed === '[object GeneratorFunction]') {
    return printFunction(val, printFunctionName);
  }

  if (toStringed === '[object Symbol]') {
    return printSymbol(val);
  }

  if (toStringed === '[object Date]') {
    return isNaN(+val) ? 'Date { NaN }' : toISOString.call(val);
  }

  if (toStringed === '[object Error]') {
    return printError(val);
  }

  if (toStringed === '[object RegExp]') {
    if (escapeRegex) {
      // https://github.com/benjamingr/RegExp.escape/blob/master/polyfill.js
      return regExpToString.call(val).replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    return regExpToString.call(val);
  }

  if (val instanceof Error) {
    return printError(val);
  }

  return null;
}
/**
 * Handles more complex objects ( such as objects with circular references.
 * maps and sets etc )
 */


function printComplexValue(val, config, indentation, depth, refs, hasCalledToJSON) {
  if (refs.indexOf(val) !== -1) {
    return '[Circular]';
  }

  refs = refs.slice();
  refs.push(val);
  var hitMaxDepth = ++depth > config.maxDepth;
  var min = config.min;

  if (config.callToJSON && !hitMaxDepth && val.toJSON && typeof val.toJSON === 'function' && !hasCalledToJSON) {
    return printer(val.toJSON(), config, indentation, depth, refs, true);
  }

  var toStringed = toString.call(val);

  if (toStringed === '[object Arguments]') {
    return hitMaxDepth ? '[Arguments]' : (min ? '' : 'Arguments ') + '[' + (0, _collections.printListItems)(val, config, indentation, depth, refs, printer) + ']';
  }

  if (isToStringedArrayType(toStringed)) {
    return hitMaxDepth ? '[' + val.constructor.name + ']' : (min ? '' : val.constructor.name + ' ') + '[' + (0, _collections.printListItems)(val, config, indentation, depth, refs, printer) + ']';
  }

  if (toStringed === '[object Map]') {
    return hitMaxDepth ? '[Map]' : 'Map {' + (0, _collections.printIteratorEntries)(val.entries(), config, indentation, depth, refs, printer, ' => ') + '}';
  }

  if (toStringed === '[object Set]') {
    return hitMaxDepth ? '[Set]' : 'Set {' + (0, _collections.printIteratorValues)(val.values(), config, indentation, depth, refs, printer) + '}';
  } // Avoid failure to serialize global window object in jsdom test environment.
  // For example, not even relevant if window is prop of React element.


  return hitMaxDepth || isWindow(val) ? '[' + getConstructorName(val) + ']' : (min ? '' : getConstructorName(val) + ' ') + '{' + (0, _collections.printObjectProperties)(val, config, indentation, depth, refs, printer) + '}';
}

function isNewPlugin(plugin) {
  return plugin.serialize != null;
}

function printPlugin(plugin, val, config, indentation, depth, refs) {
  var printed;

  try {
    printed = isNewPlugin(plugin) ? plugin.serialize(val, config, indentation, depth, refs, printer) : plugin.print(val, function (valChild) {
      return printer(valChild, config, indentation, depth, refs);
    }, function (str) {
      var indentationNext = indentation + config.indent;
      return indentationNext + str.replace(NEWLINE_REGEXP, '\n' + indentationNext);
    }, {
      edgeSpacing: config.spacingOuter,
      min: config.min,
      spacing: config.spacingInner
    }, config.colors);
  } catch (error) {
    throw new PrettyFormatPluginError(error.message, error.stack);
  }

  if (typeof printed !== 'string') {
    throw new Error("pretty-format: Plugin must return type \"string\" but instead returned \"".concat(_typeof(printed), "\"."));
  }

  return printed;
}

function findPlugin(plugins, val) {
  for (var p = 0; p < plugins.length; p++) {
    try {
      if (plugins[p].test(val)) {
        return plugins[p];
      }
    } catch (error) {
      throw new PrettyFormatPluginError(error.message, error.stack);
    }
  }

  return null;
}

function printer(val, config, indentation, depth, refs, hasCalledToJSON) {
  var plugin = findPlugin(config.plugins, val);

  if (plugin !== null) {
    return printPlugin(plugin, val, config, indentation, depth, refs);
  }

  var basicResult = printBasicValue(val, config.printFunctionName, config.escapeRegex, config.escapeString);

  if (basicResult !== null) {
    return basicResult;
  }

  return printComplexValue(val, config, indentation, depth, refs, hasCalledToJSON);
}

var DEFAULT_THEME = {
  comment: 'gray',
  content: 'reset',
  prop: 'yellow',
  tag: 'cyan',
  value: 'green'
};
var DEFAULT_THEME_KEYS = Object.keys(DEFAULT_THEME);
var DEFAULT_OPTIONS = {
  callToJSON: true,
  escapeRegex: false,
  escapeString: true,
  highlight: false,
  indent: 2,
  maxDepth: Infinity,
  min: false,
  plugins: [],
  printFunctionName: true,
  theme: DEFAULT_THEME
};

function validateOptions(options) {
  Object.keys(options).forEach(function (key) {
    if (!DEFAULT_OPTIONS.hasOwnProperty(key)) {
      throw new Error("pretty-format: Unknown option \"".concat(key, "\"."));
    }
  });

  if (options.min && options.indent !== undefined && options.indent !== 0) {
    throw new Error('pretty-format: Options "min" and "indent" cannot be used together.');
  }

  if (options.theme !== undefined) {
    if (options.theme === null) {
      throw new Error("pretty-format: Option \"theme\" must not be null.");
    }

    if (_typeof(options.theme) !== 'object') {
      throw new Error("pretty-format: Option \"theme\" must be of type \"object\" but instead received \"".concat(_typeof(options.theme), "\"."));
    }
  }
}

var getColorsHighlight = function getColorsHighlight(options) {
  return DEFAULT_THEME_KEYS.reduce(function (colors, key) {
    var value = options.theme && options.theme[key] !== undefined ? options.theme[key] : DEFAULT_THEME[key];
    var color = value && _ansiStyles.default[value];

    if (color && typeof color.close === 'string' && typeof color.open === 'string') {
      colors[key] = color;
    } else {
      throw new Error("pretty-format: Option \"theme\" has a key \"".concat(key, "\" whose value \"").concat(value, "\" is undefined in ansi-styles."));
    }

    return colors;
  }, Object.create(null));
};

var getColorsEmpty = function getColorsEmpty() {
  return DEFAULT_THEME_KEYS.reduce(function (colors, key) {
    colors[key] = {
      close: '',
      open: ''
    };
    return colors;
  }, Object.create(null));
};

var getPrintFunctionName = function getPrintFunctionName(options) {
  return options && options.printFunctionName !== undefined ? options.printFunctionName : DEFAULT_OPTIONS.printFunctionName;
};

var getEscapeRegex = function getEscapeRegex(options) {
  return options && options.escapeRegex !== undefined ? options.escapeRegex : DEFAULT_OPTIONS.escapeRegex;
};

var getEscapeString = function getEscapeString(options) {
  return options && options.escapeString !== undefined ? options.escapeString : DEFAULT_OPTIONS.escapeString;
};

var getConfig = function getConfig(options) {
  return {
    callToJSON: options && options.callToJSON !== undefined ? options.callToJSON : DEFAULT_OPTIONS.callToJSON,
    colors: options && options.highlight ? getColorsHighlight(options) : getColorsEmpty(),
    escapeRegex: getEscapeRegex(options),
    escapeString: getEscapeString(options),
    indent: options && options.min ? '' : createIndent(options && options.indent !== undefined ? options.indent : DEFAULT_OPTIONS.indent),
    maxDepth: options && options.maxDepth !== undefined ? options.maxDepth : DEFAULT_OPTIONS.maxDepth,
    min: options && options.min !== undefined ? options.min : DEFAULT_OPTIONS.min,
    plugins: options && options.plugins !== undefined ? options.plugins : DEFAULT_OPTIONS.plugins,
    printFunctionName: getPrintFunctionName(options),
    spacingInner: options && options.min ? ' ' : '\n',
    spacingOuter: options && options.min ? '' : '\n'
  };
};

function createIndent(indent) {
  return new Array(indent + 1).join(' ');
}
/**
 * Returns a presentation string of your `val` object
 * @param val any potential JavaScript object
 * @param options Custom settings
 */


function prettyFormat(val, options) {
  if (options) {
    validateOptions(options);

    if (options.plugins) {
      var plugin = findPlugin(options.plugins, val);

      if (plugin !== null) {
        return printPlugin(plugin, val, getConfig(options), '', 0, []);
      }
    }
  }

  var basicResult = printBasicValue(val, getPrintFunctionName(options), getEscapeRegex(options), getEscapeString(options));

  if (basicResult !== null) {
    return basicResult;
  }

  return printComplexValue(val, getConfig(options), '', 0, []);
}

prettyFormat.plugins = {
  AsymmetricMatcher: _AsymmetricMatcher.default,
  ConvertAnsi: _ConvertAnsi.default,
  DOMCollection: _DOMCollection.default,
  DOMElement: _DOMElement.default,
  Immutable: _Immutable.default,
  ReactElement: _ReactElement.default,
  ReactTestComponent: _ReactTestComponent.default
}; // eslint-disable-next-line no-redeclare

module.exports = prettyFormat;

/***/ }),

/***/ "./packages/pretty-format/build/plugins/AsymmetricMatcher.js":
/*!*******************************************************************!*\
  !*** ./packages/pretty-format/build/plugins/AsymmetricMatcher.js ***!
  \*******************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(global) {

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.default = exports.test = exports.serialize = void 0;

var _collections = __webpack_require__(/*! ../collections */ "./packages/pretty-format/build/collections.js");

var _Symbol = global['jest-symbol-do-not-touch'] || global.Symbol;

var asymmetricMatcher = typeof _Symbol === 'function' && _Symbol.for ? _Symbol.for('jest.asymmetricMatcher') : 0x1357a5;
var SPACE = ' ';

var serialize = function serialize(val, config, indentation, depth, refs, printer) {
  var stringedValue = val.toString();

  if (stringedValue === 'ArrayContaining' || stringedValue === 'ArrayNotContaining') {
    if (++depth > config.maxDepth) {
      return '[' + stringedValue + ']';
    }

    return stringedValue + SPACE + '[' + (0, _collections.printListItems)(val.sample, config, indentation, depth, refs, printer) + ']';
  }

  if (stringedValue === 'ObjectContaining' || stringedValue === 'ObjectNotContaining') {
    if (++depth > config.maxDepth) {
      return '[' + stringedValue + ']';
    }

    return stringedValue + SPACE + '{' + (0, _collections.printObjectProperties)(val.sample, config, indentation, depth, refs, printer) + '}';
  }

  if (stringedValue === 'StringMatching' || stringedValue === 'StringNotMatching') {
    return stringedValue + SPACE + printer(val.sample, config, indentation, depth, refs);
  }

  if (stringedValue === 'StringContaining' || stringedValue === 'StringNotContaining') {
    return stringedValue + SPACE + printer(val.sample, config, indentation, depth, refs);
  }

  return val.toAsymmetricMatcher();
};

exports.serialize = serialize;

var test = function test(val) {
  return val && val.$$typeof === asymmetricMatcher;
};

exports.test = test;
var plugin = {
  serialize: serialize,
  test: test
};
var _default = plugin;
exports.default = _default;
/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../../../../node_modules/webpack/buildin/global.js */ "./node_modules/webpack/buildin/global.js")))

/***/ }),

/***/ "./packages/pretty-format/build/plugins/ConvertAnsi.js":
/*!*************************************************************!*\
  !*** ./packages/pretty-format/build/plugins/ConvertAnsi.js ***!
  \*************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.default = exports.serialize = exports.test = void 0;

var _ansiRegex = _interopRequireDefault(__webpack_require__(/*! ansi-regex */ "./node_modules/ansi-regex/index.js"));

var _ansiStyles = _interopRequireDefault(__webpack_require__(/*! ansi-styles */ "./node_modules/ansi-styles/index.js"));

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : {
    default: obj
  };
}
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */


var toHumanReadableAnsi = function toHumanReadableAnsi(text) {
  return text.replace((0, _ansiRegex.default)(), function (match) {
    switch (match) {
      case _ansiStyles.default.red.close:
      case _ansiStyles.default.green.close:
      case _ansiStyles.default.cyan.close:
      case _ansiStyles.default.gray.close:
      case _ansiStyles.default.white.close:
      case _ansiStyles.default.yellow.close:
      case _ansiStyles.default.bgRed.close:
      case _ansiStyles.default.bgGreen.close:
      case _ansiStyles.default.bgYellow.close:
      case _ansiStyles.default.inverse.close:
      case _ansiStyles.default.dim.close:
      case _ansiStyles.default.bold.close:
      case _ansiStyles.default.reset.open:
      case _ansiStyles.default.reset.close:
        return '</>';

      case _ansiStyles.default.red.open:
        return '<red>';

      case _ansiStyles.default.green.open:
        return '<green>';

      case _ansiStyles.default.cyan.open:
        return '<cyan>';

      case _ansiStyles.default.gray.open:
        return '<gray>';

      case _ansiStyles.default.white.open:
        return '<white>';

      case _ansiStyles.default.yellow.open:
        return '<yellow>';

      case _ansiStyles.default.bgRed.open:
        return '<bgRed>';

      case _ansiStyles.default.bgGreen.open:
        return '<bgGreen>';

      case _ansiStyles.default.bgYellow.open:
        return '<bgYellow>';

      case _ansiStyles.default.inverse.open:
        return '<inverse>';

      case _ansiStyles.default.dim.open:
        return '<dim>';

      case _ansiStyles.default.bold.open:
        return '<bold>';

      default:
        return '';
    }
  });
};

var test = function test(val) {
  return typeof val === 'string' && !!val.match((0, _ansiRegex.default)());
};

exports.test = test;

var serialize = function serialize(val, config, indentation, depth, refs, printer) {
  return printer(toHumanReadableAnsi(val), config, indentation, depth, refs);
};

exports.serialize = serialize;
var plugin = {
  serialize: serialize,
  test: test
};
var _default = plugin;
exports.default = _default;

/***/ }),

/***/ "./packages/pretty-format/build/plugins/DOMCollection.js":
/*!***************************************************************!*\
  !*** ./packages/pretty-format/build/plugins/DOMCollection.js ***!
  \***************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.default = exports.serialize = exports.test = void 0;

var _collections = __webpack_require__(/*! ../collections */ "./packages/pretty-format/build/collections.js");
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */


var SPACE = ' ';
var OBJECT_NAMES = ['DOMStringMap', 'NamedNodeMap'];
var ARRAY_REGEXP = /^(HTML\w*Collection|NodeList)$/;

var testName = function testName(name) {
  return OBJECT_NAMES.indexOf(name) !== -1 || ARRAY_REGEXP.test(name);
};

var test = function test(val) {
  return val && val.constructor && !!val.constructor.name && testName(val.constructor.name);
};

exports.test = test;

var isNamedNodeMap = function isNamedNodeMap(collection) {
  return collection.constructor.name === 'NamedNodeMap';
};

var serialize = function serialize(collection, config, indentation, depth, refs, printer) {
  var name = collection.constructor.name;

  if (++depth > config.maxDepth) {
    return '[' + name + ']';
  }

  return (config.min ? '' : name + SPACE) + (OBJECT_NAMES.indexOf(name) !== -1 ? '{' + (0, _collections.printObjectProperties)(isNamedNodeMap(collection) ? Array.from(collection).reduce(function (props, attribute) {
    props[attribute.name] = attribute.value;
    return props;
  }, {}) : _objectSpread({}, collection), config, indentation, depth, refs, printer) + '}' : '[' + (0, _collections.printListItems)(Array.from(collection), config, indentation, depth, refs, printer) + ']');
};

exports.serialize = serialize;
var plugin = {
  serialize: serialize,
  test: test
};
var _default = plugin;
exports.default = _default;

/***/ }),

/***/ "./packages/pretty-format/build/plugins/DOMElement.js":
/*!************************************************************!*\
  !*** ./packages/pretty-format/build/plugins/DOMElement.js ***!
  \************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.default = exports.serialize = exports.test = void 0;

var _markup = __webpack_require__(/*! ./lib/markup */ "./packages/pretty-format/build/plugins/lib/markup.js");
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */


var ELEMENT_NODE = 1;
var TEXT_NODE = 3;
var COMMENT_NODE = 8;
var FRAGMENT_NODE = 11;
var ELEMENT_REGEXP = /^((HTML|SVG)\w*)?Element$/;

var testNode = function testNode(nodeType, name) {
  return nodeType === ELEMENT_NODE && ELEMENT_REGEXP.test(name) || nodeType === TEXT_NODE && name === 'Text' || nodeType === COMMENT_NODE && name === 'Comment' || nodeType === FRAGMENT_NODE && name === 'DocumentFragment';
};

var test = function test(val) {
  return val && val.constructor && val.constructor.name && testNode(val.nodeType, val.constructor.name);
};

exports.test = test;

function nodeIsText(node) {
  return node.nodeType === TEXT_NODE;
}

function nodeIsComment(node) {
  return node.nodeType === COMMENT_NODE;
}

function nodeIsFragment(node) {
  return node.nodeType === FRAGMENT_NODE;
}

var serialize = function serialize(node, config, indentation, depth, refs, printer) {
  if (nodeIsText(node)) {
    return (0, _markup.printText)(node.data, config);
  }

  if (nodeIsComment(node)) {
    return (0, _markup.printComment)(node.data, config);
  }

  var type = nodeIsFragment(node) ? "DocumentFragment" : node.tagName.toLowerCase();

  if (++depth > config.maxDepth) {
    return (0, _markup.printElementAsLeaf)(type, config);
  }

  return (0, _markup.printElement)(type, (0, _markup.printProps)(nodeIsFragment(node) ? [] : Array.from(node.attributes).map(function (attr) {
    return attr.name;
  }).sort(), nodeIsFragment(node) ? {} : Array.from(node.attributes).reduce(function (props, attribute) {
    props[attribute.name] = attribute.value;
    return props;
  }, {}), config, indentation + config.indent, depth, refs, printer), (0, _markup.printChildren)(Array.prototype.slice.call(node.childNodes || node.children), config, indentation + config.indent, depth, refs, printer), config, indentation);
};

exports.serialize = serialize;
var plugin = {
  serialize: serialize,
  test: test
};
var _default = plugin;
exports.default = _default;

/***/ }),

/***/ "./packages/pretty-format/build/plugins/Immutable.js":
/*!***********************************************************!*\
  !*** ./packages/pretty-format/build/plugins/Immutable.js ***!
  \***********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.default = exports.test = exports.serialize = void 0;

var _collections = __webpack_require__(/*! ../collections */ "./packages/pretty-format/build/collections.js");
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// SENTINEL constants are from https://github.com/facebook/immutable-js


var IS_ITERABLE_SENTINEL = '@@__IMMUTABLE_ITERABLE__@@';
var IS_LIST_SENTINEL = '@@__IMMUTABLE_LIST__@@';
var IS_KEYED_SENTINEL = '@@__IMMUTABLE_KEYED__@@';
var IS_MAP_SENTINEL = '@@__IMMUTABLE_MAP__@@';
var IS_ORDERED_SENTINEL = '@@__IMMUTABLE_ORDERED__@@';
var IS_RECORD_SENTINEL = '@@__IMMUTABLE_RECORD__@@'; // immutable v4

var IS_SEQ_SENTINEL = '@@__IMMUTABLE_SEQ__@@';
var IS_SET_SENTINEL = '@@__IMMUTABLE_SET__@@';
var IS_STACK_SENTINEL = '@@__IMMUTABLE_STACK__@@';

var getImmutableName = function getImmutableName(name) {
  return 'Immutable.' + name;
};

var printAsLeaf = function printAsLeaf(name) {
  return '[' + name + ']';
};

var SPACE = ' ';
var LAZY = '…'; // Seq is lazy if it calls a method like filter

var printImmutableEntries = function printImmutableEntries(val, config, indentation, depth, refs, printer, type) {
  return ++depth > config.maxDepth ? printAsLeaf(getImmutableName(type)) : getImmutableName(type) + SPACE + '{' + (0, _collections.printIteratorEntries)(val.entries(), config, indentation, depth, refs, printer) + '}';
}; // Record has an entries method because it is a collection in immutable v3.
// Return an iterator for Immutable Record from version v3 or v4.


function getRecordEntries(val) {
  var i = 0;
  return {
    next: function next() {
      if (i < val._keys.length) {
        var key = val._keys[i++];
        return {
          done: false,
          value: [key, val.get(key)]
        };
      }

      return {
        done: true,
        value: undefined
      };
    }
  };
}

var printImmutableRecord = function printImmutableRecord(val, config, indentation, depth, refs, printer) {
  // _name property is defined only for an Immutable Record instance
  // which was constructed with a second optional descriptive name arg
  var name = getImmutableName(val._name || 'Record');
  return ++depth > config.maxDepth ? printAsLeaf(name) : name + SPACE + '{' + (0, _collections.printIteratorEntries)(getRecordEntries(val), config, indentation, depth, refs, printer) + '}';
};

var printImmutableSeq = function printImmutableSeq(val, config, indentation, depth, refs, printer) {
  var name = getImmutableName('Seq');

  if (++depth > config.maxDepth) {
    return printAsLeaf(name);
  }

  if (val[IS_KEYED_SENTINEL]) {
    return name + SPACE + '{' + ( // from Immutable collection of entries or from ECMAScript object
    val._iter || val._object ? (0, _collections.printIteratorEntries)(val.entries(), config, indentation, depth, refs, printer) : LAZY) + '}';
  }

  return name + SPACE + '[' + (val._iter || // from Immutable collection of values
  val._array || // from ECMAScript array
  val._collection || // from ECMAScript collection in immutable v4
  val._iterable // from ECMAScript collection in immutable v3
  ? (0, _collections.printIteratorValues)(val.values(), config, indentation, depth, refs, printer) : LAZY) + ']';
};

var printImmutableValues = function printImmutableValues(val, config, indentation, depth, refs, printer, type) {
  return ++depth > config.maxDepth ? printAsLeaf(getImmutableName(type)) : getImmutableName(type) + SPACE + '[' + (0, _collections.printIteratorValues)(val.values(), config, indentation, depth, refs, printer) + ']';
};

var serialize = function serialize(val, config, indentation, depth, refs, printer) {
  if (val[IS_MAP_SENTINEL]) {
    return printImmutableEntries(val, config, indentation, depth, refs, printer, val[IS_ORDERED_SENTINEL] ? 'OrderedMap' : 'Map');
  }

  if (val[IS_LIST_SENTINEL]) {
    return printImmutableValues(val, config, indentation, depth, refs, printer, 'List');
  }

  if (val[IS_SET_SENTINEL]) {
    return printImmutableValues(val, config, indentation, depth, refs, printer, val[IS_ORDERED_SENTINEL] ? 'OrderedSet' : 'Set');
  }

  if (val[IS_STACK_SENTINEL]) {
    return printImmutableValues(val, config, indentation, depth, refs, printer, 'Stack');
  }

  if (val[IS_SEQ_SENTINEL]) {
    return printImmutableSeq(val, config, indentation, depth, refs, printer);
  } // For compatibility with immutable v3 and v4, let record be the default.


  return printImmutableRecord(val, config, indentation, depth, refs, printer);
}; // Explicitly comparing sentinel properties to true avoids false positive
// when mock identity-obj-proxy returns the key as the value for any key.


exports.serialize = serialize;

var test = function test(val) {
  return val && (val[IS_ITERABLE_SENTINEL] === true || val[IS_RECORD_SENTINEL] === true);
};

exports.test = test;
var plugin = {
  serialize: serialize,
  test: test
};
var _default = plugin;
exports.default = _default;

/***/ }),

/***/ "./packages/pretty-format/build/plugins/ReactElement.js":
/*!**************************************************************!*\
  !*** ./packages/pretty-format/build/plugins/ReactElement.js ***!
  \**************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.default = exports.test = exports.serialize = void 0;

var ReactIs = _interopRequireWildcard(__webpack_require__(/*! react-is */ "./node_modules/react-is/index.js"));

var _markup = __webpack_require__(/*! ./lib/markup */ "./packages/pretty-format/build/plugins/lib/markup.js");

function _getRequireWildcardCache() {
  if (typeof WeakMap !== 'function') return null;
  var cache = new WeakMap();

  _getRequireWildcardCache = function _getRequireWildcardCache() {
    return cache;
  };

  return cache;
}

function _interopRequireWildcard(obj) {
  if (obj && obj.__esModule) {
    return obj;
  }

  if (obj === null || _typeof(obj) !== 'object' && typeof obj !== 'function') {
    return {
      default: obj
    };
  }

  var cache = _getRequireWildcardCache();

  if (cache && cache.has(obj)) {
    return cache.get(obj);
  }

  var newObj = {};
  var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;

  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;

      if (desc && (desc.get || desc.set)) {
        Object.defineProperty(newObj, key, desc);
      } else {
        newObj[key] = obj[key];
      }
    }
  }

  newObj.default = obj;

  if (cache) {
    cache.set(obj, newObj);
  }

  return newObj;
}
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// Given element.props.children, or subtree during recursive traversal,
// return flattened array of children.


var getChildren = function getChildren(arg) {
  var children = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

  if (Array.isArray(arg)) {
    arg.forEach(function (item) {
      getChildren(item, children);
    });
  } else if (arg != null && arg !== false) {
    children.push(arg);
  }

  return children;
};

var getType = function getType(element) {
  var type = element.type;

  if (typeof type === 'string') {
    return type;
  }

  if (typeof type === 'function') {
    return type.displayName || type.name || 'Unknown';
  }

  if (ReactIs.isFragment(element)) {
    return 'React.Fragment';
  }

  if (ReactIs.isSuspense(element)) {
    return 'React.Suspense';
  }

  if (_typeof(type) === 'object' && type !== null) {
    if (ReactIs.isContextProvider(element)) {
      return 'Context.Provider';
    }

    if (ReactIs.isContextConsumer(element)) {
      return 'Context.Consumer';
    }

    if (ReactIs.isForwardRef(element)) {
      if (type.displayName) {
        return type.displayName;
      }

      var functionName = type.render.displayName || type.render.name || '';
      return functionName !== '' ? 'ForwardRef(' + functionName + ')' : 'ForwardRef';
    }

    if (ReactIs.isMemo(element)) {
      var _functionName = type.displayName || type.type.displayName || type.type.name || '';

      return _functionName !== '' ? 'Memo(' + _functionName + ')' : 'Memo';
    }
  }

  return 'UNDEFINED';
};

var getPropKeys = function getPropKeys(element) {
  var props = element.props;
  return Object.keys(props).filter(function (key) {
    return key !== 'children' && props[key] !== undefined;
  }).sort();
};

var serialize = function serialize(element, config, indentation, depth, refs, printer) {
  return ++depth > config.maxDepth ? (0, _markup.printElementAsLeaf)(getType(element), config) : (0, _markup.printElement)(getType(element), (0, _markup.printProps)(getPropKeys(element), element.props, config, indentation + config.indent, depth, refs, printer), (0, _markup.printChildren)(getChildren(element.props.children), config, indentation + config.indent, depth, refs, printer), config, indentation);
};

exports.serialize = serialize;

var test = function test(val) {
  return val && ReactIs.isElement(val);
};

exports.test = test;
var plugin = {
  serialize: serialize,
  test: test
};
var _default = plugin;
exports.default = _default;

/***/ }),

/***/ "./packages/pretty-format/build/plugins/ReactTestComponent.js":
/*!********************************************************************!*\
  !*** ./packages/pretty-format/build/plugins/ReactTestComponent.js ***!
  \********************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(global) {

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.default = exports.test = exports.serialize = void 0;

var _markup = __webpack_require__(/*! ./lib/markup */ "./packages/pretty-format/build/plugins/lib/markup.js");

var _Symbol = global['jest-symbol-do-not-touch'] || global.Symbol;

var testSymbol = typeof _Symbol === 'function' && _Symbol.for ? _Symbol.for('react.test.json') : 0xea71357;

var getPropKeys = function getPropKeys(object) {
  var props = object.props;
  return props ? Object.keys(props).filter(function (key) {
    return props[key] !== undefined;
  }).sort() : [];
};

var serialize = function serialize(object, config, indentation, depth, refs, printer) {
  return ++depth > config.maxDepth ? (0, _markup.printElementAsLeaf)(object.type, config) : (0, _markup.printElement)(object.type, object.props ? (0, _markup.printProps)(getPropKeys(object), object.props, config, indentation + config.indent, depth, refs, printer) : '', object.children ? (0, _markup.printChildren)(object.children, config, indentation + config.indent, depth, refs, printer) : '', config, indentation);
};

exports.serialize = serialize;

var test = function test(val) {
  return val && val.$$typeof === testSymbol;
};

exports.test = test;
var plugin = {
  serialize: serialize,
  test: test
};
var _default = plugin;
exports.default = _default;
/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../../../../node_modules/webpack/buildin/global.js */ "./node_modules/webpack/buildin/global.js")))

/***/ }),

/***/ "./packages/pretty-format/build/plugins/lib/escapeHTML.js":
/*!****************************************************************!*\
  !*** ./packages/pretty-format/build/plugins/lib/escapeHTML.js ***!
  \****************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.default = escapeHTML;
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

function escapeHTML(str) {
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/***/ }),

/***/ "./packages/pretty-format/build/plugins/lib/markup.js":
/*!************************************************************!*\
  !*** ./packages/pretty-format/build/plugins/lib/markup.js ***!
  \************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.printElementAsLeaf = exports.printElement = exports.printComment = exports.printText = exports.printChildren = exports.printProps = void 0;

var _escapeHTML = _interopRequireDefault(__webpack_require__(/*! ./escapeHTML */ "./packages/pretty-format/build/plugins/lib/escapeHTML.js"));

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : {
    default: obj
  };
}
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// Return empty string if keys is empty.


var printProps = function printProps(keys, props, config, indentation, depth, refs, printer) {
  var indentationNext = indentation + config.indent;
  var colors = config.colors;
  return keys.map(function (key) {
    var value = props[key];
    var printed = printer(value, config, indentationNext, depth, refs);

    if (typeof value !== 'string') {
      if (printed.indexOf('\n') !== -1) {
        printed = config.spacingOuter + indentationNext + printed + config.spacingOuter + indentation;
      }

      printed = '{' + printed + '}';
    }

    return config.spacingInner + indentation + colors.prop.open + key + colors.prop.close + '=' + colors.value.open + printed + colors.value.close;
  }).join('');
}; // Return empty string if children is empty.


exports.printProps = printProps;

var printChildren = function printChildren(children, config, indentation, depth, refs, printer) {
  return children.map(function (child) {
    return config.spacingOuter + indentation + (typeof child === 'string' ? printText(child, config) : printer(child, config, indentation, depth, refs));
  }).join('');
};

exports.printChildren = printChildren;

var printText = function printText(text, config) {
  var contentColor = config.colors.content;
  return contentColor.open + (0, _escapeHTML.default)(text) + contentColor.close;
};

exports.printText = printText;

var printComment = function printComment(comment, config) {
  var commentColor = config.colors.comment;
  return commentColor.open + '<!--' + (0, _escapeHTML.default)(comment) + '-->' + commentColor.close;
}; // Separate the functions to format props, children, and element,
// so a plugin could override a particular function, if needed.
// Too bad, so sad: the traditional (but unnecessary) space
// in a self-closing tagColor requires a second test of printedProps.


exports.printComment = printComment;

var printElement = function printElement(type, printedProps, printedChildren, config, indentation) {
  var tagColor = config.colors.tag;
  return tagColor.open + '<' + type + (printedProps && tagColor.close + printedProps + config.spacingOuter + indentation + tagColor.open) + (printedChildren ? '>' + tagColor.close + printedChildren + config.spacingOuter + indentation + tagColor.open + '</' + type : (printedProps && !config.min ? '' : ' ') + '/') + '>' + tagColor.close;
};

exports.printElement = printElement;

var printElementAsLeaf = function printElementAsLeaf(type, config) {
  var tagColor = config.colors.tag;
  return tagColor.open + '<' + type + tagColor.close + ' …' + tagColor.open + ' />' + tagColor.close;
};

exports.printElementAsLeaf = printElementAsLeaf;

/***/ })

/******/ });
});
//# sourceMappingURL=index.js.map