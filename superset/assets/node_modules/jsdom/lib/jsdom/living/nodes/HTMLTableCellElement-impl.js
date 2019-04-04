"use strict";

const HTMLElementImpl = require("./HTMLElement-impl").implementation;
const idlUtils = require("../generated/utils");

const closest = require("../helpers/traversal").closest;
const createDOMTokenList = require("../dom-token-list").create;
const resetDOMTokenList = require("../dom-token-list").reset;

class HTMLTableCellImpl extends HTMLElementImpl {
  get headers() {
    if (this._headers === undefined) {
      this._headers = createDOMTokenList(this, "headers");
    }
    return this._headers;
  }

  get cellIndex() {
    const tr = closest(this, "tr");
    if (tr === null) {
      return -1;
    }

    return Array.prototype.indexOf.call(tr.cells, idlUtils.wrapperForImpl(this));
  }

  get colSpan() {
    const value = this.getAttribute("colspan");
    return value === null ? 1 : value;
  }

  set colSpan(V) {
    this.setAttribute("colspan", String(V));
  }

  get rowSpan() {
    const value = this.getAttribute("rowspan");
    return value === null ? 1 : value;
  }

  set rowSpan(V) {
    this.setAttribute("rowspan", String(V));
  }

  _attrModified(name, value, oldValue) {
    if (name === "headers" && this._headers) {
      resetDOMTokenList(this._headers, value);
    }

    super._attrModified(name, value, oldValue);
  }
}

module.exports = {
  implementation: HTMLTableCellImpl
};
