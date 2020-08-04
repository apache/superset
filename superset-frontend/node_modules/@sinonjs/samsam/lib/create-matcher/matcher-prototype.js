"use strict";

var matcherPrototype = {
    toString: function() {
        return this.message;
    }
};

matcherPrototype.or = function(valueOrMatcher) {
    var createMatcher = require("../create-matcher");
    var isMatcher = createMatcher.isMatcher;

    if (!arguments.length) {
        throw new TypeError("Matcher expected");
    }

    var m2 = isMatcher(valueOrMatcher)
        ? valueOrMatcher
        : createMatcher(valueOrMatcher);
    var m1 = this;
    var or = Object.create(matcherPrototype);
    or.test = function(actual) {
        return m1.test(actual) || m2.test(actual);
    };
    or.message = m1.message + ".or(" + m2.message + ")";
    return or;
};

matcherPrototype.and = function(valueOrMatcher) {
    var createMatcher = require("../create-matcher");
    var isMatcher = createMatcher.isMatcher;

    if (!arguments.length) {
        throw new TypeError("Matcher expected");
    }

    var m2 = isMatcher(valueOrMatcher)
        ? valueOrMatcher
        : createMatcher(valueOrMatcher);
    var m1 = this;
    var and = Object.create(matcherPrototype);
    and.test = function(actual) {
        return m1.test(actual) && m2.test(actual);
    };
    and.message = m1.message + ".and(" + m2.message + ")";
    return and;
};

module.exports = matcherPrototype;
