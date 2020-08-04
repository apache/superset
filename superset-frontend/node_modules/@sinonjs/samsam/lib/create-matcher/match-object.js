"use strict";

var every = require("@sinonjs/commons").prototypes.array.every;
var typeOf = require("@sinonjs/commons").typeOf;

var deepEqualFactory = require("../deep-equal").use;

var isMatcher = require("./is-matcher");
/**
 * Matches `actual` with `expectation`
 *
 * @private
 * @param {*} actual A value to examine
 * @param {object} expectation An object with properties to match on
 * @param {object} matcher A matcher to use for comparison
 * @returns {boolean} Returns true when `actual` matches all properties in `expectation`
 */
function matchObject(actual, expectation, matcher) {
    var deepEqual = deepEqualFactory(matcher);
    if (actual === null || actual === undefined) {
        return false;
    }

    return every(Object.keys(expectation), function(key) {
        var exp = expectation[key];
        var act = actual[key];

        if (isMatcher(exp)) {
            if (!exp.test(act)) {
                return false;
            }
        } else if (typeOf(exp) === "object") {
            if (!matchObject(act, exp, matcher)) {
                return false;
            }
        } else if (!deepEqual(act, exp)) {
            return false;
        }

        return true;
    });
}

module.exports = matchObject;
