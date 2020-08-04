"use strict";

var slice = require("@sinonjs/commons").prototypes.string.slice;
var typeOf = require("@sinonjs/commons").typeOf;
var valueToString = require("@sinonjs/commons").valueToString;

/**
 * Creates a string represenation of an iterable object
 *
 * @private
 * @param   {object} obj The iterable object to stringify
 * @returns {string}     A string representation
 */
function iterableToString(obj) {
    if (typeOf(obj) === "map") {
        return mapToString(obj);
    }

    return genericIterableToString(obj);
}

/**
 * Creates a string representation of a Map
 *
 * @private
 * @param   {Map} map    The map to stringify
 * @returns {string}     A string representation
 */
function mapToString(map) {
    var representation = "";

    /* eslint-disable-next-line local-rules/no-prototype-methods */
    map.forEach(function(value, key) {
        representation += "[" + stringify(key) + "," + stringify(value) + "],";
    });

    representation = slice(representation, 0, -1);
    return representation;
}

/**
 * Create a string represenation for an iterable
 *
 * @private
 * @param   {object} iterable The iterable to stringify
 * @returns {string}          A string representation
 */
function genericIterableToString(iterable) {
    var representation = "";

    /* eslint-disable-next-line local-rules/no-prototype-methods */
    iterable.forEach(function(value) {
        representation += stringify(value) + ",";
    });

    representation = slice(representation, 0, -1);
    return representation;
}

/**
 * Creates a string representation of the passed `item`
 *
 * @private
 * @param  {object} item The item to stringify
 * @returns {string}      A string representation of `item`
 */
function stringify(item) {
    return typeof item === "string" ? "'" + item + "'" : valueToString(item);
}

module.exports = iterableToString;
