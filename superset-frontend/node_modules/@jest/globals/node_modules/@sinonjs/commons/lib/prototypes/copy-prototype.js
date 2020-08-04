"use strict";

var call = Function.call;

module.exports = function copyPrototypeMethods(prototype) {
    /* eslint-disable local-rules/no-prototype-methods */
    return Object.getOwnPropertyNames(prototype).reduce(function(result, name) {
        // ignore size because it throws from Map
        if (
            name !== "size" &&
            name !== "caller" &&
            name !== "callee" &&
            name !== "arguments" &&
            typeof prototype[name] === "function"
        ) {
            result[name] = call.bind(prototype[name]);
        }

        return result;
    }, Object.create(null));
};
