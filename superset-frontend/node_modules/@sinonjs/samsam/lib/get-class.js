"use strict";

var toString = require("@sinonjs/commons").prototypes.object.toString;

/**
 * Returns the internal `Class` by calling `Object.prototype.toString`
 * with the provided value as `this`. Return value is a `String`, naming the
 * internal class, e.g. "Array"
 *
 * @private
 * @param  {*} value - Any value
 * @returns {string} - A string representation of the `Class` of `value`
 */
function getClass(value) {
    return toString(value).split(/[ \]]/)[1];
}

module.exports = getClass;
