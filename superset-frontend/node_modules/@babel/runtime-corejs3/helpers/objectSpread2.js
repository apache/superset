var _Object$defineProperty = require("../core-js/object/define-property");

var _Object$defineProperties = require("../core-js/object/define-properties");

var _Object$getOwnPropertyDescriptors = require("../core-js/object/get-own-property-descriptors");

var _forEachInstanceProperty = require("../core-js/instance/for-each");

var _Object$getOwnPropertyDescriptor = require("../core-js/object/get-own-property-descriptor");

var _filterInstanceProperty = require("../core-js/instance/filter");

var _Object$getOwnPropertySymbols = require("../core-js/object/get-own-property-symbols");

var _Object$keys = require("../core-js/object/keys");

var defineProperty = require("./defineProperty");

function ownKeys(object, enumerableOnly) {
  var keys = _Object$keys(object);

  if (_Object$getOwnPropertySymbols) {
    var symbols = _Object$getOwnPropertySymbols(object);

    if (enumerableOnly) symbols = _filterInstanceProperty(symbols).call(symbols, function (sym) {
      return _Object$getOwnPropertyDescriptor(object, sym).enumerable;
    });
    keys.push.apply(keys, symbols);
  }

  return keys;
}

function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};

    if (i % 2) {
      var _context;

      _forEachInstanceProperty(_context = ownKeys(Object(source), true)).call(_context, function (key) {
        defineProperty(target, key, source[key]);
      });
    } else if (_Object$getOwnPropertyDescriptors) {
      _Object$defineProperties(target, _Object$getOwnPropertyDescriptors(source));
    } else {
      var _context2;

      _forEachInstanceProperty(_context2 = ownKeys(Object(source))).call(_context2, function (key) {
        _Object$defineProperty(target, key, _Object$getOwnPropertyDescriptor(source, key));
      });
    }
  }

  return target;
}

module.exports = _objectSpread2;