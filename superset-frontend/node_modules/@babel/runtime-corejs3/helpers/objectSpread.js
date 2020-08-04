var _forEachInstanceProperty = require("../core-js/instance/for-each");

var _Object$getOwnPropertyDescriptor = require("../core-js/object/get-own-property-descriptor");

var _filterInstanceProperty = require("../core-js/instance/filter");

var _concatInstanceProperty = require("../core-js/instance/concat");

var _Object$getOwnPropertySymbols = require("../core-js/object/get-own-property-symbols");

var _Object$keys = require("../core-js/object/keys");

var defineProperty = require("./defineProperty");

function _objectSpread(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? Object(arguments[i]) : {};

    var ownKeys = _Object$keys(source);

    if (typeof _Object$getOwnPropertySymbols === 'function') {
      var _context;

      ownKeys = _concatInstanceProperty(ownKeys).call(ownKeys, _filterInstanceProperty(_context = _Object$getOwnPropertySymbols(source)).call(_context, function (sym) {
        return _Object$getOwnPropertyDescriptor(source, sym).enumerable;
      }));
    }

    _forEachInstanceProperty(ownKeys).call(ownKeys, function (key) {
      defineProperty(target, key, source[key]);
    });
  }

  return target;
}

module.exports = _objectSpread;