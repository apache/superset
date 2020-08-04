"use strict";

const EventImpl = require("./Event-impl").implementation;

class UIEventImpl extends EventImpl {
  initUIEvent(type, bubbles, cancelable, view, detail) {
    if (this._dispatchFlag) {
      return;
    }

    this.initEvent(type, bubbles, cancelable);
    this.view = view;
    this.detail = detail;
  }
}

module.exports = {
  implementation: UIEventImpl
};
