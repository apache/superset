"use strict";

/**
 * Returns `true` when `value` is a Map
 *
 * @param {*} value A value to examine
 * @returns {boolean} `true` when `value` is an instance of `Map`, `false` otherwise
 * @private
 */
function isMap(value) {
    return typeof Map !== "undefined" && value instanceof Map;
}

module.exports = isMap;
