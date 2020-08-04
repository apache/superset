"use strict";

/**
 * Returns `true` when `value` is an instance of Date
 *
 * @private
 * @param  {Date}  value The value to examine
 * @returns {boolean}     `true` when `value` is an instance of Date
 */
function isDate(value) {
    return value instanceof Date;
}

module.exports = isDate;
