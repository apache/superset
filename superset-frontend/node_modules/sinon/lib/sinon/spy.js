"use strict";

var arrayProto = require("@sinonjs/commons").prototypes.array;
var createProxy = require("./proxy");
var extend = require("./util/core/extend");
var functionName = require("@sinonjs/commons").functionName;
var getPropertyDescriptor = require("./util/core/get-property-descriptor");
var deepEqual = require("@sinonjs/samsam").deepEqual;
var isEsModule = require("./util/core/is-es-module");
var proxyCallUtil = require("./proxy-call-util");
var walkObject = require("./util/core/walk-object");
var wrapMethod = require("./util/core/wrap-method");
var valueToString = require("@sinonjs/commons").valueToString;

/* cache references to library methods so that they also can be stubbed without problems */
var forEach = arrayProto.forEach;
var pop = arrayProto.pop;
var push = arrayProto.push;
var slice = arrayProto.slice;
var filter = Array.prototype.filter;

var uuid = 0;

function matches(fake, args, strict) {
    var margs = fake.matchingArguments;
    if (margs.length <= args.length && deepEqual(slice(args, 0, margs.length), margs)) {
        return !strict || margs.length === args.length;
    }
    return false;
}

// Public API
var spyApi = {
    withArgs: function() {
        var args = slice(arguments);
        var matching = pop(this.matchingFakes(args, true));
        if (matching) {
            return matching;
        }

        var original = this;
        var fake = this.instantiateFake();
        fake.matchingArguments = args;
        fake.parent = this;
        push(this.fakes, fake);

        fake.withArgs = function() {
            return original.withArgs.apply(original, arguments);
        };

        forEach(original.args, function(arg, i) {
            if (!matches(fake, arg)) {
                return;
            }

            proxyCallUtil.incrementCallCount(fake);
            push(fake.thisValues, original.thisValues[i]);
            push(fake.args, arg);
            push(fake.returnValues, original.returnValues[i]);
            push(fake.exceptions, original.exceptions[i]);
            push(fake.callIds, original.callIds[i]);
        });

        proxyCallUtil.createCallProperties(fake);

        return fake;
    },

    // Override proxy default implementation
    matchingFakes: function(args, strict) {
        return filter.call(this.fakes, function(fake) {
            return matches(fake, args, strict);
        });
    }
};

/* eslint-disable local-rules/no-prototype-methods */
var delegateToCalls = proxyCallUtil.delegateToCalls;
delegateToCalls(spyApi, "callArg", false, "callArgWith", true, function() {
    throw new Error(this.toString() + " cannot call arg since it was not yet invoked.");
});
spyApi.callArgWith = spyApi.callArg;
delegateToCalls(spyApi, "callArgOn", false, "callArgOnWith", true, function() {
    throw new Error(this.toString() + " cannot call arg since it was not yet invoked.");
});
spyApi.callArgOnWith = spyApi.callArgOn;
delegateToCalls(spyApi, "throwArg", false, "throwArg", false, function() {
    throw new Error(this.toString() + " cannot throw arg since it was not yet invoked.");
});
delegateToCalls(spyApi, "yield", false, "yield", true, function() {
    throw new Error(this.toString() + " cannot yield since it was not yet invoked.");
});
// "invokeCallback" is an alias for "yield" since "yield" is invalid in strict mode.
spyApi.invokeCallback = spyApi.yield;
delegateToCalls(spyApi, "yieldOn", false, "yieldOn", true, function() {
    throw new Error(this.toString() + " cannot yield since it was not yet invoked.");
});
delegateToCalls(spyApi, "yieldTo", false, "yieldTo", true, function(property) {
    throw new Error(
        this.toString() + " cannot yield to '" + valueToString(property) + "' since it was not yet invoked."
    );
});
delegateToCalls(spyApi, "yieldToOn", false, "yieldToOn", true, function(property) {
    throw new Error(
        this.toString() + " cannot yield to '" + valueToString(property) + "' since it was not yet invoked."
    );
});
/* eslint-enable local-rules/no-prototype-methods */

function createSpy(func) {
    var name;
    var funk = func;

    if (typeof funk !== "function") {
        funk = function() {
            return;
        };
    } else {
        name = functionName(funk);
    }

    var proxy = createProxy(funk, funk);

    // Inherit spy API:
    extend.nonEnum(proxy, spyApi);
    extend.nonEnum(proxy, {
        displayName: name || "spy",
        fakes: [],
        instantiateFake: createSpy,
        id: "spy#" + uuid++
    });
    return proxy;
}

function spy(object, property, types) {
    var descriptor, methodDesc;

    if (isEsModule(object)) {
        throw new TypeError("ES Modules cannot be spied");
    }

    if (!property && typeof object === "function") {
        return createSpy(object);
    }

    if (!property && typeof object === "object") {
        return walkObject(spy, object);
    }

    if (!object && !property) {
        return createSpy(function() {
            return;
        });
    }

    if (!types) {
        return wrapMethod(object, property, createSpy(object[property]));
    }

    descriptor = {};
    methodDesc = getPropertyDescriptor(object, property);

    forEach(types, function(type) {
        descriptor[type] = createSpy(methodDesc[type]);
    });

    return wrapMethod(object, property, descriptor);
}

extend(spy, spyApi);
module.exports = spy;
