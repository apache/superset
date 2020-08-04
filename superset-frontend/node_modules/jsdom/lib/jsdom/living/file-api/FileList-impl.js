"use strict";

exports.implementation = class FileListImpl extends Array {
  constructor() {
    super(0);
  }
  item(index) {
    return this[index] || null;
  }
};
