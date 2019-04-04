"use strict";

const idlUtils = require("../generated/utils");
const NodeImpl = require("./Node-impl").implementation;
const ChildNodeImpl = require("./ChildNode-impl").implementation;
const NonDocumentTypeChildNodeImpl = require("./NonDocumentTypeChildNode-impl").implementation;
const DOMException = require("../../web-idl/DOMException");

class CharacterDataImpl extends NodeImpl {
  constructor(args, privateData) {
    super(args, privateData);

    this._data = privateData.data;
  }

  get data() {
    return this._data;
  }
  set data(data) {
    this._data = data;
  }

  get length() {
    return this._data.length;
  }

  substringData(offset, count) {
    const length = this.length;

    if (offset > length) {
      throw new DOMException(DOMException.INDEX_SIZE_ERR);
    }

    if (offset + count > length) {
      return this._data.substring(offset);
    }

    return this._data.substring(offset, offset + count);
  }

  appendData(data) {
    this.replaceData(this.length, 0, data);
  }

  insertData(offset, data) {
    this.replaceData(offset, 0, data);
  }

  deleteData(offset, count) {
    this.replaceData(offset, count, "");
  }

  replaceData(offset, count, data) {
    const length = this.length;

    if (offset > length) {
      throw new DOMException(DOMException.INDEX_SIZE_ERR);
    }

    if (offset + count > length) {
      count = length - offset;
    }

    const start = this._data.substring(0, offset);
    const end = this._data.substring(offset + count);

    this._data = start + data + end;

    // TODO: range stuff
  }
}

idlUtils.mixin(CharacterDataImpl.prototype, NonDocumentTypeChildNodeImpl.prototype);
idlUtils.mixin(CharacterDataImpl.prototype, ChildNodeImpl.prototype);

module.exports = {
  implementation: CharacterDataImpl
};
