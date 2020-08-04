"use strict";

const UIEventImpl = require("./UIEvent-impl").implementation;

const InputEventInit = require("../generated/InputEventInit");

// https://w3c.github.io/uievents/#interface-inputevent
class InputEventImpl extends UIEventImpl {
  initInputEvent(type, bubbles, cancelable, data, isComposing) {
    if (this._dispatchFlag) {
      return;
    }

    this.initUIEvent(type, bubbles, cancelable);
    this.data = data;
    this.isComposing = isComposing;
  }
}
InputEventImpl.defaultInit = InputEventInit.convert(undefined);

module.exports = {
  implementation: InputEventImpl
};
