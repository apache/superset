"use strict";

/**
 * @name samsam.isNegZero
 * @param Object value
 *
 * Returns ``true`` if ``value`` is ``-0``.
 */
function isNegZero(value) {
    return value === 0 && 1 / value === -Infinity;
}

module.exports = isNegZero;
