"use strict";
const HTMLElementImpl = require("./HTMLElement-impl").implementation;
const proxiedWindowEventHandlers = require("../helpers/proxied-window-event-handlers");

class HTMLBodyElementImpl extends HTMLElementImpl {}

for (const name of proxiedWindowEventHandlers) {
  Object.defineProperty(HTMLBodyElementImpl.prototype, name, {
    configurable: true,
    enumerable: true,
    get() {
      const window = this._ownerDocument._defaultView;
      return window ? window[name] : null;
    },
    set(handler) {
      const window = this._ownerDocument._defaultView;
      if (window) {
        window[name] = handler;
      }
    }
  });
}

module.exports = {
  implementation: HTMLBodyElementImpl
};
