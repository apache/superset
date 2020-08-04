"use strict";

/**
 * Returns `true` when the argument is an instance of Set, `false` otherwise
 *
 * @alias module:samsam.isSet
 * @param  {*}  val - A value to examine
 * @returns {boolean} Returns `true` when the argument is an instance of Set, `false` otherwise
 */
function isSet(val) {
    return (typeof Set !== "undefined" && val instanceof Set) || false;
}

module.exports = isSet;
