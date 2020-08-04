"use strict";

var behavior = require("./sinon/behavior");
var createSandbox = require("./sinon/create-sandbox");
var extend = require("./sinon/util/core/extend");
var fakeTimers = require("./sinon/util/fake-timers");
var format = require("./sinon/util/core/format");
var nise = require("nise");
var Sandbox = require("./sinon/sandbox");
var stub = require("./sinon/stub");

var apiMethods = {
    createSandbox: createSandbox,
    assert: require("./sinon/assert"),
    match: require("@sinonjs/samsam").createMatcher,
    restoreObject: require("./sinon/restore-object"),

    expectation: require("./sinon/mock-expectation"),
    defaultConfig: require("./sinon/util/core/default-config"),

    setFormatter: format.setFormatter,

    // fake timers
    timers: fakeTimers.timers,

    // fake XHR
    xhr: nise.fakeXhr.xhr,
    FakeXMLHttpRequest: nise.fakeXhr.FakeXMLHttpRequest,

    // fake server
    fakeServer: nise.fakeServer,
    fakeServerWithClock: nise.fakeServerWithClock,
    createFakeServer: nise.fakeServer.create.bind(nise.fakeServer),
    createFakeServerWithClock: nise.fakeServerWithClock.create.bind(nise.fakeServerWithClock),

    addBehavior: function(name, fn) {
        behavior.addBehavior(stub, name, fn);
    }
};

var sandbox = new Sandbox();

var api = extend(sandbox, apiMethods);

module.exports = api;
