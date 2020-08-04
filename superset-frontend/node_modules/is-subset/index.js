'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
/**
 * Check if an object is contained within another object.
 *
 * Returns `true` if:
 * - all enumerable keys of *subset* are also enumerable in *superset*, and
 * - every value assigned to an enumerable key of *subset* strictly equals
 *   the value assigned to the same key of *superset* – or is a subset of it.
 *
 * @param  {Object}  superset
 * @param  {Object}  subset
 *
 * @returns  {Boolean}
 *
 * @module    is-subset
 * @function  default
 * @alias     isSubset
 */
var isSubset = (function (_isSubset) {
  function isSubset(_x, _x2) {
    return _isSubset.apply(this, arguments);
  }

  isSubset.toString = function () {
    return _isSubset.toString();
  };

  return isSubset;
})(function (superset, subset) {
  if (typeof superset !== 'object' || superset === null || (typeof subset !== 'object' || subset === null)) return false;

  return Object.keys(subset).every(function (key) {
    if (!superset.propertyIsEnumerable(key)) return false;

    var subsetItem = subset[key];
    var supersetItem = superset[key];
    if (typeof subsetItem === 'object' && subsetItem !== null ? !isSubset(supersetItem, subsetItem) : supersetItem !== subsetItem) return false;

    return true;
  });
});

exports['default'] = isSubset;
module.exports = exports['default'];