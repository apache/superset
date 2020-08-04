"use strict";
var valueToString = require("@sinonjs/commons").valueToString;

function throwOnFalsyObject(object, property) {
    if (property && !object) {
        var type = object === null ? "null" : "undefined";
        throw new Error("Trying to stub property '" + valueToString(property) + "' of " + type);
    }
}

module.exports = throwOnFalsyObject;
