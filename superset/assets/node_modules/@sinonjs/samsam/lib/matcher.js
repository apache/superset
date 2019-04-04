"use strict";

var arrayProto = require("@sinonjs/commons").prototypes.array;
var deepEqual = require("./deep-equal").use(match); // eslint-disable-line no-use-before-define
var every = require("@sinonjs/commons").every;
var functionName = require("@sinonjs/commons").functionName;
var get = require("lodash.get");
var iterableToString = require("./iterable-to-string");
var objectProto = require("@sinonjs/commons").prototypes.object;
var stringProto = require("@sinonjs/commons").prototypes.string;
var typeOf = require("@sinonjs/commons").typeOf;
var valueToString = require("@sinonjs/commons").valueToString;

var arrayIndexOf = arrayProto.indexOf;
var arrayEvery = arrayProto.every;
var join = arrayProto.join;
var map = arrayProto.map;
var some = arrayProto.some;

var hasOwnProperty = objectProto.hasOwnProperty;
var isPrototypeOf = objectProto.isPrototypeOf;

var stringIndexOf = stringProto.indexOf;

function assertType(value, type, name) {
    var actual = typeOf(value);
    if (actual !== type) {
        throw new TypeError(
            "Expected type of " +
                name +
                " to be " +
                type +
                ", but was " +
                actual
        );
    }
}

function assertMethodExists(value, method, name, methodPath) {
    if (value[method] == null) {
        throw new TypeError(
            "Expected " + name + " to have method " + methodPath
        );
    }
}

var matcher = {
    toString: function() {
        return this.message;
    }
};

function isMatcher(object) {
    return isPrototypeOf(matcher, object);
}

function matchObject(actual, expectation) {
    if (actual === null || actual === undefined) {
        return false;
    }

    return arrayEvery(Object.keys(expectation), function(key) {
        var exp = expectation[key];
        var act = actual[key];

        if (isMatcher(exp)) {
            if (!exp.test(act)) {
                return false;
            }
        } else if (typeOf(exp) === "object") {
            if (!matchObject(act, exp)) {
                return false;
            }
        } else if (!deepEqual(act, exp)) {
            return false;
        }

        return true;
    });
}

var TYPE_MAP = {
    function: function(m, expectation, message) {
        m.test = expectation;
        m.message = message || "match(" + functionName(expectation) + ")";
    },
    number: function(m, expectation) {
        m.test = function(actual) {
            // we need type coercion here
            return expectation == actual; // eslint-disable-line eqeqeq
        };
    },
    object: function(m, expectation) {
        var array = [];

        if (typeof expectation.test === "function") {
            m.test = function(actual) {
                return expectation.test(actual) === true;
            };
            m.message = "match(" + functionName(expectation.test) + ")";
            return m;
        }

        array = map(Object.keys(expectation), function(key) {
            return key + ": " + valueToString(expectation[key]);
        });

        m.test = function(actual) {
            return matchObject(actual, expectation);
        };
        m.message = "match(" + join(array, ", ") + ")";

        return m;
    },
    regexp: function(m, expectation) {
        m.test = function(actual) {
            return typeof actual === "string" && expectation.test(actual);
        };
    },
    string: function(m, expectation) {
        m.test = function(actual) {
            return (
                typeof actual === "string" &&
                stringIndexOf(actual, expectation) !== -1
            );
        };
        m.message = 'match("' + expectation + '")';
    }
};

function match(expectation, message) {
    var m = Object.create(matcher);
    var type = typeOf(expectation);

    if (type in TYPE_MAP) {
        TYPE_MAP[type](m, expectation, message);
    } else {
        m.test = function(actual) {
            return deepEqual(actual, expectation);
        };
    }

    if (!m.message) {
        m.message = "match(" + valueToString(expectation) + ")";
    }

    return m;
}

matcher.or = function(m2) {
    if (!arguments.length) {
        throw new TypeError("Matcher expected");
    } else if (!isMatcher(m2)) {
        m2 = match(m2);
    }
    var m1 = this;
    var or = Object.create(matcher);
    or.test = function(actual) {
        return m1.test(actual) || m2.test(actual);
    };
    or.message = m1.message + ".or(" + m2.message + ")";
    return or;
};

matcher.and = function(m2) {
    if (!arguments.length) {
        throw new TypeError("Matcher expected");
    } else if (!isMatcher(m2)) {
        m2 = match(m2);
    }
    var m1 = this;
    var and = Object.create(matcher);
    and.test = function(actual) {
        return m1.test(actual) && m2.test(actual);
    };
    and.message = m1.message + ".and(" + m2.message + ")";
    return and;
};

match.isMatcher = isMatcher;

match.any = match(function() {
    return true;
}, "any");

match.defined = match(function(actual) {
    return actual !== null && actual !== undefined;
}, "defined");

match.truthy = match(function(actual) {
    return !!actual;
}, "truthy");

match.falsy = match(function(actual) {
    return !actual;
}, "falsy");

match.same = function(expectation) {
    return match(function(actual) {
        return expectation === actual;
    }, "same(" + valueToString(expectation) + ")");
};

match.in = function(arrayOfExpectations) {
    if (!Array.isArray(arrayOfExpectations)) {
        throw new TypeError("array expected");
    }

    return match(function(actual) {
        return some(arrayOfExpectations, function(expectation) {
            return expectation === actual;
        });
    }, "in(" + valueToString(arrayOfExpectations) + ")");
};

match.typeOf = function(type) {
    assertType(type, "string", "type");
    return match(function(actual) {
        return typeOf(actual) === type;
    }, 'typeOf("' + type + '")');
};

match.instanceOf = function(type) {
    if (
        typeof Symbol === "undefined" ||
        typeof Symbol.hasInstance === "undefined"
    ) {
        assertType(type, "function", "type");
    } else {
        assertMethodExists(
            type,
            Symbol.hasInstance,
            "type",
            "[Symbol.hasInstance]"
        );
    }
    return match(function(actual) {
        return actual instanceof type;
    }, "instanceOf(" +
        (functionName(type) || Object.prototype.toString.call(type)) +
        ")");
};

function createPropertyMatcher(propertyTest, messagePrefix) {
    return function(property, value) {
        assertType(property, "string", "property");
        var onlyProperty = arguments.length === 1;
        var message = messagePrefix + '("' + property + '"';
        if (!onlyProperty) {
            message += ", " + valueToString(value);
        }
        message += ")";
        return match(function(actual) {
            if (
                actual === undefined ||
                actual === null ||
                !propertyTest(actual, property)
            ) {
                return false;
            }
            return onlyProperty || deepEqual(actual[property], value);
        }, message);
    };
}

match.has = createPropertyMatcher(function(actual, property) {
    if (typeof actual === "object") {
        return property in actual;
    }
    return actual[property] !== undefined;
}, "has");

match.hasOwn = createPropertyMatcher(function(actual, property) {
    return hasOwnProperty(actual, property);
}, "hasOwn");

match.hasNested = function(property, value) {
    assertType(property, "string", "property");
    var onlyProperty = arguments.length === 1;
    var message = 'hasNested("' + property + '"';
    if (!onlyProperty) {
        message += ", " + valueToString(value);
    }
    message += ")";
    return match(function(actual) {
        if (
            actual === undefined ||
            actual === null ||
            get(actual, property) === undefined
        ) {
            return false;
        }
        return onlyProperty || deepEqual(get(actual, property), value);
    }, message);
};

match.every = function(predicate) {
    if (!isMatcher(predicate)) {
        throw new TypeError("Matcher expected");
    }

    return match(function(actual) {
        if (typeOf(actual) === "object") {
            return every(Object.keys(actual), function(key) {
                return predicate.test(actual[key]);
            });
        }

        return (
            !!actual &&
            typeOf(actual.forEach) === "function" &&
            every(actual, function(element) {
                return predicate.test(element);
            })
        );
    }, "every(" + predicate.message + ")");
};

match.some = function(predicate) {
    if (!isMatcher(predicate)) {
        throw new TypeError("Matcher expected");
    }

    return match(function(actual) {
        if (typeOf(actual) === "object") {
            return !every(Object.keys(actual), function(key) {
                return !predicate.test(actual[key]);
            });
        }

        return (
            !!actual &&
            typeOf(actual.forEach) === "function" &&
            !every(actual, function(element) {
                return !predicate.test(element);
            })
        );
    }, "some(" + predicate.message + ")");
};

match.array = match.typeOf("array");

match.array.deepEquals = function(expectation) {
    return match(function(actual) {
        // Comparing lengths is the fastest way to spot a difference before iterating through every item
        var sameLength = actual.length === expectation.length;
        return (
            typeOf(actual) === "array" &&
            sameLength &&
            every(actual, function(element, index) {
                return expectation[index] === element;
            })
        );
    }, "deepEquals([" + iterableToString(expectation) + "])");
};

match.array.startsWith = function(expectation) {
    return match(function(actual) {
        return (
            typeOf(actual) === "array" &&
            every(expectation, function(expectedElement, index) {
                return actual[index] === expectedElement;
            })
        );
    }, "startsWith([" + iterableToString(expectation) + "])");
};

match.array.endsWith = function(expectation) {
    return match(function(actual) {
        // This indicates the index in which we should start matching
        var offset = actual.length - expectation.length;

        return (
            typeOf(actual) === "array" &&
            every(expectation, function(expectedElement, index) {
                return actual[offset + index] === expectedElement;
            })
        );
    }, "endsWith([" + iterableToString(expectation) + "])");
};

match.array.contains = function(expectation) {
    return match(function(actual) {
        return (
            typeOf(actual) === "array" &&
            every(expectation, function(expectedElement) {
                return arrayIndexOf(actual, expectedElement) !== -1;
            })
        );
    }, "contains([" + iterableToString(expectation) + "])");
};

match.map = match.typeOf("map");

match.map.deepEquals = function mapDeepEquals(expectation) {
    return match(function(actual) {
        // Comparing lengths is the fastest way to spot a difference before iterating through every item
        var sameLength = actual.size === expectation.size;
        return (
            typeOf(actual) === "map" &&
            sameLength &&
            every(actual, function(element, key) {
                return expectation.has(key) && expectation.get(key) === element;
            })
        );
    }, "deepEquals(Map[" + iterableToString(expectation) + "])");
};

match.map.contains = function mapContains(expectation) {
    return match(function(actual) {
        return (
            typeOf(actual) === "map" &&
            every(expectation, function(element, key) {
                return actual.has(key) && actual.get(key) === element;
            })
        );
    }, "contains(Map[" + iterableToString(expectation) + "])");
};

match.set = match.typeOf("set");

match.set.deepEquals = function setDeepEquals(expectation) {
    return match(function(actual) {
        // Comparing lengths is the fastest way to spot a difference before iterating through every item
        var sameLength = actual.size === expectation.size;
        return (
            typeOf(actual) === "set" &&
            sameLength &&
            every(actual, function(element) {
                return expectation.has(element);
            })
        );
    }, "deepEquals(Set[" + iterableToString(expectation) + "])");
};

match.set.contains = function setContains(expectation) {
    return match(function(actual) {
        return (
            typeOf(actual) === "set" &&
            every(expectation, function(element) {
                return actual.has(element);
            })
        );
    }, "contains(Set[" + iterableToString(expectation) + "])");
};

match.bool = match.typeOf("boolean");
match.number = match.typeOf("number");
match.string = match.typeOf("string");
match.object = match.typeOf("object");
match.func = match.typeOf("function");
match.regexp = match.typeOf("regexp");
match.date = match.typeOf("date");
match.symbol = match.typeOf("symbol");

module.exports = match;
