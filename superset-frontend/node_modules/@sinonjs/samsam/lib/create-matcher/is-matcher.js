"use strict";

var isPrototypeOf = require("@sinonjs/commons").prototypes.object.isPrototypeOf;

var matcherPrototype = require("./matcher-prototype");

/**
 * Returns `true` when `object` is a matcher
 *
 * @private
 * @param {*} object A value to examine
 * @returns {boolean} Returns `true` when `object` is a matcher
 */
function isMatcher(object) {
    return isPrototypeOf(matcherPrototype, object);
}

module.exports = isMatcher;
