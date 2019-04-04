"use strict";

const HTMLElementImpl = require("./HTMLElement-impl").implementation;
const reflectURLAttribute = require("../../utils").reflectURLAttribute;

class HTMLAppletElementImpl extends HTMLElementImpl {
  get object() {
    return reflectURLAttribute(this, "object");
  }

  set object(V) {
    this.setAttribute("object", V);
  }

  get codeBase() {
    return reflectURLAttribute(this, "codebase");
  }

  set codeBase(V) {
    this.setAttribute("codebase", V);
  }
}

module.exports = {
  implementation: HTMLAppletElementImpl
};
