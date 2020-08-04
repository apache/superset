"use strict";

/**
 * Returns `true` when the value is a regular Object and not a specialized Object
 *
 * This helps speed up deepEqual cyclic checks
 *
 * The premise is that only Objects are stored in the visited array.
 * So if this function returns false, we don't have to do the
 * expensive operation of searching for the value in the the array of already
 * visited objects
 *
 * @private
 * @param  {object}   value The object to examine
 * @returns {boolean}       `true` when the object is a non-specialised object
 */
function isObject(value) {
    return (
        typeof value === "object" &&
        value !== null &&
        // none of these are collection objects, so we can return false
        !(value instanceof Boolean) &&
        !(value instanceof Date) &&
        !(value instanceof Error) &&
        !(value instanceof Number) &&
        !(value instanceof RegExp) &&
        !(value instanceof String)
    );
}

module.exports = isObject;
