"use strict";

const EventImpl = require("./Event-impl").implementation;

class CustomEventImpl extends EventImpl {
  initCustomEvent(type, bubbles, cancelable, detail) {
    if (this._dispatchFlag) {
      return;
    }

    this.initEvent(type, bubbles, cancelable);
    this.detail = detail;
  }
}

module.exports = {
  implementation: CustomEventImpl
};
