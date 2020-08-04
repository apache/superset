"use strict";

const UIEventImpl = require("./UIEvent-impl").implementation;

class TouchEventImpl extends UIEventImpl {

}

module.exports = {
  implementation: TouchEventImpl
};
