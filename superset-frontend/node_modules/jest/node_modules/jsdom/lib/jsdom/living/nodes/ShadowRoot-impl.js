"use strict";

const { parseFragment } = require("../../browser/parser");
const { fragmentSerialization } = require("../domparsing/serialization.js");
const { getRoot } = require("../helpers/shadow-dom");
const { mixin } = require("../../utils");

const DocumentFragment = require("./DocumentFragment-impl").implementation;
const DocumentOrShadowRootImpl = require("./DocumentOrShadowRoot-impl").implementation;

class ShadowRootImpl extends DocumentFragment {
  constructor(args, privateData) {
    super(args, privateData);

    const { mode } = privateData;
    this._mode = mode;
  }

  _getTheParent(event) {
    if (!event.composed && this === getRoot(event._path[0].item)) {
      return null;
    }

    return this._host;
  }

  get mode() {
    return this._mode;
  }

  get host() {
    return this._host;
  }

  // https://w3c.github.io/DOM-Parsing/#dfn-innerhtml
  get innerHTML() {
    return fragmentSerialization(this, { requireWellFormed: true });
  }
  set innerHTML(markup) {
    const fragment = parseFragment(markup, this._host);
    this._replaceAll(fragment);
  }
}

mixin(ShadowRootImpl.prototype, DocumentOrShadowRootImpl.prototype);

module.exports = {
  implementation: ShadowRootImpl
};
