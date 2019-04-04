"use strict";

const HTMLElementImpl = require("./HTMLElement-impl").implementation;
const reflectURLAttribute = require("../../utils").reflectURLAttribute;
const closest = require("../helpers/traversal").closest;

class HTMLObjectElementImpl extends HTMLElementImpl {
  get form() {
    return closest(this, "form");
  }

  get contentDocument() {
    return null;
  }

  get data() {
    return reflectURLAttribute(this, "data");
  }

  set data(V) {
    this.setAttribute("data", V);
  }

  get codeBase() {
    return reflectURLAttribute(this, "codebase");
  }

  set codeBase(V) {
    this.setAttribute("codebase", V);
  }
}

module.exports = {
  implementation: HTMLObjectElementImpl
};
