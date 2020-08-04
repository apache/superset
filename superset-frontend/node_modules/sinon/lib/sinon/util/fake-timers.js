"use strict";

var extend = require("./core/extend");
var FakeTimers = require("@sinonjs/fake-timers");
var globalObject = require("@sinonjs/commons").global;

function createClock(config, globalCtx) {
    var FakeTimersCtx = FakeTimers;
    if (globalCtx !== null && typeof globalCtx === "object") {
        FakeTimersCtx = FakeTimers.withGlobal(globalCtx);
    }
    var clock = FakeTimersCtx.install(config);
    clock.restore = clock.uninstall;
    return clock;
}

function addIfDefined(obj, globalPropName) {
    var globalProp = globalObject[globalPropName];
    if (typeof globalProp !== "undefined") {
        obj[globalPropName] = globalProp;
    }
}

/**
 * @param {number|Date|Object} dateOrConfig The unix epoch value to install with (default 0)
 * @returns {Object} Returns a lolex clock instance
 */
exports.useFakeTimers = function(dateOrConfig) {
    var hasArguments = typeof dateOrConfig !== "undefined";
    var argumentIsDateLike =
        (typeof dateOrConfig === "number" || dateOrConfig instanceof Date) && arguments.length === 1;
    var argumentIsObject = dateOrConfig !== null && typeof dateOrConfig === "object" && arguments.length === 1;

    if (!hasArguments) {
        return createClock({
            now: 0
        });
    }

    if (argumentIsDateLike) {
        return createClock({
            now: dateOrConfig
        });
    }

    if (argumentIsObject) {
        var config = extend.nonEnum({}, dateOrConfig);
        var globalCtx = config.global;
        delete config.global;
        return createClock(config, globalCtx);
    }

    throw new TypeError("useFakeTimers expected epoch or config object. See https://github.com/sinonjs/sinon");
};

exports.clock = {
    create: function(now) {
        return FakeTimers.createClock(now);
    }
};

var timers = {
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    Date: Date
};
addIfDefined(timers, "setImmediate");
addIfDefined(timers, "clearImmediate");

exports.timers = timers;
