"use strict";

function isNaN(value) {
    // Unlike global isNaN, this avoids type coercion
    // typeof check avoids IE host object issues, hat tip to
    // lodash
    var val = value; // JsLint thinks value !== value is "weird"
    return typeof value === "number" && value !== val;
}

module.exports = isNaN;
