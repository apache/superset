"use strict";
const isValidTargetOrigin = require("../utils").isValidTargetOrigin;
const DOMException = require("../web-idl/DOMException");

module.exports = function (message, targetOrigin) {
  if (arguments.length < 2) {
    throw new TypeError("'postMessage' requires 2 arguments: 'message' and 'targetOrigin'");
  }

  targetOrigin = String(targetOrigin);

  if (!isValidTargetOrigin(targetOrigin)) {
    throw new DOMException(DOMException.SYNTAX_ERR, "Failed to execute 'postMessage' on 'Window': " +
      "Invalid target origin '" + targetOrigin + "' in a call to 'postMessage'.");
  }

  // TODO: targetOrigin === '/' - requires reference to source window
  // See https://github.com/tmpvar/jsdom/pull/1140#issuecomment-111587499
  if (targetOrigin !== "*" && targetOrigin !== this.origin) {
    return;
  }

  // TODO: event.source - requires reference to source window
  // TODO: event.origin - requires reference to source window
  // TODO: event.ports
  // TODO: event.data - structured clone message - requires cloning DOM nodes
  const event = new this.MessageEvent("message", {
    data: message
  });

  event.initEvent("message", false, false);

  setTimeout(() => {
    this.dispatchEvent(event);
  }, 0);
};
