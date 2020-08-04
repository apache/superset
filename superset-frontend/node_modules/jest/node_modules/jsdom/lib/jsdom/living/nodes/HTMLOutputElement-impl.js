"use strict";

const DOMTokenList = require("../generated/DOMTokenList");
const HTMLElementImpl = require("./HTMLElement-impl").implementation;
const DefaultConstraintValidationImpl =
  require("../constraint-validation/DefaultConstraintValidation-impl").implementation;
const { mixin } = require("../../utils");
const { getLabelsForLabelable, formOwner } = require("../helpers/form-controls");

class HTMLOutputElementImpl extends HTMLElementImpl {
  constructor(args, privateData) {
    super(args, privateData);
    this._labels = null;
    this._defaultValue = "";
    this._valueMode = "default";

    this._customValidityErrorMessage = "";
  }

  _attrModified(name, value, oldValue) {
    super._attrModified(name, value, oldValue);

    if (name === "for" && this._htmlFor !== undefined) {
      this._htmlFor.attrModified();
    }
  }

  _barredFromConstraintValidationSpecialization() {
    return true;
  }

  _formReset() {
    if (this._valueMode === "value") {
      this.textContent = this._defaultValue;
    }

    this._defaultValue = "";
    this._valueMode = "default";
  }

  get htmlFor() {
    if (this._htmlFor === undefined) {
      this._htmlFor = DOMTokenList.createImpl([], {
        element: this,
        attributeLocalName: "for"
      });
    }
    return this._htmlFor;
  }

  get type() {
    return "output";
  }

  get labels() {
    return getLabelsForLabelable(this);
  }

  get form() {
    return formOwner(this);
  }

  get value() {
    return this.textContent;
  }

  set value(val) {
    this._valueMode = "value";
    this._defaultValue = this.textContent;
    this.textContent = val;
  }

  get defaultValue() {
    return this._valueMode === "default" ? this.textContent : this._defaultValue;
  }

  set defaultValue(val) {
    this._defaultValue = val;

    if (this._valueMode === "default") {
      this.textContent = val;
    }
  }
}

mixin(HTMLOutputElementImpl.prototype, DefaultConstraintValidationImpl.prototype);

module.exports = {
  implementation: HTMLOutputElementImpl
};
