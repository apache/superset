(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.valueEqual = factory());
}(this, (function () { 'use strict';

  function valueOf(obj) {
    return obj.valueOf ? obj.valueOf() : Object.prototype.valueOf.call(obj);
  }

  function valueEqual(a, b) {
    // Test for strict equality first.
    if (a === b) return true;

    // Otherwise, if either of them == null they are not equal.
    if (a == null || b == null) return false;

    if (Array.isArray(a)) {
      return (
        Array.isArray(b) &&
        a.length === b.length &&
        a.every(function(item, index) {
          return valueEqual(item, b[index]);
        })
      );
    }

    if (typeof a === 'object' || typeof b === 'object') {
      var aValue = valueOf(a);
      var bValue = valueOf(b);

      if (aValue !== a || bValue !== b) return valueEqual(aValue, bValue);

      return Object.keys(Object.assign({}, a, b)).every(function(key) {
        return valueEqual(a[key], b[key]);
      });
    }

    return false;
  }

  return valueEqual;

})));
