"use strict";

var isRestorable = require("./is-restorable");
var walk = require("./walk");

module.exports = function restore(object) {
    if (object !== null && typeof object === "object") {
        walk(object, function(prop) {
            if (isRestorable(object[prop])) {
                object[prop].restore();
            }
        });
    } else if (isRestorable(object)) {
        object.restore();
    }
};
