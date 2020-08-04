"use strict";

/**
 * Compares a `value` to `NaN`
 *
 * @private
 * @param {*} value A value to examine
 * @returns {boolean} Returns `true` when `value` is `NaN`
 */
function isNaN(value) {
    // Unlike global `isNaN`, this function avoids type coercion
    // `typeof` check avoids IE host object issues, hat tip to
    // lodash

    // eslint-disable-next-line no-self-compare
    return typeof value === "number" && value !== value;
}

module.exports = isNaN;
