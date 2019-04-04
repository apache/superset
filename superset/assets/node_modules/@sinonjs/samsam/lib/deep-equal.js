"use strict";

var getClass = require("./get-class");
var identical = require("./identical");
var isArguments = require("./is-arguments");
var isDate = require("./is-date");
var isElement = require("./is-element");
var isNaN = require("./is-nan");
var isObject = require("./is-object");
var isSet = require("./is-set");
var isSubset = require("./is-subset");
var getClassName = require("./get-class-name");

var every = Array.prototype.every;
var getTime = Date.prototype.getTime;
var hasOwnProperty = Object.prototype.hasOwnProperty;
var indexOf = Array.prototype.indexOf;
var keys = Object.keys;

/**
 * @name samsam.deepEqual
 * @param Object first
 * @param Object second
 *
 * Deep equal comparison. Two values are "deep equal" if:
 *
 *   - They are equal, according to samsam.identical
 *   - They are both date objects representing the same time
 *   - They are both arrays containing elements that are all deepEqual
 *   - They are objects with the same set of properties, and each property
 *     in ``first`` is deepEqual to the corresponding property in ``second``
 *
 * Supports cyclic objects.
 */
function deepEqualCyclic(first, second, match) {
    // used for cyclic comparison
    // contain already visited objects
    var objects1 = [];
    var objects2 = [];
    // contain pathes (position in the object structure)
    // of the already visited objects
    // indexes same as in objects arrays
    var paths1 = [];
    var paths2 = [];
    // contains combinations of already compared objects
    // in the manner: { "$1['ref']$2['ref']": true }
    var compared = {};

    // does the recursion for the deep equal check
    return (function deepEqual(obj1, obj2, path1, path2) {
        // If both are matchers they must be the same instance in order to be
        // considered equal If we didn't do that we would end up running one
        // matcher against the other
        if (match && match.isMatcher(obj2)) {
            if (match.isMatcher(obj1)) {
                return obj1 === obj2;
            }
            return obj2.test(obj1);
        }

        var type1 = typeof obj1;
        var type2 = typeof obj2;

        // == null also matches undefined
        if (
            obj1 === obj2 ||
            isNaN(obj1) ||
            isNaN(obj2) ||
            obj1 == null ||
            obj2 == null ||
            type1 !== "object" ||
            type2 !== "object"
        ) {
            return identical(obj1, obj2);
        }

        // Elements are only equal if identical(expected, actual)
        if (isElement(obj1) || isElement(obj2)) {
            return false;
        }

        var isDate1 = isDate(obj1);
        var isDate2 = isDate(obj2);
        if (isDate1 || isDate2) {
            if (
                !isDate1 ||
                !isDate2 ||
                getTime.call(obj1) !== getTime.call(obj2)
            ) {
                return false;
            }
        }

        if (obj1 instanceof RegExp && obj2 instanceof RegExp) {
            if (obj1.toString() !== obj2.toString()) {
                return false;
            }
        }

        if (obj1 instanceof Error && obj2 instanceof Error) {
            return obj1 === obj2;
        }

        var class1 = getClass(obj1);
        var class2 = getClass(obj2);
        var keys1 = keys(obj1);
        var keys2 = keys(obj2);
        var name1 = getClassName(obj1);
        var name2 = getClassName(obj2);

        if (isArguments(obj1) || isArguments(obj2)) {
            if (obj1.length !== obj2.length) {
                return false;
            }
        } else {
            if (
                type1 !== type2 ||
                class1 !== class2 ||
                keys1.length !== keys2.length ||
                (name1 && name2 && name1 !== name2)
            ) {
                return false;
            }
        }

        if (isSet(obj1) || isSet(obj2)) {
            if (!isSet(obj1) || !isSet(obj2) || obj1.size !== obj2.size) {
                return false;
            }

            return isSubset(obj1, obj2, deepEqual);
        }

        return every.call(keys1, function(key) {
            if (!hasOwnProperty.call(obj2, key)) {
                return false;
            }

            var value1 = obj1[key];
            var value2 = obj2[key];
            var isObject1 = isObject(value1);
            var isObject2 = isObject(value2);
            // determines, if the objects were already visited
            // (it's faster to check for isObject first, than to
            // get -1 from getIndex for non objects)
            var index1 = isObject1 ? indexOf.call(objects1, value1) : -1;
            var index2 = isObject2 ? indexOf.call(objects2, value2) : -1;
            // determines the new paths of the objects
            // - for non cyclic objects the current path will be extended
            //   by current property name
            // - for cyclic objects the stored path is taken
            var newPath1 =
                index1 !== -1
                    ? paths1[index1]
                    : path1 + "[" + JSON.stringify(key) + "]";
            var newPath2 =
                index2 !== -1
                    ? paths2[index2]
                    : path2 + "[" + JSON.stringify(key) + "]";
            var combinedPath = newPath1 + newPath2;

            // stop recursion if current objects are already compared
            if (compared[combinedPath]) {
                return true;
            }

            // remember the current objects and their paths
            if (index1 === -1 && isObject1) {
                objects1.push(value1);
                paths1.push(newPath1);
            }
            if (index2 === -1 && isObject2) {
                objects2.push(value2);
                paths2.push(newPath2);
            }

            // remember that the current objects are already compared
            if (isObject1 && isObject2) {
                compared[combinedPath] = true;
            }

            // End of cyclic logic

            // neither value1 nor value2 is a cycle
            // continue with next level
            return deepEqual(value1, value2, newPath1, newPath2);
        });
    })(first, second, "$1", "$2");
}

deepEqualCyclic.use = function(match) {
    return function(a, b) {
        return deepEqualCyclic(a, b, match);
    };
};

module.exports = deepEqualCyclic;
