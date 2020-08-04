"use strict";

const ElementImpl = require("./Element-impl").implementation;
const MouseEvent = require("../generated/MouseEvent");
const focusing = require("../helpers/focusing.js");
const conversions = require("webidl-conversions");
const isDisabled = require("../helpers/form-controls").isDisabled;

class HTMLElementImpl extends ElementImpl {
  constructor(args, privateData) {
    super(args, privateData);

    this._tabIndex = 0;

    this._settingCssText = false;
    this._clickInProgress = false;

    this._style = new this._core.CSSStyleDeclaration(newCssText => {
      if (!this._settingCssText) {
        this._settingCssText = true;
        this.setAttribute("style", newCssText);
        this._settingCssText = false;
      }
    });
  }

  // Add default event behavior (click link to navigate, click button to submit
  // form, etc). We start by wrapping dispatchEvent so we can forward events to
  // the element's default functions (only events that did not incur
  // preventDefault).
  dispatchEvent(event) {
    if (event.type === "click") {
      callEventBehaviorHook(event, "_preClickActivationSteps", this);
    }

    const outcome = super.dispatchEvent(event);

    if (event.type === "click") {
      if (event.defaultPrevented) {
        callEventBehaviorHook(event, "_canceledActivationSteps");
      } else {
        callEventBehaviorHook(event, "_activationBehavior");
      }
    }

    return outcome;
  }

  focus() {
    if (!focusing.isFocusableAreaElement(this)) {
      return;
    }

    const previous = this._ownerDocument._lastFocusedElement;

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

  click() {
    // https://html.spec.whatwg.org/multipage/interaction.html#dom-click
    // https://html.spec.whatwg.org/multipage/interaction.html#run-synthetic-click-activation-steps
    // Not completely spec compliant due to e.g. incomplete implementations of disabled for form controls, or no
    // implementation at all of isTrusted.

    if (this._clickInProgress) {
      return;
    }

    this._clickInProgress = true;

    if (isDisabled(this)) {
      return;
    }

    const event = MouseEvent.createImpl(["click", { bubbles: true, cancelable: true }], {});

    // Run synthetic click activation steps. According to the spec,
    // this should not be calling dispatchEvent, but it matches browser behavior.
    // See: https://www.w3.org/Bugs/Public/show_bug.cgi?id=12230
    // See also: https://github.com/whatwg/html/issues/805
    this.dispatchEvent(event);


    this._clickInProgress = false;
  }

  get style() {
    return this._style;
  }
  set style(value) {
    this._style.cssText = value;
  }

  _attrModified(name, value, oldValue) {
    if (name === "style" && value !== oldValue && !this._settingCssText) {
      this._settingCssText = true;
      this._style.cssText = value;
      this._settingCssText = false;
    }

    super._attrModified.apply(this, arguments);
  }

  // TODO this should be [Reflect]able if we added default value support to webidl2js's [Reflect]
  get tabIndex() {
    if (!this.hasAttribute("tabindex")) {
      return focusing.isFocusableAreaElement(this) ? 0 : -1;
    }
    return conversions.long(this.getAttribute("tabindex"));
  }

  set tabIndex(value) {
    this.setAttribute("tabIndex", String(value));
  }

  get offsetParent() {
    return null;
  }

  get offsetTop() {
    return 0;
  }

  get offsetLeft() {
    return 0;
  }

  get offsetWidth() {
    return 0;
  }

  get offsetHeight() {
    return 0;
  }
}

function callEventBehaviorHook(event, name, targetOverride) {
  if (event) {
    const target = targetOverride || event.target;
    if (target && typeof target[name] === "function") {
      target[name]();
    }
  }
}

module.exports = {
  implementation: HTMLElementImpl
};
