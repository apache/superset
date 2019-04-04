"use strict";

var jsc = require("jsverify");
var refute = require("@sinonjs/referee-sinon").refute;

var functionName = require("./function-name");

describe("function-name", function() {
    it("should use displayName by default", function() {
        jsc.assertForall("nestring", function(displayName) {
            var fn = { displayName: displayName };

            return functionName(fn) === fn.displayName;
        });
    });

    it("should use name if displayName is not available", function() {
        jsc.assertForall("nestring", function(name) {
            var fn = { name: name };

            return functionName(fn) === fn.name;
        });
    });

    it("should fallback to string parsing", function() {
        jsc.assertForall("nat", function(naturalNumber) {
            var name = "fn" + naturalNumber;
            var fn = {
                toString: function() {
                    return "\nfunction " + name;
                }
            };

            return functionName(fn) === name;
        });
    });

    it("should not fail when a name cannot be found", function() {
        refute.exception(function() {
            var fn = {
                toString: function() {
                    return "\nfunction (";
                }
            };

            functionName(fn);
        });
    });
});
