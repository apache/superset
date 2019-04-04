"use strict";

var slice = require("@sinonjs/commons").prototypes.string.slice;
var typeOf = require("@sinonjs/commons").typeOf;

module.exports = function iterableToString(obj) {
    var representation = "";

    function stringify(item) {
        return typeof item === "string" ? "'" + item + "'" : String(item);
    }

    function mapToString(map) {
        /* eslint-disable-next-line local-rules/no-prototype-methods */
        map.forEach(function(value, key) {
            representation +=
                "[" + stringify(key) + "," + stringify(value) + "],";
        });

        representation = slice(representation, 0, -1);
        return representation;
    }

    function genericIterableToString(iterable) {
        /* eslint-disable-next-line local-rules/no-prototype-methods */
        iterable.forEach(function(value) {
            representation += stringify(value) + ",";
        });

        representation = slice(representation, 0, -1);
        return representation;
    }

    if (typeOf(obj) === "map") {
        return mapToString(obj);
    }

    return genericIterableToString(obj);
};
