"use strict";

/**
 * Throws a TypeError when expected method doesn't exist
 *
 * @private
 * @param {*} value A value to examine
 * @param {string} method The name of the method to look for
 * @param {name} name A name to use for the error message
 * @param {string} methodPath The name of the method to use for error messages
 * @throws {TypeError} When the method doesn't exist
 */
function assertMethodExists(value, method, name, methodPath) {
    if (value[method] === null || value[method] === undefined) {
        throw new TypeError(
            "Expected " + name + " to have method " + methodPath
        );
    }
}

module.exports = assertMethodExists;
