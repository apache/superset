"use strict";

var arrayProto = require("@sinonjs/commons").prototypes.array;
var mockExpectation = require("./mock-expectation");
var proxyCallToString = require("./proxy-call").toString;
var extend = require("./util/core/extend");
var deepEqual = require("@sinonjs/samsam").deepEqual;
var wrapMethod = require("./util/core/wrap-method");
var usePromiseLibrary = require("./util/core/use-promise-library");

var concat = arrayProto.concat;
var filter = arrayProto.filter;
var forEach = arrayProto.forEach;
var every = arrayProto.every;
var join = arrayProto.join;
var push = arrayProto.push;
var slice = arrayProto.slice;
var unshift = arrayProto.unshift;

function mock(object) {
    if (!object || typeof object === "string") {
        return mockExpectation.create(object ? object : "Anonymous mock");
    }

    return mock.create(object);
}

function each(collection, callback) {
    var col = collection || [];

    forEach(col, callback);
}

function arrayEquals(arr1, arr2, compareLength) {
    if (compareLength && arr1.length !== arr2.length) {
        return false;
    }

    return every(arr1, function(element, i) {
        return deepEqual(arr2[i], element);
    });
}

extend(mock, {
    create: function create(object) {
        if (!object) {
            throw new TypeError("object is null");
        }

        var mockObject = extend.nonEnum({}, mock, { object: object });
        delete mockObject.create;

        return mockObject;
    },

    expects: function expects(method) {
        if (!method) {
            throw new TypeError("method is falsy");
        }

        if (!this.expectations) {
            this.expectations = {};
            this.proxies = [];
            this.failures = [];
        }

        if (!this.expectations[method]) {
            this.expectations[method] = [];
            var mockObject = this;

            wrapMethod(this.object, method, function() {
                return mockObject.invokeMethod(method, this, arguments);
            });

            push(this.proxies, method);
        }

        var expectation = mockExpectation.create(method);
        expectation.wrappedMethod = this.object[method].wrappedMethod;
        push(this.expectations[method], expectation);
        usePromiseLibrary(this.promiseLibrary, expectation);

        return expectation;
    },

    restore: function restore() {
        var object = this.object;

        each(this.proxies, function(proxy) {
            if (typeof object[proxy].restore === "function") {
                object[proxy].restore();
            }
        });
    },

    verify: function verify() {
        var expectations = this.expectations || {};
        var messages = this.failures ? slice(this.failures) : [];
        var met = [];

        each(this.proxies, function(proxy) {
            each(expectations[proxy], function(expectation) {
                if (!expectation.met()) {
                    push(messages, String(expectation));
                } else {
                    push(met, String(expectation));
                }
            });
        });

        this.restore();

        if (messages.length > 0) {
            mockExpectation.fail(join(concat(messages, met), "\n"));
        } else if (met.length > 0) {
            mockExpectation.pass(join(concat(messages, met), "\n"));
        }

        return true;
    },

    usingPromise: function usingPromise(promiseLibrary) {
        this.promiseLibrary = promiseLibrary;

        return this;
    },

    invokeMethod: function invokeMethod(method, thisValue, args) {
        /* if we cannot find any matching files we will explicitly call mockExpection#fail with error messages */
        /* eslint consistent-return: "off" */
        var expectations = this.expectations && this.expectations[method] ? this.expectations[method] : [];
        var currentArgs = args || [];
        var available;

        var expectationsWithMatchingArgs = filter(expectations, function(expectation) {
            var expectedArgs = expectation.expectedArguments || [];

            return arrayEquals(expectedArgs, currentArgs, expectation.expectsExactArgCount);
        });

        var expectationsToApply = filter(expectationsWithMatchingArgs, function(expectation) {
            return !expectation.met() && expectation.allowsCall(thisValue, args);
        });

        if (expectationsToApply.length > 0) {
            return expectationsToApply[0].apply(thisValue, args);
        }

        var messages = [];
        var exhausted = 0;

        forEach(expectationsWithMatchingArgs, function(expectation) {
            if (expectation.allowsCall(thisValue, args)) {
                available = available || expectation;
            } else {
                exhausted += 1;
            }
        });

        if (available && exhausted === 0) {
            return available.apply(thisValue, args);
        }

        forEach(expectations, function(expectation) {
            push(messages, "    " + String(expectation));
        });

        unshift(
            messages,
            "Unexpected call: " +
                proxyCallToString.call({
                    proxy: method,
                    args: args
                })
        );

        var err = new Error();
        if (!err.stack) {
            // PhantomJS does not serialize the stack trace until the error has been thrown
            try {
                throw err;
            } catch (e) {
                /* empty */
            }
        }
        push(
            this.failures,
            "Unexpected call: " +
                proxyCallToString.call({
                    proxy: method,
                    args: args,
                    stack: err.stack
                })
        );

        mockExpectation.fail(join(messages, "\n"));
    }
});

module.exports = mock;
