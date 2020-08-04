"use strict";

var arrayProto = require("@sinonjs/commons").prototypes.array;
var createProxy = require("./proxy");
var nextTick = require("./util/core/next-tick");

var slice = arrayProto.slice;

function getError(value) {
    return value instanceof Error ? value : new Error(value);
}

var uuid = 0;
function wrapFunc(f) {
    var proxy;
    var fakeInstance = function() {
        var firstArg, lastArg;

        if (arguments.length > 0) {
            firstArg = arguments[0];
            lastArg = arguments[arguments.length - 1];
        }

        var callback = lastArg && typeof lastArg === "function" ? lastArg : undefined;

        proxy.firstArg = firstArg;
        proxy.lastArg = lastArg;
        proxy.callback = callback;

        return f && f.apply(this, arguments);
    };
    proxy = createProxy(fakeInstance, f || fakeInstance);

    proxy.displayName = "fake";
    proxy.id = "fake#" + uuid++;

    return proxy;
}

function fake(f) {
    if (arguments.length > 0 && typeof f !== "function") {
        throw new TypeError("Expected f argument to be a Function");
    }

    return wrapFunc(f);
}

fake.returns = function returns(value) {
    function f() {
        return value;
    }

    return wrapFunc(f);
};

fake.throws = function throws(value) {
    function f() {
        throw getError(value);
    }

    return wrapFunc(f);
};

fake.resolves = function resolves(value) {
    function f() {
        return Promise.resolve(value);
    }

    return wrapFunc(f);
};

fake.rejects = function rejects(value) {
    function f() {
        return Promise.reject(getError(value));
    }

    return wrapFunc(f);
};

function yieldInternal(async, values) {
    function f() {
        var callback = arguments[arguments.length - 1];
        if (typeof callback !== "function") {
            throw new TypeError("Expected last argument to be a function");
        }
        if (async) {
            nextTick(function() {
                callback.apply(null, values);
            });
        } else {
            callback.apply(null, values);
        }
    }

    return wrapFunc(f);
}

fake.yields = function yields() {
    return yieldInternal(false, slice(arguments));
};

fake.yieldsAsync = function yieldsAsync() {
    return yieldInternal(true, slice(arguments));
};

module.exports = fake;
