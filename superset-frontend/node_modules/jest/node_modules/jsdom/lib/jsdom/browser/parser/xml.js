"use strict";

const { SaxesParser } = require("saxes");
const DOMException = require("domexception");

const DocumentFragment = require("../../living/generated/DocumentFragment");
const DocumentType = require("../../living/generated/DocumentType");
const CDATASection = require("../../living/generated/CDATASection");
const Comment = require("../../living/generated/Comment");
const ProcessingInstruction = require("../../living/generated/ProcessingInstruction");
const Text = require("../../living/generated/Text");

const attributes = require("../../living/attributes");
const { HTML_NS } = require("../../living/helpers/namespaces");

const HTML5_DOCTYPE = /<!doctype html>/i;
const PUBLIC_DOCTYPE = /<!doctype\s+([^\s]+)\s+public\s+"([^"]+)"\s+"([^"]+)"/i;
const SYSTEM_DOCTYPE = /<!doctype\s+([^\s]+)\s+system\s+"([^"]+)"/i;
const CUSTOM_NAME_DOCTYPE = /<!doctype\s+([^\s>]+)/i;

function parseDocType(doc, html) {
  if (HTML5_DOCTYPE.test(html)) {
    return createDocumentType(doc, "html", "", "");
  }

  const publicPieces = PUBLIC_DOCTYPE.exec(html);
  if (publicPieces) {
    return createDocumentType(doc, publicPieces[1], publicPieces[2], publicPieces[3]);
  }

  const systemPieces = SYSTEM_DOCTYPE.exec(html);
  if (systemPieces) {
    return createDocumentType(doc, systemPieces[1], "", systemPieces[2]);
  }

  const namePiece = CUSTOM_NAME_DOCTYPE.exec(html)[1] || "html";
  return createDocumentType(doc, namePiece, "", "");
}

function createDocumentType(ownerDocument, name, publicId, systemId) {
  return DocumentType.createImpl([], { ownerDocument, name, publicId, systemId });
}

function appendChild(parent, child) {
  // Template elements do not have children but instead store their content in a separate hierarchy.
  if (parent.tagName === "template" && parent.namespaceURI === HTML_NS) {
    parent._templateContents._insert(child, null);
  } else {
    parent._insert(child, null);
  }
}

function createParser(rootNode, ownerDocument, saxesOptions) {
  const parser = new SaxesParser(saxesOptions);
  const openStack = [rootNode];

  parser.ontext = saxesOptions.fragment ?
    // In a fragment, all text events produced by saxes must result in a text
    // node.
    data => {
      appendChild(
        openStack[openStack.length - 1],
        Text.createImpl([], { data, ownerDocument })
      );
    } :
    // When parsing a whole document, we must ignore those text nodes that are
    // produced outside the root element. Saxes produces events for them,
    // but DOM trees do not record text outside the root element.
    data => {
      if (openStack.length > 1) {
        appendChild(
          openStack[openStack.length - 1],
          Text.createImpl([], { data, ownerDocument })
        );
      }
    };

  parser.oncdata = data => {
    appendChild(
      openStack[openStack.length - 1],
      CDATASection.createImpl([], { data, ownerDocument })
    );
  };

  parser.onopentag = tag => {
    const { local: tagLocal, uri: tagURI, prefix: tagPrefix, attributes: tagAttributes } = tag;

    const elem = ownerDocument._createElementWithCorrectElementInterface(tagLocal, tagURI);

    elem._prefix = tagPrefix || null;
    elem._namespaceURI = tagURI || null;

    // We mark a script element as "parser-inserted", which prevents it from
    // being immediately executed.
    if (tagLocal === "script" && tagURI === HTML_NS) {
      elem._parserInserted = true;
    }

    for (const key of Object.keys(tagAttributes)) {
      const { prefix, local, uri, value } = tagAttributes[key];
      attributes.setAttributeValue(
        elem, local, value, prefix === "" ? null : prefix,
        uri === "" ? null : uri
      );
    }

    appendChild(
      openStack[openStack.length - 1],
      elem
    );
    openStack.push(elem);
  };

  parser.onclosetag = () => {
    const elem = openStack.pop();
    // Once a script is populated, we can execute it.
    if (elem.localName === "script" && elem.namespaceURI === HTML_NS) {
      elem._eval();
    }
  };

  parser.oncomment = data => {
    appendChild(
      openStack[openStack.length - 1],
      Comment.createImpl([], { data, ownerDocument })
    );
  };

  parser.onprocessinginstruction = ({ target, body }) => {
    appendChild(
      openStack[openStack.length - 1],
      ProcessingInstruction.createImpl([], { target, data: body, ownerDocument })
    );
  };

  parser.ondoctype = dt => {
    appendChild(
      openStack[openStack.length - 1],
      parseDocType(ownerDocument, `<!doctype ${dt}>`)
    );

    const entityMatcher = /<!ENTITY ([^ ]+) "([^"]+)">/g;
    let result;
    while ((result = entityMatcher.exec(dt))) {
      const [, name, value] = result;
      if (!(name in parser.ENTITIES)) {
        parser.ENTITIES[name] = value;
      }
    }
  };

  parser.onerror = err => {
    throw new DOMException(err.message, "SyntaxError");
  };

  return parser;
}

function parseFragment(markup, contextElement) {
  const ownerDocument = contextElement._ownerDocument;
  const fragment = DocumentFragment.createImpl([], { ownerDocument });

  // Only parseFragment needs resolvePrefix per the saxes documentation:
  // https://github.com/lddubeau/saxes#parsing-xml-fragments
  const parser = createParser(fragment, ownerDocument, {
    xmlns: true,
    fragment: true,
    resolvePrefix(prefix) {
      // saxes wants undefined as the return value if the prefix is not defined, not null.
      return contextElement.lookupNamespaceURI(prefix) || undefined;
    }
  });

  parser.write(markup).close();

  return fragment;
}

function parseIntoDocument(markup, ownerDocument) {
  const parser = createParser(ownerDocument, ownerDocument, {
    xmlns: true,
    fileName: ownerDocument.location && ownerDocument.location.href
  });

  parser.write(markup).close();

  return ownerDocument;
}

module.exports = {
  parseFragment,
  parseIntoDocument
};
