"use strict";

var arrayProto = require("@sinonjs/commons").prototypes.array;
var reduce = arrayProto.reduce;

module.exports = function exportAsyncBehaviors(behaviorMethods) {
    return reduce(
        Object.keys(behaviorMethods),
        function(acc, method) {
            // need to avoid creating another async versions of the newly added async methods
            if (method.match(/^(callsArg|yields)/) && !method.match(/Async/)) {
                acc[method + "Async"] = function() {
                    var result = behaviorMethods[method].apply(this, arguments);
                    this.callbackAsync = true;
                    return result;
                };
            }
            return acc;
        },
        {}
    );
};
