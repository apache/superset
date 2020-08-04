"use strict";

var arrayProto = require("@sinonjs/commons").prototypes.array;
var match = require("@sinonjs/samsam").createMatcher;
var deepEqual = require("@sinonjs/samsam").deepEqual;
var functionName = require("@sinonjs/commons").functionName;
var sinonFormat = require("./util/core/format");
var valueToString = require("@sinonjs/commons").valueToString;

var concat = arrayProto.concat;
var filter = arrayProto.filter;
var join = arrayProto.join;
var map = arrayProto.map;
var reduce = arrayProto.reduce;
var slice = arrayProto.slice;

function throwYieldError(proxy, text, args) {
    var msg = functionName(proxy) + text;
    if (args.length) {
        msg += " Received [" + join(slice(args), ", ") + "]";
    }
    throw new Error(msg);
}

var callProto = {
    calledOn: function calledOn(thisValue) {
        if (match.isMatcher(thisValue)) {
            return thisValue.test(this.thisValue);
        }
        return this.thisValue === thisValue;
    },

    calledWith: function calledWith() {
        var self = this;
        var calledWithArgs = slice(arguments);

        if (calledWithArgs.length > self.args.length) {
            return false;
        }

        return reduce(
            calledWithArgs,
            function(prev, arg, i) {
                return prev && deepEqual(self.args[i], arg);
            },
            true
        );
    },

    calledWithMatch: function calledWithMatch() {
        var self = this;
        var calledWithMatchArgs = slice(arguments);

        if (calledWithMatchArgs.length > self.args.length) {
            return false;
        }

        return reduce(
            calledWithMatchArgs,
            function(prev, expectation, i) {
                var actual = self.args[i];

                return prev && match(expectation).test(actual);
            },
            true
        );
    },

    calledWithExactly: function calledWithExactly() {
        return arguments.length === this.args.length && this.calledWith.apply(this, arguments);
    },

    notCalledWith: function notCalledWith() {
        return !this.calledWith.apply(this, arguments);
    },

    notCalledWithMatch: function notCalledWithMatch() {
        return !this.calledWithMatch.apply(this, arguments);
    },

    returned: function returned(value) {
        return deepEqual(this.returnValue, value);
    },

    threw: function threw(error) {
        if (typeof error === "undefined" || !this.exception) {
            return Boolean(this.exception);
        }

        return this.exception === error || this.exception.name === error;
    },

    calledWithNew: function calledWithNew() {
        return this.proxy.prototype && this.thisValue instanceof this.proxy;
    },

    calledBefore: function(other) {
        return this.callId < other.callId;
    },

    calledAfter: function(other) {
        return this.callId > other.callId;
    },

    calledImmediatelyBefore: function(other) {
        return this.callId === other.callId - 1;
    },

    calledImmediatelyAfter: function(other) {
        return this.callId === other.callId + 1;
    },

    callArg: function(pos) {
        this.ensureArgIsAFunction(pos);
        return this.args[pos]();
    },

    callArgOn: function(pos, thisValue) {
        this.ensureArgIsAFunction(pos);
        return this.args[pos].apply(thisValue);
    },

    callArgWith: function(pos) {
        return this.callArgOnWith.apply(this, concat([pos, null], slice(arguments, 1)));
    },

    callArgOnWith: function(pos, thisValue) {
        this.ensureArgIsAFunction(pos);
        var args = slice(arguments, 2);
        return this.args[pos].apply(thisValue, args);
    },

    throwArg: function(pos) {
        if (pos > this.args.length) {
            throw new TypeError("Not enough arguments: " + pos + " required but only " + this.args.length + " present");
        }

        throw this.args[pos];
    },

    yield: function() {
        return this.yieldOn.apply(this, concat([null], slice(arguments, 0)));
    },

    yieldOn: function(thisValue) {
        var args = slice(this.args);
        var yieldFn = filter(args, function(arg) {
            return typeof arg === "function";
        })[0];

        if (!yieldFn) {
            throwYieldError(this.proxy, " cannot yield since no callback was passed.", args);
        }

        return yieldFn.apply(thisValue, slice(arguments, 1));
    },

    yieldTo: function(prop) {
        return this.yieldToOn.apply(this, concat([prop, null], slice(arguments, 1)));
    },

    yieldToOn: function(prop, thisValue) {
        var args = slice(this.args);
        var yieldArg = filter(args, function(arg) {
            return arg && typeof arg[prop] === "function";
        })[0];
        var yieldFn = yieldArg && yieldArg[prop];

        if (!yieldFn) {
            throwYieldError(
                this.proxy,
                " cannot yield to '" + valueToString(prop) + "' since no callback was passed.",
                args
            );
        }

        return yieldFn.apply(thisValue, slice(arguments, 2));
    },

    toString: function() {
        var callStr = this.proxy ? String(this.proxy) + "(" : "";
        var formattedArgs;

        if (!this.args) {
            return ":(";
        }

        formattedArgs = map(this.args, function(arg) {
            return sinonFormat(arg);
        });

        callStr = callStr + join(formattedArgs, ", ") + ")";

        if (typeof this.returnValue !== "undefined") {
            callStr += " => " + sinonFormat(this.returnValue);
        }

        if (this.exception) {
            callStr += " !" + this.exception.name;

            if (this.exception.message) {
                callStr += "(" + this.exception.message + ")";
            }
        }
        if (this.stack) {
            // Omit the error message and the two top stack frames in sinon itself:
            callStr += (this.stack.split("\n")[3] || "unknown").replace(/^\s*(?:at\s+|@)?/, " at ");
        }

        return callStr;
    },

    ensureArgIsAFunction: function(pos) {
        if (typeof this.args[pos] !== "function") {
            throw new TypeError(
                "Expected argument at position " + pos + " to be a Function, but was " + typeof this.args[pos]
            );
        }
    }
};
Object.defineProperty(callProto, "stack", {
    enumerable: true,
    configurable: true,
    get: function() {
        return (this.errorWithCallStack && this.errorWithCallStack.stack) || "";
    }
});

callProto.invokeCallback = callProto.yield;

function createProxyCall(proxy, thisValue, args, returnValue, exception, id, errorWithCallStack) {
    if (typeof id !== "number") {
        throw new TypeError("Call id is not a number");
    }

    var firstArg, lastArg;

    if (args.length > 0) {
        firstArg = args[0];
        lastArg = args[args.length - 1];
    }

    var proxyCall = Object.create(callProto);
    var callback = lastArg && typeof lastArg === "function" ? lastArg : undefined;

    proxyCall.proxy = proxy;
    proxyCall.thisValue = thisValue;
    proxyCall.args = args;
    proxyCall.firstArg = firstArg;
    proxyCall.lastArg = lastArg;
    proxyCall.callback = callback;
    proxyCall.returnValue = returnValue;
    proxyCall.exception = exception;
    proxyCall.callId = id;
    proxyCall.errorWithCallStack = errorWithCallStack;

    return proxyCall;
}
createProxyCall.toString = callProto.toString; // used by mocks

module.exports = createProxyCall;
