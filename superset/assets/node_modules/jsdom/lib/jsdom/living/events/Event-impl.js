"use strict";

const EventInit = require("../generated/EventInit");

class EventImpl {
  constructor(args, privateData) {
    const type = args[0]; // TODO: Replace with destructuring
    const eventInitDict = args[1] || EventInit.convert(undefined);

    this.type = type;

    const wrapper = privateData.wrapper;
    for (const key in eventInitDict) {
      if (key in wrapper) {
        this[key] = eventInitDict[key];
      }
    }

    this.target = null;
    this.currentTarget = null;
    this.eventPhase = 0;

    this._initializedFlag = true;
    this._stopPropagationFlag = false;
    this._stopImmediatePropagationFlag = false;
    this._canceledFlag = false;
    this._dispatchFlag = false;

    this.isTrusted = privateData.isTrusted || false;
    this.timeStamp = Date.now();
  }

  get defaultPrevented() {
    return this._canceledFlag;
  }

  stopPropagation() {
    this._stopPropagationFlag = true;
  }

  get cancelBubble() {
    return this._stopPropagationFlag;
  }

  set cancelBubble(v) {
    if (v) {
      this._stopPropagationFlag = true;
    }
  }

  stopImmediatePropagation() {
    this._stopPropagationFlag = true;
    this._stopImmediatePropagationFlag = true;
  }

  preventDefault() {
    if (this.cancelable) {
      this._canceledFlag = true;
    }
  }

  _initialize(type, bubbles, cancelable) {
    this.type = type;
    this._initializedFlag = true;

    this._stopPropagationFlag = false;
    this._stopImmediatePropagationFlag = false;
    this._canceledFlag = false;

    this.isTrusted = false;
    this.target = null;
    this.bubbles = bubbles;
    this.cancelable = cancelable;
  }

  initEvent(type, bubbles, cancelable) {
    if (this._dispatchFlag) {
      return;
    }

    this._initialize(type, bubbles, cancelable);
  }
}

module.exports = {
  implementation: EventImpl
};
