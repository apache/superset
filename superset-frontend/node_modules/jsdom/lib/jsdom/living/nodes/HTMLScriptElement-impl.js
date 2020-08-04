"use strict";
const vm = require("vm");
const whatwgEncoding = require("whatwg-encoding");

const HTMLElementImpl = require("./HTMLElement-impl").implementation;
const reflectURLAttribute = require("../../utils").reflectURLAttribute;
const resourceLoader = require("../../browser/resource-loader");
const reportException = require("../helpers/runtime-script-errors");
const domSymbolTree = require("../helpers/internal-constants").domSymbolTree;
const nodeTypes = require("../node-type");

const jsMIMETypes = new Set([
  "application/ecmascript",
  "application/javascript",
  "application/x-ecmascript",
  "application/x-javascript",
  "text/ecmascript",
  "text/javascript",
  "text/javascript1.0",
  "text/javascript1.1",
  "text/javascript1.2",
  "text/javascript1.3",
  "text/javascript1.4",
  "text/javascript1.5",
  "text/jscript",
  "text/livescript",
  "text/x-ecmascript",
  "text/x-javascript"
]);

class HTMLScriptElementImpl extends HTMLElementImpl {
  _attach() {
    super._attach();
    if (this.src) {
      resourceLoader.load(
        this,
        this.src,
        { defaultEncoding: whatwgEncoding.labelToName(this.getAttribute("charset")) || this._ownerDocument._encoding },
        this._eval
      );
    } else if (this.text.trim().length > 0) {
      resourceLoader.enqueue(this, this._ownerDocument.URL, this._eval)(null, this.text);
    }
  }

  _attrModified(name, value, oldValue) {
    super._attrModified(name, value, oldValue);

    if (this._attached && name === "src" && oldValue === null && value !== null) {
      resourceLoader.load(
        this,
        this.src,
        { defaultEncoding: whatwgEncoding.labelToName(this.getAttribute("charset")) || this._ownerDocument._encoding },
        this._eval
      );
    }
  }

  _eval(text, filename) {
    const typeString = this._getTypeString();

    if (this._ownerDocument.implementation._hasFeature("ProcessExternalResources", "script") &&
        jsMIMETypes.has(typeString.toLowerCase())) {
      this._ownerDocument._writeAfterElement = this;
      processJavaScript(this, text, filename);
      delete this._ownerDocument._writeAfterElement;
    }
  }

  _getTypeString() {
    const typeAttr = this.getAttribute("type");
    const langAttr = this.getAttribute("language");

    if (typeAttr === "") {
      return "text/javascript";
    }

    if (typeAttr === null && langAttr === "") {
      return "text/javascript";
    }

    if (typeAttr === null && langAttr === null) {
      return "text/javascript";
    }

    if (typeAttr !== null) {
      return typeAttr.trim();
    }

    if (langAttr !== null) {
      return "text/" + langAttr;
    }

    return null;
  }

  get text() {
    let text = "";
    for (const child of domSymbolTree.childrenIterator(this)) {
      if (child.nodeType === nodeTypes.TEXT_NODE) {
        text += child.nodeValue;
      }
    }
    return text;
  }

  set text(text) {
    this.textContent = text;
  }

  get src() {
    return reflectURLAttribute(this, "src");
  }

  set src(V) {
    this.setAttribute("src", V);
  }
}

function processJavaScript(element, code, filename) {
  const document = element.ownerDocument;
  const window = document && document._global;

  if (window) {
    document._currentScript = element;

    try {
      vm.runInContext(code, window, { filename, displayErrors: false });
    } catch (e) {
      reportException(window, e, filename);
    } finally {
      document._currentScript = null;
    }
  }
}

module.exports = {
  implementation: HTMLScriptElementImpl
};
