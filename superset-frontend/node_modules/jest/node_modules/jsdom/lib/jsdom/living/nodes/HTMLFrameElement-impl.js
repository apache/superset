"use strict";

const DOMException = require("domexception");
const MIMEType = require("whatwg-mimetype");
const whatwgEncoding = require("whatwg-encoding");
const { parseURL, serializeURL } = require("whatwg-url");
const sniffHTMLEncoding = require("html-encoding-sniffer");

const { evaluateJavaScriptURL } = require("../window/navigation");
const HTMLElementImpl = require("./HTMLElement-impl").implementation;
const { reflectURLAttribute } = require("../../utils");
const { parseIntoDocument } = require("../../browser/parser");
const { documentBaseURL } = require("../helpers/document-base-url");
const { fireAnEvent } = require("../helpers/events");
const { getAttributeValue } = require("../attributes");
const idlUtils = require("../generated/utils");

function fireLoadEvent(document, frame, attaching) {
  if (attaching) {
    fireAnEvent("load", frame);

    return;
  }

  const dummyPromise = Promise.resolve();

  function onLoad() {
    fireAnEvent("load", frame);
  }

  document._queue.push(dummyPromise, onLoad);
}

function fetchFrame(serializedURL, frame, document, contentDoc) {
  const resourceLoader = document._resourceLoader;

  let request;

  function onFrameLoaded(data) {
    const sniffOptions = {
      defaultEncoding: document._encoding
    };

    if (request.response) {
      const contentType = MIMEType.parse(request.response.headers["content-type"]) || new MIMEType("text/plain");
      sniffOptions.transportLayerEncodingLabel = contentType.parameters.get("charset");

      if (contentType) {
        if (contentType.isXML()) {
          contentDoc._parsingMode = "xml";
        }
        contentDoc.contentType = contentType.essence;
      }
    }

    const encoding = sniffHTMLEncoding(data, sniffOptions);
    contentDoc._encoding = encoding;

    const html = whatwgEncoding.decode(data, contentDoc._encoding);

    try {
      parseIntoDocument(html, contentDoc);
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.code === DOMException.SYNTAX_ERR &&
        contentDoc._parsingMode === "xml"
      ) {
        // As defined (https://html.spec.whatwg.org/#read-xml) parsing error in XML document may be reported inline by
        // mutating the document.
        const element = contentDoc.createElementNS("http://www.mozilla.org/newlayout/xml/parsererror.xml", "parsererror");
        element.textContent = error.message;

        while (contentDoc.childNodes.length > 0) {
          contentDoc.removeChild(contentDoc.lastChild);
        }
        contentDoc.appendChild(element);
      } else {
        throw error;
      }
    }

    contentDoc.close();

    return new Promise((resolve, reject) => {
      contentDoc.addEventListener("load", resolve);
      contentDoc.addEventListener("error", reject);
    });
  }

  request = resourceLoader.fetch(serializedURL, {
    element: frame,
    onLoad: onFrameLoaded
  });
}

function canDispatchEvents(frame, attaching) {
  if (!attaching) {
    return false;
  }

  return Object.keys(frame._eventListeners).length === 0;
}

function loadFrame(frame, attaching) {
  if (frame._contentDocument) {
    if (frame._contentDocument._defaultView) {
      // close calls delete on its document.
      frame._contentDocument._defaultView.close();
    } else {
      delete frame._contentDocument;
    }
  }

  const parentDoc = frame._ownerDocument;

  // https://html.spec.whatwg.org/#process-the-iframe-attributes
  let url;
  const srcAttribute = getAttributeValue(frame, "src");
  if (srcAttribute === "") {
    url = parseURL("about:blank");
  } else {
    url = parseURL(srcAttribute, { baseURL: documentBaseURL(parentDoc) || undefined }) || parseURL("about:blank");
  }
  const serializedURL = serializeURL(url);

  // This is not great, but prevents a require cycle during webidl2js generation
  const wnd = new parentDoc._defaultView.constructor({
    parsingMode: "html",
    url: url.scheme === "javascript" || serializedURL === "about:blank" ? parentDoc.URL : serializedURL,
    resourceLoader: parentDoc._defaultView._resourceLoader,
    referrer: parentDoc.URL,
    cookieJar: parentDoc._cookieJar,
    pool: parentDoc._pool,
    encoding: parentDoc._encoding,
    runScripts: parentDoc._defaultView._runScripts,
    commonForOrigin: parentDoc._defaultView._commonForOrigin,
    pretendToBeVisual: parentDoc._defaultView._pretendToBeVisual
  });

  const contentDoc = frame._contentDocument = idlUtils.implForWrapper(wnd._document);
  const parent = parentDoc._defaultView;
  const contentWindow = contentDoc._defaultView;
  contentWindow._parent = parent;
  contentWindow._top = parent.top;
  contentWindow._frameElement = frame;
  contentWindow._virtualConsole = parent._virtualConsole;

  if (parentDoc.origin === contentDoc.origin) {
    contentWindow._currentOriginData.windowsInSameOrigin.push(contentWindow);
  }

  const noQueue = canDispatchEvents(frame, attaching);

  // Handle about:blank with a simulated load of an empty document.
  if (serializedURL === "about:blank") {
    // Cannot be done inside the enqueued callback; the documentElement etc. need to be immediately available.
    parseIntoDocument("<html><head></head><body></body></html>", contentDoc);
    contentDoc.close(noQueue);

    if (noQueue) {
      fireLoadEvent(parentDoc, frame, noQueue);
    } else {
      contentDoc.addEventListener("load", () => {
        fireLoadEvent(parentDoc, frame);
      });
    }
  } else if (url.scheme === "javascript") {
    // Cannot be done inside the enqueued callback; the documentElement etc. need to be immediately available.
    parseIntoDocument("<html><head></head><body></body></html>", contentDoc);
    contentDoc.close(noQueue);
    const result = evaluateJavaScriptURL(contentWindow, url);
    if (typeof result === "string") {
      contentDoc.body.textContent = result;
    }
    if (noQueue) {
      fireLoadEvent(parentDoc, frame, noQueue);
    } else {
      contentDoc.addEventListener("load", () => {
        fireLoadEvent(parentDoc, frame);
      });
    }
  } else {
    fetchFrame(serializedURL, frame, parentDoc, contentDoc);
  }
}

function refreshAccessors(document) {
  const window = document._defaultView;

  if (!window) {
    return;
  }

  const frames = document.querySelectorAll("iframe,frame");

  // delete accessors for all frames
  for (let i = 0; i < window._length; ++i) {
    delete window[i];
  }

  window._length = frames.length;
  Array.prototype.forEach.call(frames, (frame, i) => {
    Object.defineProperty(window, i, {
      configurable: true,
      enumerable: true,
      get() {
        return frame.contentWindow;
      }
    });
  });
}

class HTMLFrameElementImpl extends HTMLElementImpl {
  constructor(args, privateData) {
    super(args, privateData);
    this._contentDocument = null;
  }
  _attrModified(name, value, oldVal) {
    super._attrModified(name, value, oldVal);
    if (name === "src") {
      // iframe should never load in a document without a Window
      // (e.g. implementation.createHTMLDocument)
      if (this._attached && this._ownerDocument._defaultView) {
        loadFrame(this);
      }
    }
  }

  _detach() {
    super._detach();

    if (this.contentWindow) {
      this.contentWindow.close();
    }

    refreshAccessors(this._ownerDocument);
  }

  _attach() {
    super._attach();

    if (this._ownerDocument._defaultView) {
      loadFrame(this, true);
    }
    refreshAccessors(this._ownerDocument);
  }

  get contentDocument() {
    return this._contentDocument;
  }

  get contentWindow() {
    return this.contentDocument ? this.contentDocument._defaultView : null;
  }

  get src() {
    return reflectURLAttribute(this, "src");
  }

  set src(value) {
    this.setAttributeNS(null, "src", value);
  }

  get longDesc() {
    return reflectURLAttribute(this, "longdesc");
  }

  set longDesc(value) {
    this.setAttributeNS(null, "longdesc", value);
  }
}

module.exports = {
  implementation: HTMLFrameElementImpl
};
