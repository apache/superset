"use strict";

module.exports = function (core) {
  const XMLHttpRequestEventTarget = core.XMLHttpRequestEventTarget;

  class XMLHttpRequestUpload extends XMLHttpRequestEventTarget {
    constructor() {
      super();
      if (!(this instanceof XMLHttpRequestUpload)) {
        throw new TypeError("DOM object constructor cannot be called as a function.");
      }
    }
  }

  core.XMLHttpRequestUpload = XMLHttpRequestUpload;
};

