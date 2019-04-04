"use strict";

const HTMLElementImpl = require("./HTMLElement-impl").implementation;

const closest = require("../helpers/traversal").closest;
const isDisabled = require("../helpers/form-controls").isDisabled;

class HTMLButtonElementImpl extends HTMLElementImpl {
  _activationBehavior() {
    const form = this.form;
    if (form) {
      if (this.type === "submit" && !isDisabled(this)) {
        form._dispatchSubmitEvent();
      }
    }
  }

  _getValue() {
    const valueAttr = this.getAttribute("value");
    return valueAttr === null ? "" : valueAttr;
  }

  get form() {
    return closest(this, "form");
  }

  get type() {
    const typeAttr = (this.getAttribute("type") || "").toLowerCase();
    switch (typeAttr) {
      case "submit":
      case "reset":
      case "button":
      case "menu":
        return typeAttr;
      default:
        return "submit";
    }
  }

  set type(v) {
    v = String(v).toLowerCase();
    switch (v) {
      case "submit":
      case "reset":
      case "button":
      case "menu":
        this.setAttribute("type", v);
        break;
      default:
        this.setAttribute("type", "submit");
        break;
    }
  }
}

module.exports = {
  implementation: HTMLButtonElementImpl
};
