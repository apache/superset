"use strict";
/* eslint global-require: 0 */

const DocumentImpl = require("./nodes/Document-impl.js");

const mappings = {
  HTMLElement: {
    file: require("./generated/HTMLElement.js"),
    tags: []
  },
  HTMLAnchorElement: {
    file: require("./generated/HTMLAnchorElement.js"),
    tags: ["a"]
  },
  HTMLAppletElement: {
    file: require("./generated/HTMLAppletElement.js"),
    tags: ["applet"]
  },
  HTMLAreaElement: {
    file: require("./generated/HTMLAreaElement.js"),
    tags: ["area"]
  },
  HTMLAudioElement: {
    file: require("./generated/HTMLAudioElement.js"),
    tags: ["audio"]
  },
  HTMLBaseElement: {
    file: require("./generated/HTMLBaseElement.js"),
    tags: ["base"]
  },
  HTMLBodyElement: {
    file: require("./generated/HTMLBodyElement.js"),
    tags: ["body"]
  },
  HTMLBRElement: {
    file: require("./generated/HTMLBRElement.js"),
    tags: ["br"]
  },
  HTMLButtonElement: {
    file: require("./generated/HTMLButtonElement.js"),
    tags: ["button"]
  },
  HTMLCanvasElement: {
    file: require("./generated/HTMLCanvasElement.js"),
    tags: ["canvas"]
  },
  HTMLDataElement: {
    file: require("./generated/HTMLDataElement.js"),
    tags: ["data"]
  },
  HTMLDataListElement: {
    file: require("./generated/HTMLDataListElement.js"),
    tags: ["datalist"]
  },
  HTMLDialogElement: {
    file: require("./generated/HTMLDialogElement.js"),
    tags: ["dialog"]
  },
  HTMLDirectoryElement: {
    file: require("./generated/HTMLDirectoryElement.js"),
    tags: ["dir"]
  },
  HTMLDivElement: {
    file: require("./generated/HTMLDivElement.js"),
    tags: ["div"]
  },
  HTMLDListElement: {
    file: require("./generated/HTMLDListElement.js"),
    tags: ["dl"]
  },
  HTMLEmbedElement: {
    file: require("./generated/HTMLEmbedElement.js"),
    tags: ["embed"]
  },
  HTMLFieldSetElement: {
    file: require("./generated/HTMLFieldSetElement.js"),
    tags: ["fieldset"]
  },
  HTMLFontElement: {
    file: require("./generated/HTMLFontElement.js"),
    tags: ["font"]
  },
  HTMLFormElement: {
    file: require("./generated/HTMLFormElement.js"),
    tags: ["form"]
  },
  HTMLFrameElement: {
    file: require("./generated/HTMLFrameElement.js"),
    tags: ["frame"]
  },
  HTMLFrameSetElement: {
    file: require("./generated/HTMLFrameSetElement.js"),
    tags: ["frameset"]
  },
  HTMLHeadingElement: {
    file: require("./generated/HTMLHeadingElement.js"),
    tags: ["h1", "h2", "h3", "h4", "h5", "h6"]
  },
  HTMLHeadElement: {
    file: require("./generated/HTMLHeadElement.js"),
    tags: ["head"]
  },
  HTMLHRElement: {
    file: require("./generated/HTMLHRElement.js"),
    tags: ["hr"]
  },
  HTMLHtmlElement: {
    file: require("./generated/HTMLHtmlElement.js"),
    tags: ["html"]
  },
  HTMLIFrameElement: {
    file: require("./generated/HTMLIFrameElement.js"),
    tags: ["iframe"]
  },
  HTMLImageElement: {
    file: require("./generated/HTMLImageElement.js"),
    tags: ["img"]
  },
  HTMLInputElement: {
    file: require("./generated/HTMLInputElement.js"),
    tags: ["input"]
  },
  HTMLLabelElement: {
    file: require("./generated/HTMLLabelElement.js"),
    tags: ["label"]
  },
  HTMLLegendElement: {
    file: require("./generated/HTMLLegendElement.js"),
    tags: ["legend"]
  },
  HTMLLIElement: {
    file: require("./generated/HTMLLIElement.js"),
    tags: ["li"]
  },
  HTMLLinkElement: {
    file: require("./generated/HTMLLinkElement.js"),
    tags: ["link"]
  },
  HTMLMapElement: {
    file: require("./generated/HTMLMapElement.js"),
    tags: ["map"]
  },
  HTMLMediaElement: {
    file: require("./generated/HTMLMediaElement.js"),
    tags: []
  },
  HTMLMenuElement: {
    file: require("./generated/HTMLMenuElement.js"),
    tags: ["menu"]
  },
  HTMLMetaElement: {
    file: require("./generated/HTMLMetaElement.js"),
    tags: ["meta"]
  },
  HTMLMeterElement: {
    file: require("./generated/HTMLMeterElement.js"),
    tags: ["meter"]
  },
  HTMLModElement: {
    file: require("./generated/HTMLModElement.js"),
    tags: ["del", "ins"]
  },
  HTMLObjectElement: {
    file: require("./generated/HTMLObjectElement.js"),
    tags: ["object"]
  },
  HTMLOListElement: {
    file: require("./generated/HTMLOListElement.js"),
    tags: ["ol"]
  },
  HTMLOptGroupElement: {
    file: require("./generated/HTMLOptGroupElement.js"),
    tags: ["optgroup"]
  },
  HTMLOptionElement: {
    file: require("./generated/HTMLOptionElement.js"),
    tags: ["option"]
  },
  HTMLOutputElement: {
    file: require("./generated/HTMLOutputElement.js"),
    tags: ["output"]
  },
  HTMLParagraphElement: {
    file: require("./generated/HTMLParagraphElement.js"),
    tags: ["p"]
  },
  HTMLParamElement: {
    file: require("./generated/HTMLParamElement.js"),
    tags: ["param"]
  },
  HTMLPreElement: {
    file: require("./generated/HTMLPreElement.js"),
    tags: ["pre"]
  },
  HTMLProgressElement: {
    file: require("./generated/HTMLProgressElement.js"),
    tags: ["progress"]
  },
  HTMLQuoteElement: {
    file: require("./generated/HTMLQuoteElement.js"),
    tags: ["blockquote", "q"]
  },
  HTMLScriptElement: {
    file: require("./generated/HTMLScriptElement.js"),
    tags: ["script"]
  },
  HTMLSelectElement: {
    file: require("./generated/HTMLSelectElement.js"),
    tags: ["select"]
  },
  HTMLSourceElement: {
    file: require("./generated/HTMLSourceElement.js"),
    tags: ["source"]
  },
  HTMLSpanElement: {
    file: require("./generated/HTMLSpanElement.js"),
    tags: ["span"]
  },
  HTMLStyleElement: {
    file: require("./generated/HTMLStyleElement.js"),
    tags: ["style"]
  },
  HTMLTableCaptionElement: {
    file: require("./generated/HTMLTableCaptionElement.js"),
    tags: ["caption"]
  },
  HTMLTableCellElement: {
    file: require("./generated/HTMLTableCellElement.js"),
    tags: []
  },
  HTMLTableColElement: {
    file: require("./generated/HTMLTableColElement.js"),
    tags: ["col", "colgroup"]
  },
  HTMLTableDataCellElement: {
    file: require("./generated/HTMLTableDataCellElement.js"),
    tags: ["td"]
  },
  HTMLTableElement: {
    file: require("./generated/HTMLTableElement.js"),
    tags: ["table"]
  },
  HTMLTableHeaderCellElement: {
    file: require("./generated/HTMLTableHeaderCellElement.js"),
    tags: ["th"]
  },
  HTMLTimeElement: {
    file: require("./generated/HTMLTimeElement.js"),
    tags: ["time"]
  },
  HTMLTitleElement: {
    file: require("./generated/HTMLTitleElement.js"),
    tags: ["title"]
  },
  HTMLTableRowElement: {
    file: require("./generated/HTMLTableRowElement.js"),
    tags: ["tr"]
  },
  HTMLTableSectionElement: {
    file: require("./generated/HTMLTableSectionElement.js"),
    tags: ["thead", "tbody", "tfoot"]
  },
  HTMLTemplateElement: {
    file: require("./generated/HTMLTemplateElement.js"),
    tags: ["template"]
  },
  HTMLTextAreaElement: {
    file: require("./generated/HTMLTextAreaElement.js"),
    tags: ["textarea"]
  },
  HTMLTrackElement: {
    file: require("./generated/HTMLTrackElement.js"),
    tags: ["track"]
  },
  HTMLUListElement: {
    file: require("./generated/HTMLUListElement.js"),
    tags: ["ul"]
  },
  HTMLUnknownElement: {
    file: require("./generated/HTMLUnknownElement.js"),
    tags: []
  },
  HTMLVideoElement: {
    file: require("./generated/HTMLVideoElement.js"),
    tags: ["video"]
  }
};

module.exports = core => {
  for (const interfaceName of Object.keys(mappings)) {
    const file = mappings[interfaceName].file;
    const tags = mappings[interfaceName].tags;

    core[interfaceName] = file.interface;

    for (const tagName of tags) {
      DocumentImpl.implementation.prototype._elementBuilders[tagName] = (document, elName) => {
        return file.create([], {
          core,
          ownerDocument: document,
          localName: elName || tagName.toUpperCase()
        });
      };
    }
  }
};
