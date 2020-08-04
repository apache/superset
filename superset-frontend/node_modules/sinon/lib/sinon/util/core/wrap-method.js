"use strict";

var getPropertyDescriptor = require("./get-property-descriptor");
var extend = require("./extend");
var hasOwnProperty = require("@sinonjs/commons").prototypes.object.hasOwnProperty;
var valueToString = require("@sinonjs/commons").valueToString;

function isFunction(obj) {
    return typeof obj === "function" || Boolean(obj && obj.constructor && obj.call && obj.apply);
}

function mirrorProperties(target, source) {
    for (var prop in source) {
        if (!hasOwnProperty(target, prop)) {
            target[prop] = source[prop];
        }
    }
}

// Cheap way to detect if we have ES5 support.
var hasES5Support = "keys" in Object;

module.exports = function wrapMethod(object, property, method) {
    if (!object) {
        throw new TypeError("Should wrap property of object");
    }

    if (typeof method !== "function" && typeof method !== "object") {
        throw new TypeError("Method wrapper should be a function or a property descriptor");
    }

    function checkWrappedMethod(wrappedMethod) {
        var error;

        if (!isFunction(wrappedMethod)) {
            error = new TypeError(
                "Attempted to wrap " + typeof wrappedMethod + " property " + valueToString(property) + " as function"
            );
        } else if (wrappedMethod.restore && wrappedMethod.restore.sinon) {
            error = new TypeError("Attempted to wrap " + valueToString(property) + " which is already wrapped");
        } else if (wrappedMethod.calledBefore) {
            var verb = wrappedMethod.returns ? "stubbed" : "spied on";
            error = new TypeError("Attempted to wrap " + valueToString(property) + " which is already " + verb);
        }

        if (error) {
            if (wrappedMethod && wrappedMethod.stackTraceError) {
                error.stack += "\n--------------\n" + wrappedMethod.stackTraceError.stack;
            }
            throw error;
        }
    }

    var error, wrappedMethod, i, wrappedMethodDesc;

    function simplePropertyAssignment() {
        wrappedMethod = object[property];
        checkWrappedMethod(wrappedMethod);
        object[property] = method;
        method.displayName = property;
    }

    // Firefox has a problem when using hasOwn.call on objects from other frames.
    /* eslint-disable-next-line local-rules/no-prototype-methods */
    var owned = object.hasOwnProperty ? object.hasOwnProperty(property) : hasOwnProperty(object, property);

    if (hasES5Support) {
        var methodDesc = typeof method === "function" ? { value: method } : method;
        wrappedMethodDesc = getPropertyDescriptor(object, property);

        if (!wrappedMethodDesc) {
            error = new TypeError(
                "Attempted to wrap " + typeof wrappedMethod + " property " + property + " as function"
            );
        } else if (wrappedMethodDesc.restore && wrappedMethodDesc.restore.sinon) {
            error = new TypeError("Attempted to wrap " + property + " which is already wrapped");
        }
        if (error) {
            if (wrappedMethodDesc && wrappedMethodDesc.stackTraceError) {
                error.stack += "\n--------------\n" + wrappedMethodDesc.stackTraceError.stack;
            }
            throw error;
        }

        var types = Object.keys(methodDesc);
        for (i = 0; i < types.length; i++) {
            wrappedMethod = wrappedMethodDesc[types[i]];
            checkWrappedMethod(wrappedMethod);
        }

        mirrorProperties(methodDesc, wrappedMethodDesc);
        for (i = 0; i < types.length; i++) {
            mirrorProperties(methodDesc[types[i]], wrappedMethodDesc[types[i]]);
        }
        Object.defineProperty(object, property, methodDesc);

        // catch failing assignment
        // this is the converse of the check in `.restore` below
        if (typeof method === "function" && object[property] !== method) {
            // correct any wrongdoings caused by the defineProperty call above,
            // such as adding new items (if object was a Storage object)
            delete object[property];
            simplePropertyAssignment();
        }
    } else {
        simplePropertyAssignment();
    }

    extend.nonEnum(method, {
        displayName: property,

        wrappedMethod: wrappedMethod,

        // Set up an Error object for a stack trace which can be used later to find what line of
        // code the original method was created on.
        stackTraceError: new Error("Stack Trace for original"),

        restore: function() {
            // For prototype properties try to reset by delete first.
            // If this fails (ex: localStorage on mobile safari) then force a reset
            // via direct assignment.
            if (!owned) {
                // In some cases `delete` may throw an error
                try {
                    delete object[property];
                } catch (e) {} // eslint-disable-line no-empty
                // For native code functions `delete` fails without throwing an error
                // on Chrome < 43, PhantomJS, etc.
            } else if (hasES5Support) {
                Object.defineProperty(object, property, wrappedMethodDesc);
            }

            if (hasES5Support) {
                var descriptor = getPropertyDescriptor(object, property);
                if (descriptor && descriptor.value === method) {
                    object[property] = wrappedMethod;
                }
            } else {
                // Use strict equality comparison to check failures then force a reset
                // via direct assignment.
                if (object[property] === method) {
                    object[property] = wrappedMethod;
                }
            }
        }
    });

    method.restore.sinon = true;

    if (!hasES5Support) {
        mirrorProperties(method, wrappedMethod);
    }

    return method;
};
