"use strict";

const HTMLElementImpl = require("./HTMLElement-impl").implementation;
const MouseEvent = require("../generated/MouseEvent");
const { domSymbolTree } = require("../helpers/internal-constants");
const NODE_TYPE = require("../node-type");
const { isLabelable, isDisabled } = require("../helpers/form-controls");
const { fireAnEvent } = require("../helpers/events");

function sendClickToAssociatedNode(node) {
  fireAnEvent("click", node, MouseEvent, {
    bubbles: true,
    cancelable: true,
    view: node.ownerDocument ? node.ownerDocument.defaultView : null,
    screenX: 0,
    screenY: 0,
    clientX: 0,
    clientY: 0,
    button: 0,
    detail: 1,
    relatedTarget: null
  });
}

class HTMLLabelElementImpl extends HTMLElementImpl {
  constructor(args, privateData) {
    super(args, privateData);

    this._hasActivationBehavior = true;
  }

  get control() {
    if (this.hasAttributeNS(null, "for")) {
      const forValue = this.getAttributeNS(null, "for");
      if (forValue === "") {
        return null;
      }
      const root = this.getRootNode({});
      for (const descendant of domSymbolTree.treeIterator(root)) {
        if (descendant.nodeType === NODE_TYPE.ELEMENT_NODE &&
          descendant.getAttributeNS(null, "id") === forValue) {
          return isLabelable(descendant) ? descendant : null;
        }
      }
      return null;
    }
    for (const descendant of domSymbolTree.treeIterator(this)) {
      if (isLabelable(descendant)) {
        return descendant;
      }
    }
    return null;
  }

  get form() {
    const node = this.control;
    if (node) {
      return node.form;
    }
    return null;
  }

  _activationBehavior() {
    const node = this.control;
    if (node && !isDisabled(node)) {
      sendClickToAssociatedNode(node);
    }
  }
}

module.exports = {
  implementation: HTMLLabelElementImpl
};
