"use strict";
var assert = require("assert"),
    hash   = require("./");

describe("hash", function() {
  it("should hash \"Mary had a little lamb.\" to 1766333550", function() {
    assert.equal(hash("Mary had a little lamb."), 1766333550);
  });

  it("should hash \"Hello, world!\" to 343662184", function() {
    assert.equal(hash("Hello, world!"), 343662184);
  });
});
