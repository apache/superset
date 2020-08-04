'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports['default'] = createSlicer;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _getSubsetJs = require('./getSubset.js');

var _getSubsetJs2 = _interopRequireDefault(_getSubsetJs);

var _utilTypeOfJs = require('./util/typeOf.js');

var _utilTypeOfJs2 = _interopRequireDefault(_utilTypeOfJs);

/**
 * @description
 * createSlicer inspects the typeof paths and returns an appropriate slicer function.
 *
 * @param {String|String[]} [paths] The paths argument supplied to persistState.
 *
 * @return {Function} A slicer function, which returns the subset to store when called with Redux's store state.
 */

function createSlicer(paths) {
  switch ((0, _utilTypeOfJs2['default'])(paths)) {
    case 'void':
      return function (state) {
        return state;
      };
    case 'string':
      return function (state) {
        return (0, _getSubsetJs2['default'])(state, [paths]);
      };
    case 'array':
      return function (state) {
        return (0, _getSubsetJs2['default'])(state, paths);
      };
    default:
      return console.error('Invalid paths argument, should be of type String, Array or Void');
  }
}

module.exports = exports['default'];