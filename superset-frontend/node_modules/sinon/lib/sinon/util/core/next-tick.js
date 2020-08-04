"use strict";

var globalObject = require("@sinonjs/commons").global;
var getNextTick = require("./get-next-tick");

module.exports = getNextTick(globalObject.process, globalObject.setImmediate);
