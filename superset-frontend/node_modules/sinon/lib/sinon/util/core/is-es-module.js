"use strict";

/**
 * Verify if an object is a ECMAScript Module
 *
 * As the exports from a module is immutable we cannot alter the exports
 * using spies or stubs. Let the consumer know this to avoid bug reports
 * on weird error messages.
 *
 * @param {Object} object The object to examine
 *
 * @returns {Boolean} true when the object is a module
 */
module.exports = function(object) {
    return (
        object && typeof Symbol !== "undefined" && object[Symbol.toStringTag] === "Module" && Object.isSealed(object)
    );
};
