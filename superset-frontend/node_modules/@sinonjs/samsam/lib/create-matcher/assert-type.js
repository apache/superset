"use strict";

var typeOf = require("@sinonjs/commons").typeOf;

/**
 * Ensures that value is of type
 *
 * @private
 * @param {*} value A value to examine
 * @param {string} type A basic JavaScript type to compare to, e.g. "object", "string"
 * @param {string} name A string to use for the error message
 * @throws {TypeError} If value is not of the expected type
 * @returns {undefined}
 */
function assertType(value, type, name) {
    var actual = typeOf(value);
    if (actual !== type) {
        throw new TypeError(
            "Expected type of " +
                name +
                " to be " +
                type +
                ", but was " +
                actual
        );
    }
}

module.exports = assertType;
