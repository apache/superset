"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const convertNode = require("./Node.js").convert;
const isNode = require("./Node.js").is;
const convertHTMLElement = require("./HTMLElement.js").convert;
const impl = utils.implSymbol;
const Node = require("./Node.js");

class Document extends Node.interface {
  constructor() {
    return iface.setup(Object.create(new.target.prototype));
  }

  getElementsByTagName(qualifiedName) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'getElementsByTagName' on 'Document': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'getElementsByTagName' on 'Document': parameter 1"
      });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].getElementsByTagName(...args));
  }

  getElementsByTagNameNS(namespace, localName) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 2) {
      throw new TypeError(
        "Failed to execute 'getElementsByTagNameNS' on 'Document': 2 arguments required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      if (curArg === null || curArg === undefined) {
        curArg = null;
      } else {
        curArg = conversions["DOMString"](curArg, {
          context: "Failed to execute 'getElementsByTagNameNS' on 'Document': parameter 1"
        });
      }
      args.push(curArg);
    }
    {
      let curArg = arguments[1];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'getElementsByTagNameNS' on 'Document': parameter 2"
      });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].getElementsByTagNameNS(...args));
  }

  getElementsByClassName(classNames) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'getElementsByClassName' on 'Document': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'getElementsByClassName' on 'Document': parameter 1"
      });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].getElementsByClassName(...args));
  }

  createElement(localName) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'createElement' on 'Document': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'createElement' on 'Document': parameter 1"
      });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].createElement(...args));
  }

  createElementNS(namespace, qualifiedName) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 2) {
      throw new TypeError(
        "Failed to execute 'createElementNS' on 'Document': 2 arguments required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      if (curArg === null || curArg === undefined) {
        curArg = null;
      } else {
        curArg = conversions["DOMString"](curArg, {
          context: "Failed to execute 'createElementNS' on 'Document': parameter 1"
        });
      }
      args.push(curArg);
    }
    {
      let curArg = arguments[1];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'createElementNS' on 'Document': parameter 2"
      });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].createElementNS(...args));
  }

  createDocumentFragment() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl].createDocumentFragment());
  }

  createTextNode(data) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'createTextNode' on 'Document': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'createTextNode' on 'Document': parameter 1"
      });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].createTextNode(...args));
  }

  createCDATASection(data) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'createCDATASection' on 'Document': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'createCDATASection' on 'Document': parameter 1"
      });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].createCDATASection(...args));
  }

  createComment(data) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'createComment' on 'Document': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'createComment' on 'Document': parameter 1"
      });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].createComment(...args));
  }

  createProcessingInstruction(target, data) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 2) {
      throw new TypeError(
        "Failed to execute 'createProcessingInstruction' on 'Document': 2 arguments required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'createProcessingInstruction' on 'Document': parameter 1"
      });
      args.push(curArg);
    }
    {
      let curArg = arguments[1];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'createProcessingInstruction' on 'Document': parameter 2"
      });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].createProcessingInstruction(...args));
  }

  importNode(node) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'importNode' on 'Document': 1 argument required, but only " + arguments.length + " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = convertNode(curArg, { context: "Failed to execute 'importNode' on 'Document': parameter 1" });
      args.push(curArg);
    }
    {
      let curArg = arguments[1];
      if (curArg !== undefined) {
        curArg = conversions["boolean"](curArg, {
          context: "Failed to execute 'importNode' on 'Document': parameter 2"
        });
      } else {
        curArg = false;
      }
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].importNode(...args));
  }

  adoptNode(node) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'adoptNode' on 'Document': 1 argument required, but only " + arguments.length + " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = convertNode(curArg, { context: "Failed to execute 'adoptNode' on 'Document': parameter 1" });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].adoptNode(...args));
  }

  createAttribute(localName) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'createAttribute' on 'Document': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'createAttribute' on 'Document': parameter 1"
      });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].createAttribute(...args));
  }

  createAttributeNS(namespace, qualifiedName) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 2) {
      throw new TypeError(
        "Failed to execute 'createAttributeNS' on 'Document': 2 arguments required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      if (curArg === null || curArg === undefined) {
        curArg = null;
      } else {
        curArg = conversions["DOMString"](curArg, {
          context: "Failed to execute 'createAttributeNS' on 'Document': parameter 1"
        });
      }
      args.push(curArg);
    }
    {
      let curArg = arguments[1];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'createAttributeNS' on 'Document': parameter 2"
      });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].createAttributeNS(...args));
  }

  createEvent(interface_) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'createEvent' on 'Document': 1 argument required, but only " + arguments.length + " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'createEvent' on 'Document': parameter 1"
      });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].createEvent(...args));
  }

  createNodeIterator(root) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'createNodeIterator' on 'Document': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = convertNode(curArg, { context: "Failed to execute 'createNodeIterator' on 'Document': parameter 1" });
      args.push(curArg);
    }
    {
      let curArg = arguments[1];
      if (curArg !== undefined) {
        curArg = conversions["unsigned long"](curArg, {
          context: "Failed to execute 'createNodeIterator' on 'Document': parameter 2"
        });
      } else {
        curArg = 0xffffffff;
      }
      args.push(curArg);
    }
    {
      let curArg = arguments[2];
      if (curArg !== undefined) {
        if (curArg === null || curArg === undefined) {
          curArg = null;
        } else {
          curArg = utils.tryImplForWrapper(curArg);
        }
      } else {
        curArg = null;
      }
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].createNodeIterator(...args));
  }

  createTreeWalker(root) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'createTreeWalker' on 'Document': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = convertNode(curArg, { context: "Failed to execute 'createTreeWalker' on 'Document': parameter 1" });
      args.push(curArg);
    }
    {
      let curArg = arguments[1];
      if (curArg !== undefined) {
        curArg = conversions["unsigned long"](curArg, {
          context: "Failed to execute 'createTreeWalker' on 'Document': parameter 2"
        });
      } else {
        curArg = 0xffffffff;
      }
      args.push(curArg);
    }
    {
      let curArg = arguments[2];
      if (curArg !== undefined) {
        if (curArg === null || curArg === undefined) {
          curArg = null;
        } else {
          curArg = utils.tryImplForWrapper(curArg);
        }
      } else {
        curArg = null;
      }
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].createTreeWalker(...args));
  }

  getElementsByName(elementName) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'getElementsByName' on 'Document': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'getElementsByName' on 'Document': parameter 1"
      });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].getElementsByName(...args));
  }

  open() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }
    const args = [];
    {
      let curArg = arguments[0];
      if (curArg !== undefined) {
        curArg = conversions["DOMString"](curArg, { context: "Failed to execute 'open' on 'Document': parameter 1" });
      } else {
        curArg = "text/html";
      }
      args.push(curArg);
    }
    {
      let curArg = arguments[1];
      if (curArg !== undefined) {
        curArg = conversions["DOMString"](curArg, { context: "Failed to execute 'open' on 'Document': parameter 2" });
      } else {
        curArg = "";
      }
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].open(...args));
  }

  close() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].close();
  }

  write() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }
    const args = [];
    for (let i = 0; i < arguments.length; i++) {
      let curArg = arguments[i];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'write' on 'Document': parameter " + (i + 1)
      });
      args.push(curArg);
    }
    return this[impl].write(...args);
  }

  writeln() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }
    const args = [];
    for (let i = 0; i < arguments.length; i++) {
      let curArg = arguments[i];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'writeln' on 'Document': parameter " + (i + 1)
      });
      args.push(curArg);
    }
    return this[impl].writeln(...args);
  }

  hasFocus() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].hasFocus();
  }

  clear() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].clear();
  }

  captureEvents() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].captureEvents();
  }

  releaseEvents() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].releaseEvents();
  }

  getElementById(elementId) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'getElementById' on 'Document': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'getElementById' on 'Document': parameter 1"
      });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].getElementById(...args));
  }

  prepend() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }
    const args = [];
    for (let i = 0; i < arguments.length; i++) {
      let curArg = arguments[i];
      if (isNode(curArg)) {
        curArg = utils.implForWrapper(curArg);
      } else {
        curArg = conversions["DOMString"](curArg, {
          context: "Failed to execute 'prepend' on 'Document': parameter " + (i + 1)
        });
      }
      args.push(curArg);
    }
    return this[impl].prepend(...args);
  }

  append() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }
    const args = [];
    for (let i = 0; i < arguments.length; i++) {
      let curArg = arguments[i];
      if (isNode(curArg)) {
        curArg = utils.implForWrapper(curArg);
      } else {
        curArg = conversions["DOMString"](curArg, {
          context: "Failed to execute 'append' on 'Document': parameter " + (i + 1)
        });
      }
      args.push(curArg);
    }
    return this[impl].append(...args);
  }

  querySelector(selectors) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'querySelector' on 'Document': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'querySelector' on 'Document': parameter 1"
      });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].querySelector(...args));
  }

  querySelectorAll(selectors) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'querySelectorAll' on 'Document': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'querySelectorAll' on 'Document': parameter 1"
      });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].querySelectorAll(...args));
  }

  get implementation() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.getSameObject(this, "implementation", () => {
      return utils.tryWrapperForImpl(this[impl]["implementation"]);
    });
  }

  get URL() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["URL"];
  }

  get documentURI() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["documentURI"];
  }

  get origin() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["origin"];
  }

  get compatMode() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["compatMode"];
  }

  get characterSet() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["characterSet"];
  }

  get charset() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["charset"];
  }

  get inputEncoding() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["inputEncoding"];
  }

  get contentType() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["contentType"];
  }

  get doctype() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["doctype"]);
  }

  get documentElement() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["documentElement"]);
  }

  get referrer() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["referrer"];
  }

  get cookie() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["cookie"];
  }

  set cookie(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["USVString"](V, {
      context: "Failed to set the 'cookie' property on 'Document': The provided value"
    });

    this[impl]["cookie"] = V;
  }

  get lastModified() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["lastModified"];
  }

  get readyState() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["readyState"]);
  }

  get title() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["title"];
  }

  set title(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'title' property on 'Document': The provided value"
    });

    this[impl]["title"] = V;
  }

  get dir() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["dir"];
  }

  set dir(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, { context: "Failed to set the 'dir' property on 'Document': The provided value" });

    this[impl]["dir"] = V;
  }

  get body() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["body"]);
  }

  set body(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (V === null || V === undefined) {
      V = null;
    } else {
      V = convertHTMLElement(V, { context: "Failed to set the 'body' property on 'Document': The provided value" });
    }
    this[impl]["body"] = V;
  }

  get head() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["head"]);
  }

  get images() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.getSameObject(this, "images", () => {
      return utils.tryWrapperForImpl(this[impl]["images"]);
    });
  }

  get embeds() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.getSameObject(this, "embeds", () => {
      return utils.tryWrapperForImpl(this[impl]["embeds"]);
    });
  }

  get plugins() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.getSameObject(this, "plugins", () => {
      return utils.tryWrapperForImpl(this[impl]["plugins"]);
    });
  }

  get links() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.getSameObject(this, "links", () => {
      return utils.tryWrapperForImpl(this[impl]["links"]);
    });
  }

  get forms() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.getSameObject(this, "forms", () => {
      return utils.tryWrapperForImpl(this[impl]["forms"]);
    });
  }

  get scripts() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.getSameObject(this, "scripts", () => {
      return utils.tryWrapperForImpl(this[impl]["scripts"]);
    });
  }

  get currentScript() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["currentScript"]);
  }

  get defaultView() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["defaultView"]);
  }

  get onreadystatechange() {
    return utils.tryWrapperForImpl(this[impl]["onreadystatechange"]);
  }

  set onreadystatechange(V) {
    V = utils.tryImplForWrapper(V);

    this[impl]["onreadystatechange"] = V;
  }

  get anchors() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.getSameObject(this, "anchors", () => {
      return utils.tryWrapperForImpl(this[impl]["anchors"]);
    });
  }

  get applets() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.getSameObject(this, "applets", () => {
      return utils.tryWrapperForImpl(this[impl]["applets"]);
    });
  }

  get styleSheets() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.getSameObject(this, "styleSheets", () => {
      return utils.tryWrapperForImpl(this[impl]["styleSheets"]);
    });
  }

  get hidden() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["hidden"];
  }

  get visibilityState() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["visibilityState"]);
  }

  get onvisibilitychange() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onvisibilitychange"]);
  }

  set onvisibilitychange(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onvisibilitychange"] = V;
  }

  get onabort() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onabort"]);
  }

  set onabort(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onabort"] = V;
  }

  get onauxclick() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onauxclick"]);
  }

  set onauxclick(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onauxclick"] = V;
  }

  get onblur() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onblur"]);
  }

  set onblur(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onblur"] = V;
  }

  get oncancel() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["oncancel"]);
  }

  set oncancel(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["oncancel"] = V;
  }

  get oncanplay() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["oncanplay"]);
  }

  set oncanplay(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["oncanplay"] = V;
  }

  get oncanplaythrough() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["oncanplaythrough"]);
  }

  set oncanplaythrough(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["oncanplaythrough"] = V;
  }

  get onchange() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onchange"]);
  }

  set onchange(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onchange"] = V;
  }

  get onclick() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onclick"]);
  }

  set onclick(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onclick"] = V;
  }

  get onclose() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onclose"]);
  }

  set onclose(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onclose"] = V;
  }

  get oncontextmenu() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["oncontextmenu"]);
  }

  set oncontextmenu(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["oncontextmenu"] = V;
  }

  get oncuechange() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["oncuechange"]);
  }

  set oncuechange(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["oncuechange"] = V;
  }

  get ondblclick() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["ondblclick"]);
  }

  set ondblclick(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["ondblclick"] = V;
  }

  get ondrag() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["ondrag"]);
  }

  set ondrag(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["ondrag"] = V;
  }

  get ondragend() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["ondragend"]);
  }

  set ondragend(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["ondragend"] = V;
  }

  get ondragenter() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["ondragenter"]);
  }

  set ondragenter(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["ondragenter"] = V;
  }

  get ondragexit() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["ondragexit"]);
  }

  set ondragexit(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["ondragexit"] = V;
  }

  get ondragleave() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["ondragleave"]);
  }

  set ondragleave(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["ondragleave"] = V;
  }

  get ondragover() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["ondragover"]);
  }

  set ondragover(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["ondragover"] = V;
  }

  get ondragstart() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["ondragstart"]);
  }

  set ondragstart(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["ondragstart"] = V;
  }

  get ondrop() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["ondrop"]);
  }

  set ondrop(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["ondrop"] = V;
  }

  get ondurationchange() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["ondurationchange"]);
  }

  set ondurationchange(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["ondurationchange"] = V;
  }

  get onemptied() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onemptied"]);
  }

  set onemptied(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onemptied"] = V;
  }

  get onended() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onended"]);
  }

  set onended(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onended"] = V;
  }

  get onerror() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onerror"]);
  }

  set onerror(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onerror"] = V;
  }

  get onfocus() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onfocus"]);
  }

  set onfocus(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onfocus"] = V;
  }

  get oninput() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["oninput"]);
  }

  set oninput(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["oninput"] = V;
  }

  get oninvalid() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["oninvalid"]);
  }

  set oninvalid(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["oninvalid"] = V;
  }

  get onkeydown() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onkeydown"]);
  }

  set onkeydown(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onkeydown"] = V;
  }

  get onkeypress() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onkeypress"]);
  }

  set onkeypress(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onkeypress"] = V;
  }

  get onkeyup() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onkeyup"]);
  }

  set onkeyup(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onkeyup"] = V;
  }

  get onload() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onload"]);
  }

  set onload(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onload"] = V;
  }

  get onloadeddata() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onloadeddata"]);
  }

  set onloadeddata(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onloadeddata"] = V;
  }

  get onloadedmetadata() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onloadedmetadata"]);
  }

  set onloadedmetadata(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onloadedmetadata"] = V;
  }

  get onloadend() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onloadend"]);
  }

  set onloadend(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onloadend"] = V;
  }

  get onloadstart() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onloadstart"]);
  }

  set onloadstart(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onloadstart"] = V;
  }

  get onmousedown() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onmousedown"]);
  }

  set onmousedown(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onmousedown"] = V;
  }

  get onmouseenter() {
    return utils.tryWrapperForImpl(this[impl]["onmouseenter"]);
  }

  set onmouseenter(V) {
    V = utils.tryImplForWrapper(V);

    this[impl]["onmouseenter"] = V;
  }

  get onmouseleave() {
    return utils.tryWrapperForImpl(this[impl]["onmouseleave"]);
  }

  set onmouseleave(V) {
    V = utils.tryImplForWrapper(V);

    this[impl]["onmouseleave"] = V;
  }

  get onmousemove() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onmousemove"]);
  }

  set onmousemove(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onmousemove"] = V;
  }

  get onmouseout() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onmouseout"]);
  }

  set onmouseout(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onmouseout"] = V;
  }

  get onmouseover() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onmouseover"]);
  }

  set onmouseover(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onmouseover"] = V;
  }

  get onmouseup() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onmouseup"]);
  }

  set onmouseup(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onmouseup"] = V;
  }

  get onwheel() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onwheel"]);
  }

  set onwheel(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onwheel"] = V;
  }

  get onpause() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onpause"]);
  }

  set onpause(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onpause"] = V;
  }

  get onplay() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onplay"]);
  }

  set onplay(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onplay"] = V;
  }

  get onplaying() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onplaying"]);
  }

  set onplaying(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onplaying"] = V;
  }

  get onprogress() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onprogress"]);
  }

  set onprogress(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onprogress"] = V;
  }

  get onratechange() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onratechange"]);
  }

  set onratechange(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onratechange"] = V;
  }

  get onreset() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onreset"]);
  }

  set onreset(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onreset"] = V;
  }

  get onresize() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onresize"]);
  }

  set onresize(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onresize"] = V;
  }

  get onscroll() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onscroll"]);
  }

  set onscroll(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onscroll"] = V;
  }

  get onsecuritypolicyviolation() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onsecuritypolicyviolation"]);
  }

  set onsecuritypolicyviolation(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onsecuritypolicyviolation"] = V;
  }

  get onseeked() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onseeked"]);
  }

  set onseeked(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onseeked"] = V;
  }

  get onseeking() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onseeking"]);
  }

  set onseeking(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onseeking"] = V;
  }

  get onselect() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onselect"]);
  }

  set onselect(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onselect"] = V;
  }

  get onstalled() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onstalled"]);
  }

  set onstalled(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onstalled"] = V;
  }

  get onsubmit() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onsubmit"]);
  }

  set onsubmit(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onsubmit"] = V;
  }

  get onsuspend() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onsuspend"]);
  }

  set onsuspend(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onsuspend"] = V;
  }

  get ontimeupdate() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["ontimeupdate"]);
  }

  set ontimeupdate(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["ontimeupdate"] = V;
  }

  get ontoggle() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["ontoggle"]);
  }

  set ontoggle(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["ontoggle"] = V;
  }

  get onvolumechange() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onvolumechange"]);
  }

  set onvolumechange(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onvolumechange"] = V;
  }

  get onwaiting() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onwaiting"]);
  }

  set onwaiting(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onwaiting"] = V;
  }

  get activeElement() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["activeElement"]);
  }

  get children() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.getSameObject(this, "children", () => {
      return utils.tryWrapperForImpl(this[impl]["children"]);
    });
  }

  get firstElementChild() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["firstElementChild"]);
  }

  get lastElementChild() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["lastElementChild"]);
  }

  get childElementCount() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["childElementCount"];
  }
}
Object.defineProperties(Document.prototype, {
  getElementsByTagName: { enumerable: true },
  getElementsByTagNameNS: { enumerable: true },
  getElementsByClassName: { enumerable: true },
  createElement: { enumerable: true },
  createElementNS: { enumerable: true },
  createDocumentFragment: { enumerable: true },
  createTextNode: { enumerable: true },
  createCDATASection: { enumerable: true },
  createComment: { enumerable: true },
  createProcessingInstruction: { enumerable: true },
  importNode: { enumerable: true },
  adoptNode: { enumerable: true },
  createAttribute: { enumerable: true },
  createAttributeNS: { enumerable: true },
  createEvent: { enumerable: true },
  createNodeIterator: { enumerable: true },
  createTreeWalker: { enumerable: true },
  getElementsByName: { enumerable: true },
  open: { enumerable: true },
  close: { enumerable: true },
  write: { enumerable: true },
  writeln: { enumerable: true },
  hasFocus: { enumerable: true },
  clear: { enumerable: true },
  captureEvents: { enumerable: true },
  releaseEvents: { enumerable: true },
  getElementById: { enumerable: true },
  prepend: { enumerable: true },
  append: { enumerable: true },
  querySelector: { enumerable: true },
  querySelectorAll: { enumerable: true },
  implementation: { enumerable: true },
  URL: { enumerable: true },
  documentURI: { enumerable: true },
  origin: { enumerable: true },
  compatMode: { enumerable: true },
  characterSet: { enumerable: true },
  charset: { enumerable: true },
  inputEncoding: { enumerable: true },
  contentType: { enumerable: true },
  doctype: { enumerable: true },
  documentElement: { enumerable: true },
  referrer: { enumerable: true },
  cookie: { enumerable: true },
  lastModified: { enumerable: true },
  readyState: { enumerable: true },
  title: { enumerable: true },
  dir: { enumerable: true },
  body: { enumerable: true },
  head: { enumerable: true },
  images: { enumerable: true },
  embeds: { enumerable: true },
  plugins: { enumerable: true },
  links: { enumerable: true },
  forms: { enumerable: true },
  scripts: { enumerable: true },
  currentScript: { enumerable: true },
  defaultView: { enumerable: true },
  onreadystatechange: { enumerable: true },
  anchors: { enumerable: true },
  applets: { enumerable: true },
  styleSheets: { enumerable: true },
  hidden: { enumerable: true },
  visibilityState: { enumerable: true },
  onvisibilitychange: { enumerable: true },
  onabort: { enumerable: true },
  onauxclick: { enumerable: true },
  onblur: { enumerable: true },
  oncancel: { enumerable: true },
  oncanplay: { enumerable: true },
  oncanplaythrough: { enumerable: true },
  onchange: { enumerable: true },
  onclick: { enumerable: true },
  onclose: { enumerable: true },
  oncontextmenu: { enumerable: true },
  oncuechange: { enumerable: true },
  ondblclick: { enumerable: true },
  ondrag: { enumerable: true },
  ondragend: { enumerable: true },
  ondragenter: { enumerable: true },
  ondragexit: { enumerable: true },
  ondragleave: { enumerable: true },
  ondragover: { enumerable: true },
  ondragstart: { enumerable: true },
  ondrop: { enumerable: true },
  ondurationchange: { enumerable: true },
  onemptied: { enumerable: true },
  onended: { enumerable: true },
  onerror: { enumerable: true },
  onfocus: { enumerable: true },
  oninput: { enumerable: true },
  oninvalid: { enumerable: true },
  onkeydown: { enumerable: true },
  onkeypress: { enumerable: true },
  onkeyup: { enumerable: true },
  onload: { enumerable: true },
  onloadeddata: { enumerable: true },
  onloadedmetadata: { enumerable: true },
  onloadend: { enumerable: true },
  onloadstart: { enumerable: true },
  onmousedown: { enumerable: true },
  onmouseenter: { enumerable: true },
  onmouseleave: { enumerable: true },
  onmousemove: { enumerable: true },
  onmouseout: { enumerable: true },
  onmouseover: { enumerable: true },
  onmouseup: { enumerable: true },
  onwheel: { enumerable: true },
  onpause: { enumerable: true },
  onplay: { enumerable: true },
  onplaying: { enumerable: true },
  onprogress: { enumerable: true },
  onratechange: { enumerable: true },
  onreset: { enumerable: true },
  onresize: { enumerable: true },
  onscroll: { enumerable: true },
  onsecuritypolicyviolation: { enumerable: true },
  onseeked: { enumerable: true },
  onseeking: { enumerable: true },
  onselect: { enumerable: true },
  onstalled: { enumerable: true },
  onsubmit: { enumerable: true },
  onsuspend: { enumerable: true },
  ontimeupdate: { enumerable: true },
  ontoggle: { enumerable: true },
  onvolumechange: { enumerable: true },
  onwaiting: { enumerable: true },
  activeElement: { enumerable: true },
  children: { enumerable: true },
  firstElementChild: { enumerable: true },
  lastElementChild: { enumerable: true },
  childElementCount: { enumerable: true },
  [Symbol.toStringTag]: { value: "Document", configurable: true },
  [Symbol.unscopables]: { value: { prepend: true, append: true, __proto__: null }, configurable: true }
});
const iface = {
  // When an interface-module that implements this interface as a mixin is loaded, it will append its own `.is()`
  // method into this array. It allows objects that directly implements *those* interfaces to be recognized as
  // implementing this mixin interface.
  _mixedIntoPredicates: [],
  is(obj) {
    if (obj) {
      if (utils.hasOwn(obj, impl) && obj[impl] instanceof Impl.implementation) {
        return true;
      }
      for (const isMixedInto of module.exports._mixedIntoPredicates) {
        if (isMixedInto(obj)) {
          return true;
        }
      }
    }
    return false;
  },
  isImpl(obj) {
    if (obj) {
      if (obj instanceof Impl.implementation) {
        return true;
      }

      const wrapper = utils.wrapperForImpl(obj);
      for (const isMixedInto of module.exports._mixedIntoPredicates) {
        if (isMixedInto(wrapper)) {
          return true;
        }
      }
    }
    return false;
  },
  convert(obj, { context = "The provided value" } = {}) {
    if (module.exports.is(obj)) {
      return utils.implForWrapper(obj);
    }
    throw new TypeError(`${context} is not of type 'Document'.`);
  },

  create(constructorArgs, privateData) {
    let obj = Object.create(Document.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(Document.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    Node._internalSetup(obj);

    Object.defineProperties(
      obj,
      Object.getOwnPropertyDescriptors({
        get location() {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }

          return utils.tryWrapperForImpl(obj[impl]["location"]);
        },
        set location(V) {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }

          this.location.href = V;
        }
      })
    );

    Object.defineProperties(obj, { location: { configurable: false } });
  },
  setup(obj, constructorArgs, privateData) {
    if (!privateData) privateData = {};

    privateData.wrapper = obj;

    this._internalSetup(obj);
    Object.defineProperty(obj, impl, {
      value: new Impl.implementation(constructorArgs, privateData),
      configurable: true
    });

    obj[impl][utils.wrapperSymbol] = obj;
    if (Impl.init) {
      Impl.init(obj[impl], privateData);
    }
    return obj;
  },
  interface: Document,
  expose: {
    Window: { Document }
  }
}; // iface
module.exports = iface;

const Impl = require("../nodes/Document-impl.js");
