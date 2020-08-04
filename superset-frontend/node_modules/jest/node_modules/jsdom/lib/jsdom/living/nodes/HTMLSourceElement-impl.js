"use strict";
const conversions = require("webidl-conversions");
const HTMLElementImpl = require("./HTMLElement-impl").implementation;
const { reflectURLAttribute } = require("../../utils");

class HTMLSourceElementImpl extends HTMLElementImpl {
  get src() {
    return reflectURLAttribute(this, "src");
  }

  set src(value) {
    this.setAttributeNS(null, "src", value);
  }

  get srcset() {
    return conversions.USVString(this.getAttributeNS(null, "srcset"));
  }

  set srcset(value) {
    this.setAttributeNS(null, "srcset", value);
  }
}

module.exports = {
  implementation: HTMLSourceElementImpl
};
