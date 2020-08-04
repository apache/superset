"use strict";

var functionName = require("@sinonjs/commons").functionName;

var getPropertyDescriptor = require("./get-property-descriptor");
var walk = require("./walk");

function walkObject(predicate, object, filter) {
    var called = false;
    var name = functionName(predicate);

    if (!object) {
        throw new Error("Trying to " + name + " object but received " + String(object));
    }

    walk(object, function(prop, propOwner) {
        // we don't want to stub things like toString(), valueOf(), etc. so we only stub if the object
        // is not Object.prototype
        if (
            propOwner !== Object.prototype &&
            prop !== "constructor" &&
            typeof getPropertyDescriptor(propOwner, prop).value === "function"
        ) {
            if (filter) {
                if (filter(object, prop)) {
                    called = true;
                    predicate(object, prop);
                }
            } else {
                called = true;
                predicate(object, prop);
            }
        }
    });

    if (!called) {
        throw new Error("Expected to " + name + " methods on object but found none");
    }

    return object;
}

module.exports = walkObject;
