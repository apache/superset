"use strict";

const UIEventImpl = require("./UIEvent-impl").implementation;

class KeyboardEventImpl extends UIEventImpl {
  initKeyboardEvent(type, bubbles, cancelable, view, key, location, modifiersList, repeat, locale) {
    if (this._dispatchFlag) {
      return;
    }

    this.initUIEvent(type, bubbles, cancelable, view, key);
    this.location = location;
    this.modifiersList = modifiersList;
    this.repeat = repeat;
    this.locale = locale;
  }
}

module.exports = {
  implementation: KeyboardEventImpl
};
