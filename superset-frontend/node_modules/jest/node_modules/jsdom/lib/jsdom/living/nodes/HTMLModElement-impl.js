"use strict";

const conversions = require("webidl-conversions");
const HTMLElementImpl = require("./HTMLElement-impl").implementation;

class HTMLModElementImpl extends HTMLElementImpl {
  get cite() {
    return conversions.USVString(this.getAttributeNS(null, "cite"));
  }

  set cite(value) {
    this.setAttributeNS(null, "cite", value);
  }
}

module.exports = {
  implementation: HTMLModElementImpl
};
