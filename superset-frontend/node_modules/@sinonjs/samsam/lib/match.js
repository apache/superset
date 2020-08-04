"use strict";

var valueToString = require("@sinonjs/commons").valueToString;
var indexOf = require("@sinonjs/commons").prototypes.string.indexOf;
var forEach = require("@sinonjs/commons").prototypes.array.forEach;
var type = require("type-detect");

var engineCanCompareMaps = typeof Array.from === "function";
var deepEqual = require("./deep-equal").use(match); // eslint-disable-line no-use-before-define
var isArrayType = require("./is-array-type");
var isSubset = require("./is-subset");
var createMatcher = require("./create-matcher");

/**
 * Returns true when `array` contains all of `subset` as defined by the `compare`
 * argument
 *
 * @param  {Array} array   An array to search for a subset
 * @param  {Array} subset  The subset to find in the array
 * @param  {Function} compare A comparison function
 * @returns {boolean}         [description]
 * @private
 */
function arrayContains(array, subset, compare) {
    if (subset.length === 0) {
        return true;
    }
    var i, l, j, k;
    for (i = 0, l = array.length; i < l; ++i) {
        if (compare(array[i], subset[0])) {
            for (j = 0, k = subset.length; j < k; ++j) {
                if (i + j >= l) {
                    return false;
                }
                if (!compare(array[i + j], subset[j])) {
                    return false;
                }
            }
            return true;
        }
    }
    return false;
}

/* eslint-disable complexity */
/**
 * Matches an object with a matcher (or value)
 *
 * @alias module:samsam.match
 * @param {object} object The object candidate to match
 * @param {object} matcherOrValue A matcher or value to match against
 * @returns {boolean} true when `object` matches `matcherOrValue`
 */
function match(object, matcherOrValue) {
    if (matcherOrValue && typeof matcherOrValue.test === "function") {
        return matcherOrValue.test(object);
    }

    switch (type(matcherOrValue)) {
        case "bigint":
        case "boolean":
        case "number":
        case "symbol":
            return matcherOrValue === object;
        case "function":
            return matcherOrValue(object) === true;
        case "string":
            var notNull = typeof object === "string" || Boolean(object);
            return (
                notNull &&
                indexOf(
                    valueToString(object).toLowerCase(),
                    matcherOrValue.toLowerCase()
                ) >= 0
            );
        case "null":
            return object === null;
        case "undefined":
            return typeof object === "undefined";
        case "Date":
            /* istanbul ignore else */
            if (type(object) === "Date") {
                return object.getTime() === matcherOrValue.getTime();
            }
            /* istanbul ignore next: this is basically the rest of the function, which is covered */
            break;
        case "Array":
        case "Int8Array":
        case "Uint8Array":
        case "Uint8ClampedArray":
        case "Int16Array":
        case "Uint16Array":
        case "Int32Array":
        case "Uint32Array":
        case "Float32Array":
        case "Float64Array":
            return (
                isArrayType(matcherOrValue) &&
                arrayContains(object, matcherOrValue, match)
            );
        case "Map":
            /* istanbul ignore next: this is covered by a test, that is only run in IE, but we collect coverage information in node*/
            if (!engineCanCompareMaps) {
                throw new Error(
                    "The JavaScript engine does not support Array.from and cannot reliably do value comparison of Map instances"
                );
            }

            return (
                type(object) === "Map" &&
                arrayContains(
                    Array.from(object),
                    Array.from(matcherOrValue),
                    match
                )
            );
        default:
            break;
    }

    switch (type(object)) {
        case "null":
            return false;
        case "Set":
            return isSubset(matcherOrValue, object, match);
        default:
            break;
    }

    /* istanbul ignore else */
    if (matcherOrValue && typeof matcherOrValue === "object") {
        if (matcherOrValue === object) {
            return true;
        }
        if (typeof object !== "object") {
            return false;
        }
        var prop;
        // eslint-disable-next-line guard-for-in
        for (prop in matcherOrValue) {
            var value = object[prop];
            if (
                typeof value === "undefined" &&
                typeof object.getAttribute === "function"
            ) {
                value = object.getAttribute(prop);
            }
            if (
                matcherOrValue[prop] === null ||
                typeof matcherOrValue[prop] === "undefined"
            ) {
                if (value !== matcherOrValue[prop]) {
                    return false;
                }
            } else if (
                typeof value === "undefined" ||
                !deepEqual(value, matcherOrValue[prop])
            ) {
                return false;
            }
        }
        return true;
    }

    /* istanbul ignore next */
    throw new Error("Matcher was an unknown or unsupported type");
}
/* eslint-enable complexity */

forEach(Object.keys(createMatcher), function(key) {
    match[key] = createMatcher[key];
});

module.exports = match;
