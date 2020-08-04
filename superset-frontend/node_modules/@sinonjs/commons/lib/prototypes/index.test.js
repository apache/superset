"use strict";

var assert = require("@sinonjs/referee-sinon").assert;

var arrayProto = require("./index").array;
var functionProto = require("./index").function;
var mapProto = require("./index").map;
var objectProto = require("./index").object;
var setProto = require("./index").set;
var stringProto = require("./index").string;

describe("prototypes", function() {
    describe(".array", function() {
        verifyProperties(arrayProto, Array);
    });
    describe(".function", function() {
        verifyProperties(functionProto, Function);
    });
    describe(".map", function() {
        verifyProperties(mapProto, Map);
    });
    describe(".object", function() {
        verifyProperties(objectProto, Object);
    });
    describe(".set", function() {
        verifyProperties(setProto, Set);
    });
    describe(".string", function() {
        verifyProperties(stringProto, String);
    });
});

function verifyProperties(p, origin) {
    it("should have all the methods of the origin prototype", function() {
        var methodNames = Object.getOwnPropertyNames(origin.prototype).filter(
            function(name) {
                return (
                    name !== "size" &&
                    name !== "caller" &&
                    name !== "callee" &&
                    name !== "arguments" &&
                    typeof origin.prototype[name] === "function"
                );
            }
        );

        methodNames.forEach(function(name) {
            assert.isTrue(Object.prototype.hasOwnProperty.call(p, name), name);
        });
    });
}
