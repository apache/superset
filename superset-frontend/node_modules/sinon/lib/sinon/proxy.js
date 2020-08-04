"use strict";

var arrayProto = require("@sinonjs/commons").prototypes.array;
var extend = require("./util/core/extend");
var functionToString = require("./util/core/function-to-string");
var proxyCall = require("./proxy-call");
var proxyCallUtil = require("./proxy-call-util");
var proxyInvoke = require("./proxy-invoke");
var sinonFormat = require("./util/core/format");

var push = arrayProto.push;
var forEach = arrayProto.forEach;
var slice = arrayProto.slice;

var emptyFakes = Object.freeze([]);

// Public API
var proxyApi = {
    toString: functionToString,

    named: function named(name) {
        this.displayName = name;
        var nameDescriptor = Object.getOwnPropertyDescriptor(this, "name");
        if (nameDescriptor && nameDescriptor.configurable) {
            // IE 11 functions don't have a name.
            // Safari 9 has names that are not configurable.
            nameDescriptor.value = name;
            Object.defineProperty(this, "name", nameDescriptor);
        }
        return this;
    },

    invoke: proxyInvoke,

    /*
     * Hook for derived implementation to return fake instances matching the
     * given arguments.
     */
    matchingFakes: function(/*args, strict*/) {
        return emptyFakes;
    },

    getCall: function getCall(index) {
        var i = index;
        if (i < 0) {
            // Negative indices means counting backwards from the last call
            i += this.callCount;
        }
        if (i < 0 || i >= this.callCount) {
            return null;
        }

        return proxyCall(
            this,
            this.thisValues[i],
            this.args[i],
            this.returnValues[i],
            this.exceptions[i],
            this.callIds[i],
            this.errorsWithCallStack[i]
        );
    },

    getCalls: function() {
        var calls = [];
        var i;

        for (i = 0; i < this.callCount; i++) {
            push(calls, this.getCall(i));
        }

        return calls;
    },

    calledBefore: function calledBefore(proxy) {
        if (!this.called) {
            return false;
        }

        if (!proxy.called) {
            return true;
        }

        return this.callIds[0] < proxy.callIds[proxy.callIds.length - 1];
    },

    calledAfter: function calledAfter(proxy) {
        if (!this.called || !proxy.called) {
            return false;
        }

        return this.callIds[this.callCount - 1] > proxy.callIds[0];
    },

    calledImmediatelyBefore: function calledImmediatelyBefore(proxy) {
        if (!this.called || !proxy.called) {
            return false;
        }

        return this.callIds[this.callCount - 1] === proxy.callIds[proxy.callCount - 1] - 1;
    },

    calledImmediatelyAfter: function calledImmediatelyAfter(proxy) {
        if (!this.called || !proxy.called) {
            return false;
        }

        return this.callIds[this.callCount - 1] === proxy.callIds[proxy.callCount - 1] + 1;
    },

    formatters: require("./spy-formatters"),
    printf: function(format) {
        var spyInstance = this;
        var args = slice(arguments, 1);
        var formatter;

        return (format || "").replace(/%(.)/g, function(match, specifyer) {
            formatter = proxyApi.formatters[specifyer];

            if (typeof formatter === "function") {
                return String(formatter(spyInstance, args));
            } else if (!isNaN(parseInt(specifyer, 10))) {
                return sinonFormat(args[specifyer - 1]);
            }

            return "%" + specifyer;
        });
    },

    resetHistory: function() {
        if (this.invoking) {
            var err = new Error(
                "Cannot reset Sinon function while invoking it. " +
                    "Move the call to .resetHistory outside of the callback."
            );
            err.name = "InvalidResetException";
            throw err;
        }

        this.called = false;
        this.notCalled = true;
        this.calledOnce = false;
        this.calledTwice = false;
        this.calledThrice = false;
        this.callCount = 0;
        this.firstCall = null;
        this.secondCall = null;
        this.thirdCall = null;
        this.lastCall = null;
        this.args = [];
        this.firstArg = null;
        this.lastArg = null;
        this.returnValues = [];
        this.thisValues = [];
        this.exceptions = [];
        this.callIds = [];
        this.errorsWithCallStack = [];

        if (this.fakes) {
            forEach(this.fakes, function(fake) {
                fake.resetHistory();
            });
        }

        return this;
    }
};

var delegateToCalls = proxyCallUtil.delegateToCalls;
delegateToCalls(proxyApi, "calledOn", true);
delegateToCalls(proxyApi, "alwaysCalledOn", false, "calledOn");
delegateToCalls(proxyApi, "calledWith", true);
delegateToCalls(proxyApi, "calledOnceWith", true, "calledWith", false, undefined, 1);
delegateToCalls(proxyApi, "calledWithMatch", true);
delegateToCalls(proxyApi, "alwaysCalledWith", false, "calledWith");
delegateToCalls(proxyApi, "alwaysCalledWithMatch", false, "calledWithMatch");
delegateToCalls(proxyApi, "calledWithExactly", true);
delegateToCalls(proxyApi, "calledOnceWithExactly", true, "calledWithExactly", false, undefined, 1);
delegateToCalls(proxyApi, "alwaysCalledWithExactly", false, "calledWithExactly");
delegateToCalls(proxyApi, "neverCalledWith", false, "notCalledWith", false, function() {
    return true;
});
delegateToCalls(proxyApi, "neverCalledWithMatch", false, "notCalledWithMatch", false, function() {
    return true;
});
delegateToCalls(proxyApi, "threw", true);
delegateToCalls(proxyApi, "alwaysThrew", false, "threw");
delegateToCalls(proxyApi, "returned", true);
delegateToCalls(proxyApi, "alwaysReturned", false, "returned");
delegateToCalls(proxyApi, "calledWithNew", true);
delegateToCalls(proxyApi, "alwaysCalledWithNew", false, "calledWithNew");

function createProxy(func, originalFunc) {
    var proxy = wrapFunction(func, originalFunc);

    // Inherit function properties:
    extend(proxy, func);

    proxy.prototype = func.prototype;

    extend.nonEnum(proxy, proxyApi);

    return proxy;
}

function wrapFunction(func, originalFunc) {
    var arity = originalFunc.length;
    var p;
    // Do not change this to use an eval. Projects that depend on sinon block the use of eval.
    // ref: https://github.com/sinonjs/sinon/issues/710
    switch (arity) {
        /*eslint-disable no-unused-vars, max-len*/
        case 0:
            p = function proxy() {
                return p.invoke(func, this, slice(arguments));
            };
            break;
        case 1:
            p = function proxy(a) {
                return p.invoke(func, this, slice(arguments));
            };
            break;
        case 2:
            p = function proxy(a, b) {
                return p.invoke(func, this, slice(arguments));
            };
            break;
        case 3:
            p = function proxy(a, b, c) {
                return p.invoke(func, this, slice(arguments));
            };
            break;
        case 4:
            p = function proxy(a, b, c, d) {
                return p.invoke(func, this, slice(arguments));
            };
            break;
        case 5:
            p = function proxy(a, b, c, d, e) {
                return p.invoke(func, this, slice(arguments));
            };
            break;
        case 6:
            p = function proxy(a, b, c, d, e, f) {
                return p.invoke(func, this, slice(arguments));
            };
            break;
        case 7:
            p = function proxy(a, b, c, d, e, f, g) {
                return p.invoke(func, this, slice(arguments));
            };
            break;
        case 8:
            p = function proxy(a, b, c, d, e, f, g, h) {
                return p.invoke(func, this, slice(arguments));
            };
            break;
        case 9:
            p = function proxy(a, b, c, d, e, f, g, h, i) {
                return p.invoke(func, this, slice(arguments));
            };
            break;
        case 10:
            p = function proxy(a, b, c, d, e, f, g, h, i, j) {
                return p.invoke(func, this, slice(arguments));
            };
            break;
        case 11:
            p = function proxy(a, b, c, d, e, f, g, h, i, j, k) {
                return p.invoke(func, this, slice(arguments));
            };
            break;
        case 12:
            p = function proxy(a, b, c, d, e, f, g, h, i, j, k, l) {
                return p.invoke(func, this, slice(arguments));
            };
            break;
        default:
            p = function proxy() {
                return p.invoke(func, this, slice(arguments));
            };
            break;
        /*eslint-enable*/
    }
    var nameDescriptor = Object.getOwnPropertyDescriptor(originalFunc, "name");
    if (nameDescriptor && nameDescriptor.configurable) {
        // IE 11 functions don't have a name.
        // Safari 9 has names that are not configurable.
        Object.defineProperty(p, "name", nameDescriptor);
    }
    extend.nonEnum(p, {
        isSinonProxy: true,

        called: false,
        notCalled: true,
        calledOnce: false,
        calledTwice: false,
        calledThrice: false,
        callCount: 0,
        firstCall: null,
        firstArg: null,
        secondCall: null,
        thirdCall: null,
        lastCall: null,
        lastArg: null,
        args: [],
        returnValues: [],
        thisValues: [],
        exceptions: [],
        callIds: [],
        errorsWithCallStack: []
    });
    return p;
}

module.exports = createProxy;
