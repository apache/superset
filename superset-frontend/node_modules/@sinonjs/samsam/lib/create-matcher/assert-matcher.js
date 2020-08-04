"use strict";

var isMatcher = require("./is-matcher");

/**
 * Throws a TypeError when `value` is not a matcher
 *
 * @private
 * @param {*} value The value to examine
 */
function assertMatcher(value) {
    if (!isMatcher(value)) {
        throw new TypeError("Matcher expected");
    }
}

module.exports = assertMatcher;
