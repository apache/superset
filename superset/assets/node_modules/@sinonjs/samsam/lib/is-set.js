"use strict";

function isSet(val) {
    return (typeof Set !== "undefined" && val instanceof Set) || false;
}

module.exports = isSet;
