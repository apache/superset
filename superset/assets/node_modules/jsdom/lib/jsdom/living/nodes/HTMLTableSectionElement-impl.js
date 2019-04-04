"use strict";

const HTMLElementImpl = require("./HTMLElement-impl").implementation;
const idlUtils = require("../generated/utils");
const childrenByHTMLLocalName = require("../helpers/traversal").childrenByHTMLLocalName;
const createHTMLCollection = require("../../living/html-collection").create;
const DOMException = require("../../web-idl/DOMException");

class HTMLTableSectionElementImpl extends HTMLElementImpl {
  get rows() {
    if (!this._rows) {
      this._rows = createHTMLCollection(this, () => childrenByHTMLLocalName(this, "tr"));
    }
    return this._rows;
  }

  insertRow(index) {
    if (index < -1 || index > this.rows.length) {
      throw new DOMException(DOMException.INDEX_SIZE_ERR,
        "Cannot insert a row at an index that is less than -1 or greater than the number of existing rows");
    }

    const tr = this._ownerDocument.createElement("tr");

    if (index === -1 || index === this.rows.length) {
      this.appendChild(tr);
    } else {
      const beforeTR = idlUtils.implForWrapper(this.rows[index]);
      this.insertBefore(tr, beforeTR);
    }

    return tr;
  }

  deleteRow(index) {
    if (index < -1 || index >= this.rows.length) {
      throw new DOMException(DOMException.INDEX_SIZE_ERR, `Cannot delete a row at index ${index}, where no row exists`);
    }

    if (index === -1) {
      if (this.rows.length > 0) {
        const tr = idlUtils.implForWrapper(this.rows[this.rows.length - 1]);
        this.removeChild(tr);
      }
    } else {
      const tr = idlUtils.implForWrapper(this.rows[index]);
      this.removeChild(tr);
    }
  }
}

module.exports = {
  implementation: HTMLTableSectionElementImpl
};
