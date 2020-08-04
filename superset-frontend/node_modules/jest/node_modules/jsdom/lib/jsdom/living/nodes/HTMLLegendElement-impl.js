"use strict";
const HTMLElementImpl = require("./HTMLElement-impl").implementation;
const { formOwner } = require("../helpers/form-controls");

class HTMLLegendElementImpl extends HTMLElementImpl {
  get form() {
    return formOwner(this);
  }
}

module.exports = {
  implementation: HTMLLegendElementImpl
};
