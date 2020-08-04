"use strict";

var functionName = require("@sinonjs/commons").functionName;
var join = require("@sinonjs/commons").prototypes.array.join;
var map = require("@sinonjs/commons").prototypes.array.map;
var stringIndexOf = require("@sinonjs/commons").prototypes.string.indexOf;
var valueToString = require("@sinonjs/commons").valueToString;

var matchObject = require("./match-object");

var createTypeMap = function(match) {
    return {
        function: function(m, expectation, message) {
            m.test = expectation;
            m.message = message || "match(" + functionName(expectation) + ")";
        },
        number: function(m, expectation) {
            m.test = function(actual) {
                // we need type coercion here
                return expectation == actual; // eslint-disable-line eqeqeq
            };
        },
        object: function(m, expectation) {
            var array = [];

            if (typeof expectation.test === "function") {
                m.test = function(actual) {
                    return expectation.test(actual) === true;
                };
                m.message = "match(" + functionName(expectation.test) + ")";
                return m;
            }

            array = map(Object.keys(expectation), function(key) {
                return key + ": " + valueToString(expectation[key]);
            });

            m.test = function(actual) {
                return matchObject(actual, expectation, match);
            };
            m.message = "match(" + join(array, ", ") + ")";

            return m;
        },
        regexp: function(m, expectation) {
            m.test = function(actual) {
                return typeof actual === "string" && expectation.test(actual);
            };
        },
        string: function(m, expectation) {
            m.test = function(actual) {
                return (
                    typeof actual === "string" &&
                    stringIndexOf(actual, expectation) !== -1
                );
            };
            m.message = 'match("' + expectation + '")';
        }
    };
};

module.exports = createTypeMap;
