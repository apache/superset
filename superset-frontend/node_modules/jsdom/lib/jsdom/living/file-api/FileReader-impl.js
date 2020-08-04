"use strict";

const whatwgEncoding = require("whatwg-encoding");
const parseContentType = require("content-type-parser");
const querystring = require("querystring");
const DOMException = require("../../web-idl/DOMException");
const EventTargetImpl = require("../events/EventTarget-impl").implementation;
const Blob = require("../generated/Blob");
const ProgressEvent = require("../generated/ProgressEvent");

const READY_STATES = Object.freeze({
  EMPTY: 0,
  LOADING: 1,
  DONE: 2
});

exports.implementation = class FileReaderImpl extends EventTargetImpl {
  constructor(args, privateData) {
    super([], privateData);

    this.error = null;
    this.readyState = READY_STATES.EMPTY;
    this.result = null;

    this.onloadstart = null;
    this.onprogress = null;
    this.onload = null;
    this.onabort = null;
    this.onerror = null;
    this.onloadend = null;

    this._ownerDocument = privateData.window.document;
  }

  readAsArrayBuffer(file) {
    this._readFile(file, "buffer");
  }
  readAsDataURL(file) {
    this._readFile(file, "dataURL");
  }
  readAsText(file, encoding) {
    this._readFile(file, "text", whatwgEncoding.labelToName(encoding) || "UTF-8");
  }

  abort() {
    if (this.readyState === READY_STATES.DONE || this.readyState === READY_STATES.EMPTY) {
      this.result = null;
      return;
    }

    if (this.readyState === READY_STATES.LOADING) {
      this.readyState = READY_STATES.DONE;
    }

    this._fireProgressEvent("abort");
    this._fireProgressEvent("loadend");
  }

  _fireProgressEvent(name, props) {
    const event = ProgressEvent.createImpl([name, Object.assign({ bubbles: false, cancelable: false }, props)], {});
    this.dispatchEvent(event);
  }

  _readFile(file, format, encoding) {
    if (!Blob.isImpl(file)) {
      throw new TypeError("file argument must be a Blob");
    }

    if (this.readyState === READY_STATES.LOADING) {
      throw new DOMException(DOMException.INVALID_STATE_ERR);
    }
    if (file.isClosed) {
      this.error = new DOMException(DOMException.INVALID_STATE_ERR);
      this._fireProgressEvent("error");
    }

    this.readyState = READY_STATES.LOADING;
    this._fireProgressEvent("loadstart");

    process.nextTick(() => {
      let data = file._buffer;
      if (!data) {
        data = new Buffer("");
      }
      this._fireProgressEvent("progress", {
        lengthComputable: !isNaN(file.size),
        total: file.size,
        loaded: data.length
      });

      process.nextTick(() => {
        switch (format) {
          default:
          case "buffer": {
            this.result = (new Uint8Array(data)).buffer;
            break;
          }
          case "dataURL": {
            let dataUrl = "data:";
            const contentType = parseContentType(file.type);
            if (contentType && contentType.isText()) {
              const fallbackEncoding = whatwgEncoding.getBOMEncoding(data) ||
                whatwgEncoding.labelToName(contentType.get("charset")) || "UTF-8";
              const decoded = whatwgEncoding.decode(data, fallbackEncoding);

              contentType.set("charset", encoding);
              dataUrl += contentType.toString();
              dataUrl += ",";
              dataUrl += querystring.escape(decoded);
            } else {
              if (contentType) {
                dataUrl += contentType.toString();
              }
              dataUrl += ";base64,";
              dataUrl += data.toString("base64");
            }
            this.result = dataUrl;
            break;
          }
          case "text": {
            this.result = whatwgEncoding.decode(data, encoding);
            break;
          }
        }
        this.readyState = READY_STATES.DONE;
        this._fireProgressEvent("load");
        this._fireProgressEvent("loadend");
      });
    });
  }
};
