"use strict";

var functionName = require("@sinonjs/commons").functionName;
var indexOf = require("@sinonjs/commons").prototypes.array.indexOf;
var map = require("@sinonjs/commons").prototypes.array.map;
var ARRAY_TYPES = require("./array-types");
var type = require("type-detect");

/**
 * Returns `true` when `object` is an array type, `false` otherwise
 *
 * @param  {*}  object - The object to examine
 * @returns {boolean} `true` when `object` is an array type
 * @private
 */
function isArrayType(object) {
    return indexOf(map(ARRAY_TYPES, functionName), type(object)) !== -1;
}

module.exports = isArrayType;
