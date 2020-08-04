"use strict";

const parse5 = require("parse5");
const sax = require("sax");
const attributes = require("../living/attributes");
const DocumentType = require("../living/generated/DocumentType");
const locationInfo = require("../living/helpers/internal-constants").locationInfo;

class HtmlToDom {
  constructor(core, parser, parsingMode) {
    if (!parser) {
      if (parsingMode === "xml") {
        parser = sax;
      } else {
        parser = parse5;
      }
    }

    this.core = core;
    this.parser = parser;
    this.parsingMode = parsingMode;

    if (parser.DefaultHandler) {
      this.parserType = "htmlparser2";
    } else if (parser.Parser && parser.TreeAdapters) {
      this.parserType = "parse5v1";
    } else if (parser.moduleName === "HTML5") {
      this.parserType = "html5";
    } else if (parser.parser) {
      this.parserType = "sax";
    }
  }

  appendHtmlToElement(html, element) {
    if (typeof html !== "string") {
      html = String(html);
    }

    return this["_parseWith" + this.parserType](html, true, element);
  }

  appendHtmlToDocument(html, element) {
    if (typeof html !== "string") {
      html = String(html);
    }

    return this["_parseWith" + this.parserType](html, false, element);
  }

  _parseWithhtmlparser2(html, fragment, element) {
    const handler = new this.parser.DefaultHandler();
    // Check if document is XML
    const isXML = this.parsingMode === "xml";
    const parserInstance = new this.parser.Parser(handler, {
      xmlMode: isXML,
      lowerCaseTags: !isXML,
      lowerCaseAttributeNames: !isXML,
      decodeEntities: true
    });

    parserInstance.includeLocation = false;
    parserInstance.parseComplete(html);

    const parsed = handler.dom;
    for (let i = 0; i < parsed.length; i++) {
      setChild(this.core, element, parsed[i]);
    }

    return element;
  }

  _parseWithparse5v1(html, fragment, element) {
    if (this.parsingMode === "xml") {
      throw new Error("Can't parse XML with parse5, please use htmlparser2 instead.");
    }

    const htmlparser2Adapter = this.parser.TreeAdapters.htmlparser2;
    let dom;
    if (fragment) {
      const instance = new this.parser.Parser(htmlparser2Adapter);
      const parentElement = htmlparser2Adapter.createElement(element.tagName.toLowerCase(), element.namespaceURI, []);
      dom = instance.parseFragment(html, parentElement);
    } else {
      const instance = new this.parser.Parser(htmlparser2Adapter, { locationInfo: true });
      dom = instance.parse(html);
    }

    const parsed = dom.children;
    for (let i = 0; i < parsed.length; i++) {
      setChild(this.core, element, parsed[i]);
    }

    return element;
  }

  _parseWithhtml5(html, fragment, element) {
    if (element.nodeType === 9) {
      new this.parser.Parser({ document: element }).parse(html);
    } else {
      const p = new this.parser.Parser({ document: element.ownerDocument });
      p.parse_fragment(html, element);
    }
  }

  _parseWithsax(html, fragment, element) {
    const SaxParser = this.parser.parser;
    const parser = new SaxParser(/* strict = */true, { xmlns: true });
    parser.noscript = false;
    parser.looseCase = "toString";
    const openStack = [element];
    parser.ontext = text => {
      setChild(this.core, openStack[openStack.length - 1], {
        type: "text",
        data: text
      });
    };
    parser.onopentag = arg => {
      const attrValues = {};
      const attrPrefixes = {};
      const attrNamespaces = {};
      Object.keys(arg.attributes).forEach(key => {
        const localName = arg.attributes[key].local;
        attrValues[localName] = arg.attributes[key].value;
        attrPrefixes[localName] = arg.attributes[key].prefix || null;
        attrNamespaces[localName] = arg.attributes[key].uri || null;
      });

      if (arg.local === "script" && arg.uri === "http://www.w3.org/1999/xhtml") {
        openStack.push({
          type: "tag",
          name: arg.local,
          prefix: arg.prefix,
          namespace: arg.uri,
          attribs: attrValues,
          "x-attribsPrefix": attrPrefixes,
          "x-attribsNamespace": attrNamespaces
        });
      } else {
        const elem = setChild(this.core, openStack[openStack.length - 1], {
          type: "tag",
          name: arg.local,
          prefix: arg.prefix,
          namespace: arg.uri,
          attribs: attrValues,
          "x-attribsPrefix": attrPrefixes,
          "x-attribsNamespace": attrNamespaces
        });
        openStack.push(elem);
      }
    };
    parser.onclosetag = () => {
      const elem = openStack.pop();
      if (elem.constructor.name === "Object") { // we have an empty script tag
        setChild(this.core, openStack[openStack.length - 1], elem);
      }
    };
    parser.onscript = scriptText => {
      const tag = openStack.pop();
      tag.children = [{ type: "text", data: scriptText }];
      const elem = setChild(this.core, openStack[openStack.length - 1], tag);
      openStack.push(elem);
    };
    parser.oncomment = comment => {
      setChild(this.core, openStack[openStack.length - 1], {
        type: "comment",
        data: comment
      });
    };
    parser.onprocessinginstruction = pi => {
      setChild(this.core, openStack[openStack.length - 1], {
        type: "directive",
        name: "?" + pi.name,
        data: "?" + pi.name + " " + pi.body + "?"
      });
    };
    parser.ondoctype = dt => {
      setChild(this.core, openStack[openStack.length - 1], {
        type: "directive",
        name: "!doctype",
        data: "!doctype " + dt
      });

      const entityMatcher = /<!ENTITY ([^ ]+) "([^"]+)">/g;
      let result;
      while ((result = entityMatcher.exec(dt))) {
        // TODO Node v6 const [, name, value] = result;
        const name = result[1];
        const value = result[2];
        if (!(name in parser.ENTITIES)) {
          parser.ENTITIES[name] = value;
        }
      }
    };

    parser.onerror = err => {
      throw err;
    };
    parser.write(html).close();
  }
}

// utility function for forgiving parser
function setChild(core, parentImpl, node) {
  const currentDocument = parentImpl && parentImpl._ownerDocument || parentImpl;

  let newNode;
  let isTemplateContents = false;
  switch (node.type) {
    case "tag":
    case "script":
    case "style":
      newNode = currentDocument._createElementWithCorrectElementInterface(node.name, node.namespace);
      newNode._prefix = node.prefix || null;
      newNode._namespaceURI = node.namespace || null;
      break;

    case "root":
      // If we are in <template> then add all children to the parent's _templateContents; skip this virtual root node.
      if (parentImpl.tagName === "TEMPLATE" && parentImpl._namespaceURI === "http://www.w3.org/1999/xhtml") {
        newNode = parentImpl._templateContents;
        isTemplateContents = true;
      }
      break;

    case "text":
      // HTML entities should already be decoded by the parser, so no need to decode them
      newNode = currentDocument.createTextNode(node.data);
      break;

    case "comment":
      newNode = currentDocument.createComment(node.data);
      break;

    case "directive":
      if (node.name[0] === "?" && node.name.toLowerCase() !== "?xml") {
        const data = node.data.slice(node.name.length + 1, -1);
        newNode = currentDocument.createProcessingInstruction(node.name.substring(1), data);
      } else if (node.name.toLowerCase() === "!doctype") {
        if (node["x-name"] !== undefined) { // parse5 supports doctypes directly
          newNode = createDocumentTypeInternal(core, currentDocument,
            node["x-name"] || "",
            node["x-publicId"] || "",
            node["x-systemId"] || "");
        } else {
          newNode = parseDocType(core, currentDocument, "<" + node.data + ">");
        }
      }
      break;
  }

  if (!newNode) {
    return null;
  }

  newNode[locationInfo] = node.__location;

  if (node.attribs) {
    Object.keys(node.attribs).forEach(localName => {
      const value = node.attribs[localName];
      let prefix =
        node["x-attribsPrefix"] &&
        Object.prototype.hasOwnProperty.call(node["x-attribsPrefix"], localName) &&
        node["x-attribsPrefix"][localName] || null;
      const namespace =
        node["x-attribsNamespace"] &&
        Object.prototype.hasOwnProperty.call(node["x-attribsNamespace"], localName) &&
        node["x-attribsNamespace"][localName] || null;
      if (prefix === "xmlns" && localName === "") {
         // intended weirdness in node-sax, see https://github.com/isaacs/sax-js/issues/165
        localName = prefix;
        prefix = null;
      }
      attributes.setAttributeValue(newNode, localName, value, prefix, namespace);
    });
  }

  if (node.children) {
    for (let c = 0; c < node.children.length; c++) {
      setChild(core, newNode, node.children[c]);
    }
  }

  if (!isTemplateContents) {
    if (parentImpl._templateContents) {
      // Setting innerHTML on a <template>
      parentImpl._templateContents.appendChild(newNode);
    } else {
      parentImpl.appendChild(newNode);
    }
  }

  return newNode;
}

const HTML5_DOCTYPE = /<!doctype html>/i;
const PUBLIC_DOCTYPE = /<!doctype\s+([^\s]+)\s+public\s+"([^"]+)"\s+"([^"]+)"/i;
const SYSTEM_DOCTYPE = /<!doctype\s+([^\s]+)\s+system\s+"([^"]+)"/i;

function parseDocType(core, doc, html) {
  if (HTML5_DOCTYPE.test(html)) {
    return createDocumentTypeInternal(core, doc, "html", "", "");
  }

  const publicPieces = PUBLIC_DOCTYPE.exec(html);
  if (publicPieces) {
    return createDocumentTypeInternal(core, doc, publicPieces[1], publicPieces[2], publicPieces[3]);
  }

  const systemPieces = SYSTEM_DOCTYPE.exec(html);
  if (systemPieces) {
    return createDocumentTypeInternal(core, doc, systemPieces[1], "", systemPieces[2]);
  }

  // Shouldn't get here (the parser shouldn't let us know about invalid doctypes), but our logic likely isn't
  // real-world perfect, so let's fallback.
  return createDocumentTypeInternal(core, doc, "html", "", "");
}

function createDocumentTypeInternal(core, ownerDocument, name, publicId, systemId) {
  return DocumentType.createImpl([], { core, ownerDocument, name, publicId, systemId });
}

exports.HtmlToDom = HtmlToDom;
