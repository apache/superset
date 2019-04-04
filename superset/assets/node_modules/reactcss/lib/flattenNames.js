'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.flattenNames = undefined;

var _isString2 = require('lodash/isString');

var _isString3 = _interopRequireDefault(_isString2);

var _forOwn2 = require('lodash/forOwn');

var _forOwn3 = _interopRequireDefault(_forOwn2);

var _isPlainObject2 = require('lodash/isPlainObject');

var _isPlainObject3 = _interopRequireDefault(_isPlainObject2);

var _map2 = require('lodash/map');

var _map3 = _interopRequireDefault(_map2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var flattenNames = exports.flattenNames = function flattenNames() {
  var things = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

  var names = [];

  (0, _map3.default)(things, function (thing) {
    if (Array.isArray(thing)) {
      flattenNames(thing).map(function (name) {
        return names.push(name);
      });
    } else if ((0, _isPlainObject3.default)(thing)) {
      (0, _forOwn3.default)(thing, function (value, key) {
        value === true && names.push(key);
        names.push(key + '-' + value);
      });
    } else if ((0, _isString3.default)(thing)) {
      names.push(thing);
    }
  });

  return names;
};

exports.default = flattenNames;