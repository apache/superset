"use strict";

var typeOf = require("@sinonjs/commons").typeOf;

/**
 * Returns `true` for iterables
 *
 * @private
 * @param {*} value A value to examine
 * @returns {boolean} Returns `true` when `value` looks like an iterable
 */
function isIterable(value) {
    return Boolean(value) && typeOf(value.forEach) === "function";
}

module.exports = isIterable;
