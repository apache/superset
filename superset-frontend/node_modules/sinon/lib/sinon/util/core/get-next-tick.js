"use strict";

/* istanbul ignore next : not testing that setTimeout works */
function nextTick(callback) {
    setTimeout(callback, 0);
}

module.exports = function getNextTick(process, setImmediate) {
    if (typeof process === "object" && typeof process.nextTick === "function") {
        return process.nextTick;
    }

    if (typeof setImmediate === "function") {
        return setImmediate;
    }

    return nextTick;
};
