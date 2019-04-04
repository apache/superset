"use strict";

var identical = require("./identical");
var isArguments = require("./is-arguments");
var isElement = require("./is-element");
var isNegZero = require("./is-neg-zero");
var match = require("./match");
var deepEqualCyclic = require("./deep-equal").use(match);
var createMatcher = require("./matcher");

module.exports = {
    createMatcher: createMatcher,
    deepEqual: deepEqualCyclic,
    isArguments: isArguments,
    isElement: isElement,
    isNegZero: isNegZero,
    identical: identical,
    match: match
};
