"use strict";
const idlUtils = require("../generated/utils");
const conversions = require("webidl-conversions");
const Blob = require("../generated/Blob");

exports.implementation = class BlobImpl {
  constructor(args) {
    const parts = args[0];
    const properties = args[1];

    const buffers = [];

    if (parts !== undefined) {
      if (parts === null || typeof parts !== "object" || typeof parts[Symbol.iterator] !== "function") {
        throw new TypeError("parts must be an iterable object");
      }

      const arr = [];
      for (const part of parts) {
        if (part instanceof ArrayBuffer || ArrayBuffer.isView(part) || Blob.is(part)) {
          arr.push(idlUtils.tryImplForWrapper(part));
        } else {
          arr.push(conversions.USVString(part));
        }
      }

      for (const part of arr) {
        let buffer;
        if (part instanceof ArrayBuffer) {
          buffer = new Buffer(new Uint8Array(part));
        } else if (ArrayBuffer.isView(part)) {
          buffer = new Buffer(new Uint8Array(part.buffer, part.byteOffset, part.byteLength));
        } else if (Blob.isImpl(part)) {
          buffer = part._buffer;
        } else {
          buffer = new Buffer(part);
        }
        buffers.push(buffer);
      }
    }

    this._buffer = Buffer.concat(buffers);

    this.type = properties.type;
    if (/[^\u0020-\u007E]/.test(this.type)) {
      this.type = "";
    } else {
      this.type = this.type.toLowerCase();
    }

    this.isClosed = false;
  }

  get size() {
    return this.isClosed ? 0 : this._buffer.length;
  }

  slice(start, end, contentType) {
    const size = this.size;

    let relativeStart;
    let relativeEnd;
    let relativeContentType;

    if (start === undefined) {
      relativeStart = 0;
    } else if (start < 0) {
      relativeStart = Math.max(size + start, 0);
    } else {
      relativeStart = Math.min(start, size);
    }
    if (end === undefined) {
      relativeEnd = size;
    } else if (end < 0) {
      relativeEnd = Math.max(size + end, 0);
    } else {
      relativeEnd = Math.min(end, size);
    }

    if (contentType === undefined) {
      relativeContentType = "";
    } else {
      // sanitization (lower case and invalid char check) is done in the
      // constructor
      relativeContentType = contentType;
    }

    const span = Math.max(relativeEnd - relativeStart, 0);

    const buffer = this._buffer;
    const slicedBuffer = buffer.slice(
      relativeStart,
      relativeStart + span
    );

    const blob = Blob.createImpl([[], { type: relativeContentType }], {});
    blob.isClosed = this.isClosed;
    blob._buffer = slicedBuffer;
    return blob;
  }

  close() {
    this.isClosed = true;
  }
};
