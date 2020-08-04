"use strict";

const EventImpl = require("./Event-impl").implementation;

class ProgressEventImpl extends EventImpl {

}

module.exports = {
  implementation: ProgressEventImpl
};
