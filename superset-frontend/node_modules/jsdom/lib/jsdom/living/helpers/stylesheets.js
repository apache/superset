"use strict";
const cssom = require("cssom");
const whatwgEncoding = require("whatwg-encoding");
const whatwgURL = require("whatwg-url");
const resourceLoader = require("../../browser/resource-loader");

exports.fetchStylesheet = (elementImpl, urlString, sheet) => {
  const parsedURL = whatwgURL.parseURL(urlString);
  return fetchStylesheetInternal(elementImpl, urlString, parsedURL, sheet);
};

exports.evaluateStylesheet = (elementImpl, data, sheet, baseURL) => {
  let newStyleSheet;
  try {
    newStyleSheet = cssom.parse(data);
  } catch (e) {
    if (elementImpl._ownerDocument._defaultView) {
      const error = new Error("Could not parse CSS stylesheet");
      error.detail = data;
      error.type = "css parsing";

      elementImpl._ownerDocument._defaultView._virtualConsole.emit("jsdomError", error);
    }

    elementImpl._ownerDocument.styleSheets.push(sheet);
    return;
  }

  const spliceArgs = newStyleSheet.cssRules;
  spliceArgs.unshift(0, sheet.cssRules.length);
  Array.prototype.splice.apply(sheet.cssRules, spliceArgs);

  scanForImportRules(elementImpl, sheet.cssRules, baseURL);

  elementImpl._ownerDocument.styleSheets.push(sheet);
};

function fetchStylesheetInternal(elementImpl, urlString, parsedURL, sheet) {
  let defaultEncoding = elementImpl._ownerDocument._encoding;
  if (elementImpl.localName === "link" && elementImpl.hasAttribute("charset")) {
    defaultEncoding = whatwgEncoding.labelToName(elementImpl.getAttribute("charset"));
  }

  resourceLoader.load(elementImpl, urlString, { defaultEncoding }, data => {
    // TODO: MIME type checking?
    exports.evaluateStylesheet(elementImpl, data, sheet, parsedURL);
  });
}

function scanForImportRules(elementImpl, cssRules, baseURL) {
  if (!cssRules) {
    return;
  }

  for (let i = 0; i < cssRules.length; ++i) {
    if (cssRules[i].cssRules) {
      // @media rule: keep searching inside it.
      scanForImportRules(elementImpl, cssRules[i].cssRules, baseURL);
    } else if (cssRules[i].href) {
      // @import rule: fetch the resource and evaluate it.
      // See http://dev.w3.org/csswg/cssom/#css-import-rule
      //     If loading of the style sheet fails its cssRules list is simply
      //     empty. I.e. an @import rule always has an associated style sheet.
      const parsed = whatwgURL.parseURL(cssRules[i].href, { baseURL });
      if (parsed === "failure") {
        const window = elementImpl._ownerDocument._defaultView;
        if (window) {
          const error = new Error(`Could not parse CSS @import URL ${cssRules[i].href} relative to base URL ` +
                                  `"${whatwgURL.serializeURL(baseURL)}"`);
          error.type = "css @import URL parsing";
          window._virtualConsole.emit("jsdomError", error);
        }
      } else {
        fetchStylesheetInternal(elementImpl, whatwgURL.serializeURL(parsed), parsed, elementImpl.sheet);
      }
    }
  }
}
