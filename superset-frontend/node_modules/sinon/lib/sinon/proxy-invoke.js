"use strict";

var arrayProto = require("@sinonjs/commons").prototypes.array;
var proxyCallUtil = require("./proxy-call-util");

var push = arrayProto.push;
var forEach = arrayProto.forEach;
var concat = arrayProto.concat;
var ErrorConstructor = Error.prototype.constructor;
var bind = Function.prototype.bind;

var callId = 0;

module.exports = function invoke(func, thisValue, args) {
    var matchings = this.matchingFakes(args);
    var currentCallId = callId++;
    var exception, returnValue;

    proxyCallUtil.incrementCallCount(this);
    push(this.thisValues, thisValue);
    push(this.args, args);
    push(this.callIds, currentCallId);
    forEach(matchings, function(matching) {
        proxyCallUtil.incrementCallCount(matching);
        push(matching.thisValues, thisValue);
        push(matching.args, args);
        push(matching.callIds, currentCallId);
    });

    // Make call properties available from within the spied function:
    proxyCallUtil.createCallProperties(this);
    forEach(matchings, proxyCallUtil.createCallProperties);

    try {
        this.invoking = true;

        var thisCall = this.getCall(this.callCount - 1);

        if (thisCall.calledWithNew()) {
            // Call through with `new`
            returnValue = new (bind.apply(this.func || func, concat([thisValue], args)))();

            if (typeof returnValue !== "object") {
                returnValue = thisValue;
            }
        } else {
            returnValue = (this.func || func).apply(thisValue, args);
        }
    } catch (e) {
        exception = e;
    } finally {
        delete this.invoking;
    }

    push(this.exceptions, exception);
    push(this.returnValues, returnValue);
    forEach(matchings, function(matching) {
        push(matching.exceptions, exception);
        push(matching.returnValues, returnValue);
    });

    var err = new ErrorConstructor();
    // 1. Please do not get stack at this point. It may be so very slow, and not actually used
    // 2. PhantomJS does not serialize the stack trace until the error has been thrown:
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/Stack
    try {
        throw err;
    } catch (e) {
        /* empty */
    }
    push(this.errorsWithCallStack, err);
    forEach(matchings, function(matching) {
        push(matching.errorsWithCallStack, err);
    });

    // Make return value and exception available in the calls:
    proxyCallUtil.createCallProperties(this);
    forEach(matchings, proxyCallUtil.createCallProperties);

    if (exception !== undefined) {
        throw exception;
    }

    return returnValue;
};
