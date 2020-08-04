"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.toArray = toArray;

function toArray(obj) {
    var ret = [];
    for (var attr in obj) {
        ret[attr] = obj;
    }

    return ret;
}
