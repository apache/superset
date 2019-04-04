"use strict";

const HTMLElementImpl = require("./HTMLElement-impl").implementation;
const idlUtils = require("../generated/utils");
const createHTMLCollection = require("../../living/html-collection").create;
const childrenByHTMLLocalNames = require("../helpers/traversal").childrenByHTMLLocalNames;
const DOMException = require("../../web-idl/DOMException");
const domSymbolTree = require("../helpers/internal-constants").domSymbolTree;
const closest = require("../helpers/traversal").closest;

const cellLocalNames = new Set(["td", "th"]);

class HTMLTableRowElementImpl extends HTMLElementImpl {
  get cells() {
    if (!this._cells) {
      this._cells = createHTMLCollection(this, () => childrenByHTMLLocalNames(this, cellLocalNames));
    }
    return this._cells;
  }

  get rowIndex() {
    const table = closest(this, "table");
    return table ? Array.prototype.indexOf.call(table.rows, idlUtils.wrapperForImpl(this)) : -1;
  }

  get sectionRowIndex() {
    const parent = domSymbolTree.parent(this);
    if (parent === null) {
      return -1;
    }

    const rows = parent.rows;
    if (!rows) {
      return -1;
    }

    return Array.prototype.indexOf.call(rows, idlUtils.wrapperForImpl(this));
  }

  insertCell(index) {
    const td = this._ownerDocument.createElement("TD");
    const cells = this.cells;
    if (index < -1 || index > cells.length) {
      throw new DOMException(DOMException.INDEX_SIZE_ERR);
    }
    if (index === -1 || index === cells.length) {
      this.appendChild(td);
    } else {
      const ref = idlUtils.implForWrapper(cells[index]);
      this.insertBefore(td, ref);
    }
    return td;
  }

  deleteCell(index) {
    const cells = this.cells;
    if (index === -1) {
      index = cells.length - 1;
    }
    if (index < 0 || index >= cells.length) {
      throw new DOMException(DOMException.INDEX_SIZE_ERR);
    }
    const td = idlUtils.implForWrapper(cells[index]);
    this.removeChild(td);
  }
}

module.exports = {
  implementation: HTMLTableRowElementImpl
};
