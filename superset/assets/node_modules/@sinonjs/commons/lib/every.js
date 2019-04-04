"use strict";

// This is an `every` implementation that works for all iterables
module.exports = function every(obj, fn) {
    var pass = true;

    try {
        /* eslint-disable-next-line local-rules/no-prototype-methods */
        obj.forEach(function() {
            if (!fn.apply(this, arguments)) {
                // Throwing an error is the only way to break `forEach`
                throw new Error();
            }
        });
    } catch (e) {
        pass = false;
    }

    return pass;
};
