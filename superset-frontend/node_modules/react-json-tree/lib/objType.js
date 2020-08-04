'use strict';

exports.__esModule = true;

var _iterator = require('babel-runtime/core-js/symbol/iterator');

var _iterator2 = _interopRequireDefault(_iterator);

exports['default'] = objType;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function objType(obj) {
  var type = Object.prototype.toString.call(obj).slice(8, -1);
  if (type === 'Object' && typeof obj[_iterator2['default']] === 'function') {
    return 'Iterable';
  }

  if (type === 'Custom' && obj.constructor !== Object && obj instanceof Object) {
    // For projects implementing objects overriding `.prototype[Symbol.toStringTag]`
    return 'Object';
  }

  return type;
}