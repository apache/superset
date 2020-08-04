"use strict";

/**
 * @param {*} object
 * @param {String} property
 * @returns whether a prop exists in the prototype chain
 */
function isNonExistentProperty(object, property) {
    return object && typeof property !== "undefined" && !(property in object);
}

module.exports = isNonExistentProperty;
