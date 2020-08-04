"use strict";

var walkObject = require("./util/core/walk-object");

function filter(object, property) {
    return object[property].restore && object[property].restore.sinon;
}

function restore(object, property) {
    object[property].restore();
}

function restoreObject(object) {
    return walkObject(restore, object, filter);
}

module.exports = restoreObject;
