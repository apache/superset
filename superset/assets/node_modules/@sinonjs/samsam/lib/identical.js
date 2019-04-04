"use strict";

var isNaN = require("./is-nan");
var isNegZero = require("./is-neg-zero");

/**
 * @name samsam.equal
 * @param Object obj1
 * @param Object obj2
 *
 * Returns ``true`` if two objects are strictly equal. Compared to
 * ``===`` there are two exceptions:
 *
 *   - NaN is considered equal to NaN
 *   - -0 and +0 are not considered equal
 */
function identical(obj1, obj2) {
    if (obj1 === obj2 || (isNaN(obj1) && isNaN(obj2))) {
        return obj1 !== 0 || isNegZero(obj1) === isNegZero(obj2);
    }

    return false;
}

module.exports = identical;
