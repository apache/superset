"use strict";

// This helper makes it convenient to create Set instances from a
// collection, an overcomes the shortcoming that IE11 doesn't support
// collection arguments
//
// See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set
function createSet(array) {
    if (arguments.length > 0 && !Array.isArray(array)) {
        throw new TypeError(
            "createSet can be called with either no arguments or an Array"
        );
    }

    var items = Array.isArray(array) ? array : [];
    var set = new Set();

    items.forEach(function(item) {
        set.add(item);
    });

    return set;
}

module.exports = createSet;
