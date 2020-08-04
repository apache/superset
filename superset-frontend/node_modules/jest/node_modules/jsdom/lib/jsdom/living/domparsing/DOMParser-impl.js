"use strict";

const { parseIntoDocument } = require("../../browser/parser");

const Document = require("../generated/Document");

exports.implementation = class DOMParserImpl {
  parseFromString(string, contentType) {
    switch (String(contentType)) {
      case "text/html": {
        return createScriptingDisabledDocument("html", contentType, string);
      }

      case "text/xml":
      case "application/xml":
      case "application/xhtml+xml":
      case "image/svg+xml": {
        try {
          return createScriptingDisabledDocument("xml", contentType, string);
        } catch (error) {
          const document = createScriptingDisabledDocument("xml", contentType);
          const element = document.createElementNS("http://www.mozilla.org/newlayout/xml/parsererror.xml", "parsererror");

          element.textContent = error.message;

          document.appendChild(element);
          return document;
        }
      }

      default:
        throw new TypeError("Invalid contentType");
    }
  }
};

function createScriptingDisabledDocument(parsingMode, contentType, string) {
  const document = Document.createImpl([], {
    options: {
      parsingMode,
      encoding: "UTF-8",
      contentType,
      readyState: "complete",
      scriptingDisabled: true
      // TODO: somehow set URL to active document's URL
    }
  });

  if (string !== undefined) {
    parseIntoDocument(string, document);
  }

  return document;
}
