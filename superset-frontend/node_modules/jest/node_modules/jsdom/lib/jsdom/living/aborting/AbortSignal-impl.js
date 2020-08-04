"use strict";

const { setupForSimpleEventAccessors } = require("../helpers/create-event-accessor");
const { fireAnEvent } = require("../helpers/events");
const EventTargetImpl = require("../events/EventTarget-impl").implementation;

class AbortSignalImpl extends EventTargetImpl {
  constructor(args, privateData) {
    super();

    // make event firing possible
    this._ownerDocument = privateData.window.document;

    this.aborted = false;
    this.abortAlgorithms = new Set();
  }

  _signalAbort() {
    if (this.aborted) {
      return;
    }
    this.aborted = true;

    for (const algorithm of this.abortAlgorithms) {
      algorithm();
    }
    this.abortAlgorithms.clear();

    fireAnEvent("abort", this);
  }

  _addAlgorithm(algorithm) {
    if (this.aborted) {
      return;
    }
    this.abortAlgorithms.add(algorithm);
  }

  _removeAlgorithm(algorithm) {
    this.abortAlgorithms.delete(algorithm);
  }
}

setupForSimpleEventAccessors(AbortSignalImpl.prototype, ["abort"]);

module.exports = {
  implementation: AbortSignalImpl
};
