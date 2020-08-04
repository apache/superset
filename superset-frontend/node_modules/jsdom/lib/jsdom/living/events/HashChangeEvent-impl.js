"use strict";

const EventImpl = require("./Event-impl").implementation;

class HashChangeEventImpl extends EventImpl {

}

module.exports = {
  implementation: HashChangeEventImpl
};
