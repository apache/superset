"use strict";

var typeOf = require("@sinonjs/commons").typeOf;
var forEach = require("@sinonjs/commons").prototypes.array.forEach;

/**
 * This helper makes it convenient to create Set instances from a
 * collection, an overcomes the shortcoming that IE11 doesn't support
 * collection arguments
 *
 * @private
 * @param  {Array} array An array to create a set from
 * @returns {Set} A set (unique) containing the members from array
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set
 */
function createSet(array) {
    if (arguments.length > 0 && !Array.isArray(array)) {
        throw new TypeError(
            "createSet can be called with either no arguments or an Array"
        );
    }

    var items = typeOf(array) === "array" ? array : [];
    var set = new Set();

    forEach(items, function(item) {
        set.add(item);
    });

    return set;
}

module.exports = createSet;
