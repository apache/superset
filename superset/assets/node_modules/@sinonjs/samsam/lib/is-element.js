"use strict";

var div = typeof document !== "undefined" && document.createElement("div");

/**
 * @name samsam.isElement
 * @param Object object
 *
 * Returns ``true`` if ``object`` is a DOM element node. Unlike
 * Underscore.js/lodash, this function will return ``false`` if ``object``
 * is an *element-like* object, i.e. a regular object with a ``nodeType``
 * property that holds the value ``1``.
 */
function isElement(object) {
    if (!object || object.nodeType !== 1 || !div) {
        return false;
    }
    try {
        object.appendChild(div);
        object.removeChild(div);
    } catch (e) {
        return false;
    }
    return true;
}

module.exports = isElement;
