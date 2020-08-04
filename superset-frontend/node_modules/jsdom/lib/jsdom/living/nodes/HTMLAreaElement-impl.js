"use strict";
const idlUtils = require("../generated/utils");
const HTMLElementImpl = require("./HTMLElement-impl").implementation;
const HTMLHyperlinkElementUtilsImpl = require("./HTMLHyperlinkElementUtils-impl").implementation;

class HTMLAreaElementImpl extends HTMLElementImpl {
  constructor(args, privateData) {
    super(args, privateData);

    this._htmlHyperlinkElementUtilsSetup();
  }
}

idlUtils.mixin(HTMLAreaElementImpl.prototype, HTMLHyperlinkElementUtilsImpl.prototype);

module.exports = {
  implementation: HTMLAreaElementImpl
};
