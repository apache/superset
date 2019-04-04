"use strict";

var getClass = require("./get-class");

/**
 * @name samsam.isArguments
 * @param Object object
 *
 * Returns ``true`` if ``object`` is an ``arguments`` object,
 * ``false`` otherwise.
 */
function isArguments(object) {
    if (getClass(object) === "Arguments") {
        return true;
    }
    if (
        typeof object !== "object" ||
        typeof object.length !== "number" ||
        getClass(object) === "Array"
    ) {
        return false;
    }
    if (typeof object.callee === "function") {
        return true;
    }
    try {
        object[object.length] = 6;
        delete object[object.length];
    } catch (e) {
        return true;
    }
    return false;
}

module.exports = isArguments;
