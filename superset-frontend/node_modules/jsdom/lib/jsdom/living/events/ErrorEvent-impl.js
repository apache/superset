"use strict";

const EventImpl = require("./Event-impl").implementation;

class ErrorEventImpl extends EventImpl {

}

module.exports = {
  implementation: ErrorEventImpl
};
