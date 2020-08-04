"use strict";

var forEach = Array.prototype.forEach;

function usePromiseLibrary(library, fakes) {
    if (typeof library === "undefined") {
        return;
    }

    if (Array.isArray(fakes)) {
        forEach.call(fakes, usePromiseLibrary.bind(null, library));

        return;
    }

    if (typeof fakes.usingPromise === "function") {
        fakes.usingPromise(library);
    }
}

module.exports = usePromiseLibrary;
