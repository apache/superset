"use strict";

var arrayProto = require("@sinonjs/commons").prototypes.array;
var collectOwnMethods = require("./collect-own-methods");
var getPropertyDescriptor = require("./util/core/get-property-descriptor");
var isPropertyConfigurable = require("./util/core/is-property-configurable");
var match = require("@sinonjs/samsam").createMatcher;
var sinonAssert = require("./assert");
var sinonClock = require("./util/fake-timers");
var sinonMock = require("./mock");
var sinonSpy = require("./spy");
var sinonStub = require("./stub");
var sinonFake = require("./fake");
var valueToString = require("@sinonjs/commons").valueToString;
var fakeServer = require("nise").fakeServer;
var fakeXhr = require("nise").fakeXhr;
var usePromiseLibrary = require("./util/core/use-promise-library");

var filter = arrayProto.filter;
var forEach = arrayProto.filter;
var push = arrayProto.push;
var reverse = arrayProto.reverse;

function applyOnEach(fakes, method) {
    var matchingFakes = filter(fakes, function(fake) {
        return typeof fake[method] === "function";
    });

    forEach(matchingFakes, function(fake) {
        fake[method]();
    });
}

function Sandbox() {
    var sandbox = this;
    var collection = [];
    var fakeRestorers = [];
    var promiseLib;

    sandbox.serverPrototype = fakeServer;

    // this is for testing only
    sandbox.getFakes = function getFakes() {
        return collection;
    };

    // this is for testing only
    sandbox.getRestorers = function() {
        return fakeRestorers;
    };

    sandbox.createStubInstance = function createStubInstance() {
        var stubbed = sinonStub.createStubInstance.apply(null, arguments);

        var ownMethods = collectOwnMethods(stubbed);

        forEach(ownMethods, function(method) {
            push(collection, method);
        });

        usePromiseLibrary(promiseLib, ownMethods);

        return stubbed;
    };

    sandbox.inject = function inject(obj) {
        obj.spy = function() {
            return sandbox.spy.apply(null, arguments);
        };

        obj.stub = function() {
            return sandbox.stub.apply(null, arguments);
        };

        obj.mock = function() {
            return sandbox.mock.apply(null, arguments);
        };

        obj.createStubInstance = function() {
            return sandbox.createStubInstance.apply(sandbox, arguments);
        };

        obj.fake = function() {
            return sandbox.fake.apply(null, arguments);
        };

        obj.replace = function() {
            return sandbox.replace.apply(null, arguments);
        };

        obj.replaceSetter = function() {
            return sandbox.replaceSetter.apply(null, arguments);
        };

        obj.replaceGetter = function() {
            return sandbox.replaceGetter.apply(null, arguments);
        };

        if (sandbox.clock) {
            obj.clock = sandbox.clock;
        }

        if (sandbox.server) {
            obj.server = sandbox.server;
            obj.requests = sandbox.server.requests;
        }

        obj.match = match;

        return obj;
    };

    sandbox.mock = function mock() {
        var m = sinonMock.apply(null, arguments);

        push(collection, m);
        usePromiseLibrary(promiseLib, m);

        return m;
    };

    sandbox.reset = function reset() {
        applyOnEach(collection, "reset");
        applyOnEach(collection, "resetHistory");
    };

    sandbox.resetBehavior = function resetBehavior() {
        applyOnEach(collection, "resetBehavior");
    };

    sandbox.resetHistory = function resetHistory() {
        function privateResetHistory(f) {
            var method = f.resetHistory || f.reset;
            if (method) {
                method.call(f);
            }
        }

        forEach(collection, function(fake) {
            if (typeof fake === "function") {
                privateResetHistory(fake);
                return;
            }

            var methods = [];
            if (fake.get) {
                push(methods, fake.get);
            }

            if (fake.set) {
                push(methods, fake.set);
            }

            forEach(methods, privateResetHistory);
        });
    };

    sandbox.restore = function restore() {
        if (arguments.length) {
            throw new Error("sandbox.restore() does not take any parameters. Perhaps you meant stub.restore()");
        }

        reverse(collection);
        applyOnEach(collection, "restore");
        collection = [];

        forEach(fakeRestorers, function(restorer) {
            restorer();
        });
        fakeRestorers = [];

        sandbox.restoreContext();
    };

    sandbox.restoreContext = function restoreContext() {
        var injectedKeys = sandbox.injectedKeys;
        var injectInto = sandbox.injectInto;

        if (!injectedKeys) {
            return;
        }

        forEach(injectedKeys, function(injectedKey) {
            delete injectInto[injectedKey];
        });

        injectedKeys = [];
    };

    function getFakeRestorer(object, property) {
        var descriptor = getPropertyDescriptor(object, property);

        function restorer() {
            if (descriptor.isOwn) {
                Object.defineProperty(object, property, descriptor);
            } else {
                delete object[property];
            }
        }
        restorer.object = object;
        restorer.property = property;
        return restorer;
    }

    function verifyNotReplaced(object, property) {
        forEach(fakeRestorers, function(fakeRestorer) {
            if (fakeRestorer.object === object && fakeRestorer.property === property) {
                throw new TypeError("Attempted to replace " + property + " which is already replaced");
            }
        });
    }

    sandbox.replace = function replace(object, property, replacement) {
        var descriptor = getPropertyDescriptor(object, property);

        if (typeof descriptor === "undefined") {
            throw new TypeError("Cannot replace non-existent property " + valueToString(property));
        }

        if (typeof replacement === "undefined") {
            throw new TypeError("Expected replacement argument to be defined");
        }

        if (typeof descriptor.get === "function") {
            throw new Error("Use sandbox.replaceGetter for replacing getters");
        }

        if (typeof descriptor.set === "function") {
            throw new Error("Use sandbox.replaceSetter for replacing setters");
        }

        if (typeof object[property] !== typeof replacement) {
            throw new TypeError("Cannot replace " + typeof object[property] + " with " + typeof replacement);
        }

        verifyNotReplaced(object, property);

        // store a function for restoring the replaced property
        push(fakeRestorers, getFakeRestorer(object, property));

        object[property] = replacement;

        return replacement;
    };

    sandbox.replaceGetter = function replaceGetter(object, property, replacement) {
        var descriptor = getPropertyDescriptor(object, property);

        if (typeof descriptor === "undefined") {
            throw new TypeError("Cannot replace non-existent property " + valueToString(property));
        }

        if (typeof replacement !== "function") {
            throw new TypeError("Expected replacement argument to be a function");
        }

        if (typeof descriptor.get !== "function") {
            throw new Error("`object.property` is not a getter");
        }

        verifyNotReplaced(object, property);

        // store a function for restoring the replaced property
        push(fakeRestorers, getFakeRestorer(object, property));

        Object.defineProperty(object, property, {
            get: replacement,
            configurable: isPropertyConfigurable(object, property)
        });

        return replacement;
    };

    sandbox.replaceSetter = function replaceSetter(object, property, replacement) {
        var descriptor = getPropertyDescriptor(object, property);

        if (typeof descriptor === "undefined") {
            throw new TypeError("Cannot replace non-existent property " + valueToString(property));
        }

        if (typeof replacement !== "function") {
            throw new TypeError("Expected replacement argument to be a function");
        }

        if (typeof descriptor.set !== "function") {
            throw new Error("`object.property` is not a setter");
        }

        verifyNotReplaced(object, property);

        // store a function for restoring the replaced property
        push(fakeRestorers, getFakeRestorer(object, property));

        // eslint-disable-next-line accessor-pairs
        Object.defineProperty(object, property, {
            set: replacement,
            configurable: isPropertyConfigurable(object, property)
        });

        return replacement;
    };

    function commonPostInitSetup(args, spy) {
        var object = args[0];
        var property = args[1];

        var isSpyingOnEntireObject = typeof property === "undefined" && typeof object === "object";

        if (isSpyingOnEntireObject) {
            var ownMethods = collectOwnMethods(spy);

            forEach(ownMethods, function(method) {
                push(collection, method);
            });

            usePromiseLibrary(promiseLib, ownMethods);
        } else {
            push(collection, spy);
            usePromiseLibrary(promiseLib, spy);
        }

        return spy;
    }

    sandbox.spy = function spy() {
        var createdSpy = sinonSpy.apply(sinonSpy, arguments);
        return commonPostInitSetup(arguments, createdSpy);
    };

    sandbox.stub = function stub() {
        var createdStub = sinonStub.apply(sinonStub, arguments);
        return commonPostInitSetup(arguments, createdStub);
    };

    // eslint-disable-next-line no-unused-vars
    sandbox.fake = function fake(f) {
        var s = sinonFake.apply(sinonFake, arguments);

        push(collection, s);

        return s;
    };

    forEach(Object.keys(sinonFake), function(key) {
        var fakeBehavior = sinonFake[key];
        if (typeof fakeBehavior === "function") {
            sandbox.fake[key] = function() {
                var s = fakeBehavior.apply(fakeBehavior, arguments);

                push(collection, s);

                return s;
            };
        }
    });

    sandbox.useFakeTimers = function useFakeTimers(args) {
        var clock = sinonClock.useFakeTimers.call(null, args);

        sandbox.clock = clock;
        push(collection, clock);

        return clock;
    };

    sandbox.verify = function verify() {
        applyOnEach(collection, "verify");
    };

    sandbox.verifyAndRestore = function verifyAndRestore() {
        var exception;

        try {
            sandbox.verify();
        } catch (e) {
            exception = e;
        }

        sandbox.restore();

        if (exception) {
            throw exception;
        }
    };

    sandbox.useFakeServer = function useFakeServer() {
        var proto = sandbox.serverPrototype || fakeServer;

        if (!proto || !proto.create) {
            return null;
        }

        sandbox.server = proto.create();
        push(collection, sandbox.server);

        return sandbox.server;
    };

    sandbox.useFakeXMLHttpRequest = function useFakeXMLHttpRequest() {
        var xhr = fakeXhr.useFakeXMLHttpRequest();
        push(collection, xhr);
        return xhr;
    };

    sandbox.usingPromise = function usingPromise(promiseLibrary) {
        promiseLib = promiseLibrary;
        collection.promiseLibrary = promiseLibrary;

        return sandbox;
    };
}

Sandbox.prototype.assert = sinonAssert;
Sandbox.prototype.match = match;

module.exports = Sandbox;
