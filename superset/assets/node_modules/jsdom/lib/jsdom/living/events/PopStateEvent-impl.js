"use strict";
const EventImpl = require("./Event-impl.js").implementation;

exports.implementation = class PopStateEventImpl extends EventImpl {};
