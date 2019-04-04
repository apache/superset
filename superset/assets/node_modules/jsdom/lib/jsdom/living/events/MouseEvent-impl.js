"use strict";

const UIEventImpl = require("./UIEvent-impl").implementation;

class MouseEventImpl extends UIEventImpl {
  initMouseEvent(type, bubbles, cancelable, view, detail, screenX, screenY, clientX, clientY,
                 ctrlKey, altKey, shiftKey, metaKey, button, relatedTarget) {
    if (this._dispatchFlag) {
      return;
    }

    this.initUIEvent(type, bubbles, cancelable, view, detail);
    this.screenX = screenX;
    this.screenY = screenY;
    this.clientX = clientX;
    this.clientY = clientY;
    this.ctrlKey = ctrlKey;
    this.altKey = altKey;
    this.shiftKey = shiftKey;
    this.metaKey = metaKey;
    this.button = button;
    this.relatedTarget = relatedTarget;
  }
}

module.exports = {
  implementation: MouseEventImpl
};
