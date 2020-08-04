"use strict";

/**
 * @module samsam
 */
var identical = require("./identical");
var isArguments = require("./is-arguments");
var isElement = require("./is-element");
var isNegZero = require("./is-neg-zero");
var isSet = require("./is-set");
var isMap = require("./is-map");
var match = require("./match");
var deepEqualCyclic = require("./deep-equal").use(match);
var createMatcher = require("./create-matcher");

module.exports = {
    createMatcher: createMatcher,
    deepEqual: deepEqualCyclic,
    identical: identical,
    isArguments: isArguments,
    isElement: isElement,
    isMap: isMap,
    isNegZero: isNegZero,
    isSet: isSet,
    match: match
};
