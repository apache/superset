"use strict";

/**
 * Verify if an object is a ECMAScript Module
 *
 * As the exports from a module is immutable we cannot alter the exports
 * using spies or stubs. Let the consumer know this to avoid bug reports
 * on weird error messages.
 */
module.exports = function (object) {
    return (
        object &&
        typeof Symbol !== "undefined" &&
        object[Symbol.toStringTag] === "Module"
    );
};
