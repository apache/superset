"use strict";

const conversions = require("webidl-conversions");
const { isSummaryForParentDetails } = require("../helpers/details");
const focusing = require("../helpers/focusing");
const { HTML_NS, SVG_NS } = require("../helpers/namespaces");
const DOMStringMap = require("../generated/DOMStringMap");

const tabIndexReflectAllowedHTMLElements = new Set([
  "a", "area", "button", "frame", "iframe",
  "input", "object", "select", "textarea"
]);

class HTMLOrSVGElementImpl {
  _initHTMLOrSVGElement() {
    this._tabIndex = 0;
    this._dataset = DOMStringMap.createImpl([], { element: this });
  }

  get dataset() {
    return this._dataset;
  }

  // TODO this should be [Reflect]able if we added default value support to webidl2js's [Reflect]
  get tabIndex() {
    if (!this.hasAttributeNS(null, "tabindex")) {
      if ((this.namespaceURI === HTML_NS && (tabIndexReflectAllowedHTMLElements.has(this._localName) ||
                                             (this._localName === "summary" && isSummaryForParentDetails(this)))) ||
          (this.namespaceURI === SVG_NS && this._localName === "a")) {
        return 0;
      }
      return -1;
    }
    return conversions.long(this.getAttributeNS(null, "tabindex"));
  }

  set tabIndex(value) {
    this.setAttributeNS(null, "tabindex", String(value));
  }

  focus() {
    if (!focusing.isFocusableAreaElement(this)) {
      return;
    }

    const previous = this._ownerDocument._lastFocusedElement;

    if (previous === this) {
      return;
    }

    focusing.fireFocusEventWithTargetAdjustment("blur", previous, this);
    this._ownerDocument._lastFocusedElement = this;
    focusing.fireFocusEventWithTargetAdjustment("focus", this, previous);

    if (this._ownerDocument._defaultView._frameElement) {
      this._ownerDocument._defaultView._frameElement.focus();
    }
  }

  blur() {
    if (this._ownerDocument._lastFocusedElement !== this || !focusing.isFocusableAreaElement(this)) {
      return;
    }

    focusing.fireFocusEventWithTargetAdjustment("blur", this, this._ownerDocument);
    this._ownerDocument._lastFocusedElement = null;
    focusing.fireFocusEventWithTargetAdjustment("focus", this._ownerDocument, this);
  }
}

exports.implementation = HTMLOrSVGElementImpl;
