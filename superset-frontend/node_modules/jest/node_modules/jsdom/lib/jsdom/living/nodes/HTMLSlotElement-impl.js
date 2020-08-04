"use strict";

const idlUtils = require("../generated/utils");
const HTMLElement = require("../generated/HTMLElement");
const HTMLElementImpl = require("./HTMLElement-impl").implementation;
const { getRoot, assignSlotableForTree, findFlattenedSlotables } = require("../helpers/shadow-dom");

class HTMLSlotElementImpl extends HTMLElementImpl {
  constructor(args, privateData) {
    super(args, privateData);
    this._assignedNodes = [];
  }

  // https://dom.spec.whatwg.org/#slot-name
  get name() {
    return this.getAttributeNS(null, "name") || "";
  }

  _attrModified(name, value, oldValue) {
    super._attrModified(name, value, oldValue);

    // https://dom.spec.whatwg.org/#slot-name
    if (name === "name") {
      if (value === oldValue) {
        return;
      }

      if (value === null && oldValue === "") {
        return;
      }

      if (value === "" && oldValue === null) {
        return;
      }

      assignSlotableForTree(getRoot(this));
    }
  }

  // https://html.spec.whatwg.org/#dom-slot-assignednodes
  assignedNodes(options) {
    if (!options || !options.flatten) {
      return this._assignedNodes.map(idlUtils.wrapperForImpl);
    }

    return findFlattenedSlotables(this).map(idlUtils.wrapperForImpl);
  }

  // https://html.spec.whatwg.org/#dom-slot-assignedelements
  assignedElements(options) {
    return this.assignedNodes(options).filter(HTMLElement.is);
  }
}

module.exports = {
  implementation: HTMLSlotElementImpl
};
