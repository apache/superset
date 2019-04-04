"use strict";

const HTMLElementImpl = require("./HTMLElement-impl").implementation;
const idlUtils = require("../generated/utils");

const Event = require("../generated/Event");
const FileList = require("../generated/FileList");
const DOMException = require("../../web-idl/DOMException");
const internalConstants = require("../helpers/internal-constants");
const domSymbolTree = internalConstants.domSymbolTree;
const cloningSteps = internalConstants.cloningSteps;
const closest = require("../helpers/traversal").closest;
const isDisabled = require("../helpers/form-controls").isDisabled;

const filesSymbol = Symbol("files");

const selectAllowedTypes = new Set(["text", "search", "tel", "url", "password", "email", "date", "month", "week",
  "time", "datetime-local", "color", "file", "number"]);

const variableLengthSelectionAllowedTypes = new Set(["text", "search", "tel", "url", "password"]);

function allowSelect(type) {
  return selectAllowedTypes.has(type.toLowerCase());
}

function allowVariableLengthSelection(type) {
  return variableLengthSelectionAllowedTypes.has(type.toLowerCase());
}

class HTMLInputElementImpl extends HTMLElementImpl {
  constructor(args, privateData) {
    super(args, privateData);

    if (!this.type) {
      this.type = "text";
    }
    this._selectionStart = this._selectionEnd = 0;
    this._selectionDirection = "none";
    this._value = null;
    this._dirtyValue = false;
    this._checkedness = false;
    this._dirtyCheckedness = false;

    // This is used to implement the canceled activation steps for radio inputs:
    // "The canceled activation steps consist of setting the checkedness and the element's indeterminate IDL
    // attribute back to the values they had before the pre-click activation steps were run."
    this._preCancelState = null;
  }

  _getValue() {
    return this._value;
  }

  _preClickActivationSteps() {
    if (this.type === "checkbox") {
      this.checked = !this.checked;
    } else if (this.type === "radio") {
      this._preCancelState = this.checked;
      this.checked = true;
    }
  }

  _canceledActivationSteps() {
    if (this.type === "checkbox") {
      this.checked = !this.checked;
    } else if (this.type === "radio") {
      if (this._preCancelState !== null) {
        this.checked = this._preCancelState;
        this._preCancelState = null;
      }
    }
  }

  _activationBehavior() {
    if (isDisabled(this)) {
      return;
    }

    if (this.type === "checkbox") {
      const inputEvent = Event.createImpl(["input", { bubbles: true, cancelable: true }], {});
      this.dispatchEvent(inputEvent);

      const changeEvent = Event.createImpl(["change", { bubbles: true, cancelable: true }], {});
      this.dispatchEvent(changeEvent);
    } else if (this.type === "submit") {
      const form = this.form;
      if (form) {
        form._dispatchSubmitEvent();
      }
    }
  }

  _attrModified(name) {
    const wrapper = idlUtils.wrapperForImpl(this);
    if (!this._dirtyValue && name === "value") {
      this._value = wrapper.defaultValue;
    }
    if (!this._dirtyCheckedness && name === "checked") {
      this._checkedness = wrapper.defaultChecked;
      if (this._checkedness) {
        this._removeOtherRadioCheckedness();
      }
    }

    if (name === "name" || name === "type") {
      if (this._checkedness) {
        this._removeOtherRadioCheckedness();
      }
    }

    super._attrModified.apply(this, arguments);
  }
  _formReset() {
    const wrapper = idlUtils.wrapperForImpl(this);
    this._value = wrapper.defaultValue;
    this._dirtyValue = false;
    this._checkedness = wrapper.defaultChecked;
    this._dirtyCheckedness = false;
    if (this._checkedness) {
      this._removeOtherRadioCheckedness();
    }
  }
  _changedFormOwner() {
    if (this._checkedness) {
      this._removeOtherRadioCheckedness();
    }
  }
  _removeOtherRadioCheckedness() {
    const wrapper = idlUtils.wrapperForImpl(this);
    const root = this._radioButtonGroupRoot;
    if (!root) {
      return;
    }

    const name = wrapper.name.toLowerCase();

    const descendants = domSymbolTree.treeIterator(root);
    for (const candidate of descendants) {
      if (candidate._radioButtonGroupRoot !== root) {
        continue;
      }

      const candidateWrapper = idlUtils.wrapperForImpl(candidate);
      if (!candidateWrapper.name || candidateWrapper.name.toLowerCase() !== name) {
        continue;
      }

      if (candidate !== this) {
        candidate._checkedness = false;
      }
    }
  }
  get _radioButtonGroupRoot() {
    const wrapper = idlUtils.wrapperForImpl(this);
    if (this.type !== "radio" || !wrapper.name) {
      return null;
    }

    let e = domSymbolTree.parent(this);
    while (e) {
      // root node of this home sub tree
      // or the form element we belong to
      if (!domSymbolTree.parent(e) || e.nodeName.toUpperCase() === "FORM") {
        return e;
      }
      e = domSymbolTree.parent(e);
    }
    return null;
  }
  get form() {
    return closest(this, "form");
  }
  get checked() {
    return this._checkedness;
  }
  set checked(checked) {
    this._checkedness = Boolean(checked);
    this._dirtyCheckedness = true;
    if (this._checkedness) {
      this._removeOtherRadioCheckedness();
    }
  }
  get value() {
    if (this._value === null) {
      return "";
    }
    return this._value;
  }
  set value(val) {
    this._dirtyValue = true;

    if (val === null) {
      this._value = null;
    } else {
      this._value = String(val);
    }

    this._selectionStart = 0;
    this._selectionEnd = 0;
    this._selectionDirection = "none";
  }
  get files() {
    if (this.type === "file") {
      this[filesSymbol] = this[filesSymbol] || FileList.create();
    } else {
      this[filesSymbol] = null;
    }
    return this[filesSymbol];
  }
  get type() {
    const type = this.getAttribute("type");
    return type ? type.toLowerCase() : "text";
  }
  set type(type) {
    this.setAttribute("type", type);
  }

  _dispatchSelectEvent() {
    const event = this._ownerDocument.createEvent("HTMLEvents");
    event.initEvent("select", true, true);
    this.dispatchEvent(event);
  }
  _getValueLength() {
    return typeof this.value === "string" ? this.value.length : 0;
  }

  select() {
    if (!allowSelect(this.type)) {
      throw new DOMException(DOMException.INVALID_STATE_ERR);
    }

    this._selectionStart = 0;
    this._selectionEnd = this._getValueLength();
    this._selectionDirection = "none";
    this._dispatchSelectEvent();
  }

  get selectionStart() {
    if (!allowVariableLengthSelection(this.type)) {
      return null;
    }

    return this._selectionStart;
  }

  set selectionStart(start) {
    if (!allowVariableLengthSelection(this.type)) {
      throw new DOMException(DOMException.INVALID_STATE_ERR);
    }

    this.setSelectionRange(start, Math.max(start, this._selectionEnd), this._selectionDirection);
  }

  get selectionEnd() {
    if (!allowVariableLengthSelection(this.type)) {
      return null;
    }

    return this._selectionEnd;
  }

  set selectionEnd(end) {
    if (!allowVariableLengthSelection(this.type)) {
      throw new DOMException(DOMException.INVALID_STATE_ERR);
    }

    this.setSelectionRange(this._selectionStart, end, this._selectionDirection);
  }

  get selectionDirection() {
    if (!allowVariableLengthSelection(this.type)) {
      return null;
    }

    return this._selectionDirection;
  }

  set selectionDirection(dir) {
    if (!allowVariableLengthSelection(this.type)) {
      throw new DOMException(DOMException.INVALID_STATE_ERR);
    }

    this.setSelectionRange(this._selectionStart, this._selectionEnd, dir);
  }

  setSelectionRange(start, end, dir) {
    if (!allowVariableLengthSelection(this.type)) {
      throw new DOMException(DOMException.INVALID_STATE_ERR);
    }

    this._selectionEnd = Math.min(end, this._getValueLength());
    this._selectionStart = Math.min(start, this._selectionEnd);
    this._selectionDirection = dir === "forward" || dir === "backward" ? dir : "none";
    this._dispatchSelectEvent();
  }

  setRangeText(repl, start, end, selectionMode) {
    if (!allowVariableLengthSelection(this.type)) {
      throw new DOMException(DOMException.INVALID_STATE_ERR);
    }

    if (arguments.length < 2) {
      start = this._selectionStart;
      end = this._selectionEnd;
    } else if (start > end) {
      throw new DOMException(DOMException.INDEX_SIZE_ERR);
    }

    start = Math.min(start, this._getValueLength());
    end = Math.min(end, this._getValueLength());

    const val = this.value;
    let selStart = this._selectionStart;
    let selEnd = this._selectionEnd;

    this.value = val.slice(0, start) + repl + val.slice(end);

    const newEnd = start + this.value.length;

    if (selectionMode === "select") {
      this.setSelectionRange(start, newEnd);
    } else if (selectionMode === "start") {
      this.setSelectionRange(start, start);
    } else if (selectionMode === "end") {
      this.setSelectionRange(newEnd, newEnd);
    } else { // preserve
      const delta = repl.length - (end - start);

      if (selStart > end) {
        selStart += delta;
      } else if (selStart > start) {
        selStart = start;
      }

      if (selEnd > end) {
        selEnd += delta;
      } else if (selEnd > start) {
        selEnd = newEnd;
      }

      this.setSelectionRange(selStart, selEnd);
    }
  }

  set maxLength(value) {
    if (value < 0) {
      throw new DOMException(DOMException.INDEX_SIZE_ERR);
    }
    this.setAttribute("maxlength", String(value));
  }

  get maxLength() {
    if (!this.hasAttribute("maxlength")) {
      return 524288; // stole this from chrome
    }
    return parseInt(this.getAttribute("maxlength"));
  }

  set minLength(value) {
    if (value < 0) {
      throw new DOMException(DOMException.INDEX_SIZE_ERR);
    }
    this.setAttribute("minlength", String(value));
  }

  get minLength() {
    if (!this.hasAttribute("minlength")) {
      return 0;
    }
    return parseInt(this.getAttribute("minlength"));
  }

  get size() {
    if (!this.hasAttribute("size")) {
      return 20;
    }
    return parseInt(this.getAttribute("size"));
  }

  set size(value) {
    if (value <= 0) {
      throw new DOMException(DOMException.INDEX_SIZE_ERR);
    }
    this.setAttribute("size", String(value));
  }

  [cloningSteps](copy, node) {
    copy._value = node._value;
    copy._checkedness = node._checkedness;
    copy._dirtyValue = node._dirtyValue;
    copy._dirtyCheckedness = node._dirtyCheckedness;
  }
}

module.exports = {
  implementation: HTMLInputElementImpl
};
