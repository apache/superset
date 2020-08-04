"use strict";

const cssom = require("cssom");

class LinkStyleImpl {
  get sheet() {
    if (!this._cssStyleSheet) {
      this._cssStyleSheet = new cssom.CSSStyleSheet();
    }
    return this._cssStyleSheet;
  }
}

module.exports = {
  implementation: LinkStyleImpl
};
